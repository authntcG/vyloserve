import os
import socket
from unittest.mock import MagicMock, patch
import psutil
from core.api import Api
from core.services.port_manager import PortManager

def test_port_manager_init():
    api_mock = MagicMock()
    pm = PortManager(api_mock)
    assert pm.api == api_mock
    assert os.path.exists(pm.root_dir)

@patch("core.services.port_manager.psutil.net_connections")
@patch("core.services.port_manager.psutil.Process")
def test_get_listening_ports_success(mock_process_class, mock_net_conns):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    # Mock 1 TCP listening conn and 1 UDP conn
    mock_tcp = MagicMock()
    mock_tcp.type = socket.SOCK_STREAM
    mock_tcp.status = psutil.CONN_LISTEN
    mock_tcp.laddr = MagicMock(ip="127.0.0.1", port=8080)
    mock_tcp.pid = 1234

    mock_udp = MagicMock()
    mock_udp.type = socket.SOCK_DGRAM
    mock_udp.status = "NONE"
    mock_udp.laddr = MagicMock(ip="0.0.0.0", port=5353)
    mock_udp.pid = 5678

    mock_ignored = MagicMock()
    mock_ignored.type = socket.SOCK_STREAM
    mock_ignored.status = psutil.CONN_ESTABLISHED
    mock_ignored.laddr = MagicMock(ip="127.0.0.1", port=50000)
    mock_ignored.pid = 9999

    mock_net_conns.return_value = [mock_tcp, mock_udp, mock_ignored]

    proc_mock = MagicMock()
    proc_mock.name.return_value = "node.exe"
    proc_mock.exe.return_value = os.path.join(pm.bin_dir, "node.exe")
    proc_mock.cmdline.return_value = ["node", "server.js"]
    proc_mock.memory_info.return_value = MagicMock(rss=25 * 1024 * 1024)
    mock_process_class.return_value = proc_mock

    res = pm.get_listening_ports()
    assert res["status"] == "success"
    data = res["data"]
    assert len(data) == 2

    ports = [d["port"] for d in data]
    assert 5353 in ports
    assert 8080 in ports

    tcp_item = next(d for d in data if d["port"] == 8080)
    assert tcp_item["protocol"] == "TCP"
    assert tcp_item["process_name"] == "node.exe"
    assert tcp_item["is_vylo_managed"] is True
    assert tcp_item["memory_mb"] == 25.0
    assert tcp_item["is_protected"] is False

@patch("core.services.port_manager.psutil.net_connections")
def test_get_listening_ports_system_process(mock_net_conns):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    mock_sys = MagicMock()
    mock_sys.type = socket.SOCK_STREAM
    mock_sys.status = psutil.CONN_LISTEN
    mock_sys.laddr = MagicMock(ip="0.0.0.0", port=135)
    mock_sys.pid = 4  # System PID

    mock_net_conns.return_value = [mock_sys]

    res = pm.get_listening_ports()
    assert res["status"] == "success"
    data = res["data"]
    assert len(data) == 1
    assert data[0]["is_protected"] is True
    assert data[0]["process_name"] == "System"

@patch("core.services.port_manager.psutil.net_connections")
def test_get_listening_ports_error_handling(mock_net_conns):
    api_mock = MagicMock()
    pm = PortManager(api_mock)
    mock_net_conns.side_effect = RuntimeError("Socket query failure")

    res = pm.get_listening_ports()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"
    api_mock.emit_log.assert_called_with("backend.error.unexpected", "error", {"e": "Socket query failure"})

def test_kill_process_invalid_pid():
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    # PID <= 4
    res = pm.kill_process(4)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.invalid_pid"

    # Non-int
    res2 = pm.kill_process("invalid")  # type: ignore
    assert res2["status"] == "error"
    assert res2["message"] == "backend.port_manager.invalid_pid"

def test_kill_process_cannot_kill_self():
    api_mock = MagicMock()
    pm = PortManager(api_mock)
    current_pid = os.getpid()

    res = pm.kill_process(current_pid)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.cannot_kill_self"

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_system_protected(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    proc_mock = MagicMock()
    proc_mock.name.return_value = "svchost.exe"
    mock_proc_class.return_value = proc_mock

    res = pm.kill_process(9999)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.system_process_protected"
    assert res["args"]["name"] == "svchost.exe"

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_success_graceful(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    proc_mock = MagicMock()
    proc_mock.name.return_value = "httpd.exe"
    mock_proc_class.return_value = proc_mock

    res = pm.kill_process(5555, force=False)
    assert res["status"] == "success"
    assert res["message"] == "backend.port_manager.killed_success"
    proc_mock.terminate.assert_called_once()
    proc_mock.wait.assert_called_once_with(timeout=2.0)
    api_mock.emit_log.assert_called_with(
        "backend.port_manager.killed_success",
        "info",
        {"name": "httpd.exe", "pid": 5555}
    )

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_force(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    proc_mock = MagicMock()
    proc_mock.name.return_value = "zombie.exe"
    mock_proc_class.return_value = proc_mock

    res = pm.kill_process(5555, force=True)
    assert res["status"] == "success"
    proc_mock.kill.assert_called_once()
    proc_mock.terminate.assert_not_called()

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_timeout_expired_falls_back_to_kill(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)

    proc_mock = MagicMock()
    proc_mock.name.return_value = "stubborn.exe"
    proc_mock.wait.side_effect = psutil.TimeoutExpired(2.0)
    mock_proc_class.return_value = proc_mock

    res = pm.kill_process(5555, force=False)
    assert res["status"] == "success"
    proc_mock.terminate.assert_called_once()
    proc_mock.kill.assert_called_once()

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_not_found(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)
    mock_proc_class.side_effect = psutil.NoSuchProcess(pid=8888)

    res = pm.kill_process(8888)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.process_not_found"

@patch("core.services.port_manager.psutil.Process")
def test_kill_process_access_denied(mock_proc_class):
    api_mock = MagicMock()
    pm = PortManager(api_mock)
    mock_proc_class.side_effect = psutil.AccessDenied(pid=8888)

    res = pm.kill_process(8888)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.access_denied_admin"
    api_mock.emit_log.assert_called_with("backend.port_manager.access_denied_admin", "error", {"pid": 8888})

def test_api_facade_port_methods():
    api = Api()
    with patch.object(api.port_manager, "get_listening_ports") as mock_get:
        mock_get.return_value = {"status": "success", "data": []}
        assert api.get_listening_ports()["status"] == "success"
        mock_get.assert_called_once()

    with patch.object(api.port_manager, "kill_process") as mock_kill:
        mock_kill.return_value = {"status": "success"}
        assert api.kill_process_by_pid(1234, True)["status"] == "success"
        mock_kill.assert_called_once_with(1234, True)

    # Invalid pid via api facade
    res = api.kill_process_by_pid(-1)
    assert res["status"] == "error"
    assert res["message"] == "backend.port_manager.invalid_pid"
