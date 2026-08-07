import os
import sys
import urllib.request
import re
import shutil
import time

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, run_silent_command, start_silent_process
from core.utils.file_utils import read_json, write_json, download_advanced, extract_archive

class ApacheManager:
    """Manager untuk siklus hidup Engine Web Server Apache"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'bin', 'apache')
        os.makedirs(self.base_dir, exist_ok=True)
            
    def _get_active_version(self) -> str:
        """Membaca versi Apache aktif dari penyimpanan lokal"""
        json_file = os.path.join(get_project_root(), 'data', 'apache.json')
        data = read_json(json_file, dict)
        
        if 'active_version' in data and data['active_version']:
            return str(data['active_version']).strip()
            
        txt_file = os.path.join(get_project_root(), 'data', 'apache_active_version.txt')
        if os.path.exists(txt_file):
            try:
                with open(txt_file, 'rb') as f:
                    ver = f.read().decode('utf-8', errors='ignore').replace('\x00', '').strip(' \t\n\r\x0b\x0c\ufeff"\'')
                    if ver:
                        self._set_active_version_silent(ver)
                        os.remove(txt_file) 
                        return ver
            except: pass
        return None

    def _set_active_version_silent(self, version: str):
        json_file = os.path.join(get_project_root(), 'data', 'apache.json')
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
        except:
            return False

    def get_status(self):
        try:
            is_running = self.check_is_running()
            if not os.path.exists(self.base_dir):
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
            
            folder_map = {str(item).strip(): item for item in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")}
            if not folder_map:
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
                
            clean_folders = sorted(list(folder_map.keys()), key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            active_version = self._get_active_version()
            
            if active_version and active_version in folder_map:
                installed_version = active_version
            else:
                installed_version = clean_folders[0]
                self._set_active_version_silent(installed_version)

            installed_path = os.path.join(self.base_dir, folder_map[installed_version])

            return {"status": "success", "installed": True, "version": installed_version, "path": installed_path, "running": is_running}
        except Exception as e:
            return {"status": "error", "message": f"Gagal mengecek status Apache: {str(e)}"}

    def get_installed_versions(self):
        try:
            if not os.path.exists(self.base_dir):
                return {"status": "success", "data": [], "active": None}
                
            versions = sorted([str(item).strip() for item in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")],
                              key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            
            return {"status": "success", "data": versions, "active": self.get_status().get("version")}
        except Exception as e:
            return {"status": "error", "message": f"Gagal membaca direktori: {str(e)}"}

    def set_active_version(self, version: str):
        try:
            self._set_active_version_silent(version)
            if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            if self.check_is_running(): self.restart_server()
            return {"status": "success", "message": f"Versi aktif berhasil diubah ke Apache {version}"}
        except Exception as e:
            return {"status": "error", "message": f"Gagal menyimpan pengaturan: {str(e)}"}

    def _verify_and_patch_httpd(self):
        try:
            status = self.get_status()
            if not status.get("installed"): return
            
            apache_dir = status["path"]
            conf_path = os.path.join(apache_dir, "conf", "httpd.conf")
            if not os.path.exists(conf_path): return
            
            with open(conf_path, 'r', encoding='utf-8') as f: content = f.read()
            modified = False
            
            for mod in ["proxy_module", "proxy_fcgi_module", "rewrite_module", "vhost_alias_module", "dir_module", "setenvif_module", "ssl_module", "socache_shmcb_module"]:
                pattern = re.compile(r"^[ \t]*#[ \t]*(LoadModule\s+" + mod + r"\b.*)$", re.MULTILINE)
                if pattern.search(content):
                    content = pattern.sub(r"\1", content); modified = True

            if "\nListen 443" not in content:
                content = re.sub(r"^([ \t]*Listen[ \t]+\d+)$", r"\1\nListen 443", content, count=1, flags=re.MULTILINE) if re.search(r"^([ \t]*Listen[ \t]+\d+)$", content, re.MULTILINE) else content + "\nListen 443\n"
                modified = True
                    
            content = content.replace("Include conf/extra/httpd-vyloserve-php.conf", "IncludeOptional conf/extra/httpd-vyloserve-php.conf").replace("Include conf/extra/vyloserve-vhosts.conf", "IncludeOptional conf/extra/vyloserve-vhosts.conf")
            
            if "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
                content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"; modified = True
            if "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
                content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"; modified = True

            if "DirectoryIndex index.php" not in content:
                content = re.sub(r'DirectoryIndex\s+index\.html', 'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE); modified = True
                
            if "\nServerName localhost" not in content and "\nServerName 127.0.0.1" not in content:
                content += "\n\n# VyloServe: Suppress AH00558 Warning\nServerName localhost\n"; modified = True
                
            content = re.sub(r'# VyloServe: Relax permissions.*?</Directory>', '', content, flags=re.DOTALL)
            relax_sec = "\n# VyloServe: Relax permissions for local dev\n<Directory />\n    AllowOverride All\n    Require all granted\n</Directory>\n"
            if relax_sec not in content:
                content += relax_sec; modified = True
                
            if modified:
                with open(conf_path, 'w', encoding='utf-8') as f: f.write(content)

            extra_dir = os.path.join(apache_dir, "conf", "extra")
            os.makedirs(extra_dir, exist_ok=True)
            
            if not os.path.exists(os.path.join(extra_dir, "httpd-vyloserve-php.conf")):
                self.update_global_php_proxy(9000, restart=False) 
            if not os.path.exists(os.path.join(extra_dir, "vyloserve-vhosts.conf")):
                with open(os.path.join(extra_dir, "vyloserve-vhosts.conf"), 'w', encoding='utf-8') as f: f.write("# VyloServe Virtual Hosts Fallback\n")

            if hasattr(self, 'api'): self.api.emit_log("Pre-flight Check: httpd.conf tervalidasi dengan SSL.", "success")
        except Exception as e:
            if hasattr(self, 'api'): self.api.emit_log(f"Pre-flight Check gagal: {str(e)}", "error")
            
    def _configure_httpd(self, target_dir, port):
        conf_path = os.path.join(target_dir, "conf", "httpd.conf")
        with open(conf_path, 'r', encoding='utf-8') as f: content = f.read()

        content = re.sub(r'Define\s+SRVROOT\s+"[^"]+"', f'Define SRVROOT "{target_dir.replace(chr(92), "/")}"', content, flags=re.IGNORECASE)
        content = re.sub(r'Listen\s+80', f'Listen {port}', content, flags=re.IGNORECASE)
        
        if "ServerName localhost" not in content:
            content = re.sub(r'#\s*ServerName\s+www\.example\.com:[0-9]+', f'ServerName localhost:{port}', content, flags=re.IGNORECASE)
            if "ServerName localhost" not in content:
                content = re.sub(r'(Listen\s+[0-9]+)', f'\\1\nServerName localhost:{port}', content, flags=re.IGNORECASE)
        
        www_dir = self._ensure_default_htdocs()
        content = re.sub(r'DocumentRoot\s+"[^"]+htdocs"', f'DocumentRoot "{www_dir}"', content, flags=re.IGNORECASE)
        content = re.sub(r'<Directory\s+"[^"]+htdocs">', f'<Directory "{www_dir}">', content, flags=re.IGNORECASE)
        content = re.sub(r'DirectoryIndex\s+index\.html', r'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE)
        content = re.sub(r'Options\s+Indexes\s+FollowSymLinks', r'Options Indexes FollowSymLinks ExecCGI', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_module\s+modules/mod_proxy\.so', r'LoadModule proxy_module modules/mod_proxy.so', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_fcgi_module\s+modules/mod_proxy_fcgi\.so', r'LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so', content, flags=re.IGNORECASE)

        if "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
        if "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
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
            if not status.get("installed"): return {"status": "error", "message": "Apache belum terinstal"}
                
            php_conf_path = os.path.join(status["path"], "conf", "extra", "httpd-vyloserve-php.conf")
            os.makedirs(os.path.dirname(php_conf_path), exist_ok=True)
            www_dir = self._ensure_default_htdocs()
            
            fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:{port}/"
    </FilesMatch>"""

            with open(php_conf_path, 'w', encoding='utf-8') as f:
                f.write(f"# Auto-Generated: Mengarahkan localhost ke PHP Port {port}\n\n<VirtualHost *:80>\n    ServerName localhost\n    DocumentRoot \"{www_dir}\"\n    <Directory \"{www_dir}\">\n        DirectoryIndex index.php index.html\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n")

                if hasattr(self.api, 'ssl'):
                    try:
                        local_crt, local_key = self.api.ssl.generate_domain_cert("localhost")
                        f.write(f"<VirtualHost *:443>\n    ServerName localhost\n    DocumentRoot \"{www_dir}\"\n    SSLEngine on\n    SSLCertificateFile \"{local_crt.replace(chr(92), '/')}\"\n    SSLCertificateKeyFile \"{local_key.replace(chr(92), '/')}\"\n    <Directory \"{www_dir}\">\n        DirectoryIndex index.php index.html\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n")
                    except Exception as e:
                        if hasattr(self, 'api'): self.api.emit_log(f"Melewati SSL Localhost: {e}", "warn")
                
            if restart and self.check_is_running(): self.restart_server()
            return {"status": "success", "message": f"Proxy global diupdate ke port {port}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_available_versions(self):
        versions = []
        try:
            if sys.platform == 'win32':
                req = urllib.request.Request("https://www.apachelounge.com/download/", headers={'User-Agent': 'Mozilla/5.0'})
                try:
                    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                    for match in re.findall(r'href="([^"]*httpd-2\.4\.(\d+)[^"]*win64[^"]*\.zip)"', html, re.IGNORECASE):
                        dl_url = match[0] if match[0].startswith("http") else (f"https://www.apachelounge.com{match[0]}" if match[0].startswith("/") else f"https://www.apachelounge.com/download/{match[0]}")
                        if not any(v['version'] == f"2.4.{match[1]}" for v in versions):
                            versions.append({"version": f"2.4.{match[1]}", "filename": dl_url.split('/')[-1], "url": dl_url})
                    versions.sort(key=lambda x: int(x['version'].split('.')[2]), reverse=True)
                except: pass
                
                if not versions:
                    versions = [{"version": "2.4.68", "filename": "httpd-2.4.68.zip", "url": "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip"}]
            return {"status": "success", "data": versions}
        except Exception as e:
            return {"status": "error", "message": f"Terjadi kesalahan: {str(e)}"}

    def install_version(self, version: str, download_url: str, http_port: int, https_port: int):
        if hasattr(self, 'api'): self.api.emit_log(f"Memulai pengunduhan Apache {version}...", "info")
        target_dir = os.path.join(self.base_dir, version)
        zip_path = os.path.join(self.base_dir, f"apache-{version}.zip")
        temp_extract_dir = os.path.join(self.base_dir, f"temp_{version}")
        
        if os.path.exists(target_dir): return {"status": "error", "message": f"Apache {version} sudah terinstal."}

        try:
            def log_cb(msg, lvl): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def prog_cb(pct, msg): 
                if hasattr(self, 'api'): self.api.emit_progress(pct, msg)

            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=prog_cb)

            if hasattr(self, 'api'): self.api.emit_log("Mengekstrak file binary...", "info")
            extract_archive(zip_path, temp_extract_dir, progress_cb=prog_cb)
            if os.path.exists(zip_path): os.remove(zip_path)
                
            extracted_apache24 = os.path.join(temp_extract_dir, 'Apache24')
            move_success = False
            for _ in range(5):
                try:
                    shutil.move(extracted_apache24 if os.path.exists(extracted_apache24) else temp_extract_dir, target_dir)
                    move_success = True; break
                except: time.sleep(2)
            
            if not move_success: raise Exception("Folder dikunci oleh OS/Antivirus.")
            if os.path.exists(temp_extract_dir): shutil.rmtree(temp_extract_dir, ignore_errors=True)

            if hasattr(self, 'api'): self.api.emit_progress(80, "Mengatur konfigurasi HTTP...")
            self._configure_httpd(target_dir, http_port)

            if hasattr(self, 'api'):
                self.api.emit_progress(100, "Selesai!")
                self.api.emit_log(f"Apache {version} berhasil diinstal.", "success")
            return {"status": "success", "message": f"Apache {version} berhasil diinstal."}

        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Error instalasi Apache: {str(e)}", "error")
                self.api.emit_progress(0, "Instalasi dibatalkan.")
            if os.path.exists(zip_path): os.remove(zip_path)
            shutil.rmtree(target_dir, ignore_errors=True)
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            return {"status": "error", "message": f"Gagal menginstal: {str(e)}"}
        
    # ---> FIX: Hapus file JSON konfigurasi agar active_version tidak tertinggal <---
    def uninstall(self):
        try:
            if os.path.exists(self.base_dir):
                for item in os.listdir(self.base_dir):
                    item_path = os.path.join(self.base_dir, item)
                    shutil.rmtree(item_path, ignore_errors=True) if os.path.isdir(item_path) else os.remove(item_path)
            
            json_file = os.path.join(get_project_root(), 'data', 'apache.json')
            if os.path.exists(json_file):
                os.remove(json_file)
                
            if hasattr(self, 'api'): self.api.emit_log("Apache berhasil di-uninstall.", "success")
            return {"status": "success", "message": "Apache dihapus."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal menghapus: {str(e)}"}

    def open_directory(self):
        try:
            target = self.get_status().get("path") if self.get_status().get("installed") else self.base_dir
            os.makedirs(target, exist_ok=True)
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success"}
        except Exception as e: return {"status": "error", "message": str(e)}
            
    def open_config(self):
        try:
            status = self.get_status()
            if status.get("installed"):
                conf_path = os.path.join(status["path"], "conf", "httpd.conf")
                if os.path.exists(conf_path):
                    if sys.platform == 'win32': os.startfile(conf_path)
                    elif sys.platform == 'darwin': subprocess.Popen(['open', conf_path])
                    else: subprocess.Popen(['xdg-open', conf_path])
                    return {"status": "success"}
            return {"status": "error", "message": "httpd.conf tidak ditemukan."}
        except Exception as e: return {"status": "error", "message": str(e)}

    def open_apache_file(self, file_type):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": "Apache tidak terinstal."}
            paths = {'httpd': os.path.join(status["path"], 'conf', 'httpd.conf'), 'vhosts': os.path.join(status["path"], 'conf', 'extra', 'vyloserve-vhosts.conf'), 'error': os.path.join(status["path"], 'logs', 'error.log')}
            
            target = paths.get(file_type)
            if not target: return {"status": "error", "message": "Tipe tidak valid."}
            
            if file_type == 'error' and not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True); open(target, 'w').close()
                
            if not os.path.exists(target): return {"status": "error", "message": "File tidak ditemukan."}

            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success"}
        except Exception as e: return {"status": "error", "message": str(e)}

    def start_server(self):
        if hasattr(self, 'api'): self.api.emit_log("Menghidupkan Apache server...", "info")
        if self.check_is_running(): return {"status": "error", "message": "Apache sudah berjalan."}
            
        status = self.get_status()
        if not status.get("installed"): return {"status": "error", "message": "Apache tidak terinstal."}
            
        self._verify_and_patch_httpd()
        if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            
        try:
            proc = start_silent_process([os.path.join(status["path"], "bin", "httpd.exe")])
            time.sleep(1)
            
            if proc.poll() is not None:
                return {"status": "error", "message": "Gagal. Port 80/443 mungkin digunakan."}
                
            if hasattr(self, 'api'): self.api.emit_log(f"Apache berjalan dengan PID {proc.pid}.", "success")
            return {"status": "success", "message": "Web Server dijalankan."}
        except Exception as e: return {"status": "error", "message": str(e)}
            
    def stop_server(self):
        try:
            if hasattr(self, 'api'): self.api.emit_log("Mengirim sinyal terminasi ke Apache...", "warn")
            if sys.platform == 'win32': run_silent_command(['taskkill', '/F', '/T', '/IM', 'httpd.exe'])
            else: run_silent_command(['pkill', '-f', 'httpd'])
                
            if hasattr(self, 'api'): self.api.emit_log("Apache dihentikan.", "success")
            return {"status": "success", "message": "Web Server dihentikan."}
        except Exception as e: return {"status": "error", "message": str(e)}
        
    def restart_server(self):
        try:
            if self.check_is_running():
                self.stop_server()
                time.sleep(1)
            return self.start_server()
        except Exception as e: return {"status": "error", "message": str(e)}