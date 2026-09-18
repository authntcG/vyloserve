import os
from typing import Dict, Any

from core.utils.system_utils import get_project_root
from core.utils.file_utils import read_json, write_json

class SettingsManager:
    """
    Manager untuk menangani konfigurasi preferensi global aplikasi (seperti bahasa, tema, dsb).
    Berfungsi sebagai 'Source of Truth' untuk pengaturan UI di luar Dashboard.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.config_path = os.path.join(self.data_dir, 'settings.json')

    def get_settings(self) -> Dict[str, Any]:
        """
        Membaca pengaturan global aplikasi dari JSON.
        Menerapkan Auto-Merge dengan nilai Default untuk fleksibilitas di masa depan.
        """
        try:
            # Default settings. Mudah diextend di kemudian hari.
            default_config = {
                "language": "en" # 'en' atau 'id'
            }
            
            data = read_json(self.config_path, default_type=dict)
            
            if not data:
                return {"status": "success", "data": default_config}
                
            merged_data = {**default_config, **data}
            return {"status": "success", "data": merged_data}
            
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log("backend.error.unexpected", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def save_settings(self, data: dict) -> Dict[str, str]:
        """
        Menyimpan pengaturan global aplikasi ke JSON.
        Melakukan merge dengan data yang sudah ada agar setting lain tidak terhapus.
        """
        try:
            # Ambil data lama agar tidak menimpa setting yang tidak diupdate
            current_settings = self.get_settings().get("data", {})
            merged_settings = {**current_settings, **data}

            success = write_json(self.config_path, merged_settings)
            if success:
                return {"status": "success"}
            else:
                raise RuntimeError("Proses penulisan pengaturan diblokir oleh OS.")
                
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log("backend.error.unexpected", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
