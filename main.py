import webview
import os
import sys
import traceback
import threading
import pystray
import ssl
import certifi
from PIL import Image
from pystray import MenuItem as item

# SSL Global Configuration
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

# --- KONFIGURASI ENVIRONMENT ---
# Ubah menjadi True jika ingin melakukan build (.exe) atau Alpha Testing
IS_PRODUCTION = True
APP_VERSION = "0.0.4-beta"

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
    di mode Production, dan penutupan System Tray.

    Diekstrak menjadi class (bukan closure di dalam `if __name__ == '__main__'`)
    agar bisa diuji lewat unit test tanpa perlu benar-benar menjalankan
    pywebview/webview.start(). Sebelumnya struktur closure ini membuat main.py
    mustahil di-import untuk ditest (lihat docs/known_bugs.md).
    """
    def __init__(self, api, is_production: bool):
        self.api = api
        self.is_production = is_production
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
        # Jika mode DEV (Production = False): Langsung tutup dan hancurkan aplikasi
        if not self.is_production:
            print("[DEBUG] Development Mode: Menutup aplikasi sepenuhnya...")
            self.is_real_exit = True
            return True  # Mengizinkan window.destroy() berjalan

        # Jika mode PROD (Production = True): Sembunyikan ke background
        if not self.is_real_exit:
            self.window.hide()  # Sembunyikan jendela saja
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
    try:
        print("[DEBUG] Membuat instance API...")
        from core.api import Api
        api = Api()

        lifecycle = AppLifecycle(api, IS_PRODUCTION)

        icon_path = resource_path(os.path.join('frontend', 'src', 'assets', 'icons-nobg.ico'))

        print("[DEBUG] Membangun jendela UI (Window)...")
        window = webview.create_window(
            title='VyloServe',
            url=get_entrypoint(),
            js_api=api,
            width=1200,
            height=800,
            min_size=(900, 600),
            background_color='#0f172a'
        )
        api.set_window(window)
        lifecycle.set_window(window)
        api.start_log_watcher()

        api.quit_callback = lifecycle.perform_exit

        # --- CEGAT EVENT TOMBOL CLOSE (X) ---
        window.events.closing += lifecycle.on_closing

        # --- AKTIFKAN SYSTEM TRAY (Hanya untuk Production) ---
        if IS_PRODUCTION:
            setup_systray(lifecycle, icon_path)
        else:
            print("[DEBUG] Development Mode: System Tray dinonaktifkan untuk mempermudah reload.")

        print("[DEBUG] Menjalankan WebView (Aplikasi mulai render)...")

        # Parameter debug akan otomatis menyesuaikan dengan status IS_PRODUCTION
        webview.start(debug=not IS_PRODUCTION, gui='edgechromium', icon=icon_path)

        print("[DEBUG] Aplikasi ditutup dengan normal.")

    except Exception:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()


if __name__ == '__main__':
    main()
