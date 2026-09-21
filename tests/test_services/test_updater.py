import os
import pytest
from unittest.mock import MagicMock, patch
from core.services.updater import UpdaterManager
import json

@pytest.fixture
def api_mock():
    api = MagicMock()
    # Mock settings manager
    api.settings.get_settings.return_value = {
        "status": "success",
        "data": {"receive_prerelease_updates": False}
    }
    return api

@pytest.fixture
def updater(api_mock):
    return UpdaterManager(api_mock)

def test_parse_version(updater):
    # Testing pre-releases
    assert updater._parse_version("v.0.0.1-alpha") == (0, 0, 1, "alpha")
    assert updater._parse_version("0.0.3-beta") == (0, 0, 3, "beta")
    assert updater._parse_version("v1.0.0-rc1") == (1, 0, 0, "rc1")
    
    # Testing stable
    assert updater._parse_version("v.1.0.0") == (1, 0, 0, "z")
    assert updater._parse_version("1.0.0") == (1, 0, 0, "z")
    assert updater._parse_version("2.1") == (2, 1, 0, "z")

    # Comparisons
    assert updater._parse_version("v.1.0.0") > updater._parse_version("v.0.0.1-alpha")
    assert updater._parse_version("v.1.0.0") > updater._parse_version("v.1.0.0-rc1")
    assert updater._parse_version("v.1.0.1") > updater._parse_version("v.1.0.0")
    assert updater._parse_version("v.2.0.0-beta") > updater._parse_version("v.1.9.9")

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_already_latest(mock_urlopen, updater):
    # Mock github response
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {"tag_name": "v.0.0.2", "draft": False, "prerelease": False}
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "success"
        assert res["is_update_available"] == False

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_new_stable_available(mock_urlopen, updater):
    # Mock github response
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.4", 
            "draft": False, 
            "prerelease": False,
            "body": "Fixed some bugs.",
            "assets": [
                {"name": "VyloServe_Setup_v0.0.4.exe", "browser_download_url": "http://example.com/setup.exe"}
            ]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "success"
        assert res["is_update_available"] == True
        assert res["version"] == "v.0.0.4"
        assert res["asset_url"] == "http://example.com/setup.exe"
        assert res["asset_name"] == "VyloServe_Setup_v0.0.4.exe"

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_new_prerelease_available_but_opt_out(mock_urlopen, updater):
    # Opt out of pre-releases
    updater.api.settings.get_settings.return_value = {"status": "success", "data": {"receive_prerelease_updates": False}}
    
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.4-beta", 
            "draft": False, 
            "prerelease": True,
            "assets": [{"name": "VyloServe_Setup.exe", "browser_download_url": "http://url"}]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "success"
        assert res["is_update_available"] == False

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_new_prerelease_available_and_opt_in(mock_urlopen, updater):
    # Opt IN to pre-releases
    updater.api.settings.get_settings.return_value = {"status": "success", "data": {"receive_prerelease_updates": True}}
    
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.4-beta", 
            "draft": False, 
            "prerelease": True,
            "assets": [{"name": "VyloServe_Setup.exe", "browser_download_url": "http://url"}]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "success"
        assert res["is_update_available"] == True
        assert res["version"] == "v.0.0.4-beta"

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_network_error(mock_urlopen, updater):
    mock_urlopen.side_effect = Exception("Timeout")

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "error"
        assert res["message"] == "backend.updater.network_error"

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_no_releases(mock_urlopen, updater):
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "error"
        assert res["message"] == "backend.updater.no_releases"

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_no_installer_asset(mock_urlopen, updater):
    # Rilis baru ditemukan, tetapi tidak ada satupun asset .exe.
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.4",
            "draft": False,
            "prerelease": False,
            "assets": [{"name": "source.zip", "browser_download_url": "http://example.com/source.zip"}]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "error"
        assert res["message"] == "backend.updater.no_installer"

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_ignores_draft_releases(mock_urlopen, updater):
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.9",
            "draft": True,
            "prerelease": False,
            "assets": [{"name": "VyloServe_Setup.exe", "browser_download_url": "http://url"}]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.3-beta'):
        res = updater.check_for_updates()
        assert res["status"] == "success"
        assert res["is_update_available"] == False

@patch('core.services.updater.urllib.request.urlopen')
def test_check_for_updates_respects_patched_app_version(mock_urlopen, updater):
    """
    Regression guard untuk rule 19 (Patch Target Harus Presisi): kode produksi
    melakukan `from main import APP_VERSION` di DALAM fungsi, sehingga hanya
    patch('main.APP_VERSION', ...) yang benar-benar terbaca -- patch ke
    'core.services.updater.APP_VERSION' (target lama, sudah salah) tidak akan
    pernah dilihat oleh fungsi ini. Sengaja dites dengan dua versi berbeda agar
    test ini pasti GAGAL jika patch target-nya salah lagi di kemudian hari.
    """
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps([
        {
            "tag_name": "v.0.0.5",
            "draft": False,
            "prerelease": False,
            "assets": [{"name": "VyloServe_Setup.exe", "browser_download_url": "http://url"}]
        }
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_response

    with patch('main.APP_VERSION', '0.0.1-beta'):
        res = updater.check_for_updates()
        assert res["is_update_available"] == True

    with patch('main.APP_VERSION', '0.0.9-beta'):
        res = updater.check_for_updates()
        assert res["is_update_available"] == False

def test_find_installer_asset_prefers_setup_exe(updater):
    release = {
        "assets": [
            {"name": "source.zip", "browser_download_url": "http://url/source.zip"},
            {"name": "VyloServe_Portable.exe", "browser_download_url": "http://url/portable.exe"},
            {"name": "VyloServe_Setup_v1.0.0.exe", "browser_download_url": "http://url/setup.exe"},
        ]
    }
    asset = updater._find_installer_asset(release)
    assert asset["name"] == "VyloServe_Setup_v1.0.0.exe"

def test_find_installer_asset_falls_back_to_any_exe(updater):
    release = {
        "assets": [
            {"name": "source.zip", "browser_download_url": "http://url/source.zip"},
            {"name": "VyloServe_Portable.exe", "browser_download_url": "http://url/portable.exe"},
        ]
    }
    asset = updater._find_installer_asset(release)
    assert asset["name"] == "VyloServe_Portable.exe"

def test_find_installer_asset_none_when_no_exe(updater):
    release = {"assets": [{"name": "source.zip", "browser_download_url": "http://url/source.zip"}]}
    assert updater._find_installer_asset(release) is None

@patch('core.services.updater.os.remove')
@patch('core.services.updater.os.listdir')
@patch('core.services.updater.os.path.exists')
@patch('core.services.updater.get_project_root')
def test_cleanup_temp_removes_installer_leftovers_on_init(mock_root, mock_exists, mock_listdir, mock_remove, api_mock):
    mock_root.return_value = "C:\\fake_project"
    mock_exists.return_value = True
    mock_listdir.return_value = ["old_setup.exe", "script.bat", "cache.tmp", "readme.txt"]

    UpdaterManager(api_mock)

    removed_paths = {call.args[0] for call in mock_remove.call_args_list}
    assert os.path.join("C:\\fake_project", "temp", "old_setup.exe") in removed_paths
    assert os.path.join("C:\\fake_project", "temp", "script.bat") in removed_paths
    assert os.path.join("C:\\fake_project", "temp", "cache.tmp") in removed_paths
    assert not any(p.endswith("readme.txt") for p in removed_paths)

@patch('core.services.updater.os.path.exists')
@patch('core.services.updater.get_project_root')
def test_cleanup_temp_noop_when_temp_dir_missing(mock_root, mock_exists, api_mock):
    mock_root.return_value = "C:\\fake_project"
    mock_exists.return_value = False
    # Tidak boleh melempar error walau folder 'temp' belum pernah dibuat.
    UpdaterManager(api_mock)

def test_start_download_update_already_downloading_returns_error(updater):
    updater.state["is_downloading"] = True
    res = updater.start_download_update("http://url/setup.exe", "setup.exe")
    assert res["status"] == "error"
    assert res["message"] == "backend.updater.already_downloading"

@patch('core.services.updater.threading.Thread')
def test_start_download_update_spawns_background_thread(mock_thread, updater):
    res = updater.start_download_update("http://url/setup.exe", "setup.exe")

    assert res["status"] == "success"
    assert updater.state["is_downloading"] is True
    assert updater.state["asset_name"] == "setup.exe"
    mock_thread.assert_called_once()
    _, kwargs = mock_thread.call_args
    assert kwargs["target"] == updater._download_thread
    assert kwargs["args"] == ("http://url/setup.exe", "setup.exe")
    assert kwargs["daemon"] is True
    mock_thread.return_value.start.assert_called_once()
    updater.api.emit_progress.assert_called_once_with(0, "backend.updater.downloading", {"file": "setup.exe"})

@patch('builtins.open')
@patch('core.services.updater.os.makedirs')
@patch('core.services.updater.urllib.request.urlopen')
def test_download_thread_success_marks_ready_and_notifies_ui(mock_urlopen, mock_makedirs, mock_open, updater):
    mock_response = MagicMock()
    mock_response.getheader.return_value = "10"
    mock_response.read.side_effect = [b"0123456789", b""]
    mock_urlopen.return_value.__enter__.return_value = mock_response
    updater.api._window = MagicMock()

    updater._download_thread("http://url/setup.exe", "setup.exe")

    assert updater.state["is_ready"] is True
    assert updater.state["is_downloading"] is False
    assert updater.state["progress_percent"] == 100
    assert updater.state["progress_text"] == "backend.updater.ready_to_install"
    updater.api.emit_progress.assert_called_with(100, "backend.updater.ready_to_install", {})
    updater.api._window.evaluate_js.assert_called_once()
    assert "vylo_update_ready" in updater.api._window.evaluate_js.call_args[0][0]

@patch('core.services.updater.os.makedirs')
@patch('core.services.updater.urllib.request.urlopen')
def test_download_thread_network_failure_resets_state_and_logs_error(mock_urlopen, mock_makedirs, updater):
    mock_urlopen.side_effect = Exception("connection reset")

    updater._download_thread("http://url/setup.exe", "setup.exe")

    assert updater.state["is_downloading"] is False
    assert updater.state["progress_percent"] == 0
    assert updater.state["progress_text"] == "backend.updater.download_failed"
    updater.api.emit_log.assert_called_once_with(
        "backend.updater.download_error", "error", {"e": "connection reset"}
    )
    updater.api.emit_progress.assert_called_with(100, "backend.updater.download_failed", {})

def test_install_update_not_ready_returns_error(updater):
    updater.state["is_ready"] = False
    res = updater.install_update()
    assert res["status"] == "error"
    assert res["message"] == "backend.updater.not_ready"

@patch('core.services.updater.os.path.exists')
def test_install_update_missing_file_on_disk_returns_error(mock_exists, updater):
    updater.state["is_ready"] = True
    updater.state["asset_name"] = "setup.exe"
    mock_exists.return_value = False

    res = updater.install_update()
    assert res["status"] == "error"
    assert res["message"] == "backend.updater.not_ready"

@patch('builtins.open')
@patch('core.services.updater.subprocess.Popen')
@patch('core.services.updater.os.path.exists')
def test_install_update_success_launches_silent_installer(mock_exists, mock_popen, mock_open, updater):
    updater.state["is_ready"] = True
    updater.state["asset_name"] = "setup.exe"
    mock_exists.return_value = True

    res = updater.install_update()

    assert res["status"] == "success"
    assert res["message"] == "backend.updater.restarting"
    args, kwargs = mock_popen.call_args
    expected_path = os.path.join(updater.base_dir, "temp", "launcher.vbs")
    cmd_list = args[0]
    assert cmd_list[0] == 'wscript.exe'
    assert cmd_list[1] == expected_path

@patch('builtins.open')
@patch('core.services.updater.subprocess.Popen', side_effect=OSError("permission denied"))
@patch('core.services.updater.os.path.exists')
def test_install_update_launch_failure_returns_generic_error(mock_exists, mock_popen, mock_open, updater):
    updater.state["is_ready"] = True
    updater.state["asset_name"] = "setup.exe"
    mock_exists.return_value = True

    res = updater.install_update()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"
    assert res["args"] == {"e": "permission denied"}
