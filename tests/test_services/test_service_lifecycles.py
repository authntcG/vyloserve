import pytest
from unittest.mock import patch, MagicMock
from core.services.apache import ApacheManager
from core.services.php import PhpManager

@pytest.fixture
def apache_manager(mock_api, tmp_path):
    with patch('core.services.apache.get_project_root', return_value=str(tmp_path)):
        return ApacheManager(mock_api)

@pytest.fixture
def php_manager(mock_api, tmp_path):
    with patch('core.services.php.get_project_root', return_value=str(tmp_path)):
        return PhpManager(mock_api)

@patch('core.services.apache.start_silent_process')
def test_apache_start_server(mock_start_silent, apache_manager):
    """Test Apache start_server logic."""
    # Mocking that the process stays alive
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_start_silent.return_value = mock_proc
    
    with patch.object(apache_manager, 'check_is_running', return_value=False):
        with patch.object(apache_manager, 'get_status', return_value={"installed": True, "path": "/apache"}):
            with patch.object(apache_manager, '_verify_and_patch_httpd'):
                res = apache_manager.start_server()
                
                assert res['status'] == 'success'
                mock_start_silent.assert_called_once()
                
                # Test stop server
                with patch('core.services.apache.run_silent_command') as mock_run:
                    stop_res = apache_manager.stop_server()
                    assert stop_res['status'] == 'success'

@patch('core.services.php.start_silent_process')
def test_php_start_server(mock_start_silent, php_manager):
    """Test PHP start_php logic."""
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_start_silent.return_value = mock_proc
    
    # Mock get config
    with patch.object(php_manager, 'get_config', return_value={"status": "success", "config": {"port": 9005}}):
        with patch('os.path.exists', return_value=True):
            # Also patch the ini verifier so it doesn't fail
            with patch.object(php_manager, '_verify_and_patch_ini'):
                with patch.object(php_manager, '_get_port_from_ini', return_value=9005):
                    res = php_manager.start_php("php_8_2")
                    
                    assert res['status'] == 'success'
                    assert 'php_8_2' in php_manager.processes
                    mock_start_silent.assert_called_once()
                    
                    # Test stop server
                    with patch('core.services.php.run_silent_command') as mock_run:
                        stop_res = php_manager.stop_php("php_8_2")
                        assert stop_res['status'] == 'success'
                        mock_run.assert_called_once()
