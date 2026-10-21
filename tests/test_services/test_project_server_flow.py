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
    Full Flow Test:
    1. Scaffolding / generate starter files for Python Native
    2. Start the dev server in a background process
    3. Send HTTP request to http://127.0.0.1:{port}/
    4. Assert HTTP 200 and Welcome text
    5. Terminate the server and assert port is cleanly released
    """
    port = _find_free_port()
    project_dir = str(tmp_path / "py_native")
    os.makedirs(project_dir, exist_ok=True)

    project_manager._write_python_starter_files("python-raw", project_dir, port, use_venv=False)

    main_py = os.path.join(project_dir, "main.py")
    assert os.path.exists(main_py)
    start_bat = os.path.join(project_dir, "start-dev.bat")
    assert os.path.exists(start_bat)

    # Launch server
    proc = subprocess.Popen([sys.executable, main_py], cwd=project_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        assert _wait_for_server(port, timeout=8.0), f"Python server failed to listen on port {port}"

        # Access server via HTTP
        url = f"http://127.0.0.1:{port}/"
        with urllib.request.urlopen(url, timeout=5) as resp:
            assert resp.status == 200
            content = resp.read().decode("utf-8")
            assert "Welcome to VyloServe (Python)" in content
    finally:
        # Graceful shutdown
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

    # Port should now be free
    time.sleep(0.5)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        res = s.connect_ex(('127.0.0.1', port))
        assert res != 0, f"Port {port} was not released after server shutdown"


def test_go_native_server_full_flow(project_manager, tmp_path):
    """
    Full Flow Test for Go Server:
    1. Check if Go executable is available
    2. Scaffolding Go starter files (net/http)
    3. Run 'go run main.go'
    4. Assert HTTP 200 response
    5. Terminate Go process cleanly
    """
    go_exe = project_manager._resolve_runtime_bin("go", "go.exe")
    if not go_exe or not os.path.exists(go_exe):
        try:
            res = subprocess.run(["where.exe", "go"], capture_output=True, text=True)
            if res.returncode == 0:
                go_exe = res.stdout.strip().splitlines()[0]
        except Exception:
            pass
    if not go_exe or not os.path.exists(go_exe):
        pytest.skip("Go runtime not installed, skipping real compilation flow test")

    port = _find_free_port()
    project_dir = str(tmp_path / "go_native")
    os.makedirs(project_dir, exist_ok=True)

    # Initialize go module
    custom_env = os.environ.copy()
    go_bin_dir = os.path.dirname(go_exe)
    custom_env["PATH"] = go_bin_dir + os.pathsep + custom_env.get("PATH", "")
    custom_env["GOROOT"] = os.path.dirname(go_bin_dir)

    init_res = subprocess.run([go_exe, "mod", "init", "gonativetest"], cwd=project_dir, env=custom_env, capture_output=True)
    assert init_res.returncode == 0

    project_manager._write_go_starter_files("go-raw", project_dir, port)
    main_go = os.path.join(project_dir, "main.go")
    assert os.path.exists(main_go)

    proc = subprocess.Popen([go_exe, "run", "main.go"], cwd=project_dir, env=custom_env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        assert _wait_for_server(port, timeout=15.0), f"Go server failed to listen on port {port}"
        url = f"http://127.0.0.1:{port}/"
        with urllib.request.urlopen(url, timeout=5) as resp:
            assert resp.status == 200
            content = resp.read().decode("utf-8")
            assert "Welcome to VyloServe (Go)" in content
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def test_java_native_server_full_flow(project_manager, tmp_path):
    """
    Full Flow Test for Java Native Server:
    1. Check if Java executable is available
    2. Scaffolding Java starter files (Main.java)
    3. Run 'java Main.java'
    4. Assert HTTP 200 response
    5. Terminate Java process cleanly
    """
    java_exe = project_manager._resolve_runtime_bin("java", "java.exe")
    if not java_exe or not os.path.exists(java_exe):
        # Fallback check where.exe java
        try:
            res = subprocess.run(["where.exe", "java"], capture_output=True, text=True)
            if res.returncode == 0:
                java_exe = res.stdout.strip().splitlines()[0]
        except Exception:
            pass

    if not java_exe or not os.path.exists(java_exe):
        pytest.skip("Java runtime not installed, skipping real execution flow test")

    port = _find_free_port()
    project_dir = str(tmp_path / "java_native")
    os.makedirs(project_dir, exist_ok=True)

    with patch.object(project_manager, "_resolve_runtime_bin", return_value=java_exe):
        res = project_manager._install_java_project("java-raw", project_dir, "", port)
        assert res["status"] == "success"

    main_java = os.path.join(project_dir, "Main.java")
    assert os.path.exists(main_java)

    proc = subprocess.Popen([java_exe, "Main.java"], cwd=project_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        assert _wait_for_server(port, timeout=12.0), f"Java server failed to listen on port {port}"
        url = f"http://127.0.0.1:{port}/"
        with urllib.request.urlopen(url, timeout=5) as resp:
            assert resp.status == 200
            content = resp.read().decode("utf-8")
            assert "Welcome to VyloServe (Java)" in content
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


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
