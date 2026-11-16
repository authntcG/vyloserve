import json
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
                assert res['version'] == '2.45.1.1'

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
    
    with patch('sys.platform', 'win32'):
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
    
@patch('shutil.rmtree')
@patch('core.services.git_manager.download_advanced')
def test_install_git_failure(mock_download, mock_rmtree, git_manager):
    """Test Git installation failure."""
    mock_download.side_effect = Exception("Network timeout")
    
    res = git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")
    
    assert res['status'] == 'error'
    assert res['message'] == 'backend.git.install_error'
    assert 'Network timeout' in res['args']['e']
    mock_rmtree.assert_not_called()

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
    
    with patch('sys.platform', 'win32'), patch('core.services.git_manager.os.path.exists', return_value=True):
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
    with patch('sys.platform', 'win32'):
        mock_query.return_value = (r"C:\Windows;", 1)
        res = git_manager.toggle_user_path(True)
        assert res['status'] == 'success'
        mock_set.assert_called_once()
        assert os.path.join('bin', 'git', 'cmd') in mock_set.call_args[0][4]

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
    with patch('sys.platform', 'win32'):
        res = git_manager.get_available_git_versions()
        assert res['status'] == 'error'
        assert 'backend.git.fetch_failed' in res['message']

@patch('core.services.git_manager.winreg.OpenKey')
@patch('core.services.git_manager.winreg.QueryValueEx')
@patch('core.services.git_manager.winreg.CloseKey')
def test_is_in_user_path(mock_close, mock_query, mock_open, git_manager):
    with patch('sys.platform', 'win32'):
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

def test_validate_git_binary_uses_list_for_windows_script(git_manager):
    with patch('sys.platform', 'win32'):
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(stdout="git version 2.45.1.windows.1\n", stderr="")
            res = git_manager._validate_git_binary("C:\\Git\\cmd\\git.cmd")
    assert res == {"exists": True, "version": "2.45.1", "path": "C:\\Git\\cmd\\git.cmd"}
    assert mock_run.call_args.kwargs.get('shell') is not True
    assert mock_run.call_args.args[0] == ["C:\\Git\\cmd\\git.cmd", "--version"]

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

    with patch('sys.platform', 'win32'):
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


@patch('core.services.git_manager.download_advanced')
@patch.object(GitManager, '_extract_sfx')
def test_install_git_download_progress_is_clamped_not_scaled(mock_extract, mock_download, git_manager, mock_api):
    """Regresi: download_advanced mengirim pct ABSOLUT (0-100), bukan fraksi 0.0-1.0. Bug lama
    mengalikan pct dengan span sehingga progress meluber jauh di atas 100 saat unduhan lalu
    "melompat mundur" saat fase ekstraksi mengirim nilai tetap (lihat docs/known_bugs.md)."""
    with patch('os.path.exists', return_value=False):
        git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")

    progress_cb = mock_download.call_args.kwargs['progress_cb']

    progress_cb(10, "Downloading start")
    progress_cb(60, "Downloading end")

    calls = [c.args for c in mock_api.emit_progress.call_args_list]
    assert (10, "Downloading start", None) in calls
    assert (60, "Downloading end", None) in calls
    download_calls = [pct for pct, msg, *_ in calls if msg in ("Downloading start", "Downloading end")]
    assert all(5 <= pct <= 74 for pct in download_calls)


@patch('core.services.git_manager.download_advanced')
@patch.object(GitManager, '_extract_sfx')
def test_install_git_download_prog_cb_accepts_three_positional_args(mock_extract, mock_download, git_manager, mock_api):
    """
    Regresi: file_utils.py's download_advanced memanggil progress_cb dengan 3 argumen
    posisional (percent, message_key, args_dict) di beberapa titik -- download_prog_cb
    sebelumnya cuma menerima 2 param (pct, msg) dan CRASH dengan "takes 2 positional
    arguments but 3 were given". Lihat docs/known_bugs.md.
    """
    with patch('os.path.exists', return_value=False):
        git_manager.install_git("http://fake.url/git.exe", "git.exe", "2.45.1")

    progress_cb = mock_download.call_args.kwargs['progress_cb']
    progress_cb(30, "Downloading", {"percent": 50})  # tidak boleh raise

    mock_api.emit_progress.assert_any_call(30, "Downloading", {"percent": 50})

# ==========================================
# toggle_user_path — cabang tambahan
# ==========================================

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx', side_effect=FileNotFoundError())
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_git_toggle_user_path_handles_missing_registry_value(mock_send, mock_close, mock_set, mock_query, mock_open, git_manager):
    with patch('sys.platform', 'win32'):
        res = git_manager.toggle_user_path(True)
        assert res['status'] == 'success'
        mock_set.assert_called_once()

@patch('winreg.OpenKey')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_git_toggle_user_path_disable_removes_from_path(mock_send, mock_close, mock_open, git_manager):
    with patch('sys.platform', 'win32'):
        target = os.path.normpath(os.path.join(git_manager.bin_dir, 'git', 'cmd'))
        with patch('winreg.QueryValueEx', return_value=(f"C:\\Windows;{target}", 1)):
            with patch('winreg.SetValueEx') as mock_set:
                res = git_manager.toggle_user_path(False)
        assert res['status'] == 'success'
        new_path = mock_set.call_args[0][4]
        assert target not in new_path
        assert "C:\\Windows" in new_path

def test_git_toggle_user_path_handles_exception(git_manager):
    with patch('sys.platform', 'win32'), patch('winreg.OpenKey', side_effect=OSError("registry locked")):
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
    assert res['message'] == 'backend.git.config_error'
    assert res['args']['e'] == 'git.exe missing'

# ==========================================
# silent parameter tests
# ==========================================

def test_git_get_status_silent_suppresses_logs(git_manager, mock_api):
    with patch.object(git_manager, '_find_via_where', return_value="C:\\Program Files\\Git\\cmd\\git.exe"), \
         patch.object(git_manager, '_validate_git_binary', return_value={"exists": True, "version": "2.45.0", "path": "C:\\Program Files\\Git\\cmd\\git.exe"}), \
         patch('os.path.exists', return_value=False):
        res = git_manager.get_git_status(silent=True)
        assert res['installed'] is False
        assert res['external']['exists'] is True
        mock_api.emit_log.assert_not_called()

def test_git_get_status_non_silent_emits_logs(git_manager, mock_api):
    with patch.object(git_manager, '_find_via_which', return_value=None), \
         patch.object(git_manager, '_find_via_where', return_value=None), \
         patch.object(git_manager, '_find_via_registry', return_value=None), \
         patch.object(git_manager, '_find_via_hardcoded', return_value=None), \
         patch('os.path.exists', return_value=False):
        res = git_manager.get_git_status(silent=False)
        assert res['installed'] is False
        mock_api.emit_log.assert_any_call("backend.git.scanning_external", "info", None)

def test_install_git_cancelled(git_manager):
    from core.utils.cancellation import OperationCancelledError
    with patch('core.services.git_manager.download_advanced', side_effect=OperationCancelledError("Cancelled")):
        res = git_manager.install_git("http://fake-git.exe", "git.exe", "2.45.0")
        assert res["status"] == "cancelled"
        assert res["message"] == "backend.git.install_cancelled"

def test_find_via_which_returns_none_on_windows(git_manager):
    with patch('sys.platform', 'win32'):
        assert git_manager._find_via_which("/fake/bin") is None

def test_find_via_which_finds_system_git_on_linux(git_manager):
    with patch('sys.platform', 'linux'), \
         patch('shutil.which', return_value="/usr/bin/git") as mock_which:
        assert git_manager._find_via_which("/fake/bin") == "/usr/bin/git"
        mock_which.assert_called_once()


def test_get_available_git_versions_linux_detected(git_manager):
    with patch('sys.platform', 'linux'), \
         patch.object(git_manager, '_check_external_installation', return_value={"exists": True, "version": "2.43.0"}):
        res = git_manager.get_available_git_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 1
        assert res['data'][0]['value'] == 'system'
        assert "2.43.0" in res['data'][0]['label']


def test_get_available_git_versions_linux_not_detected(git_manager):
    with patch('sys.platform', 'linux'), \
         patch.object(git_manager, '_check_external_installation', return_value={"exists": False}):
        res = git_manager.get_available_git_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 1
        assert res['data'][0]['value'] == 'system'
        assert "Distro Package" in res['data'][0]['label']


def test_install_git_linux_apt_success(git_manager):
    with patch('sys.platform', 'linux'), \
         patch('shutil.which', side_effect=lambda x: f"/usr/bin/{x}" if x in ("pkexec", "apt-get") else None), \
         patch('subprocess.run', return_value=MagicMock(returncode=0)) as mock_run:
        res = git_manager.install_git("system", "git", "system")
        assert res['status'] == 'success'
        assert res['message'] == 'backend.git.install_success'


def test_install_git_linux_no_pkexec(git_manager):
    with patch('sys.platform', 'linux'), \
         patch('shutil.which', return_value=None):
        res = git_manager.install_git("system", "git", "system")
        assert res['status'] == 'error'
        assert res['message'] == 'backend.git.no_pkexec'


def test_install_git_linux_auth_cancelled(git_manager):
    with patch('sys.platform', 'linux'), \
         patch('shutil.which', side_effect=lambda x: f"/usr/bin/{x}" if x in ("pkexec", "apt-get") else None), \
         patch('subprocess.run', side_effect=[MagicMock(returncode=0), MagicMock(returncode=126)]):
        res = git_manager.install_git("system", "git", "system")
        assert res['status'] == 'cancelled'
        assert res['message'] == 'backend.git.install_cancelled'


# ==========================================
# Unit tests for Git Account & Identity Management
# ==========================================

def test_mask_token(git_manager):
    assert git_manager._mask_token("") == ""
    assert git_manager._mask_token(None) == ""
    assert git_manager._mask_token("short") == "••••••••"
    assert git_manager._mask_token("12345678") == "••••••••"
    assert git_manager._mask_token("1234567890abcdef") == "••••••••"


def test_get_git_accounts(git_manager):
    mock_data = {
        "default_account_id": "acc-1",
        "accounts": [
            {
                "id": "acc-1",
                "label": "Work GitHub",
                "endpoint": "github.com",
                "username": "workuser",
                "email": "work@company.com",
                "auth_mode": "pat",
                "token": "ghp_1234567890abcdef",
            }
        ]
    }
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "get_git_config", return_value={"status": "success", "data": {"name": "workuser", "email": "work@company.com"}}):
        res = git_manager.get_git_accounts()
        assert res["status"] == "success"
        assert len(res["accounts"]) == 1
        acc = res["accounts"][0]
        assert acc["id"] == "acc-1"
        assert acc["is_default"] is True
        assert acc["is_push_active"] is True
        assert acc["has_token"] is True
        assert acc["masked_token"] == "••••••••"
        assert "token" not in acc  # raw token must not leak
        assert res["active_push"]["name"] == "workuser"
        assert res["active_push"]["email"] == "work@company.com"


def test_save_git_account_validation_error(git_manager):
    res = git_manager.save_git_account({"username": "", "email": "test@dev.com"})
    assert res["status"] == "error"
    assert res["message"] == "backend.git.missing_username"

    res = git_manager.save_git_account({"username": "octocat", "email": ""})
    assert res["status"] == "error"
    assert res["message"] == "backend.git.missing_email"


def test_save_git_account_pat_and_default(git_manager):
    mock_data = {"default_account_id": None, "accounts": []}
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "_write_accounts_file") as mock_write, \
         patch.object(git_manager, "_verify_github_token_via_api", return_value=({"login": "octocat", "id": 1}, None)), \
         patch.object(git_manager, "_store_git_credential") as mock_store_cred, \
         patch.object(git_manager, "set_git_config") as mock_set_cfg:
        
        account_input = {
            "label": "Personal GitHub",
            "endpoint": "https://github.com/profile/",
            "username": "octocat",
            "email": "octo@cat.org",
            "protocol": "https",
            "auth_mode": "pat",
            "token": "ghp_supersecrettoken123",
            "set_as_default": True
        }
        res = git_manager.save_git_account(account_input)
        assert res["status"] == "success"
        assert res["message"] == "backend.git.account_saved"

        # Host should be cleaned
        written_data = mock_write.call_args[0][0]
        assert len(written_data["accounts"]) == 1
        saved = written_data["accounts"][0]
        assert saved["endpoint"] == "github.com"
        assert saved["token"] == "ghp_supersecrettoken123"
        assert written_data["default_account_id"] == saved["id"]

        mock_set_cfg.assert_called_once_with("octocat", "octo@cat.org")
        mock_store_cred.assert_called_once_with("https", "github.com", "octocat", "ghp_supersecrettoken123")


def test_save_git_account_update_existing(git_manager):
    mock_data = {
        "default_account_id": "acc-old",
        "accounts": [
            {
                "id": "acc-old",
                "label": "Old Label",
                "endpoint": "gitlab.com",
                "username": "olduser",
                "email": "old@example.com",
                "protocol": "https",
                "auth_mode": "pat",
                "token": "old_token_12345678",
            }
        ]
    }
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "_write_accounts_file") as mock_write:
        
        # Updating without passing token should retain existing token
        update_input = {
            "id": "acc-old",
            "label": "Updated Label",
            "endpoint": "gitlab.com",
            "username": "newuser",
            "email": "new@example.com",
            "protocol": "ssh",
            "auth_mode": "ssh",
            "ssh_key_path": "~/.ssh/id_ed25519",
        }
        res = git_manager.save_git_account(update_input)
        assert res["status"] == "success"

        saved = mock_write.call_args[0][0]["accounts"][0]
        assert saved["label"] == "Updated Label"
        assert saved["username"] == "newuser"
        assert saved["token"] == "old_token_12345678"
        assert saved["ssh_key_path"] == "~/.ssh/id_ed25519"


def test_delete_git_account(git_manager):
    mock_data = {
        "default_account_id": "acc-1",
        "accounts": [
            {
                "id": "acc-1",
                "label": "Work GitHub",
                "endpoint": "github.com",
                "username": "workuser",
                "email": "work@company.com",
                "protocol": "https",
                "auth_mode": "pat",
                "token": "ghp_1234567890abcdef",
            },
            {
                "id": "acc-2",
                "label": "Personal GitLab",
                "endpoint": "gitlab.com",
                "username": "myuser",
                "email": "my@gitlab.org",
                "protocol": "ssh",
                "auth_mode": "ssh",
            }
        ]
    }
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "_write_accounts_file") as mock_write, \
         patch.object(git_manager, "_delete_git_credential") as mock_del_cred, \
         patch.object(git_manager, "set_git_config") as mock_set_cfg:
        
        # Delete acc-1 (which is default)
        res = git_manager.delete_git_account("acc-1")
        assert res["status"] == "success"
        assert res["message"] == "backend.git.account_deleted"
        mock_del_cred.assert_called_once_with("https", "github.com", "workuser")

        written_data = mock_write.call_args[0][0]
        assert len(written_data["accounts"]) == 1
        assert written_data["accounts"][0]["id"] == "acc-2"
        # Since default was acc-1, default falls back to first remaining acc-2
        assert written_data["default_account_id"] == "acc-2"
        mock_set_cfg.assert_called_once_with("myuser", "my@gitlab.org")

        # Delete non-existent account
        res2 = git_manager.delete_git_account("non-existent")
        assert res2["status"] == "error"
        assert res2["message"] == "backend.git.account_not_found"


def test_set_default_git_account(git_manager):
    mock_data = {
        "default_account_id": "acc-1",
        "accounts": [
            {
                "id": "acc-1",
                "label": "Work GitHub",
                "username": "workuser",
                "email": "work@corp.com"
            },
            {
                "id": "acc-2",
                "label": "Home GitHub",
                "username": "homeuser",
                "email": "home@dev.org"
            }
        ]
    }
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "_write_accounts_file") as mock_write, \
         patch.object(git_manager, "set_git_config") as mock_set_cfg:
        
        res = git_manager.set_default_git_account("acc-2")
        assert res["status"] == "success"
        assert res["message"] == "backend.git.account_default_set"
        assert mock_write.call_args[0][0]["default_account_id"] == "acc-2"
        mock_set_cfg.assert_called_once_with("homeuser", "home@dev.org")

        # Non-existent
        res_err = git_manager.set_default_git_account("acc-999")
        assert res_err["status"] == "error"
        assert res_err["message"] == "backend.git.account_not_found"


def test_get_ssh_keys(git_manager):
    from unittest.mock import mock_open
    with patch("os.path.isdir", return_value=True), \
         patch("os.path.isfile", return_value=True), \
         patch("os.listdir", return_value=["id_ed25519.pub", "id_ed25519", "known_hosts", "other.txt"]), \
         patch("builtins.open", mock_open(read_data="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5... user@laptop\n")):
        res = git_manager.get_ssh_keys()
        assert res["status"] == "success"
        assert len(res["data"]) == 1
        key = res["data"][0]
        assert key["filename"] == "id_ed25519.pub"
        assert key["type"] == "ssh-ed25519"
        assert key["comment"] == "user@laptop"
        assert key["public_key"].startswith("ssh-ed25519")


def test_get_ssh_keys_dir_not_found(git_manager):
    with patch("os.path.isdir", return_value=False):
        res = git_manager.get_ssh_keys()
        assert res["status"] == "success"
        assert res["data"] == []


def test_store_and_delete_git_credential(git_manager):
    # Empty params
    assert git_manager._store_git_credential("", "", "", "") is False
    assert git_manager._delete_git_credential("", "", "") is False

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.communicate.return_value = ("", "")

    with patch.object(git_manager, "_get_git_exe", return_value="git"), \
         patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
        
        ok_store = git_manager._store_git_credential("https", "github.com", "user", "secret")
        assert ok_store is True
        mock_proc.communicate.assert_called_with(input="protocol=https\nhost=github.com\nusername=user\npassword=secret\n\n", timeout=2)

        ok_del = git_manager._delete_git_credential("https", "github.com", "user")
        assert ok_del is True
        mock_proc.communicate.assert_called_with(input="protocol=https\nhost=github.com\nusername=user\n\n", timeout=2)


def test_get_git_account_projects_empty(git_manager):
    with patch.object(git_manager, "_read_accounts_file", return_value={"accounts": []}):
        res = git_manager.get_git_account_projects("none")
        assert res["status"] == "success"
        assert res["data"]["projects"] == []


def test_get_git_account_projects_github_and_local(git_manager, tmp_path):
    mock_acc = {
        "id": "acc-git-1",
        "label": "My GitHub",
        "endpoint": "github.com",
        "username": "octocat",
        "token": "ghp_tok",
        "protocol": "https",
        "auth_mode": "pat",
    }
    mock_config = {
        "accounts": [mock_acc],
        "default_account_id": "acc-git-1",
    }

    # Setup local www directory with a matching repo
    www_dir = tmp_path / "www"
    repo_dir = www_dir / "my-octo-app"
    git_dir = repo_dir / ".git"
    git_dir.mkdir(parents=True)
    cfg_file = git_dir / "config"
    cfg_file.write_text("[remote \"origin\"]\n\turl = https://github.com/octocat/local-octo.git\n", encoding="utf-8")

    api_response = [
        {
            "id": 999,
            "name": "spoon-knife",
            "full_name": "octocat/spoon-knife",
            "private": False,
            "html_url": "https://github.com/octocat/spoon-knife",
            "ssh_url": "git@github.com:octocat/spoon-knife.git",
            "clone_url": "https://github.com/octocat/spoon-knife.git",
            "default_branch": "main",
            "updated_at": "2026-11-13T12:00:00Z",
        }
    ]
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps(api_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch.object(git_manager, "_read_accounts_file", return_value=mock_config), \
         patch.object(git_manager, "root_dir", str(tmp_path)), \
         patch("urllib.request.urlopen", return_value=mock_resp):

        res = git_manager.get_git_account_projects("acc-git-1")
        assert res["status"] == "success"
        projects = res["data"]["projects"]
        assert len(projects) == 2
        # Remote project
        assert projects[0]["id"] == "999"
        assert projects[0]["source"] == "remote"
        assert projects[0]["visibility"] == "public"
        # Local project
        assert projects[1]["id"] == "local_my-octo-app"
        assert projects[1]["source"] == "local"
        assert projects[1]["full_name"] == "octocat/local-octo"


def test_save_git_account_github_invalid_password_rejected(git_manager):
    mock_data = {"default_account_id": None, "accounts": []}
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_data), \
         patch.object(git_manager, "_verify_github_token_via_api", return_value=(None, "HTTP 401: Unauthorized")):
        res = git_manager.save_git_account({
            "label": "Personal",
            "endpoint": "github.com",
            "username": "authntcG",
            "email": "user@example.com",
            "protocol": "https",
            "auth_mode": "credentials",
            "token": "plainpassword123",
        })
        assert res["status"] == "error"
        assert res["message"] == "backend.git.github_pat_required"


def test_get_git_account_projects_github_401_falls_back_to_public_repos(git_manager, tmp_path):
    import urllib.error
    mock_acc = {
        "id": "acc-git-1",
        "label": "Personal",
        "endpoint": "github.com",
        "username": "authntcG",
        "token": "plainpassword123",
        "protocol": "https",
        "auth_mode": "credentials",
    }
    mock_config = {
        "accounts": [mock_acc],
        "default_account_id": "acc-git-1",
    }

    public_api_response = [
        {
            "id": 555,
            "name": "vyloserve",
            "full_name": "authntcG/vyloserve",
            "private": False,
            "html_url": "https://github.com/authntcG/vyloserve",
            "ssh_url": "git@github.com:authntcG/vyloserve.git",
            "clone_url": "https://github.com/authntcG/vyloserve.git",
            "default_branch": "main",
            "updated_at": "2026-11-14T00:00:00Z",
        }
    ]
    mock_pub_resp = MagicMock()
    mock_pub_resp.status = 200
    mock_pub_resp.read.return_value = json.dumps(public_api_response).encode("utf-8")
    mock_pub_resp.__enter__.return_value = mock_pub_resp

    def fake_urlopen(req, timeout=10):
        url_str = req.full_url if hasattr(req, "full_url") else str(req)
        if "/user/repos" in url_str:
            raise urllib.error.HTTPError(url_str, 401, "Unauthorized", {}, None)
        return mock_pub_resp

    with patch.object(git_manager, "_read_accounts_file", return_value=mock_config), \
         patch.object(git_manager, "root_dir", str(tmp_path)), \
         patch("urllib.request.urlopen", side_effect=fake_urlopen):
        res = git_manager.get_git_account_projects("acc-git-1")
        assert res["status"] == "success"
        data = res["data"]
        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "vyloserve"
        assert data["auth_warning"] is True


def test_git_mask_token_constant_removal_of_slices(git_manager):
    assert git_manager._mask_token("ghp_1234567890abcdef") == "••••••••"
    assert git_manager._mask_token("glpat-1234567890") == "••••••••"
    assert git_manager._mask_token("") == ""


def test_get_git_accounts_vpn_probing(git_manager):
    mock_config = {
        "accounts": [
            {
                "id": "acc-vpn",
                "label": "Work GitLab",
                "endpoint": "git.neuron.id",
                "username": "galih",
                "email": "galih@neuron.id",
                "requires_vpn": True,
            }
        ],
        "default_account_id": "acc-vpn",
    }
    with patch.object(git_manager, "_read_accounts_file", return_value=mock_config), \
         patch("core.services.git_manager.check_host_reachability", return_value={"reachable": False, "host": "git.neuron.id"}):
        res = git_manager.get_git_accounts()
        assert res["status"] == "success"
        acc = res["accounts"][0]
        assert acc["requires_vpn"] is True
        assert acc["vpn_reachable"] is False


def test_get_git_account_projects_vpn_unreachable_short_circuit(git_manager, tmp_path):
    mock_acc = {
        "id": "acc-vpn-proj",
        "label": "Internal Repo",
        "endpoint": "git.neuron.id",
        "username": "galih",
        "email": "galih@neuron.id",
        "requires_vpn": True,
        "token": "glpat-secret",
    }
    mock_config = {"accounts": [mock_acc], "default_account_id": "acc-vpn-proj"}

    # Siapkan repo lokal di www/internal_app
    www_dir = tmp_path / "www"
    www_dir.mkdir(parents=True, exist_ok=True)
    git_dir = www_dir / "internal_app" / ".git"
    git_dir.mkdir(parents=True, exist_ok=True)
    (git_dir / "config").write_text('[remote "origin"]\n\turl = https://git.neuron.id/team/internal_app.git\n')

    with patch.object(git_manager, "_read_accounts_file", return_value=mock_config), \
         patch.object(git_manager, "root_dir", str(tmp_path)), \
         patch("core.services.git_manager.check_host_reachability", return_value={"reachable": False, "host": "git.neuron.id"}), \
         patch("urllib.request.urlopen") as mock_url:
        res = git_manager.get_git_account_projects("acc-vpn-proj")
        assert res["status"] == "success"
        data = res["data"]
        assert data["vpn_blocked"] is True
        assert data["vpn_host"] == "git.neuron.id"
        mock_url.assert_not_called()  # Short-circuited! No remote API hang
        # Local repos still discovered
        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "internal_app"
        assert data["projects"][0]["source"] == "local"


def test_discover_legacy_git_accounts_ignores_helperselector(git_manager, tmp_path):
    gitconfig_content = """
[user]
    name = Galih Respati
    email = galih@neuron.id
[credential "helperselector"]
    selected = manager
[credential "https://git.neuron.id"]
    provider = generic
"""
    gitconfig_file = tmp_path / ".gitconfig"
    gitconfig_file.write_text(gitconfig_content)

    with patch("os.path.expanduser", return_value=str(gitconfig_file)), \
         patch("os.path.isfile", return_value=True), \
         patch.object(git_manager, "_get_stored_git_credential", return_value=""):
        discovered = git_manager._discover_legacy_git_accounts([])
        endpoints = [d["endpoint"] for d in discovered]
        assert "git.neuron.id" in endpoints
        assert "helperselector" not in endpoints


def test_append_github_repo_list_and_try_fetch(git_manager):
    # Test _append_github_repo_list
    seen = set()
    projects = []
    raw = [
        {"name": "proj1", "full_name": "user/proj1", "private": False},
        {"name": "proj2", "full_name": "user/proj2", "private": True},
    ]
    git_manager._append_github_repo_list(raw, "acc_1", "github.com", seen, projects)
    assert len(projects) == 2
    assert "user/proj1" in seen
    assert "user/proj2" in seen

    # Calling again ignores duplicate
    git_manager._append_github_repo_list(raw, "acc_1", "github.com", seen, projects)
    assert len(projects) == 2

    # Non-list input is gracefully ignored
    git_manager._append_github_repo_list(None, "acc_1", "github.com", seen, projects)
    assert len(projects) == 2

    # Test _try_fetch_github_repos success
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = b'[{"name": "proj3", "full_name": "user/proj3", "private": false}]'
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        succeeded, is_auth = git_manager._try_fetch_github_repos(
            "https://api.github.com/user/repos", "Bearer tok", "acc_1", "github.com", seen, projects
        )
        assert succeeded is True
        assert is_auth is False
        assert len(projects) == 3

    # Test _try_fetch_github_repos 401 HTTP error
    import urllib.error
    http_err = urllib.error.HTTPError("url", 401, "Unauthorized", {}, None)
    with patch("urllib.request.urlopen", side_effect=http_err):
        succeeded, is_auth = git_manager._try_fetch_github_repos(
            "https://api.github.com/user/repos", "Bearer tok", "acc_1", "github.com", seen, projects
        )
        assert succeeded is False
        assert is_auth is True



