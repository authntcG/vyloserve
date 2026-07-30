import os
import sys
import urllib.request
import re
import zipfile
import shutil
import traceback
import subprocess
import time
import json

class ApacheManager:
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'bin', 'apache')
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            
    def _get_active_version(self):
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        json_file = os.path.join(root_dir, 'data', 'apache.json')
        
        try:
            if os.path.exists(json_file):
                with open(json_file, 'r', encoding='utf-8-sig') as f:
                    content = f.read().strip()
                    if content:
                        data = json.loads(content)
                        ver = data.get('active_version')
                        if ver:
                            return str(ver).strip()
        except Exception:
            pass
            
        txt_file = os.path.join(root_dir, 'data', 'apache_active_version.txt')
        try:
            if os.path.exists(txt_file):
                with open(txt_file, 'rb') as f:
                    raw_bytes = f.read()
                    ver = raw_bytes.decode('utf-8', errors='ignore').replace('\x00', '')
                    ver = ver.strip(' \t\n\r\x0b\x0c\ufeff"\'')
                    if ver:
                        self._set_active_version_silent(ver)
                        try: os.remove(txt_file) 
                        except: pass
                        return ver
        except:
            pass
            
        return None

    def _set_active_version_silent(self, version):
        try:
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            data_dir = os.path.join(root_dir, 'data')
            os.makedirs(data_dir, exist_ok=True)
            
            json_file = os.path.join(data_dir, 'apache.json')
            data = {}
            if os.path.exists(json_file):
                try:
                    with open(json_file, 'r', encoding='utf-8-sig') as f:
                        content = f.read().strip()
                        if content: data = json.loads(content)
                except Exception:
                    pass 
                    
            data['active_version'] = str(version).strip()
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    def check_is_running(self):
        try:
            if sys.platform == 'win32':
                flags = subprocess.CREATE_NO_WINDOW
                output = subprocess.check_output('tasklist /FI "IMAGENAME eq httpd.exe"', shell=True, creationflags=flags).decode()
                return 'httpd.exe' in output
            else:
                output = subprocess.check_output(['pgrep', 'httpd']).decode()
                return len(output.strip()) > 0
        except Exception:
            return False

    def get_status(self):
        try:
            is_running = self.check_is_running()
            if not os.path.exists(self.base_dir):
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
            
            folder_map = {}
            for item in os.listdir(self.base_dir):
                item_path = os.path.join(self.base_dir, item)
                if os.path.isdir(item_path) and not item.startswith("temp_"):
                    clean_name = str(item).strip()
                    folder_map[clean_name] = item 
                    
            if not folder_map:
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
                
            clean_folders = list(folder_map.keys())
            
            def get_version_score(v):
                matches = re.findall(r'\d+', v)
                return [int(x) for x in matches] if matches else [0]
                
            clean_folders.sort(key=get_version_score, reverse=True)
            active_version = self._get_active_version()
            
            installed_version = None
            installed_path = None
            
            if active_version and active_version in folder_map:
                installed_version = active_version
                installed_path = os.path.join(self.base_dir, folder_map[active_version])
            else:
                installed_version = clean_folders[0]
                installed_path = os.path.join(self.base_dir, folder_map[installed_version])
                self._set_active_version_silent(installed_version)

            return {
                "status": "success", 
                "installed": True, 
                "version": installed_version, 
                "path": installed_path,
                "running": is_running
            }
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal mengecek status Apache: {str(e)}"}

    def get_installed_versions(self):
        try:
            if not os.path.exists(self.base_dir):
                return {"status": "success", "data": [], "active": None}
                
            versions = []
            for item in os.listdir(self.base_dir):
                if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_"):
                    versions.append(str(item).strip())
                    
            def get_version_score(v):
                matches = re.findall(r'\d+', v)
                return [int(x) for x in matches] if matches else [0]
                
            versions.sort(key=get_version_score, reverse=True)
            status = self.get_status()
            active = status.get("version")

            return {"status": "success", "data": versions, "active": active}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal membaca direktori: {str(e)}"}

    def set_active_version(self, version):
        try:
            self._set_active_version_silent(version)
            if hasattr(self.api, 'project'):
                self.api.project.sync_apache_vhosts()
            if self.check_is_running():
                self.restart_server()
            return {"status": "success", "message": f"Versi aktif berhasil diubah ke Apache {version}"}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menyimpan pengaturan: {str(e)}"}

    def _verify_and_patch_httpd(self):
        try:
            status = self.get_status()
            if not status.get("installed"): return
            
            apache_dir = status["path"]
            conf_path = os.path.join(apache_dir, "conf", "httpd.conf")
            if not os.path.exists(conf_path): return
            
            with open(conf_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            modified = False
            
            modules = [
                "proxy_module", "proxy_fcgi_module", "rewrite_module", 
                "vhost_alias_module", "dir_module", "setenvif_module",
                "ssl_module", "socache_shmcb_module"
            ]
            for mod in modules:
                pattern = re.compile(r"^[ \t]*#[ \t]*(LoadModule\s+" + mod + r"\b.*)$", re.MULTILINE)
                if pattern.search(content):
                    content = pattern.sub(r"\1", content)
                    modified = True

            if "\nListen 443" not in content:
                pattern = re.compile(r"^([ \t]*Listen[ \t]+\d+)$", re.MULTILINE)
                if pattern.search(content):
                    content = pattern.sub(r"\1\nListen 443", content, count=1)
                    modified = True
                else:
                    content += "\nListen 443\n"
                    modified = True
                    
            if "Include conf/extra/httpd-vyloserve-php.conf" in content:
                content = content.replace("Include conf/extra/httpd-vyloserve-php.conf", "IncludeOptional conf/extra/httpd-vyloserve-php.conf")
                modified = True
            if "Include conf/extra/vyloserve-vhosts.conf" in content:
                content = content.replace("Include conf/extra/vyloserve-vhosts.conf", "IncludeOptional conf/extra/vyloserve-vhosts.conf")
                modified = True
                
            if "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
                content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
                modified = True
            if "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
                content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"
                modified = True

            if "DirectoryIndex index.php" not in content:
                content = re.sub(r'DirectoryIndex\s+index\.html', 'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE)
                modified = True
                
            if "\nServerName localhost" not in content and "\nServerName 127.0.0.1" not in content:
                content += "\n\n# VyloServe: Suppress AH00558 Warning\nServerName localhost\n"
                modified = True
                
            content = re.sub(r'# VyloServe: Relax permissions.*?</Directory>', '', content, flags=re.DOTALL)
            relax_sec = "\n# VyloServe: Relax permissions for local dev\n<Directory />\n    AllowOverride All\n    Require all granted\n</Directory>\n"
            if relax_sec not in content:
                content += relax_sec
                modified = True
                
            if modified:
                with open(conf_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            extra_dir = os.path.join(apache_dir, "conf", "extra")
            os.makedirs(extra_dir, exist_ok=True)
            
            php_conf_path = os.path.join(extra_dir, "httpd-vyloserve-php.conf")
            if not os.path.exists(php_conf_path):
                self.update_global_php_proxy(9000, restart=False) 
                    
            vhosts_conf_path = os.path.join(extra_dir, "vyloserve-vhosts.conf")
            if not os.path.exists(vhosts_conf_path):
                with open(vhosts_conf_path, 'w', encoding='utf-8') as f:
                    f.write("# VyloServe Virtual Hosts Fallback\n")

            self.api.emit_log("Pre-flight Check: httpd.conf tervalidasi dengan SSL.", "success")
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Pre-flight Check gagal: {str(e)}", "error")
            
    def _configure_httpd(self, target_dir, port):
        conf_path = os.path.join(target_dir, "conf", "httpd.conf")
        with open(conf_path, 'r', encoding='utf-8') as f:
            content = f.read()

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

        if "Include conf/extra/httpd-vyloserve-php.conf" not in content and "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
            
        if "Include conf/extra/httpd-vhosts-vyloserve.conf" not in content and "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
            content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"

        with open(conf_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        self.update_global_php_proxy(9000, restart=False)
            
    def _ensure_default_htdocs(self):
        """Memastikan folder www global dan file default selalu ada (Persisten)"""
        root_dir = os.path.dirname(os.path.dirname(self.base_dir))
        www_dir = os.path.join(root_dir, 'www')
        
        os.makedirs(www_dir, exist_ok=True)
        
        # 1. Auto-generate index.php dengan Tailwind UI
        index_path = os.path.join(www_dir, 'index.php')
        if not os.path.exists(index_path):
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write("""<?php
// Mengambil informasi esensial dari Server dan PHP
$server_software = isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : 'Unknown Server';
$php_version = phpversion();
$doc_root = isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : 'Unknown Directory';
$server_name = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost';
$server_port = isset($_SERVER['SERVER_PORT']) ? $_SERVER['SERVER_PORT'] : '80';
$server_protocol = isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.1';

// Mengambil limitasi PHP
$memory_limit = ini_get('memory_limit') ?: 'N/A';
$upload_max_filesize = ini_get('upload_max_filesize') ?: 'N/A';
$post_max_size = ini_get('post_max_size') ?: 'N/A';
$max_execution_time = ini_get('max_execution_time') ?: 'N/A';

// Mengecek ketersediaan driver Database
$has_pdo_mysql = extension_loaded('pdo_mysql');
$has_pdo_pgsql = extension_loaded('pdo_pgsql');
$has_sqlite3 = extension_loaded('sqlite3');
$has_mbstring = extension_loaded('mbstring');
$has_curl = extension_loaded('curl');
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VyloServe - Local Environment Dashboard</title>
    
    <!-- Tailwind CSS (CDN) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: { primary: '#2563eb' }
                }
            }
        }
    </script>

    <!-- Google Material Symbols -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
    </style>
</head>
<body class="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
    
    <div class="max-w-4xl w-full flex flex-col gap-8">
        
        <!-- HEADER / HERO SECTION -->
        <div class="flex flex-col items-center text-center gap-4 bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            <div class="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center border-4 border-emerald-50 dark:border-emerald-900/20 mb-2">
                <span class="material-symbols-outlined text-[40px] text-emerald-600 dark:text-emerald-400">check_circle</span>
            </div>
            
            <h1 class="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                VyloServe is Running!
            </h1>
            <p class="text-slate-500 dark:text-slate-400 max-w-xl text-sm md:text-base">
                Server lokal Anda telah berhasil diinisiasi. Halaman ini di-<i>render</i> langsung oleh Apache Web Server yang terhubung dengan FastCGI PHP.
            </p>
        </div>

        <!-- GRID INFORMASI -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <!-- KARTU SERVER -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-primary text-[28px]" style="font-variation-settings: 'FILL' 0">dns</span>
                    <h2 class="text-lg font-semibold">Web Server</h2>
                </div>
                
                <div class="flex flex-col gap-3 text-sm">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Engine</span>
                        <span class="font-semibold text-right"><?= explode(' ', $server_software)[0] ?></span>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Host / Port</span>
                        <span class="font-mono text-primary dark:text-blue-400"><?= $server_name ?> : <?= $server_port ?></span>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Protocol</span>
                        <span class="font-mono"><?= $server_protocol ?></span>
                    </div>
                    <div class="flex flex-col gap-1 mt-1">
                        <span class="text-slate-500">Document Root</span>
                        <span class="font-mono text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 break-all">
                            <?= $doc_root ?>
                        </span>
                    </div>
                </div>
            </div>

            <!-- KARTU PHP -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-emerald-500 text-[28px]" style="font-variation-settings: 'FILL' 0">php</span>
                        <h2 class="text-lg font-semibold">PHP Engine</h2>
                    </div>
                    <a href="/phpinfo.php" target="_blank" class="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                        phpinfo() <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                </div>
                
                <div class="flex flex-col gap-3 text-sm">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Version</span>
                        <span class="font-bold text-emerald-600 dark:text-emerald-400 text-base"><?= $php_version ?></span>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Memory Limit</span>
                        <span class="font-mono"><?= $memory_limit ?></span>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Upload Max Size</span>
                        <span class="font-mono"><?= $upload_max_filesize ?></span>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">Max Execution</span>
                        <span class="font-mono"><?= $max_execution_time ?>s</span>
                    </div>
                </div>
            </div>

            <!-- KARTU DATABASE & EKSTENSI -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-500 text-[28px]" style="font-variation-settings: 'FILL' 0">database</span>
                    <h2 class="text-lg font-semibold">Modules & DB</h2>
                </div>
                
                <div class="flex flex-col gap-3 text-sm">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">MySQL (PDO)</span>
                        <?= $has_pdo_mysql ? '<span class="text-emerald-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Active</span>' : '<span class="text-slate-400">Disabled</span>' ?>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">PostgreSQL (PDO)</span>
                        <?= $has_pdo_pgsql ? '<span class="text-emerald-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Active</span>' : '<span class="text-slate-400">Disabled</span>' ?>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">SQLite3</span>
                        <?= $has_sqlite3 ? '<span class="text-emerald-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Active</span>' : '<span class="text-slate-400">Disabled</span>' ?>
                    </div>
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span class="text-slate-500">cURL & MBString</span>
                        <?= ($has_curl && $has_mbstring) ? '<span class="text-emerald-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Active</span>' : '<span class="text-amber-500">Partial/Disabled</span>' ?>
                    </div>
                </div>
            </div>

        </div>
        
        <div class="text-center text-xs text-slate-500 dark:text-slate-500 mt-4">
            VyloServe Local Development Environment &copy; <?= date('Y') ?>
        </div>
    </div>

</body>
</html>""")

        # 2. Auto-generate phpinfo.php
        phpinfo_path = os.path.join(www_dir, 'phpinfo.php')
        if not os.path.exists(phpinfo_path):
            with open(phpinfo_path, 'w', encoding='utf-8') as f:
                f.write("<?php\nphpinfo();\n?>")
                
        # Kembalikan path dengan format yang dimengerti Apache (forward slash)
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
                f.write("# --- Konfigurasi Default Global PHP VyloServe ---\n")
                f.write(f"# Auto-Generated: Mengarahkan localhost ke PHP Port {port}\n\n")
                
                f.write(f"<VirtualHost *:80>\n")
                f.write(f"    ServerName localhost\n")
                f.write(f"    DocumentRoot \"{www_dir}\"\n")
                f.write(f"    <Directory \"{www_dir}\">\n")
                f.write(f"        DirectoryIndex index.php index.html\n")
                f.write(f"        Options Indexes FollowSymLinks ExecCGI\n")
                f.write(f"        AllowOverride All\n")
                f.write(f"        Require all granted\n")
                f.write(f"    </Directory>\n")
                f.write(fcgi_block + "\n")
                f.write(f"</VirtualHost>\n\n")

                if hasattr(self.api, 'ssl'):
                    try:
                        local_crt, local_key = self.api.ssl.generate_domain_cert("localhost")
                        crt_safe = local_crt.replace('\\', '/')
                        key_safe = local_key.replace('\\', '/')
                        
                        f.write(f"<VirtualHost *:443>\n")
                        f.write(f"    ServerName localhost\n")
                        f.write(f"    DocumentRoot \"{www_dir}\"\n")
                        f.write(f"    SSLEngine on\n")
                        f.write(f"    SSLCertificateFile \"{crt_safe}\"\n")
                        f.write(f"    SSLCertificateKeyFile \"{key_safe}\"\n")
                        f.write(f"    <Directory \"{www_dir}\">\n")
                        f.write(f"        DirectoryIndex index.php index.html\n")
                        f.write(f"        Options Indexes FollowSymLinks ExecCGI\n")
                        f.write(f"        AllowOverride All\n")
                        f.write(f"        Require all granted\n")
                        f.write(f"    </Directory>\n")
                        f.write(fcgi_block + "\n")
                        f.write(f"</VirtualHost>\n")
                    except Exception as e:
                        if hasattr(self, 'api'):
                            self.api.emit_log(f"Melewati SSL Localhost: {e}", "warn")
                
            if restart and self.check_is_running():
                self.restart_server()
                
            return {"status": "success", "message": f"Proxy global diupdate ke port {port}"}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def get_available_versions(self):
        versions = []
        try:
            if sys.platform == 'win32':
                url = "https://www.apachelounge.com/download/"
                headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': '*/*'}
                req = urllib.request.Request(url, headers=headers)
                
                try:
                    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                    matches = re.findall(r'href="([^"]*httpd-2\.4\.(\d+)[^"]*win64[^"]*\.zip)"', html, re.IGNORECASE)
                    
                    for match in matches:
                        full_path, minor_ver = match[0], match[1]
                        version_name = f"2.4.{minor_ver}"
                        download_url = full_path if full_path.startswith("http") else (f"https://www.apachelounge.com{full_path}" if full_path.startswith("/") else f"https://www.apachelounge.com/download/{full_path}")
                        
                        if not any(v['version'] == version_name for v in versions):
                            versions.append({"version": version_name, "filename": download_url.split('/')[-1], "url": download_url})
                            
                    versions.sort(key=lambda x: int(x['version'].split('.')[2]), reverse=True)

                except Exception:
                    pass
                
                if len(versions) == 0:
                    versions = [{"version": "2.4.68", "filename": "httpd-2.4.68-260617-Win64-VS18.zip", "url": "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip"}]
            return {"status": "success", "data": versions}
        except Exception as e:
            return {"status": "error", "message": f"Terjadi kesalahan: {str(e)}"}

    def install_version(self, version: str, download_url: str, http_port: int, https_port: int):
        if hasattr(self, 'api'):
            self.api.emit_log(f"Memulai pengunduhan Apache versi {version}...", "info")
        target_dir = os.path.join(self.base_dir, version)
        zip_path = os.path.join(self.base_dir, f"apache-{version}.zip")
        
        if os.path.exists(target_dir):
            return {"status": "error", "message": f"Apache {version} sudah terinstal."}

        try:
            if hasattr(self, 'api'):
                self.api.emit_progress(10, "Menghubungkan ke server unduhan...")
            
            headers = {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.apachelounge.com/download/',
                'Accept': 'application/zip, application/octet-stream, */*'
            }
            req = urllib.request.Request(download_url, headers=headers)
            
            with urllib.request.urlopen(req, timeout=30) as response, open(zip_path, 'wb') as out_file:
                total_size = int(response.getheader('Content-Length', 0))
                block_size, count = 8192, 0
                while True:
                    buffer = response.read(block_size)
                    if not buffer: break
                    out_file.write(buffer)
                    count += 1
                    if total_size > 0 and hasattr(self, 'api'):
                        percent = int((count * block_size) * 100 / total_size)
                        if percent > 100: percent = 100
                        self.api.emit_progress(10 + int(percent * 0.55), f"Mengunduh... {percent}%")
            
            if hasattr(self, 'api'):
                self.api.emit_log(f"Mengekstrak file ke {target_dir}...", "info")
                self.api.emit_progress(65, "Mengekstrak file binary...")
                
            temp_extract_dir = os.path.join(self.base_dir, f"temp_{version}")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_extract_dir)
                
            if os.path.exists(zip_path): os.remove(zip_path)
                
            if hasattr(self, 'api'):
                self.api.emit_progress(80, "Menyesuaikan struktur direktori...")
                
            extracted_apache24 = os.path.join(temp_extract_dir, 'Apache24')
            move_success = False
            for _ in range(5):
                try:
                    if os.path.exists(extracted_apache24):
                        shutil.move(extracted_apache24, target_dir)
                    else:
                        shutil.move(temp_extract_dir, target_dir)
                    move_success = True
                    break
                except Exception:
                    time.sleep(2)
            
            if not move_success: raise Exception("Folder dikunci oleh Antivirus.")
            if os.path.exists(temp_extract_dir): shutil.rmtree(temp_extract_dir, ignore_errors=True)

            if hasattr(self, 'api'):
                self.api.emit_progress(80, "Mengatur konfigurasi HTTP...")
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
            if os.path.exists(target_dir): shutil.rmtree(target_dir, ignore_errors=True)
            if 'temp_extract_dir' in locals() and os.path.exists(temp_extract_dir):
                shutil.rmtree(temp_extract_dir, ignore_errors=True)
            return {"status": "error", "message": f"Gagal menginstal: {str(e)}"}

        
    def uninstall(self):
        try:
            if os.path.exists(self.base_dir):
                for item in os.listdir(self.base_dir):
                    item_path = os.path.join(self.base_dir, item)
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path, ignore_errors=True)
                    else:
                        os.remove(item_path)
            if hasattr(self, 'api'):
                self.api.emit_log("Apache berhasil di-uninstall.", "success")
            return {"status": "success", "message": "Apache berhasil dihapus dari sistem."}
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal menghapus Apache: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menghapus Apache: {str(e)}"}

    def open_directory(self):
        try:
            status = self.get_status()
            target_path = status.get("path") if status.get("installed") else self.base_dir
            if not os.path.exists(target_path): os.makedirs(target_path)
            if sys.platform == 'win32': os.startfile(target_path)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target_path])
            else: subprocess.Popen(['xdg-open', target_path])
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": f"Gagal membuka folder: {str(e)}"}
            
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
            return {"status": "error", "message": "File httpd.conf tidak ditemukan."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal membuka konfigurasi: {str(e)}"}

    def open_apache_file(self, file_type):
        try:
            status = self.get_status()
            if not status.get("installed"):
                return {"status": "error", "message": "Apache tidak terinstal."}
            base_path = status.get("path")
            paths = {
                'httpd': os.path.join(base_path, 'conf', 'httpd.conf'),
                'vhosts': os.path.join(base_path, 'conf', 'extra', 'vyloserve-vhosts.conf'),
                'error': os.path.join(base_path, 'logs', 'error.log')
            }
            target = paths.get(file_type)
            if not target: return {"status": "error", "message": "Tipe shortcut tidak valid."}
            
            if file_type == 'error' and not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True)
                open(target, 'w').close()
                
            if not os.path.exists(target):
                return {"status": "error", "message": f"File tidak ditemukan: {os.path.basename(target)}"}

            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def start_server(self):
        if hasattr(self, 'api'):
            self.api.emit_log("Menghidupkan Apache server...", "info")
        if self.check_is_running(): return {"status": "error", "message": "Apache server sudah berjalan."}
            
        status = self.get_status()
        if not status.get("installed"): return {"status": "error", "message": "Apache tidak terinstal."}
            
        self._verify_and_patch_httpd()
        if hasattr(self.api, 'project'): self.api.project.sync_apache_vhosts()
            
        httpd_exe = os.path.join(status["path"], "bin", "httpd.exe")
        try:
            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            proc = subprocess.Popen([httpd_exe], creationflags=flags, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            time.sleep(1)
            
            if proc.poll() is not None:
                error_output = proc.stderr.read().decode('utf-8', errors='ignore').strip()
                if not error_output: error_output = "Port 80/443 mungkin sedang digunakan aplikasi lain."
                return {"status": "error", "message": f"Server gagal dimulai: {error_output}"}
                
            if hasattr(self, 'api'):
                self.api.emit_log(f"Server Apache berjalan dengan PID {proc.pid}.", "success")
            return {"status": "success", "message": "Apache Web Server berhasil dijalankan."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal eksekusi: {str(e)}"}
            
    def stop_server(self):
        try:
            if hasattr(self, 'api'):
                self.api.emit_log("Mengirim sinyal terminasi ke Apache...", "warn")
            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            if sys.platform == 'win32':
                subprocess.run(['taskkill', '/F', '/T', '/IM', 'httpd.exe'], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.run(['pkill', '-f', 'httpd'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
            if hasattr(self, 'api'):
                self.api.emit_log("Server Apache berhasil dihentikan.", "success")
            return {"status": "success", "message": "Apache Web Server berhasil dihentikan."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal menghentikan server: {str(e)}"}
        
    def restart_server(self):
        try:
            if self.check_is_running():
                self.stop_server()
                time.sleep(1)
            return self.start_server()
        except Exception as e:
            return {"status": "error", "message": f"Gagal melakukan restart: {str(e)}"}