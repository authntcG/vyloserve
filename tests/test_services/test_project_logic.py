import pytest
import os
import re
from unittest.mock import patch, MagicMock, mock_open, ANY

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
    project_manager.api.emit_progress.assert_called_once_with(100, "backend.project.rolling_back", None)

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
        fake_process, current_percent=10.0, max_percent=60.0, msg_key="backend.project.composer_create_project", ansi_escape=ansi_escape
    )

    assert final_percent == 11.0  # 2 baris non-kosong x +0.5
    assert "Downloading package one" in error_log
    assert "Installing deps" in error_log  # kode ANSI berhasil dibersihkan
    assert project_manager.api.emit_progress.call_count == 2
    last_call_args = project_manager.api.emit_progress.call_args[0]
    assert last_call_args[1] == "backend.project.composer_create_project"
    assert last_call_args[2]["line"].startswith("Installing deps")

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

@patch('core.services.project.read_json', return_value={"require": {"laravel/framework": "^10.0"}})
@patch('os.listdir', return_value=["composer.json", "artisan"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_laravel(mock_isdir, mock_listdir, mock_read_json, project_manager):
    res = project_manager.detect_framework("C:\\test_dir")
    assert res == 'laravel'

@patch('core.services.project.read_json', return_value={"require": {"codeigniter4/framework": "^4.4"}})
@patch('os.listdir', return_value=["spark", "public"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_codeigniter(mock_isdir, mock_listdir, mock_read_json, project_manager):
    res = project_manager.detect_framework("C:\\test_dir")
    assert res == 'codeigniter'

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

@patch('core.services.project.read_json', return_value={"require": {"zendframework/zend-mvc": "^3.0"}})
@patch('os.listdir', return_value=["composer.json", "artisan", "public"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_custom_zend_project_with_artisan_script_is_not_laravel(mock_isdir, mock_listdir, mock_read_json, project_manager):
    """
    Regresi: project custom berbasis Zend yang dimodifikasi bisa saja punya file
    bernama "artisan" (skrip CLI custom, bukan dari Laravel) DAN "composer.json" --
    sebelumnya dua hal itu saja cukup untuk salah dideteksi sebagai "laravel", yang
    lalu memicu NewProject.tsx menambahkan "/public" ke document root secara keliru.
    Karena composer.json project ini TIDAK mendaftarkan "laravel/framework", deteksi
    sekarang harus jatuh ke "raw", bukan "laravel".
    """
    res = project_manager.detect_framework("D:\\Projects\\TLKM\\PHP\\utonline")
    assert res == 'raw'

@patch('core.services.project.read_json', return_value={"require": {"php": "^8.1"}})
@patch('os.listdir', return_value=["composer.json", "artisan"])
@patch('os.path.isdir', return_value=True)
def test_detect_framework_raw_project_with_coincidental_artisan_file_is_not_laravel(mock_isdir, mock_listdir, mock_read_json, project_manager):
    """Regresi serupa: project raw apa pun yang kebetulan punya file "artisan" + composer.json
    tanpa dependency laravel/framework tidak boleh dianggap Laravel."""
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
    assert res['message'] == 'backend.project.composer_failed'

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
    assert res['message'] == 'backend.project.php_exe_not_found'
    assert res['args']['php_version'] == '9.9'

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
    assert res['message'] == 'backend.project.dir_not_found'

@patch('os.path.normpath', side_effect=RuntimeError("bad path"))
def test_open_in_explorer_handles_unexpected_exception(mock_normpath, project_manager):
    res = project_manager.open_in_explorer("C:/whatever")
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "bad path"}}

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
    assert res['message'] == 'backend.project.domain_used'
    assert res['args']['domain'] == 'app.local'

@patch('core.services.project.read_json', return_value=[])
def test_create_project_propagates_framework_install_error(mock_read_json, project_manager):
    with patch.object(project_manager, '_install_new_framework', return_value={"status": "error", "message": "gagal install"}):
        res = project_manager.create_project({"domain": "app", "domain_extension": ".local", "framework": "laravel"})
    assert res == {"status": "error", "message": "gagal install"}

@patch('core.services.project.read_json', side_effect=RuntimeError("disk corrupt"))
def test_create_project_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.create_project({"domain": "app", "domain_extension": ".local"})
    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'
    assert res['args']['e'] == 'disk corrupt'
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
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "disk error"}}

# ==========================================
# update_project — cabang tambahan
# ==========================================

@patch('core.services.project.read_json', return_value=[])
def test_update_project_not_found(mock_read_json, project_manager):
    res = project_manager.update_project({"id": "missing"})
    assert res['status'] == 'error'
    assert res['message'] == 'backend.project.project_not_found'

@patch('core.services.project.read_json', side_effect=RuntimeError("disk error"))
def test_update_project_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.update_project({"id": "1", "name": "x"})
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "disk error"}}

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
    assert res['message'] == 'backend.project.wp_install_failed'
    mock_rollback.assert_called_once_with("C:\\wp_dir")

@patch('os.makedirs')
def test_install_raw_project_write_failure_rolls_back(mock_makedirs, project_manager):
    with patch('builtins.open', side_effect=OSError("disk full")):
        with patch.object(project_manager, '_rollback_dir') as mock_rollback:
            res = project_manager._install_raw_project("C:\\raw_dir")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.project.raw_php_failed'
    mock_rollback.assert_called_once_with("C:\\raw_dir")

@patch('core.services.project.ProjectManager._ensure_composer_exists', return_value="C:\\composer.phar")
@patch('core.services.project.ProjectManager._determine_framework_package', return_value=("laravel/laravel", False))
@patch('core.services.project.ProjectManager._run_composer_create_project', return_value=(False, "composer error output"))
@patch('core.services.project.subprocess.run')
def test_install_composer_framework_rollback_on_create_project_failure(mock_run, mock_create, mock_det, mock_ens, project_manager):
    with patch.object(project_manager, '_rollback_dir') as mock_rollback:
        res = project_manager._install_composer_framework("laravel", "C:\\test_dir", "8.1.10", "", "C:\\php.exe")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.project.framework_download_failed'
    assert 'composer error output' in res['args']['error']
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
    assert res['message'] == 'backend.project.dependency_failed'
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
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "json corrupt"}}

@patch('core.services.project.read_json', side_effect=RuntimeError("json corrupt"))
def test_get_projects_handles_unexpected_exception(mock_read_json, project_manager):
    res = project_manager.get_projects()
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "json corrupt"}}

def test_retry_sync_host_handles_unexpected_exception(project_manager):
    with patch.object(project_manager, 'sync_windows_hosts', side_effect=RuntimeError("unexpected")):
        res = project_manager.retry_sync_host("p1")
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "unexpected"}}


# ==========================================
# Multi-Runtime Pretty URL & Reverse Proxy Tests
# ==========================================

def test_get_project_runtimes_info_aggregates_php_and_runtimes(project_manager):
    project_manager.api.get_installed_php = MagicMock(return_value=[{"version": "8.3"}, {"version": "8.2"}])
    project_manager.api.runtimes_manager = MagicMock()
    project_manager.api.runtimes_manager.get_node_status.return_value = {"installed": True, "in_path": True, "version": "v20.11.0", "external": {"exists": False}}
    project_manager.api.runtimes_manager.get_python_status.return_value = {"installed": False, "version": "", "external": {"exists": True, "version": "Python 3.12.2"}}
    project_manager.api.runtimes_manager.get_go_status.return_value = {"installed": False, "version": "", "external": {"exists": False}}
    project_manager.api.runtimes_manager.get_java_status.return_value = {"installed": True, "in_path": False, "version": 'openjdk version "21.0.2"', "external": {"exists": False}}

    res = project_manager.get_project_runtimes_info()
    assert res["status"] == "success"
    assert res["data"]["php"]["installed"] is True
    assert res["data"]["php"]["versions"] == ["8.3", "8.2"]
    assert res["data"]["node"] == {"installed": True, "in_path": True, "version": "20.11.0", "raw_version": "v20.11.0"}
    assert res["data"]["python"] == {"installed": True, "in_path": True, "version": "3.12.2", "raw_version": "Python 3.12.2"}
    assert res["data"]["go"]["installed"] is False
    assert res["data"]["go"]["in_path"] is False
    assert res["data"]["java"] == {"installed": True, "in_path": False, "version": "21.0.2", "raw_version": 'openjdk version "21.0.2"'}


def test_get_framework_versions_filters_npm_by_node_version(project_manager):
    fake_npm_data = {
        "versions": {
            "6.0.1": {"engines": {"node": "^20.19.0 || >=22.12.0"}},
            "5.4.8": {"engines": {"node": "^18.0.0 || >=20.0.0"}},
            "4.5.0": {"engines": {"node": "^14.18.0 || >=16.0.0"}},
        }
    }
    with patch.object(project_manager, "_fetch_json_url", return_value=fake_npm_data):
        res_node18 = project_manager.get_framework_versions("node", "react-vite", "18.20.0")
        res_node22 = project_manager.get_framework_versions("node", "react-vite", "22.12.0")

    assert res_node18["status"] == "success"
    assert [v["value"] for v in res_node18["data"]] == ["5.4.8", "4.5.0"]
    assert [v["value"] for v in res_node22["data"]] == ["6.0.1", "5.4.8", "4.5.0"]


def test_get_framework_versions_filters_packagist_and_pypi_and_spring(project_manager):
    fake_packagist = {
        "packages": {
            "laravel/laravel": [
                {"version": "v11.3.0", "require": {"php": "^8.2"}},
                {"version": "v10.4.0", "require": {"php": "^8.1"}},
            ]
        }
    }
    with patch.object(project_manager, "_fetch_json_url", return_value=fake_packagist):
        res_php81 = project_manager.get_framework_versions("php", "laravel", "8.1.10")
    assert [v["value"] for v in res_php81["data"]] == ["^10.4"]

    fake_pypi = {
        "releases": {
            "5.1.2": [{"requires_python": ">=3.10"}],
            "4.2.16": [{"requires_python": ">=3.8"}],
        }
    }
    with patch.object(project_manager, "_fetch_json_url", return_value=fake_pypi):
        res_py39 = project_manager.get_framework_versions("python", "django", "3.9.0")
    assert [v["value"] for v in res_py39["data"]] == ["4.2.16"]

    fake_spring = {
        "bootVersion": {
            "values": [
                {"id": "3.4.0", "name": "3.4.0"},
                {"id": "3.5.0-M1", "name": "3.5.0-M1"},
                {"id": "2.7.18.RELEASE", "name": "2.7.18"},
            ]
        }
    }
    with patch.object(project_manager, "_fetch_json_url", return_value=fake_spring):
        res_java11 = project_manager.get_framework_versions("java", "spring-boot", "11.0.2")
    assert [v["value"] for v in res_java11["data"]] == ["2.7.18"]


def test_get_framework_versions_raw_and_error_handling(project_manager):
    assert project_manager.get_framework_versions("node", "node-raw", "20.0.0") == {"status": "success", "data": []}
    with patch.object(project_manager, "_fetch_json_url", side_effect=OSError("offline")):
        err_res = project_manager.get_framework_versions("node", "nextjs", "20.0.0")
    assert err_res["status"] == "error"
    assert err_res["message"] == "backend.project.fetch_versions_failed"


def test_detect_framework_multi_runtime(project_manager):
    with patch("os.path.isdir", return_value=True):
        with patch("os.listdir", return_value=["package.json"]), patch("core.services.project.read_json", return_value={"dependencies": {"next": "14.2.0"}}):
            assert project_manager.detect_framework("C:/app") == "nextjs"
        with patch("os.listdir", return_value=["package.json"]), patch("core.services.project.read_json", return_value={"dependencies": {"react-native": "0.74.0"}}):
            assert project_manager.detect_framework("C:/app") == "react-native"
        with patch("os.listdir", return_value=["package.json"]), patch("core.services.project.read_json", return_value={"devDependencies": {"vite": "^5.0.0"}}):
            assert project_manager.detect_framework("C:/app") == "react-vite"
        with patch("os.listdir", return_value=["manage.py"]):
            assert project_manager.detect_framework("C:/app") == "django"
        with patch("os.listdir", return_value=["go.mod"]), patch("builtins.open", mock_open(read_data="module x\nrequire github.com/gin-gonic/gin v1.10.0")):
            assert project_manager.detect_framework("C:/app") == "gin"
        with patch("os.listdir", return_value=["pom.xml"]):
            assert project_manager.detect_framework("C:/app") == "spring-boot"


def test_generate_vhost_block_reverse_proxy_and_websocket_for_non_php(project_manager):
    project_manager.api.ssl.generate_domain_cert = MagicMock(return_value=("C:\\certs\\node.crt", "C:\\certs\\node.key"))
    project = {
        "domain": "react-app.test",
        "path": "C:/www/react-app",
        "project_type": "node",
        "proxy_port": 5173,
        "framework": "react-vite",
    }
    block = project_manager._generate_vhost_block(project, [project])
    assert "<VirtualHost *:80>" in block
    assert "ProxyPreserveHost On" in block
    assert 'RewriteRule ^/?(.*) "ws://127.0.0.1:5173/$1" [P,L]' in block
    assert "ProxyPass / http://127.0.0.1:5173/ retry=0 timeout=30" in block
    assert "<VirtualHost *:443>" in block
    assert 'RequestHeader set X-Forwarded-Proto "https"' in block
    assert "SetHandler \"proxy:fcgi://" not in block


@patch("core.services.project.read_json", return_value=[])
@patch("core.services.project.write_json")
def test_create_project_validates_proxy_port_for_non_php(mock_write_json, mock_read_json, project_manager):
    res_invalid = project_manager.create_project({
        "domain": "badport", "domain_extension": ".test",
        "project_type": "node", "proxy_port": 80, "is_existing": True, "document_root": "C:/app",
    })
    assert res_invalid == {"status": "error", "message": "backend.project.invalid_proxy_port"}

    with patch.object(project_manager, "sync_apache_vhosts"), patch.object(project_manager, "_sync_hosts_for_project", return_value=None):
        res_ok = project_manager.create_project({
            "name": "Node App", "domain": "nodeapp", "domain_extension": ".test",
            "project_type": "node", "proxy_port": 5173, "framework": "react-vite",
            "is_existing": True, "document_root": "C:/app",
        })
    assert res_ok["status"] == "success"
    saved = mock_write_json.call_args[0][1][0]
    assert saved["project_type"] == "node"
    assert saved["proxy_port"] == 5173


@patch("core.services.project.write_json")
@patch("os.makedirs")
def test_install_node_and_python_projects_scaffold_and_write_start_bat(mock_makedirs, mock_write_json, project_manager):
    with patch.object(project_manager, "_resolve_runtime_bin", side_effect=lambda eng, exe: f"C:/bin/{exe}"):
        with patch("core.services.project.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            with patch("builtins.open", mock_open()):
                res_node = project_manager._install_new_framework({
                    "project_type": "node", "framework": "react-vite",
                    "install_location": "C:/www", "domain": "viteapp.test",
                    "specific_version": "5.4.8", "proxy_port": 5173,
                })
                res_py = project_manager._install_new_framework({
                    "project_type": "python", "framework": "fastapi",
                    "install_location": "C:/www", "domain": "pyapp.test",
                    "specific_version": "0.115.0", "proxy_port": 8000,
                })
    assert res_node["status"] == "success"
    assert res_py["status"] == "success"


def test_is_cli_prompt_waiting_detection():
    # Prompt with arrow keys or choices
    is_w, prompt = ProjectManager._is_cli_prompt_waiting("? Would you like to use TypeScript? » No / Yes")
    assert is_w is True
    assert "TypeScript" in prompt

    # Prompt with (y/N)
    is_w2, prompt2 = ProjectManager._is_cli_prompt_waiting("Do you wish to continue? (y/N)")
    assert is_w2 is True
    assert "(y/N)" in prompt2

    # Next.js multi-line prompt
    next_buf = (
        "? Would you like to use the recommended Next.js defaults? » - Use arrow-keys. Return to submit.\n"
        ">   Yes, use recommended defaults\n"
        "    TypeScript, ESLint, Tailwind CSS\n"
        "    No, reuse previous settings\n"
        "    No, customize settings"
    )
    is_w_next, p_next = ProjectManager._is_cli_prompt_waiting(next_buf)
    assert is_w_next is True
    assert "Next.js defaults" in p_next

    # Vite Clack prompt with bottom border └
    vite_buf = (
        "create-vite v9.3.1\n\n"
        "│\n"
        "◆  Which linter to use?\n"
        "│  ● Oxlint\n"
        "│  ○ ESLint\n"
        "│  ↑/↓ to navigate • Enter: confirm\n"
        "└"
    )
    is_w_vite, p_vite = ProjectManager._is_cli_prompt_waiting(vite_buf)
    assert is_w_vite is True
    assert "confirm" in p_vite or "linter" in p_vite

    # Vite Clack Q3 radio prompt (● Yes / ○ No)
    vite_q3 = (
        "◇  Which linter to use?\n"
        "│  Oxlint\n\n"
        "│\n"
        "◆  Install with npm and start now?\n"
        "│  ● Yes / ○ No\n"
        "└"
    )
    is_w_q3, p_q3 = ProjectManager._is_cli_prompt_waiting(vite_q3)
    assert is_w_q3 is True
    assert "Yes" in p_q3

    # Vite scaffolding done -> not waiting
    vite_done = (
        "◇  Scaffolding project in D:\\Projects\\my-app...\n"
        "│\n"
        "└  Done. Now run:\n"
        "  npm install\n"
    )
    is_w_done, _ = ProjectManager._is_cli_prompt_waiting(vite_done)
    assert is_w_done is False

    # Normal non-waiting log
    is_w3, _ = ProjectManager._is_cli_prompt_waiting("Installing packages with npm...")
    assert is_w3 is False

    # Empty
    is_w4, _ = ProjectManager._is_cli_prompt_waiting("")
    assert is_w4 is False


def test_send_project_cli_input_and_resize(project_manager):
    # When no pty is active
    res = project_manager.send_project_cli_input("hello")
    assert res == {"status": "error", "message": "backend.project.no_active_cli"}

    # When pty is active
    mock_pty = MagicMock()
    project_manager._active_pty = mock_pty
    res_ok = project_manager.send_project_cli_input("yes\r")
    assert res_ok == {"status": "success"}
    mock_pty.write.assert_called_once_with("yes\r")

    # Resize
    res_resize = project_manager.resize_project_cli(80, 24)
    assert res_resize == {"status": "success"}
    mock_pty.setwinsize.assert_called_once_with(24, 80)


def test_cancel_project_install_kills_and_reverts(project_manager):
    mock_pty = MagicMock()
    project_manager._active_pty = mock_pty
    project_manager._active_pid = 12345
    project_manager._active_install_location = "C:\\www"
    project_manager._active_target_dir = "C:\\www\\myapp"

    with patch("psutil.Process") as mock_proc, patch.object(project_manager, "_rollback_dir") as mock_rollback:
        mock_parent = MagicMock()
        mock_child = MagicMock()
        mock_parent.children.return_value = [mock_child]
        mock_proc.return_value = mock_parent

        res = project_manager.cancel_project_install()

        assert res["status"] == "success"
        assert res["message"] == "backend.project.install_cancelled_reverted"
        assert project_manager._install_cancelled is True
        mock_child.kill.assert_called_once()
        mock_parent.kill.assert_called_once()
        mock_pty.close.assert_called_once_with(force=True)
        mock_rollback.assert_called_once_with(os.path.realpath("C:\\www\\myapp"))


def test_run_nextjs_interactive_cli(project_manager):
    with patch.object(project_manager, "_run_cli_or_pty", return_value=(True, "")) as mock_run:
        with patch("core.services.project.read_json", return_value={"name": "my-app", "scripts": {}}), \
             patch("core.services.project.write_json") as mock_write_json, \
             patch.object(project_manager, "_write_start_dev_bat") as mock_bat, \
             patch("os.makedirs"):
            ok, err = project_manager._run_nextjs_interactive_cli(
                "C:/bin/npx.cmd", "C:/www/my-app", "14.2.0", 3000, {"PATH": "C:/bin"}
            )
            assert ok is True
            assert err == ""
            mock_run.assert_called_once_with(
                ["C:/bin/npx.cmd", "create-next-app@14.2.0", "C:/www/my-app"],
                cwd="C:/www",
                env={"PATH": "C:/bin"}
            )
            saved_pkg = mock_write_json.call_args[0][1]
            assert saved_pkg["scripts"]["dev"] == "next dev -H 127.0.0.1 -p 3000"
            mock_bat.assert_called_once_with("C:/www/my-app", "npm run dev")

    # Failure path
    with patch.object(project_manager, "_run_cli_or_pty", return_value=(False, "CLI error")) as mock_run_fail:
        with patch("os.makedirs"):
            ok, err = project_manager._run_nextjs_interactive_cli(
                "C:/bin/npx.cmd", "C:/www/my-app", "", 3000, {}
            )
            assert ok is False
            assert err == "CLI error"
            mock_run_fail.assert_called_once_with(
                ["C:/bin/npx.cmd", "create-next-app@latest", "C:/www/my-app"],
                cwd="C:/www",
                env={}
            )


def test_run_react_interactive_cli_and_patch_vite(project_manager):
    with patch.object(project_manager, "_run_cli_or_pty", return_value=(True, "")) as mock_run, \
         patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/bin/npm.cmd"), \
         patch.object(project_manager, "_write_start_dev_bat") as mock_bat, \
         patch("os.path.exists", side_effect=lambda p: "node_modules" in p), \
         patch("os.makedirs"):
        ok, err = project_manager._run_react_interactive_cli("C:/bin/npx.cmd", "C:/www/my-react", "5.4.0", 5173, {})
        assert ok is True
        assert err == ""
        mock_run.assert_called_once_with(
            ["C:/bin/npx.cmd", "create-vite@5.4.0", "C:/www/my-react", "--template", "react", "--interactive", "--no-immediate"],
            cwd="C:/www",
            env={}
        )
        mock_bat.assert_called_once_with("C:/www/my-react", "npm run dev")

    # Patch vite config port
    with patch("os.path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data="import { defineConfig } from 'vite'\nexport default defineConfig({\n  plugins: []\n})\n")) as m_file:
        project_manager._patch_vite_config_port("C:/www/my-react", 5173)
        handle = m_file()
        written = "".join(call.args[0] for call in handle.write.call_args_list)
        assert 'server: { host: "127.0.0.1", port: 5173, allowedHosts: true }' in written


def test_install_python_with_venv_and_django(project_manager):
    # Test venv creation and django startproject
    with patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/Python310/python.exe"), \
         patch.object(project_manager, "_run_cli_or_pty", return_value=(True, "")) as mock_run, \
         patch.object(project_manager, "_patch_django_settings") as mock_patch_settings, \
         patch.object(project_manager, "_write_start_dev_bat") as mock_bat, \
         patch("os.path.exists", return_value=True), \
         patch("builtins.open", mock_open()), \
         patch("os.makedirs"):
        res = project_manager._install_python_project("django", "C:/www/my-django", "5.1.0", 8000, use_venv=True)
        assert res["status"] == "success"
        # Verify venv command was called
        calls = [c[0][0] for c in mock_run.call_args_list]
        assert ["C:/Python310/python.exe", "-m", "venv", os.path.join("C:/www/my-django", ".venv")] in calls
        # Verify django startproject was called
        django_call = [c for c in calls if "django" in c and "startproject" in c]
        assert len(django_call) == 1
        assert django_call[0][-2:] == ["config", "."]
        mock_patch_settings.assert_called_once_with("C:/www/my-django")
        # Verify start-dev.bat activates venv
        bat_cmd = mock_bat.call_args[0][1]
        assert "call .venv\\Scripts\\activate.bat" in bat_cmd
        assert "manage.py runserver 127.0.0.1:8000" in bat_cmd


def test_install_go_project_starter_code_and_env(project_manager):
    with patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/Go/bin/go.exe"), \
         patch.object(project_manager, "_run_cli_or_pty", return_value=(True, "")) as mock_run, \
         patch.object(project_manager, "_write_start_dev_bat") as mock_bat, \
         patch("builtins.open", mock_open()) as m_file, \
         patch("os.makedirs"):
        res = project_manager._install_go_project("gin", "C:/www/my-go", "1.10.0", 8080)
        assert res["status"] == "success"
        # Verify env has GOROOT
        env_passed = mock_run.call_args_list[0][1]["env"]
        assert env_passed["GOROOT"] == "C:/Go"
        # Verify main.go wrote gin code
        written = "".join(call.args[0] for call in m_file().write.call_args_list)
        assert "github.com/gin-gonic/gin" in written
        assert "r.Run" in written
        # Verify start-dev.bat
        bat_cmd = mock_bat.call_args[0][1]
        assert "go run main.go" in bat_cmd
        assert "pause" in bat_cmd


def test_install_java_project_spring_boot_dynamic_version_and_native(project_manager):
    # Spring boot without specific version -> no bootVersion in URL
    with patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/Java/bin/java.exe"), \
         patch("urllib.request.urlopen") as mock_urlopen, \
         patch("zipfile.ZipFile"), \
         patch.object(project_manager, "_write_start_dev_bat") as mock_bat, \
         patch("builtins.open", mock_open()), \
         patch("os.path.exists", return_value=True), \
         patch("os.remove"), \
         patch("os.makedirs"):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"PKfakezip"
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        res = project_manager._install_java_project("spring-boot", "C:/www/my-boot", "", 8080)
        assert res["status"] == "success"
        req_sent = mock_urlopen.call_args[0][0]
        assert "bootVersion=" not in req_sent.full_url
        assert "dependencies=web" in req_sent.full_url

    # Java native -> writes Main.java with stdout print
    with patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/Java/bin/java.exe"), \
         patch.object(project_manager, "_write_start_dev_bat") as mock_bat2, \
         patch("builtins.open", mock_open()) as m_file2, \
         patch("os.makedirs"):
        res_native = project_manager._install_java_project("java-raw", "C:/www/my-java", "", 8080)
        assert res_native["status"] == "success"
        written_java = "".join(call.args[0] for call in m_file2().write.call_args_list)
        assert "Java HTTP server listening on" in written_java
        assert "Press Ctrl+C to stop" in written_java
        bat_cmd2 = mock_bat2.call_args[0][1]
        assert "java Main.java" in bat_cmd2
        assert "pause" in bat_cmd2


def test_spawn_pty_process_windows_cmd_wrapper(project_manager):
    with patch("sys.platform", "win32"), \
         patch("winpty.PtyProcess.spawn") as mock_spawn:
        project_manager._spawn_pty_process(["C:/bin/npx.cmd", "create-next-app"], cwd="C:/www")
        mock_spawn.assert_called_once_with(
            ["cmd.exe", "/c", "C:/bin/npx.cmd", "create-next-app"],
            cwd="C:/www",
            env=ANY,
            dimensions=(24, 100)
        )

    # When executable is not a batch file (e.g. php.exe), no cmd.exe /c
    with patch("sys.platform", "win32"), \
         patch("winpty.PtyProcess.spawn") as mock_spawn2:
        project_manager._spawn_pty_process(["C:/bin/php.exe", "artisan"], cwd="C:/www")
        mock_spawn2.assert_called_once_with(
            ["C:/bin/php.exe", "artisan"],
            cwd="C:/www",
            env=ANY,
            dimensions=(24, 100)
        )




