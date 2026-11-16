import os
import shutil
import tempfile
import pytest
from unittest.mock import MagicMock
from core.services.project import ProjectManager
from core.api import Api


@pytest.fixture
def temp_project_dir():
    temp_dir = tempfile.mkdtemp(prefix="vylo_proj_env_")
    # Structure:
    # temp_dir/
    #   .env
    #   .env.example
    env_content = "APP_NAME=VyloServe\nAPP_ENV=local\nDB_PASSWORD=secret123\n"
    example_content = "APP_NAME=VyloServe\nAPP_ENV=production\nDB_PASSWORD=\nREDIS_HOST=127.0.0.1\nJWT_SECRET=supersecret\n"

    with open(os.path.join(temp_dir, ".env"), "w", encoding="utf-8") as f:
        f.write(env_content)
    with open(os.path.join(temp_dir, ".env.example"), "w", encoding="utf-8") as f:
        f.write(example_content)

    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def project_manager(temp_project_dir):
    api = MagicMock()
    mgr = ProjectManager(api)
    mgr.base_dir = os.path.join(temp_project_dir, "_data")
    os.makedirs(mgr.base_dir, exist_ok=True)
    # Mock _read_projects to return a project pointing to temp_project_dir
    mgr._read_projects = MagicMock(return_value=[
        {
            "id": "proj_test_1",
            "name": "my-test-app",
            "path": temp_project_dir,
            "framework": "laravel",
        }
    ])
    return mgr


def test_parse_env_text():
    sample = """
    # General Config
    APP_NAME="VyloServe Desktop"
    APP_DEBUG=true
    export DB_PASSWORD='my#super#secret'
    JWT_SECRET=super_token_123
    CACHE_DRIVER=file
    """
    items, kv_map = ProjectManager._parse_env_text(sample)
    assert len(items) == 5
    assert kv_map["APP_NAME"] == "VyloServe Desktop"
    assert kv_map["DB_PASSWORD"] == "my#super#secret"
    assert kv_map["JWT_SECRET"] == "super_token_123"

    sensitive_keys = {item["key"] for item in items if item["is_sensitive"]}
    assert "DB_PASSWORD" in sensitive_keys
    assert "JWT_SECRET" in sensitive_keys
    assert "APP_NAME" not in sensitive_keys


def test_get_project_env_details_happy_path(project_manager, temp_project_dir):
    res = project_manager.get_project_env_details("proj_test_1")
    assert res["status"] == "success"
    assert res["has_env"] is True
    assert res["has_example"] is True
    assert res["total_env_keys"] == 3
    assert res["total_example_keys"] == 5

    # Missing keys in .env that exist in .env.example: REDIS_HOST, JWT_SECRET
    missing = [m["key"] for m in res["missing_keys"]]
    assert "REDIS_HOST" in missing
    assert "JWT_SECRET" in missing
    assert "APP_NAME" not in missing


def test_get_project_env_details_project_not_found(project_manager):
    res = project_manager.get_project_env_details("non_existent_project")
    assert res["status"] == "error"
    assert res["message"] == "backend.project.project_not_found"


def test_save_project_env_and_snapshot(project_manager, temp_project_dir):
    new_content = "APP_NAME=VyloServeUpdated\nPORT=3000\n"
    res = project_manager.save_project_env("proj_test_1", new_content, create_snapshot=True)
    assert res["status"] == "success"
    assert res["snapshot_created"] is True

    # Verify content was updated on disk
    with open(os.path.join(temp_project_dir, ".env"), "r", encoding="utf-8") as f:
        assert f.read() == new_content

    # Verify snapshot exists
    snap_res = project_manager.list_project_env_snapshots("proj_test_1")
    assert snap_res["status"] == "success"
    assert len(snap_res["snapshots"]) >= 1


def test_restore_project_env_snapshot(project_manager, temp_project_dir):
    original_content = "ORIGINAL_KEY=original_val\n"
    project_manager.save_project_env("proj_test_1", original_content, create_snapshot=True)

    # Change to modified content
    modified_content = "MODIFIED_KEY=modified_val\n"
    project_manager.save_project_env("proj_test_1", modified_content, create_snapshot=True)

    snapshots = project_manager.list_project_env_snapshots("proj_test_1")["snapshots"]
    assert len(snapshots) >= 2
    # The snapshot created before applying modified_content captured original_content
    snap_with_original = snapshots[0]["id"]

    # Restore snapshot
    restore_res = project_manager.restore_project_env_snapshot("proj_test_1", snap_with_original)
    assert restore_res["status"] == "success"

    with open(os.path.join(temp_project_dir, ".env"), "r", encoding="utf-8") as f:
        restored = f.read()
        assert "ORIGINAL_KEY" in restored


def test_sync_project_env_example_keys(project_manager, temp_project_dir):
    sync_res = project_manager.sync_project_env_example_keys("proj_test_1", keys_to_sync=["REDIS_HOST"])
    assert sync_res["status"] == "success"

    with open(os.path.join(temp_project_dir, ".env"), "r", encoding="utf-8") as f:
        content = f.read()
        assert "REDIS_HOST=127.0.0.1" in content
        assert "Synced from .env.example" in content


def test_api_facade_project_env(project_manager):
    api = Api()
    api.project = project_manager

    details = api.get_project_env_details("proj_test_1")
    assert details["status"] == "success"

    saved = api.save_project_env("proj_test_1", "TEST=1", create_snapshot=False)
    assert saved["status"] == "success"

    snaps = api.list_project_env_snapshots("proj_test_1")
    assert snaps["status"] == "success"
