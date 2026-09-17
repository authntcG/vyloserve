import pytest
import os
import re
from unittest.mock import patch, MagicMock, mock_open

from core.services.project import ProjectManager

@pytest.fixture
def project_manager(mock_api, tmp_path):
    with patch('core.services.project.get_project_root', return_value=str(tmp_path)):
        # Make a mock data_dir and json file so read_json doesn't fail
        data_dir = tmp_path / 'data'
        data_dir.mkdir(exist_ok=True)
        return ProjectManager(mock_api)

def test_determine_framework_package(project_manager):
    """Test framework determination for Composer."""
    # Laravel
    pkg, is_legacy = project_manager._determine_framework_package("laravel", "", "8.1.0")
    assert pkg == "laravel/laravel"
    assert is_legacy is False
    
    pkg, is_legacy = project_manager._determine_framework_package("laravel", "10.0.0", "8.1.0")
    assert pkg == "laravel/laravel:10.0.0"
    assert is_legacy is False

    # CodeIgniter Modern (PHP 8.1+)
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "", "8.1.0")
    assert pkg == "codeigniter4/appstarter"
    assert is_legacy is False

    # CodeIgniter Legacy (PHP 7.4)
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "", "7.4.3")
    assert pkg == "codeigniter/framework"
    assert is_legacy is True
    
    # Specific CI version
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "4.2.0", "7.4.3")
    assert pkg == "codeigniter4/appstarter:4.2.0"
    assert is_legacy is False

@patch('os.path.exists')
@patch('os.path.isdir')
def test_generate_vhost_block_smart_routing(mock_isdir, mock_exists, project_manager):
    """Test vhost block generation and smart routing to /public."""
    # We want to mock exists for the "public" dir check
    mock_exists.return_value = True
    mock_isdir.return_value = True
    
    # Mock finding the PHP port
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9005):
        # We don't want to actually save projects during the test
        with patch.object(project_manager, '_save_projects'):
            project = {
                "domain": "test.local",
                "path": "c:\\www\\test_project",
                "php_version": "8.1",
                "php_port": 9000
            }
            
            block = project_manager._generate_vhost_block(project, [project])
            
            # The docroot should be intelligently appended with /public
            assert 'DocumentRoot "c:/www/test_project/public"' in block
            assert '<Directory "c:/www/test_project/public">' in block
            assert 'ServerName test.local' in block
            
            # The port should be updated to what the system returned
            assert 'SetHandler "proxy:fcgi://127.0.0.1:9005/"' in block
            assert project['php_port'] == 9005

def test_generate_vhost_block_explicit_public(project_manager):
    """Test vhost block when path already ends in public."""
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9002):
        with patch.object(project_manager, '_save_projects'):
            project = {
                "domain": "test2.local",
                "path": "c:/www/test2/public",
                "php_version": "8.0",
                "php_port": 9002
            }

            block = project_manager._generate_vhost_block(project, [project])

            # Should not duplicate /public
            assert 'DocumentRoot "c:/www/test2/public"' in block
            assert '<Directory "c:/www/test2/public">' in block

def test_generate_vhost_block_adds_https_block_when_ssl_succeeds(project_manager):
    """
    Gap penting yang belum pernah tertest: saat self.api.ssl.generate_domain_cert()
    berhasil, blok <VirtualHost *:443> HARUS ikut ditambahkan berisi path cert/key.
    """
    project_manager.api.ssl.generate_domain_cert = MagicMock(return_value=("C:\\certs\\a.crt", "C:\\certs\\a.key"))
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9000):
        with patch.object(project_manager, '_save_projects'):
            project = {"domain": "secure.local", "path": "c:/www/secure/public", "php_version": "8.1", "php_port": 9000}
            block = project_manager._generate_vhost_block(project, [project])

    assert '<VirtualHost *:443>' in block
    assert 'SSLEngine on' in block
    assert 'SSLCertificateFile "C:/certs/a.crt"' in block
    assert 'SSLCertificateKeyFile "C:/certs/a.key"' in block
    project_manager.api.ssl.generate_domain_cert.assert_called_once_with("secure.local")

def test_generate_vhost_block_skips_https_block_when_ssl_fails(project_manager):
    """Jika generate_domain_cert() gagal (mis. Apache belum terinstal), harus silent-downgrade ke HTTP-only."""
    project_manager.api.ssl.generate_domain_cert = MagicMock(side_effect=RuntimeError("Apache belum terinstal"))
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9000):
        with patch.object(project_manager, '_save_projects'):
            project = {"domain": "insecure.local", "path": "c:/www/insecure/public", "php_version": "8.1", "php_port": 9000}
            block = project_manager._generate_vhost_block(project, [project])

    assert '<VirtualHost *:80>' in block
    assert '<VirtualHost *:443>' not in block

@patch('core.services.project.read_json')
@patch('core.services.project.write_json')
@patch('core.services.project.os.makedirs')
@patch('core.services.project.os.path.exists')
def test_create_project(mock_exists, mock_makedirs, mock_write_json, mock_read_json, project_manager):
    # Mock that the domain doesn't exist yet
    mock_read_json.return_value = []
    mock_exists.return_value = False
    
    with patch.object(project_manager, '_install_new_framework', return_value={"status": "success", "document_root": "c:/www/newproject"}):
        with patch.object(project_manager, 'sync_apache_vhosts'):
            with patch.object(project_manager, 'sync_windows_hosts'):
                payload = {
                    "domain": "newproject",
                    "domain_extension": ".local",
                    "framework": "laravel",
                    "php_version": "8.1.0",
                    "path": "c:/www/newproject"
                }
                res = project_manager.create_project(payload)
                assert res['status'] == 'success'
                mock_write_json.assert_called_once()

@patch('core.services.project.read_json')
def test_get_projects(mock_read_json, project_manager):
    mock_read_json.return_value = [{"id": "1", "domain": "test.local", "framework": "laravel"}]
    res = project_manager.get_projects()
    assert res['status'] == 'success'
    assert len(res['data']) == 1

@patch('core.services.project.read_json')
@patch('core.services.project.write_json')
@patch('shutil.rmtree')
@patch('core.services.project.os.path.exists', return_value=True)
def test_delete_project(mock_exists, mock_rmtree, mock_write_json, mock_read_json, project_manager):
    mock_read_json.return_value = [{"id": "1", "domain": "test.local", "path": "c:/www/test"}]
    
    with patch.object(project_manager, 'sync_apache_vhosts'):
        with patch.object(project_manager, 'sync_windows_hosts'):
            res = project_manager.delete_project("1", delete_files=True)
            assert res['status'] == 'success'
            mock_rmtree.assert_called_once_with("c:/www/test", ignore_errors=True)
            mock_write_json.assert_called_once()

@patch('core.services.project.read_json')
@patch('core.services.project.write_json')
def test_update_project(mock_write_json, mock_read_json, project_manager):
    mock_read_json.return_value = [{"id": "1", "name": "old", "php_version": "8.0"}]
    
    with patch.object(project_manager, 'sync_apache_vhosts'):
        with patch.object(project_manager, 'sync_windows_hosts'):
            with patch.object(project_manager, '_get_php_port_from_system', return_value=9000):
                res = project_manager.update_project({"id": "1", "name": "new", "php_version": "8.1.0"})
                assert res['status'] == 'success'
                mock_write_json.assert_called_once()
                # Verify updated data in mock_write_json call
                written_data = mock_write_json.call_args[0][1]
                assert written_data[0]["name"] == "new"

@patch('core.services.project.read_json')
@patch('builtins.open', new_callable=MagicMock)
def test_sync_apache_vhosts(mock_open, mock_read_json, project_manager):
    mock_read_json.return_value = [{"id": "1", "domain": "test.local", "path": "c:/www/test"}]
    
    mock_file = MagicMock()
    mock_open.return_value.__enter__.return_value = mock_file
    
    # We need to mock Apache Manager so we don't crash reading HTTPD port
    project_manager.api.apache = MagicMock()
    project_manager.api.apache.get_status.return_value = {"installed": True, "path": "apache_path"}
    
    with patch.object(project_manager, '_generate_vhost_block', return_value="<VirtualHost>\n</VirtualHost>"):
        with patch('core.services.project.os.makedirs') as mock_makedirs:
            project_manager.sync_apache_vhosts()
            written = "".join(c.args[0] for c in mock_file.write.call_args_list)
            assert "<VirtualHost>" in written

            # Regression test (docs/known_bugs.md #3): vhost HARUS ditulis ke folder
            # 'conf/extra', bukan 'con/extra' (typo yang sempat lolos ke production
            # karena test versi lama ini tidak memvalidasi path sama sekali).
            extra_dir_arg = mock_makedirs.call_args[0][0]
            assert extra_dir_arg == os.path.join('apache_path', 'conf', 'extra')

            vhosts_file_arg = mock_open.call_args[0][0]
            assert vhosts_file_arg == os.path.join('apache_path', 'conf', 'extra', 'vyloserve-vhosts.conf')

@patch('shutil.rmtree')
@patch('os.path.exists', return_value=True)
def test_rollback_dir_removes_directory_and_reports_progress(mock_exists, mock_rmtree, project_manager):
    """
    _rollback_dir() sebelumnya memanggil window.evaluate_js() manual, sekarang harus
    memakai self._progress() (-> api.emit_progress) yang aman & konsisten dengan
    mekanisme 'source' auto-detect (docs/known_bugs.md #7).
    """
    project_manager._rollback_dir("C:\\target_dir")

    mock_rmtree.assert_called_once_with("C:\\target_dir", ignore_errors=True)
    project_manager.api.emit_progress.assert_called_once_with(100, "Melakukan rollback instalasi...")

@patch('os.path.exists', return_value=False)
def test_rollback_dir_noop_when_directory_missing(mock_exists, project_manager):
    """Tidak boleh ada progress/log/rmtree jika direktori memang tidak pernah dibuat."""
    with patch('shutil.rmtree') as mock_rmtree:
        project_manager._rollback_dir("C:\\never_existed")
        mock_rmtree.assert_not_called()
        project_manager.api.emit_progress.assert_not_called()

def test_stream_composer_output_reports_progress_per_line(project_manager):
    """
    Regression test: _stream_composer_output() sebelumnya membangun string JS
    manual (escaping quote/newline sendiri) lalu memanggil window.evaluate_js()
    langsung. Sekarang harus memakai self._progress() (JSON-safe, otomatis
    mendapat field 'source') untuk setiap baris output Composer yang tidak kosong.
    """
    fake_process = MagicMock()
    fake_process.stdout = [
        "Downloading package one\n",
        "\x1b[32mInstalling deps\x1b[0m\n",
        "\n",  # baris kosong setelah strip -> tidak boleh memicu progress
    ]
    ansi_escape = re.compile(r'\x1b\[[0-9;]*m')

    final_percent, error_log = project_manager._stream_composer_output(
        fake_process, current_percent=10.0, max_percent=60.0, prefix="Composer", ansi_escape=ansi_escape
    )

    assert final_percent == 11.0  # 2 baris non-kosong x +0.5
    assert "Downloading package one" in error_log
    assert "Installing deps" in error_log  # kode ANSI berhasil dibersihkan
    assert project_manager.api.emit_progress.call_count == 2
    last_call_args = project_manager.api.emit_progress.call_args[0]
    assert last_call_args[1].startswith("Composer: ")

@patch('os.makedirs')
@patch('urllib.request.urlretrieve')
@patch('os.path.exists', return_value=False)
def test_ensure_composer_exists(mock_exists, mock_dl, mock_makedirs, project_manager):
    res = project_manager._ensure_composer_exists()
    assert res is not None
    assert mock_dl.call_count == 1
    
@patch('os.makedirs')
@patch('os.path.exists', return_value=True)
def test_ensure_composer_exists_already(mock_exists, mock_makedirs, project_manager):
    res = project_manager._ensure_composer_exists()
    assert res is not None

@patch('os.makedirs')
@patch('urllib.request.urlretrieve')
@patch('zipfile.ZipFile')
def test_install_wordpress(mock_zip, mock_dl, mock_makedirs, project_manager):
    mock_zip_instance = MagicMock()
    mock_zip_instance.namelist.return_value = ["wordpress/", "wordpress/index.php"]
    mock_zip.return_value.__enter__.return_value = mock_zip_instance
    
    with patch('os.listdir', return_value=['index.php']):
        with patch('shutil.move') as mock_move:
            with patch('os.rmdir') as mock_rm:
                with patch('os.remove') as mock_remove_zip:
                    with patch('os.path.exists', side_effect=lambda path: "wordpress" in path or "latest.zip" in path):
                        res = project_manager._install_wordpress("C:\\wp_dir")
                        assert res['status'] == 'success'
                        mock_dl.assert_called_once()
                        mock_move.assert_called_once()
                        mock_rm.assert_called_once()
                        mock_remove_zip.assert_called_once()

@patch('os.makedirs')
def test_install_raw_project(mock_makedirs, project_manager):
    import unittest
    with patch('builtins.open', unittest.mock.mock_open()) as mock_file:
        res = project_manager._install_raw_project("C:\\raw_dir")
        assert res['status'] == 'success'
        mock_file().write.assert_called_once()

@patch('os.listdir', return_value=["composer.json", "artisan"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_laravel(mock_isdir, mock_listdir, project_manager):
    res = project_manager.detect_framework("C:\\test_dir")
    assert res == 'laravel'

@patch('os.listdir', return_value=["wp-admin", "wp-config-sample.php"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_wordpress(mock_isdir, mock_listdir, project_manager):
    res = project_manager.detect_framework("C:\\test_dir")
    assert res == 'wordpress'

@patch('os.listdir', return_value=["index.php"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_raw(mock_isdir, mock_listdir, project_manager):
    res = project_manager.detect_framework("C:\\test_dir")
    assert res == 'raw'

@patch('core.services.project.ProjectManager._ensure_composer_exists', return_value="C:\\composer.phar")
@patch('core.services.project.ProjectManager._determine_framework_package', return_value=("laravel/laravel", False))
@patch('core.services.project.ProjectManager._run_composer_create_project', return_value=(True, ""))
@patch('core.services.project.ProjectManager._run_composer_update_with_retries', return_value=True)
@patch('core.services.project.ProjectManager._run_framework_post_install')
@patch('core.services.project.subprocess.run')
def test_install_composer_framework(mock_run, mock_post, mock_update, mock_create, mock_det, mock_ens, project_manager):
    res = project_manager._install_composer_framework("laravel", "C:\\test_dir", "8.1.10", "", "C:\\php.exe")
    assert res['status'] == 'success'
    mock_create.assert_called_once()
    mock_update.assert_called_once()
    mock_post.assert_called_once()
    
@patch('core.services.project.ProjectManager._ensure_composer_exists', return_value=None)
def test_install_composer_framework_no_composer(mock_ens, project_manager):
    res = project_manager._install_composer_framework("laravel", "C:\\test_dir", "8.1.10", "", "C:\\php.exe")
    assert res['status'] == 'error'
    assert 'Composer gagal disiapkan' in res['message']

@patch('core.services.project.subprocess.Popen')
@patch('core.services.project.ProjectManager._stream_composer_output', return_value=(60.0, ""))
def test_run_composer_create_project(mock_stream, mock_popen, project_manager):
    import re
    mock_process = MagicMock()
    mock_process.returncode = 0
    mock_popen.return_value = mock_process
    
    with patch('os.path.exists', return_value=True):
        with patch('shutil.rmtree') as mock_rm:
            success, log = project_manager._run_composer_create_project("php.exe", "php.ini", "composer.phar", "package", "C:\\target", {}, 0, 40.0, re.compile(r''))
            assert success is True
            mock_rm.assert_called_once()
            mock_popen.assert_called_once()
            mock_process.wait.assert_called_once()

@patch('core.services.project.subprocess.Popen')
@patch('core.services.project.ProjectManager._stream_composer_output', return_value=(95.0, ""))
def test_run_composer_update_with_retries(mock_stream, mock_popen, project_manager):
    import re
    mock_process = MagicMock()
    # Succeed on first try
    mock_process.returncode = 0
    mock_popen.return_value = mock_process
    
    with patch('os.path.exists', return_value=True):
        with patch('os.remove') as mock_remove:
            res = project_manager._run_composer_update_with_retries("php.exe", "php.ini", "composer.phar", "C:\\target", {}, 0, 60.0, re.compile(r''))
            assert res is True
            mock_remove.assert_called_once()
            
    # Fail 3 times
    mock_process.returncode = 1
    with patch('time.sleep'):
        res = project_manager._run_composer_update_with_retries("php.exe", "php.ini", "composer.phar", "C:\\target", {}, 0, 60.0, re.compile(r''))
        assert res is False
        assert mock_popen.call_count == 4 # 1 from previous, 3 from here

# ==========================================
# _install_new_framework — dispatch per jenis framework
# ==========================================

@patch('os.path.exists', return_value=True)
def test_install_new_framework_dispatches_to_composer(mock_exists, project_manager):
    payload = {"framework": "laravel", "install_location": "C:\\www", "domain": "app.local", "php_version": "8.1"}
    with patch.object(project_manager, '_install_composer_framework', return_value={"status": "success"}) as mock_composer:
        res = project_manager._install_new_framework(payload)

    assert res['status'] == 'success'
    mock_composer.assert_called_once()
    call_args = mock_composer.call_args[0]
    assert call_args[0] == 'laravel'
    assert call_args[2] == '8.1'

@patch('os.path.exists', return_value=True)
def test_install_new_framework_dispatches_to_wordpress(mock_exists, project_manager):
    payload = {"framework": "wordpress", "install_location": "C:\\www", "domain": "blog.local", "php_version": "8.1"}
    with patch.object(project_manager, '_install_wordpress', return_value={"status": "success"}) as mock_wp:
        project_manager._install_new_framework(payload)
    mock_wp.assert_called_once_with(os.path.join("C:\\www", "blog"))

@patch('os.path.exists', return_value=True)
def test_install_new_framework_dispatches_to_raw(mock_exists, project_manager):
    payload = {"framework": "raw", "install_location": "C:\\www", "domain": "site.local", "php_version": "8.1"}
    with patch.object(project_manager, '_install_raw_project', return_value={"status": "success"}) as mock_raw:
        project_manager._install_new_framework(payload)
    mock_raw.assert_called_once_with(os.path.join("C:\\www", "site"))

@patch('os.path.exists', return_value=False)
def test_install_new_framework_php_exe_missing_returns_error(mock_exists, project_manager):
    """Guard penting: jangan sampai lanjut menginstal framework jika PHP versi terkait belum terinstal."""
    payload = {"framework": "laravel", "install_location": "C:\\www", "domain": "app.local", "php_version": "9.9"}
    res = project_manager._install_new_framework(payload)
    assert res['status'] == 'error'
    assert '9.9' in res['message']

# ==========================================
# _run_framework_post_install — Laravel & CodeIgniter
# ==========================================

def test_run_framework_post_install_laravel_generates_env_and_runs_artisan(project_manager):
    target_dir = "C:\\target"
    env_example = os.path.join(target_dir, '.env.example')
    dotenv = os.path.join(target_dir, '.env')

    with patch('os.path.exists', side_effect=lambda p: p == env_example):
        with patch('shutil.copy') as mock_copy:
            with patch('subprocess.run') as mock_run:
                project_manager._run_framework_post_install(
                    "laravel", target_dir, "php.exe", "php.ini", {}, 0, is_ci3=False
                )

    mock_copy.assert_called_once_with(env_example, dotenv)
    mock_run.assert_called_once()
    assert mock_run.call_args[0][0] == ["php.exe", "-c", "php.ini", "artisan", "key:generate"]

def test_run_framework_post_install_laravel_skips_copy_when_env_already_exists(project_manager):
    with patch('os.path.exists', return_value=True):  # .env sudah ada -> tidak boleh ditimpa
        with patch('shutil.copy') as mock_copy:
            with patch('subprocess.run'):
                project_manager._run_framework_post_install(
                    "laravel", "C:\\target", "php.exe", "php.ini", {}, 0, is_ci3=False
                )
    mock_copy.assert_not_called()

def test_run_framework_post_install_codeigniter_sets_development_environment(project_manager):
    target_dir = "C:\\target"
    env_path = os.path.join(target_dir, 'env')
    dotenv_path = os.path.join(target_dir, '.env')

    with patch('os.path.exists', side_effect=lambda p: p == env_path):
        with patch('shutil.copy') as mock_copy:
            m = mock_open(read_data="# CI_ENVIRONMENT = production\nOTHER=value\n")
            with patch('builtins.open', m):
                project_manager._run_framework_post_install(
                    "codeigniter", target_dir, "php.exe", "php.ini", {}, 0, is_ci3=False
                )

    mock_copy.assert_called_once_with(env_path, dotenv_path)
    written = "".join(c.args[0] for c in m().write.call_args_list)
    assert "CI_ENVIRONMENT = development" in written
    assert "# CI_ENVIRONMENT = production" not in written

def test_run_framework_post_install_codeigniter3_does_nothing(project_manager):
    """CI3 (is_ci3=True) tidak punya file .env sama sekali -> tidak boleh ada aksi copy/tulis apapun."""
    with patch('os.path.exists', return_value=True) as mock_exists:
        with patch('shutil.copy') as mock_copy:
            project_manager._run_framework_post_install(
                "codeigniter", "C:\\target", "php.exe", "php.ini", {}, 0, is_ci3=True
            )
    mock_copy.assert_not_called()

# ==========================================
# open_in_explorer
# ==========================================

@patch('os.startfile')
@patch('os.path.exists', return_value=True)
def test_open_in_explorer_success(mock_exists, mock_startfile, project_manager):
    res = project_manager.open_in_explorer("C:/www/project")
    assert res == {"status": "success"}
    mock_startfile.assert_called_once()

@patch('os.path.exists', return_value=False)
def test_open_in_explorer_directory_not_found(mock_exists, project_manager):
    res = project_manager.open_in_explorer("C:/does/not/exist")
    assert res['status'] == 'error'
    assert res['message'] == 'Direktori tidak ditemukan.'

@patch('os.path.normpath', side_effect=RuntimeError("bad path"))
def test_open_in_explorer_handles_unexpected_exception(mock_normpath, project_manager):
    res = project_manager.open_in_explorer("C:/whatever")
    assert res == {"status": "error", "message": "bad path"}

# ==========================================
# _get_php_port_from_system — error path
# ==========================================

def test_get_php_port_from_system_returns_default_on_bridge_exception(project_manager):
    """Jika pemanggilan ke Api.get_installed_php() gagal, harus fallback ke port default 9000, bukan crash."""
    project_manager.api.get_installed_php = MagicMock(side_effect=RuntimeError("bridge down"))
    port = project_manager._get_php_port_from_system("8.1")
    assert port == 9000
    project_manager.api.emit_log.assert_called_once()

# ==========================================
# _ensure_composer_exists — error path
# ==========================================

@patch('os.makedirs')
@patch('os.path.exists', return_value=False)
@patch('urllib.request.urlretrieve', side_effect=OSError("network down"))
def test_ensure_composer_exists_download_failure_returns_none(mock_urlretrieve, mock_exists, mock_makedirs, project_manager):
    res = project_manager._ensure_composer_exists()
    assert res is None

# ==========================================
# create_project — cabang tambahan
# ==========================================

@patch('core.services.project.read_json')
def test_create_project_domain_already_used(mock_read_json, project_manager):
    mock_read_json.return_value = [{"domain": "app.local"}]
    res = project_manager.create_project({"domain": "app", "domain_extension": ".local"})
    assert res['status'] == 'error'
    assert 'sudah digunakan' in res['message']

@patch('core.services.project.read_json', return_value=[])
def test_create_project_propagates_framework_install_error(mock_read_json, project_manager):
    with patch.object(project_manager, '_install_new_framework', return_value={"status": "error", "message": "gagal install"}):
        res = project_manager.create_project({"domain": "app", "domain_extension": ".local", "framework": "laravel"})
    assert res == {"status": "error", "message": "gagal install"}

@patch('core.services.project.read_json', side_effect=RuntimeError("disk corrupt"))
def test_create_project_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.create_project({"domain": "app", "domain_extension": ".local"})
    assert res['status'] == 'error'
    assert res['message'] == 'disk corrupt'
    project_manager.api.emit_log.assert_called_once()

# ==========================================
# delete_project — rollback & error path
# ==========================================

@patch('core.services.project.write_json')
@patch('core.services.project.read_json')
def test_delete_project_rolls_back_when_uac_denied(mock_read_json, mock_write_json, project_manager):
    original_projects = [{"id": "1", "domain": "test.local", "path": "c:/www/test"}]
    mock_read_json.return_value = original_projects
    with patch.object(project_manager, 'sync_windows_hosts', return_value={"status": "error", "message": "uac_denied"}):
        res = project_manager.delete_project("1")

    assert res == {"status": "error", "message": "backend.project.cancelled_uac_denied"}
    # write_json dipanggil 2x: sekali hapus project, sekali rollback mengembalikan project semula
    assert mock_write_json.call_count == 2
    rollback_data = mock_write_json.call_args_list[-1][0][1]
    assert rollback_data == original_projects

@patch('core.services.project.read_json', side_effect=RuntimeError("disk error"))
def test_delete_project_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.delete_project("1")
    assert res == {"status": "error", "message": "disk error"}

# ==========================================
# update_project — cabang tambahan
# ==========================================

@patch('core.services.project.read_json', return_value=[])
def test_update_project_not_found(mock_read_json, project_manager):
    res = project_manager.update_project({"id": "missing"})
    assert res['status'] == 'error'
    assert res['message'] == 'Proyek tidak ditemukan.'

@patch('core.services.project.read_json', side_effect=RuntimeError("disk error"))
def test_update_project_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.update_project({"id": "1", "name": "x"})
    assert res == {"status": "error", "message": "disk error"}

# ==========================================
# Cabang & error-path tersisa (menutup gap kecil menuju coverage tinggi)
# ==========================================

def test_get_php_port_from_system_returns_matching_port(project_manager):
    """Happy path: versi PHP ditemukan di daftar instance aktif -> return port aslinya."""
    project_manager.api.get_installed_php = MagicMock(return_value={
        "data": [{"version": "8.1", "port": 9010}, {"version": "8.2", "port": 9020}]
    })
    port = project_manager._get_php_port_from_system("8.2")
    assert port == 9020

def test_determine_framework_package_unknown_framework_returns_empty(project_manager):
    pkg, is_legacy = project_manager._determine_framework_package("django", "", "8.1")
    assert pkg == ""
    assert is_legacy is False

@patch('os.makedirs')
@patch('urllib.request.urlretrieve', side_effect=OSError("network down"))
def test_install_wordpress_download_failure_rolls_back(mock_urlretrieve, mock_makedirs, project_manager):
    with patch.object(project_manager, '_rollback_dir') as mock_rollback:
        res = project_manager._install_wordpress("C:\\wp_dir")
    assert res['status'] == 'error'
    assert 'Gagal menginstal WordPress' in res['message']
    mock_rollback.assert_called_once_with("C:\\wp_dir")

@patch('os.makedirs')
def test_install_raw_project_write_failure_rolls_back(mock_makedirs, project_manager):
    with patch('builtins.open', side_effect=OSError("disk full")):
        with patch.object(project_manager, '_rollback_dir') as mock_rollback:
            res = project_manager._install_raw_project("C:\\raw_dir")
    assert res['status'] == 'error'
    assert 'Gagal membuat proyek Raw' in res['message']
    mock_rollback.assert_called_once_with("C:\\raw_dir")

@patch('core.services.project.ProjectManager._ensure_composer_exists', return_value="C:\\composer.phar")
@patch('core.services.project.ProjectManager._determine_framework_package', return_value=("laravel/laravel", False))
@patch('core.services.project.ProjectManager._run_composer_create_project', return_value=(False, "composer error output"))
@patch('core.services.project.subprocess.run')
def test_install_composer_framework_rollback_on_create_project_failure(mock_run, mock_create, mock_det, mock_ens, project_manager):
    with patch.object(project_manager, '_rollback_dir') as mock_rollback:
        res = project_manager._install_composer_framework("laravel", "C:\\test_dir", "8.1.10", "", "C:\\php.exe")
    assert res['status'] == 'error'
    assert 'composer error output' in res['message']
    mock_rollback.assert_called_once_with("C:\\test_dir")

@patch('core.services.project.ProjectManager._ensure_composer_exists', return_value="C:\\composer.phar")
@patch('core.services.project.ProjectManager._determine_framework_package', return_value=("laravel/laravel", False))
@patch('core.services.project.ProjectManager._run_composer_create_project', return_value=(True, ""))
@patch('core.services.project.ProjectManager._run_composer_update_with_retries', return_value=False)
@patch('core.services.project.subprocess.run')
def test_install_composer_framework_rollback_on_update_failure(mock_run, mock_update, mock_create, mock_det, mock_ens, project_manager):
    with patch.object(project_manager, '_rollback_dir') as mock_rollback:
        res = project_manager._install_composer_framework("laravel", "C:\\test_dir", "8.1.10", "", "C:\\php.exe")
    assert res['status'] == 'error'
    assert 'Antivirus' in res['message']
    mock_rollback.assert_called_once_with("C:\\test_dir")

@patch('core.services.project.read_json', return_value=[])
def test_create_project_existing_project_uses_provided_document_root(mock_read_json, project_manager):
    """Saat is_existing=True (link folder yang sudah ada), tidak boleh memicu scaffold framework sama sekali."""
    with patch.object(project_manager, '_install_new_framework') as mock_install:
        with patch.object(project_manager, '_save_projects'):
            with patch.object(project_manager, 'sync_apache_vhosts'):
                with patch.object(project_manager, '_sync_hosts_for_project', return_value=None):
                    res = project_manager.create_project({
                        "domain": "existing", "domain_extension": ".local",
                        "is_existing": True, "document_root": "C:/www/existing/public",
                    })
    assert res['status'] == 'success'
    mock_install.assert_not_called()

def test_sync_apache_vhosts_handles_unexpected_exception(project_manager):
    with patch('core.services.project.read_json', side_effect=RuntimeError("json corrupt")):
        project_manager.api.apache = MagicMock()
        res = project_manager.sync_apache_vhosts()
    assert res == {"status": "error", "message": "json corrupt"}

@patch('core.services.project.read_json', side_effect=RuntimeError("json corrupt"))
def test_get_projects_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.get_projects()
    assert res == {"status": "error", "message": "json corrupt"}

def test_retry_sync_host_handles_unexpected_exception(project_manager):
    with patch.object(project_manager, 'sync_windows_hosts', side_effect=RuntimeError("unexpected")):
        res = project_manager.retry_sync_host("p1")
    assert res == {"status": "error", "message": "unexpected"}
