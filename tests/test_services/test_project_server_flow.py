import os
import sys
import time
import socket
import signal
import subprocess
import urllib.request
import urllib.error
import pytest
from unittest.mock import MagicMock, patch
from core.services.project import ProjectManager


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def _wait_for_server(port: int, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.2)
    return False


@pytest.fixture
def project_manager(tmp_path):
    mock_api = MagicMock()
    with patch("core.services.project.get_project_root", return_value=str(tmp_path)):
        pm = ProjectManager(mock_api)
        return pm


def test_python_native_server_full_flow(project_manager, tmp_path):
    """
    Test scaffolding and execution flow for Python Native Server:
    1. Scaffolding / generate starter files for Python Native
    2. Verify main.py and start-dev.bat contents
    3. Simulate server launch and verify process call
    """
    port = 8081
    project_dir = str(tmp_path / "py_native")
    os.makedirs(project_dir, exist_ok=True)

    project_manager._write_python_starter_files("python-raw", project_dir, port, use_venv=False)

    main_py = os.path.join(project_dir, "main.py")
    assert os.path.exists(main_py)
    with open(main_py, "r", encoding="utf-8") as f:
        content = f.read()
    assert f"port = {port}" in content
    assert "Welcome to VyloServe (Python)" in content

    start_bat = os.path.join(project_dir, "start-dev.bat")
    assert os.path.exists(start_bat)

    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.pid = 12345

    with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
        proc = subprocess.Popen([sys.executable, main_py], cwd=project_dir)
        assert proc.pid == 12345
        mock_popen.assert_called_once_with([sys.executable, main_py], cwd=project_dir)


def test_go_native_server_full_flow(project_manager, tmp_path):
    """
    Test scaffolding and execution flow for Go Server:
    1. Resolve Go executable
    2. Scaffolding Go starter files (net/http)
    3. Verify main.go content
    4. Simulate go run process
    """
    port = 8082
    project_dir = str(tmp_path / "go_native")
    os.makedirs(project_dir, exist_ok=True)

    fake_go = "C:/Program Files/Go/bin/go.exe" if sys.platform == "win32" else "/usr/local/go/bin/go"
    with patch.object(project_manager, "_resolve_runtime_bin", return_value=fake_go):
        go_exe = project_manager._resolve_runtime_bin("go", "go.exe")
        assert go_exe == fake_go

    project_manager._write_go_starter_files("go-raw", project_dir, port)
    main_go = os.path.join(project_dir, "main.go")
    assert os.path.exists(main_go)
    with open(main_go, "r", encoding="utf-8") as f:
        content = f.read()
    assert f":{port}" in content
    assert "Welcome to VyloServe (Go)" in content

    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.pid = 23456

    with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
        proc = subprocess.Popen([fake_go, "run", "main.go"], cwd=project_dir)
        assert proc.pid == 23456
        mock_popen.assert_called_once_with([fake_go, "run", "main.go"], cwd=project_dir)


def test_java_native_server_full_flow(project_manager, tmp_path):
    """
    Test scaffolding and execution flow for Java Native Server:
    1. Resolve Java executable
    2. Scaffolding Java starter files (Main.java)
    3. Verify Main.java content
    4. Simulate java Main.java process
    """
    port = 8083
    project_dir = str(tmp_path / "java_native")
    os.makedirs(project_dir, exist_ok=True)

    fake_java = "C:/Program Files/Java/bin/java.exe" if sys.platform == "win32" else "/usr/bin/java"
    with patch.object(project_manager, "_resolve_runtime_bin", return_value=fake_java):
        res = project_manager._install_java_project("java-raw", project_dir, "", port)
        assert res["status"] == "success"

    main_java = os.path.join(project_dir, "Main.java")
    assert os.path.exists(main_java)
    with open(main_java, "r", encoding="utf-8") as f:
        content = f.read()
    assert f"{port}" in content
    assert "Welcome to VyloServe (Java)" in content

    mock_proc = MagicMock()
    mock_proc.poll.return_value = None
    mock_proc.pid = 34567

    with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
        proc = subprocess.Popen([fake_java, "Main.java"], cwd=project_dir)
        assert proc.pid == 34567
        mock_popen.assert_called_once_with([fake_java, "Main.java"], cwd=project_dir)


def test_django_scaffolding_and_settings_flow(project_manager, tmp_path):
    """
    Tests Django project scaffolding, settings allowed hosts patching,
    and start-dev.bat generation.
    """
    port = 8000
    project_dir = str(tmp_path / "django_proj")
    os.makedirs(project_dir, exist_ok=True)

    # Mock django startproject execution
    with patch.object(project_manager, "_resolve_runtime_bin", return_value="C:/Python310/python.exe"), \
         patch.object(project_manager, "_run_cli_or_pty", return_value=(True, "")) as mock_run:
        # Simulate that django startproject created config/settings.py
        config_dir = os.path.join(project_dir, "config")
        os.makedirs(config_dir, exist_ok=True)
        settings_path = os.path.join(config_dir, "settings.py")
        with open(settings_path, "w", encoding="utf-8") as f:
            f.write("DEBUG = True\nALLOWED_HOSTS = []\n")

        res = project_manager._install_python_project("django", project_dir, "", port, use_venv=True)
        assert res["status"] == "success"

        # Check patched settings
        with open(settings_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "ALLOWED_HOSTS = ['*']" in content

        # Check start-dev.bat
        bat_path = os.path.join(project_dir, "start-dev.bat")
        assert os.path.exists(bat_path)
        with open(bat_path, "r", encoding="utf-8") as f:
            bat_content = f.read()
        assert "call .venv\\Scripts\\activate.bat" in bat_content
        assert "python manage.py runserver 127.0.0.1:8000" in bat_content
        assert "pause" in bat_content
