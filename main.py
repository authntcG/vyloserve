import webview
import os
import sys
import traceback
import threading
import pystray
import ssl
import certifi
import ctypes
from core.utils.system_utils import get_project_root, get_resource_path, get_theme_titlebar_palette
from PIL import Image
from pystray import MenuItem as item
import webview.window
from webview.errors import JavascriptException

# --- MONKEY PATCH PYWEBVIEW ---
# Mencegah exception pada thread internal pywebview saat frontend reload (hot-reload Vite)
# yang menyebabkan promise JS hilang tapi backend tetap mencoba me-resolve-nya.
_orig_evaluate_js = webview.window.Window.evaluate_js
def _safe_evaluate_js(*args, **kwargs):
    try:
        return _orig_evaluate_js(*args, **kwargs)
    except JavascriptException as e:
        if "Cannot read properties of undefined" in str(e):
            pass # Abaikan error JS promise hilang
        else:
            raise
webview.window.Window.evaluate_js = _safe_evaluate_js

# --- KONSTANTA WINDOWS API ---
SW_SHOW = 5
SW_RESTORE = 9
ERROR_ALREADY_EXISTS = 183

# --- SINGLE INSTANCE & WINDOW MANAGEMENT ---

def get_theme_bg_color():
    settings_path = os.path.join(get_project_root(), 'data', 'settings.json')
    theme = "vyloserve-dark"
    if os.path.exists(settings_path):
        try:
            import json
            with open(settings_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                theme = data.get("theme", "vyloserve-dark")
        except Exception:
            pass
    return get_theme_titlebar_palette(theme)["bg"]

# --- KONFIGURASI ENVIRONMENT ---
# Auto-detect mode frozen (.exe) atau fallback ke False untuk Development
IS_PRODUCTION = getattr(sys, 'frozen', False) or False
APP_VERSION = "0.0.7-beta"

def get_mutex_name(is_production: bool = IS_PRODUCTION) -> str:
    return "VyloServe_App_Mutex_v1" if is_production else "VyloServe_Dev_App_Mutex_v1"

def get_ipc_pipe_name(is_production: bool = IS_PRODUCTION) -> str:
    return r'\\.\pipe\VyloServe_IPC_v1' if is_production else r'\\.\pipe\VyloServe_Dev_IPC_v1'

def get_window_title(is_production: bool = IS_PRODUCTION) -> str:
    return "VyloServe" if is_production else "VyloServe (Development)"

def setup_app_user_model_id(is_production: bool = IS_PRODUCTION):
    if sys.platform == 'win32':
        try:
            app_id = "VyloServe.App.Production" if is_production else "VyloServe.App.Development"
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
        except Exception:
            pass

def bring_existing_instance_to_front(is_production: bool = IS_PRODUCTION):
    """ 
    Mencari window VyloServe yang sudah berjalan dan memaksanya ke depan (foreground). 
    Mengutamakan sinyal IPC agar UI loop internal (WinForms) merestore window secara bersih.
    Jika IPC gagal, fallback ke Windows API ShowWindow.
    """
    pipe_name = get_ipc_pipe_name(is_production)
    ipc_success = False

    if sys.platform == 'win32':
        try:
            from multiprocessing.connection import Client
            client = Client(pipe_name, 'AF_PIPE')
            client.send('SHOW')
            client.close()
            ipc_success = True
            print("[DEBUG] Sinyal IPC 'SHOW' berhasil dikirim ke instance utama.")
        except Exception as e:
            print(f"[DEBUG] IPC Client gagal ({e}), menggunakan fallback FindWindow.")

    window_title = get_window_title(is_production)
    if sys.platform == 'win32':
        hwnd = ctypes.windll.user32.FindWindowW(None, window_title)
        if hwnd:
            if not ipc_success:
                ctypes.windll.user32.ShowWindow(hwnd, SW_SHOW)
                ctypes.windll.user32.ShowWindow(hwnd, SW_RESTORE)
            ctypes.windll.user32.SetForegroundWindow(hwnd)

def check_single_instance(is_production: bool = IS_PRODUCTION):
    """
    Mengecek apakah VyloServe sudah berjalan menggunakan OS Mutex.
    Mengembalikan (True, mutex) jika ini adalah instance pertama.
    Mengembalikan (False, None) jika instance lain sudah berjalan.
    """
    if sys.platform != 'win32':
        return True, None
    mutex_name = get_mutex_name(is_production)
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    last_error = ctypes.windll.kernel32.GetLastError()
    
    if last_error == ERROR_ALREADY_EXISTS:
        return False, None
    return True, mutex

# Independen dari IS_PRODUCTION secara sengaja -- IS_PRODUCTION JUGA mengontrol
# entrypoint (dist vs dev server Vite) dan flag devtools, jadi tidak bisa dipakai
# ulang untuk gating tray tanpa ikut mematikan hot-reload/devtools di dev mode.
# Tray diaktifkan di dev mode JUGA (bukan cuma production) supaya fitur hide-to-
# tray + notifikasi native bisa langsung dites tanpa build .exe.
ENABLE_TRAY = True

# --- FUNGSI RESOLUSI PATH PYINSTALLER ---
def resource_path(relative_path):
    """ Mendapatkan path absolut ke resource, kompatibel untuk Dev dan PyInstaller """
    return get_resource_path(relative_path)

# --- FUNGSI ENTRYPOINT ---
def get_entrypoint():
    if IS_PRODUCTION:
        return resource_path(os.path.join('frontend', 'dist', 'index.html'))
    else:
        return 'http://localhost:5173'


class AppLifecycle:
    """
    Mengelola siklus hidup jendela utama: exit bersih (mematikan semua engine
    Apache/PHP/Database agar tidak ada zombie process tertinggal), hide-to-tray
    saat tray aktif (`enable_tray`), dan penutupan System Tray.

    `is_production` dan `enable_tray` SENGAJA dipisah (bukan satu flag) --
    hide-to-tray sekarang bisa aktif di dev mode juga, sementara is_production
    tetap murni mengontrol hal lain (entrypoint, devtools) lewat IS_PRODUCTION
    di main(). Lihat ENABLE_TRAY di atas.

    Diekstrak menjadi class (bukan closure di dalam `if __name__ == '__main__'`)
    agar bisa diuji lewat unit test tanpa perlu benar-benar menjalankan
    pywebview/webview.start(). Sebelumnya struktur closure ini membuat main.py
    mustahil di-import untuk ditest (lihat docs/known_bugs.md).
    """
    def __init__(self, api, is_production: bool, enable_tray: bool = False):
        self.api = api
        self.is_production = is_production
        self.enable_tray = enable_tray
        self.window = None
        self.tray_icon = None
        self.ipc_listener = None
        self.is_real_exit = False
        self._exit_in_progress = False
        self._console_handler_ref = None

    def set_window(self, window):
        self.window = window

    def set_tray_icon(self, tray_icon):
        self.tray_icon = tray_icon

    def set_ipc_listener(self, ipc_listener):
        self.ipc_listener = ipc_listener

    def show_and_bring_to_front(self):
        """
        Mengembalikan window dari tray/minimized ke foreground secara bersih dari UI thread.
        Memicu show(), restore(), emit_window_state, dan pembaruan tema titlebar DWM.
        """
        if self.window:
            try:
                self.window.show()
                self.window.restore()
                self.api.emit_window_state(hidden=False, minimized=False)
                self.api.apply_titlebar_theme()
            except Exception as e:
                print(f"[ERROR] Gagal memulihkan jendela: {e}")

    def _cleanup_tray(self):
        if not self.tray_icon:
            return
        try:
            self.tray_icon.visible = False
        except Exception:
            pass
        try:
            self.tray_icon.stop()
        except Exception:
            pass
        self.tray_icon = None

    def _cleanup_ipc(self):
        if not self.ipc_listener:
            return
        try:
            self.ipc_listener.close()
        except Exception:
            pass
        self.ipc_listener = None

    def _stop_all_services(self):
        for stop_func in (
            lambda: self.api.stop_log_watcher(),
            lambda: self.api.apache.stop_server(),
            lambda: self.api.php.stop_all(),
            lambda: self.api.database.stop_all(),
        ):
            try:
                stop_func()
            except Exception:
                pass

    def _cleanup_window(self):
        if not self.window:
            return
        try:
            self.window.destroy()
        except Exception:
            pass
        self.window = None

    def perform_exit(self):
        """
        Mematikan semua engine (Apache/PHP/Database) sebelum benar-benar keluar,
        mencegah zombie process (httpd.exe/php-cgi.exe/mysqld.exe) tertinggal
        setelah aplikasi ditutup. Lihat docs/known_bugs.md #6.
        """
        if getattr(self, '_exit_in_progress', False):
            return
        self._exit_in_progress = True
        self.is_real_exit = True

        try:
            # 1. Nonaktifkan emit event UI agar proses shutdown tidak pernah terblokir oleh IPC webview
            if hasattr(self.api, 'set_shutting_down'):
                self.api.set_shutting_down()

            # 2. Hentikan System Tray terlebih dahulu agar ikon langsung hilang dari taskbar OS
            self._cleanup_tray()

            # 3. Tutup IPC listener agar instance lain tidak mencoba berkomunikasi saat shutdown
            self._cleanup_ipc()

            # 4 & 5. Hentikan log watcher dan seluruh engine server (Apache/PHP/Database)
            self._stop_all_services()

            # 6. Hancurkan jendela GUI jika masih ada
            self._cleanup_window()
        finally:
            os._exit(0)

    def on_closing(self):
        """
        Handler untuk event window.events.closing.
        Return True mengizinkan window benar-benar destroy, False membatalkannya.
        """
        # Jika PyWebView mendeteksi sinyal interrupt (Ctrl+C), lakukan exit bersih
        try:
            wf = sys.modules.get('webview.platforms.winforms')
            if wf is None:
                import webview.platforms.winforms as wf
            if getattr(wf, '_sigint_received', False):
                self.perform_exit()
                return True
        except Exception:
            pass

        # Tanpa tray aktif, hide-to-tray tidak berguna (tidak ada cara untuk
        # memunculkan window kembali) -- langsung tutup dan hancurkan aplikasi,
        # apa pun IS_PRODUCTION-nya.
        if not self.enable_tray:
            print("[DEBUG] Tray nonaktif: Menutup aplikasi sepenuhnya...")
            self.is_real_exit = True
            return True  # Mengizinkan window.destroy() berjalan

        # Tray aktif: sembunyikan ke background alih-alih benar-benar menutup.
        if not self.is_real_exit:
            self.window.hide()  # Sembunyikan jendela saja
            self.api.emit_window_state(hidden=True)
            return False  # Return False berarti membatalkan proses destroy

        return True  # Jika is_real_exit True, biarkan aplikasi mati


# --- FUNGSI IPC SERVER (SINGLE INSTANCE RESTORE) ---
def start_ipc_server(lifecycle: AppLifecycle, is_production: bool = IS_PRODUCTION):
    """
    Menjalankan background IPC listener via Named Pipe di OS Windows.
    Memungkinkan instance baru untuk meminta instance ini kembali ke foreground
    melalui UI thread internal (lifecycle.show_and_bring_to_front).
    """
    if sys.platform != 'win32':
        return None
    try:
        from multiprocessing.connection import Listener
        pipe_name = get_ipc_pipe_name(is_production)
        listener = Listener(pipe_name, 'AF_PIPE')
        lifecycle.set_ipc_listener(listener)

        def ipc_worker():
            while not lifecycle.is_real_exit:
                try:
                    conn = listener.accept()
                    msg = conn.recv()
                    if msg == 'SHOW':
                        lifecycle.show_and_bring_to_front()
                    conn.close()
                except Exception:
                    break

        threading.Thread(target=ipc_worker, daemon=True).start()
        print(f"[DEBUG] IPC Server berhasil berjalan di {pipe_name}")
        return listener
    except Exception as e:
        print(f"[WARNING] Gagal membuat IPC listener: {e}")
        return None


# --- FUNGSI SYSTEM TRAY (TASKBAR) ---
def setup_systray(lifecycle: AppLifecycle, icon_path: str):
    try:
        print(f"[DEBUG] Mencoba memuat ikon dari: {icon_path}")

        # 1. Fallback Image System (Jika ikon gagal dimuat)
        if os.path.exists(icon_path):
            image = Image.open(icon_path)
        else:
            print("[WARNING] File ikon tidak ditemukan! Menggunakan ikon darurat (Kotak Biru)...")
            image = Image.new('RGB', (64, 64), color=(59, 130, 246))

        # 2. Aksi: Tampilkan Window
        def on_show_clicked(icon, menu_item):
            lifecycle.show_and_bring_to_front()

        # 3. Aksi: Exit Aplikasi
        # Memakai lifecycle.perform_exit() yang sama dengan tombol Quit di UI,
        # agar engine Apache/PHP/Database tetap dimatikan dengan benar.
        # Dijalankan di thread daemon agar tidak memblokir message pump pystray.
        def on_exit_clicked(icon, menu_item):
            threading.Thread(target=lifecycle.perform_exit, daemon=True).start()

        # 4. Buat Menu
        menu = pystray.Menu(
            item('Show VyloServe', on_show_clicked, default=True),
            item('Exit Engine', on_exit_clicked)
        )

        # 5. Eksekusi Pystray
        tray_name = "VyloServe" if lifecycle.is_production else "VyloServe-Dev"
        tray_title = "VyloServe Background Engine" if lifecycle.is_production else "VyloServe Dev Background Engine"
        tray_icon = pystray.Icon(tray_name, image, tray_title, menu)
        lifecycle.set_tray_icon(tray_icon)

        def run_tray():
            try:
                tray_icon.run()
            except Exception as e:
                print(f"[FATAL TRAY ERROR] Gagal menjalankan icon loop: {e}")

        # Jalankan di thread terpisah
        threading.Thread(target=run_tray, daemon=True).start()
        print("[DEBUG] System Tray berhasil diregistrasi!")

    except Exception as e:
        print(f"[FATAL TRAY ERROR] Gagal menginisialisasi System Tray: {e}")


# --- SIGNAL & CONSOLE CONTROL HANDLER (CLEAN EXIT ON CTRL+C) ---
def setup_signal_handlers(lifecycle: AppLifecycle):
    """
    Menangani Ctrl+C (SIGINT), SIGTERM, dan event konsol Windows (CTRL_C_EVENT,
    CTRL_CLOSE_EVENT, dll.) agar ketika user menekan Ctrl+C di terminal/CMD
    atau menutup jendela terminal, aplikasi mematikan seluruh engine dan
    membersihkan ikon tray secara bersih sebelum proses keluar.
    """
    def _clean_exit(*_):
        lifecycle.perform_exit()

    import signal
    try:
        signal.signal(signal.SIGINT, _clean_exit)
    except Exception:
        pass
    try:
        signal.signal(signal.SIGTERM, _clean_exit)
    except Exception:
        pass
    if hasattr(signal, 'SIGBREAK'):
        try:
            signal.signal(signal.SIGBREAK, _clean_exit)
        except Exception:
            pass

    # Windows Console Control Handler (SetConsoleCtrlHandler)
    if sys.platform == 'win32':
        try:
            handler_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_ulong)
            def _console_ctrl_handler(ctrl_type: int) -> bool:
                _clean_exit()
                return True

            _handler_ref = handler_type(_console_ctrl_handler)
            ctypes.windll.kernel32.SetConsoleCtrlHandler(_handler_ref, True)
            lifecycle._console_handler_ref = _handler_ref
        except Exception:
            pass

    # Hook PyWebView's internal winforms _sigint_handler jika tersedia
    try:
        wf = sys.modules.get('webview.platforms.winforms')
        if wf is None:
            import webview.platforms.winforms as wf
        _orig_wf_sigint = getattr(wf, '_sigint_handler', None)
        def _hooked_wf_sigint(signum, frame):
            if _orig_wf_sigint:
                try:
                    _orig_wf_sigint(signum, frame)
                except Exception:
                    pass
            _clean_exit()
        wf._sigint_handler = _hooked_wf_sigint
    except Exception:
        pass


def main():
    setup_app_user_model_id(IS_PRODUCTION)

    # 1. Cek apakah VyloServe sudah berjalan
    is_first_instance, _ = check_single_instance(IS_PRODUCTION)
    if not is_first_instance:
        print("[INFO] VyloServe sudah berjalan. Menampilkan window yang ada...")
        bring_existing_instance_to_front(IS_PRODUCTION)
        sys.exit(0)
        return

    try:
        print("[DEBUG] Membuat instance API...")
        from core.api import Api
        api = Api()

        lifecycle = AppLifecycle(api, IS_PRODUCTION, enable_tray=ENABLE_TRAY)

        icon_path = resource_path(os.path.join('frontend', 'src', 'assets', 'icons-nobg.ico'))
        # Notifikasi toast WinRT (win11toast) butuh PNG -- .ico (dipakai window/tray) tidak
        # reliable dirender WIC image pipeline milik toast XML <image>. Aset PNG yang sama
        # persis sudah ada di folder yang sama (lihat frontend/src/assets).
        notification_icon_path = resource_path(os.path.join('frontend', 'src', 'assets', 'icons-nobg.png'))

        print("[DEBUG] Membangun jendela UI (Window)...")
        window = webview.create_window(
            title=get_window_title(IS_PRODUCTION),
            url=get_entrypoint(),
            js_api=api,
            width=1200,
            height=800,
            min_size=(900, 600),
            background_color=get_theme_bg_color()
        )
        api.set_window(window)
        api.set_notification_icon(notification_icon_path)
        lifecycle.set_window(window)
        api.start_log_watcher()

        api.quit_callback = lifecycle.perform_exit

        # Start IPC server untuk menerima sinyal wake-up dari instance berikutnya
        start_ipc_server(lifecycle, IS_PRODUCTION)

        # Setup sinyal dan Windows console event handler (Ctrl+C / terminal close)
        setup_signal_handlers(lifecycle)

        # --- CEGAT EVENT TOMBOL CLOSE (X) ---
        window.events.closing += lifecycle.on_closing

        # --- PUSH STATE MINIMIZE/RESTORE KE FRONTEND ---
        # Dipakai NotificationBell/useWindowPresence.ts untuk menentukan kapan
        # notifikasi native Windows perlu ditampilkan (lihat core/api.py
        # emit_window_state). Event ini sudah dikonfirmasi reliable untuk
        # backend 'edgechromium' yang dipakai di sini (WinForms on_resize
        # handler, lihat webview/platforms/winforms.py) -- bukan event yang
        # cuma didokumentasikan tapi belum teruji.
        window.events.minimized += lambda: api.emit_window_state(minimized=True)
        window.events.restored += lambda: api.emit_window_state(minimized=False)

        # --- DWM TITLEBAR NATIVE THEME (WINDOWS 10/11) ---
        window.events.shown += lambda: api.apply_titlebar_theme()

        # --- AKTIFKAN SYSTEM TRAY ---
        if ENABLE_TRAY:
            setup_systray(lifecycle, icon_path)
        else:
            print("[DEBUG] System Tray dinonaktifkan (ENABLE_TRAY=False).")

        print("[DEBUG] Menjalankan WebView (Aplikasi mulai render)...")

        # Parameter debug akan otomatis menyesuaikan dengan status IS_PRODUCTION
        webview.start(debug=not IS_PRODUCTION, gui='edgechromium', icon=icon_path)

        print("[DEBUG] Aplikasi ditutup dengan normal.")
        lifecycle.perform_exit()

    except KeyboardInterrupt:
        print("\n[INFO] KeyboardInterrupt (Ctrl+C) diterima. Menutup VyloServe...")
        if 'lifecycle' in locals():
            lifecycle.perform_exit()
    except Exception:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()
        if 'lifecycle' in locals():
            lifecycle.perform_exit()


if __name__ == '__main__':
    main()
