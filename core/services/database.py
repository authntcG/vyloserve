import os
import sys
import json
import socket
import urllib.request
import urllib.error
import re
import zipfile
import subprocess
import shutil
import concurrent.futures
import threading
import time

class DatabaseManager:
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.bin_dir = os.path.join(self.root_dir, 'bin', 'database') 
        self.config_path = os.path.join(self.data_dir, 'databases.json')
        self.processes = {} # <--- Process Tracker untuk Auto-Restart
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.bin_dir, exist_ok=True)
        if not os.path.exists(self.config_path):
            self._write_json([])

    def _read_json(self):
        if not os.path.exists(self.config_path): return []
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content: return []
                return json.loads(content)
        except Exception:
            return [] 

    def _write_json(self, data):
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)

    def is_port_in_use(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # OPTIMASI 1: Aggressive Timeout 50ms (Mencegah blocking OS)
            s.settimeout(0.05) 
            return s.connect_ex(('127.0.0.1', int(port))) == 0

    def get_installed(self):
        try:
            data = self._read_json()
            if not data:
                return {"status": "success", "data": []}

            def enrich_status(db):
                # OPTIMASI 2: O(1) Memory Check (Instan)
                if db['id'] in self.processes and self.processes[db['id']].poll() is None:
                    db['status'] = 'running'
                else:
                    # Cek fisik socket jika proses dijalankan di luar VyloServe
                    db['status'] = 'running' if self.is_port_in_use(db['port']) else 'stopped'
                return db

            # OPTIMASI 3: Pengecekan Paralel/Serentak (Multi-threading)
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                data = list(executor.map(enrich_status, data))

            return {"status": "success", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ==========================================
    # START / STOP DATABASE CONTROLLER
    # ==========================================
    def start_database(self, db_id):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        if self.is_port_in_use(db_obj['port']):
            return {"status": "error", "message": f"Port {db_obj['port']} sudah digunakan aplikasi lain."}

        engine = db_obj['engine']
        install_dir = db_obj['installDir']
        data_dir = db_obj['dataDir']

        try:
            if engine == 'mysql':
                exe = os.path.join(install_dir, 'bin', 'mysqld.exe' if sys.platform == 'win32' else 'mysqld')
                cmd = [exe, f"--datadir={data_dir}"]
            else: # postgres
                exe = os.path.join(install_dir, 'bin', 'postgres.exe' if sys.platform == 'win32' else 'postgres')
                cmd = [exe, "-D", data_dir]

            proc = subprocess.Popen(cmd, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.processes[db_id] = proc

            for _ in range(50):
                if self.is_port_in_use(db_obj['port']):
                    if hasattr(self, 'api'): self.api.emit_log(f"Engine {db_obj['name']} berjalan di port {db_obj['port']}.", "success")
                    return {"status": "success", "message": f"{db_obj['name']} berhasil dijalankan."}
                time.sleep(0.1)

            return {"status": "error", "message": "Timeout menunggu database untuk berjalan."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_database(self, db_id):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)

        if db_id in self.processes:
            proc = self.processes[db_id]
            if proc.poll() is None:
                proc.terminate()
                try: proc.wait(timeout=5)
                except: proc.kill()
            del self.processes[db_id]

        if db_obj and self.is_port_in_use(db_obj['port']):
            engine = db_obj['engine']
            install_dir = db_obj['installDir']
            data_dir = db_obj['dataDir']
            try:
                if engine == 'postgres':
                    exe = os.path.join(install_dir, 'bin', 'pg_ctl.exe' if sys.platform == 'win32' else 'pg_ctl')
                    subprocess.run([exe, "-D", data_dir, "stop"], creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                elif engine == 'mysql':
                    exe = os.path.join(install_dir, 'bin', 'mysqladmin.exe' if sys.platform == 'win32' else 'mysqladmin')
                    subprocess.run([exe, "-u", "root", f"--port={db_obj['port']}", "shutdown"], creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
            except: pass

        if hasattr(self, 'api') and db_obj: 
            self.api.emit_log(f"Engine {db_obj['name']} berhasil dihentikan.", "warn")
        return {"status": "success", "message": "Database dihentikan."}

    # ==========================================
    # OS-AWARE ONLINE VERSION FETCHER
    # ==========================================
    def get_available_versions(self, engine):
        try:
            self.api.emit_log(f"Memeriksa server online untuk versi terbaru {engine}...", "info")
            if engine == 'mysql':
                return self._fetch_mariadb_versions()
            elif engine == 'postgres':
                return self._fetch_postgres_versions()
            return {"status": "error", "message": "Engine tidak didukung."}
        except Exception as e:
            self.api.emit_log(f"Gagal mengambil versi online: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal mengambil versi online: {str(e)}"}

    def _resolve_mariadb_url(self, version):
        base_url = f"https://archive.mariadb.org/mariadb-{version}/"
        try:
            req = urllib.request.Request(base_url, headers={'User-Agent': 'Mozilla/5.0'})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception:
            raise Exception(f"Folder mariadb-{version} tidak ditemukan.")
            
        if sys.platform == 'darwin':
            dir_pattern = r'href="(osx/|mac/)"'
            ext_pattern = r'href="([^"]+\.tar\.gz|[^"]+\.pkg)"'
        elif sys.platform.startswith('linux'):
            dir_pattern = r'href="(bintar-linux-systemd-x86_64/|bintar-linux-x86_64/|linux/)"'
            ext_pattern = r'href="([^"]+\.tar\.gz)"'
        else: # Windows
            dir_pattern = r'href="(winx64-packages/|windows/|win64/|win32-packages/)"'
            ext_pattern = r'href="([^"]+\.zip)"'

        dir_match = re.search(dir_pattern, html, re.IGNORECASE)
        target_html = html
        folder_url = base_url
        if dir_match:
            folder_url = base_url + dir_match.group(1)
            req2 = urllib.request.Request(folder_url, headers={'User-Agent': 'Mozilla/5.0'})
            target_html = urllib.request.urlopen(req2, timeout=10).read().decode('utf-8')
            
        files = re.findall(ext_pattern, target_html, re.IGNORECASE)
        for f in files:
            if 'debugsymbols' not in f.lower() and 'test' not in f.lower():
                return folder_url + f
                
        raise Exception(f"Binary untuk OS ini belum tersedia.")

    def _fetch_mariadb_versions(self):
        url = "https://archive.mariadb.org/"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e:
            return {"status": "error", "message": f"Koneksi gagal: {str(e)}"}
        
        raw_versions = list(set(re.findall(r'href="mariadb-(\d+\.\d+\.\d+)/"', html)))
        latest_versions_dict = {}
        for v in raw_versions:
            parts = v.split('.')
            if len(parts) == 3:
                major_minor = f"{parts[0]}.{parts[1]}"
                patch_version = int(parts[2])
                if major_minor not in latest_versions_dict or patch_version > latest_versions_dict[major_minor]['patch']:
                    latest_versions_dict[major_minor] = {'patch': patch_version, 'full_version': v}
                    
        sorted_major_minors = sorted(latest_versions_dict.keys(), key=lambda x: [int(i) for i in x.split('.')], reverse=True)
        results = []

        def check_and_resolve(v):
            try:
                resolved_url = self._resolve_mariadb_url(v)
                return {"version": v, "url": resolved_url, "name": f"MariaDB {v}"}
            except Exception:
                return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            versions_to_check = [latest_versions_dict[mm]['full_version'] for mm in sorted_major_minors]
            futures = [executor.submit(check_and_resolve, v) for v in versions_to_check]
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                if res: results.append(res)
                    
        results.sort(key=lambda x: [int(i) for i in x['version'].split('.')], reverse=True)
        self.api.emit_log(f"Berhasil memuat daftar rilis stabil MariaDB/MySQL.", "success")
        return {"status": "success", "data": results}

    def _fetch_postgres_versions(self):
        url = "https://www.enterprisedb.com/download-postgresql-binaries"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e:
            return {"status": "error", "message": f"Koneksi EDB gagal: {str(e)}"}

        os_target = "Windows x86-64"
        if sys.platform == 'darwin': os_target = "Mac OS X"
        elif sys.platform.startswith('linux'): os_target = "Linux x86-64"

        results = []
        blocks = html.split("Binaries from installer")[1:]
        for block in blocks:
            header_area = block[:200]
            if "(not supported)" in header_area.lower(): continue
            v_match = re.search(r'Version.*?([\d\.]+)', header_area, re.IGNORECASE)
            if not v_match: continue
            version = v_match.group(1)

            link_match = re.search(fr'href="([^"]+)">\s*<img[^>]*alt="{os_target}"', block, re.IGNORECASE)
            if link_match:
                link = link_match.group(1)
                if not link.startswith('http'): link = "https:" + link if link.startswith('//') else "https://www.enterprisedb.com" + link if link.startswith('/') else "https://www.enterprisedb.com/" + link
                results.append({"version": version, "url": link, "name": f"PostgreSQL {version}"})

        unique_results = []
        seen = set()
        for r in results:
            if r['version'] not in seen:
                seen.add(r['version'])
                unique_results.append(r)

        unique_results.sort(key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        self.api.emit_log(f"Berhasil memuat daftar rilis stabil EnterpriseDB PostgreSQL.", "success")
        return {"status": "success", "data": unique_results}

    # ==========================================
    # MULTI-PART DOWNLOADER (IDM STYLE)
    # ==========================================
    def _download_file_accelerated(self, url, zip_path, engine):
        self.api.emit_log(f"Menghubungi peladen unduhan untuk {engine}...", "info")
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                total_size = int(response.info().get('Content-Length', 0))
                accept_ranges = response.info().get('Accept-Ranges', 'none')
        except urllib.error.HTTPError as http_err:
            if http_err.code == 404: raise Exception("File instalasi 404 Not Found di server.")
            raise Exception(f"Server mengembalikan kode error: {http_err.code}")
        except Exception as e:
            total_size = 0
            accept_ranges = 'none'

        if total_size > 0 and accept_ranges.lower() == 'bytes':
            self.api.emit_log(f"Server mendukung 'Range Bytes'. Memulai Akselerasi Multi-Part (8 Connections)...", "success")
            num_connections = 8
            part_size = total_size // num_connections
            
            with open(zip_path, "wb") as f:
                f.seek(total_size - 1)
                f.write(b'\0')
                
            downloaded_bytes = 0
            last_percent = -1
            lock = threading.Lock()
            
            def download_chunk(start, end):
                nonlocal downloaded_bytes, last_percent
                req_chunk = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Range': f'bytes={start}-{end}'
                })
                with urllib.request.urlopen(req_chunk, timeout=20) as res, open(zip_path, 'r+b') as f:
                    f.seek(start)
                    while True:
                        chunk = res.read(32768)
                        if not chunk: break
                        f.write(chunk)
                        
                        with lock:
                            downloaded_bytes += len(chunk)
                            dl_percent = int((downloaded_bytes * 100) / total_size)
                            overall_percent = 10 + int(dl_percent * 0.5) 
                            
                            if overall_percent != last_percent and overall_percent <= 60:
                                self.api.emit_progress(overall_percent, f"Mengunduh (Multi-Part)... {dl_percent}%")
                                last_percent = overall_percent

            with concurrent.futures.ThreadPoolExecutor(max_workers=num_connections) as executor:
                futures = []
                for i in range(num_connections):
                    start = i * part_size
                    end = start + part_size - 1 if i < num_connections - 1 else total_size - 1
                    futures.append(executor.submit(download_chunk, start, end))
                
                for future in concurrent.futures.as_completed(futures):
                    future.result() 
                    
        else:
            self.api.emit_log(f"Server memblokir Multi-Part. Melanjutkan dengan mode Single-Stream standar.", "warn")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as response, open(zip_path, 'wb') as out_file:
                block_size = 32768
                read_size = 0
                last_percent = -1
                
                while True:
                    buffer = response.read(block_size)
                    if not buffer: break
                    out_file.write(buffer)
                    read_size += len(buffer)
                    
                    if total_size > 0:
                        dl_percent = int((read_size * 100) / total_size)
                        overall_percent = 10 + int(dl_percent * 0.5) 
                        if overall_percent != last_percent and overall_percent <= 60:
                            self.api.emit_progress(overall_percent, f"Mengunduh... {dl_percent}%")
                            last_percent = overall_percent
                    else:
                        mb_downloaded = (read_size) / (1024 * 1024)
                        if read_size % (1024 * 1024) < block_size:
                            self.api.emit_progress(35, f"Mengunduh... {mb_downloaded:.1f} MB")

    # ==========================================
    # SYNCHRONOUS INSTALLATION ENGINE 
    # ==========================================
    def install_database(self, engine, version, url, port, root_pass):
        db_id = f"{engine}_{version.replace('.', '_')}"
        install_dir = os.path.join(self.bin_dir, db_id) 
        db_data_dir = os.path.join(self.data_dir, db_id) 
        zip_path = os.path.join(self.bin_dir, f"{db_id}.zip")

        is_existing_data = False
        if os.path.exists(db_data_dir) and len(os.listdir(db_data_dir)) > 0:
            is_existing_data = True

        try:
            self.api.emit_log(f"Inisiasi pemasangan {engine} {version} pada Port {port}", "info")
            if os.path.exists(install_dir):
                self.api.emit_log(f"Instalasi dibatalkan: {engine} {version} sudah ada.", "warn")
                return {"status": "error", "message": f"{engine} {version} sudah terinstal!"}

            if engine == 'mysql':
                self.api.emit_progress(2, f"Melacak berkas asli MariaDB...")
                url = self._resolve_mariadb_url(version)

            self._download_file_accelerated(url, zip_path, engine)

            self.api.emit_log(f"Unduhan selesai. Mengekstrak berkas arsip ke sistem...", "info")
            self.api.emit_progress(65, "Mengekstrak file ZIP...")
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                members = zip_ref.infolist()
                total_files = len(members)
                last_percent = -1
                
                for index, member in enumerate(members):
                    zip_ref.extract(member, install_dir)
                    
                    if index % 50 == 0 or index == total_files - 1:
                        extract_percent = 65 + int((index / total_files) * 15)
                        if extract_percent != last_percent:
                            self.api.emit_progress(extract_percent, f"Mengekstrak... ({index}/{total_files} file)")
                            last_percent = extract_percent
                            time.sleep(0.005) 
                            
            os.remove(zip_path)
            self.api.emit_log(f"Proses ekstraksi {total_files} file berhasil diselesaikan.", "success")

            extracted_subdirs = os.listdir(install_dir)
            if len(extracted_subdirs) == 1 and os.path.isdir(os.path.join(install_dir, extracted_subdirs[0])):
                inner_folder = os.path.join(install_dir, extracted_subdirs[0])
                for item in os.listdir(inner_folder):
                    shutil.move(os.path.join(inner_folder, item), install_dir)
                os.rmdir(inner_folder)

            if is_existing_data:
                self.api.emit_log(f"Mendeteksi direktori data {db_id} sudah terisi. Melewati inisialisasi agar data Anda tetap utuh.", "success")
                self.api.emit_progress(80, f"Mengikat data database lama...")
            else:
                self.api.emit_log(f"Menyiapkan kerangka skema data mentah (Provisioning)...", "info")
                self.api.emit_progress(80, f"Menyiapkan kerangka database...")
                os.makedirs(db_data_dir, exist_ok=True)
                
                if engine == 'mysql':
                    self._init_mariadb(install_dir, db_data_dir)
                elif engine == 'postgres':
                    self._init_postgres(install_dir, db_data_dir, root_pass)

            self.api.emit_log(f"Pemasangan inti selesai. Meregistrasi servis lokal...", "info")
            self.api.emit_progress(95, "Menyimpan konfigurasi server lokal...")
            data = self._read_json()
            data.append({
                "id": db_id,
                "name": f"{'MariaDB' if engine == 'mysql' else 'PostgreSQL'} {version}",
                "engine": engine,
                "version": version,
                "port": int(port),
                "dataDir": db_data_dir,
                "installDir": install_dir
            })
            self._write_json(data)

            self.api.emit_progress(100, "Instalasi Database Selesai!")
            self.api.emit_log(f"Instalasi Selesai! {engine} {version} siap digunakan.", "success")
                
            return {"status": "success", "message": f"{engine} {version} berhasil diinstal."}

        except Exception as e:
            self.api.emit_log(f"Membatalkan pemasangan & Melakukan roll-back (Cleanup)...", "warn")
            if os.path.exists(zip_path):
                try: os.remove(zip_path)
                except: pass
            if os.path.exists(install_dir):
                shutil.rmtree(install_dir, ignore_errors=True)
                
            if not is_existing_data and os.path.exists(db_data_dir):
                self.api.emit_log(f"Menghapus sisa folder data {db_id} yang gagal diinisialisasi...", "warn")
                shutil.rmtree(db_data_dir, ignore_errors=True)
                
            self.api.emit_progress(-1, str(e))
            self.api.emit_log(f"Gagal instalasi DB: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    # ==========================================
    # INITIALIZER HELPERS 
    # ==========================================
    def _init_mariadb(self, bin_dir, data_dir):
        installer = os.path.join(bin_dir, 'bin', 'mysql_install_db.exe') if sys.platform == 'win32' else os.path.join(bin_dir, 'scripts', 'mysql_install_db')
        if os.path.exists(installer):
            result = subprocess.run([installer, f"--datadir={data_dir}"], creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0, capture_output=True, text=True, errors='replace')
            if result.returncode != 0:
                err_msg = (result.stderr or result.stdout or "Error tidak diketahui.").strip()
                raise Exception(f"MariaDB gagal diinisialisasi: {err_msg}")
        else:
            raise Exception("File initializer tidak ditemukan di paket unduhan.")

    def _init_postgres(self, bin_dir, data_dir, password):
        pw_file = os.path.join(bin_dir, 'pw.txt')
        with open(pw_file, 'w') as f:
            f.write(password if password else 'root')
            
        installer = os.path.join(bin_dir, 'bin', 'initdb.exe' if sys.platform == 'win32' else 'initdb')
        if os.path.exists(installer):
            try:
                cmd = [installer, "-D", data_dir, "-U", "postgres", f"--pwfile={pw_file}", "--encoding=UTF8"]
                result = subprocess.run(cmd, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0, capture_output=True, text=True, errors='replace')
                if result.returncode != 0:
                    err_msg = (result.stderr or result.stdout or "Error tidak diketahui.").strip()
                    if "administrative permissions is not permitted" in err_msg.lower():
                        raise Exception("PostgreSQL menolak diinstal! Anda menjalankan aplikasi ini sebagai Administrator. Silakan restart aplikasi secara normal.")
                    else:
                        raise Exception(f"PostgreSQL gagal diinisialisasi:\n{err_msg}")
            finally:
                if os.path.exists(pw_file):
                    os.remove(pw_file)
        else:
            if os.path.exists(pw_file):
                os.remove(pw_file)
            raise Exception("File initdb tidak ditemukan di paket unduhan.")

    def uninstall_database(self, db_id, delete_data=False):
        try:
            self.api.emit_log(f"Memulai proses penghapusan instansi database {db_id}...", "warn")
            data = self._read_json()
            db_to_remove = next((db for db in data if db['id'] == db_id), None)
            
            if not db_to_remove:
                return {"status": "error", "message": "Database tidak ditemukan di konfigurasi."}
                
            if self.is_port_in_use(db_to_remove['port']):
                self.api.emit_log(f"Penghapusan ditolak: Servis di port {db_to_remove['port']} masih berjalan.", "error")
                return {"status": "error", "message": "Database sedang berjalan! Harap matikan (Stop DB) terlebih dahulu sebelum menghapus engine."}

            install_dir = db_to_remove.get('installDir')
            data_dir = db_to_remove.get('dataDir')
            
            if install_dir and os.path.exists(install_dir):
                shutil.rmtree(install_dir, ignore_errors=True)
                
            if delete_data and data_dir and os.path.exists(data_dir):
                self.api.emit_log(f"Peringatan: Direktori data mentah {data_dir} ikut dilenyapkan.", "error")
                shutil.rmtree(data_dir, ignore_errors=True)
                
            data = [db for db in data if db['id'] != db_id]
            self._write_json(data)
            
            self.api.emit_log(f"Berhasil menghapus engine {db_to_remove['name']}{' beserta datanya' if delete_data else ''}.", "success")
            return {"status": "success", "message": f"Engine {db_to_remove['name']} berhasil dihapus."}
            
        except Exception as e:
            self.api.emit_log(f"Gagal menghapus database: {str(e)}", "error")
            return {"status": "error", "message": f"Gagal menghapus: {str(e)}"}
        
    # ==========================================
    # DATABASE CONFIGURATION & AUTO-RESTART
    # ==========================================
    def open_path(self, db_id, is_file=False):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        target_path = db_obj['dataDir']
        if is_file:
            if db_obj['engine'] == 'mysql':
                target_path = os.path.join(target_path, 'my.ini')
                if not os.path.exists(target_path):
                    with open(target_path, 'w', encoding='utf-8') as f:
                        f.write("[mysqld]\n")
            elif db_obj['engine'] == 'postgres':
                target_path = os.path.join(target_path, 'postgresql.conf')

        if not os.path.exists(target_path):
            return {"status": "error", "message": "File atau direktori belum dibuat."}

        try:
            if sys.platform == 'win32': os.startfile(target_path)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target_path])
            else: subprocess.Popen(['xdg-open', target_path])
            return {"status": "success", "message": "Berhasil dibuka."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_db_config(self, db_id):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        engine = db_obj['engine']
        data_dir = db_obj['dataDir']
        config = {"port": db_obj.get("port")}

        if engine == 'mysql':
            config.update({
                "bind_address": "127.0.0.1",
                "innodb_buffer_pool_size": "256M",
                "max_allowed_packet": "64M",
                "max_connections": "151",
                "character_set_server": "utf8mb4",
                "collation_server": "utf8mb4_unicode_ci",
                "default_storage_engine": "InnoDB"
            })
            conf_file = os.path.join(data_dir, 'my.ini')
            if os.path.exists(conf_file):
                with open(conf_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('bind-address') and not line.startswith('#'): config['bind_address'] = line.split('=')[1].strip()
                        elif line.startswith('innodb_buffer_pool_size') and not line.startswith('#'): config['innodb_buffer_pool_size'] = line.split('=')[1].strip()
                        elif line.startswith('max_allowed_packet') and not line.startswith('#'): config['max_allowed_packet'] = line.split('=')[1].strip()
                        elif line.startswith('max_connections') and not line.startswith('#'): config['max_connections'] = line.split('=')[1].strip()
                        elif line.startswith('character-set-server') and not line.startswith('#'): config['character_set_server'] = line.split('=')[1].strip()
                        elif line.startswith('collation-server') and not line.startswith('#'): config['collation_server'] = line.split('=')[1].strip()
                        elif line.startswith('default-storage-engine') and not line.startswith('#'): config['default_storage_engine'] = line.split('=')[1].strip()
                        elif line.startswith('port') and not line.startswith('#'): config['port'] = int(line.split('=')[1].strip())
        
        elif engine == 'postgres':
            config.update({
                "listen_addresses": "*",
                "shared_buffers": "128MB",
                "work_mem": "4MB",
                "maintenance_work_mem": "64MB",
                "effective_cache_size": "256MB",
                "max_connections": "100",
                "timezone": "UTC"
            })
            conf_file = os.path.join(data_dir, 'postgresql.conf')
            if os.path.exists(conf_file):
                with open(conf_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('listen_addresses') and not line.startswith('#'): config['listen_addresses'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('shared_buffers') and not line.startswith('#'): config['shared_buffers'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('work_mem') and not line.startswith('#'): config['work_mem'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('maintenance_work_mem') and not line.startswith('#'): config['maintenance_work_mem'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('effective_cache_size') and not line.startswith('#'): config['effective_cache_size'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('max_connections') and not line.startswith('#'): config['max_connections'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('timezone') and not line.startswith('#'): config['timezone'] = line.split('=')[1].strip().strip("'").strip('"')
                        elif line.startswith('port') and not line.startswith('#'): config['port'] = int(line.split('=')[1].strip())

        return {"status": "success", "config": config}

    def save_db_config(self, db_id, new_config):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        engine = db_obj['engine']
        data_dir = db_obj['dataDir']
        was_running = self.is_port_in_use(db_obj['port'])

        db_obj['port'] = int(new_config.get('port', db_obj['port']))
        self._write_json(data)

        if engine == 'mysql':
            conf_file = os.path.join(data_dir, 'my.ini')
            lines = ["[mysqld]\n"]
            if os.path.exists(conf_file):
                with open(conf_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()

            keys_to_update = {
                "port": str(new_config.get("port")),
                "bind-address": new_config.get("bind_address"),
                "innodb_buffer_pool_size": new_config.get("innodb_buffer_pool_size"),
                "max_allowed_packet": new_config.get("max_allowed_packet"),
                "max_connections": str(new_config.get("max_connections")),
                "character-set-server": new_config.get("character_set_server"),
                "collation-server": new_config.get("collation_server"),
                "default-storage-engine": new_config.get("default_storage_engine"),
            }
            
            new_lines = []
            found_keys = set()
            for line in lines:
                updated = False
                for k, v in keys_to_update.items():
                    if line.strip().startswith(k) and not line.strip().startswith('#'):
                        new_lines.append(f"{k} = {v}\n")
                        found_keys.add(k)
                        updated = True
                        break
                if not updated:
                    new_lines.append(line)
            
            if not any("[mysqld]" in l for l in new_lines): new_lines.insert(0, "[mysqld]\n")
                
            mysqld_idx = new_lines.index(next(l for l in new_lines if "[mysqld]" in l)) + 1
            for k, v in keys_to_update.items():
                if k not in found_keys and v is not None:
                    new_lines.insert(mysqld_idx, f"{k} = {v}\n")

            with open(conf_file, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

        elif engine == 'postgres':
            conf_file = os.path.join(data_dir, 'postgresql.conf')
            if not os.path.exists(conf_file): return {"status": "error", "message": "postgresql.conf tidak ditemukan."}

            with open(conf_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            keys_to_update = {
                "port": str(new_config.get("port")),
                "listen_addresses": f"'{new_config.get('listen_addresses')}'", 
                "shared_buffers": f"'{new_config.get('shared_buffers')}'",
                "work_mem": f"'{new_config.get('work_mem')}'",
                "maintenance_work_mem": f"'{new_config.get('maintenance_work_mem')}'",
                "effective_cache_size": f"'{new_config.get('effective_cache_size')}'",
                "max_connections": str(new_config.get("max_connections")),
                "timezone": f"'{new_config.get('timezone')}'",
            }

            new_lines = []
            found_keys = set()
            for line in lines:
                updated = False
                for k, v in keys_to_update.items():
                    if line.strip().startswith(k) and not line.strip().startswith('#'):
                        new_lines.append(f"{k} = {v}\n")
                        found_keys.add(k)
                        updated = True
                        break
                if not updated:
                    new_lines.append(line)

            for k, v in keys_to_update.items():
                if k not in found_keys and v is not None:
                    new_lines.append(f"{k} = {v}\n")

            with open(conf_file, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

        msg = "Konfigurasi berhasil disimpan."
        if was_running:
            self.api.emit_log(f"Menerapkan konfigurasi baru dengan merestart {db_obj['name']}...", "info")
            self.stop_database(db_id)
            time.sleep(1) 
            start_res = self.start_database(db_id)
            
            if start_res.get('status') == 'success':
                msg += " Database telah direstart otomatis."
            else:
                msg += f" Namun gagal start ulang: {start_res.get('message')}"
        else:
            msg += " Silakan Start DB untuk menerapkan."

        self.api.emit_log(msg, "success")
        return {"status": "success", "message": msg}
    
    def change_db_credentials(self, db_id, username, old_password, new_password):
        data = self._read_json()
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        if not self.is_port_in_use(db_obj['port']):
            return {"status": "error", "message": "Database harus dalam keadaan menyala (Start DB) untuk mengubah password."}

        engine = db_obj['engine']
        install_dir = db_obj['installDir']
        port = db_obj['port']

        try:
            if engine == 'mysql':
                exe = os.path.join(install_dir, 'bin', 'mysql.exe' if sys.platform == 'win32' else 'mysql')
                cmd = [exe, "-u", username, f"-P{port}", "-h", "127.0.0.1"]
                if old_password:
                    cmd.append(f"-p{old_password}")
                
                query = f"ALTER USER '{username}'@'localhost' IDENTIFIED BY '{new_password}'; FLUSH PRIVILEGES;"
                cmd.extend(["-e", query])

                result = subprocess.run(cmd, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0, capture_output=True, text=True)
                if result.returncode != 0:
                    err = result.stderr.strip()
                    if "Access denied" in err:
                        return {"status": "error", "message": "Password lama salah atau user tidak ditemukan."}
                    return {"status": "error", "message": f"Gagal MySQL: {err}"}

            elif engine == 'postgres':
                exe = os.path.join(install_dir, 'bin', 'psql.exe' if sys.platform == 'win32' else 'psql')
                env = os.environ.copy()
                if old_password:
                    env['PGPASSWORD'] = old_password

                query = f"ALTER ROLE {username} WITH PASSWORD '{new_password}';"
                cmd = [exe, "-U", username, "-p", str(port), "-h", "127.0.0.1", "-c", query]

                result = subprocess.run(cmd, env=env, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0, capture_output=True, text=True)
                if result.returncode != 0:
                    err = result.stderr.strip()
                    if "authentication failed" in err:
                        return {"status": "error", "message": "Password lama salah atau user tidak ditemukan."}
                    return {"status": "error", "message": f"Gagal PostgreSQL: {err}"}

            if hasattr(self, 'api'):
                self.api.emit_log(f"Kredensial {engine} untuk user '{username}' berhasil diperbarui.", "success")
            return {"status": "success", "message": "Password berhasil diperbarui!"}
            
        except Exception as e:
            return {"status": "error", "message": f"Kesalahan internal sistem: {str(e)}"}
        
    # ==========================================
    # MASTER CONTROLLER (UNIVERSAL SERVICE STANDARD)
    # ==========================================
    def check_is_running(self):
        """Memeriksa apakah ada minimal 1 database yang sedang berjalan secara instan"""
        try:
            # 1. Deteksi O(1) dari Memory Track (0 milidetik)
            for v in list(self.processes.keys()):
                if self.processes[v].poll() is None:
                    return True
                else:
                    # Bersihkan proses yang sudah mati (zombie)
                    self.processes.pop(v, None)
                    
            # 2. Paralel Socket Polling jika memori kosong
            dbs = self._read_json()
            if not dbs: return False
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                results = executor.map(lambda db: self.is_port_in_use(db['port']), dbs)
                return any(results)
        except:
            return False

    def _get_preferred_dbs(self, dbs):
        """ Mendapatkan target DB berdasarkan dashboard.json atau fallback ke versi terbaru per engine """
        dashboard_json = os.path.join(self.data_dir, 'dashboard.json')
        selected_dbs = []
        try:
            if os.path.exists(dashboard_json):
                with open(dashboard_json, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    selected_dbs = config.get('selected_database', [])
        except: pass
        
        valid_selected = [db['id'] for db in dbs if db['id'] in selected_dbs]
        if valid_selected:
            return valid_selected
            
        # Fallback: Versi terbaru dari masing-masing engine jika tidak ada yang dipilih
        fallback_dbs = []
        def get_version_score(v):
            matches = re.findall(r'\d+', v['version'])
            return [int(x) for x in matches] if matches else [0]
            
        mysql_dbs = [db for db in dbs if db['engine'] == 'mysql']
        if mysql_dbs:
            mysql_dbs.sort(key=get_version_score, reverse=True)
            fallback_dbs.append(mysql_dbs[0]['id'])
            
        postgres_dbs = [db for db in dbs if db['engine'] == 'postgres']
        if postgres_dbs:
            postgres_dbs.sort(key=get_version_score, reverse=True)
            fallback_dbs.append(postgres_dbs[0]['id'])
            
        return fallback_dbs

    def start_all(self):
        dbs = self.get_installed().get('data', [])
        if not dbs:
            return {"status": "error", "message": "Tidak ada database terinstal."}
            
        target_db_ids = self._get_preferred_dbs(dbs)
        
        success_count = 0
        for db in dbs:
            if db['id'] in target_db_ids and not self.is_port_in_use(db['port']):
                res = self.start_database(db['id'])
                if res.get('status') == 'success':
                    success_count += 1
        
        if success_count > 0:
            return {"status": "success", "message": f"{success_count} Database berhasil dijalankan."}
        else:
            if self.check_is_running():
                return {"status": "success", "message": "Database pilihan sudah berjalan."}
            return {"status": "error", "message": "Gagal memulai database."}

    def stop_all(self):
        dbs = self.get_installed().get('data', [])
        target_db_ids = self._get_preferred_dbs(dbs)
        
        stopped_count = 0
        for db in dbs:
            if db['id'] in target_db_ids and self.is_port_in_use(db['port']):
                self.stop_database(db['id'])
                stopped_count += 1
                
        if stopped_count > 0:
            return {"status": "success", "message": f"{stopped_count} Database pilihan berhasil dihentikan."}
        return {"status": "success", "message": "Tidak ada database pilihan yang sedang berjalan."}