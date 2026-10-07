import webview
import psutil
import json
import inspect
import threading
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
from core.services.updater import UpdaterManager
from core.services.tunnels import TunnelsManager

PROJECT_NOT_LOADED_MSG = "backend.error.project_module_not_loaded"
UNEXPECTED_ERROR_MSG = "backend.error.unexpected"

class Api:
    """
    API Router (FaÃƒÂ§ade) yang menjembatani Frontend (React) dengan Backend (Python).
    Meneruskan secara buta (pass-through) semua request UI ke spesifik Manager Module (SRP).
    """
    def __init__(self):
        self._window: Optional[webview.Window] = None
        self._notification_icon_path: Optional[str] = None
        self.php = PhpManager(self)
        self.apache = ApacheManager(self)
        self.project = ProjectManager(self)
        self.ssl = SslManager(self)
        self.dashboard = DashboardManager(self)
        self.database = DatabaseManager(self)
        self.runtimes_manager = RuntimesManager(self)
        self.git_manager = GitManager(self)
        self.settings = SettingsManager(self)
        self.updater = UpdaterManager(self)
        self.tunnels = TunnelsManager(self)
        self._log_watcher_thread: Optional[threading.Thread] = None
        self._log_watcher_stop = threading.Event()

    def set_window(self, window: webview.Window):
        self._window = window

    def set_notification_icon(self, icon_path: str):
        """ Path PNG ikon aplikasi untuk notifikasi native Windows -- lihat show_native_notification(). """
        self._notification_icon_path = icon_path

    # ==========================================
    # LOG WATCHER (Apache error_log/access_log & Database db_startup.log/*.err -> System Logs)
    # ==========================================
    def start_log_watcher(self, interval: float = 2.0):
        """
        Menjalankan thread background yang secara berkala memanggil
        ApacheManager/DatabaseManager.tail_new_logs() untuk menyalurkan baris
        baru di file log persisten ke System Logs (event 'vylo_log') secara
        otomatis, tanpa perlu user membuka modal log-file manual. Lihat
        docs/backend_services.md Ã‚Â§11.2 dan docs/known_bugs.md.

        Dipanggil sekali dari main.py setelah window terpasang (emit_log()
        butuh self._window untuk bisa mengirim event ke frontend).
        """
        if self._log_watcher_thread and self._log_watcher_thread.is_alive():
            return
        self._log_watcher_stop.clear()

        def _loop():
            while not self._log_watcher_stop.is_set():
                # Sengaja diam (tanpa emit_log) -- loop ini jalan setiap `interval` detik
                # selamanya, jadi melaporkan tiap kegagalan lewat System Logs akan membanjiri
                # panel user kalau errornya persisten (mis. file log terkunci terus-menerus).
                # tail_new_logs() di masing-masing manager sudah punya try/except sendiri untuk
                # kegagalan baca-file yang wajar; except di sini murni jaring pengaman terakhir.
                try:
                    self.apache.tail_new_logs()
                except Exception:
                    pass
                try:
                    self.database.tail_new_logs()
                except Exception:
                    pass
                self._log_watcher_stop.wait(interval)

        self._log_watcher_thread = threading.Thread(target=_loop, daemon=True)
        self._log_watcher_thread.start()

    def stop_log_watcher(self):
        """Menghentikan thread log watcher dengan bersih -- dipanggil saat AppLifecycle.perform_exit()."""
        self._log_watcher_stop.set()

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

    def emit_log(self, message: str, level: str = "info", args: dict = None, source_override: Optional[str] = None):
        """
        Menembakkan log real-time ke LogsPanel React. `source_override` dipakai
        pemanggil yang perlu label kategori BERBEDA dari nama class-nya sendiri
        secara auto-detect -- mis. ApacheManager.tail_new_logs() memakai
        'ApacheFileLog' (bukan 'ApacheManager') supaya baris dari file
        error_log/access_log bisa difilter terpisah dari pesan sistem Apache
        biasa di modal "System Logs" (lihat docs/known_bugs.md).
        """
        if self._window:
            source = source_override if source_override is not None else self._resolve_event_source()
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

    def emit_window_state(self, minimized: Optional[bool] = None, hidden: Optional[bool] = None):
        """
        Menembakkan perubahan state window (minimized / hidden-ke-tray) ke
        frontend (useWindowPresence.ts) -- dipakai untuk menentukan kapan toast
        perlu diteruskan sebagai notifikasi native Windows (lihat main.py
        AppLifecycle.on_closing/setup_systray dan window.events.minimized/
        restored). Hanya field yang di-set (bukan None) yang dikirim, supaya
        listener frontend bisa membedakan "tidak berubah" dari "eksplisit false".
        """
        if self._window:
            detail: Dict[str, Any] = {}
            if minimized is not None:
                detail["minimized"] = minimized
            if hidden is not None:
                detail["hidden"] = hidden
            if not detail:
                return
            script = f"window.dispatchEvent(new CustomEvent('vylo_window_state', {{detail: {json.dumps(detail)} }}));"
            self._window.evaluate_js(script)

    def show_native_notification(self, message: str, type: str = "info") -> Dict[str, str]:
        """
        Menampilkan notifikasi native Windows (win11toast) -- dipanggil frontend
        (ToastContext.tsx) saat sebuah toast terjadi ketika window backgrounded
        (tidak fokus / minimized / hidden ke tray) DAN setting
        enable_desktop_notifications aktif. Dijalankan di thread terpisah
        (konsisten pola daemon thread pystray di main.py) karena win11toast
        butuh event loop asyncio sendiri yang tidak boleh memblokir UI thread
        pywebview.
        """
        def _run():
            try:
                from win11toast import toast
                import os
                from core.utils.system_utils import get_project_root
                
                # Notifikasi error/warning dibuat tidak auto-dismiss cepat --
                # lebih penting untuk tidak terlewat dibanding notifikasi biasa.
                duration = "long" if type in ("error", "warning") else "short"
                
                # Petakan tipe ke path aset yang sesuai
                icon_map = {
                    "success": "notify-success.png",
                    "error": "notify-error.png",
                    "warning": "notify-warning.png",
                    "info": "notify-info.png"
                }
                
                # Fallback ke logo VyloServe jika tipe tidak dikenali
                icon_filename = icon_map.get(type)
                if icon_filename:
                    icon_path = os.path.join(get_project_root(), 'frontend', 'src', 'assets', icon_filename)
                else:
                    icon_path = self._notification_icon_path

                toast(
                    "VyloServe",
                    message,
                    icon=icon_path,
                    duration=duration,
                    app_id="VyloServe",
                    on_click=self._restore_window_from_notification,
                )
            except Exception as e:
                self.emit_log(UNEXPECTED_ERROR_MSG, "error", {"e": str(e)})

        threading.Thread(target=_run, daemon=True).start()
        return {"status": "success"}

    def _restore_window_from_notification(self, args=None):
        """ on_click callback win11toast -- restore + focus window saat notifikasi native diklik. """
        if self._window:
            self._window.show()
            self._window.restore()
            self.emit_window_state(hidden=False, minimized=False)

    def test_connection(self, data: str) -> Dict[str, str]:
        self.emit_log("backend.api.ping_received", "info", {"data": data})
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
    
    def update_php(self, old_version: str, new_version: str, filename: str):
        return self.php.update_version(old_version, new_version, filename)

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

    def get_apache_log_content(self, log_type: str):
        return self.apache.get_log_content(log_type)

    def start_apache_server(self):
        return self.apache.start_server()

    def stop_apache_server(self):
        return self.apache.stop_server()
    
    # ==========================================
    # FILE / DIRECTORY DIALOG
    # ==========================================
    def save_base64_file(self, filename: str, base64_data: str, file_types: tuple = ('All files (*.*)',)):
        if not self._window: return {"status": "error", "message": UNEXPECTED_ERROR_MSG, "args": {"e": "No window"}}
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG, 
            save_filename=filename,
            file_types=file_types
        )
        if result and len(result) > 0:
            filepath = result[0]
            try:
                import base64
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(base64_data))
                return {"status": "success", "message": "backend.common.file_saved", "args": {"path": filepath}}
            except Exception as e:
                return {"status": "error", "message": UNEXPECTED_ERROR_MSG, "args": {"e": str(e)}}
        return {"status": "cancelled", "message": ""}

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
        self.emit_log("backend.project.starting_setup", "info", {"domain": payload.get('domain')})
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
    
    def update_database(self, db_id: str, new_version: str, url: str, backup_data: bool = False):
        return self.database.update_database(db_id, new_version, url, backup_data)

    def uninstall_database(self, db_id: str, delete_data: bool = False):
        return self.database.uninstall_database(db_id, delete_data)
    
    def open_db_config_file(self, db_id: str):
        return self.database.open_path(db_id, is_file=True)

    def open_db_dir(self, db_id: str):
        return self.database.open_path(db_id, is_file=False)

    def get_database_log_content(self, db_id: str, log_type: str = 'startup'):
        return self.database.get_log_content(db_id, log_type)

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
    # ==========================================
    # UPDATER MANAGER (VyloServe Auto-Update)
    # ==========================================
    def get_app_version(self):
        from main import APP_VERSION
        return APP_VERSION

    def check_for_updates(self):
        return self.updater.check_for_updates()

    def get_update_status(self):
        return self.updater.get_update_status()

    def start_download_update(self, asset_url, asset_name):
        return self.updater.start_download_update(asset_url, asset_name)

    def install_update(self):
        return self.updater.install_update()

    # --- TUNNELS MANAGER ---
    def get_available_zrok_versions(self):
        return self.tunnels.get_available_zrok_versions()

    def get_zrok_status(self): return self.tunnels.get_zrok_status()
    def install_zrok(self, version: str = "latest"): return self.tunnels.install_zrok(version)
    def uninstall_zrok(self): return self.tunnels.uninstall_zrok()
    def enable_zrok(self, token: str): return self.tunnels.enable_zrok(token)
    def disable_zrok(self): return self.tunnels.disable_zrok()
    def start_zrok_share(self, project_id: str): return self.tunnels.start_zrok_share(project_id)
    def stop_zrok_share(self, share_id: str): return self.tunnels.stop_zrok_share(share_id)



    def get_available_cloudflare_versions(self): return self.tunnels.get_available_cloudflare_versions()
    def get_cloudflare_status(self): return self.tunnels.get_cloudflare_status()
    def install_cloudflare(self, version: str = "latest"): return self.tunnels.install_cloudflare(version)
    def uninstall_cloudflare(self): return self.tunnels.uninstall_cloudflare()
    def start_cloudflare_share(self, project_id: str): return self.tunnels.start_cloudflare_share(project_id)
    def stop_cloudflare_share(self, share_id: str): return self.tunnels.stop_cloudflare_share(share_id)
