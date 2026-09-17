import webview
import psutil
import json
import inspect
from typing import Dict, Any, Optional

# Import Modul-modul Manager
from core.services.php import PhpManager
from core.services.apache import ApacheManager
from core.services.project import ProjectManager
from core.services.ssl_manager import SslManager
from core.services.dashboard import DashboardManager
from core.services.database import DatabaseManager
from core.services.runtimes_manager import RuntimesManager
from core.services.git_manager import GitManager
from core.services.settings import SettingsManager

PROJECT_NOT_LOADED_MSG = "backend.error.project_module_not_loaded"

class Api:
    """
    API Router (Façade) yang menjembatani Frontend (React) dengan Backend (Python).
    Meneruskan secara buta (pass-through) semua request UI ke spesifik Manager Module (SRP).
    """
    def __init__(self):
        self._window: Optional[webview.Window] = None
        self.php = PhpManager(self) 
        self.apache = ApacheManager(self)
        self.project = ProjectManager(self)
        self.ssl = SslManager(self)
        self.dashboard = DashboardManager(self)
        self.database = DatabaseManager(self)
        self.runtimes_manager = RuntimesManager(self)
        self.git_manager = GitManager(self)
        self.settings = SettingsManager(self)

    def set_window(self, window: webview.Window):
        self._window = window

    # ==========================================
    # EVENT EMITTERS (UI SYNC)
    # ==========================================
    def _resolve_event_source(self) -> Optional[str]:
        """
        Deteksi otomatis nama class Manager yang memanggil emit_log/emit_progress
        (mis. "ApacheManager", "PhpManager"), tanpa perlu mengubah setiap call site.
        Dipakai frontend untuk memfilter event 'vylo_progress'/'vylo_log' agar tidak
        "bocor" ke halaman modul lain yang kebetulan sedang ter-mount bersamaan
        (lihat docs/known_bugs.md #7).
        """
        frame = inspect.currentframe()
        try:
            # frame -> _resolve_event_source, f_back -> emit_log/emit_progress, f_back.f_back -> pemanggil asli
            caller_frame = frame.f_back.f_back
            caller_self = caller_frame.f_locals.get('self') if caller_frame else None
            return caller_self.__class__.__name__ if caller_self is not None else None
        except Exception:
            return None
        finally:
            del frame

    def emit_log(self, message: str, level: str = "info", args: dict = None):
        """ Menembakkan log real-time ke LogsPanel React """
        if self._window:
            source = self._resolve_event_source()
            detail = json.dumps({"message": message, "level": level, "args": args or {}, "source": source})
            script = f"window.dispatchEvent(new CustomEvent('vylo_log', {{detail: {detail} }}));"
            self._window.evaluate_js(script)

    def emit_progress(self, percent: int, text: str = "", args: dict = None):
        """ Menembakkan progress bar real-time ke Modal Instalasi React """
        if self._window:
            source = self._resolve_event_source()
            detail = json.dumps({"percent": percent, "text": text, "args": args or {}, "source": source})
            script = f"window.dispatchEvent(new CustomEvent('vylo_progress', {{detail: {detail} }}));"
            self._window.evaluate_js(script)

    def test_connection(self, data: str) -> Dict[str, str]:
        self.emit_log(f"Menerima ping dari UI: {data}", "info")
        return {"status": "success", "message": "backend.api.connection_success"}

    # ==========================================
    # SIDEBAR & GLOBAL CONTROLLER SECTIONS
    # ==========================================
    def start_service(self, service_id: str) -> Dict[str, str]:
        if service_id == 'apache':
            self.emit_log("backend.apache.starting_service", "info")
            return self.apache.start_server()
        elif service_id == 'php':
            self.emit_log("backend.php.starting_service", "info")
            return self.php.start_all()
        elif service_id == 'database':
            self.emit_log("backend.database.starting_service", "info")
            return self.database.start_all()

    def stop_service(self, service_id: str) -> Dict[str, str]:
        if service_id == 'apache':
            self.emit_log("backend.apache.stopping_service", "warn")
            return self.apache.stop_server()
        elif service_id == 'php':
            self.emit_log("backend.php.stopping_service", "warn")
            return self.php.stop_all()
        elif service_id == 'database':
            self.emit_log("backend.database.stopping_service", "warn")
            return self.database.stop_all()
    
    def get_all_services_status(self) -> Dict[str, Any]:
        """ Mengambil metrik hardware dan status seluruh engine """
        cpu_usage = psutil.cpu_percent(interval=0.1)
        ram_usage = psutil.virtual_memory().percent

        return {
            "apache": self.apache.check_is_running(),
            "php": self.php.check_is_running(),
            "database": self.database.check_is_running(),
            "cpu_load": round(cpu_usage),
            "ram_usage": ram_usage
        }

    # ==========================================
    # PHP SECTIONS
    # ==========================================
    def get_php_versions(self):
        self.emit_log("backend.php.fetching_versions", "info")
        return self.php.get_versions()

    def install_php(self, version: str, filename: str, port: int):
        return self.php.install_version(version, filename, int(port))
    
    def get_installed_php(self):
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
    
    # ==========================================
    # APACHE SECTIONS
    # ==========================================
    def get_available_apache(self):
        return self.apache.get_available_versions()

    def install_apache(self, version: str, url: str, http_port: int):
        return self.apache.install_version(version, url, http_port)
    
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
    
    # ==========================================
    # PROJECT SECTIONS
    # ==========================================
    def browse_directory(self) -> Optional[str]:
        if self._window:
            result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
            if result and len(result) > 0:
                return result[0].replace('\\', '/')
        return None
    
    def open_browser(self, url: str):
        import webbrowser
        try:
            webbrowser.open(url)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": "backend.api.browser_failed", "args": {"e": str(e)}}

    def close_app(self):
        """ Menutup aplikasi sepenuhnya lewat request frontend """
        self.emit_log("backend.api.closing_app", "warn")
        if hasattr(self, 'quit_callback') and self.quit_callback:
            self.quit_callback()
        else:
            import os
            os._exit(0)

    def detect_framework(self, directory: str):
        return self.project.detect_framework(directory)

    def create_project(self, payload: dict):
        self.emit_log(f"Memulai setup project untuk {payload.get('domain')}...", "info")
        return self.project.create_project(payload)
    
    def get_projects(self):
        if hasattr(self, 'project') and self.project:
            return self.project.get_projects()
        return {"status": "error", "message": PROJECT_NOT_LOADED_MSG}

    def delete_project(self, project_id: str, delete_files: bool = False):
        if hasattr(self, 'project') and self.project:
            return self.project.delete_project(project_id, delete_files)
        return {"status": "error", "message": PROJECT_NOT_LOADED_MSG}

    def retry_sync_host(self, project_id: str):
        if hasattr(self, 'project') and self.project:
            return self.project.retry_sync_host(project_id)
        return {"status": "error", "message": PROJECT_NOT_LOADED_MSG}

    def open_in_explorer(self, path: str):
        if hasattr(self, 'project') and self.project:
            return self.project.open_in_explorer(path)
        return {"status": "error", "message": PROJECT_NOT_LOADED_MSG}
    
    def update_project(self, payload: dict):
        if hasattr(self, 'project') and self.project:
            return self.project.update_project(payload)
        return {"status": "error", "message": PROJECT_NOT_LOADED_MSG}
    
    # ==========================================
    # DASHBOARD SECTIONS
    # ==========================================
    def get_dashboard_config(self):
        return self.dashboard.get_config()
        
    def save_dashboard_config(self, data: dict):
        return self.dashboard.save_config(data)

    def get_app_settings(self):
        return self.settings.get_settings()

    def save_app_settings(self, data: dict):
        return self.settings.save_settings(data)
    
    # ==========================================
    # DATABASE SECTIONS
    # ==========================================
    def get_installed_databases(self):
        return self.database.get_installed()
        
    def check_port_in_use(self, port: int):
        return self.database.is_port_in_use(port)
    
    def get_available_databases(self, engine: str):
        return self.database.get_available_versions(engine)

    def install_database(self, engine: str, version: str, url: str, port: int, root_pass: str):
        return self.database.install_database(engine, version, url, port, root_pass)
    
    def uninstall_database(self, db_id: str, delete_data: bool = False):
        return self.database.uninstall_database(db_id, delete_data)
    
    def open_db_config_file(self, db_id: str):
        return self.database.open_path(db_id, is_file=True)

    def open_db_dir(self, db_id: str):
        return self.database.open_path(db_id, is_file=False)

    def get_db_config(self, db_id: str):
        return self.database.get_db_config(db_id)

    def save_db_config(self, db_id: str, new_config: dict):
        return self.database.save_db_config(db_id, new_config)
    
    def start_database(self, db_id: str):
        return self.database.start_database(db_id)

    def stop_database(self, db_id: str):
        return self.database.stop_database(db_id)
    
    def change_db_credentials(self, db_id: str, username: str, old_pass: str, new_pass: str):
        return self.database.change_db_credentials(db_id, username, old_pass, new_pass)

    # ==========================================
    # RUNTIMES API ENDPOINTS
    # ==========================================
    
    # --- Node.js ---
    def get_node_status(self):
        return self.runtimes_manager.get_node_status()

    def install_node(self, version_mode, enable_corepack):
        return self.runtimes_manager.install_node(version_mode, enable_corepack)

    def uninstall_node(self):
        return self.runtimes_manager.uninstall_node()

    def get_available_node_versions(self):
        return self.runtimes_manager.get_available_node_versions()

    # --- Python ---
    def get_python_status(self):
        return self.runtimes_manager.get_python_status()
        
    def install_python(self, minor_version, install_pip):
        return self.runtimes_manager.install_python(minor_version, install_pip)
        
    def uninstall_python(self):
        return self.runtimes_manager.uninstall_python()
    
    def get_available_python_versions(self):
        return self.runtimes_manager.get_available_python_versions()

    # --- Java (JDK) ---
    def get_java_status(self):
        return self.runtimes_manager.get_java_status()
        
    def install_java(self, version):
        return self.runtimes_manager.install_java(version)
        
    def uninstall_java(self):
        return self.runtimes_manager.uninstall_java()
    
    def get_available_java_versions(self):
        return self.runtimes_manager.get_available_java_versions()

    # --- Go Compiler ---
    def get_go_status(self):
        return self.runtimes_manager.get_go_status()

    def get_available_go_versions(self):
        return self.runtimes_manager.get_available_go_versions()
        
    def install_go(self, version):
        return self.runtimes_manager.install_go(version)
        
    def uninstall_go(self):
        return self.runtimes_manager.uninstall_go()

    # --- Universal Config ---
    def toggle_global_path(self, engine, enable):
        return self.runtimes_manager.toggle_user_path(engine, enable)

    # ==========================================
    # TOOLS API ENDPOINTS (GIT)
    # ==========================================
    def get_git_status(self):
        return self.git_manager.get_git_status()

    def get_available_git_versions(self):
        return self.git_manager.get_available_git_versions()

    def install_git(self, download_url, filename, version_text):
        return self.git_manager.install_git(download_url, filename, version_text)

    def uninstall_git(self):
        return self.git_manager.uninstall_git()

    def toggle_git_path(self, enable):
        return self.git_manager.toggle_user_path(enable)
    
    def get_git_config(self):
        return self.git_manager.get_git_config()

    def set_git_config(self, name, email):
        return self.git_manager.set_git_config(name, email)