import webview
import json
from core.services.php import PhpManager
from core.services.apache import ApacheManager

class Api:
    def __init__(self):
        self._window = None
        self.php = PhpManager(self) 
        self.apache = ApacheManager(self)

    def set_window(self, window):
        self._window = window

    # Logs Sections
    def emit_log(self, message: str, level: str = "info"):
        """ Menembakkan log real-time ke LogsPanel React """
        if self._window:
            # Gunakan json.dumps agar string aman dari karakter petik/newline
            detail = json.dumps({"message": message, "level": level})
            script = f"window.dispatchEvent(new CustomEvent('vylo_log', {{detail: {detail} }}));"
            self._window.evaluate_js(script)

    def emit_progress(self, percent: int, text: str = ""):
        """ Menembakkan progress bar real-time ke Modal Instalasi """
        if self._window:
            detail = json.dumps({"percent": percent, "text": text})
            script = f"window.dispatchEvent(new CustomEvent('vylo_progress', {{detail: {detail} }}));"
            self._window.evaluate_js(script)

    def test_connection(self, data):
        self.emit_log(f"Menerima ping dari UI: {data}", "info")
        return {"status": "success", "message": "Koneksi Python dan React berhasil!"}

    # PHP Sections
    def get_php_versions(self):
        self.emit_log("Mengambil daftar versi PHP terbaru dari server...", "info")
        return self.php.get_versions()

    def install_php(self, version: str, filename: str, port: int):
        return self.php.install_version(version, filename, int(port))
    
    def get_installed_php(self):
        """ Mengirim daftar PHP yang terinstal beserta konfigurasinya ke React """
        return self.php.get_installed_instances()
    
    def get_php_config(self, version: str):
        return self.php.get_config(version)

    def save_php_config(self, version: str, config: dict, extensions: list):
        return self.php.save_config(version, config, extensions)
    
    def open_php_ini(self, version: str):
        return self.php.open_path(version, is_file=True)

    def open_php_dir(self, version: str):
        return self.php.open_path(version, is_file=False)

    def uninstall_php(self, version: str):
        return self.php.uninstall_version(version)
    
    def start_php(self, version: str):
        return self.php.start_php(version)

    def stop_php(self, version: str):
        return self.php.stop_php(version)
    
    # Apache sections
    def get_available_apache(self):
        """ Mengirim perintah ke Python untuk scrape ApacheLounge """
        return self.apache.get_available_versions()

    def install_apache(self, version: str, url: str, http_port: int, https_port: int):
        """ Memulai instalasi dan memberikan rollback protection """
        return self.apache.install_version(version, url, http_port, https_port)
    
    def get_apache_status(self):
        return self.apache.get_status()

    def uninstall_apache(self):
        return self.apache.uninstall()

    def open_apache_directory(self):
        return self.apache.open_directory()
        
    def open_apache_config(self):
        return self.apache.open_config()
    
    def get_apache_installed_versions(self):
        return self.apache.get_installed_versions()
        
    def set_apache_active_version(self, version: str):
        return self.apache.set_active_version(version)
        
    def open_apache_file(self, file_type: str):
        return self.apache.open_apache_file(file_type)
    
    def start_apache_server(self):
        return self.apache.start_server()

    def stop_apache_server(self):
        return self.apache.stop_server()