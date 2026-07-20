import os
import sys
import urllib.request
import re
import zipfile
import tarfile
import shutil
import subprocess
import time

class PhpManager:
    # Tangkap api_ref untuk menembakkan log/progress
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'bin', 'php')
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
            
        self.processes = {}
            
    def get_installed_instances(self):
        instances = []
        if not os.path.exists(self.base_dir):
            return instances
            
        folders = [f for f in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, f))]
        folders = sorted(folders, key=lambda v: [int(x) if x.isdigit() else 0 for x in v.split('.')], reverse=True)
        
        for version in folders:
            target_dir = os.path.join(self.base_dir, version)
            php_ini_path = os.path.join(target_dir, 'php.ini')
            
            port = 9000
            memory_limit = "Unknown"
            
            if os.path.exists(php_ini_path):
                with open(php_ini_path, 'r') as f:
                    for line in f:
                        if line.startswith('memory_limit'):
                            memory_limit = line.split('=')[1].strip()
                        elif 'vyloserve_port' in line:
                            try:
                                port = int(line.split('=')[1].strip())
                            except:
                                pass
            
            # --- CEK STATUS PROSES SECARA DINAMIS ---
            status = "stopped"
            if version in self.processes:
                # poll() bernilai None berarti proses masih hidup (berjalan)
                if self.processes[version].poll() is None:
                    status = "running"
                else:
                    # Hapus dari memori jika proses ternyata sudah mati secara background
                    del self.processes[version]
            # ------------------------------------------

            instances.append({
                "id": f"php_{version.replace('.', '_')}",
                "name": f"PHP {version}",
                "version": version,
                "port": port,
                "status": status, 
                "dir": target_dir,
                "memory_limit": memory_limit
            })
            
        return instances

    def get_versions(self):
        try:
            import urllib.error
            import ssl
            
            # Abaikan SSL untuk mencegah error koneksi di Windows lokal
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            if sys.platform == 'win32':
                urls = [
                    "https://windows.php.net/downloads/releases/",
                    "https://windows.php.net/downloads/releases/archives/"
                ]
                # Regex aman untuk menangkap (php-X.X.X-Win32-XXXX-x64.zip)
                pattern = r'(php-(\d+\.\d+\.\d+)-Win32-[a-zA-Z0-9]+-x64\.zip)'
            else:
                urls = ["https://www.php.net/distributions/"]
                pattern = r'(php-(\d+\.\d+\.\d+)\.tar\.gz)'
            
            matches = []
            for url in urls:
                try:
                    # Tambahkan timeout agar aplikasi tidak freeze jika server PHP lambat
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    html = urllib.request.urlopen(req, context=ctx, timeout=10).read().decode('utf-8')
                    matches.extend(re.findall(pattern, html))
                except Exception as e:
                    self.api.emit_log(f"Gagal mengambil dari {url}: {str(e)}", "warn")
            
            version_map = {}
            for filename, version in matches:
                # Prioritaskan versi Thread Safe (TS) - Hindari Non-Thread Safe (nts) atau QA/Pack
                if 'nts' not in filename.lower() and '-pack' not in filename.lower() and 'qa' not in filename.lower():
                    version_map[version] = filename
                    
            if not version_map:
                return {"status": "error", "message": "Gagal menemukan daftar rilis PHP dari server resmi."}

            # 1. URUTKAN MATEMATIS: Memastikan 8.12.0 dibaca lebih tinggi dari 8.2.0
            sorted_versions = sorted(version_map.keys(), key=lambda v: [int(x) for x in v.split('.')], reverse=True)
            
            # 2. FILTERING PATCH TERBARU PER CABANG MINOR
            latest_minors = {}
            for v in sorted_versions:
                parts = v.split('.')
                if len(parts) >= 2:
                    major = int(parts[0])
                    minor = int(parts[1])
                    
                    major_minor = f"{major}.{minor}"
                        
                    # Karena sudah diurutkan dari yang terbaru (reverse=True),
                    # versi PERTAMA yang masuk ke dict ini pasti Patch tertinggi dari cabang tersebut
                    if major_minor not in latest_minors:
                        latest_minors[major_minor] = v

            # 3. VERIFIKASI FOLDER LOKAL (Sembunyikan yang sudah diinstal)
            result = []
            for major_minor, v in latest_minors.items():
                target_dir = os.path.join(self.base_dir, v)
                
                # Jika folder belum ada, masukkan ke dalam opsi dropdown
                if not os.path.exists(target_dir):
                    result.append({"version": v, "filename": version_map[v]})
                    
            # Jika semua versi terbaru sudah diinstal
            if not result:
                return {"status": "success", "data": [], "message": "Semua versi PHP terbaru sudah terinstal."}

            self.api.emit_log(f"Berhasil memuat {len(result)} cabang rilis stabil PHP.", "success")
            return {"status": "success", "data": result}
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.api.emit_log(f"Error parsing list versi PHP: {str(e)}", "error")
            return {"status": "error", "message": str(e)}
    
    def install_version(self, version: str, filename: str, port: int):
        target_dir = os.path.join(self.base_dir, version)
        file_path = os.path.join(self.base_dir, filename)

        try:
            if os.path.exists(target_dir):
                self.api.emit_log(f"Instalasi dibatalkan: PHP {version} sudah ada.", "warn")
                return {"status": "error", "message": f"PHP {version} sudah terinstal di sistem!"}
            
            # Buat folder target
            os.makedirs(target_dir)
            
            if sys.platform == 'win32':
                download_url = f"https://windows.php.net/downloads/releases/{filename}"
            else:
                download_url = f"https://www.php.net/distributions/{filename}"
            
            self.api.emit_log(f"Memulai unduhan PHP {version}...", "info")
            
            last_percent = -1
            def reporthook(block_num, block_size, total_size):
                nonlocal last_percent
                if total_size > 0:
                    percent = int((block_num * block_size * 100) / total_size)
                    if percent != last_percent and percent <= 100:
                        self.api.emit_progress(percent, f"Downloading: {percent}%")
                        last_percent = percent

            # --- 2. TRY-EXCEPT DOWNLOAD DENGAN FALLBACK DAN CLEANUP ---
            try:
                import urllib.error
                try:
                    # Percobaan pertama ke direktori utama releases
                    urllib.request.urlretrieve(download_url, file_path, reporthook)
                except urllib.error.HTTPError as http_err:
                    # Jika 404, file mungkin sudah dipindah ke archives
                    if http_err.code == 404 and sys.platform == 'win32':
                        self.api.emit_log("File tidak ditemukan, mengalihkan pencarian ke folder archives...", "warn")
                        download_url = f"https://windows.php.net/downloads/releases/archives/{filename}"
                        urllib.request.urlretrieve(download_url, file_path, reporthook)
                    else:
                        raise http_err

                self.api.emit_log("Unduhan selesai. Memulai proses ekstraksi...", "info")
                self.api.emit_progress(100, "Extracting files...")
                
                if filename.endswith('.zip'):
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(target_dir)
                elif filename.endswith('.tar.gz'):
                    with tarfile.open(file_path, 'r:gz') as tar_ref:
                        tar_ref.extractall(target_dir)
                
                # Ekstraksi sukses, hapus file mentah .zip/.tar.gz
                if os.path.exists(file_path):
                    os.remove(file_path)

            except Exception as dl_err:
                raise Exception(f"Proses unduh/ekstrak gagal: {str(dl_err)}")
            
            # --- 3. KONFIGURASI ---
            self.api.emit_log("Ekstraksi selesai. Mengonfigurasi php.ini...", "info")
            self.api.emit_progress(100, "Configuring...")
            
            php_ini_path = os.path.join(target_dir, 'php.ini')
            with open(php_ini_path, 'w') as f:
                f.write(f"; VyloServe PHP {version} Configuration\n")
                
                # --- TAMBAHKAN BARIS INI UNTUK METADATA ---
                f.write(f"; vyloserve_port = {port}\n") 
                # ------------------------------------------
                
                f.write("memory_limit = 512M\n")
                f.write(f"fastcgi.logging = 0\n")
                if sys.platform == 'win32':
                    f.write("extension_dir = \"ext\"\n")
                    f.write("extension=curl\n")
                    f.write("extension=mbstring\n")
            
            self.api.emit_log(f"Selesai! PHP {version} siap digunakan pada port {port}.", "success")
            self.api.emit_progress(100, "Installation Complete!")
            
            return {"status": "success", "message": f"PHP {version} berhasil diunduh dan diekstrak."}
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            
            # --- 4. CLEANUP SAAT TERJADI ERROR ---
            self.api.emit_log("Membatalkan instalasi dan membersihkan folder...", "warn")
            
            # Hapus zip sisa (jika ada)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
                    
            # Hapus paksa folder target beserta isinya menggunakan shutil
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir, ignore_errors=True)
            
            self.api.emit_progress(0, "Installation Failed")
            self.api.emit_log(f"Error instalasi: {str(e)}", "error")
            return {"status": "error", "message": str(e)}
    
    def get_config(self, version: str):
        """ Membaca nilai dari php.ini dan memindai ketersediaan module (.dll/.so) """
        target_dir = os.path.join(self.base_dir, version)
        php_ini_path = os.path.join(target_dir, 'php.ini')
        ext_dir = os.path.join(target_dir, 'ext')

        config = {
            "port": 9000,
            "memory_limit": "512M",
            "max_execution_time": "120",
            "upload_max_filesize": "64M",
            "post_max_size": "64M"
        }
        active_exts = set()

        # 1. BACA FILE PHP.INI
        if os.path.exists(php_ini_path):
            with open(php_ini_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Parsing config utama
                    if line.startswith('; vyloserve_port'):
                        config['port'] = int(line.split('=')[1].strip())
                    elif line.startswith('memory_limit'):
                        config['memory_limit'] = line.split('=')[1].strip()
                    elif line.startswith('max_execution_time'):
                        config['max_execution_time'] = line.split('=')[1].strip()
                    elif line.startswith('upload_max_filesize'):
                        config['upload_max_filesize'] = line.split('=')[1].strip()
                    elif line.startswith('post_max_size'):
                        config['post_max_size'] = line.split('=')[1].strip()
                    # Parsing extension yang sedang aktif
                    elif line.startswith('extension=') and not line.startswith(';'):
                        ext_name = line.split('=')[1].strip().strip('"\'')
                        active_exts.add(ext_name)

        # 2. PINDAI FOLDER EXTENSION (Mencari php_*.dll di Windows)
        available_exts = []
        if os.path.exists(ext_dir):
            for file in os.listdir(ext_dir):
                if file.startswith('php_') and file.endswith('.dll'):
                    ext_name = file[4:-4] # Hilangkan 'php_' dan '.dll'
                    available_exts.append({
                        "name": ext_name,
                        "active": ext_name in active_exts
                    })
                    
        # Tambahkan extension bawaan yang aktif tapi mungkin tidak ada file fisiknya
        for ext in active_exts:
            if not any(e['name'] == ext for e in available_exts):
                available_exts.append({"name": ext, "active": True})

        # Urutkan secara alfabetis
        available_exts.sort(key=lambda x: x['name'])
        
        return {"status": "success", "config": config, "extensions": available_exts}

    def save_config(self, version: str, new_config: dict, active_extensions: list):
        """ Menyimpan perubahan kembali ke php.ini secara aman """
        target_dir = os.path.join(self.base_dir, version)
        php_ini_path = os.path.join(target_dir, 'php.ini')

        if not os.path.exists(php_ini_path):
            return {"status": "error", "message": "File php.ini tidak ditemukan!"}

        with open(php_ini_path, 'r') as f:
            lines = f.readlines()

        new_lines = []
        config_keys = ['memory_limit', 'max_execution_time', 'upload_max_filesize', 'post_max_size']
        found_keys = set()
        
        # 1. TULIS ULANG BARIS YANG ADA (REPLACE)
        for line in lines:
            stripped = line.strip()
            
            if stripped.startswith('; vyloserve_port'):
                new_lines.append(f"; vyloserve_port = {new_config.get('port', 9000)}\n")
                continue
                
            # Hapus semua pemanggilan extension yang lama, karena akan kita tulis ulang di bawah
            if stripped.startswith('extension=') or stripped.startswith(';extension='):
                continue
                
            updated = False
            for key in config_keys:
                if stripped.startswith(key) and not stripped.startswith(';'):
                    new_lines.append(f"{key} = {new_config.get(key, '')}\n")
                    found_keys.add(key)
                    updated = True
                    break
            
            if not updated:
                new_lines.append(line)
                
        # 2. TAMBAHKAN CONFIG YANG SEBELUMNYA TIDAK ADA DI FILE
        for key in config_keys:
            if key not in found_keys and key in new_config:
                new_lines.append(f"{key} = {new_config[key]}\n")
                
        if not any('extension_dir' in l for l in new_lines) and sys.platform == 'win32':
            new_lines.append('extension_dir = "ext"\n')

        # 3. TULIS ULANG DAFTAR EXTENSION
        new_lines.append("\n; --- VyloServe Managed Extensions ---\n")
        for ext in active_extensions:
            new_lines.append(f"extension={ext}\n")

        with open(php_ini_path, 'w') as f:
            f.writelines(new_lines)
            
        self.api.emit_log(f"Konfigurasi PHP {version} berhasil diperbarui.", "success")
        return {"status": "success", "message": "Konfigurasi dan Extensions berhasil disimpan!"}
    
    def open_path(self, version: str, is_file: bool = False):
        """ Membuka folder atau file php.ini menggunakan aplikasi bawaan OS """
        target_dir = os.path.join(self.base_dir, version)
        target_path = os.path.join(target_dir, 'php.ini') if is_file else target_dir

        if not os.path.exists(target_path):
            return {"status": "error", "message": "File atau direktori tidak ditemukan!"}

        try:
            if sys.platform == 'win32':
                os.startfile(target_path)
            elif sys.platform == 'darwin': # Mac OS
                subprocess.Popen(['open', target_path])
            else: # Linux
                subprocess.Popen(['xdg-open', target_path])
                
            return {"status": "success", "message": "Berhasil dibuka."}
        except Exception as e:
            self.api.emit_log(f"Terjadi kesalahan fatal: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def uninstall_version(self, version: str):
        """ Menghapus instalasi PHP secara permanen """
        target_dir = os.path.join(self.base_dir, version)
        
        try:
            if os.path.exists(target_dir):
                # Hapus folder beserta seluruh isinya
                shutil.rmtree(target_dir, ignore_errors=True)
                
                self.api.emit_log(f"PHP {version} beserta konfigurasinya berhasil dihapus.", "success")
                return {"status": "success", "message": f"PHP {version} berhasil di-uninstall."}
            else:
                return {"status": "error", "message": "Instalasi PHP tidak ditemukan."}
        except Exception as e:
            self.api.emit_log(f"Gagal menghapus PHP {version}: {str(e)}", "error")
            return {"status": "error", "message": str(e)}
        
    def start_php(self, version: str):
        if version in self.processes and self.processes[version].poll() is None:
            return {"status": "error", "message": f"PHP {version} sudah berjalan!"}
            
        target_dir = os.path.join(self.base_dir, version)
        # Windows menggunakan .exe, Mac/Linux tanpa ekstensi
        php_cgi = "php-cgi.exe" if sys.platform == 'win32' else "php-cgi"
        exe_path = os.path.join(target_dir, php_cgi)
        
        if not os.path.exists(exe_path):
            return {"status": "error", "message": f"File binary {php_cgi} tidak ditemukan."}

        # Cari tahu port dari php.ini (untuk argumen start)
        port = 9000
        php_ini_path = os.path.join(target_dir, 'php.ini')
        if os.path.exists(php_ini_path):
            with open(php_ini_path, 'r') as f:
                for line in f:
                    if 'vyloserve_port' in line:
                        try:
                            port = int(line.split('=')[1].strip())
                        except: pass

        # Perintah eksekusi: php-cgi -b 127.0.0.1:PORT -c php.ini
        cmd = [exe_path, "-b", f"127.0.0.1:{port}", "-c", php_ini_path]
        
        # ---> PERBAIKAN: SIAPKAN ENVIRONMENT KHUSUS UNTUK PHP <---
        php_env = os.environ.copy()
        php_env['REDIRECT_STATUS'] = '200'         # FIX ERROR 500: Bypass keamanan cgi.force_redirect
        php_env['PHP_FCGI_MAX_REQUESTS'] = '0'     # Mencegah PHP mati otomatis setelah 500 request
        
        try:
            if sys.platform == 'win32':
                # Sembunyikan jendela Console hitam bawaan Windows
                CREATE_NO_WINDOW = 0x08000000
                # Masukkan argumen env=php_env ke dalam Popen
                process = subprocess.Popen(cmd, cwd=target_dir, env=php_env, creationflags=CREATE_NO_WINDOW)
            else:
                process = subprocess.Popen(cmd, cwd=target_dir, env=php_env)
                
            # Tunggu setengah detik untuk memastikan proses tidak langsung crash
            import time
            time.sleep(0.5)
            if process.poll() is not None:
                 return {"status": "error", "message": f"Gagal menjalankan CGI. Port {port} mungkin sudah digunakan aplikasi lain."}

            self.processes[version] = process
            
            # Update Proxy Apache dengan Try-Except agar tidak gagal diam-diam
            try:
                if hasattr(self, 'api') and hasattr(self.api, 'apache'):
                    self.api.apache.update_global_php_proxy(port)
                    self.api.emit_log(f"Routing Apache berhasil diarahkan ke port {port}.", "info")
                else:
                    self.api.emit_log("PERINGATAN: Referensi API Apache tidak ditemukan. Routing gagal.", "warning")
            except Exception as proxy_err:
                self.api.emit_log(f"Gagal mengupdate proxy Apache: {str(proxy_err)}", "error")
            
            self.api.emit_log(f"Berhasil menyalakan FastCGI PHP {version} pada Port {port}.", "success")
            return {"status": "success", "message": "PHP FastCGI berhasil dinyalakan."}
            
        except Exception as e:
            self.api.emit_log(f"Error memulai PHP: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def stop_php(self, version: str):
        try:
            # 1. Matikan proses (Taskkill / Terminate) jika ada
            if version in self.processes:
                process = self.processes[version]
                if process.poll() is None:
                    # Logika spesifik OS untuk mematikan proses (contoh Windows taskkill)
                    import subprocess
                    subprocess.call(['taskkill', '/F', '/T', '/PID', str(process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # ---> SOLUSI BUG KEYERROR: Gunakan .pop() sebagai pengganti del <---
                self.processes.pop(version, None)
                
            if hasattr(self, 'api'):
                self.api.emit_log(f"FastCGI PHP {version} berhasil dihentikan.", "success")
                
            return {"status": "success", "message": f"PHP {version} dihentikan."}
            
        except Exception as e:
            if hasattr(self, 'api'):
                self.api.emit_log(f"Gagal menghentikan PHP {version}: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def get_installed_versions(self):
        """Mendapatkan daftar versi PHP yang terinstal berdasarkan direktori"""
        php_path = os.path.join(self.base_dir) # Asumsi base_dir adalah path folder 'php'
        if not os.path.exists(php_path):
            return []
        
        # Mengambil daftar folder, filter hanya direktori
        versions = [d for d in os.listdir(php_path) if os.path.isdir(os.path.join(php_path, d))]
        return versions