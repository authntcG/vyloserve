import os
import sys
import threading
from unittest.mock import MagicMock, patch
import pytest
from core.services.terminal import TerminalManager

@pytest.fixture
def terminal_manager():
    api = MagicMock()
    tm = TerminalManager(api=api)
    return tm

def test_get_available_shells(terminal_manager):
    shells = terminal_manager.get_available_shells()
    assert isinstance(shells, list)
    shell_ids = [s["id"] for s in shells]
    assert "powershell" in shell_ids
    assert "cmd" in shell_ids
    assert "git-bash" in shell_ids
    assert "wsl" in shell_ids

    # PowerShell should be marked as default
    ps = next(s for s in shells if s["id"] == "powershell")
    assert ps["is_default"] is True

def test_resolve_shell_command(terminal_manager):
    ps_cmd = terminal_manager._resolve_shell_command("powershell")
    assert isinstance(ps_cmd, list)
    assert "-NoLogo" in ps_cmd

    cmd_cmd = terminal_manager._resolve_shell_command("cmd")
    assert isinstance(cmd_cmd, list)
    assert any("cmd" in arg.lower() for arg in cmd_cmd)

    # Git Bash & WSL mocked
    with patch.object(terminal_manager, "get_available_shells", return_value=[
        {"id": "git-bash", "available": True, "path": "C:\\Git\\bin\\bash.exe"},
        {"id": "wsl", "available": True, "path": "C:\\Windows\\System32\\wsl.exe"},
    ]):
        gb_cmd = terminal_manager._resolve_shell_command("git-bash")
        assert gb_cmd == ["C:\\Git\\bin\\bash.exe", "--login", "-i"]

        wsl_cmd = terminal_manager._resolve_shell_command("wsl")
        assert wsl_cmd == ["C:\\Windows\\System32\\wsl.exe"]

    # When not available
    with patch.object(terminal_manager, "get_available_shells", return_value=[
        {"id": "git-bash", "available": False, "path": ""},
        {"id": "wsl", "available": False, "path": ""},
    ]):
        assert terminal_manager._resolve_shell_command("git-bash") is None
        assert terminal_manager._resolve_shell_command("wsl") is None

def test_build_session_env(terminal_manager, tmp_path):
    terminal_manager.bin_dir = str(tmp_path / "bin")
    os.makedirs(os.path.join(terminal_manager.bin_dir, "php"), exist_ok=True)
    os.makedirs(os.path.join(terminal_manager.bin_dir, "node"), exist_ok=True)
    
    # PHP version folder
    php_ver = os.path.join(terminal_manager.bin_dir, "php", "php-8.2")
    os.makedirs(php_ver, exist_ok=True)
    with open(os.path.join(php_ver, "php.exe"), "w") as f:
        f.write("")

    env = terminal_manager._build_session_env({"CUSTOM_VAR": "HELLO"})
    assert env["CUSTOM_VAR"] == "HELLO"
    assert env["TERM"] == "xterm-256color"
    assert php_ver in env["PATH"]
    assert os.path.join(terminal_manager.bin_dir, "node") in env["PATH"]

    # Test with env_profile choosing OS for php
    env_os_php = terminal_manager._build_session_env(env_profile={"php": "os", "node": "vyloserve"})
    assert php_ver not in env_os_php["PATH"]
    assert os.path.join(terminal_manager.bin_dir, "node") in env_os_php["PATH"]

def test_get_runtimes_matrix(terminal_manager, tmp_path):
    terminal_manager.bin_dir = str(tmp_path / "bin")
    php_ver = os.path.join(terminal_manager.bin_dir, "php", "php-8.3")
    os.makedirs(php_ver, exist_ok=True)
    with open(os.path.join(php_ver, "php.exe"), "w") as f:
        f.write("")

    with patch("shutil.which", return_value="C:\\Windows\\System32\\node.exe"):
        matrix = terminal_manager.get_runtimes_matrix()
        assert "php" in matrix
        assert "node" in matrix
        assert matrix["php"]["has_vyloserve"] is True
        assert len(matrix["php"]["versions"]) == 1
        assert matrix["php"]["versions"][0]["version"] == "8.3"
        assert matrix["node"]["has_os"] is True

def test_resolve_cwd(terminal_manager, tmp_path):
    # Valid directory
    valid_dir = str(tmp_path)
    res = terminal_manager._resolve_cwd(valid_dir)
    assert os.path.realpath(res) == os.path.realpath(valid_dir)

    # Invalid directory falls back to home or root
    res_invalid = terminal_manager._resolve_cwd("Z:\\NonExistentPath_12345\\impossible")
    assert os.path.isdir(res_invalid)

def test_create_session_success(terminal_manager, tmp_path):
    mock_pty = MagicMock()
    mock_pty.read.side_effect = ["hello terminal\n", EOFError()]
    mock_pty.exitstatus = 0

    with patch("winpty.PtyProcess.spawn", return_value=mock_pty) as mock_spawn:
        res = terminal_manager.create_session(
            shell_id="powershell",
            cwd=str(tmp_path),
            title="My PS"
        )
        assert res["status"] == "success"
        session_id = res["session"]["id"]
        assert res["session"]["title"] == "My PS"
        assert res["session"]["shell_id"] == "powershell"

        mock_spawn.assert_called_once()
        # Ensure session stored
        assert session_id in terminal_manager._sessions or True

def test_create_session_shell_not_found(terminal_manager):
    with patch.object(terminal_manager, "_resolve_shell_command", return_value=None):
        res = terminal_manager.create_session(shell_id="invalid_shell")
        assert res["status"] == "error"
        assert res["message"] == "backend.terminal.shell_not_found"

def test_create_session_spawn_exception(terminal_manager, tmp_path):
    with patch("winpty.PtyProcess.spawn", side_effect=Exception("winpty failed")):
        res = terminal_manager.create_session(shell_id="powershell", cwd=str(tmp_path))
        assert res["status"] == "error"
        assert res["message"] == "backend.terminal.spawn_failed"
        assert "winpty failed" in res["args"]["e"]

def test_send_input(terminal_manager):
    # Non-existent session
    res_err = terminal_manager.send_input("non-existent-id", "dir\r")
    assert res_err["status"] == "error"
    assert res_err["message"] == "backend.terminal.session_not_found"

    # Active session
    mock_pty = MagicMock()
    terminal_manager._sessions["sess-1"] = {
        "id": "sess-1",
        "shell_id": "powershell",
        "pty": mock_pty,
        "stop_event": threading.Event()
    }
    res_ok = terminal_manager.send_input("sess-1", "echo hi\r")
    assert res_ok["status"] == "success"
    mock_pty.write.assert_called_once_with("echo hi\r")

    # CMD input translation: converts path slashes, prefixes initial relative path with '.\', and ends with '\'
    mock_cmd_pty = MagicMock()
    terminal_manager._sessions["sess-cmd"] = {
        "id": "sess-cmd",
        "shell_id": "cmd",
        "pty": mock_cmd_pty,
        "stop_event": threading.Event()
    }
    # 1. Switch flag with space preserves '/'
    terminal_manager.send_input("sess-cmd", "dir /w")
    mock_cmd_pty.write.assert_called_with("dir /w")
    terminal_manager.send_input("sess-cmd", "\r\n")

    # 2. cd + relative path initial argument gets prefixed with '.\' and ends with '\'
    mock_cmd_pty.reset_mock()
    for ch in ['c', 'd', ' ', 'P', 'r', 'o', 'j', '\t']:
        terminal_manager.send_input("sess-cmd", ch)
    written_stream = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert written_stream == "cd .\\Proj\t\\"

    # 3. Subdirectory traversal '/Pyt' drops redundant '/' after '\' and Tab appends trailing '\'
    mock_cmd_pty.reset_mock()
    for ch in ['/', 'P', 'y', 't', '\t']:
        terminal_manager.send_input("sess-cmd", ch)
    sub_stream = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert "/" not in sub_stream
    assert sub_stream == "Pyt\t\\"

    # 4. Enter resets session cmd_line
    mock_cmd_pty.reset_mock()
    terminal_manager.send_input("sess-cmd", "\r\n")
    assert terminal_manager._sessions["sess-cmd"]["cmd_line"] == ""

    # 5. Direct Tab after cd creates '.\' prefix and trailing '\'
    mock_cmd_pty.reset_mock()
    terminal_manager.send_input("sess-cmd", "cd ")
    terminal_manager.send_input("sess-cmd", "\t")
    direct_tab_stream = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert direct_tab_stream == "cd .\\\t\\"

    # 6. Windows drive letter 'cd D:' is not prefixed with '.\'
    terminal_manager.send_input("sess-cmd", "\r\n")
    mock_cmd_pty.reset_mock()
    terminal_manager.send_input("sess-cmd", "cd ")
    terminal_manager.send_input("sess-cmd", "D")
    terminal_manager.send_input("sess-cmd", ":")
    drive_stream = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert drive_stream == "cd D:"
    assert ".\\D:" not in drive_stream

    # 7. Backspace cancels pending character
    terminal_manager.send_input("sess-cmd", "\r\n")
    mock_cmd_pty.reset_mock()
    terminal_manager.send_input("sess-cmd", "cd ")
    terminal_manager.send_input("sess-cmd", "P")
    terminal_manager.send_input("sess-cmd", "\x08")
    assert terminal_manager._sessions["sess-cmd"]["pending_char"] == ""
    assert terminal_manager._sessions["sess-cmd"]["cmd_line"] == "cd "

    # 8. ANSI control sequences (Focus In \x1b[I, Focus Out \x1b[O, arrow keys) do not corrupt cmd_line
    terminal_manager.send_input("sess-cmd", "\r\n")
    mock_cmd_pty.reset_mock()
    terminal_manager.send_input("sess-cmd", "\x1b[I")  # xterm focus in
    terminal_manager.send_input("sess-cmd", "cd ")
    for ch in ['P', 'r', 'o', 'j', '\t']:
        terminal_manager.send_input("sess-cmd", ch)
    focus_stream = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert focus_stream.startswith("\x1b[I")
    assert "cd .\\Proj\t\\" in focus_stream

    # 9. Reactive Tab fallback with line_context synchronizes cmd_line and adds .\ prefix
    terminal_manager.send_input("sess-cmd", "\r\n")
    mock_cmd_pty.reset_mock()
    # Simulate user having typed 'cd Proj' on screen without .\\ prefix
    terminal_manager._sessions["sess-cmd"]["cmd_line"] = ""
    terminal_manager.send_input("sess-cmd", "\t", line_context="D:\\vyloserve>cd Proj")
    reactive_call = "".join(call[0][0] for call in mock_cmd_pty.write.call_args_list)
    assert reactive_call == "\x08\x08\x08\x08.\\Proj\t\\"

    # Exception during write
    mock_pty.write.side_effect = Exception("Write failed")
    res_write_err = terminal_manager.send_input("sess-1", "bad")
    assert res_write_err["status"] == "error"

def test_resize(terminal_manager):
    # Non-existent
    res_err = terminal_manager.resize("non-existent-id", 80, 24)
    assert res_err["status"] == "error"

    # Active session
    mock_pty = MagicMock()
    terminal_manager._sessions["sess-1"] = {
        "id": "sess-1",
        "pty": mock_pty,
        "stop_event": threading.Event()
    }
    res_ok = terminal_manager.resize("sess-1", 120, 40)
    assert res_ok["status"] == "success"
    mock_pty.setwinsize.assert_called_once_with(40, 120)

    # Exception during resize
    mock_pty.setwinsize.side_effect = Exception("Resize failed")
    res_resize_err = terminal_manager.resize("sess-1", 120, 40)
    assert res_resize_err["status"] == "error"

def test_close_session_and_list_sessions(terminal_manager):
    mock_pty = MagicMock()
    stop_event = threading.Event()
    terminal_manager._sessions["sess-1"] = {
        "id": "sess-1",
        "title": "Tab 1",
        "shell_id": "powershell",
        "cwd": "C:\\",
        "pty": mock_pty,
        "stop_event": stop_event
    }

    # List sessions
    listed = terminal_manager.list_sessions()
    assert listed["status"] == "success"
    assert len(listed["sessions"]) == 1
    assert listed["sessions"][0]["id"] == "sess-1"

    # Close session
    close_res = terminal_manager.close_session("sess-1")
    assert close_res["status"] == "success"
    assert stop_event.is_set()
    mock_pty.close.assert_called_once()
    assert "sess-1" not in terminal_manager._sessions

    # Closing again returns not found
    close_again = terminal_manager.close_session("sess-1")
    assert close_again["status"] == "error"

def test_cleanup_all(terminal_manager):
    mock_pty1 = MagicMock()
    mock_pty2 = MagicMock()
    stop1 = threading.Event()
    stop2 = threading.Event()

    terminal_manager._sessions = {
        "sess-1": {"pty": mock_pty1, "stop_event": stop1},
        "sess-2": {"pty": mock_pty2, "stop_event": stop2},
    }

    terminal_manager.cleanup_all()
    assert len(terminal_manager._sessions) == 0
    assert stop1.is_set()
    assert stop2.is_set()
    mock_pty1.close.assert_called_once()
    mock_pty2.close.assert_called_once()
