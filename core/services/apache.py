import os
from typing import Dict, Optional
import sys
import urllib.request
import re
import shutil
import time
import subprocess

HTTPD_CONF_NAME = "httpd.conf"

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import (
    get_project_root,
    run_silent_command,
    start_silent_process,
    get_silent_flags,
    check_port_in_use,
    open_path_in_file_manager,
)
from core.utils.file_utils import read_json, write_json, download_advanced, extract_archive, read_log_tail, read_new_lines
from core.utils.network_utils import is_network_error, build_offline_error_response
from core.utils.cancellation import InstallationManager, OperationCancelledError
INC_VHOSTS = "Include conf/extra/vyloserve-vhosts.conf"
INC_PHP = "Include conf/extra/vyloserve-php.conf"
ERR_NOT_INSTALLED = "backend.apache.not_installed"
APACHE_JSON = "apache.json"
MSG_UNEXPECTED_ERROR = "backend.error.unexpected"
MSG_INSTALL_CANCELLED = "backend.apache.install_cancelled"

class ApacheManager:
    """Manager untuk siklus hidup Engine Web Server Apache"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'bin', 'apache')
        os.makedirs(self.base_dir, exist_ok=True)
        self._log_offsets: Dict[str, int] = {}
            
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
                res = run_silent_command(['pgrep', '-x', 'apache2|httpd'])
                return len(res.stdout.strip()) > 0
        except Exception:
            return False

    def _get_installed_folders(self) -> dict:
        if not os.path.exists(self.base_dir):
            return {}
        return {str(item).strip(): item for item in os.listdir(self.base_dir) 
                if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")}

    def _check_system_apache(self) -> dict:
        """
        Mendeteksi instalasi Apache2 / httpd bawaan OS (misalnya /usr/sbin/apache2 pada Linux).
        """
        if sys.platform == 'win32':
            return {"exists": False, "version": "", "path": "", "running": False}

        vyloserve_bin = os.path.normpath(os.path.join(get_project_root(), 'bin')).lower()
        candidates = ['apache2', 'httpd']
        clean_paths = [p for p in os.environ.get('PATH', '').split(os.pathsep) if vyloserve_bin not in p.lower()]
        for std_dir in ['/usr/sbin', '/usr/bin', '/sbin', '/usr/local/sbin', '/usr/local/bin']:
            if std_dir not in clean_paths and os.path.isdir(std_dir):
                clean_paths.append(std_dir)

        found_path = None
        for cand in candidates:
            found = shutil.which(cand, path=os.pathsep.join(clean_paths))
            if found:
                real_target = os.path.normpath(os.path.realpath(found)).lower()
                if real_target.startswith(vyloserve_bin) or vyloserve_bin in real_target:
                    continue
                found_path = found
                break

        if not found_path:
            return {"exists": False, "version": "", "path": "", "running": False}

        version_str = "Unknown"
        try:
            res = subprocess.run([found_path, '-v'], capture_output=True, text=True, creationflags=get_silent_flags(), timeout=5)
            out = res.stdout.strip() or res.stderr.strip()
            match = re.search(r'Apache/(\d+\.\d+\.\d+)', out)
            if match:
                version_str = match.group(1)
            elif out:
                version_str = out.split('\n')[0].strip()
        except Exception:
            pass

        is_running = False
        try:
            import psutil
            for proc in psutil.process_iter(['name', 'exe']):
                try:
                    pname = (proc.info.get('name') or '').lower()
                    pexe = (proc.info.get('exe') or '').lower()
                    real_pexe = os.path.normpath(os.path.realpath(pexe)).lower() if pexe else ''
                    if ('apache2' in pname or 'httpd' in pname) and vyloserve_bin not in pexe and not real_pexe.startswith(vyloserve_bin):
                        is_running = True
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception:
            pass

        return {"exists": True, "version": version_str, "path": found_path, "running": is_running}

    def get_status(self):
        try:
            is_running = self.check_is_running()
            folder_map = self._get_installed_folders()
            system_apache = self._check_system_apache()
            
            if not folder_map:
                if sys.platform != 'win32' and system_apache.get("exists"):
                    is_running_sys = system_apache.get("running", False) or is_running
                    return {
                        "status": "success",
                        "installed": True,
                        "version": system_apache.get("version") or "Linux",
                        "path": system_apache.get("path") or "/usr/sbin/apache2",
                        "running": is_running_sys,
                        "system_apache": system_apache
                    }
                return {
                    "status": "success",
                    "installed": False,
                    "version": None,
                    "path": None,
                    "running": is_running,
                    "system_apache": system_apache
                }
                
            clean_folders = sorted(folder_map.keys(), key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            active_version = self._get_active_version()
            
            installed_version = active_version if (active_version and active_version in folder_map) else clean_folders[0]
            if installed_version != active_version:
                self._set_active_version_silent(installed_version)

            installed_path = os.path.join(self.base_dir, folder_map[installed_version])
            return {
                "status": "success",
                "installed": True,
                "version": installed_version,
                "path": installed_path,
                "running": is_running,
                "system_apache": system_apache
            }
        except Exception as e:
            return {"status": "error", "message": "backend.apache.status_check_failed", "args": {"e": str(e)}}

    def get_http_port(self) -> int:
        """
        Membaca port HTTP (non-SSL) yang sedang aktif langsung dari `httpd.conf`
        instalasi Apache aktif. VyloServe tidak punya key 'apache_port' terpisah
        di manapun (bukan di data/settings.json maupun data/apache.json) -- port
        HANYA tersimpan tertulis di `Listen <port>` pada httpd.conf itu sendiri
        (lihat `_configure_httpd`). Dipakai mis. oleh `TunnelsManager` untuk tahu
        kemana zrok harus mengarahkan share (lihat docs/known_bugs.md #31).
        Mengembalikan 80 (default Apache) kalau Apache belum terinstall atau
        httpd.conf gagal dibaca.
        """
        try:
            status = self.get_status()
            if not status.get('installed'):
                return 80
            conf_path = os.path.join(status['path'], 'conf', HTTPD_CONF_NAME)
            if not os.path.exists(conf_path):
                return 80
            with open(conf_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            # Baris "Listen 443" khusus SSL (lihat _verify_and_patch_httpd) -- jangan ikut dihitung.
            ports = [int(p) for p in re.findall(r'^\s*Listen\s+(\d+)\s*$', content, re.MULTILINE) if p != '443']
            return ports[0] if ports else 80
        except Exception:
            return 80

    def get_installed_versions(self):
        try:
            versions = []
            if os.path.exists(self.base_dir):
                versions = sorted([str(item).strip() for item in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_")],
                                  key=lambda v: [int(x) for x in re.findall(r'\d+', v)] if re.findall(r'\d+', v) else [0], reverse=True)
            
            status = self.get_status()
            if not versions and status.get("installed") and status.get("version"):
                versions = [status["version"]]

            return {"status": "success", "data": versions, "active": status.get("version")}
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
        for mod in ["proxy_module", "proxy_fcgi_module", "proxy_http_module", "proxy_wstunnel_module", "headers_module", "rewrite_module", "vhost_alias_module", "dir_module", "setenvif_module", "ssl_module", "socache_shmcb_module"]:
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
            
    @staticmethod
    def _apply_httpd_replacements(content: str, target_dir: str, port: int, www_dir: str) -> str:
        safe_target = target_dir.replace(chr(92), "/")
        content = re.sub(r'Define\s+SRVROOT\s+"[^"]+"', f'Define SRVROOT "{safe_target}"', content, flags=re.IGNORECASE)
        content = re.sub(r'Listen\s+80', f'Listen {port}', content, flags=re.IGNORECASE)
        
        if "ServerName localhost" not in content:
            content = re.sub(r'#\s*ServerName\s+www\.example\.com:\d+', f'ServerName localhost:{port}', content, flags=re.IGNORECASE)
            if "ServerName localhost" not in content:
                content = re.sub(r'(Listen\s+\d+)', f'\\1\nServerName localhost:{port}', content, flags=re.IGNORECASE)
        
        content = re.sub(r'DocumentRoot\s+"[^"]+htdocs"', f'DocumentRoot "{www_dir}"', content, flags=re.IGNORECASE)
        content = re.sub(r'<Directory\s+"[^"]+htdocs">', f'<Directory "{www_dir}">', content, flags=re.IGNORECASE)

        static_replacements = (
            (r'DirectoryIndex\s+index\.html', 'DirectoryIndex index.php index.html'),
            (r'Options\s+Indexes\s+FollowSymLinks', 'Options Indexes FollowSymLinks ExecCGI'),
            (r'#\s*LoadModule\s+proxy_module\s+modules/mod_proxy\.so', 'LoadModule proxy_module modules/mod_proxy.so'),
            (r'#\s*LoadModule\s+proxy_fcgi_module\s+modules/mod_proxy_fcgi\.so', 'LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so'),
            (r'#\s*LoadModule\s+proxy_http_module\s+modules/mod_proxy_http\.so', 'LoadModule proxy_http_module modules/mod_proxy_http.so'),
            (r'#\s*LoadModule\s+proxy_wstunnel_module\s+modules/mod_proxy_wstunnel\.so', 'LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so'),
            (r'#\s*LoadModule\s+headers_module\s+modules/mod_headers\.so', 'LoadModule headers_module modules/mod_headers.so'),
        )
        for pattern, repl in static_replacements:
            content = re.sub(pattern, repl, content, flags=re.IGNORECASE)

        if INC_PHP not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
        if INC_VHOSTS not in content:
            content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"

        return content

    def _configure_httpd(self, target_dir, port):
        conf_path = os.path.join(target_dir, "conf", HTTPD_CONF_NAME)
        with open(conf_path, 'r', encoding='utf-8') as f:
            content = f.read()

        www_dir = self._ensure_default_htdocs()
        content = self._apply_httpd_replacements(content, target_dir, port, www_dir)

        with open(conf_path, 'w', encoding='utf-8') as f:
            f.write(content)
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
            
            fcgi_handler = f"proxy:fcgi://127.0.0.1:{port}/"
            if sys.platform != 'win32':
                for cand in ["/run/php/php-fpm.sock", "/var/run/php/php-fpm.sock"]:
                    if os.path.exists(cand):
                        fcgi_handler = f"proxy:unix:{cand}|fcgi://localhost"
                        break

            fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    <FilesMatch "\\.php$">
        SetHandler "{fcgi_handler}"
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
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

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

    def _install_apache_linux(self, http_port: int) -> dict:
        pkexec = shutil.which("pkexec")
        apt_get = shutil.which("apt-get")
        dnf = shutil.which("dnf")
        pacman = shutil.which("pacman")

        if not pkexec:
            return {"status": "error", "message": "backend.apache.no_pkexec"}

        if hasattr(self, 'api') and self.api:
            self.api.emit_log("backend.apache.linux_installing", "info")
            self.api.emit_progress(20, "backend.apache.linux_updating_repo")

        try:
            if apt_get:
                run_silent_command([pkexec, apt_get, "update"])
                if hasattr(self, 'api') and self.api:
                    self.api.emit_progress(50, "backend.apache.linux_installing")
                res = subprocess.run([pkexec, apt_get, "install", "-y", "apache2"], capture_output=True, text=True)
            elif dnf:
                if hasattr(self, 'api') and self.api:
                    self.api.emit_progress(50, "backend.apache.linux_installing")
                res = subprocess.run([pkexec, dnf, "install", "-y", "httpd"], capture_output=True, text=True)
            elif pacman:
                if hasattr(self, 'api') and self.api:
                    self.api.emit_progress(50, "backend.apache.linux_installing")
                res = subprocess.run([pkexec, pacman, "-S", "--noconfirm", "apache"], capture_output=True, text=True)
            else:
                return {"status": "error", "message": "backend.apache.unsupported_linux_distro"}

            if res.returncode in (126, 127):
                if hasattr(self, 'api') and self.api:
                    self.api.emit_progress(0, "backend.apache.auth_cancelled")
                    self.api.emit_log("backend.apache.auth_cancelled", "warn")
                return {"status": "error", "message": "backend.apache.auth_cancelled"}

            if res.returncode != 0:
                err_msg = res.stderr.strip() if res.stderr else "Installation failed"
                if hasattr(self, 'api') and self.api:
                    self.api.emit_progress(0, "backend.apache.install_failed")
                return {"status": "error", "message": "backend.apache.install_failed", "args": {"e": err_msg[:120]}}

            self._ensure_linux_apache_integration()
            self._ensure_home_traversal_permission()

            if hasattr(self, 'api') and self.api:
                self.api.emit_progress(100, "backend.apache.linux_install_success")
                self.api.emit_log("backend.apache.linux_install_success", "success")

            return {"status": "success", "message": "backend.apache.linux_install_success"}
        except Exception as e:
            return {"status": "error", "message": "backend.apache.install_failed", "args": {"e": str(e)}}

    def get_available_versions(self):
        versions = []
        try:
            if sys.platform == 'win32':
                req = urllib.request.Request("https://www.apachelounge.com/download/", headers={'User-Agent': 'Mozilla/5.0'})
                html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
                versions = self._parse_apache_versions_html(html)

                if not versions:
                    versions = [{"version": "2.4.68", "filename": "httpd-2.4.68.zip", "url": "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip"}]
            elif sys.platform.startswith('linux'):
                versions = [{
                    "version": "system",
                    "filename": "apache2",
                    "url": "system",
                    "name": "Apache 2 (Linux System Package)"
                }]
            return {"status": "success", "data": versions}
        except Exception as e:
            if is_network_error(e):
                return build_offline_error_response()
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

    def _migrate_old_conf(self, old_path: Optional[str], target_dir: str):
        if old_path and os.path.exists(os.path.join(old_path, "conf")):
            shutil.copytree(os.path.join(old_path, "conf"), os.path.join(target_dir, "conf"), dirs_exist_ok=True)

    def _cleanup_old_version(self, old_path: Optional[str], target_dir: str):
        if old_path and old_path != target_dir and os.path.exists(old_path):
            time.sleep(1)
            shutil.rmtree(old_path, ignore_errors=True)

    def _download_and_extract_apache(self, download_url: str, zip_path: str, temp_extract_dir: str, target_dir: str, cancel_check=None):
        def log_cb(msg, lvl): 
            if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
        def prog_cb(pct, msg, args=None):
            if hasattr(self, 'api'): self.api.emit_progress(pct, msg, args)

        download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=prog_cb, cancel_check=cancel_check)
        if hasattr(self, 'api'): self.api.emit_log("backend.apache.extracting", "info")
        extract_archive(zip_path, temp_extract_dir, progress_cb=prog_cb, cancel_check=cancel_check)
        if os.path.exists(zip_path): os.remove(zip_path)
        self._move_apache_extract(temp_extract_dir, target_dir)

    def install_version(self, version: str, download_url: str, http_port: int):
        if download_url == "system" or version == "system":
            return self._install_apache_linux(http_port)

        if hasattr(self, 'api'): self.api.emit_log("backend.apache.download_start", "info", {"version": version})
        
        # Simpan info versi lama untuk migrasi konfigurasi
        old_status = self.get_status()
        old_path = old_status.get("path") if old_status.get("installed") else None

        target_dir = os.path.join(self.base_dir, version)
        zip_path = os.path.join(self.base_dir, f"apache-{version}.zip")
        temp_extract_dir = os.path.join(self.base_dir, f"temp_{version}")
        
        if os.path.exists(target_dir): return {"status": "error", "message": "backend.apache.already_installed"}

        token = InstallationManager.get_token("apache")

        try:
            self._download_and_extract_apache(download_url, zip_path, temp_extract_dir, target_dir, cancel_check=token.is_cancelled)
            self._migrate_old_conf(old_path, target_dir)

            if hasattr(self, 'api'): self.api.emit_progress(80, "backend.apache.configuring")
            self._configure_httpd(target_dir, http_port)

            # Auto-activate the newly installed version (ini akan otomatis me-restart server jika sedang menyala)
            self.set_active_version(version)
            self._cleanup_old_version(old_path, target_dir)

            if hasattr(self, 'api'):
                self.api.emit_progress(100, "backend.apache.done")
                self.api.emit_log("backend.apache.install_success", "success", {"version": version})
            return {"status": "success", "message": "backend.apache.install_success", "args": {"version": version}}

        except OperationCancelledError:
            if hasattr(self, 'api'):
                self.api.emit_log(MSG_INSTALL_CANCELLED, "warn")
                self.api.emit_progress(0, MSG_INSTALL_CANCELLED)
            if os.path.exists(zip_path): os.remove(zip_path)
            shutil.rmtree(target_dir, ignore_errors=True)
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            return {"status": "cancelled", "message": MSG_INSTALL_CANCELLED}

        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log("backend.apache.install_error", "error", {"e": str(e)})
                self.api.emit_progress(0, MSG_INSTALL_CANCELLED)
            if os.path.exists(zip_path): os.remove(zip_path)
            shutil.rmtree(target_dir, ignore_errors=True)
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            return {"status": "error", "message": "backend.apache.install_failed", "args": {"e": str(e)}}
        finally:
            InstallationManager.reset("apache")
        
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

    def _is_system_apache(self, status: dict) -> bool:
        apache_path = status.get("path") or ""
        return (
            sys.platform != 'win32'
            and (
                bool(status.get("system_apache", {}).get("exists"))
                or (os.path.isfile(apache_path) and apache_path.endswith(('apache2', 'httpd')))
                or apache_path.startswith(('/usr', '/etc', '/var'))
            )
        )

    def _get_conf_dir(self, status: dict) -> str:
        apache_path = status.get("path") or ""
        if self._is_system_apache(status):
            for d in ['/etc/apache2', '/etc/httpd']:
                if os.path.isdir(d): return d
        return os.path.join(apache_path, "conf")

    def _get_logs_dir(self, status: dict) -> str:
        apache_path = status.get("path") or ""
        if self._is_system_apache(status):
            for d in ['/var/log/apache2', '/var/log/httpd']:
                if os.path.isdir(d): return d
        return os.path.join(apache_path, "logs")

    def _get_main_conf_file(self, status: dict) -> str:
        apache_path = status.get("path") or ""
        if self._is_system_apache(status):
            for f in ['/etc/apache2/apache2.conf', '/etc/httpd/conf/httpd.conf']:
                if os.path.isfile(f): return f
        return os.path.join(apache_path, "conf", HTTPD_CONF_NAME)

    def _get_vhosts_file(self, status: dict) -> str:
        apache_path = status.get("path") or ""
        if self._is_system_apache(status):
            vhosts_dir = os.path.join(get_project_root(), "data", "apache", "extra")
            os.makedirs(vhosts_dir, exist_ok=True)
            return os.path.join(vhosts_dir, "vyloserve-vhosts.conf")
        return os.path.join(apache_path, 'conf', 'extra', 'vyloserve-vhosts.conf')

    def _ensure_home_traversal_permission(self):
        if sys.platform != 'win32':
            try:
                home = os.path.expanduser('~')
                st = os.stat(home)
                if not (st.st_mode & 0o001):
                    os.chmod(home, st.st_mode | 0o001)
            except Exception:
                pass

    def _ensure_linux_apache_integration(self) -> bool:
        if sys.platform == 'win32':
            return True
        status = self.get_status()
        if not self._is_system_apache(status):
            return True

        extra_dir = os.path.join(get_project_root(), "data", "apache", "extra")
        os.makedirs(extra_dir, exist_ok=True)
        php_conf = os.path.join(extra_dir, "httpd-vyloserve-php.conf")
        vhosts_conf = os.path.join(extra_dir, "vyloserve-vhosts.conf")
        if not os.path.exists(php_conf):
            with open(php_conf, 'w', encoding='utf-8') as f:
                f.write("# VyloServe PHP Proxy Fallback\n")
        if not os.path.exists(vhosts_conf):
            with open(vhosts_conf, 'w', encoding='utf-8') as f:
                f.write("# VyloServe Virtual Hosts Fallback\n")

        safe_extra = extra_dir.replace('\\', '/')
        content = (
            f"# VyloServe Auto-Generated Configuration\\n"
            f"IncludeOptional \\\"{safe_extra}/httpd-vyloserve-php.conf\\\"\\n"
            f"IncludeOptional \\\"{safe_extra}/vyloserve-vhosts.conf\\\"\\n"
        )

        pkexec = shutil.which("pkexec")
        if os.path.isdir("/etc/apache2"):
            conf_avail = "/etc/apache2/conf-available/vyloserve.conf"
            conf_enabl = "/etc/apache2/conf-enabled/vyloserve.conf"
            missing_mods = [
                m for m in ["proxy", "proxy_fcgi", "rewrite", "headers", "ssl"]
                if not os.path.exists(f"/etc/apache2/mods-enabled/{m}.load")
            ]
            conf_needed = False
            if not os.path.exists(conf_avail) or not os.path.exists(conf_enabl):
                conf_needed = True
            else:
                try:
                    with open(conf_avail, 'r', encoding='utf-8') as f:
                        if safe_extra not in f.read():
                            conf_needed = True
                except Exception:
                    conf_needed = True

            if missing_mods or conf_needed:
                cmds = []
                if missing_mods:
                    cmds.append(f"a2enmod {' '.join(missing_mods)}")
                if conf_needed:
                    cmds.append(f"printf '{content}' > {conf_avail} && a2enconf vyloserve")
                
                full_cmd = " && ".join(cmds)
                if pkexec:
                    res = subprocess.run([pkexec, "bash", "-c", full_cmd], capture_output=True)
                    return res.returncode == 0
                return False
            return True

        if os.path.isdir("/etc/httpd/conf.d"):
            conf_file = "/etc/httpd/conf.d/vyloserve.conf"
            conf_needed = False
            if not os.path.exists(conf_file):
                conf_needed = True
            else:
                try:
                    with open(conf_file, 'r', encoding='utf-8') as f:
                        if safe_extra not in f.read():
                            conf_needed = True
                except Exception:
                    conf_needed = True
            if conf_needed and pkexec:
                res = subprocess.run([pkexec, "bash", "-c", f"printf '{content}' > {conf_file}"], capture_output=True)
                return res.returncode == 0
            return True

        return True

    def _open_path_os(self, target: str):
        if open_path_in_file_manager(target):
            return {"status": "success"}
        return {"status": "error", "message": MSG_UNEXPECTED_ERROR}

    def open_directory(self):
        try:
            status = self.get_status()
            target = status.get("path") if status.get("installed") else self.base_dir
            if target and os.path.isfile(target):
                target = os.path.dirname(target)
            if not target: target = self.base_dir
            os.makedirs(target, exist_ok=True)
            return self._open_path_os(target)
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_htdocs(self):
        try:
            www_dir = self._ensure_default_htdocs()
            return self._open_path_os(www_dir)
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_conf_dir(self):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            conf_dir = self._get_conf_dir(status)
            os.makedirs(conf_dir, exist_ok=True)
            return self._open_path_os(conf_dir)
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_logs_dir(self):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            logs_dir = self._get_logs_dir(status)
            os.makedirs(logs_dir, exist_ok=True)
            return self._open_path_os(logs_dir)
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def get_ports_status(self):
        try:
            http_port = self.get_http_port()
            https_port = 443
            is_running = self.check_is_running()

            port_http_in_use = check_port_in_use(http_port)
            port_https_in_use = check_port_in_use(https_port)

            def resolve_status(in_use: bool):
                if in_use and is_running:
                    return "listening"
                elif in_use and not is_running:
                    return "conflict"
                return "ready"

            return {
                "status": "success",
                "data": {
                    "http": {
                        "port": http_port,
                        "status": resolve_status(port_http_in_use)
                    },
                    "https": {
                        "port": https_port,
                        "status": resolve_status(port_https_in_use)
                    }
                }
            }
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_config(self):
        try:
            status = self.get_status()
            if status.get("installed"):
                conf_path = self._get_main_conf_file(status)
                if os.path.exists(conf_path):
                    if open_path_in_file_manager(conf_path):
                        return {"status": "success"}
                    return {"status": "error", "message": MSG_UNEXPECTED_ERROR}
            return {"status": "error", "message": "backend.apache.httpd_not_found"}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_apache_file(self, file_type):
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            
            logs_dir = self._get_logs_dir(status)
            if self._is_system_apache(status):
                err_log_cand = os.path.join(logs_dir, 'error.log') if os.path.exists(os.path.join(logs_dir, 'error.log')) else os.path.join(logs_dir, 'error_log')
            else:
                err_log_cand = os.path.join(logs_dir, 'error_log')
            paths = {
                'httpd': self._get_main_conf_file(status),
                'vhosts': self._get_vhosts_file(status),
                'error': err_log_cand
            }
            
            target = paths.get(file_type)
            if not target: return {"status": "error", "message": "backend.apache.invalid_type"}
            
            if file_type == 'error' and not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True); open(target, 'w').close()
                
            if not os.path.exists(target): return {"status": "error", "message": "backend.apache.file_not_found"}

            if open_path_in_file_manager(target):
                return {"status": "success"}
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def get_log_content(self, log_type: str):
        """Membaca isi (tail) file log Apache secara langsung untuk ditampilkan di dalam aplikasi."""
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}

            logs_dir = self._get_logs_dir(status)
            if self._is_system_apache(status):
                candidates = {
                    'error': ['error.log', 'error_log'],
                    'access': ['access.log', 'access_log']
                }
            else:
                candidates = {
                    'error': ['error_log'],
                    'access': ['access_log']
                }
            cand_list = candidates.get(log_type)
            if not cand_list: return {"status": "error", "message": "backend.apache.invalid_type"}

            log_path = None
            for fname in cand_list:
                p = os.path.join(logs_dir, fname)
                if os.path.exists(p):
                    log_path = p
                    break
            if not log_path:
                log_path = os.path.join(logs_dir, cand_list[0])

            content = read_log_tail(log_path)
            return {"status": "success", "data": content}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _parse_error_log_level(self, line: str, default_level: str) -> str:
        lower_line = line.lower()
        if ':warn]' in lower_line or '[warn]' in lower_line: return 'warn'
        if ':notice]' in lower_line or '[notice]' in lower_line or ':info]' in lower_line or '[info]' in lower_line: return 'info'
        if ':error]' in lower_line or '[error]' in lower_line or ':emerg]' in lower_line or ':crit]' in lower_line: return 'error'
        return default_level

    def tail_new_logs(self):
        """
        Menyalurkan baris BARU di error_log/access_log Apache (sejak polling
        terakhir) ke System Logs lewat emit_log() -- dipanggil berkala oleh
        Api.start_log_watcher() (lihat docs/backend_services.md §11.2). Hanya
        aktif kalau Apache sedang berjalan; file yang baru pertama kali dipantau
        mulai dihitung dari AKHIR-nya (gaya `tail -f`), bukan me-replay seluruh
        histori lama sebagai log baru.
        """
        try:
            status = self.get_status()
            if not status.get('installed') or not status.get('running'):
                return

            filenames = {'error_log': 'error', 'access_log': 'info'}
            for filename, level in filenames.items():
                log_path = os.path.join(status['path'], 'logs', filename)
                if log_path not in self._log_offsets:
                    self._log_offsets[log_path] = os.path.getsize(log_path) if os.path.exists(log_path) else 0
                    continue

                lines, new_offset = read_new_lines(log_path, self._log_offsets[log_path])
                self._log_offsets[log_path] = new_offset
                for line in lines:
                    actual_level = self._parse_error_log_level(line, level) if filename == 'error_log' else level
                            
                    # source_override='ApacheFileLog' (BUKAN auto-detect 'ApacheManager') supaya baris
                    # dari file log bisa difilter terpisah dari pesan sistem Apache di modal "System Logs".
                    self.api.emit_log(line, actual_level, {}, source_override='ApacheFileLog')
        except Exception:
            # Sengaja diam -- dipanggil tiap 2 detik dari api.py log watcher selama aplikasi
            # berjalan; melaporkan tiap kegagalan baca-file (race rotasi log, I/O transien)
            # lewat emit_log akan membanjiri panel System Logs kalau errornya persisten.
            pass

    def _get_linux_apache_service_name(self) -> str:
        if shutil.which("apache2") or os.path.exists("/usr/sbin/apache2"):
            return "apache2"
        return "httpd"

    def start_server(self):
        if hasattr(self, 'api'): self.api.emit_log("backend.apache.starting", "info")
        if self.check_is_running(): return {"status": "error", "message": "backend.apache.already_running"}
            
        status = self.get_status()
        if not status.get("installed"): return {"status": "error", "message": ERR_NOT_INSTALLED}
            
        apache_path = status.get("path") or ""
        is_system_apache = (
            sys.platform != 'win32'
            and os.path.isfile(apache_path)
            and apache_path.endswith(('apache2', 'httpd'))
        )

        if is_system_apache:
            self._ensure_linux_apache_integration()
            self._ensure_home_traversal_permission()
            if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            svc = self._get_linux_apache_service_name()
            pkexec = shutil.which("pkexec")
            systemctl = shutil.which("systemctl")
            started = False
            if systemctl:
                res = subprocess.run([systemctl, "start", svc], capture_output=True)
                if res.returncode == 0:
                    started = True
                elif pkexec:
                    res_pk = subprocess.run([pkexec, systemctl, "start", svc], capture_output=True)
                    if res_pk.returncode == 0:
                        started = True
            if not started:
                ctl = shutil.which("apache2ctl") or shutil.which("apachectl")
                if ctl:
                    subprocess.run([ctl, "start"], capture_output=True)
            time.sleep(1)
            if self.check_is_running():
                if hasattr(self, 'api'):
                    self.api.emit_log("backend.apache.start_success", "success")
                    if hasattr(self.api, 'emit_service_status'):
                        self.api.emit_service_status('apache', True)
                return {"status": "success", "message": "backend.apache.start_success"}
            return {"status": "error", "message": "backend.apache.port_in_use"}

        self._verify_and_patch_httpd()
        if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            
        try:
            exe_name = "httpd.exe" if sys.platform == 'win32' else "httpd"
            proc = start_silent_process([os.path.join(apache_path, "bin", exe_name)])
            time.sleep(1)
            
            if proc.poll() is not None:
                return {"status": "error", "message": "backend.apache.port_in_use"}
                
            if hasattr(self, 'api'):
                self.api.emit_log("backend.apache.started_with_pid", "success", {"pid": proc.pid})
                if hasattr(self.api, 'emit_service_status'):
                    self.api.emit_service_status('apache', True)
            return {"status": "success", "message": "backend.apache.start_success"}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
            
    def stop_server(self):
        try:
            if hasattr(self, 'api'): self.api.emit_log("backend.apache.terminating", "warn")
            if sys.platform == 'win32':
                run_silent_command(['taskkill', '/F', '/T', '/IM', 'httpd.exe'])
            else:
                system_apache = self._check_system_apache()
                is_system_apache = bool(system_apache.get("exists"))
                if is_system_apache:
                    svc = self._get_linux_apache_service_name()
                    pkexec = shutil.which("pkexec")
                    systemctl = shutil.which("systemctl")
                    if systemctl:
                        res = subprocess.run([systemctl, "stop", svc], capture_output=True)
                        if res.returncode != 0 and pkexec:
                            subprocess.run([pkexec, systemctl, "stop", svc], capture_output=True)
                    ctl = shutil.which("apache2ctl") or shutil.which("apachectl")
                    if ctl:
                        subprocess.run([ctl, "stop"], capture_output=True)
                run_silent_command(['pkill', '-f', 'httpd'])
                run_silent_command(['pkill', '-f', 'apache2'])
                time.sleep(0.5)
                
            if hasattr(self, 'api'):
                self.api.emit_log("backend.apache.stopped", "success")
                if hasattr(self.api, 'emit_service_status'):
                    self.api.emit_service_status('apache', False)
            return {"status": "success", "message": "backend.apache.stopped_success"}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
        
    def restart_server(self):
        try:
            if self.check_is_running():
                self.stop_server()
                time.sleep(1)
            return self.start_server()
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def reload_server(self):
        try:
            if sys.platform == 'win32':
                status = self.get_status()
                apache_path = status.get("path") or ""
                httpd_exe = os.path.join(apache_path, "bin", "httpd.exe")
                if os.path.exists(httpd_exe):
                    run_silent_command([httpd_exe, "-k", "restart"])
                elif self.check_is_running():
                    self.restart_server()
            else:
                status = self.get_status()
                if self._is_system_apache(status):
                    svc = self._get_linux_apache_service_name()
                    pkexec = shutil.which("pkexec")
                    systemctl = shutil.which("systemctl")
                    reloaded = False
                    if systemctl:
                        res = subprocess.run([systemctl, "reload", svc], capture_output=True)
                        if res.returncode == 0:
                            reloaded = True
                        elif pkexec:
                            res_pk = subprocess.run([pkexec, systemctl, "reload", svc], capture_output=True)
                            if res_pk.returncode == 0:
                                reloaded = True
                    if not reloaded:
                        ctl = shutil.which("apache2ctl") or shutil.which("apachectl")
                        if ctl:
                            subprocess.run([ctl, "graceful"], capture_output=True)
                elif self.check_is_running():
                    self.restart_server()
            if hasattr(self, 'api'):
                self.api.emit_log("backend.apache.reloaded", "success")
            return {"status": "success", "message": "backend.apache.reloaded"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
