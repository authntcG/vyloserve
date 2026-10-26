import os
import shutil
import pytest
from unittest.mock import MagicMock
from core.services.terminal import TerminalManager
from core.api import Api

@pytest.fixture
def temp_tm(tmp_path):
    api = MagicMock()
    tm = TerminalManager(api=api)
    tm.root_dir = str(tmp_path)
    os.makedirs(os.path.join(tm.root_dir, "data"), exist_ok=True)
    return tm

def test_get_terminal_config_default(temp_tm):
    res = temp_tm.get_terminal_config()
    assert res["status"] == "success"
    assert res["config"]["default_profile"] == {}

def test_save_terminal_default_profile(temp_tm):
    # Invalid input
    err = temp_tm.save_terminal_default_profile("invalid")
    assert err["status"] == "error"
    assert err["message"] == "backend.terminal.invalid_profile"

    # Valid profile
    profile = {"php": "D:/bin/php-8.3", "node": "os"}
    res = temp_tm.save_terminal_default_profile(profile)
    assert res["status"] == "success"
    assert res["message"] == "backend.terminal.config_saved"
    assert res["config"]["default_profile"] == profile

    # Verify retrieval
    cfg = temp_tm.get_terminal_config()
    assert cfg["config"]["default_profile"] == profile

def test_get_saved_sessions_empty(temp_tm):
    res = temp_tm.get_saved_sessions()
    assert res["status"] == "success"
    assert res["presets"] == []
    assert res["workspaces"] == []

def test_save_preset_validation_errors(temp_tm):
    # Non-dict
    assert temp_tm.save_preset("invalid")["status"] == "error"
    # Empty name
    assert temp_tm.save_preset({"name": "   "})["status"] == "error"

def test_save_and_update_preset(temp_tm, tmp_path):
    project_dir = tmp_path / "my_project"
    project_dir.mkdir()

    preset_data = {
        "name": "Backend API",
        "shell_id": "powershell",
        "cwd": str(project_dir),
        "envProfile": {"php": "D:/php-8.2"},
        "color": "sky",
        "icon": "dns"
    }

    res = temp_tm.save_preset(preset_data)
    assert res["status"] == "success"
    assert res["message"] == "backend.terminal.preset_saved"
    created = res["preset"]
    assert created["name"] == "Backend API"
    assert created["cwd"] == str(project_dir.resolve())
    assert created["color"] == "sky"
    assert created["icon"] == "dns"
    preset_id = created["id"]

    # Verify presence in list
    sessions = temp_tm.get_saved_sessions()
    assert len(sessions["presets"]) == 1
    assert sessions["presets"][0]["id"] == preset_id

    # Update the existing preset
    update_data = {
        "id": preset_id,
        "name": "Backend API Renamed",
        "shell_id": "cmd",
        "cwd": str(project_dir),
        "envProfile": {"php": "D:/php-8.3"},
        "color": "amber",
        "icon": "code"
    }
    update_res = temp_tm.save_preset(update_data)
    assert update_res["status"] == "success"
    assert update_res["preset"]["name"] == "Backend API Renamed"
    assert update_res["preset"]["shell_id"] == "cmd"

    # List still has 1 item (updated)
    sessions2 = temp_tm.get_saved_sessions()
    assert len(sessions2["presets"]) == 1
    assert sessions2["presets"][0]["name"] == "Backend API Renamed"

def test_delete_preset(temp_tm):
    # Delete non-existent
    assert temp_tm.delete_preset("non_existent")["status"] == "error"

    # Create and delete
    created = temp_tm.save_preset({"name": "Temp Preset"})["preset"]
    assert len(temp_tm.get_saved_sessions()["presets"]) == 1

    del_res = temp_tm.delete_preset(created["id"])
    assert del_res["status"] == "success"
    assert del_res["message"] == "backend.terminal.preset_deleted"
    assert len(temp_tm.get_saved_sessions()["presets"]) == 0

def test_save_workspace_validation(temp_tm):
    assert temp_tm.save_workspace("invalid")["status"] == "error"
    assert temp_tm.save_workspace({"name": ""})["status"] == "error"
    assert temp_tm.save_workspace({"name": "WS", "tabs": []})["status"] == "error"
    assert temp_tm.save_workspace({"name": "WS", "tabs": ["not_a_dict"]})["status"] == "error"

def test_save_and_update_workspace(temp_tm, tmp_path):
    ws_data = {
        "name": "Fullstack Dev",
        "tabs": [
            {"title": "API", "shell_id": "powershell", "cwd": str(tmp_path), "envProfile": {"php": "vyloserve"}},
            {"title": "Client", "shell_id": "cmd", "cwd": str(tmp_path), "envProfile": {"node": "vyloserve"}}
        ]
    }

    res = temp_tm.save_workspace(ws_data)
    assert res["status"] == "success"
    assert res["message"] == "backend.terminal.workspace_saved"
    ws = res["workspace"]
    assert len(ws["tabs"]) == 2
    assert ws["tabs"][0]["title"] == "API"
    assert ws["tabs"][1]["title"] == "Client"
    ws_id = ws["id"]

    # Verify in list
    assert len(temp_tm.get_saved_sessions()["workspaces"]) == 1

    # Update
    ws_update = {
        "id": ws_id,
        "name": "Fullstack Dev V2",
        "tabs": [
            {"title": "Unified", "shell_id": "powershell", "cwd": str(tmp_path)}
        ]
    }
    update_res = temp_tm.save_workspace(ws_update)
    assert update_res["status"] == "success"
    assert update_res["workspace"]["name"] == "Fullstack Dev V2"
    assert len(update_res["workspace"]["tabs"]) == 1

    assert len(temp_tm.get_saved_sessions()["workspaces"]) == 1

def test_delete_workspace(temp_tm):
    assert temp_tm.delete_workspace("not_found")["status"] == "error"

    created = temp_tm.save_workspace({
        "name": "Temp WS",
        "tabs": [{"title": "Tab 1", "cwd": temp_tm.root_dir}]
    })["workspace"]
    assert len(temp_tm.get_saved_sessions()["workspaces"]) == 1

    del_res = temp_tm.delete_workspace(created["id"])
    assert del_res["status"] == "success"
    assert del_res["message"] == "backend.terminal.workspace_deleted"
    assert len(temp_tm.get_saved_sessions()["workspaces"]) == 0

def test_api_terminal_delegation():
    api = Api()
    mock_terminal = MagicMock()
    api.terminal = mock_terminal

    mock_terminal.get_terminal_config.return_value = {"status": "success"}
    assert api.get_terminal_config() == {"status": "success"}

    mock_terminal.save_terminal_default_profile.return_value = {"status": "success"}
    assert api.save_terminal_default_profile({"php": "os"}) == {"status": "success"}

    mock_terminal.save_terminal_settings.return_value = {"status": "success"}
    assert api.save_terminal_settings({"fontSize": 15}) == {"status": "success"}

    mock_terminal.get_session_cwd.return_value = {"status": "success", "cwd": "C:\\Test"}
    assert api.get_terminal_session_cwd("sess-1") == {"status": "success", "cwd": "C:\\Test"}

    mock_terminal.get_saved_sessions.return_value = {"status": "success"}
    assert api.get_terminal_saved_sessions() == {"status": "success"}

    mock_terminal.save_preset.return_value = {"status": "success"}
    assert api.save_terminal_preset({"name": "Test"}) == {"status": "success"}

    mock_terminal.delete_preset.return_value = {"status": "success"}
    assert api.delete_terminal_preset("123") == {"status": "success"}

    mock_terminal.save_workspace.return_value = {"status": "success"}
    assert api.save_terminal_workspace({"name": "WS"}) == {"status": "success"}

    mock_terminal.delete_workspace.return_value = {"status": "success"}
    assert api.delete_terminal_workspace("456") == {"status": "success"}

def test_terminal_settings_persistence(temp_tm, tmp_path):
    # Default settings when config is empty
    cfg = temp_tm.get_terminal_config()
    assert cfg["status"] == "success"
    assert "settings" in cfg["config"]
    assert cfg["config"]["settings"]["fontSize"] == 13
    assert cfg["config"]["settings"]["theme"] == "vyloserve-dark"

    # Invalid input
    err = temp_tm.save_terminal_settings("not-a-dict")
    assert err["status"] == "error"
    assert err["message"] == "backend.terminal.invalid_settings"

    # Save custom settings
    custom_dir = tmp_path / "custom_run"
    custom_dir.mkdir()
    new_settings = {
        "fontSize": 16,
        "fontFamily": "Fira Code",
        "theme": "dracula",
        "cursorStyle": "underline",
        "cursorBlink": False,
        "defaultCwd": str(custom_dir),
        "scrollback": 8000,
        "copyOnSelect": True
    }
    res = temp_tm.save_terminal_settings(new_settings)
    assert res["status"] == "success"
    assert res["message"] == "backend.terminal.settings_saved"
    saved = res["settings"]
    assert saved["fontSize"] == 16
    assert saved["fontFamily"] == "Fira Code"
    assert saved["theme"] == "dracula"
    assert saved["cursorStyle"] == "underline"
    assert saved["cursorBlink"] is False
    assert saved["scrollback"] == 8000
    assert saved["copyOnSelect"] is True
    assert saved["defaultCwd"] == str(custom_dir.resolve())

def test_get_session_cwd(temp_tm, tmp_path):
    # Non-existent session
    err = temp_tm.get_session_cwd("unknown-sess")
    assert err["status"] == "error"
    assert err["message"] == "backend.terminal.session_not_found"

    # Mock active session with cwd
    sess_dir = tmp_path / "active_work"
    sess_dir.mkdir()
    temp_tm._sessions["s123"] = {
        "id": "s123",
        "cwd": str(sess_dir),
        "pid": 999999  # non-existent PID fallback
    }

    res = temp_tm.get_session_cwd("s123")
    assert res["status"] == "success"
    assert res["cwd"] == str(sess_dir.resolve())

def test_preset_and_workspace_history_and_last_cwd(temp_tm, tmp_path):
    proj_dir = tmp_path / "laravel"
    proj_dir.mkdir()
    last_dir = proj_dir / "app"
    last_dir.mkdir()

    # Long buffer with >1000 lines to test buffer capping
    raw_lines = [f"echo line {i}" for i in range(1200)]
    long_history = "\n".join(raw_lines)

    preset_data = {
        "name": "Full Laravel",
        "cwd": str(proj_dir),
        "lastCwd": str(last_dir),
        "historyBuffer": long_history
    }

    res = temp_tm.save_preset(preset_data)
    assert res["status"] == "success"
    preset = res["preset"]
    assert preset["lastCwd"] == str(last_dir.resolve())
    assert preset["cwd"] == str(proj_dir.resolve())
    # History buffer capped to max 1000 lines
    assert len(preset["historyBuffer"].splitlines()) == 1000
    assert "echo line 1199" in preset["historyBuffer"]
    assert "echo line 0" not in preset["historyBuffer"]

    # Workspace with history and lastCwd
    ws_data = {
        "name": "Multi Work",
        "tabs": [
            {
                "title": "Tab 1",
                "cwd": str(proj_dir),
                "lastCwd": str(last_dir),
                "historyBuffer": "npm run dev\nready in 200ms"
            }
        ]
    }
    ws_res = temp_tm.save_workspace(ws_data)
    assert ws_res["status"] == "success"
    tab = ws_res["workspace"]["tabs"][0]
    assert tab["lastCwd"] == str(last_dir.resolve())
    assert "npm run dev" in tab["historyBuffer"]
