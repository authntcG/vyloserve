import os
import sys
import urllib.request
import re
import zipfile
import shutil
import traceback
import subprocess
import time

class ApacheManager:
    def __init__(self, api_ref):
        self.api = api_ref
        # Setup base directory: /bin/apache
        self.base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'bin', 'apache')
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            
    def _verify_and_patch_httpd(self):
        """Pre-flight Check: Memaksa konfigurasi httpd.conf menjadi sempurna sebelum Apache menyala"""
        import os
        import re
        try:
            status = self.get_status()
            if not status.get("installed"): return
            
            apache_dir = status["path"]
            conf_path = os.path.join(apache_dir, "conf", "httpd.conf")
            if not os.path.exists(conf_path): return
            
            with open(conf_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            modified = False
            
            # 1. Paksa Modul Krusial & SSL Aktif
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

            # 2. Injeksi Port HTTPS (443) dengan Regex Super Aman (Mencegah Bug IP)
            if "\nListen 443" not in content:
                pattern = re.compile(r"^([ \t]*Listen[ \t]+\d+)$", re.MULTILINE)
                if pattern.search(content):
                    content = pattern.sub(r"\1\nListen 443", content, count=1)
                    modified = True
                else:
                    content += "\nListen 443\n"
                    modified = True
                    
            # 3. UBAH INCLUDE LAMA MENJADI INCLUDE-OPTIONAL
            if "Include conf/extra/httpd-vyloserve-php.conf" in content:
                content = content.replace("Include conf/extra/httpd-vyloserve-php.conf", "IncludeOptional conf/extra/httpd-vyloserve-php.conf")
                modified = True
            if "Include conf/extra/vyloserve-vhosts.conf" in content:
                content = content.replace("Include conf/extra/vyloserve-vhosts.conf", "IncludeOptional conf/extra/vyloserve-vhosts.conf")
                modified = True
                
            # 4. SUNTIKKAN INCLUDE JIKA BELUM ADA
            if "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
                content += "\n\n# --- VyloServe Global PHP Proxy ---\nIncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
                modified = True
            if "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
                content += "\n# --- VyloServe Virtual Hosts ---\nIncludeOptional conf/extra/vyloserve-vhosts.conf\n"
                modified = True

            # 5. PERBAIKAN "INDEX OF /": Paksa index.php terbaca pertama secara global
            if "DirectoryIndex index.php" not in content:
                content = re.sub(r'DirectoryIndex\s+index\.html', 'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE)
                modified = True
                
            # 6. PERBAIKAN AH00558: Tetapkan ServerName localhost untuk membungkam warning log
            if "\nServerName localhost" not in content and "\nServerName 127.0.0.1" not in content:
                content += "\n\n# VyloServe: Suppress AH00558 Warning\nServerName localhost\n"
                modified = True
                
            # 7. MEMBERIKAN IZIN AKAR DRIVE (Membunuh 403 Forbidden)
            content = re.sub(r'# VyloServe: Relax permissions.*?</Directory>', '', content, flags=re.DOTALL)
            relax_sec = "\n# VyloServe: Relax permissions for local dev\n<Directory />\n    AllowOverride All\n    Require all granted\n</Directory>\n"
            if relax_sec not in content:
                content += relax_sec
                modified = True
                
            if modified:
                with open(conf_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            # 8. AUTO-CREATE MISSING FILES! 
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
            self.api.emit_log(f"Pre-flight Check gagal: {str(e)}", "error")
            
    def _configure_httpd(self, target_dir, port):
        conf_path = os.path.join(target_dir, "conf", "httpd.conf")
        with open(conf_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Update SRVROOT & Port
        content = re.sub(r'Define\s+SRVROOT\s+"[^"]+"', f'Define SRVROOT "{target_dir.replace(chr(92), "/")}"', content, flags=re.IGNORECASE)
        content = re.sub(r'Listen\s+80', f'Listen {port}', content, flags=re.IGNORECASE)
        
        # PERBAIKAN AH00558: Hilangkan warning DNS server name dari log
        if "ServerName localhost" not in content:
            content = re.sub(r'#\s*ServerName\s+www\.example\.com:[0-9]+', f'ServerName localhost:{port}', content, flags=re.IGNORECASE)
            # Jika regex di atas gagal, suntikkan di bawah Listen
            if "ServerName localhost" not in content:
                content = re.sub(r'(Listen\s+[0-9]+)', f'\\1\nServerName localhost:{port}', content, flags=re.IGNORECASE)
        
        # Document Root Normal
        www_dir = self._ensure_default_htdocs()
        content = re.sub(r'DocumentRoot\s+"[^"]+htdocs"', f'DocumentRoot "{www_dir}"', content, flags=re.IGNORECASE)
        content = re.sub(r'<Directory\s+"[^"]+htdocs">', f'<Directory "{www_dir}">', content, flags=re.IGNORECASE)

        # Konfigurasi Standar lainnya
        content = re.sub(r'DirectoryIndex\s+index\.html', r'DirectoryIndex index.php index.html', content, flags=re.IGNORECASE)
        content = re.sub(r'Options\s+Indexes\s+FollowSymLinks', r'Options Indexes FollowSymLinks ExecCGI', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_module\s+modules/mod_proxy\.so', r'LoadModule proxy_module modules/mod_proxy.so', content, flags=re.IGNORECASE)
        content = re.sub(r'#\s*LoadModule\s+proxy_fcgi_module\s+modules/mod_proxy_fcgi\.so', r'LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so', content, flags=re.IGNORECASE)

        if "Include conf/extra/httpd-vyloserve-php.conf" not in content and "IncludeOptional conf/extra/httpd-vyloserve-php.conf" not in content:
            content += "\n\n# --- VyloServe Global PHP Proxy ---\n"
            content += "IncludeOptional conf/extra/httpd-vyloserve-php.conf\n"
            
        if "Include conf/extra/httpd-vhosts-vyloserve.conf" not in content and "IncludeOptional conf/extra/vyloserve-vhosts.conf" not in content:
            content += "\n# --- VyloServe Virtual Hosts ---\n"
            content += "IncludeOptional conf/extra/vyloserve-vhosts.conf\n"

        with open(conf_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        self.update_global_php_proxy(9000, restart=False)
            
    def _ensure_default_htdocs(self):
        """Memastikan folder www global dan file default selalu ada (Persisten)"""
        # Navigasi mundur ke root vyloserve: dari 'bin/apache' naik dua tingkat
        # Contoh hasil: D:/Project/Python/vyloserve/www
        root_dir = os.path.dirname(os.path.dirname(self.base_dir))
        www_dir = os.path.join(root_dir, 'www')
        
        # Buat folder jika belum ada
        os.makedirs(www_dir, exist_ok=True)
        
        # 1. Auto-generate index.php
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
        """Memperbarui routing localhost agar mengarah ke Port FastCGI PHP"""
        try:
            status = self.get_status()
            if not status.get("installed"): return {"status": "error", "message": "Apache belum terinstal"}
                
            php_conf_path = os.path.join(status["path"], "conf", "extra", "httpd-vyloserve-php.conf")
            os.makedirs(os.path.dirname(php_conf_path), exist_ok=True)
            
            www_dir = self._ensure_default_htdocs()
            
            # Eksekusi logika murni FastCGI yang stabil
            fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:{port}/"
    </FilesMatch>"""

            with open(php_conf_path, 'w', encoding='utf-8') as f:
                f.write("# --- Konfigurasi Default Global PHP VyloServe ---\n")
                f.write(f"# Auto-Generated: Mengarahkan localhost ke PHP Port {port}\n\n")
                
                # Blok HTTP
                f.write(f"DocumentRoot \"{www_dir}\"\n")
                f.write(f"<Directory \"{www_dir}\">\n")
                f.write("    DirectoryIndex index.php index.html\n")
                f.write("    Options Indexes FollowSymLinks ExecCGI\n")
                f.write("    AllowOverride All\n")
                f.write("    Require all granted\n")
                f.write("</Directory>\n")
                f.write(fcgi_block + "\n\n")

                # Blok HTTPS untuk Localhost
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
                        f.write(fcgi_block + "\n")
                        f.write(f"</VirtualHost>\n")
                    except Exception as e:
                        self.api.emit_log(f"Melewati SSL Localhost: {e}", "warn")
                
            if restart and self.check_is_running():
                self.restart_server()
                
            return {"status": "success", "message": f"Proxy global diupdate ke port {port}"}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def get_available_versions(self):
        """ Mengambil daftar rilis Apache dan mencetak detail error ke terminal """
        versions = []
        
        try:
            if sys.platform == 'win32':
                url = "https://www.apachelounge.com/download/"
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
                
                req = urllib.request.Request(url, headers=headers)
                
                try:
                    print(f"[VyloServe - Apache Scraper] Mencoba mengakses: {url}")
                    
                    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                    
                    # ---> REGEX DIPERBARUI <---
                    # Menggunakan [^"]* di antara (\d+) dan win64 untuk menangkap nomor build seperti "-260617-"
                    matches = re.findall(r'href="([^"]*httpd-2\.4\.(\d+)[^"]*win64[^"]*\.zip)"', html, re.IGNORECASE)
                    
                    print(f"[VyloServe - Apache Scraper] Berhasil mengambil HTML. Jumlah kecocokan Regex: {len(matches)}")
                    
                    for match in matches:
                        full_path = match[0]
                        minor_ver = match[1]
                        version_name = f"2.4.{minor_ver}"
                        
                        if full_path.startswith("http"):
                            download_url = full_path
                        elif full_path.startswith("/"):
                            download_url = f"https://www.apachelounge.com{full_path}"
                        else:
                            download_url = f"https://www.apachelounge.com/download/{full_path}"
                        
                        if not any(v['version'] == version_name for v in versions):
                            versions.append({
                                "version": version_name,
                                "filename": download_url.split('/')[-1],
                                "url": download_url
                            })
                            
                    versions = sorted(versions, key=lambda x: int(x['version'].split('.')[2]), reverse=True)

                except Exception as scrape_err:
                    print("\n" + "="*50)
                    print("[VyloServe - ERROR SCRAPING]")
                    print(f"Pesan Error Dasar : {str(scrape_err)}")
                    print("Detail Traceback  :")
                    traceback.print_exc()
                    print("="*50 + "\n")
                    
                    self.api.emit_log(f"Scraping gagal. Cek CMD untuk detail. Menggunakan data Fallback.", "warning")
                
                # --- SISTEM FALLBACK ---
                if len(versions) == 0:
                    print("[VyloServe - Apache Scraper] Menggunakan mode Fallback karena tidak ada versi yang ditemukan.")
                    versions = [
                        {
                            "version": "2.4.68",
                            "filename": "httpd-2.4.68-260617-Win64-VS18.zip",
                            "url": "https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip"
                        },
                        {
                            "version": "2.4.59",
                            "filename": "httpd-2.4.59-win64-VS17.zip",
                            "url": "https://www.apachelounge.com/download/VS17/binaries/httpd-2.4.59-win64-VS17.zip"
                        }
                    ]
                        
            elif sys.platform == 'darwin' or sys.platform.startswith('linux'):
                return {"status": "error", "message": "Untuk MacOS/Linux, gunakan Package Manager native (Brew/APT)."}
                
            return {"status": "success", "data": versions}
            
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Terjadi kesalahan: {str(e)}"}

    def install_version(self, version: str, download_url: str, http_port: int, https_port: int):
        """ Mengunduh, mengekstrak, dan mengatur Config Dasar Apache """
        self.api.emit_log(f"Memulai pengunduhan Apache versi {version}...", "info")
        target_dir = os.path.join(self.base_dir, version)
        zip_path = os.path.join(self.base_dir, f"apache-{version}.zip")
        
        # Cek jika sudah terinstal
        if os.path.exists(target_dir):
            return {"status": "error", "message": f"Apache {version} sudah terinstal."}

        # --- SISTEM ROLLBACK: Simpan state awal ---
        try:
            self.api.emit_log(f"Memulai instalasi Apache {version}...", "info")
            
            # 1. DOWNLOAD (Menggunakan Custom Stream agar bisa menyisipkan Headers Anti-Blokir)
            self.api.emit_progress(10, "Menghubungkan ke server unduhan...")
            
            # Menyamar sebagai browser yang mengklik link dari halaman ApacheLounge (Referer)
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.apachelounge.com/download/',
                'Accept': 'application/zip, application/octet-stream, */*'
            }
            
            req = urllib.request.Request(download_url, headers=headers)
            
            with urllib.request.urlopen(req, timeout=30) as response, open(zip_path, 'wb') as out_file:
                # Dapatkan total ukuran file untuk progress bar
                total_size = int(response.getheader('Content-Length', 0))
                block_size = 8192 # Download per 8KB
                count = 0
                
                while True:
                    buffer = response.read(block_size)
                    if not buffer:
                        break # File selesai diunduh
                        
                    out_file.write(buffer)
                    count += 1
                    
                    # Update Progress Bar secara realtime
                    if total_size > 0:
                        downloaded = count * block_size
                        percent = int(downloaded * 100 / total_size)
                        if percent > 100: 
                            percent = 100
                            
                        # Petakan 0-100% download asli ke 10-65% UI Progress Bar
                        ui_percent = 10 + int(percent * 0.55) 
                        self.api.emit_progress(ui_percent, f"Mengunduh... {percent}%")
            
            # 2. EKSTRAK ZIP
            self.api.emit_log(f"Mengekstrak file ke {target_dir}...", "info")
            self.api.emit_progress(65, "Mengekstrak file binary...")
            temp_extract_dir = os.path.join(self.base_dir, f"temp_{version}")
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_extract_dir)
                
            # Hapus file ZIP
            if os.path.exists(zip_path):
                os.remove(zip_path)
                
            # 3. RESTRUKTURISASI FOLDER
            self.api.emit_progress(80, "Menyesuaikan struktur direktori (Menunggu sistem)...")
            extracted_apache24 = os.path.join(temp_extract_dir, 'Apache24')
            
            # WORKAROUND WINDOWS DEFENDER: 
            # Memberi jeda dan mencoba beberapa kali jika folder sedang dikunci oleh Antivirus
            move_success = False
            last_error = None
            
            for attempt in range(5):
                try:
                    if os.path.exists(extracted_apache24):
                        # Menggunakan shutil.move karena lebih stabil lintas drive/folder dibanding os.rename
                        shutil.move(extracted_apache24, target_dir)
                    else:
                        shutil.move(temp_extract_dir, target_dir)
                        
                    move_success = True
                    break # Jika berhasil, keluar dari loop
                except Exception as e:
                    last_error = e
                    time.sleep(2) # Tunggu 2 detik sebelum mencoba lagi agar Antivirus selesai memindai
            
            if not move_success:
                raise Exception(f"Akses ditolak oleh sistem. Folder sedang dikunci oleh Antivirus atau program lain. Detail: {str(last_error)}")

            # Bersihkan folder temporary (jika masih tersisa)
            if os.path.exists(temp_extract_dir):
                shutil.rmtree(temp_extract_dir, ignore_errors=True)

            # 4. KONFIGURASI HTTPD.CONF
            self.api.emit_progress(80, "Mengatur konfigurasi HTTP & SRVROOT...")
            self._configure_httpd(target_dir, http_port)

            self.api.emit_progress(100, "Selesai!")
            self.api.emit_log(f"Apache {version} berhasil diinstal dan dikonfigurasi.", "success")
            
            return {"status": "success", "message": f"Apache {version} berhasil diinstal dan dikonfigurasi."}

        except Exception as e:
            # --- EXECUTE ROLLBACK ---
            self.api.emit_log(f"Error instalasi Apache: {str(e)}", "error")
            self.api.emit_progress(0, "Instalasi dibatalkan (Rollback).")
            
            if os.path.exists(zip_path):
                os.remove(zip_path)
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir, ignore_errors=True)
            if 'temp_extract_dir' in locals() and os.path.exists(temp_extract_dir):
                shutil.rmtree(temp_extract_dir, ignore_errors=True)
                
            return {"status": "error", "message": f"Gagal menginstal: {str(e)}"}
            
    def get_status(self):
        """Mengecek apakah Apache sudah terinstal dan mengambil versinya"""
        try:
            if not os.path.exists(self.base_dir):
                return {"status": "success", "installed": False, "version": None, "path": None}
            
            installed_version = None
            installed_path = None
            
            # Cari folder di dalam bin/apache yang bukan folder temporary
            for item in os.listdir(self.base_dir):
                item_path = os.path.join(self.base_dir, item)
                if os.path.isdir(item_path) and not item.startswith("temp_"):
                    installed_version = item
                    installed_path = item_path
                    break
                    
            if installed_version:
                return {
                    "status": "success", 
                    "installed": True, 
                    "version": installed_version, 
                    "path": installed_path
                }
            return {"status": "success", "installed": False, "version": None, "path": None}
                
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal mengecek status Apache: {str(e)}"}

    def uninstall(self):
        """Menghapus instalasi Apache sepenuhnya"""
        try:
            if os.path.exists(self.base_dir):
                for item in os.listdir(self.base_dir):
                    item_path = os.path.join(self.base_dir, item)
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path, ignore_errors=True)
                    else:
                        os.remove(item_path)
            
            self.api.emit_log("Apache berhasil di-uninstall.", "success")
            return {"status": "success", "message": "Apache berhasil dihapus dari sistem."}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menghapus Apache: {str(e)}"}

    def open_directory(self):
        """Membuka folder instalasi Apache di File Explorer OS"""
        try:
            status = self.get_status()
            target_path = status.get("path") if status.get("installed") else self.base_dir
            
            if not os.path.exists(target_path):
                os.makedirs(target_path)
                
            if sys.platform == 'win32':
                os.startfile(target_path)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', target_path])
            else:
                subprocess.Popen(['xdg-open', target_path])
                
            return {"status": "success"}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal membuka folder: {str(e)}"}
            
    def open_config(self):
        """Membuka file httpd.conf langsung di Text Editor bawaan OS"""
        try:
            status = self.get_status()
            if status.get("installed"):
                conf_path = os.path.join(status["path"], "conf", "httpd.conf")
                if os.path.exists(conf_path):
                    if sys.platform == 'win32':
                        os.startfile(conf_path)
                    elif sys.platform == 'darwin':
                        subprocess.Popen(['open', conf_path])
                    else:
                        subprocess.Popen(['xdg-open', conf_path])
                    return {"status": "success"}
            return {"status": "error", "message": "File httpd.conf tidak ditemukan."}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal membuka konfigurasi: {str(e)}"}
        
    def get_installed_versions(self):
        """Membaca direktori untuk mendapatkan list versi Apache yang sudah diinstal"""
        try:
            if not os.path.exists(self.base_dir):
                return {"status": "success", "data": [], "active": None}
                
            versions = []
            for item in os.listdir(self.base_dir):
                if os.path.isdir(os.path.join(self.base_dir, item)) and not item.startswith("temp_"):
                    versions.append(item)
            
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            data_dir = os.path.join(root_dir, 'data')
            
            # Pastikan folder data ada
            os.makedirs(data_dir, exist_ok=True)
            
            active_file = os.path.join(data_dir, "apache_active_version.txt")
            active = None
            
            if os.path.exists(active_file):
                with open(active_file, 'r') as f:
                    active = f.read().strip()
                    
            if active not in versions:
                active = None
                    
            if not active and versions:
                active = versions[0]

            return {"status": "success", "data": versions, "active": active}
            
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal membaca direktori: {str(e)}"}

    def set_active_version(self, version):
        """Menyimpan preferensi versi Apache yang aktif ke dalam folder data"""
        try:
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            data_dir = os.path.join(root_dir, 'data')
            
            # Pastikan folder data ada sebelum menulis
            os.makedirs(data_dir, exist_ok=True)
            
            active_file = os.path.join(data_dir, "apache_active_version.txt")
            
            with open(active_file, 'w') as f:
                f.write(version)
                
            if hasattr(self.api, 'project'):
                self.api.project.sync_apache_vhosts()
                
            if self.check_is_running():
                self.restart_server()
            
            return {"status": "success", "message": f"Versi aktif berhasil diubah ke Apache {version}"}
            
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menyimpan pengaturan: {str(e)}"}

    def open_apache_file(self, file_type):
        """Membuka file log/config Apache menggunakan Editor bawaan OS"""
        try:
            status = self.get_status()
            if not status.get("installed"):
                return {"status": "error", "message": "Apache tidak terinstal."}
            
            base_path = status.get("path")
            
            # Pemetaan target path berdasarkan tombol yang diklik
            paths = {
                'httpd': os.path.join(base_path, 'conf', 'httpd.conf'),
                'vhosts': os.path.join(base_path, 'conf', 'extra', 'httpd-vhosts.conf'),
                'error': os.path.join(base_path, 'logs', 'error.log'),
                'fcgi': os.path.join(base_path, 'conf', 'extra', 'httpd-fcgid.conf')
            }
            
            target = paths.get(file_type)
            if not target:
                return {"status": "error", "message": "Tipe shortcut tidak valid."}
                
            # Jika file log error belum tercipta (karena apache belum pernah run), buat file kosong
            if file_type == 'error' and not os.path.exists(target):
                os.makedirs(os.path.dirname(target), exist_ok=True)
                open(target, 'w').close()
                
            if not os.path.exists(target):
                return {"status": "error", "message": f"File tidak ditemukan: {os.path.basename(target)}"}

            # Buka di OS
            if sys.platform == 'win32':
                os.startfile(target)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', target])
            else:
                subprocess.Popen(['xdg-open', target])
                
            return {"status": "success"}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": str(e)}
            
    def check_is_running(self):
        """Mengecek apakah proses httpd.exe sedang berjalan di Background OS"""
        try:
            if sys.platform == 'win32':
                flags = subprocess.CREATE_NO_WINDOW
                # Menggunakan tasklist bawaan Windows untuk mencari proses httpd.exe
                output = subprocess.check_output('tasklist /FI "IMAGENAME eq httpd.exe"', shell=True, creationflags=flags).decode()
                return 'httpd.exe' in output
            else:
                output = subprocess.check_output(['pgrep', 'httpd']).decode()
                return len(output.strip()) > 0
        except Exception:
            return False

    def get_status(self):
        """Mengecek apakah Apache sudah terinstal, versinya, dan status running"""
        try:
            # Pengecekan Running terpusat
            is_running = self.check_is_running()
            
            if not os.path.exists(self.base_dir):
                return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
            
            installed_version = None
            installed_path = None
            
            for item in os.listdir(self.base_dir):
                item_path = os.path.join(self.base_dir, item)
                if os.path.isdir(item_path) and not item.startswith("temp_"):
                    installed_version = item
                    installed_path = item_path
                    break
                    
            if installed_version:
                return {
                    "status": "success", 
                    "installed": True, 
                    "version": installed_version, 
                    "path": installed_path,
                    "running": is_running # <--- Tambahkan properti ini
                }
            return {"status": "success", "installed": False, "version": None, "path": None, "running": is_running}
                
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal mengecek status Apache: {str(e)}"}

    def start_server(self):
        """Menjalankan Apache (httpd.exe)"""
        self.api.emit_log("Menghidupkan Apache server...", "info")
        if self.check_is_running():
            return {"status": "error", "message": "Apache server sudah berjalan."}
            
        status = self.get_status()
        if not status.get("installed"):
            return {"status": "error", "message": "Apache tidak terinstal."}
            
        # =======================================================
        # EKSEKUSI PRE-FLIGHT CHECK SEBELUM SERVER MENYALA
        # =======================================================
        self._verify_and_patch_httpd()
        
        # Panggil ulang Vhost sync agar file vhosts.conf dijamin ada
        if hasattr(self.api, 'project'):
            self.api.project.sync_apache_vhosts()
            
        httpd_exe = os.path.join(status["path"], "bin", "httpd.exe")
        
        try:
            import subprocess
            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            proc = subprocess.Popen([httpd_exe], creationflags=flags, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            import time
            time.sleep(1)
            
            if proc.poll() is not None:
                error_output = proc.stderr.read().decode('utf-8', errors='ignore').strip()
                if not error_output:
                    error_output = "Port 80 kemungkinan sedang digunakan oleh aplikasi lain (Skype, IIS, dll)."
                return {"status": "error", "message": f"Server gagal dimulai: {error_output}"}
                
            self.api.emit_log(f"Server Apache berhasil berjalan dengan PID {proc.pid}.", "success")
            return {"status": "success", "message": "Apache Web Server berhasil dijalankan."}
            
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal eksekusi: {str(e)}"}
            
    def stop_server(self):
        """Mematikan seluruh proses Apache dengan aman"""
        try:
            self.api.emit_log("Mengirim sinyal terminasi ke Apache...", "warn")
            flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            if sys.platform == 'win32':
                # Membunuh httpd.exe beserta proses anaknya (/T) secara paksa (/F)
                subprocess.run(['taskkill', '/F', '/T', '/IM', 'httpd.exe'], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.run(['pkill', '-f', 'httpd'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
            self.api.emit_log("Server Apache berhasil dihentikan.", "success")
            return {"status": "success", "message": "Apache Web Server berhasil dihentikan."}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menghentikan server: {str(e)}"}
        
    def restart_server(self):
        """Mematikan dan menghidupkan kembali Apache secara otomatis (Graceful Restart)"""
        try:
            if self.check_is_running():
                # Matikan server terlebih dahulu
                self.stop_server()
                
                # Jeda 1 detik agar port 80 benar-benar dilepas oleh sistem OS
                import time
                time.sleep(1)
            
            # Hidupkan kembali (Ini akan memicu _sync_php_binding secara otomatis!)
            return self.start_server()
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal melakukan restart: {str(e)}"}