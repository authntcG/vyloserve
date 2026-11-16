import os
import shutil
import tempfile
import pytest
from unittest.mock import MagicMock
from core.services.project import ProjectManager
from core.api import Api


@pytest.fixture
def temp_project_dir():
    temp_dir = tempfile.mkdtemp(prefix="vylo_proj_logs_")
    # Structure:
    # temp_dir/
    #   storage/logs/laravel.log
    #   logs/worker.log
    #   error.log
    #   node_modules/bad.log (should be ignored)
    storage_logs = os.path.join(temp_dir, "storage", "logs")
    os.makedirs(storage_logs, exist_ok=True)
    with open(os.path.join(storage_logs, "laravel.log"), "w", encoding="utf-8") as f:
        f.write("[2026-11-14 10:00:00] local.INFO: App booted successfully.\n"
                "[2026-11-14 10:05:00] local.ERROR: Database connection failed.\n")

    logs_dir = os.path.join(temp_dir, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    with open(os.path.join(logs_dir, "worker.log"), "w", encoding="utf-8") as f:
        f.write("[2026-11-14 10:01:00] queue.INFO: Worker started.\n")

    # Node modules log (should be ignored)
    nm_dir = os.path.join(temp_dir, "node_modules", "pkg")
    os.makedirs(nm_dir, exist_ok=True)
    with open(os.path.join(nm_dir, "bad.log"), "w", encoding="utf-8") as f:
        f.write("ignore me\n")

    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def project_manager(temp_project_dir):
    api = MagicMock()
    mgr = ProjectManager(api)
    mgr.base_dir = os.path.join(temp_project_dir, "_data")
    os.makedirs(mgr.base_dir, exist_ok=True)
    mgr._read_projects = MagicMock(return_value=[
        {
            "id": "proj_logs_1",
            "name": "my-log-app",
            "path": temp_project_dir,
            "framework": "laravel",
        }
    ])
    return mgr


def test_list_project_log_files_happy_path(project_manager):
    res = project_manager.list_project_log_files("proj_logs_1")
    assert res["status"] == "success"
    log_files = res["log_files"]
    paths = [item["path"].replace("\\", "/") for item in log_files]

    assert "storage/logs/laravel.log" in paths
    assert "logs/worker.log" in paths
    assert not any("node_modules" in p for p in paths)


def test_list_project_log_files_not_found(project_manager):
    res = project_manager.list_project_log_files("non_existent")
    assert res["status"] == "error"
    assert res["message"] == "backend.project.project_not_found"


def test_get_project_app_logs_tail(project_manager):
    res = project_manager.get_project_app_logs("proj_logs_1", "storage/logs/laravel.log")
    assert res["status"] == "success"
    assert len(res["lines"]) == 2
    assert "local.INFO: App booted" in res["lines"][0]
    assert "local.ERROR: Database connection failed." in res["lines"][1]
    assert res["offset"] > 0


def test_get_project_app_logs_incremental(project_manager, temp_project_dir):
    res1 = project_manager.get_project_app_logs("proj_logs_1", "storage/logs/laravel.log")
    initial_offset = res1["offset"]

    # Append new log line to laravel.log
    log_file = os.path.join(temp_project_dir, "storage", "logs", "laravel.log")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write("[2026-11-14 10:10:00] local.WARNING: Slow query detected.\n")

    res2 = project_manager.get_project_app_logs("proj_logs_1", "storage/logs/laravel.log", offset=initial_offset)
    assert res2["status"] == "success"
    assert len(res2["lines"]) == 1
    assert "Slow query detected." in res2["lines"][0]
    assert res2["offset"] > initial_offset


def test_get_project_app_logs_path_traversal(project_manager):
    # Attempt directory traversal
    res = project_manager.get_project_app_logs("proj_logs_1", "../../secret.log")
    assert res["status"] == "error"
    assert res["message"] == "backend.error.path_traversal"

    # Attempt non-.log file
    res2 = project_manager.get_project_app_logs("proj_logs_1", ".env")
    assert res2["status"] == "error"
    assert res2["message"] == "backend.error.path_traversal"


def test_get_project_app_logs_not_found(project_manager):
    res = project_manager.get_project_app_logs("proj_logs_1", "storage/logs/missing.log")
    assert res["status"] == "error"
    assert res["message"] == "backend.project.log_file_not_found"


def test_clear_project_app_log(project_manager, temp_project_dir):
    res = project_manager.clear_project_app_log("proj_logs_1", "storage/logs/laravel.log")
    assert res["status"] == "success"
    assert res["message"] == "backend.project.log_cleared"

    log_file = os.path.join(temp_project_dir, "storage", "logs", "laravel.log")
    assert os.path.getsize(log_file) == 0


def test_clear_project_app_log_traversal(project_manager):
    res = project_manager.clear_project_app_log("proj_logs_1", "../../../etc/passwd.log")
    assert res["status"] == "error"
    assert res["message"] == "backend.error.path_traversal"


def test_api_facade_project_app_logs(project_manager):
    api = Api()
    api.project = project_manager

    res = api.list_project_log_files("proj_logs_1")
    assert res["status"] == "success"

    res_logs = api.get_project_app_logs("proj_logs_1", "storage/logs/laravel.log")
    assert res_logs["status"] == "success"

    res_clear = api.clear_project_app_log("proj_logs_1", "storage/logs/laravel.log")
    assert res_clear["status"] == "success"
