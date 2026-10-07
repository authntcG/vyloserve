import os
import pytest
from unittest.mock import patch, MagicMock
from core.services.tunnels import TunnelsManager

@pytest.fixture
def tunnels_manager():
    manager = TunnelsManager(MagicMock())
    with patch.object(manager, '_get_tunnel_dir', side_effect=lambda engine: os.path.join(manager.base_dir, 'bin', 'tunnels', engine, 'unknown')):
        yield manager

# ==========================================
# uninstall_zrok
# ==========================================

@patch('core.services.tunnels.shutil.rmtree')
@patch('core.services.tunnels.os.path.exists')
def test_uninstall_zrok_removes_zrok_dir(mock_exists, mock_rmtree, tunnels_manager):
    mock_exists.return_value = True

    res = tunnels_manager.uninstall_zrok()

    assert res == {"status": "success", "message": "backend.zrok.uninstalled"}
    assert mock_rmtree.call_count == 3

@patch('core.services.tunnels.shutil.rmtree')
@patch('core.services.tunnels.os.path.exists')
def test_uninstall_zrok_stops_all_active_shares_first(mock_exists, mock_rmtree, tunnels_manager):
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    tunnels_manager.active_shares = {
        "share_1": {"process": mock_proc, "project_id": "proj_a"},
        "share_2": {"process": mock_proc, "project_id": "proj_b"},
    }

    with patch.object(tunnels_manager, 'stop_zrok_share', wraps=tunnels_manager.stop_zrok_share) as mock_stop:
        tunnels_manager.uninstall_zrok()

    assert mock_stop.call_count == 2
    mock_stop.assert_any_call("share_1")
    mock_stop.assert_any_call("share_2")
    assert tunnels_manager.active_shares == {}

@patch('core.services.tunnels.os.path.exists')
def test_uninstall_zrok_skips_rmtree_when_not_installed(mock_exists, tunnels_manager):
    mock_exists.return_value = False

    with patch('core.services.tunnels.shutil.rmtree') as mock_rmtree:
        res = tunnels_manager.uninstall_zrok()

    assert res['status'] == 'success'
    mock_rmtree.assert_not_called()

@patch('core.services.tunnels.os.path.exists', side_effect=RuntimeError("disk error"))
def test_uninstall_zrok_handles_exception(mock_exists, tunnels_manager):
    res = tunnels_manager.uninstall_zrok()

    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'
    assert res['args']['e'] == 'disk error'

# ==========================================
# start_zrok_share -- regresi: harus pakai port Apache asli, bukan key 'apache_port'
# yang sebenarnya tidak pernah ada di settings.json (lihat docs/known_bugs.md #31)
# ==========================================

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_uses_apache_get_http_port_for_project_target(mock_popen, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        "\x1b[32maccess your zrok share: https://abc.shares.zrok.io\x1b[0m\n",
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    tunnels_manager.api = MagicMock()
    tunnels_manager.api.apache.get_http_port.return_value = 8080
    tunnels_manager.api.project._read_projects.return_value = [{"id": "proj_1", "name": "My Site"}]

    res = tunnels_manager.start_zrok_share("proj_1")

    assert res['status'] == 'success'
    tunnels_manager.api.apache.get_http_port.assert_called_once()
    tunnels_manager.api.settings.get_settings.assert_not_called()
    called_cmd = mock_popen.call_args[0][0]
    assert "http://127.0.0.1:8080" in called_cmd

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_get_zrok_status_enabled(mock_run, mock_exists, tunnels_manager):
    # Setup
    mock_exists.return_value = True
    
    # Mock return values for version and status
    mock_ver = MagicMock()
    mock_ver.returncode = 0
    mock_ver.stdout = "v2.0.7"
    
    mock_status = MagicMock()
    mock_status.returncode = 0
    mock_status.stdout = "Config:\nEnvironment:\n"
    
    mock_run.side_effect = [mock_ver, mock_status]
    
    # Execute
    res = tunnels_manager.get_zrok_status()
    
    # Assert
    assert res['installed'] is True
    assert res['enabled'] is True
    assert res['version'] == "v2.0.7"
    assert "Environment:" in res['env_status']

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_get_zrok_status_disabled(mock_run, mock_exists, tunnels_manager):
    # Setup
    mock_exists.return_value = True
    
    # Mock return values for version and status
    mock_ver = MagicMock()
    mock_ver.returncode = 0
    mock_ver.stdout = "v2.0.7"
    
    mock_status = MagicMock()
    mock_status.returncode = 0
    mock_status.stdout = "Config:\n" # No Environment
    
    mock_run.side_effect = [mock_ver, mock_status]
    
    # Execute
    res = tunnels_manager.get_zrok_status()
    
    # Assert
    assert res['installed'] is True
    assert res['enabled'] is False
    assert res['version'] == "v2.0.7"
    assert res['env_status'] is None

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_success(mock_popen, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    
    mock_proc = MagicMock()
    # Mock stdout for the proc
    mock_proc.stdout = iter([
        "some log\n",
        "\x1b[32maccess your zrok share: https://18hf8.shares.zrok.io\x1b[0m\n",
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    # Mock api to not fail
    tunnels_manager.api = MagicMock()

    res = tunnels_manager.start_zrok_share("localhost:3000")

    assert res['status'] == 'success'
    assert res['url'] == 'https://18hf8.shares.zrok.io'

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_uses_fallback_pattern_when_exact_phrase_differs(mock_popen, mock_exists, tunnels_manager):
    """
    Regresi: versi zrok yang berbeda bisa memakai frasa berbeda dari "access your zrok
    share:" -- pola cadangan (URL apa pun yang jelas domain *.zrok.io) harus tetap
    menangkapnya. Lihat docs/known_bugs.md root cause "url_not_found" meski share
    sebenarnya berhasil dibuat di sisi cloud zrok.
    """
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        "some unrelated startup log\n",
        "the zrok share is now accessible via https://xyz123.share.zrok.io\n",
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc
    tunnels_manager.api = MagicMock()

    res = tunnels_manager.start_zrok_share("localhost:3000")

    assert res['status'] == 'success'
    assert res['url'] == 'https://xyz123.share.zrok.io'

@patch('core.services.tunnels.ZROK_SHARE_DETECT_TIMEOUT_SECONDS', 0.3)
@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_times_out_and_kills_process_when_url_never_appears(mock_popen, mock_exists, tunnels_manager):
    """
    Kalau stdout zrok tidak pernah memuat URL dalam batas waktu, proses HARUS di-kill
    dan error 'url_not_found' dikembalikan -- bukan menunggu selamanya atau membiarkan
    proses zrok menggantung tanpa pernah di-track di active_shares.
    """
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        "just some irrelevant startup noise, never prints a url\n",
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc
    tunnels_manager.api = MagicMock()

    res = tunnels_manager.start_zrok_share("localhost:3000")

    assert res == {"status": "error", "message": "backend.zrok.url_not_found"}
    mock_proc.kill.assert_called_once()
    assert tunnels_manager.active_shares == {}

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_logs_every_raw_line_during_detection_for_diagnostics(mock_popen, mock_exists, tunnels_manager):
    """
    Regresi: dulu baris stdout zrok HANYA di-log ke System Logs SETELAH URL ditemukan --
    kalau deteksi gagal, output asli zrok hilang total tanpa jejak untuk didiagnosis.
    Sekarang setiap baris (termasuk yang tidak match) harus tetap di-log.
    """
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        "connecting to zrok control plane...\n",
        "access your zrok share: https://abc.shares.zrok.io\n",
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc
    tunnels_manager.api = MagicMock()

    tunnels_manager.start_zrok_share("localhost:3000")

    tunnels_manager.api.emit_log.assert_any_call(
        "backend.zrok.process_log", "info", {"msg": "connecting to zrok control plane..."}
    )

# ==========================================
# _extract_zrok_public_url -- regresi root cause nyata: zrok v2 mencetak JSON per baris,
# BUKAN teks biasa seperti diasumsikan kode lama. Baris di bawah ini adalah OUTPUT ASLI
# yang diverifikasi langsung dari binary zrok.exe v2.0.7 (`bin/zrok/zrok.exe`) di proyek
# ini, bukan contoh karangan -- lihat docs/known_bugs.md untuk kronologi lengkap.
# ==========================================

REAL_ZROK_V2_JSON_LINE = (
    r'{"time":"2026-10-03T22:44:05.1990113+07:00","level":"INFO",'
    r'"source":{"function":"main.(*sharePublicCommand).shareLocal",'
    r'"file":"/home/runner/work/zrok/zrok/cmd/zrok2/sharePublic.go","line":281},'
    r'"msg":"access your zrok share at the following endpoints:\n 1yiutxunuio0.shares.zrok.io"}'
    + "\n"
)

def test_extract_zrok_public_url_parses_real_v2_json_log_line():
    url = TunnelsManager._extract_zrok_public_url(REAL_ZROK_V2_JSON_LINE)
    assert url == "https://1yiutxunuio0.shares.zrok.io"

def test_extract_zrok_public_url_returns_none_for_unrelated_json_log_line():
    unrelated = r'{"time":"2026-10-03T22:44:00Z","level":"INFO","msg":"starting zrok share"}' + "\n"
    assert TunnelsManager._extract_zrok_public_url(unrelated) is None

def test_extract_zrok_public_url_still_handles_old_plain_text_format_with_scheme():
    old_style = "\x1b[32maccess your zrok share: https://18hf8.shares.zrok.io\x1b[0m\n"
    assert TunnelsManager._extract_zrok_public_url(old_style) == "https://18hf8.shares.zrok.io"

def test_extract_zrok_public_url_returns_none_for_blank_line():
    assert TunnelsManager._extract_zrok_public_url("\n") is None
    assert TunnelsManager._extract_zrok_public_url("") is None

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_succeeds_with_real_zrok_v2_json_output(mock_popen, mock_exists, tunnels_manager):
    """
    Regresi end-to-end: skenario PERSIS yang dilaporkan user -- share vhost VyloServe,
    zrok.exe v2 mencetak JSON, URL publik harus berhasil terdeteksi dan di-trim jadi
    https://<domain> (bukan gagal dengan 'url_not_found' seperti sebelum fix ini).
    """
    mock_exists.return_value = True
    mock_proc = MagicMock()
    mock_proc.stdout = iter([REAL_ZROK_V2_JSON_LINE])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    tunnels_manager.api = MagicMock()
    tunnels_manager.api.apache.get_http_port.return_value = 80
    tunnels_manager.api.project._read_projects.return_value = [{"id": "proj_1", "name": "laravel.test"}]

    res = tunnels_manager.start_zrok_share("proj_1")

    assert res['status'] == 'success'
    assert res['url'] == 'https://1yiutxunuio0.shares.zrok.io'
    # ServerAlias harus disuntik ke vhost Apache project ini dengan URL publik yang benar
    tunnels_manager.api.project.update_project.assert_called_once_with(
        {"id": "proj_1", "tunnel_url": "https://1yiutxunuio0.shares.zrok.io"}
    )

# ==========================================
# Enhancement: setiap tahap (instal -> enable -> share -> stop -> uninstall) WAJIB emit_log
# ==========================================

@patch('core.services.tunnels.os.path.exists', return_value=False)
def test_enable_zrok_logs_warning_when_not_installed(mock_exists, tunnels_manager):
    tunnels_manager.enable_zrok("sometoken")
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.not_installed", "warn", None)

@patch('core.services.tunnels.os.path.exists', return_value=True)
@patch('core.services.tunnels.run_silent_command')
def test_disable_zrok_logs_disabling_then_success(mock_run, mock_exists, tunnels_manager):
    mock_run.return_value = MagicMock(returncode=0, stderr="")
    res = tunnels_manager.disable_zrok()
    assert res['status'] == 'success'
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.disabling", "info", None)
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.disable_success", "success", None)

@patch('core.services.tunnels.os.path.exists', return_value=True)
@patch('core.services.tunnels.run_silent_command')
def test_disable_zrok_reports_real_failure_instead_of_always_success(mock_run, mock_exists, tunnels_manager):
    """Regresi: dulu SELALU return sukses tanpa cek returncode sama sekali."""
    mock_run.return_value = MagicMock(returncode=1, stderr="some real zrok error")
    res = tunnels_manager.disable_zrok()
    assert res['status'] == 'error'
    assert res['message'] == 'backend.zrok.disable_failed'
    tunnels_manager.api.emit_log.assert_any_call(
        "backend.zrok.disable_failed", "error", {"err": "some real zrok error"}
    )

def test_uninstall_zrok_logs_uninstalling_before_removing(tunnels_manager):
    with patch('core.services.tunnels.os.path.exists', return_value=False):
        tunnels_manager.uninstall_zrok()
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.uninstalling", "info", None)

@patch('core.services.tunnels.os.path.exists', return_value=True)
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_logs_resolved_target_and_vhost_sync(mock_popen, mock_exists, tunnels_manager):
    mock_proc = MagicMock()
    mock_proc.stdout = iter(["access your zrok share: https://abc.shares.zrok.io\n"])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    tunnels_manager.api = MagicMock()
    tunnels_manager.api.apache.get_http_port.return_value = 8080
    tunnels_manager.api.project._read_projects.return_value = [{"id": "proj_1", "name": "My Site"}]

    tunnels_manager.start_zrok_share("proj_1")

    tunnels_manager.api.emit_log.assert_any_call(
        "backend.zrok.resolved_target", "info", {"target": "http://127.0.0.1:8080"}
    )
    tunnels_manager.api.emit_log.assert_any_call(
        "backend.zrok.syncing_vhost", "info", {"url": "https://abc.shares.zrok.io"}
    )

def test_start_zrok_share_logs_project_not_found(tunnels_manager):
    tunnels_manager.api = MagicMock()
    tunnels_manager.api.project._read_projects.return_value = []
    with patch('core.services.tunnels.os.path.exists', return_value=True):
        res = tunnels_manager.start_zrok_share("missing_proj")
    assert res['status'] == 'error'
    tunnels_manager.api.emit_log.assert_any_call("backend.project.project_not_found", "error", None)

def test_stop_zrok_share_logs_share_not_found(tunnels_manager):
    res = tunnels_manager.stop_zrok_share("nonexistent")
    assert res['status'] == 'error'
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.share_not_found", "warn", None)

def test_stop_zrok_share_removes_apache_alias_for_project_target(tunnels_manager):
    """
    Regresi: untuk project_id yang BUKAN "localhost:port" (mis. id project VyloServe
    biasa), stop_zrok_share() sebelumnya menabrak NameError ("target" tidak pernah
    didefinisikan di method ini -- sisa copy-paste dari _resolve_share_target) yang diam-diam
    ditelan oleh except Exception, sehingga alias vhost Apache tidak pernah terhapus walau
    share sudah "berhasil" di-stop dan dihapus dari active_shares.
    """
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    tunnels_manager.active_shares["share_1"] = {"process": mock_proc, "project_id": "proj_a"}

    project = {"id": "proj_a", "name": "Proj A", "tunnel_url": "https://old.zrok.io"}
    tunnels_manager.api.project._read_projects.return_value = [project]

    res = tunnels_manager.stop_zrok_share("share_1")

    assert res == {"status": "success", "message": "backend.zrok.share_stopped"}
    assert "tunnel_url" not in project
    tunnels_manager.api.project._save_projects.assert_called_once_with([project])
    tunnels_manager.api.project.sync_apache_vhosts.assert_called_once()

import urllib.request
import json
import threading

# ==========================================
# install_zrok Tests
# ==========================================

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.os.remove')
@patch('core.services.tunnels.os.makedirs')
@patch('core.services.tunnels.urllib.request.urlopen')
@patch('core.services.tunnels.extract_archive')
@patch('glob.glob')
@patch('core.services.tunnels.os.rename')
@patch('builtins.open', new_callable=MagicMock)
def test_install_zrok_success(mock_open, mock_rename, mock_glob, mock_extract, mock_urlopen, mock_makedirs, mock_remove, mock_exists, tunnels_manager):
    # Setup mocks
    mock_exists.return_value = True
    
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps({
        "assets": [{"name": "zrok_windows_amd64.zip", "browser_download_url": "http://fake.url/zrok.zip"}]
    }).encode('utf-8')
    
    mock_bin_response = MagicMock()
    mock_bin_response.info.return_value.get.return_value = "100"
    mock_bin_response.read.side_effect = [b"1234567890", b""] # 10 bytes then EOF
    
    # Context manager returns
    mock_urlopen.return_value.__enter__.side_effect = [mock_json_response, mock_bin_response]
    
    mock_glob.return_value = ["fake_extracted_zrok.exe"]
    
    tunnels_manager.api = MagicMock()
    
    res = tunnels_manager.install_zrok("latest")
    
    assert res['status'] == 'success'
    tunnels_manager.api.emit_progress.assert_any_call(100, "backend.zrok.install_success", None)

@patch('core.services.tunnels.urllib.request.urlopen')
def test_install_zrok_release_not_found(mock_urlopen, tunnels_manager):
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps({"assets": []}).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_json_response
    
    res = tunnels_manager.install_zrok("v1.0.0")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.zrok.release_not_found'

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.os.makedirs')
@patch('core.services.tunnels.urllib.request.urlopen')
@patch('core.services.tunnels.extract_archive')
@patch('builtins.open', new_callable=MagicMock)
@patch('core.services.tunnels.os.remove')
def test_install_zrok_extract_fail(mock_remove, mock_open, mock_extract, mock_urlopen, mock_makedirs, mock_exists, tunnels_manager):
    mock_exists.return_value = False # Force binary not found at the end
    
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps({
        "assets": [{"name": "zrok_windows_amd64.tar.gz", "browser_download_url": "http://fake.url/zrok.tar.gz"}]
    }).encode('utf-8')
    
    mock_bin_response = MagicMock()
    mock_bin_response.info.return_value.get.return_value = "0"
    mock_bin_response.read.side_effect = [b""]
    
    mock_urlopen.return_value.__enter__.side_effect = [mock_json_response, mock_bin_response]
    
    res = tunnels_manager.install_zrok("latest")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.zrok.extract_failed'

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.os.makedirs')
@patch('core.services.tunnels.urllib.request.urlopen')
@patch('core.services.tunnels.extract_archive')
@patch('builtins.open', new_callable=MagicMock)
@patch('core.services.tunnels.os.remove')
@patch('glob.glob')
@patch('core.services.tunnels.os.rename')
@patch('core.services.tunnels.time.sleep')
def test_install_zrok_rename_retry_loop(mock_sleep, mock_rename, mock_glob, mock_remove, mock_open, mock_extract, mock_urlopen, mock_makedirs, mock_exists, tunnels_manager):
    mock_exists.side_effect = [False, False, False, False, True, True, True]
    
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps({
        "assets": [{"name": "zrok_windows_amd64.zip", "browser_download_url": "http://fake.url/zrok.zip"}]
    }).encode('utf-8')
    
    mock_bin_response = MagicMock()
    mock_bin_response.info.return_value.get.return_value = "0"
    mock_bin_response.read.side_effect = [b""]
    
    mock_urlopen.return_value.__enter__.side_effect = [mock_json_response, mock_bin_response]
    mock_glob.return_value = ["fake.exe"]
    
    # Raise exception first time, succeed second time
    mock_rename.side_effect = [OSError("Locked"), None]
    
    res = tunnels_manager.install_zrok("latest")
    assert res['status'] == 'success'
    mock_sleep.assert_called_once()
    assert mock_rename.call_count == 2

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.os.makedirs')
@patch('core.services.tunnels.urllib.request.urlopen')
@patch('core.services.tunnels.extract_archive')
@patch('builtins.open', new_callable=MagicMock)
@patch('core.services.tunnels.os.remove')
@patch('glob.glob')
@patch('core.services.tunnels.os.rename')
@patch('core.services.tunnels.time.sleep')
def test_install_zrok_rename_total_failure(mock_sleep, mock_rename, mock_glob, mock_remove, mock_open, mock_extract, mock_urlopen, mock_makedirs, mock_exists, tunnels_manager):
    mock_exists.return_value = False
    
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps({
        "assets": [{"name": "zrok_windows_amd64.zip", "browser_download_url": "http://fake.url/zrok.zip"}]
    }).encode('utf-8')
    
    mock_bin_response = MagicMock()
    mock_bin_response.info.return_value.get.return_value = "0"
    mock_bin_response.read.side_effect = [b""]
    
    mock_urlopen.return_value.__enter__.side_effect = [mock_json_response, mock_bin_response]
    mock_glob.return_value = ["fake.exe"]
    
    # Fail all 10 times
    mock_rename.side_effect = OSError("Locked")
    
    res = tunnels_manager.install_zrok("latest")
    assert res['status'] == 'error'
    assert mock_rename.call_count == 10
    assert mock_sleep.call_count == 10

@patch('core.services.tunnels.TunnelsManager._resolve_zrok_download_url')
def test_install_zrok_unexpected_error(mock_resolve, tunnels_manager):
    mock_resolve.side_effect = Exception("Network failure")
    res = tunnels_manager.install_zrok("latest")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'
    assert res['args']['e'] == 'Network failure'

# ==========================================
# enable_zrok Tests
# ==========================================

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_enable_zrok_success_with_logs(mock_run, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_run.return_value = MagicMock(returncode=0, stdout="[32mSuccess Token[0m", stderr="")
    
    tunnels_manager.api = MagicMock()
    res = tunnels_manager.enable_zrok("sometoken")
    
    assert res['status'] == 'success'
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.process_log", "info", {"msg": "Success Token"})
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.enable_success", "success", None)

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_enable_zrok_failure_with_logs(mock_run, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="[31mFailed to enable[0m")
    
    tunnels_manager.api = MagicMock()
    res = tunnels_manager.enable_zrok("sometoken")
    
    assert res['status'] == 'error'
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.enable_failed", "error", {"err": "Failed to enable"})

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_enable_zrok_unexpected_error(mock_run, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_run.side_effect = Exception("System crash")
    
    res = tunnels_manager.enable_zrok("sometoken")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'

# ==========================================
# Edge Cases & Daemon Threads
# ==========================================

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_zrok_share_unexpected_error(mock_popen, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_popen.side_effect = Exception("Popen failed")
    
    res = tunnels_manager.start_zrok_share("localhost:3000")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.run_silent_command')
def test_disable_zrok_unexpected_error(mock_run, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    mock_run.side_effect = Exception("Run failed")
    
    res = tunnels_manager.disable_zrok()
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'

def test_stop_zrok_share_unexpected_error(tunnels_manager):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.kill.side_effect = Exception("Kill failed")
    tunnels_manager.active_shares["share_123"] = {"process": mock_proc, "project_id": "localhost:3000"}
    
    res = tunnels_manager.stop_zrok_share("share_123")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
@patch('core.services.tunnels.threading.Thread')
@patch('queue.Queue.get')
def test_consume_stdout_thread(mock_queue_get, mock_thread, mock_popen, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        '{"level":"INFO","msg":"some json url"}\n'
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc
    
    mock_queue_get.side_effect = ["INFO: normal log\n", "ERROR: failed log\n", "WARN: some warn\n", " \n", None]
    
    def run_thread_sync(*args, **kwargs):
        target = kwargs.get('target')
        # Only run the consumer thread, ignore the reader thread
        if target and target.__name__ == 'consume_stdout':
            target()
        return MagicMock()
    
    mock_thread.side_effect = run_thread_sync
    tunnels_manager.api = MagicMock()
    
    tunnels_manager.start_zrok_share("localhost:3000")
    
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.process_log", "info", {"msg": "INFO: normal log"})
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.process_error", "error", {"msg": "ERROR: failed log"})
    tunnels_manager.api.emit_log.assert_any_call("backend.zrok.process_error", "error", {"msg": "WARN: some warn"})


# ==========================================
# CLOUDFLARE TESTS
# ==========================================

REAL_CLOUDFLARE_JSON_LINE = "INF |  https://random-words.trycloudflare.com                                                    |"

def test_extract_cloudflare_public_url_parses_real_log_line():
    url = TunnelsManager(MagicMock())._extract_cloudflare_public_url(REAL_CLOUDFLARE_JSON_LINE)
    assert url == "https://random-words.trycloudflare.com"

def test_extract_cloudflare_public_url_returns_none_for_unrelated_log_line():
    unrelated = "INF +--------------------------------------------------------------------------------------------+"
    assert TunnelsManager(MagicMock())._extract_cloudflare_public_url(unrelated) is None

@patch('core.services.tunnels.os.path.exists')
@patch('core.services.tunnels.subprocess.Popen')
def test_start_cloudflare_share_success(mock_popen, mock_exists, tunnels_manager):
    mock_exists.return_value = True
    
    mock_proc = MagicMock()
    mock_proc.stdout = iter([
        "INF |  https://random-words.trycloudflare.com  |\n"
    ])
    mock_proc.poll.return_value = None
    mock_popen.return_value = mock_proc

    tunnels_manager.api = MagicMock()

    res = tunnels_manager.start_cloudflare_share("localhost:3000")

    assert res['status'] == 'success'
    assert res['url'] == 'https://random-words.trycloudflare.com'

@patch('core.services.tunnels.urllib.request.urlopen')
def test_get_available_cloudflare_versions(mock_urlopen, tunnels_manager):
    mock_json_response = MagicMock()
    mock_json_response.read.return_value = json.dumps([
        {"tag_name": "2024.1.0", "name": "2024.1.0", "assets": [{"name": "cloudflared-windows-amd64.exe"}]}
    ]).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_json_response
    
    res = tunnels_manager.get_available_cloudflare_versions()
    assert res['status'] == 'success'
    assert len(res['data']) == 1
    assert res['data'][0]['id'] == "2024.1.0"
