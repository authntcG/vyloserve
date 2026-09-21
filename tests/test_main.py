import os
import sys
import pytest
from unittest.mock import MagicMock, patch

import main as main_module
from main import AppLifecycle, resource_path, get_entrypoint, setup_systray


@pytest.fixture
def mock_api():
    return MagicMock()


# ==========================================
# resource_path / get_entrypoint
# ==========================================

def test_resource_path_dev_mode_uses_file_directory():
    """Saat tidak di-compile (tidak ada sys._MEIPASS), base path harus folder main.py."""
    result = resource_path("frontend/dist")
    expected_base = os.path.abspath(os.path.dirname(main_module.__file__))
    assert result == os.path.join(expected_base, "frontend/dist")

def test_resource_path_frozen_mode_uses_meipass(monkeypatch):
    """Saat di-compile PyInstaller (ada sys._MEIPASS), base path harus dari sana."""
    monkeypatch.setattr(sys, '_MEIPASS', 'C:\\fake\\frozen\\dir', raising=False)
    result = resource_path("frontend/dist")
    assert result == os.path.join('C:\\fake\\frozen\\dir', "frontend/dist")

def test_get_entrypoint_dev_mode_uses_vite_dev_server():
    with patch('main.IS_PRODUCTION', False):
        assert get_entrypoint() == 'http://localhost:5173'

def test_get_entrypoint_production_uses_bundled_index_html():
    with patch('main.IS_PRODUCTION', True):
        result = get_entrypoint()
    assert result.endswith(os.path.join('frontend', 'dist', 'index.html'))


# ==========================================
# AppLifecycle.perform_exit — regresi utama docs/known_bugs.md #6
# ==========================================

@patch('os._exit')
def test_perform_exit_stops_all_engines_before_exiting(mock_os_exit, mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=True)
    mock_window = MagicMock()
    mock_tray = MagicMock()
    lifecycle.set_window(mock_window)
    lifecycle.set_tray_icon(mock_tray)

    lifecycle.perform_exit()

    mock_api.stop_log_watcher.assert_called_once()
    mock_api.apache.stop_server.assert_called_once()
    mock_api.php.stop_all.assert_called_once()
    mock_api.database.stop_all.assert_called_once()
    mock_tray.stop.assert_called_once()
    mock_window.destroy.assert_called_once()
    mock_os_exit.assert_called_once_with(0)
    assert lifecycle.is_real_exit is True

@patch('os._exit')
def test_perform_exit_swallows_log_watcher_stop_failure(mock_os_exit, mock_api):
    """Kegagalan menghentikan log watcher tidak boleh menghalangi cleanup engine lainnya."""
    lifecycle = AppLifecycle(mock_api, is_production=True)
    lifecycle.set_window(MagicMock())
    mock_api.stop_log_watcher.side_effect = RuntimeError("watcher already stopped")

    lifecycle.perform_exit()

    mock_api.apache.stop_server.assert_called_once()
    mock_os_exit.assert_called_once_with(0)

@patch('os._exit')
def test_perform_exit_swallows_individual_engine_failures(mock_os_exit, mock_api):
    """Jika salah satu engine gagal dihentikan, proses cleanup lain tetap lanjut jalan."""
    lifecycle = AppLifecycle(mock_api, is_production=True)
    mock_window = MagicMock()
    lifecycle.set_window(mock_window)

    mock_api.apache.stop_server.side_effect = RuntimeError("apache already dead")
    mock_api.php.stop_all.side_effect = RuntimeError("php bridge gone")

    lifecycle.perform_exit()

    mock_api.database.stop_all.assert_called_once()
    mock_window.destroy.assert_called_once()
    mock_os_exit.assert_called_once_with(0)

@patch('os._exit')
def test_perform_exit_without_window_or_tray_set(mock_os_exit, mock_api):
    """Dipanggil sebelum window/tray sempat di-set (mis. gagal di tengah startup) -> tidak boleh crash."""
    lifecycle = AppLifecycle(mock_api, is_production=True)
    lifecycle.perform_exit()
    mock_os_exit.assert_called_once_with(0)


# ==========================================
# AppLifecycle.on_closing
# ==========================================

def test_on_closing_dev_mode_always_allows_full_destroy(mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=False)
    lifecycle.set_window(MagicMock())
    assert lifecycle.on_closing() is True
    assert lifecycle.is_real_exit is True

def test_on_closing_production_hides_window_on_first_close(mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=True)
    mock_window = MagicMock()
    lifecycle.set_window(mock_window)

    result = lifecycle.on_closing()

    assert result is False
    mock_window.hide.assert_called_once()

def test_on_closing_production_allows_destroy_when_real_exit_flag_set(mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=True)
    mock_window = MagicMock()
    lifecycle.set_window(mock_window)
    lifecycle.is_real_exit = True  # simulasi setelah perform_exit() dipanggil

    result = lifecycle.on_closing()

    assert result is True
    mock_window.hide.assert_not_called()


# ==========================================
# setup_systray
# ==========================================

@patch('main.threading.Thread')
@patch('main.pystray.Icon')
@patch('main.Image.open')
@patch('os.path.exists', return_value=True)
def test_setup_systray_registers_tray_icon(mock_exists, mock_image_open, mock_pystray_icon, mock_thread, mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=True)
    lifecycle.set_window(MagicMock())
    mock_tray_instance = MagicMock()
    mock_pystray_icon.return_value = mock_tray_instance

    setup_systray(lifecycle, "C:\\fake\\icon.ico")

    assert lifecycle.tray_icon is mock_tray_instance
    mock_thread.assert_called_once()
    assert mock_thread.call_args.kwargs.get('daemon') is True

@patch('main.threading.Thread')
@patch('main.pystray.Icon')
@patch('main.Image.new')
@patch('os.path.exists', return_value=False)
def test_setup_systray_uses_fallback_image_when_icon_file_missing(mock_exists, mock_image_new, mock_pystray_icon, mock_thread, mock_api):
    lifecycle = AppLifecycle(mock_api, is_production=True)
    setup_systray(lifecycle, "C:\\does\\not\\exist.ico")
    mock_image_new.assert_called_once_with('RGB', (64, 64), color=(59, 130, 246))

@patch('main.pystray.Icon', side_effect=RuntimeError("tray backend unavailable"))
@patch('os.path.exists', return_value=True)
@patch('main.Image.open')
def test_setup_systray_handles_init_exception_gracefully(mock_image_open, mock_exists, mock_pystray_icon, mock_api):
    """Kegagalan inisialisasi tray (mis. OS tidak mendukung) tidak boleh membuat aplikasi crash."""
    lifecycle = AppLifecycle(mock_api, is_production=True)
    setup_systray(lifecycle, "C:\\fake\\icon.ico")  # tidak boleh raise
    assert lifecycle.tray_icon is None

@patch('main.threading.Thread')
@patch('main.pystray.Icon')
@patch('main.Image.open')
@patch('os.path.exists', return_value=True)
def test_setup_systray_exit_menu_item_calls_perform_exit_not_shortcut(mock_exists, mock_image_open, mock_pystray_icon, mock_thread, mock_api):
    """
    Regression test: tombol 'Exit Engine' di tray sebelumnya punya jalur exit sendiri
    yang TIDAK memanggil stop_server/stop_all (melewatkan cleanup engine). Sekarang
    harus memanggil lifecycle.perform_exit() yang sama seperti tombol Quit di UI.
    """
    lifecycle = AppLifecycle(mock_api, is_production=True)
    lifecycle.set_window(MagicMock())

    setup_systray(lifecycle, "C:\\fake\\icon.ico")

    # Ambil menu item 'Exit Engine' dari menu yang dibangun pystray.Menu(...)
    menu_call_args = mock_pystray_icon.call_args[0]
    menu_items = menu_call_args[3]  # pystray.Icon(name, image, title, menu)
    exit_item = next(i for i in menu_items if i.text == 'Exit Engine')

    with patch.object(lifecycle, 'perform_exit') as mock_perform_exit:
        exit_item(MagicMock())  # MenuItem callable: __call__(icon) -> action(icon, self)

    mock_perform_exit.assert_called_once()

@patch('main.threading.Thread')
@patch('main.pystray.Icon')
@patch('main.Image.open')
@patch('os.path.exists', return_value=True)
def test_setup_systray_show_menu_item_restores_window(mock_exists, mock_image_open, mock_pystray_icon, mock_thread, mock_api):
    mock_window = MagicMock()
    lifecycle = AppLifecycle(mock_api, is_production=True)
    lifecycle.set_window(mock_window)

    setup_systray(lifecycle, "C:\\fake\\icon.ico")

    menu_items = mock_pystray_icon.call_args[0][3]
    show_item = next(i for i in menu_items if i.text == 'Show VyloServe')
    show_item(MagicMock())

    mock_window.show.assert_called_once()
    mock_window.restore.assert_called_once()

@patch('main.threading.Thread')
@patch('main.pystray.Icon')
@patch('main.Image.open')
@patch('os.path.exists', return_value=True)
def test_setup_systray_run_tray_swallows_icon_run_exception(mock_exists, mock_image_open, mock_pystray_icon, mock_thread, mock_api):
    """run_tray() (dijalankan di thread daemon terpisah) tidak boleh membuat thread crash tak tertangani."""
    mock_tray_instance = MagicMock()
    mock_tray_instance.run.side_effect = RuntimeError("tray loop crashed")
    mock_pystray_icon.return_value = mock_tray_instance

    lifecycle = AppLifecycle(mock_api, is_production=True)
    setup_systray(lifecycle, "C:\\fake\\icon.ico")

    run_tray_fn = mock_thread.call_args.kwargs['target']
    run_tray_fn()  # tidak boleh melempar exception ke pemanggil
    mock_tray_instance.run.assert_called_once()


# ==========================================
# main() — wiring end-to-end (semua dependensi eksternal di-mock)
# ==========================================

@patch('main.check_single_instance', return_value=(True, None))
@patch('main.webview')
@patch('core.api.Api')
def test_main_wires_api_window_and_quit_callback(mock_api_class, mock_webview, mock_check_single):
    mock_api_instance = MagicMock()
    mock_api_class.return_value = mock_api_instance
    mock_window = MagicMock()
    mock_webview.create_window.return_value = mock_window

    with patch('main.IS_PRODUCTION', False):
        main_module.main()

    mock_api_instance.set_window.assert_called_once_with(mock_window)
    mock_api_instance.start_log_watcher.assert_called_once()
    assert mock_api_instance.quit_callback is not None
    mock_webview.start.assert_called_once()

@patch('main.check_single_instance', return_value=(True, None))
@patch('main.setup_systray')
@patch('main.webview')
@patch('core.api.Api')
def test_main_sets_up_systray_only_in_production(mock_api_class, mock_webview, mock_setup_systray, mock_check_single):
    mock_webview.create_window.return_value = MagicMock()

    with patch('main.IS_PRODUCTION', False):
        main_module.main()
    mock_setup_systray.assert_not_called()

    with patch('main.IS_PRODUCTION', True):
        main_module.main()
    mock_setup_systray.assert_called_once()

@patch('main.check_single_instance', return_value=(True, None))
@patch('main.webview')
@patch('core.api.Api', side_effect=RuntimeError("Api init failed"))
def test_main_handles_unexpected_startup_exception_without_crashing(mock_api_class, mock_webview, mock_check_single):
    """Kegagalan tak terduga saat startup harus tertangkap rapi, bukan membuat proses crash."""
    main_module.main()  # tidak boleh melempar exception ke pemanggil
    # Pastikan exception itu benar berasal dari upaya nyata memanggil Api(), bukan main() no-op
    mock_api_class.assert_called_once()
