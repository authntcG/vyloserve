import os
from typing import Optional
import sys
import urllib.request
import re
import shutil
import time
import subprocess

HTTPD_CONF_NAME = "httpd.conf"

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, run_silent_command, start_silent_process
from core.utils.file_utils import read_json, write_json, download_advanced, extract_archive
INC_VHOSTS = "Include conf/extra/vyloserve-vhosts.conf"
INC_PHP = "Include conf/extra/vyloserve-php.conf"
ERR_NOT_INSTALLED = "backend.apache.not_installed"
APACHE_JSON = "apache.json"

class ApacheManager:
    """Manager untuk siklus hidup Engine Web Server Apache"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'bin', 'apache')
        os.makedirs(self.base_dir, exist_ok=True)
            
    def _get_active_version(self) -> Optional[str]:
        """Membaca versi Apache aktif dari penyimpanan lokal"""
        json_file = os.path.join(get_project_root(), 'data', APACHE_JSON)
        data = read_json(json_file, dict)
        
        if 'active_version' in data and data['active_version']:
            return str(data['active_version']).strip()
            
        txt_file = os.path.join(get_project_root(), 'data', 'apache_active_version.txt')
        if os.path.exists(txt_file):
            try:
                with open(txt_file, 'rb') as f:
                    ver = f.read().decode('utf-8', errors='ignore').replace('\x00', '').strip(' \t\n\r\x0b\x0c\ufeff"\'')
                # os.remove() dipanggil SETELAH file ditutup (di luar 'with') -- di Windows,
                # menghapus file yang masih terbuka melempar PermissionError sehingga migrasi
                # legacy ini sebelumnya selalu gagal diam-diam (tertelan except di bawah).
                if ver:
                    self._set_active_version_silent(ver)
                    os.remove(txt_file)
                    return ver
            except Exception: pass
        return None

    def _set_active_version_silent(self, version: str):
        json_file = os.path.join(get_project_root(), 'data', APACHE_JSON)
        data = read_json(json_file, dict)
        data['active_version'] = str(version).strip()
        write_json(json_file, data)

    def check_is_running(self) -> bool:
        """Mengecek apakah proses httpd (Apache) sedang berjalan di OS"""
        try:
            if sys.platform == 'win32':
                res = run_silent_command(['tasklist', '/FI', 'IMAGENAME eq httpd.exe'])
                return 'httpd.exe' in res.stdout
            else:
                res = run_silent_command(['pgrep', 'httpd'])
                return len(res.stdout.strip()) > 0
        except Exception:
            return False

    def _get_installed_folders(self) -> dict:
        if not os.path.exists(self.base_dir):
            return {}
        return {str(item).strip(): item for item in os.listdir(self.base_dir) 
                if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")}

    def get_status(self):
        try:
            is_running = self.check_is_running()
            folder_map = self._get_installed_folders()
            
            if not folder_map:
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
                
            clean_folders = sorted(folder_map.keys(), key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            active_version = self._get_active_version()
            
            installed_version = active_version if (active_version and active_version in folder_map) else clean_folders[0]
            if installed_version != active_version:
                self._set_active_version_silent(installed_version)

            installed_path = os.path.join(self.base_dir, folder_map[installed_version])
            return {"status": "success", "installed": True, "version": installed_version, "path": installed_path, "running": is_running}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.status_check_failed", "args": {"e": str(e)}}

    def get_installed_versions(self):
        try:
            if not os.path.exists(self.base_dir):
                return {"status": "success", "data": [], "active": None}
                
            versions = sorted([str(item).strip() for item in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")],
                              key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            
            return {"status": "success", "data": versions, "active": self.get_status().get("version")}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.dir_read_failed", "args": {"e": str(e)}}

    def set_active_version(self, version: str):
        try:
            self._set_active_version_silent(version)
            if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            if self.check_is_running(): self.restart_server()
            return {"status": "success", "message": "backend.apache.version_changed"}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.save_settings_failed", "args": {"e": str(e)}}

    def _patch_httpd_content(self, content: str) -> tuple[str, bool]:
        modified = False
        for mod in ["proxy_module", "proxy_fcgi_module", "rewrite_module", "vhost_alias_module", "dir_module", "setenvif_module", "ssl_module", "socache_shmcb_module"]:
            pattern = re.compile(r"^[ \t]*#[ \t]*(LoadModule\s+" + mod + r"\b[^\r\n]*)$", re.MULTILINE)
            if pattern.search(content):
                content = pattern.sub(r"\1", content); modified = True

        if "\nListen 443" not in content:
            content = re.sub(r"^([ \t]*Listen[ \t]+\d+)$", r"\1\nListen 443", content, count=1, flags=re.MULTILINE) if re.search(r"^([ \t]*Listen[ \t]+\d+)$", content, re.MULTILINE) else content + "\nListen 443\n"
            modified = True
                
        content = content.replace("Include conf/extra/httpd-vyloserve-php.conf", INC_PHP).replace("Include conf/extra/vyloserve-vhosts.conf", INC_VHOSTS)
        
        if INC_PHP not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"; modified = True
        if INC_VHOSTS not in content:
            content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"; modified = True

        if "DirectoryIndex index.php" not in content:
            content = re.sub(r'DirectoryIndex\s+index\.html', 'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE); modified = True
            
        if "\nServerName localhost" not in content and "\nServerName 127.0.0.1" not in content:
            content += "\n\n# VyloServe: Suppress AH00558 Warning\nServerName localhost\n"; modified = True
            
        content = re.sub(r'# VyloServe: Relax permissions.*?</Directory>', '', content, flags=re.DOTALL)
        relax_sec = "\n# VyloServe: Relax permissions for local dev\n<Directory />\n    AllowOverride All\n    Require all granted\n</Directory>\n"
        if relax_sec not in content:
            content += relax_sec; modified = True
            
        return content, modified

    def _verify_and_patch_httpd(self):
        try:
            status = self.get_status()
            if not status.get("installed"): return
            
            apache_dir = status["path"]
            conf_path = os.path.join(apache_dir, "conf", HTTPD_CONF_NAME)
            if not os.path.exists(conf_path): return
            
            with open(conf_path, 'r', encoding='utf-8') as f: content = f.read()
            
            content, modified = self._patch_httpd_content(content)
            
            if modified:
                with open(conf_path, 'w', encoding='utf-8') as f: f.write(content)

            extra_dir = os.path.join(apache_dir, "conf", "extra")
            os.makedirs(extra_dir, exist_ok=True)
            
            if not os.path.exists(os.path.join(extra_dir, "httpd-vyloserve-php.conf")):
                self.update_global_php_proxy(9000, restart=False) 
            if not os.path.exists(os.path.join(extra_dir, "vyloserve-vhosts.conf")):
                with open(os.path.join(extra_dir, "vyloserve-vhosts.conf"), 'w', encoding='utf-8') as f: f.write("# VyloServe Virtual Hosts Fallback\n")

            if hasattr(self, 'api'): self.api.emit_log("backend.apache.preflight_success", "success")
        except Exception as e:
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.preflight_failed", "error", {"e": str(e)})
            
    def _configure_httpd(self, target_dir, port):
        conf_path = os.path.join(target_dir, "conf", HTTPD_CONF_NAME)
        with open(conf_path, 'r', encoding='utf-8') as f: content = f.read()

        content = re.sub(r'Define\s+SRVROOT\s+"[^"]+"', f'Define SRVROOT "{target_dir.replace(chr(92), "/")}"', content, flags=re.IGNORECASE)
        content = re.sub(r'Listen\s+80', f'Listen {port}', content, flags=re.IGNORECASE)
        
        if "ServerName localhost" not in content:
            content = re.sub(r'#\s*ServerName\s+www\.example\.com:\d+', f'ServerName localhost:{port}', content, flags=re.IGNORECASE)
            if "ServerName localhost" not in content:
                content = re.sub(r'(Listen\s+\d+)', f'\\1\nServerName localhost:{port}', content, flags=re.IGNORECASE)
        
        www_dir = self._ensure_default_htdocs()
        content = re.sub(r'DocumentRoot\s+"[^"]+htdocs"', f'DocumentRoot "{www_dir}"', content, flags=re.IGNORECASE)
        content = re.sub(r'<Directory\s+"[^"]+htdocs">', f'<Directory "{www_dir}">', content, flags=re.IGNORECASE)
        content = re.sub(r'DirectoryIndex\s+index\.html', r'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE)
        content = re.sub(r'Options\s+Indexes\s+FollowSymLinks', r'Options Indexes FollowSymLinks ExecCGI', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_module\s+modules/mod_proxy\.so', r'LoadModule proxy_module modules/mod_proxy.so', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_fcgi_module\s+modules/mod_proxy_fcgi\.so', r'LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so', content, flags=re.IGNORECASE)

        if INC_PHP not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
        if INC_VHOSTS not in content:
            content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"

        with open(conf_path, 'w', encoding='utf-8') as f: f.write(content)
        self.update_global_php_proxy(9000, restart=False)
            
    def _ensure_default_htdocs(self):
        root_dir = os.path.dirname(os.path.dirname(self.base_dir))
        www_dir = os.path.join(root_dir, 'www')
        os.makedirs(www_dir, exist_ok=True)
        
        index_path = os.path.join(www_dir, 'index.php')
        if not os.path.exists(index_path):
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write("<?php echo '<h1>VyloServe is Running!</h1>'; ?>")
        
        phpinfo_path = os.path.join(www_dir, 'phpinfo.php')
        if not os.path.exists(phpinfo_path):
            with open(phpinfo_path, 'w', encoding='utf-8') as f:
                f.write("<?php\nphpinfo();\n?>")
                
        return www_dir.replace('\\', '/')
    
    def update_global_php_proxy(self, port, restart=True):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
                
            php_conf_path = os.path.join(status["path"], "conf", "extra", "httpd-vyloserve-php.conf")
            os.makedirs(os.path.dirname(php_conf_path), exist_ok=True)
            
            # Direktori fisik asli (folder 'www')
            www_dir = self._ensure_default_htdocs()
            
            # ==========================================
            # SMART ROUTING: Deteksi Folder Public
            # ==========================================
            document_root = www_dir
            public_dir = os.path.join(www_dir, "public")
            
            # Jika ada folder 'public', paksa DocumentRoot ke sana
            if os.path.exists(public_dir) and os.path.isdir(public_dir):
                document_root = public_dir
                if hasattr(self, 'api'):
                    self.api.emit_log("backend.apache.smart_routing_active", "info")
            # ==========================================
            
            # Sesuaikan string replace Windows agar aman untuk file config Apache
            safe_doc_root = document_root.replace(chr(92), '/')
            
            fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:{port}/"
    </FilesMatch>"""

            with open(php_conf_path, 'w', encoding='utf-8') as f:
                # Gunakan safe_doc_root, bukan www_dir lagi
                f.write(f"# Auto-Generated: Mengarahkan localhost ke PHP Port {port}\n\n<VirtualHost *:80>\n    ServerName localhost\n    DocumentRoot \"{safe_doc_root}\"\n    <Directory \"{safe_doc_root}\">\n        DirectoryIndex index.php index.html\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n")

                if hasattr(self.api, 'ssl'):
                    try:
                        local_crt, local_key = self.api.ssl.generate_domain_cert("localhost")
                        f.write(f"<VirtualHost *:443>\n    ServerName localhost\n    DocumentRoot \"{safe_doc_root}\"\n    SSLEngine on\n    SSLCertificateFile \"{local_crt.replace(chr(92), '/')}\"\n    SSLCertificateKeyFile \"{local_key.replace(chr(92), '/')}\"\n    <Directory \"{safe_doc_root}\">\n        DirectoryIndex index.php index.html\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n")
                    except Exception:
                        if hasattr(self, 'api'): self.api.emit_log("backend.apache.skip_ssl_localhost", "warn")
                
            if restart and self.check_is_running(): self.restart_server()
            return {"status": "success", "message": "backend.apache.proxy_updated"}
        except Exception as e:
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def _parse_apache_versions_html(self, html: str) -> list:
        versions = []
        for match in re.findall(r'href="([^"]+\.zip)"', html, re.IGNORECASE):
            raw_url = match
            version_match = re.search(r'httpd-2\.4\.(\d+)', raw_url, re.IGNORECASE)
            if version_match and 'win64' in raw_url.lower():
                if raw_url.startswith("http"):
                    dl_url = raw_url
                elif raw_url.startswith("/"):
                    dl_url = f"https://www.apachelounge.com{raw_url}"
                else:
                    dl_url = f"https://www.apachelounge.com/download/{raw_url}"
                    
                if not any(v['version'] == f"2.4.{version_match.group(1)}" for v in versions):
                    versions.append({"version": f"2.4.{version_match.group(1)}", "filename": dl_url.split('/')[-1], "url": dl_url})
        versions.sort(key=lambda x: int(x['version'].split('.')[2]), reverse=True)
        return versions

    def get_available_versions(self):
        versions = []
        try:
            if sys.platform == 'win32':
                req = urllib.request.Request("https://www.apachelounge.com/download/", headers={'User-Agent': 'Mozilla/5.0'})
                try:
                    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                    versions = self._parse_apache_versions_html(html)
                except Exception: pass
                
                if not versions:
                    versions = [{"version": "2.4.68", "filename": "httpd-2.4.68.zip", "url": "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip"}]
            return {"status": "success", "data": versions}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.unknown_error", "args": {"e": str(e)}}

    def _move_apache_extract(self, temp_extract_dir: str, target_dir: str):
        extracted_apache24 = os.path.join(temp_extract_dir, 'Apache24')
        move_success = False
        for _ in range(5):
            try:
                shutil.move(extracted_apache24 if os.path.exists(extracted_apache24) else temp_extract_dir, target_dir)
                move_success = True; break
            except Exception: time.sleep(2)
        
        if not move_success: raise RuntimeError("Folder dikunci oleh OS/Antivirus.")
        if os.path.exists(temp_extract_dir): shutil.rmtree(temp_extract_dir, ignore_errors=True)

    def install_version(self, version: str, download_url: str, http_port: int):
        if hasattr(self, 'api'): self.api.emit_log("backend.apache.download_start", "info", {"version": version})
        target_dir = os.path.join(self.base_dir, version)
        zip_path = os.path.join(self.base_dir, f"apache-{version}.zip")
        temp_extract_dir = os.path.join(self.base_dir, f"temp_{version}")
        
        if os.path.exists(target_dir): return {"status": "error", "message": "backend.apache.already_installed"}

        try:
            def log_cb(msg, lvl): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def prog_cb(pct, msg): 
                if hasattr(self, 'api'): self.api.emit_progress(pct, msg)

            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=prog_cb)

            if hasattr(self, 'api'): self.api.emit_log("backend.apache.extracting", "info")
            extract_archive(zip_path, temp_extract_dir, progress_cb=prog_cb)
            if os.path.exists(zip_path): os.remove(zip_path)
                
            self._move_apache_extract(temp_extract_dir, target_dir)

            if hasattr(self, 'api'): self.api.emit_progress(80, "backend.apache.configuring")
            self._configure_httpd(target_dir, http_port)

            if hasattr(self, 'api'):
                self.api.emit_progress(100, "backend.apache.done")
                self.api.emit_log("backend.apache.install_success", "success", {"version": version})
            return {"status": "success", "message": "backend.apache.install_success", "args": {"version": version}}

        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log("backend.apache.install_error", "error", {"e": str(e)})
                self.api.emit_progress(0, "backend.apache.install_cancelled")
            if os.path.exists(zip_path): os.remove(zip_path)
            shutil.rmtree(target_dir, ignore_errors=True)
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            return {"status": "error", "message": "backend.apache.install_failed", "args": {"e": str(e)}}
        
    # ---> FIX: Hapus file JSON konfigurasi agar active_version tidak tertinggal <---
    def uninstall(self):
        try:
            if os.path.exists(self.base_dir):
                for item in os.listdir(self.base_dir):
                    item_path = os.path.join(self.base_dir, item)
                    shutil.rmtree(item_path, ignore_errors=True) if os.path.isdir(item_path) else os.remove(item_path)
            
            json_file = os.path.join(get_project_root(), 'data', APACHE_JSON)
            if os.path.exists(json_file):
                os.remove(json_file)
                
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.uninstall_success", "success")
            return {"status": "success", "message": "backend.apache.uninstalled"}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.uninstall_failed", "args": {"e": str(e)}}

    def open_directory(self):
        try:
            target = self.get_status().get("path") if self.get_status().get("installed") else self.base_dir
            os.makedirs(target, exist_ok=True)
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def open_config(self):
        try:
            status = self.get_status()
            if status.get("installed"):
                conf_path = os.path.join(status["path"], "conf", HTTPD_CONF_NAME)
                if os.path.exists(conf_path):
                    if sys.platform == 'win32': os.startfile(conf_path)
                    elif sys.platform == 'darwin': subprocess.Popen(['open', conf_path])
                    else: subprocess.Popen(['xdg-open', conf_path])
                    return {"status": "success"}
            return {"status": "error", "message": "backend.apache.httpd_not_found"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def open_apache_file(self, file_type):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            paths = {'httpd': os.path.join(status["path"], 'conf', HTTPD_CONF_NAME), 'vhosts': os.path.join(status["path"], 'conf', 'extra', 'vyloserve-vhosts.conf'), 'error': os.path.join(status["path"], 'logs', 'error.log')}
            
            target = paths.get(file_type)
            if not target: return {"status": "error", "message": "backend.apache.invalid_type"}
            
            if file_type == 'error' and not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True); open(target, 'w').close()
                
            if not os.path.exists(target): return {"status": "error", "message": "backend.apache.file_not_found"}

            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def start_server(self):
        if hasattr(self, 'api'): self.api.emit_log("backend.apache.starting", "info")
        if self.check_is_running(): return {"status": "error", "message": "backend.apache.already_running"}
            
        status = self.get_status()
        if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            
        self._verify_and_patch_httpd()
        if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            
        try:
            proc = start_silent_process([os.path.join(status["path"], "bin", "httpd.exe")])
            time.sleep(1)
            
            if proc.poll() is not None:
                return {"status": "error", "message": "backend.apache.port_in_use"}
                
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.started_with_pid", "success", {"pid": proc.pid})
            return {"status": "success", "message": "backend.apache.start_success"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
            
    def stop_server(self):
        try:
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.terminating", "warn")
            if sys.platform == 'win32': run_silent_command(['taskkill', '/F', '/T', '/IM', 'httpd.exe'])
            else: run_silent_command(['pkill', '-', 'httpd'])
                
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.stopped", "success")
            return {"status": "success", "message": "backend.apache.stopped_success"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
        
    def restart_server(self):
        try:
            if self.check_is_running():
                self.stop_server()
                time.sleep(1)
            return self.start_server()
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
