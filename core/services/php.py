import os
import sys
import re
import shutil
import time
import subprocess
from typing import Optional

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, start_silent_process, run_silent_command
from core.utils.file_utils import read_json, download_advanced, extract_archive
PHP_INI = "php.ini"

class PhpManager:
    """Manager untuk siklus hidup Engine FastCGI PHP"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'bin', 'php')
        os.makedirs(self.base_dir, exist_ok=True)
        self.processes = {}

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg)

    def _parse_php_ini_info(self, php_ini_path: str):
        port, memory_limit = 9000, "Unknown"
        if os.path.exists(php_ini_path):
            with open(php_ini_path, 'r') as f:
                for line in f:
                    if line.startswith('memory_limit'): memory_limit = line.split('=')[1].strip()
                    elif 'vyloserve_port' in line:
                        try: port = int(line.split('=')[1].strip())
                        except Exception: pass
        return port, memory_limit

    def get_installed_instances(self):
        instances = []
        if not os.path.exists(self.base_dir): return instances
            
        folders = sorted([f for f in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, f))], 
                         key=lambda v: [int(x) if x.isdigit() else 0 for x in v.split('.')], reverse=True)
        
        for version in folders:
            target_dir = os.path.join(self.base_dir, version)
            port, memory_limit = self._parse_php_ini_info(os.path.join(target_dir, PHP_INI))
            
            status = "stopped"
            if version in self.processes:
                if self.processes[version].poll() is None: status = "running"
                else: self.processes.pop(version, None)

            instances.append({
                "id": f"php_{version.replace('.', '_')}", "name": f"PHP {version}",
                "version": version, "port": port, "status": status, 
                "dir": target_dir, "memory_limit": memory_limit
            })
        return instances
    
    def toggle_global_path(self, target_path: str, enable: bool):
        """ Mengatur PATH OS dinamis agar command 'php' dan 'composer' terhubung ke versi yang aktif """
        if sys.platform != 'win32': return
        import winreg, ctypes
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_ALL_ACCESS)
            try: path_value, _ = winreg.QueryValueEx(key, 'Path')
            except FileNotFoundError: path_value = ""

            current_paths = [p for p in path_value.split(';') if p]
            normalized_target = os.path.normpath(target_path)
            modified = False

            # Hapus semua path PHP VyloServe lain untuk mencegah konflik versi
            vyloserve_php_base = os.path.normpath(self.base_dir)
            cleaned_paths = [p for p in current_paths if not p.startswith(vyloserve_php_base)]

            if enable:
                cleaned_paths.append(normalized_target)
                modified = True
            elif current_paths != cleaned_paths:
                modified = True

            if modified:
                new_path = ';'.join(cleaned_paths)
                winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, new_path)
                HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG = 0xFFFF, 0x001A, 0x0002
                ctypes.windll.user32.SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0, 'Environment', SMTO_ABORTIFHUNG, 5000, ctypes.byref(ctypes.c_ulong()))
            winreg.CloseKey(key)
        except Exception: pass

    def get_versions(self):
        try:
            import urllib.request

            if sys.platform == 'win32':
                urls = ["https://windows.php.net/downloads/releases/", "https://windows.php.net/downloads/releases/archives/"]
                pattern = r'(php-(\d+\.\d+\.\d+)-Win32-[a-zA-Z0-9]+-x64\.zip)'
            else:
                urls, pattern = ["https://www.php.net/distributions/"], r'(php-(\d+\.\d+\.\d+)\.tar\.gz)'
            
            matches = []
            for url in urls:
                try:
                    html = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10).read().decode('utf-8')
                    matches.extend(re.findall(pattern, html))
                except Exception: pass
            
            version_map = {ver: fname for filename, ver in matches if 'nts' not in filename.lower() and '-pack' not in filename.lower() and 'qa' not in filename.lower() for fname in [filename]}
            if not version_map: return {"status": "error", "message": "backend.php.release_load_failed"}

            latest_minors = {}
            for v in sorted(version_map.keys(), key=lambda v: [int(x) for x in v.split('.')], reverse=True):
                mm = f"{v.split('.')[0]}.{v.split('.')[1]}"
                if mm not in latest_minors: latest_minors[mm] = v

            result = [{"version": v, "filename": version_map[v]} for v in latest_minors.values() if not os.path.exists(os.path.join(self.base_dir, v))]
            if not result: return {"status": "success", "data": [], "message": "backend.php.all_versions_installed"}

            self._log("backend.php.release_load_success", "success")
            return {"status": "success", "data": result}
        except Exception as e: return {"status": "error", "message": str(e)}
    
    def _install_composer(self, target_dir: str):
        self._progress(95, "backend.php.installing_composer")
        import urllib.request
        composer_url = "https://getcomposer.org/composer.phar"
        composer_phar = os.path.join(target_dir, 'composer.phar')
        urllib.request.urlretrieve(composer_url, composer_phar)
        
        composer_bat = os.path.join(target_dir, 'composer.bat')
        with open(composer_bat, 'w') as f:
            f.write('@ECHO OFF\nphp "%~dp0composer.phar" %*\n')

    def _process_ini_line(self, line: str, new_config: dict, ckeys: list, found_keys: set) -> Optional[str]:
        l = line.strip()
        if l.startswith('; vyloserve_port'): return f"; vyloserve_port = {new_config.get('port', 9000)}\n"
        if l.startswith(('extension=', ';extension=')): return None
        
        for key in ckeys:
            if l.startswith(key) and not l.startswith(';'):
                found_keys.add(key)
                return f"{key} = {new_config.get(key, '')}\n"
        return line

    def _update_ini_lines(self, lines: list, new_config: dict, active_extensions: list) -> list:
        new_lines, found_keys, ckeys = [], set(), ['memory_limit', 'max_execution_time', 'upload_max_filesize', 'post_max_size']
        
        for line in lines:
            processed = self._process_ini_line(line, new_config, ckeys, found_keys)
            if processed is not None: new_lines.append(processed)
                
        for key in ckeys:
            if key not in found_keys and key in new_config: new_lines.append(f"{key} = {new_config[key]}\n")
                
        if sys.platform == 'win32' and not any('extension_dir' in l for l in new_lines): new_lines.append('extension_dir = "ext"\n')
        new_lines.append("\n; --- VyloServe Managed Extensions ---\n")
        for ext in active_extensions: new_lines.append(f"extension={ext}\n")
        
        return new_lines

    def _download_php_archive(self, dl_url, filename, file_path, log_cb, prog_cb):
        try:
            download_advanced(dl_url, file_path, log_cb=log_cb, progress_cb=prog_cb)
        except Exception as http_err:
            if sys.platform == 'win32':
                self._log("backend.php.redirect_archives", "warn")
                download_advanced(f"https://windows.php.net/downloads/releases/archives/{filename}", file_path, log_cb=log_cb, progress_cb=prog_cb)
            else: raise http_err

    def install_version(self, version: str, filename: str, port: int):
        target_dir = os.path.join(self.base_dir, version)
        file_path = os.path.join(self.base_dir, filename)

        try:
            if os.path.exists(target_dir): return {"status": "error", "message": "backend.php.already_installed"}
            os.makedirs(target_dir)
            
            dl_url = f"https://windows.php.net/downloads/releases/{filename}" if sys.platform == 'win32' else f"https://www.php.net/distributions/{filename}"
            self._log("backend.php.download_start", "info", {"version": version})

            def log_cb(msg, lvl): 
                self._log(msg, lvl)
            def prog_cb(pct, msg): 
                self._progress(pct, msg)

            self._download_php_archive(dl_url, filename, file_path, log_cb, prog_cb)

            self._log("backend.php.extracting", "info")
            extract_archive(file_path, target_dir, progress_cb=prog_cb)
            if os.path.exists(file_path): os.remove(file_path)
            
            # Bukan 100: progress 100% harus berarti instalasi BENAR-BENAR selesai
            # (lihat _progress(100, "backend.php.installation_complete") di bawah, setelah
            # composer terpasang). Jika di sini dipakai 100, frontend yang mendeteksi
            # "percent >= 100 -> auto-hide widget setelah 3 detik" akan menyembunyikan
            # progress widget padahal instalasi composer di bawah ini masih berjalan.
            # Lihat docs/known_bugs.md.
            self._progress(92, "backend.php.configuring")
            with open(os.path.join(target_dir, PHP_INI), 'w') as f:
                f.write(f"; VyloServe PHP {version} Configuration\n; vyloserve_port = {port}\nmemory_limit = 512M\nfastcgi.logging = 0\ncgi.force_redirect = 0\ncgi.fix_pathinfo = 1\n")
                if sys.platform == 'win32': f.write("extension_dir = \"ext\"\nextension=curl\nextension=mbstring\n")

            self._install_composer(target_dir)
            
            self._log("backend.php.ready", "success", {"version": version, "port": port})
            self._progress(100, "backend.php.installation_complete")
            return {"status": "success", "message": "backend.php.install_success", "args": {"version": version}}
        
        except Exception as e:
            self._log("backend.php.cancelling", "warn")
            if os.path.exists(file_path): os.remove(file_path)
            if os.path.exists(target_dir): shutil.rmtree(target_dir, ignore_errors=True)
            self._progress(0, "backend.php.failed")
            return {"status": "error", "message": str(e)}

    def _parse_config_file(self, php_ini_path: str, config: dict, active_exts: set):
        if not os.path.exists(php_ini_path): return
        with open(php_ini_path, 'r') as f:
            for line in f:
                l = line.strip()
                if l.startswith('; vyloserve_port'): config['port'] = int(l.split('=')[1].strip())
                elif l.startswith('memory_limit'): config['memory_limit'] = l.split('=')[1].strip()
                elif l.startswith('max_execution_time'): config['max_execution_time'] = l.split('=')[1].strip()
                elif l.startswith('upload_max_filesize'): config['upload_max_filesize'] = l.split('=')[1].strip()
                elif l.startswith('post_max_size'): config['post_max_size'] = l.split('=')[1].strip()
                elif l.startswith('extension=') and not l.startswith(';'): active_exts.add(l.split('=')[1].strip().strip('"\''))

    def _get_available_exts(self, ext_dir: str, active_exts: set) -> list:
        if not os.path.exists(ext_dir): available_exts = []
        else: available_exts = [{"name": f[4:-4], "active": f[4:-4] in active_exts} for f in os.listdir(ext_dir) if f.startswith('php_') and f.endswith('.dll')]
        
        for ext in active_exts:
            if not any(e['name'] == ext for e in available_exts): available_exts.append({"name": ext, "active": True})
        return available_exts

    def get_config(self, version: str):
        target_dir = os.path.join(self.base_dir, version)
        config = {"port": 9000, "memory_limit": "512M", "max_execution_time": "120", "upload_max_filesize": "64M", "post_max_size": "64M"}
        active_exts = set()

        self._parse_config_file(os.path.join(target_dir, PHP_INI), config, active_exts)
        available_exts = self._get_available_exts(os.path.join(target_dir, 'ext'), active_exts)
        
        return {"status": "success", "config": config, "extensions": sorted(available_exts, key=lambda x: x['name'])}

    def save_config(self, version: str, new_config: dict, active_extensions: list):
        php_ini_path = os.path.join(self.base_dir, version, PHP_INI)
        if not os.path.exists(php_ini_path): return {"status": "error", "message": "backend.php.ini_not_found"}

        with open(php_ini_path, 'r') as f: lines = f.readlines()
        new_lines = self._update_ini_lines(lines, new_config, active_extensions)

        with open(php_ini_path, 'w') as f: f.writelines(new_lines)
            
        self._log("backend.php.config_updated", "success", {"version": version})
        try:
            if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            if hasattr(self.api, 'apache') and self.api.apache.check_is_running(): self.api.apache.restart_server()
        except Exception: pass
        return {"status": "success", "message": "backend.php.saved"}
    
    def open_path(self, version: str, is_file: bool = False):
        target = os.path.join(self.base_dir, version, PHP_INI) if is_file else os.path.join(self.base_dir, version)
        if not os.path.exists(target): return {"status": "error", "message": "backend.php.not_found"}
        try:
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success", "message": "backend.php.opened"}
        except Exception as e:
            self._log("backend.php.fatal_error", "error", {"e": str(e)})
            return {"status": "error", "message": str(e)}

    # ---> FIX: Tambahkan Log Sukses <---
    def uninstall_version(self, version: str):
        target = os.path.join(self.base_dir, version)
        if os.path.exists(target):
            shutil.rmtree(target, ignore_errors=True)
            try:
                if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
                if hasattr(self.api, 'apache') and self.api.apache.check_is_running(): self.api.apache.restart_server()
            except Exception: pass
            
            if hasattr(self.api, 'emit_log'):
                self._log("backend.php.uninstalled", "success", {"version": version})
            return {"status": "success", "message": "backend.php.uninstall_success"}
        return {"status": "error", "message": "backend.php.not_found"}

    # ==========================================
    # FASTCGI SUBPROCESS & MASTER CONTROLS
    # ==========================================
    def _verify_and_patch_ini(self, php_ini_path: str):
        if not os.path.exists(php_ini_path): return
        with open(php_ini_path, 'r') as f: lines = f.readlines()
        has_fr = any(l.strip().lower().startswith('cgi.force_redirect') and not l.strip().startswith(';') for l in lines)
        has_fp = any(l.strip().lower().startswith('cgi.fix_pathinfo') and not l.strip().startswith(';') for l in lines)

        mod, new_lines = False, []
        for l in lines:
            if l.strip().lower().startswith('cgi.force_redirect') and not l.strip().startswith(';'):
                new_lines.append("cgi.force_redirect = 0\n"); mod = True; continue
            new_lines.append(l)

        if not has_fr: new_lines.append("cgi.force_redirect = 0\n"); mod = True
        if not has_fp: new_lines.append("cgi.fix_pathinfo = 1\n"); mod = True
        if mod:
            with open(php_ini_path, 'w') as f: f.writelines(new_lines)

    def _get_port_from_ini(self, php_ini_path: str, default_port: int = 9000) -> int:
        if not os.path.exists(php_ini_path): return default_port
        with open(php_ini_path, 'r') as f:
            for line in f:
                if 'vyloserve_port' in line:
                    try: return int(line.split('=')[1].strip())
                    except Exception: pass
        return default_port

    def _update_apache_proxy_silent(self, port: int):
        try:
            if hasattr(self, 'api') and hasattr(self.api, 'apache'):
                self.api.apache.update_global_php_proxy(port)
        except Exception: pass

    def start_php(self, version: str):
        if version in self.processes and self.processes[version].poll() is None:
            return {"status": "error", "message": "backend.php.already_running", "args": {"version": version}}
        
            
        target_dir = os.path.join(self.base_dir, version)
        exe_path = os.path.join(target_dir, "php-cgi.exe" if sys.platform == 'win32' else "php-cgi")
        if not os.path.exists(exe_path): return {"status": "error", "message": "backend.php.binary_not_found"}
        
        self.toggle_global_path(target_dir, enable=True)
        
        php_ini_path = os.path.join(target_dir, PHP_INI)
        port = self._get_port_from_ini(php_ini_path)

        self._verify_and_patch_ini(php_ini_path)
        php_env = os.environ.copy()
        php_env['PHP_FCGI_MAX_REQUESTS'] = '0'     

        try:
            self.processes[version] = start_silent_process([exe_path, "-b", f"127.0.0.1:{port}", "-c", php_ini_path], cwd=target_dir, env=php_env)
            time.sleep(0.5)
            
            if self.processes[version].poll() is not None:
                 return {"status": "error", "message": "backend.php.cgi_failed", "args": {"port": port}}
            
            self._update_apache_proxy_silent(port)
            
            self._log("backend.php.fastcgi_started", "success", {"version": version, "port": port})
            return {"status": "success", "message": "backend.php.fastcgi_success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_php(self, version: str):
        if version in self.processes:
            proc = self.processes[version]
            if proc.poll() is None:
                run_silent_command(['taskkill', '/F', '/T', '/PID', str(proc.pid)]) if sys.platform == 'win32' else run_silent_command(['kill', '-9', str(proc.pid)])
            self.processes.pop(version, None)

            target_dir = os.path.join(self.base_dir, version)
            self.toggle_global_path(target_dir, enable=False)

        return {"status": "success", "message": "backend.php.stopped", "args": {"version": version}}

    def get_installed_versions(self):
        return [d for d in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, d))] if os.path.exists(self.base_dir) else []

    def check_is_running(self):
        for v in tuple(self.processes):
            if self.processes[v].poll() is not None: self.processes.pop(v, None)
        return len(self.processes) > 0

    def _get_preferred_versions(self):
        dashboard_json = os.path.join(get_project_root(), 'data', 'dashboard.json')
        installed = self.get_installed_versions()
        if not installed: return []

        dashboard_data = read_json(dashboard_json, dict)
        # read_json() TIDAK menjamin dict hanya karena default_type=dict -- parameter itu
        # cuma dipakai saat file kosong/tidak ada. Jika isi file valid JSON tapi bukan objek
        # (mis. string sisa dari file lama/rusak), .get() langsung akan melempar
        # AttributeError "'str' object has no attribute 'get'". Lihat docs/known_bugs.md.
        selected = dashboard_data.get('selected_php', []) if isinstance(dashboard_data, dict) else []
        valid = [v for v in selected if v in installed]
        if valid: return valid
            
        return [max(installed, key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0])]

    def start_all(self):
        targets = self._get_preferred_versions()
        if not targets: return {"status": "error", "message": "backend.php.none_installed"}
        success = sum(1 for v in targets if (v not in self.processes or self.processes[v].poll() is not None) and self.start_php(v).get('status') == 'success')
        if success > 0: return {"status": "success", "message": "backend.php.multi_started", "args": {"count": success}}
        return {"status": "success", "message": "backend.php.already_running"} if self.check_is_running() else {"status": "error", "message": "backend.php.failed"}

    def stop_all(self):
        stopped = sum(1 for v in tuple(self.processes) if self.stop_php(v).get('status') == 'success')
        return {"status": "success", "message": "backend.php.multi_stopped", "args": {"count": stopped}}
