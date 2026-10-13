import os
import sys
import subprocess
import pytest
from unittest.mock import patch, MagicMock

from core.utils.system_utils import (
    get_project_root,
    get_resource_path,
    get_silent_flags,
    run_silent_command,
    start_silent_process,
    check_port_in_use,
    hex_to_colorref,
    get_theme_titlebar_palette,
    get_window_handle,
    apply_window_titlebar_theme,
    THEME_TITLEBAR_CONFIGS
)

def test_get_project_root_py_mode():
    """Test get_project_root when running as a normal Python script."""
    # Ensure sys.frozen is False
    with patch('sys.frozen', False, create=True):
        root = get_project_root()
        # It should go up 3 levels from core/utils/system_utils.py
        assert os.path.basename(root) == "vyloserve" or os.path.isdir(os.path.join(root, 'core'))

def test_get_project_root_frozen_mode():
    """Test get_project_root when running as a frozen PyInstaller executable."""
    with patch('sys.frozen', True, create=True):
        with patch('sys.executable', r'C:\FakePath\vyloserve.exe'):
            root = get_project_root()
            assert root == r'C:\FakePath'

def test_get_resource_path_dev_mode():
    """Test get_resource_path in dev mode (without sys._MEIPASS)."""
    with patch.object(sys, '_MEIPASS', None, create=True):
        res = get_resource_path(os.path.join("frontend", "src", "assets", "notify-success.png"))
        assert res.endswith(os.path.join("frontend", "src", "assets", "notify-success.png"))

def test_get_resource_path_frozen_mode(monkeypatch):
    """Test get_resource_path in PyInstaller frozen mode (using sys._MEIPASS)."""
    monkeypatch.setattr(sys, '_MEIPASS', r'C:\fake\meipass\dir', raising=False)
    res = get_resource_path("frontend/dist")
    assert res == os.path.join(r'C:\fake\meipass\dir', "frontend/dist")

def test_get_silent_flags():
    """Test get_silent_flags for Windows and non-Windows."""
    with patch('sys.platform', 'win32'):
        assert get_silent_flags() == 0x08000000
    with patch('sys.platform', 'darwin'):
        assert get_silent_flags() == 0
    with patch('sys.platform', 'linux'):
        assert get_silent_flags() == 0

@patch('subprocess.run')
def test_run_silent_command(mock_run):
    """Test run_silent_command passes the correct arguments to subprocess.run."""
    mock_run.return_value = subprocess.CompletedProcess(args=['cmd'], returncode=0, stdout='ok')
    
    with patch('sys.platform', 'win32'):
        res = run_silent_command(['echo', 'hello'], cwd='/tmp', env={'VAR': '1'})
        
        mock_run.assert_called_once_with(
            ['echo', 'hello'],
            cwd='/tmp',
            env={'VAR': '1'},
            creationflags=0x08000000,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        assert res.stdout == 'ok'

@patch('subprocess.Popen')
def test_start_silent_process(mock_popen):
    """Test start_silent_process passes the correct arguments to subprocess.Popen."""
    mock_process = MagicMock()
    mock_popen.return_value = mock_process
    
    with patch('sys.platform', 'win32'):
        res = start_silent_process(['ping', 'localhost'], cwd='/tmp')
        
        mock_popen.assert_called_once_with(
            ['ping', 'localhost'],
            cwd='/tmp',
            env=None,
            creationflags=0x08000000,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        assert res == mock_process

@patch('socket.create_connection')
def test_check_port_in_use_success(mock_create_conn):
    """Test check_port_in_use when connection succeeds on the primary host."""
    # If create_connection does not raise an exception, it means the port is open
    mock_create_conn.return_value = MagicMock()
    
    assert check_port_in_use(8080) is True
    mock_create_conn.assert_called_once_with(('127.0.0.1', 8080), timeout=0.05)

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_fallback_ipv6(mock_create_conn, mock_socket):
    """Test check_port_in_use when IPv4 fails but IPv6 succeeds (localhost fallback)."""
    # Force primary connection to fail
    mock_create_conn.side_effect = ConnectionRefusedError()
    
    # Mock IPv6 fallback
    mock_sock_instance = MagicMock()
    mock_sock_instance.connect_ex.return_value = 0 # 0 means success
    
    # Support context manager
    mock_sock_instance.__enter__.return_value = mock_sock_instance
    mock_socket.return_value = mock_sock_instance
    
    assert check_port_in_use(5432, 'localhost') is True
    mock_create_conn.assert_called_once_with(('localhost', 5432), timeout=0.05)
    mock_sock_instance.connect_ex.assert_called_once_with(('::1', 5432))

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_all_fail(mock_create_conn, mock_socket):
    """Test check_port_in_use when all connections fail."""
    mock_create_conn.side_effect = ConnectionRefusedError()

    mock_sock_instance = MagicMock()
    mock_sock_instance.connect_ex.return_value = 10061 # Connection refused
    mock_sock_instance.__enter__.return_value = mock_sock_instance
    mock_socket.return_value = mock_sock_instance

    assert check_port_in_use(3306) is False

@patch('socket.socket')
@patch('socket.create_connection')
def test_check_port_in_use_ipv6_fallback_itself_unsupported(mock_create_conn, mock_socket):
    """
    Edge case: jika IPv4 gagal DAN pembuatan socket IPv6 fallback itu sendiri melempar
    exception (mis. address family tidak didukung OS), harus tetap return False dengan
    aman, bukan crash.
    """
    mock_create_conn.side_effect = OSError("IPv4 connection refused")
    mock_socket.side_effect = OSError("AF_INET6 not supported on this system")

    assert check_port_in_use(5432, 'localhost') is False


# ==========================================
# DWM WIN32 TITLEBAR UNIT TESTS
# ==========================================

def test_hex_to_colorref_standard_6_digits():
    """Menguji konversi format hex 6 digit standar ke COLORREF (0x00BBGGRR)."""
    # #0f172a -> R:0x0f, G:0x17, B:0x2a -> (0x2a << 16) | (0x17 << 8) | 0x0f = 0x2a170f
    assert hex_to_colorref("#0f172a") == 0x2a170f
    # #ffffff -> R:0xff, G:0xff, B:0xff -> 0x00ffffff
    assert hex_to_colorref("#ffffff") == 0x00ffffff
    # #000000 -> 0
    assert hex_to_colorref("#000000") == 0
    # Tanpa tanda pagar
    assert hex_to_colorref("0f172a") == 0x2a170f


def test_hex_to_colorref_shorthand_3_digits():
    """Menguji konversi format shorthand 3 digit (#RGB)."""
    # #fff -> #ffffff -> 0x00ffffff
    assert hex_to_colorref("#fff") == 0x00ffffff
    # #123 -> #112233 -> R:0x11, G:0x22, B:0x33 -> (0x33 << 16) | (0x22 << 8) | 0x11
    assert hex_to_colorref("#123") == (0x33 << 16) | (0x22 << 8) | 0x11


def test_hex_to_colorref_invalid_input():
    """Menguji penanganan input tidak valid mengembalikan 0 dengan aman."""
    assert hex_to_colorref("") == 0
    assert hex_to_colorref(None) == 0
    assert hex_to_colorref("#12") == 0
    assert hex_to_colorref("#1234567") == 0
    assert hex_to_colorref("#zzzzzz") == 0


def test_get_theme_titlebar_palette_presets():
    """Menguji palet warna untuk 10 tema bawaan terdefinisi dengan benar."""
    for theme_name, expected_config in THEME_TITLEBAR_CONFIGS.items():
        palette = get_theme_titlebar_palette(theme_name)
        assert palette == expected_config
        assert "bg" in palette
        assert "text" in palette
        assert "border" in palette
        assert "dark_mode" in palette


def test_get_theme_titlebar_palette_fallbacks():
    """Menguji fallback cerdas untuk tema kustom atau tidak dikenal."""
    # Tema tidak dikenal mengandung kata 'light' -> fallback tema terang
    light_fallback = get_theme_titlebar_palette("my-custom-light-theme")
    assert light_fallback["dark_mode"] is False
    assert light_fallback["bg"] == "#f8fafc"

    # Tema tidak dikenal tidak mengandung 'light' -> fallback tema gelap
    dark_fallback = get_theme_titlebar_palette("my-custom-dark-theme")
    assert dark_fallback["dark_mode"] is True
    assert dark_fallback["bg"] == "#0f172a"

    # Input None / kosong -> fallback tema gelap default
    none_fallback = get_theme_titlebar_palette(None)
    assert none_fallback["dark_mode"] is True


def test_get_window_handle_direct_int():
    """Jika input sudah berupa integer HWND positif, kembalikan langsung."""
    with patch('sys.platform', 'win32'):
        assert get_window_handle(123456) == 123456


def test_get_window_handle_non_windows():
    """Di platform non-Windows, get_window_handle harus mengembalikan None."""
    with patch('sys.platform', 'linux'):
        assert get_window_handle(123456) is None


def test_get_window_handle_from_native():
    """Menguji resolusi HWND dari atribut window.native.Handle."""
    mock_window = MagicMock()
    mock_window.native.Handle.ToInt64.return_value = 654321

    with patch('sys.platform', 'win32'):
        hwnd = get_window_handle(mock_window)
        assert hwnd == 654321


def test_get_window_handle_from_browserview_instances():
    """Menguji resolusi HWND dari BrowserView.instances pywebview (WinForms)."""
    mock_window = MagicMock()
    mock_window.uid = 'test_uid_123'
    mock_window.title = "VyloServe"
    mock_window.native = None

    mock_form = MagicMock()
    mock_form.Handle.ToInt64.return_value = 789012

    mock_wf = MagicMock()
    mock_wf.BrowserView.instances = {'test_uid_123': mock_form}

    with patch('sys.platform', 'win32'), patch.dict('sys.modules', {'webview.platforms.winforms': mock_wf}):
        hwnd = get_window_handle(mock_window)
        assert hwnd == 789012


def test_get_window_handle_fallback_find_window():
    """Menguji fallback pencarian HWND lewat FindWindowW jika native/instances tidak ada."""
    mock_window = MagicMock(spec=['title'])
    mock_window.title = "VyloServe"

    with patch('sys.platform', 'win32'), \
         patch('ctypes.windll.user32.FindWindowW', return_value=888999):
        hwnd = get_window_handle(mock_window)
        assert hwnd == 888999


def test_apply_window_titlebar_theme_non_windows():
    """Di platform non-Windows, apply_window_titlebar_theme harus mengembalikan False."""
    with patch('sys.platform', 'darwin'):
        assert apply_window_titlebar_theme(12345, "vyloserve-dark") is False


def test_apply_window_titlebar_theme_invalid_hwnd():
    """Jika HWND tidak valid (0 atau None), harus mengembalikan False."""
    with patch('sys.platform', 'win32'):
        assert apply_window_titlebar_theme(None, "vyloserve-dark") is False
        assert apply_window_titlebar_theme(0, "vyloserve-dark") is False


def test_apply_window_titlebar_theme_success():
    """Menguji pemanggilan DwmSetWindowAttribute dengan parameter warna yang sesuai."""
    with patch('sys.platform', 'win32'), \
         patch('ctypes.windll.dwmapi.DwmSetWindowAttribute', return_value=0) as mock_dwm:
        success = apply_window_titlebar_theme(12345, "vyloserve-dark")
        assert success is True
        # Dipanggil untuk dark mode (20), caption (35), text (36), dan border (34)
        assert mock_dwm.call_count >= 4
        called_attrs = [call[0][1] for call in mock_dwm.call_args_list]
        assert 20 in called_attrs # DWMWA_USE_IMMERSIVE_DARK_MODE
        assert 35 in called_attrs # DWMWA_CAPTION_COLOR
        assert 36 in called_attrs # DWMWA_TEXT_COLOR
        assert 34 in called_attrs # DWMWA_BORDER_COLOR


def test_apply_window_titlebar_theme_dark_mode_fallback():
    """Jika attr 20 gagal (misal Windows 10 build 1809), coba attr 19 sebagai fallback."""
    def fake_dwm(hwnd, attr, p_val, size):
        if attr == 20:
            return -1 # Gagal
        return 0

    with patch('sys.platform', 'win32'), \
         patch('ctypes.windll.dwmapi.DwmSetWindowAttribute', side_effect=fake_dwm) as mock_dwm:
        apply_window_titlebar_theme(12345, "vyloserve-dark")
        called_attrs = [call[0][1] for call in mock_dwm.call_args_list]
        assert 19 in called_attrs # DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1


def test_apply_window_titlebar_theme_handles_exceptions_gracefully():
    """Jika terjadi exception tak terduga di ctypes dwmapi, harus ditangani aman tanpa crash."""
    with patch('sys.platform', 'win32'), \
         patch('ctypes.windll.dwmapi.DwmSetWindowAttribute', side_effect=RuntimeError("DWM unavailable")):
        success = apply_window_titlebar_theme(12345, "vyloserve-dark")
        assert success is False

