import os
import sys
import socket
import subprocess
from typing import List, Optional, Dict, Any

def get_project_root():
    """ 
    Mendapatkan root direktori yang aman.
    Jika berupa .exe, gunakan folder tempat .exe berada (Portable Mode).
    Jika berupa .py, gunakan folder root proyek.
    """
    if getattr(sys, 'frozen', False):
        # Berjalan sebagai executable PyInstaller (.exe)
        # Menghasilkan path folder tempat .exe tersebut diletakkan
        return os.path.dirname(sys.executable)
    else:
        # Berjalan sebagai script Python normal (.py)
        # Asumsi: file ini ada di core/utils/system_utils.py (mundur 3 level ke root)
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_resource_path(relative_path: str) -> str:
    """
    Mendapatkan path absolut ke resource/aset internal aplikasi,
    kompatibel untuk mode Development maupun PyInstaller bundle (sys._MEIPASS).
    """
    base_path = getattr(sys, '_MEIPASS', None)
    if not base_path:
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_path, relative_path)

def get_silent_flags() -> int:
    """
    Mendapatkan creation flags untuk menyembunyikan jendela console (CMD) di OS Windows.
    Sangat penting agar background process tidak memunculkan popup hitam.
    
    Returns:
        int: Flag CREATE_NO_WINDOW untuk Windows, atau 0 untuk Mac/Linux.
    """
    return 0x08000000 if sys.platform == 'win32' else 0

def run_silent_command(cmd: List[str], cwd: Optional[str] = None, env: Optional[dict] = None, encoding: str = "utf-8") -> subprocess.CompletedProcess:
    """
    Menjalankan command shell (subprocess.run) secara tersembunyi (tanpa jendela console).
    Digunakan untuk perintah yang ditunggu hingga selesai (Synchronous).
    
    Args:
        cmd (List[str]): Perintah yang akan dieksekusi dalam bentuk list.
        cwd (str, optional): Direktori kerja (Current Working Directory).
        env (dict, optional): Environment variables khusus (misal untuk PHP).
        
    Returns:
        subprocess.CompletedProcess: Hasil eksekusi dari subprocess.
    """
    return subprocess.run(
        cmd, 
        cwd=cwd,
        env=env,
        creationflags=get_silent_flags(), 
        capture_output=True, 
        text=True,
        encoding=encoding,
        errors="replace"
    )

def start_silent_process(cmd: List[str], cwd: Optional[str] = None, env: Optional[dict] = None) -> subprocess.Popen:
    """
    Menjalankan proses di latar belakang (subprocess.Popen) secara tersembunyi.
    Digunakan untuk service yang berjalan terus-menerus (Asynchronous) seperti PHP-CGI/Apache.
    
    Args:
        cmd (List[str]): Perintah eksekusi.
        cwd (str, optional): Direktori kerja.
        env (dict, optional): Environment variables khusus.
        
    Returns:
        subprocess.Popen: Objek proses yang sedang berjalan.
    """
    return subprocess.Popen(
        cmd, 
        cwd=cwd,
        env=env,
        creationflags=get_silent_flags(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def check_port_in_use(port: int, host: str = '127.0.0.1', timeout: float = 0.05) -> bool:
    """
    Mengecek apakah sebuah Port TCP sedang digunakan/terbuka.
    Dioptimasi menggunakan Timeout kecil agar tidak membekukan (blocking) aplikasi.
    
    Args:
        port (int): Nomor port yang akan di cek.
        host (str, optional): Host target (Default localhost).
        timeout (float, optional): Batas waktu tunggu dalam detik.
        
    Returns:
        bool: True jika port sedang digunakan (terbuka), False jika kosong.
    """
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except OSError:
        # Fallback manual ke IPv6 murni jika socket.create_connection gagal di localhost
        if host == '127.0.0.1' or host == 'localhost':
            try:
                with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
                    s.settimeout(timeout)
                    return s.connect_ex(('::1', int(port))) == 0
            except Exception: pass
        return False

# ==========================================
# DWM WIN32 TITLEBAR THEME CONSTANTS & PALETTES
# ==========================================
DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19
DWMWA_USE_IMMERSIVE_DARK_MODE = 20
DWMWA_BORDER_COLOR = 34
DWMWA_CAPTION_COLOR = 35
DWMWA_TEXT_COLOR = 36

THEME_TITLEBAR_CONFIGS = {
    "vyloserve-dark": {
        "bg": "#0f172a",
        "text": "#f8fafc",
        "border": "#1e293b",
        "dark_mode": True,
    },
    "vyloserve-light": {
        "bg": "#f8fafc",
        "text": "#0f172a",
        "border": "#e2e8f0",
        "dark_mode": False,
    },
    "darcula-dark": {
        "bg": "#2b2b2b",
        "text": "#a9b7c6",
        "border": "#3c3f41",
        "dark_mode": True,
    },
    "solarized-dark": {
        "bg": "#002b36",
        "text": "#93a1a1",
        "border": "#073642",
        "dark_mode": True,
    },
    "solarized-light": {
        "bg": "#fdf6e3",
        "text": "#657b83",
        "border": "#eee8d5",
        "dark_mode": False,
    },
    "high-contrast-dark": {
        "bg": "#000000",
        "text": "#ffffff",
        "border": "#333333",
        "dark_mode": True,
    },
    "high-contrast-light": {
        "bg": "#ffffff",
        "text": "#000000",
        "border": "#cccccc",
        "dark_mode": False,
    },
    "monokai-dark": {
        "bg": "#272822",
        "text": "#f8f8f2",
        "border": "#3e3d32",
        "dark_mode": True,
    },
    "dracula-dark": {
        "bg": "#282a36",
        "text": "#f8f8f2",
        "border": "#44475a",
        "dark_mode": True,
    },
    "nord-dark": {
        "bg": "#2e3440",
        "text": "#eceff4",
        "border": "#3b4252",
        "dark_mode": True,
    },
}

def hex_to_colorref(hex_color: str) -> int:
    """
    Mengonversi string hex warna (#RRGGBB atau #RGB) ke format COLORREF Win32 (0x00BBGGRR).
    Jika format tidak valid, mengembalikan 0.
    """
    if not hex_color or not isinstance(hex_color, str):
        return 0
    clean_hex = hex_color.lstrip('#').strip()
    if len(clean_hex) == 3:
        clean_hex = ''.join(c * 2 for c in clean_hex)
    if len(clean_hex) != 6:
        return 0
    try:
        r = int(clean_hex[0:2], 16)
        g = int(clean_hex[2:4], 16)
        b = int(clean_hex[4:6], 16)
        return (b << 16) | (g << 8) | r
    except ValueError:
        return 0

def get_theme_titlebar_palette(theme_name: Optional[str]) -> Dict[str, Any]:
    """
    Mendapatkan konfigurasi warna titlebar (bg, text, border, dark_mode) berdasarkan nama tema.
    Menyediakan fallback cerdas jika tema kustom atau tidak dikenali.
    """
    if theme_name and theme_name in THEME_TITLEBAR_CONFIGS:
        return THEME_TITLEBAR_CONFIGS[theme_name]

    # Fallback cerdas berdasarkan deteksi kata kunci nama tema
    is_light = bool(theme_name and "light" in theme_name.lower())
    if is_light:
        return {
            "bg": "#f8fafc",
            "text": "#0f172a",
            "border": "#e2e8f0",
            "dark_mode": False,
        }
    return {
        "bg": "#0f172a",
        "text": "#f8fafc",
        "border": "#1e293b",
        "dark_mode": True,
    }

def get_window_handle(window: Any = None) -> Optional[int]:
    """
    Mendapatkan HWND (Windows handle) untuk window PyWebview.
    Mendukung input HWND int langsung, window.native, BrowserView.instances pywebview,
    atau fallback FindWindowW.
    """
    if sys.platform != 'win32':
        return None

    # Jika window sudah berupa integer HWND
    if isinstance(window, int) and window > 0:
        return window

    try:
        # 1. Coba dari window.native jika ada
        if window and hasattr(window, 'native') and window.native:
            handle = getattr(window.native, 'Handle', None)
            if handle is not None:
                return int(handle.ToInt64() if hasattr(handle, 'ToInt64') else handle)

        # 2. Coba dari BrowserView.instances pywebview (WinForms)
        if window and hasattr(window, 'uid'):
            try:
                wf = sys.modules.get('webview.platforms.winforms')
                if not wf:
                    import webview.platforms.winforms as wf
                form_inst = wf.BrowserView.instances.get(getattr(window, 'uid', None))
                if form_inst and hasattr(form_inst, 'Handle'):
                    handle = getattr(form_inst, 'Handle', None)
                    if handle is not None:
                        if hasattr(handle, 'ToInt64'):
                            return int(handle.ToInt64())
                        elif hasattr(handle, 'ToInt32'):
                            return int(handle.ToInt32())
                        elif isinstance(handle, int):
                            return handle
            except Exception:
                pass

        # 3. Fallback: FindWindowW menggunakan judul window
        raw_title = getattr(window, 'title', None) if window else None
        title = raw_title if isinstance(raw_title, str) and raw_title.strip() else "VyloServe"
        import ctypes
        hwnd = ctypes.windll.user32.FindWindowW(None, title)
        if hwnd:
            return int(hwnd)
    except Exception:
        pass
    return None

def apply_window_titlebar_theme(window_or_hwnd: Any, theme_name: Optional[str] = "vyloserve-dark") -> bool:
    """
    Menyelaraskan warna titlebar native Windows via DWM (DwmSetWindowAttribute)
    dengan tema aktif VyloServe tanpa merusak chrome native (frameless=False).
    Mendukung Windows 10 (Immersive Dark Mode) dan Windows 11 (Caption/Text/Border Color).
    
    Returns:
        bool: True jika minimal satu atribut DWM berhasil diterapkan, False jika gagal/non-Windows.
    """
    if sys.platform != 'win32':
        return False

    hwnd = get_window_handle(window_or_hwnd)
    if not hwnd or hwnd <= 0:
        return False

    palette = get_theme_titlebar_palette(theme_name)
    success = False

    try:
        import ctypes
        dwmapi = ctypes.windll.dwmapi

        # 1. Terapkan Immersive Dark Mode (Windows 10 19041+ & Windows 11)
        dark_mode_val = ctypes.c_int(1 if palette["dark_mode"] else 0)
        hr_dark = dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            ctypes.byref(dark_mode_val),
            ctypes.sizeof(dark_mode_val)
        )
        if hr_dark == 0:
            success = True
        else:
            # Fallback untuk Windows 10 build 17763 - 18985 (attr 19)
            dwmapi.DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1,
                ctypes.byref(dark_mode_val),
                ctypes.sizeof(dark_mode_val)
            )

        # 2. Terapkan Warna Background Titlebar (Windows 11 22000+)
        caption_ref = hex_to_colorref(palette["bg"])
        caption_val = ctypes.c_uint32(caption_ref)
        hr_caption = dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR,
            ctypes.byref(caption_val),
            ctypes.sizeof(caption_val)
        )
        if hr_caption == 0:
            success = True

        # 3. Terapkan Warna Teks Titlebar (Windows 11 22000+)
        text_ref = hex_to_colorref(palette["text"])
        text_val = ctypes.c_uint32(text_ref)
        hr_text = dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_TEXT_COLOR,
            ctypes.byref(text_val),
            ctypes.sizeof(text_val)
        )
        if hr_text == 0:
            success = True

        # 4. Terapkan Warna Border Window (Windows 11 22000+)
        border_ref = hex_to_colorref(palette["border"])
        border_val = ctypes.c_uint32(border_ref)
        dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            ctypes.byref(border_val),
            ctypes.sizeof(border_val)
        )
    except Exception:
        pass

    return success
