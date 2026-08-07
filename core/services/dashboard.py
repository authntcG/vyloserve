import os
from typing import Dict, Any

# ---> IMPORT UTILITIES DARI TAHAP 1 <---
from core.utils.system_utils import get_project_root
from core.utils.file_utils import read_json, write_json

class DashboardManager:
    """
    Manager untuk menangani konfigurasi preferensi UI Dashboard.
    Berfungsi sebagai 'Source of Truth' untuk status seleksi (Apache, PHP, Database).
    """
    def __init__(self, api_ref):
        self.api = api_ref
        
        # 1. DRY: Menggunakan fungsi utilitas terpusat, bukan hardcode os.path berulang
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.config_path = os.path.join(self.data_dir, 'dashboard.json')

    def get_config(self) -> Dict[str, Any]:
        """
        Membaca preferensi toggle Dashboard dari JSON.
        Menerapkan Auto-Merge dengan nilai Default untuk mencegah KeyError.
        """
        try:
            default_config = {
                "apache": True, 
                "php": True, 
                "database": False, 
                "selected_php": [], 
                "selected_database": []
            }
            
            # 2. DRY: Menggunakan utilitas JSON universal
            data = read_json(self.config_path, default_type=dict)
            
            if not data:
                return {"status": "success", "data": default_config}
                
            # Cerdas: Gabungkan data lama dengan default (agar key baru dari update tidak hilang)
            merged_data = {**default_config, **data}
            return {"status": "success", "data": merged_data}
            
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal membaca config dashboard: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def save_config(self, data: dict) -> Dict[str, str]:
        """
        Menyimpan preferensi toggle Dashboard ke JSON.
        """
        try:
            # 3. DRY: write_json sudah otomatis menangani os.makedirs di dalamnya
            success = write_json(self.config_path, data)
            if success:
                return {"status": "success"}
            else:
                raise Exception("Proses penulisan diblokir oleh OS.")
                
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal menyimpan config dashboard: {str(e)}", "error")
            return {"status": "error", "message": str(e)}