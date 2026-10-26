import os
import sys
import time
from unittest.mock import MagicMock, patch, mock_open
import pytest

from core.services.project import ProjectManager


@pytest.fixture
def mock_api():
    api = MagicMock()
    api.emit_log = MagicMock()
    api.emit_project_server_state = MagicMock()
    return api


@pytest.fixture
def project_mgr(tmp_path, mock_api):
    with patch("core.services.project.get_project_root", return_value=str(tmp_path)):
        pm = ProjectManager(mock_api)
        return pm


def test_start_project_server_project_not_found(project_mgr):
    result = project_mgr.start_project_server("non_existent_id")
    assert result["status"] == "error"
    assert result["message"] == "backend.project.project_not_found"


def test_start_project_server_already_running(project_mgr):
    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "proj_1", "name": "Test Node", "project_type": "node", "proxy_port": 3000, "path": "D:/dummy"}
    ])
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    project_mgr._running_servers["proj_1"] = {
        "process": mock_proc,
        "pid": 1234,
        "port": 3000,
        "start_time": time.time(),
        "name": "Test Node"
    }

    result = project_mgr.start_project_server("proj_1")
    assert result["status"] == "info"
    assert result["message"] == "backend.project.server_already_running"
    assert result["pid"] == 1234


def test_start_project_server_port_in_use(project_mgr):
    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "proj_1", "name": "Test Node", "project_type": "node", "proxy_port": 3000, "path": "D:/dummy"}
    ])
    with patch("core.services.project.check_port_in_use", return_value=True):
        result = project_mgr.start_project_server("proj_1")
        assert result["status"] == "error"
        assert result["message"] == "backend.project.port_in_use"
        assert result["args"]["port"] == 3000


def test_start_project_server_dir_not_found(project_mgr, tmp_path):
    missing_dir = str(tmp_path / "non_existent_dir")
    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "proj_1", "name": "Test Node", "project_type": "node", "proxy_port": 3000, "path": missing_dir}
    ])
    with patch("core.services.project.check_port_in_use", return_value=False):
        result = project_mgr.start_project_server("proj_1")
        assert result["status"] == "error"
        assert result["message"] == "backend.project.dir_not_found"


def test_start_project_server_success_with_existing_bat(project_mgr, tmp_path):
    project_dir = str(tmp_path / "my_node_proj")
    os.makedirs(project_dir, exist_ok=True)
    bat_file = os.path.join(project_dir, "start-dev.bat")
    with open(bat_file, "w") as f:
        f.write("npm run dev")

    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "proj_node", "name": "Node App", "project_type": "node", "proxy_port": 5173, "path": project_dir}
    ])

    mock_proc = MagicMock()
    mock_proc.pid = 9999
    mock_proc.poll.return_value = None

    with patch("core.services.project.check_port_in_use", return_value=False), \
         patch("core.services.project.subprocess.Popen", return_value=mock_proc) as mock_popen:
        result = project_mgr.start_project_server("proj_node")
        assert result["status"] == "success"
        assert result["pid"] == 9999
        assert result["port"] == 5173
        assert "proj_node" in project_mgr._running_servers
        mock_popen.assert_called_once()
        project_mgr.api.emit_project_server_state.assert_called_with({
            "project_id": "proj_node",
            "status": "running",
            "port": 5173,
            "pid": 9999
        })


def test_start_project_server_auto_scaffolds_missing_bat(project_mgr, tmp_path):
    project_dir = str(tmp_path / "my_py_proj")
    os.makedirs(project_dir, exist_ok=True)
    # No start-dev.bat initially
    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "proj_py", "name": "Python App", "project_type": "python", "framework": "fastapi", "proxy_port": 8000, "path": project_dir}
    ])

    mock_proc = MagicMock()
    mock_proc.pid = 8888
    mock_proc.poll.return_value = None

    with patch("core.services.project.check_port_in_use", return_value=False), \
         patch("core.services.project.subprocess.Popen", return_value=mock_proc):
        result = project_mgr.start_project_server("proj_py")
        assert result["status"] == "success"
        bat_file = os.path.join(project_dir, "start-dev.bat")
        assert os.path.exists(bat_file)
        with open(bat_file, "r") as f:
            content = f.read()
            assert "uvicorn" in content


def test_stop_project_server_not_running(project_mgr):
    result = project_mgr.stop_project_server("unknown_id")
    assert result["status"] == "info"
    assert result["message"] == "backend.project.server_not_running"


def test_stop_project_server_success(project_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 0
    mock_file = MagicMock()

    project_mgr._running_servers["proj_stop"] = {
        "process": mock_proc,
        "pid": 5555,
        "port": 3000,
        "file_handle": mock_file,
        "name": "Stopping App"
    }

    with patch("core.services.project.run_silent_command") as mock_run:
        result = project_mgr.stop_project_server("proj_stop")
        assert result["status"] == "success"
        assert result["message"] == "backend.project.server_stopped"
        assert "proj_stop" not in project_mgr._running_servers
        mock_run.assert_called_once()
        mock_file.close.assert_called_once()
        project_mgr.api.emit_project_server_state.assert_called_with({
            "project_id": "proj_stop",
            "status": "stopped"
        })


def test_get_project_server_status(project_mgr):
    # Not running
    st = project_mgr.get_project_server_status("dummy")
    assert st["running"] is False

    # Running
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    project_mgr._running_servers["p1"] = {
        "process": mock_proc,
        "pid": 111,
        "port": 3000,
        "start_time": time.time() - 10,
    }
    st = project_mgr.get_project_server_status("p1")
    assert st["running"] is True
    assert st["pid"] == 111
    assert st["port"] == 3000
    assert st["uptime"] >= 9.0

    # Process died unexpectedly
    mock_proc.poll.return_value = 1
    st = project_mgr.get_project_server_status("p1")
    assert st["running"] is False
    assert "p1" not in project_mgr._running_servers


def test_get_all_running_project_servers(project_mgr):
    mock_proc1 = MagicMock()
    mock_proc1.poll.return_value = None
    project_mgr._running_servers["p1"] = {
        "process": mock_proc1, "pid": 101, "port": 3000, "start_time": time.time()
    }
    mock_proc2 = MagicMock()
    mock_proc2.poll.return_value = None
    project_mgr._running_servers["p2"] = {
        "process": mock_proc2, "pid": 102, "port": 8000, "start_time": time.time()
    }

    all_servers = project_mgr.get_all_running_project_servers()
    assert len(all_servers) == 2
    assert "p1" in all_servers
    assert "p2" in all_servers


def test_stop_all_project_servers(project_mgr):
    project_mgr.stop_project_server = MagicMock()
    project_mgr._running_servers = {"p1": {}, "p2": {}}

    project_mgr.stop_all_project_servers()
    assert project_mgr.stop_project_server.call_count == 2


def test_get_project_server_logs(project_mgr, tmp_path):
    log_dir = os.path.join(str(tmp_path), "data", "logs", "projects")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "test_proj.log")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("Line 1: Server listening\nLine 2: GET / 200 OK\n")

    res = project_mgr.get_project_server_logs("test_proj")
    assert res["status"] == "success"
    assert "Server listening" in res["logs"]

    # Non existent log
    res_empty = project_mgr.get_project_server_logs("missing_proj")
    assert res_empty["status"] == "success"
    assert res_empty["logs"] == ""


def test_delete_project_stops_server_first(project_mgr):
    project_mgr.stop_project_server = MagicMock()
    project_mgr._read_projects = MagicMock(return_value=[
        {"id": "p_del", "domain": "pdel.local", "path": "D:/dummy"}
    ])
    project_mgr._delete_ssl_cert = MagicMock()
    project_mgr._save_projects = MagicMock()
    project_mgr.sync_windows_hosts = MagicMock()
    project_mgr.sync_apache_vhosts = MagicMock()

    res = project_mgr.delete_project("p_del", delete_files=False)
    assert res["status"] == "success"
    project_mgr.stop_project_server.assert_called_once_with("p_del")
