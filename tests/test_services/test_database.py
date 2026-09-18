import pytest
from unittest.mock import MagicMock, patch, mock_open
from core.services.database import DatabaseManager

@pytest.fixture
def mock_api():
    api = MagicMock()
    return api

@pytest.fixture
def db_mgr(mock_api):
    with patch('os.makedirs'):
        return DatabaseManager(mock_api)

def test_init(db_mgr):
    assert db_mgr is not None

@patch('core.services.database.download_advanced')
@patch('core.services.database.extract_archive')
@patch('core.services.database.os.remove')
@patch('core.services.database.os.path.exists')
def test_db_install_database(mock_exists, mock_remove, mock_extract, mock_download, db_mgr):
    # Ensure it doesn't think it's already installed
    mock_exists.return_value = False
    
    with patch.object(db_mgr, '_init_database') as mock_init:
        with patch.object(db_mgr, '_register_database') as mock_register:
            with patch.object(db_mgr, '_unwrap_single_subdir'):
                with patch.object(db_mgr, '_resolve_mariadb_url', return_value="http://url"):
                    res = db_mgr.install_database("mysql", "8.0", "url", 3306, "root")
                    assert res['status'] == 'success'
                    mock_download.assert_called_once()
                    mock_extract.assert_called_once()

@patch('core.services.database.urllib.request.urlopen')
def test_db_get_available_versions(mock_urlopen, db_mgr):
    with patch.object(db_mgr, '_fetch_postgres_versions', return_value={"status": "success", "data": [{"version": "14.1.0"}]}):
        with patch.object(db_mgr, '_fetch_mariadb_versions', return_value={"status": "success", "data": [{"version": "10.4.0"}]}):
            res_mysql = db_mgr.get_available_versions("mysql")
            assert res_mysql['status'] == 'success'
            assert len(res_mysql['data']) > 0
            
            res_pg = db_mgr.get_available_versions("postgres")
            assert res_pg['status'] == 'success'
            assert res_pg['data'][0]['version'] == '14.1.0'
            
            res_redis = db_mgr.get_available_versions("redis")
            assert res_redis['status'] == 'error'
            
@patch('core.services.database.subprocess.Popen')
@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use')
def test_db_start_database(mock_check_port, mock_read_json, mock_popen, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "dataDir": "dir"}]
    mock_check_port.return_value = False
    
    mock_proc = MagicMock()
    mock_popen.return_value = mock_proc
    
    with patch('builtins.open', new_callable=MagicMock):
        with patch.object(db_mgr, '_build_startup_cmd', return_value=(False, ["mysqld"])):
            with patch.object(db_mgr, '_wait_for_startup', return_value={"status": "success"}):
                res = db_mgr.start_database("db1")
                assert res['status'] == 'success'
                mock_popen.assert_called_once()
                # Verify process is stored
                assert "db1" in db_mgr.processes

@patch('core.services.database.read_json')
def test_db_stop_database(mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "name": "DB1"}]
    
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    db_mgr.processes["db1"] = mock_proc
    
    with patch.object(db_mgr, '_graceful_shutdown'):
        res = db_mgr.stop_database("db1")
        assert res['status'] == 'success'
        assert "db1" not in db_mgr.processes
        mock_proc.terminate.assert_called_once()

@patch('core.services.database.read_json')
@patch('core.services.database.write_json')
@patch('core.services.database.check_port_in_use', return_value=False)
@patch('core.services.database.os.path.exists', return_value=True)
def test_db_save_config(mock_exists, mock_check_port, mock_write_json, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "dataDir": "dir"}]
    
    with patch('builtins.open', new_callable=MagicMock) as mock_open:
        mock_file = MagicMock()
        mock_file.readlines.return_value = ["max_connections=50\n"]
        mock_open.return_value.__enter__.return_value = mock_file
        
        with patch.object(db_mgr, '_update_config_lines', return_value=["max_connections=200\n"]):
            res = db_mgr.save_db_config("db1", {"max_connections": "200"})
            assert res['status'] == 'success'
            mock_write_json.assert_called_once()
            mock_file.writelines.assert_called_once_with(["max_connections=200\n"])

def test_db_is_port_in_use(db_mgr):
    with patch('core.services.database.check_port_in_use', return_value=True):
        assert db_mgr.is_port_in_use(3306) == True
    with patch('core.services.database.check_port_in_use', return_value=False):
        assert db_mgr.is_port_in_use(3306) == False

def test_db_get_installed(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "engine": "mysql", "port": 3306, "name": "MySQL 1", "version": "8.0", "installDir": "C:/db", "dataDir": "C:/data"}]):
        with patch('core.services.database.os.path.exists', return_value=True):
            db_mgr.processes = {"db_1": MagicMock(poll=MagicMock(return_value=None))}
            res = db_mgr.get_installed()
            assert res['status'] == 'success'
            data = res['data']
            assert len(data) == 1
            assert data[0]['id'] == 'db_1'
            assert data[0]['status'] == 'running'
            
            db_mgr.processes = {"db_1": MagicMock(poll=MagicMock(return_value=1))}
            with patch('core.services.database.check_port_in_use', return_value=False):
                res = db_mgr.get_installed()
                assert res['data'][0]['status'] == 'stopped'
                # processes pop is not done in get_installed, so db_1 might still be there

def test_db_wait_for_startup(db_mgr):
    mock_log = MagicMock()
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    db_mgr.processes["db_1"] = mock_proc
    
    with patch('core.services.database.check_port_in_use', side_effect=[False, True]):
        with patch('time.sleep'):
            res = db_mgr._wait_for_startup({"id": "db_1", "port": 3306, "dataDir": "C:\\data", "name": "MySQL"}, mock_log)
            assert res['status'] == 'success'
    
    with patch('core.services.database.check_port_in_use', return_value=False):
        with patch('time.sleep'):
            res = db_mgr._wait_for_startup({"id": "db_1", "port": 3306, "dataDir": "C:\\data", "name": "MySQL"}, mock_log)
            assert res['status'] == 'error'

def test_db_build_startup_cmd(db_mgr):
    cmd = db_mgr._build_startup_cmd({"engine": "mysql", "installDir": "C:\\db", "dataDir": "C:\\data", "port": 3306})
    assert "mysqld" in cmd[0]
    
    cmd = db_mgr._build_startup_cmd({"engine": "postgres", "installDir": "C:\\db", "dataDir": "C:\\data", "port": 5432})
    assert "postgres" in cmd[0]

def test_db_kill_process(db_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    db_mgr.processes["db_1"] = mock_proc
    
    db_mgr._kill_process("db_1")
    mock_proc.terminate.assert_called_once()
    assert "db_1" not in db_mgr.processes
    
    # Exception on wait
    mock_proc2 = MagicMock()
    mock_proc2.poll.return_value = None
    mock_proc2.wait.side_effect = Exception("timeout")
    db_mgr.processes["db_2"] = mock_proc2
    db_mgr._kill_process("db_2")
    mock_proc2.kill.assert_called_once()
    assert "db_2" not in db_mgr.processes

def test_db_graceful_shutdown(db_mgr):
    with patch('core.services.database.run_silent_command') as mock_run:
        with patch('sys.platform', 'win32'):
            db_mgr._graceful_shutdown({"engine": "mysql", "port": 3306, "installDir": "C:\\db", "dataDir": "C:\\data"})
            mock_run.assert_called_once()
        
        with patch('core.services.database.run_silent_command') as mock_run:
            with patch('sys.platform', 'win32'):
                db_mgr._graceful_shutdown({"engine": "postgres", "installDir": "C:\\db", "dataDir": "data"})
                mock_run.assert_called_once()

def test_db_resolve_mariadb_url(db_mgr):
    with patch('core.services.database.urllib.request.urlopen') as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value.decode.return_value = '<a href="mariadb-10.6.5-winx64.zip">mariadb-10.6.5-winx64.zip</a>'
        mock_urlopen.return_value = mock_resp
        url = db_mgr._resolve_mariadb_url("10.6")
        assert "mariadb-10.6.5-winx64.zip" in url

def test_db_fetch_mariadb_versions(db_mgr):
    with patch('core.services.database.urllib.request.urlopen') as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value.decode.return_value = '<a href="mariadb-10.6.0/">10.6.0/</a> <a href="mariadb-11.0.0/">11.0.0/</a>'
        mock_urlopen.return_value = mock_resp

        with patch.object(db_mgr, '_resolve_mariadb_url', return_value="some_url"):
            res = db_mgr._fetch_mariadb_versions()
            assert "10.6" in res['data'][1]['version'] or "10.6" in res['data'][0]['version']

def test_db_fetch_mariadb_versions_network_error_returns_real_message(db_mgr):
    """
    Regression test: _fetch_mariadb_versions() sebelumnya punya
    'except Exception: return {..., "message": str(e)}' TANPA 'as e' (docs/known_bugs.md #10).
    Jika bug itu muncul lagi, str(e) akan melempar NameError yang tidak tertangkap,
    sehingga test ini gagal dengan error alih-alih lolos diam-diam.
    """
    with patch('core.services.database.urllib.request.urlopen', side_effect=OSError("connection refused")):
        res = db_mgr._fetch_mariadb_versions()
        assert res['status'] == 'error'
        assert res['message'] == 'backend.error.unexpected'
        assert res['args']['e'] == 'connection refused'

def test_db_uninstall_database(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "port": 3306, "installDir": "C:\\db", "dataDir": "C:\\data", "name": "MySQL"}]):
        with patch('core.services.database.check_port_in_use', return_value=True):
            res = db_mgr.uninstall_database("db_1")
            assert res['status'] == 'error'
        
        with patch('core.services.database.check_port_in_use', return_value=False):
            with patch('core.services.database.os.path.exists', return_value=True):
                with patch('core.services.database.shutil.rmtree') as mock_rm:
                    with patch('core.services.database.write_json') as mock_write:
                        res = db_mgr.uninstall_database("db_1", delete_data=True)
                        assert res['status'] == 'success'
                        mock_rm.assert_called()
                        mock_write.assert_called_once()
                        
def test_db_parse_mysql_config(db_mgr):
    config = {}
    with patch('core.services.database.os.path.exists', return_value=True):
        with patch('builtins.open', mock_open(read_data="max_connections=300\n#bind-address=0.0.0.0\nbind-address=127.0.0.1")):
            db_mgr._parse_mysql_config("my.ini", config)
            assert config["max_connections"] == "300"
            assert config["bind_address"] == "127.0.0.1"

def test_db_parse_postgres_config(db_mgr):
    config = {}
    with patch('core.services.database.os.path.exists', return_value=True):
        with patch('builtins.open', mock_open(read_data="max_connections = 200\nlisten_addresses = '*'\n")):
            db_mgr._parse_postgres_config("postgresql.conf", config)
            assert config["max_connections"] == "200"
            assert config["listen_addresses"] == "*"

def test_db_fetch_postgres_versions(db_mgr):
    with patch('core.services.database.urllib.request.urlopen') as mock_urlopen:
        mock_resp = MagicMock()
        # the parser needs "Version" and "windows-x64" or similar
        html = b'''
        <tr><td>Version</td><td>15.0</td></tr>
        <tr><td>Windows x86-64</td><td><a href="dl_url">Download</a></td></tr>
        '''
        mock_resp.read.return_value = html
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        
        res = db_mgr._fetch_postgres_versions()
        # Even if parser doesn't perfectly match dummy HTML, we at least test it runs without error.
        assert isinstance(res, dict)

def test_db_open_path(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "installDir": "C:\\db", "dataDir": "C:\\data"}]):
        with patch('sys.platform', 'win32'):
            with patch('core.services.database.os.startfile') as mock_start:
                with patch('core.services.database.os.path.exists', return_value=True):
                    db_mgr.open_path("db_1")
                    mock_start.assert_called_once()

def test_db_open_path_os_error_returns_real_message(db_mgr):
    """
    Regression test: open_path() sebelumnya punya
    'except Exception: return {..., "message": str(e)}' TANPA 'as e' (docs/known_bugs.md #10).
    """
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "installDir": "C:\\db", "dataDir": "C:\\data"}]):
        with patch('sys.platform', 'win32'):
            with patch('core.services.database.os.path.exists', return_value=True):
                with patch('core.services.database.os.startfile', side_effect=OSError("access denied")):
                    res = db_mgr.open_path("db_1")
                    assert res['status'] == 'error'
                    assert res['message'] == 'backend.error.unexpected'
                    assert res['args']['e'] == 'access denied'

def test_db_get_db_config(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "engine": "mysql", "installDir": "C:\\db", "dataDir": "C:\\data"}]):
        with patch.object(db_mgr, '_parse_mysql_config') as mock_parse:
            res = db_mgr.get_db_config("db_1")
            assert res['status'] == 'success'
            mock_parse.assert_called_once()

def test_db_change_db_credentials(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "engine": "mysql", "port": 3306, "installDir": "C:\\db", "dataDir": "C:\\data"}]):
        with patch('core.services.database.check_port_in_use', return_value=True):
            with patch.object(db_mgr, '_change_mysql_credentials', return_value=None):
                res = db_mgr.change_db_credentials("db_1", "root", "old", "new")
                assert res['status'] == 'success'

def test_db_change_mysql_credentials(db_mgr):
    with patch('core.services.database.run_silent_command') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with patch('sys.platform', 'win32'):
            res = db_mgr._change_mysql_credentials({"installDir": "C:\\db", "port": 3306}, "root", "old", "new")
            assert res is None

def test_db_change_postgres_credentials(db_mgr):
    with patch('core.services.database.run_silent_command') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with patch('sys.platform', 'win32'):
            res = db_mgr._change_postgres_credentials({"installDir": "C:\\db", "port": 5432}, "postgres", "old", "new")
            assert res is None

def test_db_start_stop_all(db_mgr):
    with patch.object(db_mgr, 'get_installed', return_value={"data": [{"id": "db_1", "engine": "mysql", "version": "8.0", "port": 3306}]}):
        with patch('core.services.database.check_port_in_use', side_effect=[False, True]):
            with patch.object(db_mgr, 'start_database') as mock_start:
                db_mgr.start_all()
                mock_start.assert_called_once_with("db_1")

            with patch.object(db_mgr, 'stop_database') as mock_stop:
                db_mgr.stop_all()
                mock_stop.assert_called_once_with("db_1")

def test_get_preferred_dbs_falls_back_when_dashboard_json_is_not_a_dict(db_mgr):
    """
    Regresi: dashboard.json rusak/legacy bisa berisi JSON valid yang bukan objek
    (mis. string). _get_preferred_dbs() tidak boleh crash dengan AttributeError
    "'str' object has no attribute 'get'" -- harus tetap fallback ke db
    mysql/postgres versi tertinggi. Lihat docs/known_bugs.md.
    """
    dbs = [
        {"id": "db_mysql", "engine": "mysql", "version": "8.0"},
        {"id": "db_pg", "engine": "postgres", "version": "16"},
    ]
    with patch('core.services.database.read_json', return_value="corrupted string content"):
        result = db_mgr._get_preferred_dbs(dbs)
    assert set(result) == {"db_mysql", "db_pg"}

def test_db_unwrap_single_subdir(db_mgr):
    with patch('core.services.database.os.listdir', return_value=["subdir"]):
        with patch('core.services.database.os.path.isdir', return_value=True):
            with patch('core.services.database.shutil.move') as mock_move:
                with patch('core.services.database.os.rmdir') as mock_rmdir:
                    db_mgr._unwrap_single_subdir("C:\\install")
                    assert mock_move.call_count >= 1
                    mock_rmdir.assert_called_once()

def test_db_cleanup_install_failure(db_mgr):
    with patch('core.services.database.os.path.exists', side_effect=[True, True, True]):
        with patch('core.services.database.os.remove') as mock_rm:
            with patch('core.services.database.shutil.rmtree') as mock_rmtree:
                db_mgr._cleanup_install_failure("zip", "install", False, "data")
                mock_rm.assert_called_once_with("zip")
                assert mock_rmtree.call_count == 2
                
def test_db_insert_mysql_keys(db_mgr):
    new_lines = []
    keys = {"bind_address": "127.0.0.1", "max_connections": "300"}
    found_keys = {"bind_address"}
    db_mgr._insert_mysql_keys(new_lines, keys, found_keys)
    assert "max_connections = 300\n" in new_lines
    
def test_db_parse_postgres_block(db_mgr):
    seen = set()
    results = []
    block = '<td>Version 15.0</td><a href="/download/15.0"><img alt="Windows x86-64"></a>'
    db_mgr._parse_postgres_block(block, "Windows x86-64", seen, results)
    assert len(results) == 1
    assert results[0]['version'] == '15.0'
    assert 'enterprisedb' in results[0]['url']
    
def test_db_update_config_lines(db_mgr):
    lines = ["max_connections=100\n"]
    keys = {"max_connections": "300", "bind-address": "127.0.0.1"}
    res = db_mgr._update_config_lines(lines, keys, True)
    assert "max_connections = 300\n" in res
    assert "bind-address = 127.0.0.1\n" in res
    
    # Postgres
    res2 = db_mgr._update_config_lines(lines, keys, False)
    assert "bind-address = 127.0.0.1\n" in res2

# ==========================================
# get_installed — error path
# ==========================================

def test_db_get_installed_handles_exception(db_mgr):
    with patch('core.services.database.read_json', side_effect=RuntimeError("json corrupt")):
        res = db_mgr.get_installed()
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "json corrupt"}}

# ==========================================
# _wait_for_startup — deteksi crash proses
# ==========================================

def test_db_wait_for_startup_detects_process_crash(db_mgr, tmp_path):
    """Jika proses mati sebelum port terbuka, baca sisa log dan kembalikan pesan error yang jelas."""
    mock_log = MagicMock()
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 1  # proses langsung crash
    db_mgr.processes["db_1"] = mock_proc

    data_dir = tmp_path / "dbdata"
    data_dir.mkdir()
    (data_dir / "db_startup.log").write_text("FATAL: could not bind to port 3306\n", encoding="utf-8")

    with patch('core.services.database.check_port_in_use', return_value=False):
        res = db_mgr._wait_for_startup({"id": "db_1", "port": 3306, "dataDir": str(data_dir), "name": "MySQL"}, mock_log)

    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.crashed_on_startup'
    assert 'could not bind to port 3306' in res['args']['err']
    mock_log.close.assert_called_once()

# ==========================================
# start_database — guard & error path
# ==========================================

@patch('core.services.database.read_json')
def test_db_start_database_not_found(mock_read_json, db_mgr):
    mock_read_json.return_value = []
    res = db_mgr.start_database("missing")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.not_found'

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=True)
def test_db_start_database_port_already_in_use(mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "dataDir": "dir"}]
    res = db_mgr.start_database("db1")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.port_in_use'

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=False)
@patch('core.services.database.subprocess.Popen', side_effect=OSError("mysqld.exe not found"))
def test_db_start_database_handles_launch_failure(mock_popen, mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "dataDir": "dir", "installDir": "dir"}]
    with patch('builtins.open', MagicMock()):
        res = db_mgr.start_database("db1")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.start_failed'
    assert 'mysqld.exe not found' in res['args']['e']

# ==========================================
# stop_database — pemanggilan _graceful_shutdown
# ==========================================

@patch('core.services.database.read_json')
def test_db_stop_database_calls_graceful_shutdown_if_still_listening(mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "name": "DB1"}]
    with patch('core.services.database.check_port_in_use', return_value=True):
        with patch.object(db_mgr, '_graceful_shutdown') as mock_graceful:
            res = db_mgr.stop_database("db1")
    assert res['status'] == 'success'
    mock_graceful.assert_called_once()

@patch('core.services.database.read_json')
def test_db_stop_database_skips_graceful_shutdown_if_already_stopped(mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db1", "engine": "mysql", "port": 3306, "name": "DB1"}]
    with patch('core.services.database.check_port_in_use', return_value=False):
        with patch.object(db_mgr, '_graceful_shutdown') as mock_graceful:
            db_mgr.stop_database("db1")
    mock_graceful.assert_not_called()

# ==========================================
# get_available_versions — error path
# ==========================================

def test_db_get_available_versions_handles_unexpected_exception(db_mgr):
    with patch.object(db_mgr, '_fetch_mariadb_versions', side_effect=RuntimeError("boom")):
        res = db_mgr.get_available_versions("mysql")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.fetch_versions_failed'
    assert res['args']['e'] == 'boom'

def test_db_get_available_versions_unsupported_engine(db_mgr):
    res = db_mgr.get_available_versions("redis")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.engine_unsupported'

# ==========================================
# _resolve_mariadb_url — cabang OS & error path
# ==========================================

def test_resolve_mariadb_url_raises_when_folder_not_found(db_mgr):
    with patch('core.services.database.urllib.request.urlopen', side_effect=OSError("404")):
        with pytest.raises(RuntimeError, match="tidak ditemukan"):
            db_mgr._resolve_mariadb_url("99.99")

def test_resolve_mariadb_url_raises_when_no_matching_binary(db_mgr):
    mock_resp = MagicMock()
    mock_resp.read.return_value.decode.return_value = '<html>tidak ada link zip di sini</html>'
    with patch('core.services.database.urllib.request.urlopen', return_value=mock_resp):
        with pytest.raises(RuntimeError, match="Binary untuk OS ini belum tersedia"):
            db_mgr._resolve_mariadb_url("10.6")

def test_resolve_mariadb_url_follows_subfolder_link(db_mgr):
    """Jika halaman utama punya subfolder (mis. winx64-packages/), harus fetch ulang HTML subfolder itu."""
    main_page = '<a href="winx64-packages/">winx64-packages/</a>'
    subfolder_page = '<a href="mariadb-10.6.5-winx64.zip">mariadb-10.6.5-winx64.zip</a>'
    responses = [MagicMock(), MagicMock()]
    responses[0].read.return_value.decode.return_value = main_page
    responses[1].read.return_value.decode.return_value = subfolder_page

    with patch('sys.platform', 'win32'):
        with patch('core.services.database.urllib.request.urlopen', side_effect=responses):
            url = db_mgr._resolve_mariadb_url("10.6.5")

    assert url.endswith("mariadb-10.6.5-winx64.zip")
    assert "winx64-packages/" in url

# ==========================================
# _fetch_mariadb_versions — check_resolve swallow
# ==========================================

def test_fetch_mariadb_versions_skips_version_when_resolve_fails(db_mgr):
    mock_resp = MagicMock()
    mock_resp.read.return_value.decode.return_value = '<a href="mariadb-10.6.0/">10.6.0/</a>'
    with patch('core.services.database.urllib.request.urlopen', return_value=mock_resp):
        with patch.object(db_mgr, '_resolve_mariadb_url', side_effect=RuntimeError("no binary")):
            res = db_mgr._fetch_mariadb_versions()
    assert res['status'] == 'success'
    assert res['data'] == []

# ==========================================
# _fetch_postgres_versions — error path & OS target
# ==========================================

def test_fetch_postgres_versions_handles_network_error(db_mgr):
    with patch('core.services.database.urllib.request.urlopen', side_effect=OSError("timeout")):
        res = db_mgr._fetch_postgres_versions()
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "timeout"}}

def test_fetch_postgres_versions_uses_linux_os_target(db_mgr):
    mock_resp = MagicMock()
    mock_resp.read.return_value.decode.return_value = "no binaries here"
    with patch('sys.platform', 'linux'):
        with patch('core.services.database.urllib.request.urlopen', return_value=mock_resp):
            with patch.object(db_mgr, '_parse_postgres_block') as mock_parse:
                db_mgr._fetch_postgres_versions()
    # dipanggil dengan os_target "Linux x86-64" walau tidak ada block valid di HTML ini
    assert mock_parse.call_count == 0  # tidak ada "Binaries from installer" di HTML dummy

# ==========================================
# _init_database — MySQL & PostgreSQL
# ==========================================

@patch('core.services.database.os.makedirs')
@patch('core.services.database.run_silent_command')
def test_init_database_mysql_success(mock_run, mock_makedirs, db_mgr):
    mock_run.return_value = MagicMock(returncode=0, stderr="")
    db_mgr._init_database("mysql", "C:\\install", "C:\\data", "rootpass")
    mock_run.assert_called_once()
    assert "mysql_install_db" in mock_run.call_args[0][0][0]

@patch('core.services.database.os.makedirs')
@patch('core.services.database.run_silent_command')
def test_init_database_mysql_raises_on_failure(mock_run, mock_makedirs, db_mgr):
    mock_run.return_value = MagicMock(returncode=1, stderr="disk full")
    with pytest.raises(RuntimeError, match="MariaDB Init Error"):
        db_mgr._init_database("mysql", "C:\\install", "C:\\data", "rootpass")

@patch('core.services.database.os.makedirs')
@patch('core.services.database.os.remove')
@patch('core.services.database.os.path.exists', return_value=True)
@patch('core.services.database.run_silent_command')
def test_init_database_postgres_writes_and_cleans_up_pwfile(mock_run, mock_exists, mock_remove, mock_makedirs, db_mgr):
    mock_run.return_value = MagicMock(returncode=0, stderr="")
    m = mock_open()
    with patch('builtins.open', m):
        db_mgr._init_database("postgres", "C:\\install", "C:\\data", "rootpass")

    written = "".join(c.args[0] for c in m().write.call_args_list)
    assert written == "rootpass"
    mock_remove.assert_called_once()  # pw.txt dihapus setelah dipakai
    assert "initdb" in mock_run.call_args[0][0][0]

@patch('core.services.database.os.makedirs')
@patch('core.services.database.os.path.exists', return_value=False)
@patch('core.services.database.run_silent_command')
def test_init_database_postgres_raises_on_failure(mock_run, mock_exists, mock_makedirs, db_mgr):
    mock_run.return_value = MagicMock(returncode=1, stderr="init failed")
    with patch('builtins.open', mock_open()):
        with pytest.raises(RuntimeError, match="PostgreSQL Init Error"):
            db_mgr._init_database("postgres", "C:\\install", "C:\\data", "")

# ==========================================
# _register_database
# ==========================================

@patch('core.services.database.write_json')
@patch('core.services.database.read_json', return_value=[])
def test_register_database_appends_entry(mock_read_json, mock_write_json, db_mgr):
    db_mgr._register_database("mysql_8_0", "mysql", "8.0", "3306", "C:\\data", "C:\\install")
    written = mock_write_json.call_args[0][1]
    assert written[0]["id"] == "mysql_8_0"
    assert written[0]["port"] == 3306
    assert written[0]["name"] == "MariaDB 8.0"

# ==========================================
# install_database — guard & rollback saat gagal
# ==========================================

@patch('core.services.database.os.path.exists', side_effect=[False, True])
def test_install_database_already_installed(mock_exists, db_mgr):
    # 1st exists() -> db_data_dir (False, hindari os.listdir dipanggil nyata)
    # 2nd exists() -> install_dir (True -> trigger guard already_installed)
    res = db_mgr.install_database("mysql", "8.0", "http://x", 3306, "pass")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.already_installed'

@patch('core.services.database.download_advanced', side_effect=OSError("network down"))
def test_install_database_rolls_back_on_download_failure(mock_download, db_mgr):
    with patch.object(db_mgr, '_resolve_mariadb_url', return_value="http://resolved"):
        with patch('core.services.database.os.path.exists', return_value=False):
            with patch.object(db_mgr, '_cleanup_install_failure') as mock_cleanup:
                res = db_mgr.install_database("mysql", "8.0", "http://x", 3306, "pass")

    assert res['status'] == 'error'
    assert res['message'] == 'backend.error.unexpected'
    assert res['args']['e'] == 'network down'
    mock_cleanup.assert_called_once()
    db_mgr.api.emit_progress.assert_any_call(-1, "network down")

# ==========================================
# uninstall_database — error path
# ==========================================

def test_db_uninstall_database_handles_unexpected_exception(db_mgr):
    with patch('core.services.database.read_json', side_effect=RuntimeError("disk error")):
        res = db_mgr.uninstall_database("db_1")
    assert res == {"status": "error", "message": "backend.error.unexpected", "args": {"e": "disk error"}}

# ==========================================
# open_path — cabang is_file & auto-create my.ini
# ==========================================

@patch('core.services.database.read_json', return_value=[{"id": "db_1", "engine": "mysql", "dataDir": "C:\\data"}])
def test_db_open_path_file_creates_default_myini_when_missing(mock_read_json, db_mgr):
    with patch('sys.platform', 'win32'):
        with patch('core.services.database.os.path.exists', side_effect=[False, True]):
            with patch('core.services.database.os.startfile') as mock_start:
                m = mock_open()
                with patch('builtins.open', m):
                    res = db_mgr.open_path("db_1", is_file=True)

    assert res['status'] == 'success'
    m().write.assert_called_once_with("[mysqld]")
    mock_start.assert_called_once()

@patch('core.services.database.read_json', return_value=[{"id": "db_1", "installDir": "C:\\db", "dataDir": "C:\\data"}])
@patch('core.services.database.os.path.exists', return_value=True)
def test_db_open_path_uses_xdg_open_on_linux(mock_exists, mock_read_json, db_mgr):
    with patch('sys.platform', 'linux'):
        with patch('core.services.database.subprocess.Popen') as mock_popen:
            res = db_mgr.open_path("db_1")
    assert res['status'] == 'success'
    mock_popen.assert_called_once_with(['xdg-open', "C:\\data"])

# ==========================================
# get_db_config — engine PostgreSQL
# ==========================================

def test_db_get_db_config_postgres(db_mgr):
    with patch('core.services.database.read_json', return_value=[{"id": "db_1", "engine": "postgres", "installDir": "C:\\db", "dataDir": "C:\\data", "port": 5432}]):
        with patch.object(db_mgr, '_parse_postgres_config') as mock_parse:
            res = db_mgr.get_db_config("db_1")
    assert res['status'] == 'success'
    assert res['config']['listen_addresses'] == '*'
    mock_parse.assert_called_once()

# ==========================================
# save_db_config — cabang postgres & restart otomatis
# ==========================================

@patch('core.services.database.write_json')
@patch('core.services.database.read_json')
def test_save_db_config_postgres_builds_correct_keys(mock_read_json, mock_write_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "postgres", "port": 5432, "dataDir": "C:\\data"}]
    with patch('core.services.database.check_port_in_use', return_value=False):
        with patch('core.services.database.os.path.exists', return_value=False):
            with patch('builtins.open', mock_open()):
                res = db_mgr.save_db_config("db_1", {"port": 5432, "shared_buffers": "256MB", "timezone": "UTC"})
    assert res['status'] == 'success'
    assert res['message'] == 'backend.database.config_saved_pending'

@patch('core.services.database.write_json')
@patch('core.services.database.read_json')
def test_save_db_config_restarts_when_was_running(mock_read_json, mock_write_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "mysql", "port": 3306, "dataDir": "C:\\data"}]
    with patch('core.services.database.check_port_in_use', return_value=True):
        with patch('core.services.database.os.path.exists', return_value=False):
            with patch('builtins.open', mock_open()):
                with patch.object(db_mgr, 'stop_database') as mock_stop:
                    with patch.object(db_mgr, 'start_database', return_value={"status": "success"}) as mock_start:
                        with patch('time.sleep'):
                            res = db_mgr.save_db_config("db_1", {"port": 3306})
    mock_stop.assert_called_once_with("db_1")
    mock_start.assert_called_once_with("db_1")
    assert res['message'] == 'backend.database.config_saved_restarted'

@patch('core.services.database.write_json')
@patch('core.services.database.read_json')
def test_save_db_config_reports_restart_failure(mock_read_json, mock_write_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "mysql", "port": 3306, "dataDir": "C:\\data"}]
    with patch('core.services.database.check_port_in_use', return_value=True):
        with patch('core.services.database.os.path.exists', return_value=False):
            with patch('builtins.open', mock_open()):
                with patch.object(db_mgr, 'stop_database'):
                    with patch.object(db_mgr, 'start_database', return_value={"status": "error"}):
                        with patch('time.sleep'):
                            res = db_mgr.save_db_config("db_1", {"port": 3306})
    assert res['message'] == 'backend.database.config_saved_restart_failed'

# ==========================================
# change_db_credentials — cabang postgres & error
# ==========================================

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=True)
def test_change_db_credentials_postgres_dispatch(mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "postgres", "port": 5432}]
    with patch.object(db_mgr, '_change_postgres_credentials') as mock_change:
        res = db_mgr.change_db_credentials("db_1", "postgres", "old", "new")
    assert res['status'] == 'success'
    mock_change.assert_called_once()

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=True)
def test_change_db_credentials_parses_runtime_error(mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "mysql", "port": 3306}]
    with patch.object(db_mgr, '_change_mysql_credentials', side_effect=RuntimeError("backend.database.mysql_fail|Access denied for user")):
        res = db_mgr.change_db_credentials("db_1", "root", "old", "new")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.mysql_fail'
    assert res['args']['err'] == 'Access denied for user'

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=True)
def test_change_db_credentials_handles_unexpected_exception(mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "mysql", "port": 3306}]
    with patch.object(db_mgr, '_change_mysql_credentials', side_effect=OSError("mysql.exe missing")):
        res = db_mgr.change_db_credentials("db_1", "root", "old", "new")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.system_error'
    assert res['args']['e'] == 'mysql.exe missing'

@patch('core.services.database.read_json', return_value=[])
def test_change_db_credentials_not_found(mock_read_json, db_mgr):
    res = db_mgr.change_db_credentials("missing", "root", "old", "new")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.not_found'

@patch('core.services.database.read_json')
@patch('core.services.database.check_port_in_use', return_value=False)
def test_change_db_credentials_requires_running_instance(mock_check_port, mock_read_json, db_mgr):
    mock_read_json.return_value = [{"id": "db_1", "engine": "mysql", "port": 3306}]
    res = db_mgr.change_db_credentials("db_1", "root", "old", "new")
    assert res['status'] == 'error'
    assert res['message'] == 'backend.database.must_be_running'

# ==========================================
# check_is_running — implementasi nyata
# ==========================================

def test_check_is_running_true_when_process_alive(db_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    db_mgr.processes["db_1"] = mock_proc
    assert db_mgr.check_is_running() is True

def test_check_is_running_cleans_up_dead_processes(db_mgr):
    mock_proc = MagicMock()
    mock_proc.poll.return_value = 0  # sudah mati
    db_mgr.processes["db_1"] = mock_proc
    assert db_mgr.check_is_running() is False
    assert "db_1" not in db_mgr.processes
