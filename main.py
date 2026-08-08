import webview
import os
import sys
import traceback

# --- 1. FUNGSI RESOLUSI PATH PYINSTALLER ---
def resource_path(relative_path):
    """ Mendapatkan path absolut ke resource, kompatibel untuk Dev dan PyInstaller """
    try:
        # PyInstaller menyimpan path folder temporary di sys._MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        # Jika dijalankan normal (.py), gunakan direktori script ini
        base_path = os.path.abspath(os.path.dirname(__file__))

    return os.path.join(base_path, relative_path)

# --- 2. PERBARUI ENTRYPOINT ---
def get_entrypoint():
    is_production = True 
    if is_production:
        # Gunakan resource_path agar path dinamis mengikuti environment
        return resource_path(os.path.join('frontend', 'dist', 'index.html'))
    else:
        return 'http://localhost:5173'

# 1. Jejak Debug Import
print("[DEBUG] Memulai program...")
try:
    print("[DEBUG] Mengimpor modul API...")
    from core.api import Api
    print("[DEBUG] Import berhasil!")
except Exception as e:
    print("[FATAL ERROR] Gagal mengimpor core.api:")
    traceback.print_exc()
    sys.exit(1)

if __name__ == '__main__':
    try:
        print("[DEBUG] Membuat instance API...")
        api = Api()
        
        # PERBAIKI JUGA PATH ICON MENGGUNAKAN RESOURCE_PATH
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

        print("[DEBUG] Menjalankan WebView (Aplikasi mulai render)...")
        webview.start(debug=False, gui='edgechromium', icon=icon_path) 
        
        print("[DEBUG] Aplikasi ditutup dengan normal.")
        
    except Exception as e:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()