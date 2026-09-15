import os
import pytest
from unittest.mock import patch, MagicMock, mock_open

from core.services.project import ProjectManager

@pytest.fixture
def project_manager(mock_api, tmp_path):
    with patch('core.services.project.get_project_root', return_value=str(tmp_path)):
        return ProjectManager(mock_api)

def test_write_hosts_with_uac_success(project_manager):
    """Test successful hosts write without needing UAC."""
    mock_f = mock_open()
    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'success'
        assert "backend.project.hosts_updated" in res['message']
        mock_f.assert_called_once_with("c:/windows/hosts", 'w', encoding='utf-8')

@patch('ctypes.windll.shell32.ShellExecuteW')
def test_write_hosts_with_uac_permission_error_granted(mock_shell, project_manager):
    """Test UAC elevation granted after permission error."""
    mock_f = mock_open()
    mock_f.side_effect = PermissionError("Access Denied")
    
    mock_shell.return_value = 42 # > 32 means success
    
    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'success'
        assert "backend.project.uac_granted" in res['message']
        mock_shell.assert_called_once()

@patch('ctypes.windll.shell32.ShellExecuteW')
def test_write_hosts_with_uac_permission_error_denied(mock_shell, project_manager):
    """Test UAC elevation denied."""
    mock_f = mock_open()
    mock_f.side_effect = PermissionError("Access Denied")
    
    mock_shell.return_value = 5 # <= 32 means access denied
    
    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'error'
        assert "backend.project.uac_denied" in res['message']
        mock_shell.assert_called_once()
