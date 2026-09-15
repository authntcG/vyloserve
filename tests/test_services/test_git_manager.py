import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.git_manager import GitManager

@pytest.fixture
def git_manager(mock_api, tmp_path):
    with patch('core.services.git_manager.get_project_root', return_value=str(tmp_path)):
        return GitManager(mock_api)

@patch('subprocess.run')
def test_git_get_status(mock_run, git_manager):
    """Test git installation status checking."""
    # When git is found
    mock_run.return_value = MagicMock(returncode=0, stdout="git version 2.45.1.windows.1")
    
    with patch('os.path.exists', return_value=True):
        with patch.object(git_manager, '_check_external_installation', return_value="/usr/bin/git"):
            with patch.object(git_manager, '_is_in_user_path', return_value=True):
                res = git_manager.get_git_status()
                assert res['installed'] is True
                assert res['version'] == '2.45.1.windows.1'

@patch('core.services.git_manager.download_advanced')
@patch.object(GitManager, '_extract_sfx')
def test_install_git(mock_extract, mock_download, git_manager):
    """Test Git installation process without actually downloading."""
    with patch('os.path.exists', return_value=False):
        res = git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")
        
        assert res['status'] == 'success'
        mock_download.assert_called_once()
        mock_extract.assert_called_once()
        assert "backend.git.install_success" in res['message']
    
@patch('core.services.git_manager.download_advanced')
def test_install_git_failure(mock_download, git_manager):
    """Test Git installation failure."""
    mock_download.side_effect = Exception("Network timeout")
    
    res = git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")
    
    assert res['status'] == 'error'
    assert 'Network timeout' in res['message']
