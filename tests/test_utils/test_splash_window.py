import os
import sys
import json
import queue
import pytest
from unittest.mock import MagicMock, patch

from core.utils.splash_window import (
    _calculate_center_geometry,
    _get_nested_key,
    _interpolate,
    _translate,
    _create_base_splash_image,
    NativeSplashBootstrapper,
    run_startup_bootstrapper,
)


def test_calculate_center_geometry():
    # 1920x1080 -> (1920-640)//2 = 640, (1080-360)//2 = 360
    assert _calculate_center_geometry(1920, 1080, 640, 360) == "640x360+640+360"
    # Layar kecil -> batas minimum 0
    assert _calculate_center_geometry(500, 300, 640, 360) == "640x360+0+0"


def test_get_nested_key_and_interpolation():
    data = {
        "ui": {
            "bootstrap": {
                "starting": "Starting VyloServe...",
                "item": "Checking {{module}} version {{version}}"
            }
        }
    }

    assert _get_nested_key(data, "ui.bootstrap.starting") == "Starting VyloServe..."
    assert _get_nested_key(data, "ui.bootstrap.non_existent") is None
    assert _get_nested_key(data, "invalid.path") is None

    template = _get_nested_key(data, "ui.bootstrap.item")
    interpolated = _interpolate(template, {"module": "Apache", "version": "2.4.58"})
    assert interpolated == "Checking Apache version 2.4.58"


def test_translate_with_fallback():
    current_locale = {
        "backend": {
            "health": {
                "checking_apache": "Memeriksa server web Apache..."
            }
        }
    }
    fallback_locale = {
        "backend": {
            "health": {
                "checking_apache": "Verifying Apache HTTP Server...",
                "checking_php": "Verifying PHP runtimes..."
            }
        }
    }

    # Ada di current_locale
    assert _translate("backend.health.checking_apache", None, current_locale, fallback_locale) == "Memeriksa server web Apache..."
    # Tidak ada di current_locale, fallback ke English
    assert _translate("backend.health.checking_php", None, current_locale, fallback_locale) == "Verifying PHP runtimes..."
    # Tidak ada di keduanya, kembalikan key mentah
    assert _translate("backend.unknown.key", None, current_locale, fallback_locale) == "backend.unknown.key"
    # Key kosong
    assert _translate("", None, current_locale, fallback_locale) == ""


def test_create_base_splash_image_creates_valid_dimensions():
    # Test fallback mode (file tidak ada)
    img = _create_base_splash_image(
        hero_path="non_existent_hero.png",
        logo_path="non_existent_logo.png",
        app_version="0.0.7-beta"
    )

    assert img.size == (640, 360)
    assert img.mode == "RGBA"


def test_native_splash_bootstrapper_queue_and_status(tmp_path):
    mock_api = MagicMock()
    bootstrapper = NativeSplashBootstrapper(mock_api, app_version="0.0.7-beta")

    assert bootstrapper.app_version == "0.0.7-beta"
    assert bootstrapper.queue.empty() is True

    # Kirim status update
    bootstrapper._on_bootstrap_status(40, "backend.health.checking_php", {"version": "8.3"}, is_recovering=True)

    msg = bootstrapper.queue.get_nowait()
    assert msg["type"] == "status"
    assert msg["percent"] == 40
    assert msg["stage"] == "backend.health.checking_php"
    assert msg["is_recovering"] is True


def test_native_splash_bootstrapper_poll_queue():
    mock_api = MagicMock()
    bootstrapper = NativeSplashBootstrapper(mock_api, app_version="0.0.7-beta")
    mock_canvas = MagicMock()
    mock_root = MagicMock()
    bootstrapper._canvas = mock_canvas
    bootstrapper._root = mock_root
    bootstrapper.text_id = 1
    bootstrapper.dot_id = 2
    bootstrapper.recovery_box_id = 3
    bootstrapper.recovery_text_id = 4
    bootstrapper.pb_fill_id = 5

    # 1. Status event
    bootstrapper.queue.put({
        "type": "status",
        "percent": 50,
        "stage": "backend.health.checking_apache",
        "args": {},
        "is_recovering": False
    })
    bootstrapper._poll_queue()
    assert bootstrapper._target_percent == 50
    mock_canvas.itemconfig.assert_any_call(bootstrapper.text_id, text=bootstrapper._t("backend.health.checking_apache"))
    mock_canvas.itemconfig.assert_any_call(bootstrapper.recovery_box_id, state="hidden")

    # 2. Recovering event
    bootstrapper.queue.put({
        "type": "status",
        "percent": 75,
        "stage": "backend.health.recovered_config",
        "args": {"module": "PHP"},
        "is_recovering": True
    })
    bootstrapper._poll_queue()
    assert bootstrapper._target_percent == 75
    mock_canvas.itemconfig.assert_any_call(bootstrapper.recovery_box_id, state="normal")
    mock_canvas.itemconfig.assert_any_call(bootstrapper.pb_fill_id, fill="#f59e0b")

    # 3. Done event
    bootstrapper.queue.put({
        "type": "done",
        "report": {"status": "success", "recovered": []}
    })
    bootstrapper._poll_queue()
    assert bootstrapper._target_percent == 100
    assert bootstrapper._is_completed is True


def test_run_startup_bootstrapper_headless_fallback():
    mock_api = MagicMock()
    expected_report = {"status": "success", "recovered": [], "purged": []}
    mock_api.run_startup_health_check.return_value = expected_report

    with patch('tkinter.Tk', side_effect=Exception("No display")):
        report = run_startup_bootstrapper(mock_api, app_version="0.0.7-beta")

    assert report == expected_report
    mock_api.run_startup_health_check.assert_called_once()


def test_native_splash_bootstrapper_resolves_bundled_locales_when_frozen(tmp_path):
    meipass_dir = tmp_path / "meipass"
    locales_dir = meipass_dir / "frontend" / "src" / "locales"
    en_dir = locales_dir / "en"
    en_dir.mkdir(parents=True)
    with open(en_dir / "translation.json", "w", encoding="utf-8") as f:
        json.dump({"backend": {"health": {"cleanup_orphans": "Cleaning up orphan files..."}}}, f)

    mock_api = MagicMock()
    with patch("sys._MEIPASS", str(meipass_dir), create=True), \
         patch("core.utils.splash_window.get_project_root", return_value=str(tmp_path / "dist")):
        bootstrapper = NativeSplashBootstrapper(mock_api, app_version="0.0.7-beta")
        assert bootstrapper.locales_dir == str(locales_dir)
        translated = bootstrapper._t("backend.health.cleanup_orphans")
        assert translated == "Cleaning up orphan files..."


def test_native_splash_bootstrapper_fallback_locales_when_not_frozen(tmp_path):
    root_dir = tmp_path / "project"
    locales_dir = root_dir / "frontend" / "src" / "locales"
    en_dir = locales_dir / "en"
    en_dir.mkdir(parents=True)
    with open(en_dir / "translation.json", "w", encoding="utf-8") as f:
        json.dump({"backend": {"health": {"cleanup_orphans": "Dev cleaning up..."}}}, f)

    mock_api = MagicMock()
    with patch("core.utils.splash_window.get_project_root", return_value=str(root_dir)), \
         patch("core.utils.splash_window.get_resource_path", return_value=str(locales_dir)):
        bootstrapper = NativeSplashBootstrapper(mock_api, app_version="0.0.7-beta")
        assert bootstrapper.locales_dir == str(locales_dir)
        translated = bootstrapper._t("backend.health.cleanup_orphans")
        assert translated == "Dev cleaning up..."
