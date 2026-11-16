import os
import sys
import json
import pytest
from unittest.mock import MagicMock, patch

from core.services.health_manager import HealthManager


@pytest.fixture
def fake_root(tmp_path):
    root = tmp_path / "vyloserve"
    root.mkdir()
    (root / "bin").mkdir()
    (root / "data").mkdir()
    return str(root)


@pytest.fixture
def mock_api(fake_root):
    api = MagicMock()
    api.apache = MagicMock()
    api.php = MagicMock()
    api.database = MagicMock()
    api.runtimes_manager = MagicMock()
    api.project = MagicMock()
    return api


@pytest.fixture
def health_mgr(fake_root, mock_api):
    with patch("core.services.health_manager.get_project_root", return_value=fake_root):
        mgr = HealthManager(mock_api)
        return mgr


def test_cleanup_orphan_temp_files(health_mgr, fake_root):
    # Setup orphan temp folder and temp file
    bin_dir = os.path.join(fake_root, "bin")
    temp_folder = os.path.join(bin_dir, "apache", "temp_2.4.62")
    os.makedirs(temp_folder, exist_ok=True)
    with open(os.path.join(temp_folder, "partial.txt"), "w") as f:
        f.write("test")

    temp_file = os.path.join(bin_dir, "download.tmp")
    with open(temp_file, "w") as f:
        f.write("downloading")

    cleaned = health_mgr._cleanup_orphan_temp_files()
    assert cleaned >= 2
    assert not os.path.exists(temp_folder)
    assert not os.path.exists(temp_file)


def test_apache_health_check_happy_path(health_mgr, fake_root):
    apache_dir = os.path.join(fake_root, "bin", "apache", "2.4.62")
    bin_sub = os.path.join(apache_dir, "bin")
    conf_sub = os.path.join(apache_dir, "conf")
    os.makedirs(bin_sub, exist_ok=True)
    os.makedirs(conf_sub, exist_ok=True)

    exe_name = "httpd.exe" if sys.platform == 'win32' else "httpd"
    with open(os.path.join(bin_sub, exe_name), "w") as f:
        f.write("fake-binary")
    with open(os.path.join(conf_sub, "httpd.conf"), "w") as f:
        f.write("Listen 80")

    health_mgr.api.apache._get_installed_folders.return_value = {"2.4.62": "2.4.62"}

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_apache(is_online=True, result=result)

    assert result["healthy_count"] == 1
    assert len(result["recovered"]) == 0
    assert len(result["purged"]) == 0


def test_apache_health_check_config_restored(health_mgr, fake_root):
    apache_dir = os.path.join(fake_root, "bin", "apache", "2.4.62")
    bin_sub = os.path.join(apache_dir, "bin")
    conf_sub = os.path.join(apache_dir, "conf")
    os.makedirs(bin_sub, exist_ok=True)
    os.makedirs(conf_sub, exist_ok=True)

    exe_name = "httpd.exe" if sys.platform == 'win32' else "httpd"
    with open(os.path.join(bin_sub, exe_name), "w") as f:
        f.write("fake-binary")
    # httpd.conf is missing!

    health_mgr.api.apache._get_installed_folders.return_value = {"2.4.62": "2.4.62"}
    health_mgr.api.apache.restore_httpd_conf.return_value = True

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_apache(is_online=True, result=result)

    assert len(result["recovered"]) == 1
    assert result["recovered"][0]["type"] == "config_repaired"


def test_apache_health_check_binary_missing_deferred_offline(health_mgr, fake_root):
    apache_dir = os.path.join(fake_root, "bin", "apache", "2.4.62")
    os.makedirs(apache_dir, exist_ok=True)
    # Binary missing!

    health_mgr.api.apache._get_installed_folders.return_value = {"2.4.62": "2.4.62"}

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_apache(is_online=False, result=result)

    assert len(result["deferred_offline"]) == 1
    assert "2.4.62" in result["deferred_offline"][0]["module"]
    assert os.path.exists(apache_dir)  # Must NOT be deleted when offline!


def test_apache_health_check_binary_missing_online_recovery_success(health_mgr, fake_root):
    apache_dir = os.path.join(fake_root, "bin", "apache", "2.4.62")
    os.makedirs(apache_dir, exist_ok=True)

    health_mgr.api.apache._get_installed_folders.return_value = {"2.4.62": "2.4.62"}
    health_mgr.api.apache.get_available_versions.return_value = {
        "status": "success",
        "data": [{"version": "2.4.62", "url": "https://example.com/httpd.zip"}]
    }
    health_mgr.api.apache.install_version.return_value = {"status": "success"}

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_apache(is_online=True, result=result)

    assert len(result["recovered"]) == 1
    assert result["recovered"][0]["type"] == "binary_reinstalled"


def test_apache_health_check_binary_missing_unrecoverable_purge(health_mgr, fake_root):
    apache_dir = os.path.join(fake_root, "bin", "apache", "2.4.62")
    os.makedirs(apache_dir, exist_ok=True)

    health_mgr.api.apache._get_installed_folders.return_value = {"2.4.62": "2.4.62"}
    health_mgr.api.apache.get_available_versions.return_value = {
        "status": "success",
        "data": [{"version": "2.4.68", "url": "https://example.com/httpd-68.zip"}]  # 2.4.62 not available online!
    }

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_apache(is_online=True, result=result)

    assert len(result["purged"]) == 1
    assert not os.path.exists(apache_dir)  # Purged safely


def test_php_health_check_config_restored(health_mgr, fake_root):
    php_dir = os.path.join(fake_root, "bin", "php", "8.3.1")
    os.makedirs(php_dir, exist_ok=True)
    exe_name = "php-cgi.exe" if sys.platform == 'win32' else "php"
    with open(os.path.join(php_dir, exe_name), "w") as f:
        f.write("fake-php")
    # php.ini missing

    health_mgr.api.php._parse_php_ini_info.return_value = (9000, "128M")

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_php(is_online=True, result=result)

    assert len(result["recovered"]) == 1
    assert result["recovered"][0]["type"] == "config_repaired"
    health_mgr.api.php._write_default_php_ini.assert_called_once()


def test_database_health_check_preserves_data_on_purge(health_mgr, fake_root):
    # Setup database with installDir and dataDir
    install_dir = os.path.join(fake_root, "bin", "database", "mariadb-11.4")
    data_dir = os.path.join(fake_root, "bin", "database", "db_my_site")
    os.makedirs(install_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)

    # Put a valuable sql file in dataDir
    with open(os.path.join(data_dir, "ibdata1"), "w") as f:
        f.write("user table data")

    db_json = os.path.join(fake_root, "data", "databases.json")
    with open(db_json, "w") as f:
        json.dump([{
            "id": "mariadb_1",
            "name": "MariaDB 11.4",
            "engine": "mysql",
            "version": "11.4.1",
            "installDir": install_dir,
            "dataDir": data_dir,
            "port": 3306
        }], f)

    # Binary in installDir is missing!
    health_mgr.api.database.get_available_versions.return_value = {
        "status": "success",
        "data": [{"version": "11.5.0"}]  # 11.4.1 not available!
    }

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_databases(is_online=True, result=result)

    assert len(result["purged"]) == 1
    assert result["purged"][0]["preserved_data_path"] == data_dir
    # CRITICAL: dataDir MUST NOT be deleted!
    assert os.path.exists(data_dir)
    assert os.path.exists(os.path.join(data_dir, "ibdata1"))
    # installDir is purged
    assert not os.path.exists(install_dir)


def test_database_config_restored_in_datadir(health_mgr, fake_root):
    data_dir = os.path.join(fake_root, "bin", "database", "db_1")
    os.makedirs(data_dir, exist_ok=True)

    db_json = os.path.join(fake_root, "data", "databases.json")
    with open(db_json, "w") as f:
        json.dump([{
            "id": "mariadb_1",
            "name": "MariaDB 11.4",
            "engine": "mysql",
            "version": "11.4.1",
            "installDir": "",
            "dataDir": data_dir,
            "port": 3306
        }], f)

    health_mgr.api.database.ensure_instance_config.return_value = True

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_databases(is_online=False, result=result)

    assert any(r["type"] == "config_repaired" for r in result["recovered"])


def test_runtimes_health_check_reconcile_active_version(health_mgr, fake_root):
    node_dir = os.path.join(fake_root, "bin", "node", "20.11.0")
    os.makedirs(node_dir, exist_ok=True)
    exe_name = "node.exe" if sys.platform == 'win32' else "bin/node"
    if "/" in exe_name:
        os.makedirs(os.path.join(node_dir, "bin"), exist_ok=True)
    with open(os.path.join(node_dir, exe_name), "w") as f:
        f.write("fake-node")

    rt_config = {
        "active_versions": {"node": "18.0.0"},  # points to missing 18.0.0!
        "path_enabled": {"node": True}
    }
    health_mgr.api.runtimes_manager._get_config.return_value = rt_config

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_runtimes(is_online=True, result=result)

    assert result["healthy_count"] == 1
    health_mgr.api.runtimes_manager._save_config.assert_called_once()
    saved_cfg = health_mgr.api.runtimes_manager._save_config.call_args[0][0]
    assert saved_cfg["active_versions"]["node"] == "20.11.0"


def test_run_startup_health_check_full_flow(health_mgr):
    with patch("core.services.health_manager.check_internet_connection", return_value=True):
        res = health_mgr.run_startup_health_check()
        assert res["status"] == "success"
        assert "healthy_count" in res
        assert "recovered" in res
        assert "purged" in res
        assert "deferred_offline" in res
        # Check that bootstrap status was emitted
    assert health_mgr.api.emit_bootstrap_status.call_count >= 6


def test_tools_health_check_empty_glab_dir_does_not_purge(health_mgr, fake_root):
    glab_dir = os.path.join(fake_root, "bin", "glab")
    os.makedirs(glab_dir, exist_ok=True)

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert result["purged"] == []
    assert result["healthy_count"] == 0
    assert not os.path.exists(glab_dir)


def test_tools_health_check_corrupted_glab_purges(health_mgr, fake_root):
    glab_dir = os.path.join(fake_root, "bin", "glab")
    os.makedirs(glab_dir, exist_ok=True)
    with open(os.path.join(glab_dir, "corrupted.tmp"), "w") as f:
        f.write("corrupted data")

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert len(result["purged"]) == 1
    assert result["purged"][0]["module"] == "GitLab CLI (glab)"
    assert not os.path.exists(glab_dir)


def test_tools_health_check_healthy_glab(health_mgr, fake_root):
    glab_dir = os.path.join(fake_root, "bin", "glab")
    os.makedirs(glab_dir, exist_ok=True)
    exe_name = "glab.exe" if sys.platform == "win32" else "glab"
    with open(os.path.join(glab_dir, exe_name), "w") as f:
        f.write("mock-glab")

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert result["purged"] == []
    assert result["healthy_count"] == 1
    assert os.path.exists(glab_dir)


def test_tools_health_check_empty_git_dir_does_not_purge(health_mgr, fake_root):
    git_dir = os.path.join(fake_root, "bin", "git")
    os.makedirs(git_dir, exist_ok=True)

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert result["purged"] == []
    assert result["healthy_count"] == 0
    assert not os.path.exists(git_dir)


def test_tools_health_check_corrupted_git_purges(health_mgr, fake_root):
    git_dir = os.path.join(fake_root, "bin", "git")
    os.makedirs(git_dir, exist_ok=True)
    with open(os.path.join(git_dir, "damaged.txt"), "w") as f:
        f.write("damaged git")

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert len(result["purged"]) == 1
    assert result["purged"][0]["module"] == "Portable Git"
    assert not os.path.exists(git_dir)


def test_tools_health_check_healthy_git(health_mgr, fake_root):
    git_dir = os.path.join(fake_root, "bin", "git")
    cmd_dir = os.path.join(git_dir, "cmd")
    os.makedirs(cmd_dir, exist_ok=True)
    exe_name = "git.exe" if sys.platform == "win32" else "git"
    with open(os.path.join(cmd_dir, exe_name), "w") as f:
        f.write("mock-git")

    result = {"healthy_count": 0, "recovered": [], "purged": [], "deferred_offline": []}
    health_mgr._check_and_heal_tools(_is_online=True, result=result)

    assert result["purged"] == []
    assert result["healthy_count"] == 1
    assert os.path.exists(git_dir)
