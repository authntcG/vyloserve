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
        with patch.object(git_manager, '_check_external_installation', return_value={"exists": True, "version": "2.45.1", "path": "/usr/bin/git"}):
            with patch.object(git_manager, '_is_in_user_path', return_value=True):
                res = git_manager.get_git_status()
                assert res['installed'] is True
                assert res['version'] == '2.45.1.windows.1'

@patch('core.services.git_manager.subprocess.run')
@patch('core.services.git_manager.winreg.OpenKey')
@patch('core.services.git_manager.winreg.QueryValueEx')
def test_check_external_installation(mock_query, mock_open, mock_run, git_manager):
    # Test fallback through all find methods
    
    def run_side_effect(cmd, *args, **kwargs):
        cmd_str = cmd if isinstance(cmd, str) else cmd[0]
        if 'where' in cmd_str:
            return MagicMock(returncode=0, stdout="C:\\Program Files\\Git\\cmd\\git.exe\n")
        else:
            return MagicMock(returncode=0, stdout="git version 2.0.0")

    mock_run.side_effect = run_side_effect
    
    # 1. via where
    res1 = git_manager._check_external_installation()
    assert res1['exists'] is True
    assert res1['path'] == "C:\\Program Files\\Git\\cmd\\git.exe"
    
    # 2. via registry (simulate where failing)
    def run_side_effect2(cmd, *args, **kwargs):
        cmd_str = cmd if isinstance(cmd, str) else cmd[0]
        if 'where' in cmd_str:
            return MagicMock(returncode=1, stdout="")
        else:
            return MagicMock(returncode=0, stdout="git version 2.0.0")
            
    mock_run.side_effect = run_side_effect2
    mock_query.return_value = ("C:\\Program Files\\Git", 1)
    with patch('core.services.git_manager.os.path.exists', return_value=True):
        res2 = git_manager._check_external_installation()
        assert res2['exists'] is True
        assert "git.exe" in res2['path']
        
    # 3. via hardcoded (simulate where and registry failing)
    mock_query.side_effect = Exception("Not found")
    with patch('core.services.git_manager.os.path.exists', side_effect=lambda p: "Program Files\\Git" in p):
        res3 = git_manager._check_external_installation()
        assert res3['exists'] is True
        assert "git.exe" in res3['path']

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

@patch('core.services.git_manager.urllib.request.urlopen')
def test_get_available_git_versions(mock_urlopen, git_manager):
    # First response for HTML
    html_resp = MagicMock()
    html_resp.read.return_value.decode.return_value = 'expanded_assets/v2.45.1.windows.1"'
    
    # Second response for HEAD request
    head_resp = MagicMock()
    head_resp.status = 200
    
    # We don't know exactly how many HEAD requests will be made due to multithreading,
    # so we'll just return html_resp first, then head_resp for everything else.
    # Actually, a better way is to check the request method.
    def urlopen_side_effect(req, timeout=10):
        if hasattr(req, 'method') and req.method == 'HEAD':
            return head_resp
        return html_resp
        
    mock_urlopen.side_effect = urlopen_side_effect
    
    with patch('core.services.git_manager.os.path.exists', return_value=True):
        res = git_manager.get_available_git_versions()
        assert res['status'] == 'success'
        assert len(res['data']) > 0
        assert res['data'][0]['version_text'] == '2.45.1.1'

@patch('shutil.rmtree')
@patch('core.services.git_manager.os.path.exists', return_value=True)
def test_uninstall_git(mock_exists, mock_rmtree, git_manager):
    with patch.object(git_manager, 'toggle_user_path'):
        res = git_manager.uninstall_git()
        assert res['status'] == 'success'
        mock_rmtree.assert_called_once()

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_git_toggle_user_path(mock_send, mock_close, mock_set, mock_query, mock_open, git_manager):
    mock_query.return_value = (r"C:\Windows;", 1)
    res = git_manager.toggle_user_path(True)
    assert res['status'] == 'success'
    mock_set.assert_called_once()
    assert 'bin\\git\\cmd' in mock_set.call_args[0][4]

@patch('core.services.git_manager.subprocess.run')
def test_get_git_config(mock_run, git_manager):
    mock_proc1 = MagicMock(returncode=0, stdout="test user\n")
    mock_proc2 = MagicMock(returncode=0, stdout="test@example.com\n")
    mock_run.side_effect = [mock_proc1, mock_proc2]
    
    res = git_manager.get_git_config()
    assert res['status'] == 'success'
    assert res['data']['name'] == 'test user'
    assert res['data']['email'] == 'test@example.com'

@patch('core.services.git_manager.subprocess.run')
def test_set_git_config(mock_run, git_manager):
    mock_run.return_value = MagicMock(returncode=0)
    res = git_manager.set_git_config("new user", "new@example.com")
    assert res['status'] == 'success'
    assert mock_run.call_count == 2

@patch('core.services.git_manager.subprocess.run')
def test_extract_sfx(mock_run, git_manager):
    mock_run.return_value = MagicMock(returncode=0)
    with patch('os.path.exists', return_value=True):
        with patch('os.remove') as mock_remove:
            git_manager._extract_sfx("fake.exe", "fake_dir")
            mock_run.assert_called_once()
            mock_remove.assert_called_once()
            
    mock_run.return_value = MagicMock(returncode=1)
    import pytest
    with pytest.raises(RuntimeError):
        git_manager._extract_sfx("fake.exe", "fake_dir")

@patch('core.services.git_manager.urllib.request.urlopen')
def test_get_available_git_versions_exception(mock_urlopen, git_manager):
    mock_urlopen.side_effect = Exception("API limit")
    res = git_manager.get_available_git_versions()
    assert res['status'] == 'error'
    assert 'backend.git.fetch_failed' in res['message']

@patch('core.services.git_manager.winreg.OpenKey')
@patch('core.services.git_manager.winreg.QueryValueEx')
@patch('core.services.git_manager.winreg.CloseKey')
def test_is_in_user_path(mock_close, mock_query, mock_open, git_manager):
    mock_query.return_value = (r"C:\Windows;D:\Projects\Python\vyloserve\bin\git\cmd", 1)
    assert git_manager._is_in_user_path(r"D:\Projects\Python\vyloserve\bin\git\cmd") is True
    assert git_manager._is_in_user_path(r"C:\NonExistent") is False

    mock_query.side_effect = Exception("Registry error")
    assert git_manager._is_in_user_path(r"C:\Windows") is False

# ==========================================
# _find_via_hardcoded — cabang tidak ditemukan
# ==========================================

def test_find_via_hardcoded_returns_none_when_no_path_exists(git_manager):
    with patch('sys.platform', 'win32'):
        with patch('os.path.exists', return_value=False):
            assert git_manager._find_via_hardcoded() is None

def test_find_via_hardcoded_returns_none_on_non_windows(git_manager):
    with patch('sys.platform', 'linux'):
        assert git_manager._find_via_hardcoded() is None

# ==========================================
# _validate_git_binary — cabang tambahan
# ==========================================

def test_validate_git_binary_uses_shell_for_windows_script(git_manager):
    with patch('sys.platform', 'win32'):
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(stdout="git version 2.45.1.windows.1\n", stderr="")
            res = git_manager._validate_git_binary("C:\\Git\\cmd\\git.cmd")
    assert res == {"exists": True, "version": "2.45.1", "path": "C:\\Git\\cmd\\git.cmd"}
    assert mock_run.call_args.kwargs.get('shell') is True

def test_validate_git_binary_returns_none_when_version_unrecognized(git_manager):
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="unexpected output format", stderr="")
        assert git_manager._validate_git_binary("C:\\git.exe") is None

def test_validate_git_binary_swallows_exception(git_manager):
    with patch('subprocess.run', side_effect=OSError("cannot execute")):
        assert git_manager._validate_git_binary("C:\\git.exe") is None

def test_check_external_installation_returns_not_found_when_validation_fails(git_manager):
    """found_path ditemukan tapi validasi versi gagal -> tetap laporkan exists=False."""
    with patch.object(git_manager, '_find_via_where', return_value="C:\\git.exe"):
        with patch.object(git_manager, '_validate_git_binary', return_value=None):
            res = git_manager._check_external_installation()
    assert res == {"exists": False, "version": "Unknown", "path": ""}

# ==========================================
# get_git_status — swallow exception saat cek versi internal
# ==========================================

def test_get_git_status_swallows_version_check_error(git_manager):
    with patch('os.path.exists', return_value=True):
        with patch('subprocess.run', side_effect=OSError("crashed")):
            with patch.object(git_manager, '_check_external_installation', return_value={"exists": False}):
                with patch.object(git_manager, '_is_in_user_path', return_value=False):
                    res = git_manager.get_git_status()
    assert res['version'] == "Unknown"

# ==========================================
# get_available_git_versions — tidak ada binary valid & skip kandidat gagal
# ==========================================

@patch('core.services.git_manager.urllib.request.urlopen')
def test_get_available_git_versions_raises_when_no_valid_binary_found(mock_urlopen, git_manager):
    """Semua kandidat gagal validasi HEAD request -> tidak ada satupun binary valid -> error."""
    html_resp = MagicMock()
    html_resp.read.return_value.decode.return_value = 'expanded_assets/v2.45.1.windows.1"'

    def urlopen_side_effect(req, timeout=10):
        if getattr(req, 'method', None) == 'HEAD':
            raise OSError("404 not found")
        return html_resp

    mock_urlopen.side_effect = urlopen_side_effect

    res = git_manager.get_available_git_versions()
    assert res['status'] == 'error'
    assert res['message'] == 'backend.git.fetch_failed'

# ==========================================
# install_git — pembersihan file exe saat gagal & progress scaling
# ==========================================

@patch('core.services.git_manager.download_advanced', side_effect=OSError("network down"))
@patch('os.path.exists', return_value=True)
@patch('os.remove')
def test_install_git_removes_partial_exe_on_failure(mock_remove, mock_exists, mock_download, git_manager):
    res = git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")
    assert res['status'] == 'error'
    mock_remove.assert_called_once()

# ==========================================
# toggle_user_path — cabang tambahan
# ==========================================

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx', side_effect=FileNotFoundError())
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_git_toggle_user_path_handles_missing_registry_value(mock_send, mock_close, mock_set, mock_query, mock_open, git_manager):
    res = git_manager.toggle_user_path(True)
    assert res['status'] == 'success'
    mock_set.assert_called_once()

@patch('winreg.OpenKey')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_git_toggle_user_path_disable_removes_from_path(mock_send, mock_close, mock_open, git_manager):
    target = os.path.normpath(os.path.join(git_manager.bin_dir, 'git', 'cmd'))
    with patch('winreg.QueryValueEx', return_value=(f"C:\\Windows;{target}", 1)):
        with patch('winreg.SetValueEx') as mock_set:
            res = git_manager.toggle_user_path(False)
    assert res['status'] == 'success'
    new_path = mock_set.call_args[0][4]
    assert target not in new_path
    assert "C:\\Windows" in new_path

def test_git_toggle_user_path_handles_exception(git_manager):
    with patch('winreg.OpenKey', side_effect=OSError("registry locked")):
        res = git_manager.toggle_user_path(True)
    assert res['status'] == 'error'
    assert res['args']['e'] == 'registry locked'

# ==========================================
# get_git_config / set_git_config — error path
# ==========================================

def test_get_git_config_handles_exception(git_manager):
    with patch('subprocess.run', side_effect=OSError("git.exe missing")):
        res = git_manager.get_git_config()
    assert res['status'] == 'error'
    assert res['args']['e'] == 'git.exe missing'

def test_set_git_config_handles_exception(git_manager):
    with patch('subprocess.run', side_effect=OSError("git.exe missing")):
        res = git_manager.set_git_config("name", "email")
    assert res['status'] == 'error'
    assert res['message'] == 'git.exe missing'
