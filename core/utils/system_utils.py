import os
import sys
import socket
import subprocess
import time
from typing import List, Optional, Dict, Any, Tuple

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
# WINDOWS USER REGISTRY & PATH MANAGEMENT
# ==========================================
HWND_BROADCAST = 0xFFFF
WM_SETTINGCHANGE = 0x001A
SMTO_ABORTIFHUNG = 0x0002

def broadcast_environment_change(timeout_ms: int = 5000) -> bool:
    """
    Mengirimkan broadcast WM_SETTINGCHANGE ('Environment') ke seluruh jendela OS
    agar perubahan PATH / Environment Variable Windows langsung aktif di sesi CMD/PowerShell baru.
    """
    if sys.platform != 'win32':
        return False
    try:
        import ctypes
        result = ctypes.c_ulong()
        ctypes.windll.user32.SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            'Environment',
            SMTO_ABORTIFHUNG,
            timeout_ms,
            ctypes.byref(result)
        )
        return True
    except Exception:
        return False

def get_user_path_entries() -> List[str]:
    """
    Membaca daftar entri PATH pengguna dari Registry Windows (HKCU\\Environment).
    """
    if sys.platform != 'win32':
        return []
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_READ)
        try:
            path_val, _ = winreg.QueryValueEx(key, 'Path')
            return [p for p in path_val.split(';') if p.strip()]
        except FileNotFoundError:
            return []
        finally:
            try: winreg.CloseKey(key)
            except Exception: pass
    except Exception:
        return []

def is_in_user_path(target_path: str) -> bool:
    """
    Mengecek apakah suatu direktori/file sudah terdaftar di HKCU User PATH.
    """
    if not target_path or sys.platform != 'win32':
        return False
    normalized_target = os.path.normpath(target_path).lower().rstrip('\\/')
    entries = [os.path.normpath(p).lower().rstrip('\\/') for p in get_user_path_entries()]
    return normalized_target in entries

def _filter_prefix(current: List[str], prefix: str) -> Tuple[List[str], bool]:
    norm_prefix = os.path.normpath(prefix).lower()
    new_list = [p for p in current if not os.path.normpath(p).lower().startswith(norm_prefix)]
    return new_list, len(new_list) != len(current)

def _remove_path_entries(current: List[str], remove_paths: List[str]) -> Tuple[List[str], bool]:
    res = list(current)
    modified = False
    for rp in remove_paths:
        norm_rp = os.path.normpath(rp).lower()
        idx = next((i for i, p in enumerate(res) if os.path.normpath(p).lower() == norm_rp), None)
        if idx is not None:
            res.pop(idx)
            modified = True
    return res, modified

def _append_unique_paths(current: List[str], add_paths: List[str]) -> Tuple[List[str], bool]:
    res = list(current)
    norm_set = {os.path.normpath(p).lower() for p in res}
    modified = False
    for ap in add_paths:
        norm_ap = os.path.normpath(ap)
        if norm_ap.lower() not in norm_set:
            res.append(norm_ap)
            norm_set.add(norm_ap.lower())
            modified = True
    return res, modified

def modify_user_path(
    add_paths: Optional[List[str]] = None,
    remove_paths: Optional[List[str]] = None,
    remove_prefix: Optional[str] = None,
    auto_broadcast: bool = False
) -> bool:
    """
    Menambah atau menghapus path dari Registry User PATH (HKCU\\Environment).
    Jika auto_broadcast=True, otomatis memanggil broadcast_environment_change().
    Mengembalikan True jika terjadi perubahan pada PATH.
    """
    if sys.platform != 'win32':
        return False
    import winreg
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_ALL_ACCESS)
    try:
        try:
            path_val, _ = winreg.QueryValueEx(key, 'Path')
        except FileNotFoundError:
            path_val = ""
        current = [p for p in path_val.split(';') if p.strip()]
        modified = False

        if remove_prefix:
            current, mod = _filter_prefix(current, remove_prefix)
            modified = modified or mod

        if remove_paths:
            current, mod = _remove_path_entries(current, remove_paths)
            modified = modified or mod

        if add_paths:
            current, mod = _append_unique_paths(current, add_paths)
            modified = modified or mod

        if modified:
            new_path_str = ';'.join(current)
            winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, new_path_str)
            if auto_broadcast:
                broadcast_environment_change()
        return modified
    finally:
        try: winreg.CloseKey(key)
        except Exception: pass



# ==========================================
# EXTERNAL EXECUTABLE DETECTION (WITH TTL CACHE)
# ==========================================
_EXTERNAL_EXE_CACHE: Dict[str, Tuple[float, Optional[str]]] = {}
_CACHE_TTL_SECONDS = 30.0

def clear_external_exe_cache() -> None:
    """Mengosongkan cache deteksi biner eksternal."""
    _EXTERNAL_EXE_CACHE.clear()

def find_external_executable(
    command: str,
    vyloserve_bin: str = "",
    extra_paths: Optional[List[str]] = None,
    ttl: float = _CACHE_TTL_SECONDS
) -> Optional[str]:
    """
    Mendeteksi file biner executable di host OS di luar direktori VyloServe.
    Menerapkan 3 lapis deteksi (where.exe / registry PATH / extra paths & shutil.which)
    serta dilengkapi in-memory TTL caching untuk efisiensi performa.
    """
    cache_key = f"{command}:{vyloserve_bin}"
    now = time.time()
    if cache_key in _EXTERNAL_EXE_CACHE:
        cached_time, cached_val = _EXTERNAL_EXE_CACHE[cache_key]
        if now - cached_time < ttl:
            if cached_val is None or os.path.exists(cached_val):
                return cached_val

    result = _lookup_external_executable(command, vyloserve_bin, extra_paths)
    _EXTERNAL_EXE_CACHE[cache_key] = (now, result)
    return result

def _find_via_where_cmd(command: str, clean_vylo: str) -> Optional[str]:
    try:
        res = subprocess.run(
            ['where', command],
            capture_output=True,
            text=True,
            creationflags=get_silent_flags()
        )
        if res.returncode == 0:
            for p in res.stdout.strip().split('\n'):
                p_clean = os.path.normpath(p.strip())
                if p_clean and (not clean_vylo or clean_vylo not in p_clean.lower()):
                    return p_clean
    except OSError:
        pass
    return None

def _read_registry_path_entries(hkey, subkey: str) -> List[str]:
    import winreg
    try:
        with winreg.OpenKey(hkey, subkey, 0, winreg.KEY_READ) as key:
            sys_path, _ = winreg.QueryValueEx(key, 'Path')
            if sys_path:
                return sys_path.split(';')
    except (OSError, winreg.error):
        pass
    return []

def _find_via_registry_path(command: str, clean_vylo: str) -> Optional[str]:
    import shutil
    import winreg
    raw_paths = _read_registry_path_entries(
        winreg.HKEY_LOCAL_MACHINE,
        r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
    )
    raw_paths.extend(_read_registry_path_entries(
        winreg.HKEY_CURRENT_USER,
        r'Environment'
    ))

    clean_paths = []
    for p in raw_paths:
        p_clean = p.strip(' "\'')
        if p_clean:
            p_expanded = os.path.expandvars(p_clean)
            if not clean_vylo or clean_vylo not in os.path.normpath(p_expanded).lower():
                clean_paths.append(p_expanded)

    return shutil.which(command, path=os.pathsep.join(clean_paths))

def _find_in_extra_paths(extra_paths: Optional[List[str]]) -> Optional[str]:
    if extra_paths:
        for ep in extra_paths:
            if ep and os.path.exists(ep):
                return ep
    return None

def _lookup_external_executable(
    command: str,
    vyloserve_bin: str = "",
    extra_paths: Optional[List[str]] = None
) -> Optional[str]:
    import shutil
    clean_vylo = os.path.normpath(vyloserve_bin).lower() if vyloserve_bin else ""

    if sys.platform == 'win32':
        found = _find_via_where_cmd(command, clean_vylo)
        if found:
            return found

        try:
            found_reg = _find_via_registry_path(command, clean_vylo)
            if found_reg:
                return found_reg
        except Exception:
            pass

        return _find_in_extra_paths(extra_paths)

    # Non-Windows (Linux / macOS)
    env_path = os.environ.get('PATH', '')
    clean_paths = [
        p for p in env_path.split(os.pathsep)
        if not clean_vylo or clean_vylo not in p.lower()
    ]
    return shutil.which(command, path=os.pathsep.join(clean_paths))

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
    "xp-luna-light": {
        "bg": "#0054e3",
        "text": "#ffffff",
        "border": "#003c74",
        "dark_mode": False,
    },
    "xp-zune-dark": {
        "bg": "#1b1b1d",
        "text": "#f4f4f5",
        "border": "#e35c00",
        "dark_mode": True,
    },
    "catppuccin-dark": {
        "bg": "#181825",
        "text": "#cdd6f4",
        "border": "#313244",
        "dark_mode": True,
    },
    "tokyo-night-dark": {
        "bg": "#16161e",
        "text": "#c0caf5",
        "border": "#24283b",
        "dark_mode": True,
    },
    "gruvbox-dark": {
        "bg": "#1d2021",
        "text": "#ebdbb2",
        "border": "#3c3836",
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

def _get_hwnd_native(window: Any) -> Optional[int]:
    if window and hasattr(window, 'native') and window.native:
        handle = getattr(window.native, 'Handle', None)
        if handle is not None:
            return int(handle.ToInt64() if hasattr(handle, 'ToInt64') else handle)
    return None

def _extract_handle_int(handle: Any) -> Optional[int]:
    if handle is None:
        return None
    if hasattr(handle, 'ToInt64'):
        return int(handle.ToInt64())
    if hasattr(handle, 'ToInt32'):
        return int(handle.ToInt32())
    if isinstance(handle, int):
        return handle
    return None

def _get_hwnd_winforms(window: Any) -> Optional[int]:
    if not (window and hasattr(window, 'uid')):
        return None
    try:
        wf = sys.modules.get('webview.platforms.winforms')
        if not wf:
            import webview.platforms.winforms as wf
        form_inst = wf.BrowserView.instances.get(getattr(window, 'uid', None))
        if form_inst and hasattr(form_inst, 'Handle'):
            return _extract_handle_int(getattr(form_inst, 'Handle', None))
    except Exception:
        pass
    return None

def _get_hwnd_by_title(window: Any) -> Optional[int]:
    if not window:
        return None
    raw_title = getattr(window, 'title', None)
    title = raw_title if isinstance(raw_title, str) and raw_title.strip() else "VyloServe"
    try:
        import ctypes
        hwnd = ctypes.windll.user32.FindWindowW(None, title)
        if hwnd:
            return int(hwnd)
    except Exception:
        pass
    return None

def get_window_handle(window: Any = None) -> Optional[int]:
    """
    Mendapatkan HWND (Windows handle) untuk window PyWebview.
    Mendukung input HWND int langsung, window.native, BrowserView.instances pywebview,
    atau fallback FindWindowW.
    """
    if sys.platform != 'win32' or window is None or isinstance(window, bool):
        return None

    if isinstance(window, int):
        return window if window > 0 else None

    return _get_hwnd_native(window) or _get_hwnd_winforms(window) or _get_hwnd_by_title(window)


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
