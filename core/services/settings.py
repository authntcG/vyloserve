import os
from typing import Dict, Any

from core.utils.system_utils import get_project_root
from core.utils.file_utils import read_json, write_json

MSG_UNEXPECTED_ERROR = "backend.error.unexpected"

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
                "language": "en", # 'en' atau 'id'
                "theme": "vyloserve-dark",
                "receive_prerelease_updates": False, # opsi untuk auto-updater
                "enable_desktop_notifications": True, # notifikasi native Windows saat window backgrounded
                "default_apache_install_location": "", # lokasi folder terakhir dipakai di modal New Project
                # None = belum pernah dikustomisasi user -> tampilkan semua level/source.
                # SENGAJA bukan array kosong ([]) -- array kosong dipakai sebagai nilai TERSIMPAN
                # yang SAH kalau user secara eksplisit meng-uncheck semua checkbox (artinya "jangan
                # tampilkan apa pun"). Kalau None dan [] dianggap sama, "uncheck semua lalu Save"
                # tidak bisa dibedakan dari "belum pernah diatur", sehingga preferensi user seolah
                # tidak pernah tersimpan (lihat docs/known_bugs.md).
                "system_log_levels": None,
                "system_log_sources": None,
                "enable_ai_assistant": True,
                "enable_floating_ai": True,
                "ai_provider": "gemini",
                "ai_model": "gemini-3.5-flash-lite",
                "ai_api_key": "",
                "ai_base_url": "http://localhost:11434/v1",
                "ai_auto_context": True,
                "ai_temperature": 0.5
            }
            
            data = read_json(self.config_path, default_type=dict)
            
            if not data:
                return {"status": "success", "data": default_config}
                
            merged_data = {**default_config, **data}
            # Auto-migrate model Gemini yang sudah didegradasi/404 oleh Google
            if merged_data.get("ai_provider") == "gemini" and merged_data.get("ai_model") in (
                "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"
            ):
                merged_data["ai_model"] = "gemini-3.5-flash-lite"
            return {"status": "success", "data": merged_data}
            
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

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
                self.api.emit_log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
