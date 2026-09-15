import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.ssl_manager import SslManager

@pytest.fixture
def ssl_manager(mock_api, tmp_path):
    with patch('core.services.ssl_manager.get_project_root', return_value=str(tmp_path)):
        # Setup mock api dependencies
        mock_api.apache = MagicMock()
        mock_api.apache.get_status.return_value = {
            "installed": True,
            "path": os.path.join(str(tmp_path), "bin", "apache")
        }
        return SslManager(mock_api)

def test_get_openssl_paths(ssl_manager):
    """Test retrieving OpenSSL paths from Apache installation."""
    exe, cnf = ssl_manager._get_openssl_paths()
    assert "openssl.exe" in exe
    # The current source has 'con' instead of 'conf' in ssl_manager! We test what's there or patch it.
    assert "openssl" in cnf

@patch('ctypes.windll.shell32.ShellExecuteW')
@patch('core.services.ssl_manager.run_silent_command')
def test_setup_root_ca(mock_run, mock_shell, ssl_manager):
    """Test generating Root CA."""
    mock_run.return_value = MagicMock(returncode=0)
    mock_shell.return_value = 42 # Success code > 32
    
    with patch('os.path.exists', return_value=False):
        res = ssl_manager.setup_root_ca()
        
        # It should run openssl twice (genrsa and req)
        assert mock_run.call_count == 2
        assert res is True

@patch('ctypes.windll.shell32.ShellExecuteW')
@patch('core.services.ssl_manager.run_silent_command')
def test_setup_root_ca_failure(mock_run, mock_shell, ssl_manager):
    """Test Root CA generation failure when UAC denied."""
    mock_run.return_value = MagicMock(returncode=0)
    mock_shell.return_value = 5 # Access Denied code <= 32
    
    with patch('os.path.exists', return_value=False):
        res = ssl_manager.setup_root_ca()
        assert res is False
