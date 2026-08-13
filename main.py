import webview
import os
import sys
import traceback
import threading
from PIL import Image
import pystray
from pystray import MenuItem as item

# --- KONFIGURASI ENVIRONMENT ---
# Ubah menjadi True jika ingin melakukan build (.exe) atau Alpha Testing
IS_PRODUCTION = False 

# Flag global untuk membedakan antara "Hide" dan "Benar-benar Exit"
is_real_exit = False

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

# --- FUNGSI SYSTEM TRAY (TASKBAR) ---
def setup_systray(window, icon_path):
    try:
        print(f"[DEBUG] Mencoba memuat ikon dari: {icon_path}")
        
        # 1. Fallback Image System (Jika ikon gagal dimuat)
        if os.path.exists(icon_path):
            image = Image.open(icon_path)
        else:
            print("[WARNING] File ikon tidak ditemukan! Menggunakan ikon darurat (Kotak Biru)...")
            image = Image.new('RGB', (64, 64), color=(59, 130, 246))

        # 2. Aksi: Tampilkan Window
        def on_show_clicked(icon, item):
            window.show()
            window.restore()

        # 3. Aksi: Exit Aplikasi
        def on_exit_clicked(icon, item):
            global is_real_exit
            is_real_exit = True
            icon.stop()
            window.destroy()
            os._exit(0)

        # 4. Buat Menu
        menu = pystray.Menu(
            item('Show VyloServe', on_show_clicked, default=True),
            item('Exit Engine', on_exit_clicked)
        )

        # 5. Eksekusi Pystray
        tray_icon = pystray.Icon("VyloServe", image, "VyloServe Background Engine", menu)
        
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


if __name__ == '__main__':
    try:
        print("[DEBUG] Membuat instance API...")
        from core.api import Api
        api = Api()
        
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

        # --- CEGAT EVENT TOMBOL CLOSE (X) ---
        def on_closing():
            global is_real_exit
            
            # Jika mode DEV (Production = False): Langsung tutup dan hancurkan aplikasi
            if not IS_PRODUCTION:
                print("[DEBUG] Development Mode: Menutup aplikasi sepenuhnya...")
                is_real_exit = True
                return True # Mengizinkan window.destroy() berjalan
                
            # Jika mode PROD (Production = True): Sembunyikan ke background
            if not is_real_exit:
                window.hide() # Sembunyikan jendela saja
                return False  # Return False berarti membatalkan proses destroy
            
            return True       # Jika is_real_exit True, biarkan aplikasi mati
        
        window.events.closing += on_closing

        # --- AKTIFKAN SYSTEM TRAY (Hanya untuk Production) ---
        if IS_PRODUCTION:
            setup_systray(window, icon_path)
        else:
            print("[DEBUG] Development Mode: System Tray dinonaktifkan untuk mempermudah reload.")

        print("[DEBUG] Menjalankan WebView (Aplikasi mulai render)...")
        
        # Parameter debug akan otomatis menyesuaikan dengan status IS_PRODUCTION
        webview.start(debug=not IS_PRODUCTION, gui='edgechromium', icon=icon_path) 
        
        print("[DEBUG] Aplikasi ditutup dengan normal.")
        
    except Exception as e:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()