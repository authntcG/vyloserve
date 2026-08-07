import os
import sys
import urllib.request
import re
import shutil
import concurrent.futures
import time
import subprocess

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, check_port_in_use, start_silent_process, run_silent_command
from core.utils.file_utils import read_json, write_json, download_advanced, extract_archive

class DatabaseManager:
    """Manager untuk siklus hidup Engine Database (MySQL, MariaDB, PostgreSQL)"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.bin_dir = os.path.join(self.root_dir, 'bin', 'database') 
        self.config_path = os.path.join(self.data_dir, 'databases.json')
        self.processes = {}
        
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.bin_dir, exist_ok=True)
        if not os.path.exists(self.config_path):
            write_json(self.config_path, [])

    # ---> FIX: Mengembalikan is_port_in_use dengan memanggil utility <---
    def is_port_in_use(self, port):
        return check_port_in_use(port)

    def get_installed(self):
        try:
            data = read_json(self.config_path)
            if not data: return {"status": "success", "data": []}

            def enrich_status(db):
                if db['id'] in self.processes and self.processes[db['id']].poll() is None:
                    db['status'] = 'running'
                else:
                    db['status'] = 'running' if check_port_in_use(db['port']) else 'stopped'
                return db

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                data = list(executor.map(enrich_status, data))

            return {"status": "success", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ==========================================
    # START / STOP CONTROLLER (SILENT SUBPROCESS)
    # ==========================================
    def start_database(self, db_id: str):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        if check_port_in_use(db_obj['port']):
            return {"status": "error", "message": f"Port {db_obj['port']} sudah digunakan."}

        engine = db_obj['engine']
        install_dir = db_obj['installDir']
        data_dir = db_obj['dataDir']

        try:
            if engine == 'mysql':
                exe = os.path.join(install_dir, 'bin', 'mysqld.exe' if sys.platform == 'win32' else 'mysqld')
                cmd = [exe, f"--datadir={data_dir}"]
            else:
                exe = os.path.join(install_dir, 'bin', 'postgres.exe' if sys.platform == 'win32' else 'postgres')
                cmd = [exe, "-D", data_dir]

            self.processes[db_id] = start_silent_process(cmd)

            for _ in range(50):
                if check_port_in_use(db_obj['port']):
                    if hasattr(self, 'api'): self.api.emit_log(f"Engine {db_obj['name']} berjalan di port {db_obj['port']}.", "success")
                    return {"status": "success", "message": f"{db_obj['name']} berhasil dijalankan."}
                time.sleep(0.1)

            return {"status": "error", "message": "Timeout menunggu database berjalan."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_database(self, db_id: str):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)

        if db_id in self.processes:
            proc = self.processes[db_id]
            if proc.poll() is None:
                proc.terminate()
                try: proc.wait(timeout=5)
                except: proc.kill()
            self.processes.pop(db_id, None)

        if db_obj and check_port_in_use(db_obj['port']):
            install_dir = db_obj['installDir']
            data_dir = db_obj['dataDir']
            try:
                if db_obj['engine'] == 'postgres':
                    exe = os.path.join(install_dir, 'bin', 'pg_ctl.exe' if sys.platform == 'win32' else 'pg_ctl')
                    run_silent_command([exe, "-D", data_dir, "stop"])
                elif db_obj['engine'] == 'mysql':
                    exe = os.path.join(install_dir, 'bin', 'mysqladmin.exe' if sys.platform == 'win32' else 'mysqladmin')
                    run_silent_command([exe, "-u", "root", f"--port={db_obj['port']}", "shutdown"])
            except: pass

        if hasattr(self, 'api') and db_obj: 
            self.api.emit_log(f"Engine {db_obj['name']} berhasil dihentikan.", "warn")
        return {"status": "success", "message": "Database dihentikan."}

    # ==========================================
    # OS-AWARE ONLINE VERSION FETCHER
    # ==========================================
    def get_available_versions(self, engine: str):
        try:
            if hasattr(self, 'api'): self.api.emit_log(f"Memeriksa rilis terbaru {engine}...", "info")
            if engine == 'mysql': return self._fetch_mariadb_versions()
            elif engine == 'postgres': return self._fetch_postgres_versions()
            return {"status": "error", "message": "Engine tidak didukung."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal mengambil versi online: {str(e)}"}

    def _resolve_mariadb_url(self, version: str) -> str:
        base_url = f"https://archive.mariadb.org/mariadb-{version}/"
        try:
            req = urllib.request.Request(base_url, headers={'User-Agent': 'Mozilla/5.0'})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception:
            raise Exception(f"Folder mariadb-{version} tidak ditemukan.")
            
        if sys.platform == 'darwin':
            dir_pattern, ext_pattern = r'href="(osx/|mac/)"', r'href="([^"]+\.tar\.gz|[^"]+\.pkg)"'
        elif sys.platform.startswith('linux'):
            dir_pattern, ext_pattern = r'href="(bintar-linux-systemd-x86_64/|bintar-linux-x86_64/|linux/)"', r'href="([^"]+\.tar\.gz)"'
        else:
            dir_pattern, ext_pattern = r'href="(winx64-packages/|windows/|win64/|win32-packages/)"', r'href="([^"]+\.zip)"'

        dir_match = re.search(dir_pattern, html, re.IGNORECASE)
        folder_url, target_html = base_url, html
        if dir_match:
            folder_url = base_url + dir_match.group(1)
            target_html = urllib.request.urlopen(urllib.request.Request(folder_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10).read().decode('utf-8')
            
        for f in re.findall(ext_pattern, target_html, re.IGNORECASE):
            if 'debugsymbols' not in f.lower() and 'test' not in f.lower():
                return folder_url + f
        raise Exception("Binary untuk OS ini belum tersedia.")

    def _fetch_mariadb_versions(self):
        req = urllib.request.Request("https://archive.mariadb.org/", headers={'User-Agent': 'Mozilla/5.0'})
        try: html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e: return {"status": "error", "message": str(e)}
        
        raw_versions = list(set(re.findall(r'href="mariadb-(\d+\.\d+\.\d+)/"', html)))
        latest_versions_dict = {}
        for v in raw_versions:
            parts = v.split('.')
            if len(parts) == 3:
                major_minor, patch = f"{parts[0]}.{parts[1]}", int(parts[2])
                if major_minor not in latest_versions_dict or patch > latest_versions_dict[major_minor]['patch']:
                    latest_versions_dict[major_minor] = {'patch': patch, 'full_version': v}
                    
        sorted_mm = sorted(latest_versions_dict.keys(), key=lambda x: [int(i) for i in x.split('.')], reverse=True)
        results = []

        def check_resolve(v):
            try: return {"version": v, "url": self._resolve_mariadb_url(v), "name": f"MariaDB {v}"}
            except: return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(check_resolve, latest_versions_dict[mm]['full_version']) for mm in sorted_mm]
            for f in concurrent.futures.as_completed(futures):
                if f.result(): results.append(f.result())
                    
        results.sort(key=lambda x: [int(i) for i in x['version'].split('.')], reverse=True)
        return {"status": "success", "data": results}

    def _fetch_postgres_versions(self):
        req = urllib.request.Request("https://www.enterprisedb.com/download-postgresql-binaries", headers={'User-Agent': 'Mozilla/5.0'})
        try: html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e: return {"status": "error", "message": str(e)}

        os_target = "Windows x86-64" if sys.platform == 'win32' else ("Mac OS X" if sys.platform == 'darwin' else "Linux x86-64")
        results, seen = [], set()

        for block in html.split("Binaries from installer")[1:]:
            if "(not supported)" in block[:200].lower(): continue
            v_match = re.search(r'Version.*?([\d\.]+)', block[:200], re.IGNORECASE)
            if not v_match: continue
            
            link_match = re.search(fr'href="([^"]+)">\s*<img[^>]*alt="{os_target}"', block, re.IGNORECASE)
            if link_match:
                link = link_match.group(1)
                link = link if link.startswith('http') else ("https:" + link if link.startswith('//') else f"https://www.enterprisedb.com/{link.lstrip('/')}")
                if v_match.group(1) not in seen:
                    seen.add(v_match.group(1))
                    results.append({"version": v_match.group(1), "url": link, "name": f"PostgreSQL {v_match.group(1)}"})

        results.sort(key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        return {"status": "success", "data": results}

    # ==========================================
    # SYNCHRONOUS INSTALLATION ENGINE (SUPER FAST)
    # ==========================================
    def install_database(self, engine: str, version: str, url: str, port: int, root_pass: str):
        db_id = f"{engine}_{version.replace('.', '_')}"
        install_dir = os.path.join(self.bin_dir, db_id) 
        db_data_dir = os.path.join(self.data_dir, db_id) 
        zip_path = os.path.join(self.bin_dir, f"{db_id}.zip")

        is_existing_data = os.path.exists(db_data_dir) and len(os.listdir(db_data_dir)) > 0

        try:
            if hasattr(self, 'api'): self.api.emit_log(f"Inisiasi pemasangan {engine} {version} pada Port {port}", "info")
            if os.path.exists(install_dir):
                return {"status": "error", "message": f"{engine} {version} sudah terinstal!"}

            if engine == 'mysql':
                if hasattr(self, 'api'): self.api.emit_progress(2, "Melacak berkas asli MariaDB...")
                url = self._resolve_mariadb_url(version)

            def log_cb(msg, lvl): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def prog_cb(pct, msg): 
                if hasattr(self, 'api'): self.api.emit_progress(pct, msg)

            download_advanced(url, zip_path, log_cb=log_cb, progress_cb=prog_cb)

            if hasattr(self, 'api'):
                self.api.emit_log("Unduhan selesai. Mengekstrak berkas arsip ke sistem...", "info")
                self.api.emit_progress(65, "Mengekstrak file ZIP...")
            
            extract_archive(zip_path, install_dir, progress_cb=prog_cb)
            os.remove(zip_path)

            extracted_subdirs = os.listdir(install_dir)
            if len(extracted_subdirs) == 1 and os.path.isdir(os.path.join(install_dir, extracted_subdirs[0])):
                inner = os.path.join(install_dir, extracted_subdirs[0])
                for item in os.listdir(inner): shutil.move(os.path.join(inner, item), install_dir)
                os.rmdir(inner)

            if is_existing_data:
                if hasattr(self, 'api'): self.api.emit_log(f"Direktori data {db_id} terisi. Melewati inisialisasi.", "success")
            else:
                if hasattr(self, 'api'): self.api.emit_log("Menyiapkan kerangka skema data mentah...", "info")
                os.makedirs(db_data_dir, exist_ok=True)
                
                if engine == 'mysql':
                    installer = os.path.join(install_dir, 'bin', 'mysql_install_db.exe' if sys.platform == 'win32' else 'mysql_install_db')
                    res = run_silent_command([installer, f"--datadir={db_data_dir}"])
                    if res.returncode != 0: raise Exception(f"MariaDB Init Error: {res.stderr}")
                else:
                    pw_file = os.path.join(install_dir, 'pw.txt')
                    with open(pw_file, 'w') as f: f.write(root_pass if root_pass else 'root')
                    installer = os.path.join(install_dir, 'bin', 'initdb.exe' if sys.platform == 'win32' else 'initdb')
                    res = run_silent_command([installer, "-D", db_data_dir, "-U", "postgres", f"--pwfile={pw_file}", "--encoding=UTF8"])
                    if os.path.exists(pw_file): os.remove(pw_file)
                    if res.returncode != 0: raise Exception(f"PostgreSQL Init Error: {res.stderr}")

            data = read_json(self.config_path)
            data.append({
                "id": db_id, "name": f"{'MariaDB' if engine == 'mysql' else 'PostgreSQL'} {version}",
                "engine": engine, "version": version, "port": int(port),
                "dataDir": db_data_dir, "installDir": install_dir
            })
            write_json(self.config_path, data)

            if hasattr(self, 'api'):
                self.api.emit_progress(100, "Instalasi Selesai!")
                self.api.emit_log(f"{engine} {version} siap digunakan.", "success")
            return {"status": "success", "message": f"{engine} {version} berhasil diinstal."}

        except Exception as e:
            if os.path.exists(zip_path): 
                try: os.remove(zip_path)
                except: pass
            if os.path.exists(install_dir): shutil.rmtree(install_dir, ignore_errors=True)
            if not is_existing_data and os.path.exists(db_data_dir): shutil.rmtree(db_data_dir, ignore_errors=True)
                
            if hasattr(self, 'api'):
                self.api.emit_progress(-1, str(e))
                self.api.emit_log(f"Gagal instalasi DB: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def uninstall_database(self, db_id: str, delete_data: bool = False):
        try:
            data = read_json(self.config_path)
            db_to_remove = next((db for db in data if db['id'] == db_id), None)
            if not db_to_remove: return {"status": "error", "message": "Database tidak ditemukan."}
                
            if check_port_in_use(db_to_remove['port']):
                return {"status": "error", "message": "Database sedang berjalan! Harap matikan terlebih dahulu."}

            install_dir, data_dir = db_to_remove.get('installDir'), db_to_remove.get('dataDir')
            if install_dir and os.path.exists(install_dir): shutil.rmtree(install_dir, ignore_errors=True)
            if delete_data and data_dir and os.path.exists(data_dir): shutil.rmtree(data_dir, ignore_errors=True)
                
            data = [db for db in data if db['id'] != db_id]
            write_json(self.config_path, data)
            
            if hasattr(self, 'api'): self.api.emit_log(f"Engine {db_to_remove['name']} berhasil dihapus.", "success")
            return {"status": "success", "message": "Database berhasil dihapus."}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        
    # ==========================================
    # DATABASE CONFIGURATION & CREDENTIALS
    # ==========================================
    def open_path(self, db_id: str, is_file: bool = False):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        target = os.path.join(db_obj['dataDir'], 'my.ini' if db_obj['engine'] == 'mysql' else 'postgresql.conf') if is_file else db_obj['dataDir']
        if is_file and db_obj['engine'] == 'mysql' and not os.path.exists(target):
            with open(target, 'w', encoding='utf-8') as f: f.write("[mysqld]\n")

        if not os.path.exists(target): return {"status": "error", "message": "Target belum dibuat."}

        try:
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success", "message": "Berhasil dibuka."}
        except Exception as e: return {"status": "error", "message": str(e)}

    def get_db_config(self, db_id: str):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        engine, data_dir = db_obj['engine'], db_obj['dataDir']
        config = {"port": db_obj.get("port")}

        if engine == 'mysql':
            config.update({"bind_address": "127.0.0.1", "innodb_buffer_pool_size": "256M", "max_allowed_packet": "64M", "max_connections": "151", "character_set_server": "utf8mb4", "collation_server": "utf8mb4_unicode_ci", "default_storage_engine": "InnoDB"})
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
        else:
            config.update({"listen_addresses": "*", "shared_buffers": "128MB", "work_mem": "4MB", "maintenance_work_mem": "64MB", "effective_cache_size": "256MB", "max_connections": "100", "timezone": "UTC"})
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
        return {"status": "success", "config": config}

    def save_db_config(self, db_id: str, new_config: dict):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}

        was_running = check_port_in_use(db_obj['port'])
        db_obj['port'] = int(new_config.get('port', db_obj['port']))
        write_json(self.config_path, data)

        conf_file = os.path.join(db_obj['dataDir'], 'my.ini' if db_obj['engine'] == 'mysql' else 'postgresql.conf')
        lines = ["[mysqld]\n"] if db_obj['engine'] == 'mysql' else []
        if os.path.exists(conf_file):
            with open(conf_file, 'r', encoding='utf-8') as f: lines = f.readlines()

        if db_obj['engine'] == 'mysql':
            keys = {"port": str(new_config.get("port")), "bind-address": new_config.get("bind_address"), "innodb_buffer_pool_size": new_config.get("innodb_buffer_pool_size"), "max_allowed_packet": new_config.get("max_allowed_packet"), "max_connections": str(new_config.get("max_connections")), "character-set-server": new_config.get("character_set_server"), "collation-server": new_config.get("collation_server"), "default-storage-engine": new_config.get("default_storage_engine")}
        else:
            keys = {"port": str(new_config.get("port")), "listen_addresses": f"'{new_config.get('listen_addresses')}'", "shared_buffers": f"'{new_config.get('shared_buffers')}'", "work_mem": f"'{new_config.get('work_mem')}'", "maintenance_work_mem": f"'{new_config.get('maintenance_work_mem')}'", "effective_cache_size": f"'{new_config.get('effective_cache_size')}'", "max_connections": str(new_config.get("max_connections")), "timezone": f"'{new_config.get('timezone')}'"}
            
        new_lines, found_keys = [], set()
        for line in lines:
            updated = False
            for k, v in keys.items():
                if line.strip().startswith(k) and not line.strip().startswith('#'):
                    new_lines.append(f"{k} = {v}\n")
                    found_keys.add(k)
                    updated = True
                    break
            if not updated: new_lines.append(line)
        
        if db_obj['engine'] == 'mysql':
            if not any("[mysqld]" in l for l in new_lines): new_lines.insert(0, "[mysqld]\n")
            idx = new_lines.index(next(l for l in new_lines if "[mysqld]" in l)) + 1
            for k, v in keys.items():
                if k not in found_keys and v is not None: new_lines.insert(idx, f"{k} = {v}\n")
        else:
            for k, v in keys.items():
                if k not in found_keys and v is not None: new_lines.append(f"{k} = {v}\n")

        with open(conf_file, 'w', encoding='utf-8') as f: f.writelines(new_lines)

        msg = "Konfigurasi berhasil disimpan."
        if was_running:
            self.stop_database(db_id)
            time.sleep(1) 
            msg += " Database telah direstart." if self.start_database(db_id).get('status') == 'success' else " Namun gagal start ulang."
        else:
            msg += " Silakan Start DB untuk menerapkan."

        if hasattr(self, 'api'): self.api.emit_log(msg, "success")
        return {"status": "success", "message": msg}
    
    def change_db_credentials(self, db_id: str, username: str, old_pass: str, new_pass: str):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "Database tidak ditemukan."}
        if not check_port_in_use(db_obj['port']): return {"status": "error", "message": "Database harus berjalan (Start DB)."}

        try:
            if db_obj['engine'] == 'mysql':
                exe = os.path.join(db_obj['installDir'], 'bin', 'mysql.exe' if sys.platform == 'win32' else 'mysql')
                cmd = [exe, "-u", username, f"-P{db_obj['port']}", "-h", "127.0.0.1"]
                if old_pass: cmd.append(f"-p{old_pass}")
                cmd.extend(["-e", f"ALTER USER '{username}'@'localhost' IDENTIFIED BY '{new_pass}'; FLUSH PRIVILEGES;"])
                
                result = run_silent_command(cmd)
                if result.returncode != 0: return {"status": "error", "message": "Gagal MySQL: " + result.stderr.strip()}

            elif db_obj['engine'] == 'postgres':
                exe = os.path.join(db_obj['installDir'], 'bin', 'psql.exe' if sys.platform == 'win32' else 'psql')
                env = os.environ.copy()
                if old_pass: env['PGPASSWORD'] = old_pass
                cmd = [exe, "-U", username, "-p", str(db_obj['port']), "-h", "127.0.0.1", "-c", f"ALTER ROLE {username} WITH PASSWORD '{new_pass}';"]
                
                result = run_silent_command(cmd, env=env)
                if result.returncode != 0: return {"status": "error", "message": "Gagal PostgreSQL: " + result.stderr.strip()}

            if hasattr(self, 'api'): self.api.emit_log("Kredensial berhasil diperbarui.", "success")
            return {"status": "success", "message": "Password berhasil diperbarui!"}
        except Exception as e:
            return {"status": "error", "message": f"Sistem Error: {str(e)}"}
        
    # ==========================================
    # MASTER CONTROLLER (UNIVERSAL SERVICE STANDARD)
    # ==========================================
    def check_is_running(self):
        for v in list(self.processes.keys()):
            if self.processes[v].poll() is not None:
                self.processes.pop(v, None)
        return len(self.processes) > 0

    def _get_preferred_dbs(self, dbs):
        dashboard_json = os.path.join(self.data_dir, 'dashboard.json')
        selected = read_json(dashboard_json, dict).get('selected_database', [])
        valid = [db['id'] for db in dbs if db['id'] in selected]
        if valid: return valid
            
        fallback = []
        mysql_dbs = sorted([db for db in dbs if db['engine'] == 'mysql'], key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        if mysql_dbs: fallback.append(mysql_dbs[0]['id'])
            
        pg_dbs = sorted([db for db in dbs if db['engine'] == 'postgres'], key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        if pg_dbs: fallback.append(pg_dbs[0]['id'])
        return fallback

    def start_all(self):
        dbs = self.get_installed().get('data', [])
        if not dbs: return {"status": "error", "message": "Tidak ada database terinstal."}
            
        target_ids, success = self._get_preferred_dbs(dbs), 0
        for db in dbs:
            if db['id'] in target_ids and not check_port_in_use(db['port']):
                if self.start_database(db['id']).get('status') == 'success': success += 1
        
        if success > 0: return {"status": "success", "message": f"{success} Database berjalan."}
        return {"status": "success", "message": "Database sudah berjalan."} if self.check_is_running() else {"status": "error", "message": "Gagal memulai."}

    def stop_all(self):
        dbs, stopped = self.get_installed().get('data', []), 0
        for db in dbs:
            if db['id'] in self._get_preferred_dbs(dbs) and check_port_in_use(db['port']):
                self.stop_database(db['id'])
                stopped += 1
        return {"status": "success", "message": f"{stopped} Database dihentikan." if stopped > 0 else "Tidak ada yang berjalan."}