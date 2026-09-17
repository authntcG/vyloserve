import os
import pytest
from unittest.mock import MagicMock, patch, mock_open
from core.services.php import PhpManager

@pytest.fixture
def mock_api():
    api = MagicMock()
    return api

@pytest.fixture
def php_mgr(mock_api):
    with patch('os.makedirs'):
        return PhpManager(mock_api)

def test_init(php_mgr):
    assert php_mgr is not None

@patch('os.path.exists', return_value=True)
def test_php_open_path_file(mock_exists, php_mgr):
    with patch('sys.platform', 'win32'):
        with patch('os.startfile') as mock_startfile:
            res = php_mgr.open_path("8.1", is_file=True)
            assert res['status'] == 'success'
            mock_startfile.assert_called_once()
            
@patch('os.path.exists', return_value=True)
def test_php_open_path_dir(mock_exists, php_mgr):
    with patch('sys.platform', 'darwin'):
        with patch('subprocess.Popen') as mock_popen:
            res = php_mgr.open_path("8.1", is_file=False)
            assert res['status'] == 'success'
            mock_popen.assert_called_once()
            
@patch('os.path.exists', return_value=False)
def test_php_open_path_not_found(mock_exists, php_mgr):
    res = php_mgr.open_path("8.1")
    assert res['status'] == 'error'

@patch('os.path.exists', return_value=True)
@patch('shutil.rmtree')
def test_php_uninstall_version(mock_rmtree, mock_exists, php_mgr):
    res = php_mgr.uninstall_version("8.1")
    assert res['status'] == 'success'
    mock_rmtree.assert_called_once()
    
@patch('os.path.exists', return_value=False)
def test_php_uninstall_not_found(mock_exists, php_mgr):
    res = php_mgr.uninstall_version("8.1")
    assert res['status'] == 'error'

@patch('core.services.php.PhpManager._get_port_from_ini', return_value=9000)
@patch('core.services.php.PhpManager._verify_and_patch_ini')
@patch('core.services.php.PhpManager._update_apache_proxy_silent')
@patch('core.services.php.start_silent_process')
def test_php_start_php(mock_start, mock_update, mock_patch, mock_get_port, php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.pid = 1234
    mock_start.return_value = mock_proc
    
    with patch('os.path.exists', return_value=True):
        res = php_mgr.start_php("8.1")
        assert res['status'] == 'success'
        assert "8.1" in php_mgr.processes
        
    # Test already running
    res = php_mgr.start_php("8.1")
    assert res['status'] == 'error'
    
@patch('core.services.php.run_silent_command')
def test_php_stop_php(mock_run, php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.pid = 1234
    php_mgr.processes["8.1"] = mock_proc
    
    with patch('sys.platform', 'win32'):
        res = php_mgr.stop_php("8.1")
        assert res['status'] == 'success'
        mock_run.assert_called_once()
        assert "8.1" not in php_mgr.processes
        
    # Stop already stopped
    res = php_mgr.stop_php("8.1")
    assert res['status'] == 'success'

@patch('os.path.exists', return_value=True)
def test_php_parse_php_ini_info(mock_exists, php_mgr):
    ini_content = "memory_limit = 256M\n; vyloserve_port = 9001\n"
    with patch('builtins.open', mock_open(read_data=ini_content)):
        port, mem = php_mgr._parse_php_ini_info("php.ini")
        assert port == 9001
        assert mem == "256M"

@patch('os.path.exists', return_value=True)
@patch('os.listdir', return_value=["8.1", "8.2"])
@patch('os.path.isdir', return_value=True)
def test_php_get_installed_instances(mock_isdir, mock_listdir, mock_exists, php_mgr):
    with patch.object(php_mgr, '_parse_php_ini_info', return_value=(9001, "256M")):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        php_mgr.processes["8.2"] = mock_proc
        
        mock_proc2 = MagicMock()
        mock_proc2.poll.return_value = 1 # Dead process
        php_mgr.processes["8.1"] = mock_proc2
        
        instances = php_mgr.get_installed_instances()
        assert len(instances) == 2
        
        # 8.2 should be running
        inst_82 = next(i for i in instances if i["version"] == "8.2")
        assert inst_82["status"] == "running"
        assert inst_82["port"] == 9001
        
        # 8.1 should be stopped and removed from processes
        inst_81 = next(i for i in instances if i["version"] == "8.1")
        assert inst_81["status"] == "stopped"
        assert "8.1" not in php_mgr.processes

def test_php_toggle_global_path(php_mgr):
    with patch('sys.platform', 'darwin'):
        assert php_mgr.toggle_global_path("C:\\target", True) is None
        
    with patch('sys.platform', 'win32'):
        import winreg
        mock_key = MagicMock()
        with patch('winreg.OpenKey', return_value=mock_key):
            with patch('winreg.QueryValueEx', return_value=("C:\\some\\path;C:\\other", 1)):
                with patch('winreg.SetValueEx') as mock_set:
                    with patch('ctypes.windll.user32.SendMessageTimeoutW') as mock_send:
                        php_mgr.toggle_global_path("C:\\target", True)
                        mock_set.assert_called_once()
                        mock_send.assert_called_once()

@patch('os.path.exists', return_value=True)
def test_php_verify_and_patch_ini(mock_exists, php_mgr):
    original_ini = "memory_limit = 128M\n;cgi.force_redirect = 1\n;cgi.fix_pathinfo = 0\n"
    with patch('builtins.open', mock_open(read_data=original_ini)) as mocked_file:
        php_mgr._verify_and_patch_ini("php.ini")
        # Should have patched force_redirect to 0 and fix_pathinfo to 1
        written = "".join("".join(call[0][0]) for call in mocked_file().writelines.call_args_list) if mocked_file().writelines.called else ""
        assert "cgi.force_redirect = 0" in written
        assert "cgi.fix_pathinfo = 1" in written

@patch('os.path.exists', return_value=True)
def test_php_get_port_from_ini(mock_exists, php_mgr):
    with patch('builtins.open', mock_open(read_data="; vyloserve_port = 8080\n")):
        assert php_mgr._get_port_from_ini("php.ini") == 8080
    with patch('builtins.open', mock_open(read_data="no port here\n")):
        assert php_mgr._get_port_from_ini("php.ini", 9005) == 9005

@patch.object(PhpManager, '_download_php_archive')
@patch('core.services.php.extract_archive')
@patch('core.services.php.os.remove')
@patch('core.services.php.os.path.exists')
@patch('core.services.php.os.makedirs')
def test_php_install_version(mock_makedirs, mock_exists, mock_remove, mock_extract, mock_download, php_mgr):
    """Test standard PHP installation flow."""
    mock_exists.side_effect = lambda path: True if path.endswith('.zip') else False
    
    with patch('builtins.open', mock_open()):
        res = php_mgr.install_version("8.2", "php-8.2.zip", 9000)
        assert res['status'] == "success"
        
        mock_download.assert_called_once()
        mock_extract.assert_called_once()
        mock_remove.assert_called_once()
        
    # Exception test
    mock_exists.side_effect = lambda path: True if path.endswith('.zip') else False
    mock_download.side_effect = Exception("Download failed")
    with patch('core.services.php.shutil.rmtree') as mock_rmtree:
        res = php_mgr.install_version("8.2", "php-8.2.zip", 9000)
        assert res['status'] == 'error'
        mock_remove.assert_called()
        # Ensure rmtree is called since it fails during download
        # Wait, if target_dir exists is False, it will skip rmtree! 
        # Ah! `if os.path.exists(target_dir): shutil.rmtree`
        # I need to mock os.path.exists to return False on the FIRST call, and True afterwards!
        pass

def test_php_install_version_exception(php_mgr):
    with patch('core.services.php.os.path.exists', side_effect=[False, True, True]):
        with patch('core.services.php.os.makedirs'):
            with patch.object(php_mgr, '_download_php_archive', side_effect=Exception("dl failed")):
                with patch('core.services.php.os.remove') as mock_remove:
                    with patch('core.services.php.shutil.rmtree') as mock_rmtree:
                        res = php_mgr.install_version("8.2", "php.zip", 9000)
                        assert res['status'] == 'error'
                        mock_remove.assert_called_once()
                        mock_rmtree.assert_called_once()

@patch('urllib.request.urlopen')
def test_php_get_available_versions(mock_urlopen, php_mgr):
    mock_response = MagicMock()
    mock_response.read.return_value.decode.return_value = 'href="/downloads/releases/8.1.0/php-8.1.0-Win32-vs16-x64.zip"'
    mock_urlopen.return_value = mock_response

    res = php_mgr.get_versions()
    assert res['status'] == 'success'
    assert len(res['data']) > 0

@patch('os.path.exists')
@patch('urllib.request.urlopen')
def test_php_get_available_versions_unexpected_error_returns_real_message(mock_urlopen, mock_exists, php_mgr):
    """
    Regression test untuk bug 'except Exception: return {..., "message": str(e)}'
    tanpa 'as e' (lihat docs/known_bugs.md #10). Jika bug itu muncul lagi, baris
    `str(e)` akan melempar NameError yang TIDAK tertangkap oleh except di atasnya,
    sehingga test ini akan gagal dengan error, bukan lolos diam-diam.
    """
    mock_response = MagicMock()
    mock_response.read.return_value.decode.return_value = 'href="/downloads/releases/8.1.0/php-8.1.0-Win32-vs16-x64.zip"'
    mock_urlopen.return_value = mock_response
    mock_exists.side_effect = OSError("disk unreadable")

    res = php_mgr.get_versions()

    assert res['status'] == 'error'
    assert res['message'] == 'disk unreadable'

@patch('builtins.open', new_callable=MagicMock)
@patch('core.services.php.os.path.exists', return_value=True)
def test_php_save_config_extensions(mock_exists, mock_open, php_mgr):
    mock_file = MagicMock()
    mock_file.readlines.return_value = ["memory_limit=128M\n", ";extension=mysqli\n", ";extension=curl"]
    mock_open.return_value.__enter__.return_value = mock_file

    with patch.object(php_mgr, 'get_config', return_value={"status": "success", "data": {"memory_limit": "128M"}}):
        with patch.object(php_mgr, '_update_ini_lines', return_value=["memory_limit=256M\n", "extension=mysqli\n", ";extension=curl\n"]):
            res = php_mgr.save_config("8.1", {"memory_limit": "256M"}, ["mysqli"])

            assert res['status'] == 'success'
            mock_file.writelines.assert_called_once_with(["memory_limit=256M\n", "extension=mysqli\n", ";extension=curl\n"])

# ==========================================
# toggle_global_path — cabang FileNotFoundError (registry Path belum ada)
# ==========================================

def test_php_toggle_global_path_handles_missing_registry_value(php_mgr):
    with patch('sys.platform', 'win32'):
        mock_key = MagicMock()
        with patch('winreg.OpenKey', return_value=mock_key):
            with patch('winreg.QueryValueEx', side_effect=FileNotFoundError()):
                with patch('winreg.SetValueEx') as mock_set:
                    with patch('ctypes.windll.user32.SendMessageTimeoutW'):
                        php_mgr.toggle_global_path("C:\\target", True)
    mock_set.assert_called_once()
    written_path = mock_set.call_args[0][4]
    assert written_path == "C:\\target"

# ==========================================
# get_versions — cabang non-Windows & partial URL failure
# ==========================================

@patch('urllib.request.urlopen')
def test_php_get_versions_non_windows_uses_tar_gz_pattern(mock_urlopen, php_mgr):
    mock_response = MagicMock()
    mock_response.read.return_value.decode.return_value = 'href="php-8.3.0.tar.gz"'
    mock_urlopen.return_value = mock_response
    with patch('sys.platform', 'linux'):
        res = php_mgr.get_versions()
    assert res['status'] == 'success'
    assert res['data'][0]['version'] == '8.3.0'

@patch('urllib.request.urlopen')
def test_php_get_versions_skips_url_that_fails_but_uses_the_other(mock_urlopen, php_mgr):
    """Jika salah satu URL rilis gagal diakses, tetap lanjut memakai hasil dari URL lain."""
    good_response = MagicMock()
    good_response.read.return_value.decode.return_value = 'href="/downloads/releases/8.1.0/php-8.1.0-Win32-vs16-x64.zip"'
    mock_urlopen.side_effect = [OSError("timeout"), good_response]
    with patch('sys.platform', 'win32'):
        res = php_mgr.get_versions()
    assert res['status'] == 'success'
    assert len(res['data']) > 0

# ==========================================
# _download_php_archive — fallback ke archives (Windows) & re-raise (non-Windows)
# ==========================================

@patch('core.services.php.download_advanced')
def test_download_php_archive_success_no_fallback_needed(mock_download, php_mgr):
    php_mgr._download_php_archive("http://primary", "php-8.1.0.zip", "C:\\out.zip", lambda *a: None, lambda *a: None)
    mock_download.assert_called_once()
    args = mock_download.call_args[0]
    assert args[0] == "http://primary"

@patch('core.services.php.download_advanced')
def test_download_php_archive_falls_back_to_archives_on_windows(mock_download, php_mgr):
    mock_download.side_effect = [OSError("404 not found"), None]
    with patch('sys.platform', 'win32'):
        php_mgr._download_php_archive("http://primary", "php-7.4.0.zip", "C:\\out.zip", lambda *a: None, lambda *a: None)
    assert mock_download.call_count == 2
    fallback_url = mock_download.call_args_list[1][0][0]
    assert fallback_url == "https://windows.php.net/downloads/releases/archives/php-7.4.0.zip"

@patch('core.services.php.download_advanced', side_effect=OSError("404 not found"))
def test_download_php_archive_reraises_on_non_windows(mock_download, php_mgr):
    with patch('sys.platform', 'linux'):
        with pytest.raises(OSError, match="404 not found"):
            php_mgr._download_php_archive("http://primary", "php-8.1.0.tar.gz", "/tmp/out.tar.gz", lambda *a: None, lambda *a: None)

# ==========================================
# _parse_config_file / _get_available_exts / get_config
# ==========================================

def test_parse_config_file_extracts_all_known_keys(php_mgr):
    ini_content = (
        "; vyloserve_port = 9010\n"
        "memory_limit = 256M\n"
        "max_execution_time = 90\n"
        "upload_max_filesize = 32M\n"
        "post_max_size = 32M\n"
        "extension=curl\n"
        ";extension=mysqli\n"
    )
    config, active_exts = {}, set()
    with patch('os.path.exists', return_value=True):
        with patch('builtins.open', mock_open(read_data=ini_content)):
            php_mgr._parse_config_file("php.ini", config, active_exts)

    assert config == {"port": 9010, "memory_limit": "256M", "max_execution_time": "90", "upload_max_filesize": "32M", "post_max_size": "32M"}
    assert active_exts == {"curl"}

def test_parse_config_file_noop_when_missing(php_mgr):
    config, active_exts = {}, set()
    with patch('os.path.exists', return_value=False):
        php_mgr._parse_config_file("php.ini", config, active_exts)
    assert config == {}
    assert active_exts == set()

def test_get_available_exts_lists_dll_and_includes_active_not_on_disk(php_mgr):
    with patch('os.path.exists', return_value=True):
        with patch('os.listdir', return_value=["php_curl.dll", "php_mbstring.dll", "readme.txt"]):
            exts = php_mgr._get_available_exts("C:\\ext", {"curl", "sqlite3"})

    names = {e['name']: e['active'] for e in exts}
    assert names == {"curl": True, "mbstring": False, "sqlite3": True}

def test_get_available_exts_empty_when_dir_missing(php_mgr):
    with patch('os.path.exists', return_value=False):
        exts = php_mgr._get_available_exts("C:\\ext", set())
    assert exts == []

def test_get_config_combines_parsed_ini_and_extensions(php_mgr):
    with patch.object(php_mgr, '_parse_config_file') as mock_parse:
        with patch.object(php_mgr, '_get_available_exts', return_value=[{"name": "curl", "active": True}]) as mock_exts:
            res = php_mgr.get_config("8.1")

    assert res['status'] == 'success'
    assert res['config']['port'] == 9000  # default sebelum di-overwrite parser
    assert res['extensions'] == [{"name": "curl", "active": True}]
    mock_parse.assert_called_once()
    mock_exts.assert_called_once()

# ==========================================
# open_path — cabang linux & exception
# ==========================================

@patch('os.path.exists', return_value=True)
def test_php_open_path_linux_uses_xdg_open(mock_exists, php_mgr):
    with patch('sys.platform', 'linux'):
        with patch('subprocess.Popen') as mock_popen:
            res = php_mgr.open_path("8.1", is_file=False)
    assert res['status'] == 'success'
    mock_popen.assert_called_once_with(['xdg-open', os.path.join(php_mgr.base_dir, "8.1")])

@patch('os.path.exists', return_value=True)
def test_php_open_path_handles_exception(mock_exists, php_mgr):
    with patch('sys.platform', 'win32'):
        with patch('os.startfile', side_effect=OSError("access denied")):
            res = php_mgr.open_path("8.1", is_file=True)
    assert res['status'] == 'error'
    assert res['message'] == 'access denied'

# ==========================================
# _verify_and_patch_ini — cabang directive aktif (bukan komentar)
# ==========================================

def test_verify_and_patch_ini_replaces_active_force_redirect(php_mgr):
    original_ini = "cgi.force_redirect = 1\ncgi.fix_pathinfo = 1\n"
    with patch('os.path.exists', return_value=True):
        with patch('builtins.open', mock_open(read_data=original_ini)) as mocked_file:
            php_mgr._verify_and_patch_ini("php.ini")
    written = mocked_file().writelines.call_args[0][0] if mocked_file().writelines.called else []
    assert "cgi.force_redirect = 0\n" in written
    assert "cgi.force_redirect = 1\n" not in written

def test_verify_and_patch_ini_normalizes_even_when_value_already_correct(php_mgr):
    """
    Catatan perilaku: fungsi ini mendeteksi keberadaan directive aktif (bukan dikomentari)
    tanpa mengecek nilainya -- jadi baris 'cgi.force_redirect = 0' yang sudah benar tetap
    di-normalize ulang (ditulis ulang persis sama). Bukan bug, hanya idempoten tanpa short-circuit.
    """
    original_ini = "cgi.force_redirect = 0\ncgi.fix_pathinfo = 1\n"
    with patch('os.path.exists', return_value=True):
        with patch('builtins.open', mock_open(read_data=original_ini)) as mocked_file:
            php_mgr._verify_and_patch_ini("php.ini")
    written = mocked_file().writelines.call_args[0][0]
    assert written == ["cgi.force_redirect = 0\n", "cgi.fix_pathinfo = 1\n"]

# ==========================================
# _update_apache_proxy_silent
# ==========================================

def test_update_apache_proxy_silent_calls_apache_manager(php_mgr):
    php_mgr._update_apache_proxy_silent(9005)
    php_mgr.api.apache.update_global_php_proxy.assert_called_once_with(9005)

def test_update_apache_proxy_silent_swallows_exception(php_mgr):
    php_mgr.api.apache.update_global_php_proxy.side_effect = RuntimeError("apache not ready")
    php_mgr._update_apache_proxy_silent(9005)  # tidak boleh melempar exception ke pemanggil
    # Pastikan exception itu benar-benar berasal dari upaya panggilan nyata, bukan fungsi no-op
    php_mgr.api.apache.update_global_php_proxy.assert_called_once_with(9005)

# ==========================================
# start_php — cabang tambahan
# ==========================================

@patch('os.path.exists', return_value=False)
def test_start_php_binary_not_found(mock_exists, php_mgr):
    res = php_mgr.start_php("8.1")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.php.binary_not_found'

@patch('core.services.php.PhpManager._get_port_from_ini', return_value=9000)
@patch('core.services.php.PhpManager._verify_and_patch_ini')
@patch('core.services.php.start_silent_process')
def test_start_php_cgi_process_dies_immediately(mock_start, mock_patch_ini, mock_get_port, php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 1  # proses langsung mati
    mock_start.return_value = mock_proc
    with patch('os.path.exists', return_value=True):
        with patch('time.sleep'):
            res = php_mgr.start_php("8.1")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.php.cgi_failed'

@patch('core.services.php.PhpManager._get_port_from_ini', return_value=9000)
@patch('core.services.php.PhpManager._verify_and_patch_ini')
@patch('core.services.php.start_silent_process', side_effect=OSError("php-cgi.exe crashed"))
def test_start_php_handles_launch_exception(mock_start, mock_patch_ini, mock_get_port, php_mgr):
    with patch('os.path.exists', return_value=True):
        res = php_mgr.start_php("8.1")
    assert res['status'] == 'error'
    assert res['message'] == 'php-cgi.exe crashed'

# ==========================================
# check_is_running — implementasi nyata
# ==========================================

def test_check_is_running_true_when_process_alive(php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    php_mgr.processes["8.1"] = mock_proc
    assert php_mgr.check_is_running() is True

def test_check_is_running_cleans_up_dead_processes(php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 0
    php_mgr.processes["8.1"] = mock_proc
    assert php_mgr.check_is_running() is False
    assert "8.1" not in php_mgr.processes

# ==========================================
# get_installed_versions
# ==========================================

def test_get_installed_versions_lists_dirs(php_mgr):
    with patch('os.path.exists', return_value=True):
        with patch('os.listdir', return_value=["8.1", "8.2", "readme.txt"]):
            with patch('os.path.isdir', side_effect=lambda p: not p.endswith('readme.txt')):
                versions = php_mgr.get_installed_versions()
    assert versions == ["8.1", "8.2"]

def test_get_installed_versions_empty_when_base_dir_missing(php_mgr):
    with patch('os.path.exists', return_value=False):
        assert php_mgr.get_installed_versions() == []

# ==========================================
# _get_preferred_versions / start_all / stop_all
# ==========================================

def test_get_preferred_versions_uses_dashboard_selection(php_mgr):
    with patch.object(php_mgr, 'get_installed_versions', return_value=["8.1", "8.2"]):
        with patch('core.services.php.read_json', return_value={"selected_php": ["8.2"]}):
            assert php_mgr._get_preferred_versions() == ["8.2"]

def test_get_preferred_versions_falls_back_to_highest_installed(php_mgr):
    with patch.object(php_mgr, 'get_installed_versions', return_value=["7.4", "8.1", "8.2"]):
        with patch('core.services.php.read_json', return_value={}):
            assert php_mgr._get_preferred_versions() == ["8.2"]

def test_get_preferred_versions_empty_when_nothing_installed(php_mgr):
    with patch.object(php_mgr, 'get_installed_versions', return_value=[]):
        assert php_mgr._get_preferred_versions() == []

def test_start_all_no_versions_installed(php_mgr):
    with patch.object(php_mgr, '_get_preferred_versions', return_value=[]):
        res = php_mgr.start_all()
    assert res['status'] == 'error'
    assert res['message'] == 'backend.php.none_installed'

def test_start_all_starts_preferred_versions(php_mgr):
    with patch.object(php_mgr, '_get_preferred_versions', return_value=["8.1", "8.2"]):
        with patch.object(php_mgr, 'start_php', return_value={"status": "success"}) as mock_start:
            res = php_mgr.start_all()
    assert res['status'] == 'success'
    assert res['args']['count'] == 2
    assert mock_start.call_count == 2

def test_start_all_skips_already_running_versions(php_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None  # sudah running
    php_mgr.processes["8.1"] = mock_proc
    with patch.object(php_mgr, '_get_preferred_versions', return_value=["8.1"]):
        with patch.object(php_mgr, 'start_php') as mock_start:
            res = php_mgr.start_all()
    mock_start.assert_not_called()
    assert res['status'] == 'success'
    assert res['message'] == 'backend.php.already_running'

def test_stop_all_stops_every_running_process(php_mgr):
    php_mgr.processes["8.1"] = MagicMock()
    php_mgr.processes["8.2"] = MagicMock()
    with patch.object(php_mgr, 'stop_php', return_value={"status": "success"}) as mock_stop:
        res = php_mgr.stop_all()
    assert res['status'] == 'success'
    assert res['args']['count'] == 2
    assert mock_stop.call_count == 2
