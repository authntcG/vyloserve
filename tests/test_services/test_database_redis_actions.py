import pytest
from unittest.mock import MagicMock, patch
from core.services.database import DatabaseManager

@pytest.fixture
def mock_api():
    api = MagicMock()
    return api

@pytest.fixture
def db_mgr(mock_api, tmp_path):
    with patch('core.services.database.get_project_root', return_value=str(tmp_path)):
        with patch('os.makedirs'):
            mgr = DatabaseManager(mock_api)
            return mgr

def test_parse_redis_info_text(db_mgr):
    sample_info = """# Server
redis_version:7.0.8
uptime_in_seconds:172800
uptime_in_days:2
# Clients
connected_clients:5
# Memory
used_memory_human:2.50M
used_memory_peak_human:4.10M
# Stats
instantaneous_ops_per_sec:12
# Keyspace
db0:keys=42,expires=10,avg_ttl=3600
db1:keys=8,expires=0,avg_ttl=0
"""
    parsed = db_mgr._parse_redis_info_text(sample_info)
    assert parsed["version"] == "7.0.8"
    assert parsed["uptime_days"] == 2
    assert parsed["uptime_seconds"] == 172800
    assert parsed["clients"] == 5
    assert parsed["used_memory_human"] == "2.50M"
    assert parsed["used_memory_peak_human"] == "4.10M"
    assert parsed["total_keys"] == 50  # 42 + 8
    assert parsed["ops_per_sec"] == 12

def test_get_redis_stats_not_found(db_mgr):
    with patch('core.services.database.read_json', return_value=[]):
        res = db_mgr.get_redis_stats("nonexistent_id")
        assert res["status"] == "error"
        assert res["message"] == "backend.database.not_found"

def test_get_redis_stats_not_redis_instance(db_mgr):
    dbs = [{"id": "mysql_1", "engine": "mysql", "port": 3306}]
    with patch('core.services.database.read_json', return_value=dbs):
        res = db_mgr.get_redis_stats("mysql_1")
        assert res["status"] == "error"
        assert res["message"] == "backend.database.not_redis_instance"

def test_get_redis_stats_not_running(db_mgr):
    dbs = [{"id": "redis_1", "engine": "redis", "port": 6379}]
    with patch('core.services.database.read_json', return_value=dbs):
        with patch('core.services.database.check_port_in_use', return_value=False):
            res = db_mgr.get_redis_stats("redis_1")
            assert res["status"] == "error"
            assert res["message"] == "backend.database.must_be_running"

def test_get_redis_stats_success(db_mgr):
    dbs = [{"id": "redis_1", "engine": "redis", "port": 6379, "installDir": "/bin/redis"}]
    mock_info = "# Server\nredis_version:7.0.8\nuptime_in_days:1\n# Clients\nconnected_clients:2\n# Memory\nused_memory_human:1.20M\n# Keyspace\ndb0:keys=15\n"
    with patch('core.services.database.read_json', return_value=dbs):
        with patch('core.services.database.check_port_in_use', return_value=True):
            with patch.object(db_mgr, '_execute_redis_command', return_value=(True, mock_info)):
                res = db_mgr.get_redis_stats("redis_1")
                assert res["status"] == "success"
                assert res["stats"]["clients"] == 2
                assert res["stats"]["total_keys"] == 15
                assert res["stats"]["used_memory_human"] == "1.20M"

def test_get_redis_stats_command_failed(db_mgr):
    dbs = [{"id": "redis_1", "engine": "redis", "port": 6379}]
    with patch('core.services.database.read_json', return_value=dbs):
        with patch('core.services.database.check_port_in_use', return_value=True):
            with patch.object(db_mgr, '_execute_redis_command', return_value=(False, "Connection refused")):
                res = db_mgr.get_redis_stats("redis_1")
                assert res["status"] == "error"
                assert res["message"] == "backend.database.redis_command_failed"

def test_flush_redis_db_success(db_mgr, mock_api):
    dbs = [{"id": "redis_1", "engine": "redis", "port": 6379}]
    with patch('core.services.database.read_json', return_value=dbs):
        with patch('core.services.database.check_port_in_use', return_value=True):
            with patch.object(db_mgr, '_execute_redis_command', return_value=(True, "+OK\r\n")):
                res = db_mgr.flush_redis_db("redis_1", async_flush=True)
                assert res["status"] == "success"
                assert res["message"] == "backend.database.redis_flushed"
                mock_api.emit_log.assert_called_with("backend.database.redis_flushed", "success", {"port": 6379})

def test_flush_redis_db_failure(db_mgr):
    dbs = [{"id": "redis_1", "engine": "redis", "port": 6379}]
    with patch('core.services.database.read_json', return_value=dbs):
        with patch('core.services.database.check_port_in_use', return_value=True):
            with patch.object(db_mgr, '_execute_redis_command', return_value=(False, "ERR unknown command")):
                res = db_mgr.flush_redis_db("redis_1", async_flush=False)
                assert res["status"] == "error"
                assert res["message"] == "backend.database.redis_flush_failed"

def test_execute_redis_command_cli_fallback(db_mgr):
    db_obj = {"id": "redis_1", "port": 6379, "rootPassword": "", "installDir": "/bin/redis"}
    mock_run_res = MagicMock()
    mock_run_res.returncode = 0
    mock_run_res.stdout = "+OK\r\n"
    
    with patch('socket.create_connection', side_effect=Exception("Socket fail")):
        with patch.object(db_mgr, '_resolve_db_cli', return_value="/bin/redis/redis-cli"):
            with patch('subprocess.run', return_value=mock_run_res):
                success, output = db_mgr._execute_redis_command(db_obj, ["FLUSHALL", "ASYNC"])
                assert success is True
                assert "+OK" in output
