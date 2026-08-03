import os
import json

class DashboardManager:
    def __init__(self, api_ref):
        self.api = api_ref
        # Mencari root directory aplikasi (3 tingkat ke atas dari /core/services/dashboard.py)
        self.root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.config_path = os.path.join(self.data_dir, 'dashboard.json')

    def get_config(self):
        """Membaca preferensi toggle Dashboard dari JSON"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return {"status": "success", "data": json.load(f)}
            # TAMBAHKAN 'selected_php': [] SEBAGAI DEFAULT
            return {"status": "success", "data": {"apache": True, "php": True, "database": False, "selected_php": []}}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal membaca config dashboard: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def save_config(self, data):
        """Menyimpan preferensi toggle Dashboard ke JSON"""
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
            return {"status": "success"}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal menyimpan config dashboard: {str(e)}", "error")
            return {"status": "error", "message": str(e)}