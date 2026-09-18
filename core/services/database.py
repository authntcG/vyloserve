import os
import sys
import urllib.request
import re
import shutil
import concurrent.futures
import time
import subprocess
from typing import Optional

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, check_port_in_use, start_silent_process, run_silent_command
from core.utils.file_utils import read_json, write_json, download_advanced, extract_archive

DB_NOT_FOUND_MSG = "backend.database.not_found"
USER_AGENT_MOZILLA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
MY_INI = "my.ini"
POSTGRESQL_CON = "postgresql.conf"
MYSQLD_SECTION = "[mysqld]"

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

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg)

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
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    # ==========================================
    # START / STOP CONTROLLER (SILENT SUBPROCESS)
    # ==========================================
    def _wait_for_startup(self, db_obj: dict, log_f) -> dict:
        db_id = db_obj['id']
        log_path = os.path.join(db_obj['dataDir'], "db_startup.log")
        
        for _ in range(150):
            if check_port_in_use(db_obj['port']):
                self._log("backend.database.engine_running", "success", {"name": db_obj["name"], "port": db_obj["port"]})
                try: log_f.close()
                except Exception: pass
                return {"status": "success", "message": "backend.database.started_success", "args": {"name": db_obj["name"]}}
            
            if self.processes[db_id].poll() is not None:
                log_f.close()
                try:
                    with open(log_path, 'r', encoding='utf-8') as rf:
                        err_msg = rf.read().strip()[-250:]
                except Exception: 
                    err_msg = "Unknown error (log unreadable)"
                
                self._log("backend.database.process_crashed_log", "error", {"err": err_msg})
                return {"status": "error", "message": "backend.database.crashed_on_startup", "args": {"err": err_msg}}
            
            time.sleep(0.1)

        try: log_f.close()
        except Exception: pass
        return {"status": "error", "message": "backend.database.timeout_starting"}

    def start_database(self, db_id: str):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        if check_port_in_use(db_obj['port']):
            return {"status": "error", "message": "backend.database.port_in_use", "args": {"port": db_obj["port"]}}

        try:
            _, cmd = self._build_startup_cmd(db_obj)
            log_path = os.path.join(db_obj['dataDir'], "db_startup.log")
            log_f = open(log_path, 'w', encoding='utf-8')
            
            import subprocess
            from core.utils.system_utils import get_silent_flags
            self.processes[db_id] = subprocess.Popen(
                cmd, creationflags=get_silent_flags(), stdout=log_f, stderr=log_f
            )

            return self._wait_for_startup(db_obj, log_f)
            
        except Exception as e:
            try: log_f.close()
            except Exception: pass
            return {"status": "error", "message": "backend.database.start_failed", "args": {"e": str(e)}}

    def _build_startup_cmd(self, db_obj: dict) -> tuple:
        engine = db_obj['engine']
        install_dir = db_obj['installDir']
        data_dir = db_obj['dataDir']
        
        if engine == 'mysql':
            exe = os.path.join(install_dir, 'bin', 'mysqld.exe' if sys.platform == 'win32' else 'mysqld')
            cmd = [exe, f"--datadir={data_dir}", f"--port={db_obj['port']}"]
        else:
            exe = os.path.join(install_dir, 'bin', 'postgres.exe' if sys.platform == 'win32' else 'postgres')
            cmd = [exe, "-D", data_dir, "-p", str(db_obj['port'])]
            
        return exe, cmd

    def _kill_process(self, db_id: str):
        if db_id in self.processes:
            proc = self.processes[db_id]
            if proc.poll() is None:
                proc.terminate()
                try: proc.wait(timeout=5)
                except Exception: proc.kill()
            self.processes.pop(db_id, None)

    def _graceful_shutdown(self, db_obj: dict):
        install_dir, data_dir = db_obj['installDir'], db_obj['dataDir']
        try:
            if db_obj['engine'] == 'postgres':
                exe = os.path.join(install_dir, 'bin', 'pg_ctl.exe' if sys.platform == 'win32' else 'pg_ctl')
                run_silent_command([exe, "-D", data_dir, "stop"])
            elif db_obj['engine'] == 'mysql':
                exe = os.path.join(install_dir, 'bin', 'mysqladmin.exe' if sys.platform == 'win32' else 'mysqladmin')
                run_silent_command([exe, "-u", "root", f"--port={db_obj['port']}", "shutdown"])
        except Exception: pass

    def stop_database(self, db_id: str):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)

        self._kill_process(db_id)

        if db_obj and check_port_in_use(db_obj['port']):
            self._graceful_shutdown(db_obj)

        if hasattr(self, 'api') and db_obj: 
            self._log("backend.database.engine_stopped", "warn", {"name": db_obj["name"]})
        return {"status": "success", "message": "backend.database.stopped_success"}

    # ==========================================
    # OS-AWARE ONLINE VERSION FETCHER
    # ==========================================
    def get_available_versions(self, engine: str):
        try:
            self._log("backend.database.checking_releases", "info", {"engine": engine})
            if engine == 'mysql': return self._fetch_mariadb_versions()
            elif engine == 'postgres': return self._fetch_postgres_versions()
            return {"status": "error", "message": "backend.database.engine_unsupported"}
        except Exception as e:
            return {"status": "error", "message": "backend.database.fetch_versions_failed", "args": {"e": str(e)}}

    def _resolve_mariadb_url(self, version: str) -> str:
        base_url = f"https://archive.mariadb.org/mariadb-{version}/"
        try:
            req = urllib.request.Request(base_url, headers={'User-Agent': USER_AGENT_MOZILLA})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception:
            raise RuntimeError(f"Folder mariadb-{version} tidak ditemukan.")
            
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
            target_html = urllib.request.urlopen(urllib.request.Request(folder_url, headers={'User-Agent': USER_AGENT_MOZILLA}), timeout=10).read().decode('utf-8')
            
        for f in re.findall(ext_pattern, target_html, re.IGNORECASE):
            if 'debugsymbols' not in f.lower() and 'test' not in f.lower():
                return folder_url + f
        raise RuntimeError("Binary untuk OS ini belum tersedia.")

    def _fetch_mariadb_versions(self):
        req = urllib.request.Request("https://archive.mariadb.org/", headers={'User-Agent': USER_AGENT_MOZILLA})
        try: html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

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
            except Exception: return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(check_resolve, latest_versions_dict[mm]['full_version']) for mm in sorted_mm]
            for f in concurrent.futures.as_completed(futures):
                if f.result(): results.append(f.result())
                    
        results.sort(key=lambda x: [int(i) for i in x['version'].split('.')], reverse=True)
        return {"status": "success", "data": results}

    def _parse_postgres_block(self, block: str, os_target: str, seen: set, results: list):
        if "(not supported)" in block[:200].lower(): return
        v_match = re.search(r'Version.*?([\d\.]+)', block[:200], re.IGNORECASE)
        if not v_match: return
        
        link_match = re.search(fr'href="([^"]+)">\s*<img[^>]*alt="{os_target}"', block, re.IGNORECASE)
        if link_match:
            link = link_match.group(1)
            if not link.startswith('http'):
                if link.startswith('//'): link = "https:" + link
                else: link = f"https://www.enterprisedb.com/{link.lstrip('/')}"
            
            version = v_match.group(1)
            if version not in seen:
                seen.add(version)
                results.append({"version": version, "url": link, "name": f"PostgreSQL {version}"})

    def _fetch_postgres_versions(self):
        req = urllib.request.Request("https://www.enterprisedb.com/download-postgresql-binaries", headers={'User-Agent': USER_AGENT_MOZILLA})
        try: html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

        if sys.platform == 'win32': os_target = "Windows x86-64"
        elif sys.platform == 'darwin': os_target = "Mac OS X"
        else: os_target = "Linux x86-64"
        
        results, seen = [], set()
        for block in html.split("Binaries from installer")[1:]:
            self._parse_postgres_block(block, os_target, seen, results)

        results.sort(key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        return {"status": "success", "data": results}

    def _init_database(self, engine: str, install_dir: str, db_data_dir: str, root_pass: str):
        os.makedirs(db_data_dir, exist_ok=True)
        
        if engine == 'mysql':
            installer = os.path.join(install_dir, 'bin', 'mysql_install_db.exe' if sys.platform == 'win32' else 'mysql_install_db')
            res = run_silent_command([installer, f"--datadir={db_data_dir}"])
            if res.returncode != 0: raise RuntimeError(f"MariaDB Init Error: {res.stderr}")
        else:
            pw_file = os.path.join(install_dir, 'pw.txt')
            with open(pw_file, 'w') as f: f.write(root_pass if root_pass else 'root')
            installer = os.path.join(install_dir, 'bin', 'initdb.exe' if sys.platform == 'win32' else 'initdb')
            res = run_silent_command([installer, "-D", db_data_dir, "-U", "postgres", f"--pwfile={pw_file}", "--encoding=UTF8"])
            if os.path.exists(pw_file): os.remove(pw_file)
            if res.returncode != 0: raise RuntimeError(f"PostgreSQL Init Error: {res.stderr}")

    def _unwrap_single_subdir(self, install_dir: str):
        extracted_subdirs = os.listdir(install_dir)
        if len(extracted_subdirs) == 1 and os.path.isdir(os.path.join(install_dir, extracted_subdirs[0])):
            inner = os.path.join(install_dir, extracted_subdirs[0])
            for item in os.listdir(inner): shutil.move(os.path.join(inner, item), install_dir)
            os.rmdir(inner)

    def _register_database(self, db_id, engine, version, port, db_data_dir, install_dir):
        data = read_json(self.config_path)
        data.append({
            "id": db_id, "name": f"{'MariaDB' if engine == 'mysql' else 'PostgreSQL'} {version}",
            "engine": engine, "version": version, "port": int(port),
            "dataDir": db_data_dir, "installDir": install_dir
        })
        write_json(self.config_path, data)

    def _cleanup_install_failure(self, zip_path, install_dir, is_existing_data, db_data_dir):
        if os.path.exists(zip_path): 
            try: os.remove(zip_path)
            except Exception: pass
        if os.path.exists(install_dir): shutil.rmtree(install_dir, ignore_errors=True)
        if not is_existing_data and os.path.exists(db_data_dir): shutil.rmtree(db_data_dir, ignore_errors=True)

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
            self._log("backend.database.initiating_install", "info", {"engine": engine, "version": version, "port": port})
            if os.path.exists(install_dir):
                return {"status": "error", "message": "backend.database.already_installed", "args": {"engine": engine, "version": version}}

            if engine == 'mysql':
                self._progress(2, "backend.database.tracking_mariadb")
                url = self._resolve_mariadb_url(version)

            def log_cb(msg, lvl): 
                self._log(msg, lvl)
            def prog_cb(pct, msg): 
                if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg)

            download_advanced(url, zip_path, log_cb=log_cb, progress_cb=prog_cb)

            self._log("backend.database.download_complete_extracting", "info")
            self._progress(65, "backend.database.extracting_zip")
            
            extract_archive(zip_path, install_dir, progress_cb=prog_cb)
            os.remove(zip_path)

            self._unwrap_single_subdir(install_dir)

            if is_existing_data:
                self._log("backend.database.data_dir_filled_skipping_init", "success", {"db_id": db_id})
            else:
                self._log("backend.database.preparing_raw_schema", "info")
                self._init_database(engine, install_dir, db_data_dir, root_pass)

            self._register_database(db_id, engine, version, port, db_data_dir, install_dir)

            self._progress(100, "backend.database.installation_complete")
            self._log("backend.database.ready_to_use", "success", {"engine": engine, "version": version})
            return {"status": "success", "message": "backend.database.install_success", "args": {"engine": engine, "version": version}}

        except Exception as e:
            self._cleanup_install_failure(zip_path, install_dir, is_existing_data, db_data_dir)
                
            self._progress(-1, str(e))
            self._log("backend.database.install_failed_log", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def uninstall_database(self, db_id: str, delete_data: bool = False):
        try:
            data = read_json(self.config_path)
            db_to_remove = next((db for db in data if db['id'] == db_id), None)
            if not db_to_remove: return {"status": "error", "message": DB_NOT_FOUND_MSG}
                
            if check_port_in_use(db_to_remove['port']):
                return {"status": "error", "message": "backend.database.running_cannot_remove"}

            install_dir, data_dir = db_to_remove.get('installDir'), db_to_remove.get('dataDir')
            if install_dir and os.path.exists(install_dir): shutil.rmtree(install_dir, ignore_errors=True)
            if delete_data and data_dir and os.path.exists(data_dir): shutil.rmtree(data_dir, ignore_errors=True)
                
            data = [db for db in data if db['id'] != db_id]
            write_json(self.config_path, data)
            
            self._log("backend.database.engine_removed_log", "success", {"name": db_to_remove["name"]})
            return {"status": "success", "message": "backend.database.removed_success"}
        except Exception as e:
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
        
    # ==========================================
    # DATABASE CONFIGURATION & CREDENTIALS
    # ==========================================
    def open_path(self, db_id: str, is_file: bool = False):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        if is_file:
            target = os.path.join(db_obj['dataDir'], MY_INI if db_obj['engine'] == 'mysql' else POSTGRESQL_CON)
        else:
            target = db_obj['dataDir']
        if is_file and db_obj['engine'] == 'mysql' and not os.path.exists(target):
            with open(target, 'w', encoding='utf-8') as f: f.write(MYSQLD_SECTION)

        if not os.path.exists(target): return {"status": "error", "message": "backend.database.target_not_created"}

        try:
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success", "message": "backend.database.opened_success"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def _parse_mysql_config(self, conf_file: str, config: dict):
        if not os.path.exists(conf_file): return
        
        keys_map = {
            'bind-address': 'bind_address',
            'innodb_buffer_pool_size': 'innodb_buffer_pool_size',
            'max_allowed_packet': 'max_allowed_packet',
            'max_connections': 'max_connections',
            'character-set-server': 'character_set_server',
            'collation-server': 'collation_server',
            'default-storage-engine': 'default_storage_engine'
        }
        
        with open(conf_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#'): continue
                
                for k_file, k_dict in keys_map.items():
                    if line.startswith(k_file):
                        config[k_dict] = line.split('=')[1].strip()
                        break

    def _parse_postgres_config(self, conf_file: str, config: dict):
        if not os.path.exists(conf_file): return
        
        keys_map = {
            'listen_addresses': 'listen_addresses',
            'shared_buffers': 'shared_buffers',
            'work_mem': 'work_mem',
            'maintenance_work_mem': 'maintenance_work_mem',
            'effective_cache_size': 'effective_cache_size',
            'max_connections': 'max_connections',
            'timezone': 'timezone'
        }
        
        with open(conf_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#'): continue
                
                for k_file, k_dict in keys_map.items():
                    if line.startswith(k_file):
                        raw_val = line.split('=')[1].strip()
                        if '#' in raw_val: raw_val = raw_val.split('#')[0].strip()
                        config[k_dict] = raw_val.strip("'").strip('"')
                        break

    def get_db_config(self, db_id: str):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        engine, data_dir = db_obj['engine'], db_obj['dataDir']
        config = {"port": db_obj.get("port")}

        if engine == 'mysql':
            config.update({"bind_address": "127.0.0.1", "innodb_buffer_pool_size": "256M", "max_allowed_packet": "64M", "max_connections": "151", "character_set_server": "utf8mb4", "collation_server": "utf8mb4_unicode_ci", "default_storage_engine": "InnoDB"})
            self._parse_mysql_config(os.path.join(data_dir, MY_INI), config)
        else:
            config.update({"listen_addresses": "*", "shared_buffers": "128MB", "work_mem": "4MB", "maintenance_work_mem": "64MB", "effective_cache_size": "256MB", "max_connections": "100", "timezone": "UTC"})
            self._parse_postgres_config(os.path.join(data_dir, POSTGRESQL_CON), config)
            
        return {"status": "success", "config": config}

    def _process_config_line(self, line: str, keys: dict, found_keys: set) -> Optional[str]:
        for k, v in keys.items():
            if line.strip().startswith(k) and not line.strip().startswith('#'):
                found_keys.add(k)
                return f"{k} = {v}\n"
        return line

    def _insert_mysql_keys(self, new_lines: list, keys: dict, found_keys: set):
        if not any(MYSQLD_SECTION in l for l in new_lines): new_lines.insert(0, MYSQLD_SECTION)
        idx = new_lines.index(next(l for l in new_lines if MYSQLD_SECTION in l)) + 1
        for k, v in keys.items():
            if k not in found_keys and v is not None: new_lines.insert(idx, f"{k} = {v}\n")

    def _update_config_lines(self, lines: list, keys: dict, is_mysql: bool) -> list:
        new_lines, found_keys = [], set()
        for line in lines:
            new_lines.append(self._process_config_line(line, keys, found_keys))
        
        if is_mysql:
            self._insert_mysql_keys(new_lines, keys, found_keys)
        else:
            for k, v in keys.items():
                if k not in found_keys and v is not None: new_lines.append(f"{k} = {v}\n")
                
        return new_lines

    def save_db_config(self, db_id: str, new_config: dict):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        was_running = check_port_in_use(db_obj['port'])
        db_obj['port'] = int(new_config.get('port', db_obj['port']))
        write_json(self.config_path, data)

        is_mysql = db_obj['engine'] == 'mysql'
        conf_file = os.path.join(db_obj['dataDir'], MY_INI if is_mysql else POSTGRESQL_CON)
        lines = [MYSQLD_SECTION] if is_mysql else []
        if os.path.exists(conf_file):
            with open(conf_file, 'r', encoding='utf-8') as f: lines = f.readlines()

        if is_mysql:
            keys = {"port": str(new_config.get("port")), "bind-address": new_config.get("bind_address"), "innodb_buffer_pool_size": new_config.get("innodb_buffer_pool_size"), "max_allowed_packet": new_config.get("max_allowed_packet"), "max_connections": str(new_config.get("max_connections")), "character-set-server": new_config.get("character_set_server"), "collation-server": new_config.get("collation_server"), "default-storage-engine": new_config.get("default_storage_engine")}
        else:
            keys = {"port": str(new_config.get("port")), "listen_addresses": f"'{new_config.get('listen_addresses')}'", "shared_buffers": f"{new_config.get('shared_buffers')}", "work_mem": f"{new_config.get('work_mem')}", "maintenance_work_mem": f"{new_config.get('maintenance_work_mem')}", "effective_cache_size": f"{new_config.get('effective_cache_size')}", "max_connections": str(new_config.get("max_connections")), "timezone": f"'{new_config.get('timezone')}'"}
            
        new_lines = self._update_config_lines(lines, keys, is_mysql)

        with open(conf_file, 'w', encoding='utf-8') as f: f.writelines(new_lines)

        if was_running:
            self.stop_database(db_id)
            time.sleep(1)
            msg_key = "backend.database.config_saved_restarted" if self.start_database(db_id).get('status') == 'success' else "backend.database.config_saved_restart_failed"
        else:
            msg_key = "backend.database.config_saved_pending"

        self._log(msg_key, "success")
        return {"status": "success", "message": msg_key}
    
    def _change_mysql_credentials(self, db_obj: dict, username: str, old_pass: str, new_pass: str):
        exe = os.path.join(db_obj['installDir'], 'bin', 'mysql.exe' if sys.platform == 'win32' else 'mysql')
        cmd = [exe, "-u", username, f"-P{db_obj['port']}", "-h", "127.0.0.1"]
        if old_pass: cmd.append(f"-p{old_pass}")
        cmd.extend(["-e", f"ALTER USER '{username}'@'localhost' IDENTIFIED BY '{new_pass}'; FLUSH PRIVILEGES;"])
        
        result = run_silent_command(cmd)
        if result.returncode != 0: raise RuntimeError(f"backend.database.mysql_fail|{result.stderr.strip()}")

    def _change_postgres_credentials(self, db_obj: dict, username: str, old_pass: str, new_pass: str):
        exe = os.path.join(db_obj['installDir'], 'bin', 'psql.exe' if sys.platform == 'win32' else 'psql')
        env = os.environ.copy()
        if old_pass: env['PGPASSWORD'] = old_pass
        cmd = [exe, "-U", username, "-p", str(db_obj['port']), "-h", "127.0.0.1", "-c", f"ALTER ROLE {username} WITH PASSWORD '{new_pass}';"]
        
        result = run_silent_command(cmd, env=env)
        if result.returncode != 0: raise RuntimeError(f"backend.database.postgres_fail|{result.stderr.strip()}")

    def change_db_credentials(self, db_id: str, username: str, old_pass: str, new_pass: str):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}
        if not check_port_in_use(db_obj['port']): return {"status": "error", "message": "backend.database.must_be_running"}

        try:
            if db_obj['engine'] == 'mysql':
                self._change_mysql_credentials(db_obj, username, old_pass, new_pass)
            elif db_obj['engine'] == 'postgres':
                self._change_postgres_credentials(db_obj, username, old_pass, new_pass)

            self._log("backend.database.credentials_updated_log", "success")
            return {"status": "success", "message": "backend.database.password_updated_success"}
        except RuntimeError as e:
            err_parts = str(e).split('|', 1)
            return {"status": "error", "message": err_parts[0], "args": {"err": err_parts[1] if len(err_parts) > 1 else ""}}
        except Exception as e:
            return {"status": "error", "message": "backend.database.system_error", "args": {"e": str(e)}}
        
    # ==========================================
    # MASTER CONTROLLER (UNIVERSAL SERVICE STANDARD)
    # ==========================================
    def check_is_running(self):
        for v in tuple(self.processes):
            if self.processes[v].poll() is not None:
                self.processes.pop(v, None)
        return len(self.processes) > 0

    def _get_preferred_dbs(self, dbs):
        dashboard_json = os.path.join(self.data_dir, 'dashboard.json')
        dashboard_data = read_json(dashboard_json, dict)
        # read_json() TIDAK menjamin dict hanya karena default_type=dict -- parameter itu
        # cuma dipakai saat file kosong/tidak ada. Jika isi file valid JSON tapi bukan objek
        # (mis. string sisa dari file lama/rusak), .get() langsung akan melempar
        # AttributeError "'str' object has no attribute 'get'". Lihat docs/known_bugs.md.
        selected = dashboard_data.get('selected_database', []) if isinstance(dashboard_data, dict) else []
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
        if not dbs: return {"status": "error", "message": "backend.database.none_installed"}
            
        target_ids, success = self._get_preferred_dbs(dbs), 0
        for db in dbs:
            if db['id'] in target_ids and not check_port_in_use(db['port']):
                if self.start_database(db['id']).get('status') == 'success': success += 1
        
        if success > 0: return {"status": "success", "message": "backend.database.multi_running", "args": {"count": success}}
        return {"status": "success", "message": "backend.database.already_running"} if self.check_is_running() else {"status": "error", "message": "backend.database.start_failed"}

    def stop_all(self):
        dbs, stopped = self.get_installed().get('data', []), 0
        for db in dbs:
            if db['id'] in self._get_preferred_dbs(dbs) and check_port_in_use(db['port']):
                self.stop_database(db['id'])
                stopped += 1
        return {"status": "success", "message": "backend.database.multi_stopped" if stopped > 0 else "backend.database.none_running", "args": {"count": stopped}}
