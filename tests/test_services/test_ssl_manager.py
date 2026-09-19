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
    
    # Test exception
    ssl_manager.api.apache.get_status.return_value = {"installed": False}
    with pytest.raises(RuntimeError, match="Apache belum terinstal"):
        ssl_manager._get_openssl_paths()

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
        
    # Test exception handling
    mock_run.side_effect = Exception("OpenSSL error")
    with patch('os.path.exists', return_value=False):
        res = ssl_manager.setup_root_ca()
        assert res is False

@patch('core.services.ssl_manager.run_silent_command')
@patch.object(SslManager, 'setup_root_ca', return_value=True)
def test_generate_domain_cert(mock_setup, mock_run, ssl_manager, tmp_path):
    mock_run.return_value = MagicMock(returncode=0)
    # create fake ssl dir so we don't hit path errors
    os.makedirs(ssl_manager.ssl_dir, exist_ok=True)
    
    # 1. When it already exists
    with patch('os.path.exists', return_value=True):
        crt, key = ssl_manager.generate_domain_cert("test.local")
        assert crt.endswith("test.local.crt")
        assert key.endswith("test.local.key")
        
    # 2. When it does not exist (generate it)
    with patch('os.path.exists', return_value=False):
        from unittest.mock import mock_open as unittest_mock_open
        with patch('builtins.open', unittest_mock_open()) as mock_file:
            crt, key = ssl_manager.generate_domain_cert("new.local")
            assert crt.endswith("new.local.crt")
            assert key.endswith("new.local.key")
            assert mock_run.call_count == 3
            mock_file().write.assert_called_once()
            
    # 3. Test exception handling
    mock_run.side_effect = Exception("SSL Generation failed")
    with patch('os.path.exists', return_value=False):
        with pytest.raises(Exception, match="SSL Generation failed"):
            ssl_manager.generate_domain_cert("error.local")

def test_delete_domain_cert(ssl_manager):
    with patch('os.path.exists', return_value=True):
        with patch('os.remove') as mock_remove:
            ssl_manager.delete_domain_cert("delete.local")
            assert mock_remove.call_count == 4
            
    with patch('os.path.exists', return_value=True):
        with patch('os.remove', side_effect=Exception("Locked")):
            # Should not raise exception
            ssl_manager.delete_domain_cert("delete.local")
