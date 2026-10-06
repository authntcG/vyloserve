import webview
import os
import sys
import traceback
import threading
import pystray
import ssl
import certifi
import ctypes
from core.utils.system_utils import get_project_root
from PIL import Image
from pystray import MenuItem as item

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
    mapping = {
        "vyloserve-dark": "#0f172a",
        "vyloserve-light": "#f8fafc",
        "darcula-dark": "#2b2b2b",
        "solarized-dark": "#002b36",
        "solarized-light": "#fdf6e3",
        "high-contrast-dark": "#000000",
        "high-contrast-light": "#ffffff",
        "monokai-dark": "#272822",
        "dracula-dark": "#282a36",
        "nord-dark": "#2e3440"
    }
    return mapping.get(theme, "#0f172a")

def bring_existing_instance_to_front():
    """ 
    Mencari window VyloServe yang sudah berjalan dan memaksanya ke depan (foreground). 
    Juga mengembalikan window dari mode minimized jika diperlukan.
    """
    hwnd = ctypes.windll.user32.FindWindowW(None, "VyloServe")
    if hwnd:
        ctypes.windll.user32.ShowWindow(hwnd, SW_SHOW)
        ctypes.windll.user32.ShowWindow(hwnd, SW_RESTORE)
        ctypes.windll.user32.SetForegroundWindow(hwnd)

def check_single_instance():
    """
    Mengecek apakah VyloServe sudah berjalan menggunakan OS Mutex.
    Mengembalikan (True, mutex) jika ini adalah instance pertama.
    Mengembalikan (False, None) jika instance lain sudah berjalan.
    """
    mutex_name = "VyloServe_App_Mutex_v1"
    mutex = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    last_error = ctypes.windll.kernel32.GetLastError()
    
    if last_error == ERROR_ALREADY_EXISTS:
        return False, None
    return True, mutex

# SSL Global Configuration
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

# --- KONFIGURASI ENVIRONMENT ---
# Ubah menjadi True jika ingin melakukan build (.exe) atau Alpha Testing
IS_PRODUCTION = True
APP_VERSION = "0.0.5-beta"

# Independen dari IS_PRODUCTION secara sengaja -- IS_PRODUCTION JUGA mengontrol
# entrypoint (dist vs dev server Vite) dan flag devtools, jadi tidak bisa dipakai
# ulang untuk gating tray tanpa ikut mematikan hot-reload/devtools di dev mode.
# Tray diaktifkan di dev mode JUGA (bukan cuma production) supaya fitur hide-to-
# tray + notifikasi native bisa langsung dites tanpa build .exe.
ENABLE_TRAY = True

# --- FUNGSI RESOLUSI PATH PYINSTALLER ---
def resource_path(relative_path):
    """ Mendapatkan path absolut ke resource, kompatibel untuk Dev dan PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

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
        self.is_real_exit = False

    def set_window(self, window):
        self.window = window

    def set_tray_icon(self, tray_icon):
        self.tray_icon = tray_icon

    def perform_exit(self):
        """
        Mematikan semua engine (Apache/PHP/Database) sebelum benar-benar keluar,
        mencegah zombie process (httpd.exe/php-cgi.exe/mysqld.exe) tertinggal
        setelah aplikasi ditutup. Lihat docs/known_bugs.md #6.
        """
        self.is_real_exit = True

        try:
            self.api.stop_log_watcher()
        except Exception:
            pass
        try:
            self.api.apache.stop_server()
        except Exception:
            pass
        try:
            self.api.php.stop_all()
        except Exception:
            pass
        try:
            self.api.database.stop_all()
        except Exception:
            pass

        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        if self.window:
            try:
                self.window.destroy()
            except Exception:
                pass
        os._exit(0)

    def on_closing(self):
        """
        Handler untuk event window.events.closing.
        Return True mengizinkan window benar-benar destroy, False membatalkannya.
        """
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
            lifecycle.window.show()
            lifecycle.window.restore()
            lifecycle.api.emit_window_state(hidden=False, minimized=False)

        # 3. Aksi: Exit Aplikasi
        # Memakai lifecycle.perform_exit() yang sama dengan tombol Quit di UI,
        # agar engine Apache/PHP/Database tetap dimatikan dengan benar (bukan
        # jalur pintas terpisah yang melewatkan cleanup, seperti sebelumnya).
        def on_exit_clicked(icon, menu_item):
            lifecycle.perform_exit()

        # 4. Buat Menu
        menu = pystray.Menu(
            item('Show VyloServe', on_show_clicked, default=True),
            item('Exit Engine', on_exit_clicked)
        )

        # 5. Eksekusi Pystray
        tray_icon = pystray.Icon("VyloServe", image, "VyloServe Background Engine", menu)
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


def main():
    # 1. Cek apakah VyloServe sudah berjalan
    is_first_instance, _ = check_single_instance()
    if not is_first_instance:
        print("[INFO] VyloServe sudah berjalan. Menampilkan window yang ada...")
        bring_existing_instance_to_front()
        sys.exit(0)

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
            title='VyloServe',
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

        # --- AKTIFKAN SYSTEM TRAY ---
        if ENABLE_TRAY:
            setup_systray(lifecycle, icon_path)
        else:
            print("[DEBUG] System Tray dinonaktifkan (ENABLE_TRAY=False).")

        print("[DEBUG] Menjalankan WebView (Aplikasi mulai render)...")

        # Parameter debug akan otomatis menyesuaikan dengan status IS_PRODUCTION
        webview.start(debug=not IS_PRODUCTION, gui='edgechromium', icon=icon_path)

        print("[DEBUG] Aplikasi ditutup dengan normal.")

    except Exception:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()


if __name__ == '__main__':
    main()
