import os
import sys
import re
import shutil
import time

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, start_silent_process, run_silent_command
from core.utils.file_utils import read_json, download_advanced, extract_archive

class PhpManager:
    """Manager untuk siklus hidup Engine FastCGI PHP"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'bin', 'php')
        os.makedirs(self.base_dir, exist_ok=True)
        self.processes = {}

    def get_installed_instances(self):
        instances = []
        if not os.path.exists(self.base_dir): return instances
            
        folders = sorted([f for f in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, f))], 
                         key=lambda v: [int(x) if x.isdigit() else 0 for x in v.split('.')], reverse=True)
        
        for version in folders:
            target_dir = os.path.join(self.base_dir, version)
            php_ini_path = os.path.join(target_dir, 'php.ini')
            port, memory_limit = 9000, "Unknown"
            
            if os.path.exists(php_ini_path):
                with open(php_ini_path, 'r') as f:
                    for line in f:
                        if line.startswith('memory_limit'): memory_limit = line.split('=')[1].strip()
                        elif 'vyloserve_port' in line:
                            try: port = int(line.split('=')[1].strip())
                            except: pass
            
            # Dinamis Tracker Status
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

    def get_versions(self):
        try:
            import urllib.request, ssl
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            if sys.platform == 'win32':
                urls = ["https://windows.php.net/downloads/releases/", "https://windows.php.net/downloads/releases/archives/"]
                pattern = r'(php-(\d+\.\d+\.\d+)-Win32-[a-zA-Z0-9]+-x64\.zip)'
            else:
                urls, pattern = ["https://www.php.net/distributions/"], r'(php-(\d+\.\d+\.\d+)\.tar\.gz)'
            
            matches = []
            for url in urls:
                try:
                    html = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), context=ctx, timeout=10).read().decode('utf-8')
                    matches.extend(re.findall(pattern, html))
                except: pass
            
            version_map = {ver: fname for filename, ver in matches if 'nts' not in filename.lower() and '-pack' not in filename.lower() and 'qa' not in filename.lower() for fname in [filename]}
            if not version_map: return {"status": "error", "message": "Gagal memuat rilis PHP."}

            latest_minors = {}
            for v in sorted(version_map.keys(), key=lambda v: [int(x) for x in v.split('.')], reverse=True):
                mm = f"{v.split('.')[0]}.{v.split('.')[1]}"
                if mm not in latest_minors: latest_minors[mm] = v

            result = [{"version": v, "filename": version_map[v]} for v in latest_minors.values() if not os.path.exists(os.path.join(self.base_dir, v))]
            if not result: return {"status": "success", "data": [], "message": "Semua versi terbaru terinstal."}

            if hasattr(self, 'api'): self.api.emit_log(f"Berhasil memuat rilis stabil PHP.", "success")
            return {"status": "success", "data": result}
        except Exception as e: return {"status": "error", "message": str(e)}
    
    def install_version(self, version: str, filename: str, port: int):
        target_dir = os.path.join(self.base_dir, version)
        file_path = os.path.join(self.base_dir, filename)

        try:
            if os.path.exists(target_dir): return {"status": "error", "message": "PHP sudah terinstal."}
            os.makedirs(target_dir)
            
            dl_url = f"https://windows.php.net/downloads/releases/{filename}" if sys.platform == 'win32' else f"https://www.php.net/distributions/{filename}"
            if hasattr(self, 'api'): self.api.emit_log(f"Memulai unduhan PHP {version}...", "info")

            def log_cb(msg, lvl): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def prog_cb(pct, msg): 
                if hasattr(self, 'api'): self.api.emit_progress(pct, msg)

            try:
                download_advanced(dl_url, file_path, log_cb=log_cb, progress_cb=prog_cb)
            except Exception as http_err:
                if sys.platform == 'win32':
                    if hasattr(self, 'api'): self.api.emit_log("Mengalihkan pencarian ke folder archives...", "warn")
                    download_advanced(f"https://windows.php.net/downloads/releases/archives/{filename}", file_path, log_cb=log_cb, progress_cb=prog_cb)
                else: raise http_err

            if hasattr(self, 'api'): self.api.emit_log("Mengekstrak berkas...", "info")
            extract_archive(file_path, target_dir, progress_cb=prog_cb)
            if os.path.exists(file_path): os.remove(file_path)
            
            # --- KONFIGURASI INI ---
            if hasattr(self, 'api'): self.api.emit_progress(100, "Configuring...")
            with open(os.path.join(target_dir, 'php.ini'), 'w') as f:
                f.write(f"; VyloServe PHP {version} Configuration\n; vyloserve_port = {port}\nmemory_limit = 512M\nfastcgi.logging = 0\ncgi.force_redirect = 0\ncgi.fix_pathinfo = 1\n")
                if sys.platform == 'win32': f.write("extension_dir = \"ext\"\nextension=curl\nextension=mbstring\n")
            
            if hasattr(self, 'api'):
                self.api.emit_log(f"Selesai! PHP {version} siap digunakan pada port {port}.", "success")
                self.api.emit_progress(100, "Installation Complete!")
            return {"status": "success", "message": f"PHP {version} berhasil diinstal."}
        
        except Exception as e:
            if hasattr(self, 'api'): self.api.emit_log("Membatalkan instalasi...", "warn")
            if os.path.exists(file_path): os.remove(file_path)
            if os.path.exists(target_dir): shutil.rmtree(target_dir, ignore_errors=True)
            if hasattr(self, 'api'): self.api.emit_progress(0, "Failed")
            return {"status": "error", "message": str(e)}

    def get_config(self, version: str):
        target_dir = os.path.join(self.base_dir, version)
        php_ini_path, ext_dir = os.path.join(target_dir, 'php.ini'), os.path.join(target_dir, 'ext')
        config = {"port": 9000, "memory_limit": "512M", "max_execution_time": "120", "upload_max_filesize": "64M", "post_max_size": "64M"}
        active_exts = set()

        if os.path.exists(php_ini_path):
            with open(php_ini_path, 'r') as f:
                for line in f:
                    l = line.strip()
                    if l.startswith('; vyloserve_port'): config['port'] = int(l.split('=')[1].strip())
                    elif l.startswith('memory_limit'): config['memory_limit'] = l.split('=')[1].strip()
                    elif l.startswith('max_execution_time'): config['max_execution_time'] = l.split('=')[1].strip()
                    elif l.startswith('upload_max_filesize'): config['upload_max_filesize'] = l.split('=')[1].strip()
                    elif l.startswith('post_max_size'): config['post_max_size'] = l.split('=')[1].strip()
                    elif l.startswith('extension=') and not l.startswith(';'): active_exts.add(l.split('=')[1].strip().strip('"\''))

        available_exts = [{"name": f[4:-4], "active": f[4:-4] in active_exts} for f in os.listdir(ext_dir) if f.startswith('php_') and f.endswith('.dll')] if os.path.exists(ext_dir) else []
        for ext in active_exts:
            if not any(e['name'] == ext for e in available_exts): available_exts.append({"name": ext, "active": True})
        
        return {"status": "success", "config": config, "extensions": sorted(available_exts, key=lambda x: x['name'])}

    def save_config(self, version: str, new_config: dict, active_extensions: list):
        php_ini_path = os.path.join(self.base_dir, version, 'php.ini')
        if not os.path.exists(php_ini_path): return {"status": "error", "message": "php.ini tidak ditemukan!"}

        with open(php_ini_path, 'r') as f: lines = f.readlines()
        new_lines, found_keys, ckeys = [], set(), ['memory_limit', 'max_execution_time', 'upload_max_filesize', 'post_max_size']
        
        for line in lines:
            l = line.strip()
            if l.startswith('; vyloserve_port'): new_lines.append(f"; vyloserve_port = {new_config.get('port', 9000)}\n"); continue
            if l.startswith('extension=') or l.startswith(';extension='): continue
            
            upd = False
            for key in ckeys:
                if l.startswith(key) and not l.startswith(';'):
                    new_lines.append(f"{key} = {new_config.get(key, '')}\n")
                    found_keys.add(key); upd = True; break
            if not upd: new_lines.append(line)
                
        for key in ckeys:
            if key not in found_keys and key in new_config: new_lines.append(f"{key} = {new_config[key]}\n")
                
        if not any('extension_dir' in l for l in new_lines) and sys.platform == 'win32': new_lines.append('extension_dir = "ext"\n')
        new_lines.append("\n; --- VyloServe Managed Extensions ---\n")
        for ext in active_extensions: new_lines.append(f"extension={ext}\n")

        with open(php_ini_path, 'w') as f: f.writelines(new_lines)
            
        if hasattr(self, 'api'): self.api.emit_log(f"Konfigurasi PHP {version} diperbarui.", "success")
        try:
            if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            if hasattr(self.api, 'apache') and self.api.apache.check_is_running(): self.api.apache.restart_server()
        except: pass
        return {"status": "success", "message": "Disimpan!"}
    
    def open_path(self, version: str, is_file: bool = False):
        target = os.path.join(self.base_dir, version, 'php.ini') if is_file else os.path.join(self.base_dir, version)
        if not os.path.exists(target): return {"status": "error", "message": "Tidak ditemukan!"}
        try:
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success", "message": "Dibuka."}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    # ---> FIX: Tambahkan Log Sukses <---
    def uninstall_version(self, version: str):
        target = os.path.join(self.base_dir, version)
        if os.path.exists(target):
            shutil.rmtree(target, ignore_errors=True)
            try:
                if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
                if hasattr(self.api, 'apache') and self.api.apache.check_is_running(): self.api.apache.restart_server()
            except: pass
            
            if hasattr(self.api, 'emit_log'):
                self.api.emit_log(f"PHP {version} beserta konfigurasinya berhasil dihapus dari sistem.", "success")
            return {"status": "success", "message": "Uninstall sukses."}
        return {"status": "error", "message": "Tidak ditemukan."}

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

    def start_php(self, version: str):
        if version in self.processes and self.processes[version].poll() is None:
            return {"status": "error", "message": f"PHP {version} sudah berjalan!"}
            
        target_dir = os.path.join(self.base_dir, version)
        exe_path = os.path.join(target_dir, "php-cgi.exe" if sys.platform == 'win32' else "php-cgi")
        if not os.path.exists(exe_path): return {"status": "error", "message": "Binary tidak ditemukan."}

        port = 9000
        php_ini_path = os.path.join(target_dir, 'php.ini')
        if os.path.exists(php_ini_path):
            with open(php_ini_path, 'r') as f:
                for line in f:
                    if 'vyloserve_port' in line:
                        try: port = int(line.split('=')[1].strip())
                        except: pass

        self._verify_and_patch_ini(php_ini_path)
        php_env = os.environ.copy()
        php_env['PHP_FCGI_MAX_REQUESTS'] = '0'     

        try:
            self.processes[version] = start_silent_process([exe_path, "-b", f"127.0.0.1:{port}", "-c", php_ini_path], cwd=target_dir, env=php_env)
            time.sleep(0.5)
            
            if self.processes[version].poll() is not None:
                 return {"status": "error", "message": f"Gagal menjalankan CGI. Port {port} mungkin digunakan."}
            
            try:
                if hasattr(self, 'api') and hasattr(self.api, 'apache'): self.api.apache.update_global_php_proxy(port)
            except: pass
            
            if hasattr(self, 'api'): self.api.emit_log(f"FastCGI PHP {version} menyala pada Port {port}.", "success")
            return {"status": "success", "message": "FastCGI menyala."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_php(self, version: str):
        if version in self.processes:
            proc = self.processes[version]
            if proc.poll() is None:
                run_silent_command(['taskkill', '/F', '/T', '/PID', str(proc.pid)]) if sys.platform == 'win32' else run_silent_command(['kill', '-9', str(proc.pid)])
            self.processes.pop(version, None)
        return {"status": "success", "message": f"PHP {version} dihentikan."}

    def get_installed_versions(self):
        return [d for d in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, d))] if os.path.exists(self.base_dir) else []

    def check_is_running(self):
        for v in list(self.processes.keys()):
            if self.processes[v].poll() is not None: self.processes.pop(v, None)
        return len(self.processes) > 0

    def _get_preferred_versions(self):
        dashboard_json = os.path.join(get_project_root(), 'data', 'dashboard.json')
        installed = self.get_installed_versions()
        if not installed: return []
            
        selected = read_json(dashboard_json, dict).get('selected_php', [])
        valid = [v for v in selected if v in installed]
        if valid: return valid
            
        return [sorted(installed, key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)[0]]

    def start_all(self):
        targets = self._get_preferred_versions()
        if not targets: return {"status": "error", "message": "Tidak ada PHP terinstal."}
        success = sum(1 for v in targets if (v not in self.processes or self.processes[v].poll() is not None) and self.start_php(v).get('status') == 'success')
        if success > 0: return {"status": "success", "message": f"{success} PHP berjalan."}
        return {"status": "success", "message": "Sudah berjalan."} if self.check_is_running() else {"status": "error", "message": "Gagal."}

    def stop_all(self):
        stopped = sum(1 for v in list(self.processes.keys()) if self.stop_php(v).get('status') == 'success')
        return {"status": "success", "message": f"{stopped} PHP dihentikan."}