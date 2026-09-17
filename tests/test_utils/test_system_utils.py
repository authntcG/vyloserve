import os
import sys
import subprocess
import pytest
from unittest.mock import patch, MagicMock

from core.utils.system_utils import (
    get_project_root,
    get_silent_flags,
    run_silent_command,
    start_silent_process,
    check_port_in_use
)

def test_get_project_root_py_mode():
    """Test get_project_root when running as a normal Python script."""
    # Ensure sys.frozen is False
    with patch('sys.frozen', False, create=True):
        root = get_project_root()
        # It should go up 3 levels from core/utils/system_utils.py
        assert os.path.basename(root) == "vyloserve" or os.path.isdir(os.path.join(root, 'core'))

def test_get_project_root_frozen_mode():
    """Test get_project_root when running as a frozen PyInstaller executable."""
    with patch('sys.frozen', True, create=True):
        with patch('sys.executable', r'C:\FakePath\vyloserve.exe'):
            root = get_project_root()
            assert root == r'C:\FakePath'

def test_get_silent_flags():
    """Test get_silent_flags for Windows and non-Windows."""
    with patch('sys.platform', 'win32'):
        assert get_silent_flags() == 0x08000000
    with patch('sys.platform', 'darwin'):
        assert get_silent_flags() == 0
    with patch('sys.platform', 'linux'):
        assert get_silent_flags() == 0

@patch('subprocess.run')
def test_run_silent_command(mock_run):
    """Test run_silent_command passes the correct arguments to subprocess.run."""
    mock_run.return_value = subprocess.CompletedProcess(args=['cmd'], returncode=0, stdout='ok')
    
    with patch('sys.platform', 'win32'):
        res = run_silent_command(['echo', 'hello'], cwd='/tmp', env={'VAR': '1'})
        
        mock_run.assert_called_once_with(
            ['echo', 'hello'],
            cwd='/tmp',
            env={'VAR': '1'},
            creationflags=0x08000000,
            capture_output=True,
            text=True
        )
        assert res.stdout == 'ok'

@patch('subprocess.Popen')
def test_start_silent_process(mock_popen):
    """Test start_silent_process passes the correct arguments to subprocess.Popen."""
    mock_process = MagicMock()
    mock_popen.return_value = mock_process
    
    with patch('sys.platform', 'win32'):
        res = start_silent_process(['ping', 'localhost'], cwd='/tmp')
        
        mock_popen.assert_called_once_with(
            ['ping', 'localhost'],
            cwd='/tmp',
            env=None,
            creationflags=0x08000000,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        assert res == mock_process

@patch('socket.create_connection')
def test_check_port_in_use_success(mock_create_conn):
    """Test check_port_in_use when connection succeeds on the primary host."""
    # If create_connection does not raise an exception, it means the port is open
    mock_create_conn.return_value = MagicMock()
    
    assert check_port_in_use(8080) is True
    mock_create_conn.assert_called_once_with(('127.0.0.1', 8080), timeout=0.05)

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_fallback_ipv6(mock_create_conn, mock_socket):
    """Test check_port_in_use when IPv4 fails but IPv6 succeeds (localhost fallback)."""
    # Force primary connection to fail
    mock_create_conn.side_effect = ConnectionRefusedError()
    
    # Mock IPv6 fallback
    mock_sock_instance = MagicMock()
    mock_sock_instance.connect_ex.return_value = 0 # 0 means success
    
    # Support context manager
    mock_sock_instance.__enter__.return_value = mock_sock_instance
    mock_socket.return_value = mock_sock_instance
    
    assert check_port_in_use(5432, 'localhost') is True
    mock_create_conn.assert_called_once_with(('localhost', 5432), timeout=0.05)
    mock_sock_instance.connect_ex.assert_called_once_with(('::1', 5432))

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_all_fail(mock_create_conn, mock_socket):
    """Test check_port_in_use when all connections fail."""
    mock_create_conn.side_effect = ConnectionRefusedError()

    mock_sock_instance = MagicMock()
    mock_sock_instance.connect_ex.return_value = 10061 # Connection refused
    mock_sock_instance.__enter__.return_value = mock_sock_instance
    mock_socket.return_value = mock_sock_instance

    assert check_port_in_use(3306) is False

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_ipv6_fallback_itself_unsupported(mock_create_conn, mock_socket):
    """
    Edge case: jika IPv4 gagal DAN pembuatan socket IPv6 fallback itu sendiri melempar
    exception (mis. address family tidak didukung OS), harus tetap return False dengan
    aman, bukan crash.
    """
    mock_create_conn.side_effect = OSError("IPv4 connection refused")
    mock_socket.side_effect = OSError("AF_INET6 not supported on this system")

    assert check_port_in_use(5432, 'localhost') is False
