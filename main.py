import webview
import os
import sys
import traceback

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

def get_entrypoint():
    is_production = False 
    if is_production:
        return os.path.join(os.path.dirname(__file__), 'frontend', 'dist', 'index.html')
    else:
        return 'http://localhost:5173'

if __name__ == '__main__':
    try:
        print("[DEBUG] Membuat instance API...")
        api = Api()

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
        # Kita paksa gui='edgechromium' agar Windows tahu engine apa yang harus dipakai
        webview.start(debug=True, gui='edgechromium') 
        
        print("[DEBUG] Aplikasi ditutup dengan normal.")
        
    except Exception as e:
        print("[FATAL ERROR] Terjadi kesalahan saat menjalankan aplikasi:")
        traceback.print_exc()