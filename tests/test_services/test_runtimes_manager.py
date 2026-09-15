import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.runtimes_manager import RuntimesManager

@pytest.fixture
def runtimes_manager(mock_api, tmp_path):
    with patch('core.services.runtimes_manager.get_project_root', return_value=str(tmp_path)):
        return RuntimesManager(mock_api)

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.CloseKey')
def test_is_in_user_path(mock_close, mock_query, mock_open_key, runtimes_manager):
    """Test path existence check in Windows Registry."""
    # When path exists
    mock_query.return_value = (r"C:\Windows;D:\Projects\bin\node;", 1)
    assert runtimes_manager._is_in_user_path(r"D:\Projects\bin\node") is True
    
    # When path does not exist
    mock_query.return_value = (r"C:\Windows;C:\Program Files\Git\cmd;", 1)
    assert runtimes_manager._is_in_user_path(r"D:\Projects\bin\node") is False

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_toggle_user_path_enable(mock_send_msg, mock_close, mock_set, mock_query, mock_open_key, runtimes_manager):
    """Test enabling a path in Windows Registry."""
    mock_query.return_value = (r"C:\Windows;", 1)
    
    res = runtimes_manager.toggle_user_path("node", True)
    assert res['status'] == 'success'
    
    # Check that SetValueEx was called with the new path appended
    args = mock_set.call_args[0]
    assert args[1] == 'Path'
    assert 'bin\\node' in args[4]
    assert 'C:\\Windows' in args[4]
    
    # Check that Windows broadcast message was sent
    mock_send_msg.assert_called_once()

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_toggle_user_path_disable(mock_send_msg, mock_close, mock_set, mock_query, mock_open_key, runtimes_manager):
    """Test disabling a path in Windows Registry."""
    mock_path = f"C:\\Windows;{os.path.join(runtimes_manager.bin_dir, 'node')};"
    mock_query.return_value = (mock_path, 1)
    
    res = runtimes_manager.toggle_user_path("node", False)
    assert res['status'] == 'success'
    
    # Check that SetValueEx was called without the node path
    args = mock_set.call_args[0]
    assert args[1] == 'Path'
    assert 'bin\\node' not in args[4]
    assert 'C:\\Windows' in args[4]

@patch('os.remove')
@patch('os.rename')
@patch('core.services.runtimes_manager.download_advanced')
@patch('core.services.runtimes_manager.extract_archive')
def test_install_node(mock_extract, mock_download, mock_rename, mock_remove, runtimes_manager):
    """Test Node.js installation flow."""
    with patch('os.path.exists', return_value=False):
        res = runtimes_manager.install_node("20.14.0", False)
        
        assert res['status'] == 'success'
        mock_download.assert_called_once()
        mock_extract.assert_called_once()
        mock_rename.assert_called_once()
