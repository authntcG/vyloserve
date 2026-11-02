import os
import sys
import glob
import urllib.request
import re
import shutil
import concurrent.futures
import time
import subprocess
import json
from typing import Optional

# ---> IMPORT UTILITIES (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, check_port_in_use, start_silent_process, run_silent_command, get_silent_flags
from core.utils.file_utils import (
    read_json, write_json, download_advanced, extract_archive,
    read_log_tail, read_new_lines, parse_ini_key_values
)
from core.utils.network_utils import is_network_error
from core.utils.cancellation import InstallationManager, OperationCancelledError

DB_NOT_FOUND_MSG = "backend.database.not_found"
MSG_UNEXPECTED_ERROR = "backend.error.unexpected"
USER_AGENT_MOZILLA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
MY_INI = "my.ini"
POSTGRESQL_CON = "postgresql.conf"
REDIS_CONF = "redis.conf"
MYSQLD_SECTION = "[mysqld]"
DB_STARTUP_LOG = "db_startup.log"
SCHEMA_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{1,64}$')
SYSTEM_SCHEMAS = {'information_schema', 'performance_schema', 'mysql', 'sys', 'postgres', 'template0', 'template1'}
MARIADB_CACHE_TTL_SECONDS = 43200  # 12 jam

class DatabaseManager:
    """Manager untuk siklus hidup Engine Database (MySQL, MariaDB, PostgreSQL, Redis)"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.bin_dir = os.path.join(self.root_dir, 'bin', 'database') 
        self.config_path = os.path.join(self.data_dir, 'databases.json')
        self.processes = {}
        self._log_offsets: dict = {}
        self._mariadb_cache = None
        self._mariadb_cache_time = 0.0
        self._resolved_urls_cache = {}
        self._cache_dir = os.path.join(self.data_dir, 'cache')
        self._mariadb_cache_file = os.path.join(self._cache_dir, 'mariadb_versions.json')

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

    def _enrich_db_status(self, db: dict) -> dict:
        if not isinstance(db, dict):
            return db

        engine = str(db.get('engine') or 'mysql').lower()
        db['engine'] = engine

        if not db.get('version'):
            db['version'] = ''

        if not db.get('name'):
            capitalized_engine = 'PostgreSQL' if engine == 'postgres' else ('MySQL' if engine == 'mysql' else ('Redis' if engine == 'redis' else engine.capitalize()))
            db['name'] = f"{capitalized_engine} {db['version']}".strip() or capitalized_engine

        db_id = str(db.get('id') or 'db_instance')
        db['id'] = db_id

        if not db.get('dataDir'):
            db['dataDir'] = os.path.join(self.bin_dir, db_id)

        port = db.get('port')
        if not port:
            if engine == 'mysql':
                port = 3306
            elif engine == 'redis':
                port = 6379
            else:
                port = 5432
            db['port'] = port
        else:
            try:
                db['port'] = int(port)
            except (ValueError, TypeError):
                db['port'] = 3306

        if db_id in self.processes and self.processes[db_id].poll() is None:
            db['status'] = 'running'
            return db

        db['status'] = 'running' if check_port_in_use(db['port']) else 'stopped'
        return db

    def get_installed(self):
        try:
            data = read_json(self.config_path)
            if not data: return {"status": "success", "data": []}

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                data = list(executor.map(self._enrich_db_status, data))

            return {"status": "success", "data": data}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    # ==========================================
    # START / STOP CONTROLLER (SILENT SUBPROCESS)
    # ==========================================
    @staticmethod
    def _read_startup_crash_log(log_path: str) -> str:
        try:
            with open(log_path, 'r', encoding='utf-8') as rf:
                return rf.read().strip()[-250:]
        except Exception:
            return "Unknown error (log unreadable)"

    def _wait_for_startup(self, db_obj: dict, log_f) -> dict:
        db_id = db_obj['id']
        log_path = os.path.join(db_obj['dataDir'], DB_STARTUP_LOG)
        
        for _ in range(150):
            if check_port_in_use(db_obj['port']):
                self._log("backend.database.engine_running", "success", {"name": db_obj["name"], "port": db_obj["port"]})
                try: log_f.close()
                except Exception: pass
                return {"status": "success", "message": "backend.database.started_success", "args": {"name": db_obj["name"]}}
            
            if self.processes[db_id].poll() is not None:
                log_f.close()
                err_msg = self._read_startup_crash_log(log_path)
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
            log_path = os.path.join(db_obj['dataDir'], DB_STARTUP_LOG)
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

    def _resolve_db_cli(self, db_obj: dict, name: str) -> Optional[str]:
        install_dir = db_obj.get('installDir', '')
        if not install_dir or not os.path.exists(install_dir):
            return None
        candidates = [
            os.path.join(install_dir, 'bin', name),
            os.path.join(install_dir, 'bin', f"{name}.exe"),
            os.path.join(install_dir, name),
            os.path.join(install_dir, f"{name}.exe")
        ]
        for c in candidates:
            if os.path.exists(c) and os.path.isfile(c):
                return c
        return None

    def _resolve_password(self, db_obj: dict, password: str = "") -> str:
        if password:
            return password
        return db_obj.get('rootPassword', '')

    def _build_startup_cmd(self, db_obj: dict) -> tuple:
        engine = db_obj['engine']
        install_dir = db_obj['installDir']
        data_dir = db_obj['dataDir']
        
        if engine == 'mysql':
            exe = os.path.join(install_dir, 'bin', 'mysqld.exe' if sys.platform == 'win32' else 'mysqld')
            cmd = [exe, f"--datadir={data_dir}", f"--port={db_obj['port']}"]
        elif engine == 'redis':
            exe_name = 'redis-server.exe' if sys.platform == 'win32' else 'redis-server'
            exe = self._resolve_db_cli(db_obj, exe_name) or os.path.join(install_dir, exe_name)
            conf_file = os.path.join(data_dir, REDIS_CONF)
            if not os.path.exists(conf_file):
                self._init_redis(install_dir, data_dir)
            cmd = [exe, conf_file, "--port", str(db_obj['port']), "--dir", data_dir]
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
            elif db_obj['engine'] == 'redis':
                cli_name = 'redis-cli.exe' if sys.platform == 'win32' else 'redis-cli'
                exe = self._resolve_db_cli(db_obj, cli_name) or os.path.join(install_dir, cli_name)
                if os.path.exists(exe):
                    run_silent_command([exe, "-p", str(db_obj['port']), "shutdown", "nosave"])
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
            elif engine == 'redis': return self._fetch_redis_versions()
            return {"status": "error", "message": "backend.database.engine_unsupported"}
        except Exception as e:
            return {"status": "error", "message": "backend.database.fetch_versions_failed", "args": {"e": str(e)}}

    def _get_cached_mariadb_versions(self, allow_stale: bool = False):
        now = time.time()
        if self._mariadb_cache and (allow_stale or (now - self._mariadb_cache_time < MARIADB_CACHE_TTL_SECONDS)):
            return list(self._mariadb_cache)

        try:
            if os.path.exists(self._mariadb_cache_file):
                cached_data = read_json(self._mariadb_cache_file, dict)
                if isinstance(cached_data, dict):
                    saved_time = cached_data.get("timestamp", 0)
                    versions = cached_data.get("data", [])
                    if isinstance(versions, list) and versions:
                        if allow_stale or (now - saved_time < MARIADB_CACHE_TTL_SECONDS):
                            self._mariadb_cache = versions
                            self._mariadb_cache_time = saved_time
                            return list(versions)
        except Exception:
            pass
        return None

    def _save_cached_mariadb_versions(self, versions: list):
        try:
            now = time.time()
            self._mariadb_cache = list(versions)
            self._mariadb_cache_time = now
            os.makedirs(self._cache_dir, exist_ok=True)
            write_json(self._mariadb_cache_file, {
                "timestamp": now,
                "data": versions
            })
        except Exception:
            pass

    def _resolve_mariadb_url(self, version: str) -> str:
        if hasattr(self, '_resolved_urls_cache') and version in self._resolved_urls_cache:
            return self._resolved_urls_cache[version]

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
                resolved = folder_url + f
                if hasattr(self, '_resolved_urls_cache'):
                    self._resolved_urls_cache[version] = resolved
                return resolved
        raise RuntimeError("Binary untuk OS ini belum tersedia.")

    def _fetch_mariadb_versions(self, force_refresh: bool = False):
        if not force_refresh:
            cached = self._get_cached_mariadb_versions(allow_stale=False)
            if cached:
                return {"status": "success", "data": cached}

        req = urllib.request.Request("https://archive.mariadb.org/", headers={'User-Agent': USER_AGENT_MOZILLA})
        try:
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        except Exception as e:
            # Fallback ke cache kadaluarsa (stale) jika jaringan bermasalah
            stale = self._get_cached_mariadb_versions(allow_stale=True)
            if stale:
                return {"status": "success", "data": stale}
            res = {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
            if is_network_error(e):
                res["is_offline"] = True
            return res

        raw_versions = list(set(re.findall(r'href="mariadb-(\d+\.\d+\.\d+)/"', html)))
        latest_versions_dict = {}
        for v in raw_versions:
            parts = v.split('.')
            if len(parts) == 3:
                major_minor, patch = f"{parts[0]}.{parts[1]}", int(parts[2])
                if major_minor not in latest_versions_dict or patch > latest_versions_dict[major_minor]['patch']:
                    latest_versions_dict[major_minor] = {'patch': patch, 'full_version': v}
                    
        sorted_mm = sorted(latest_versions_dict.keys(), key=lambda x: [int(i) for i in x.split('.')], reverse=True)

        # Filter rilis modern (>= 10.4) dan batasi ke 12 cabang teratas untuk menghindari N+1 crawl cabang purba
        filtered_mm = [mm for mm in sorted_mm if [int(i) for i in mm.split('.')] >= [10, 4]]
        target_mm = (filtered_mm if filtered_mm else sorted_mm)[:12]

        results = []

        def check_resolve(v):
            try: return {"version": v, "url": self._resolve_mariadb_url(v), "name": f"MariaDB {v}"}
            except Exception: return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(check_resolve, latest_versions_dict[mm]['full_version']) for mm in target_mm]
            for f in concurrent.futures.as_completed(futures):
                if f.result(): results.append(f.result())
                    
        results.sort(key=lambda x: [int(i) for i in x['version'].split('.')], reverse=True)
        if results:
            self._save_cached_mariadb_versions(results)
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
        except Exception as e:
            res = {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
            if is_network_error(e):
                res["is_offline"] = True
            return res

        if sys.platform == 'win32': os_target = "Windows x86-64"
        elif sys.platform == 'darwin': os_target = "Mac OS X"
        else: os_target = "Linux x86-64"
        
        results, seen = [], set()
        for block in html.split("Binaries from installer")[1:]:
            self._parse_postgres_block(block, os_target, seen, results)

        results.sort(key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        return {"status": "success", "data": results}

    def _fetch_redis_versions(self):
        req = urllib.request.Request("https://api.github.com/repos/tporadowski/redis/releases", headers={'User-Agent': USER_AGENT_MOZILLA})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            res = {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
            if is_network_error(e):
                res["is_offline"] = True
            return res

        results = []
        if isinstance(data, list):
            for rel in data:
                if rel.get('prerelease') or rel.get('draft'):
                    continue
                tag = rel.get('tag_name', '').lstrip('v').lstrip('V')
                for asset in rel.get('assets', []):
                    name = asset.get('name', '')
                    if name.endswith('.zip') and ('x64' in name.lower() or 'win' in name.lower() or 'redis' in name.lower()):
                        results.append({
                            "version": tag,
                            "url": asset.get('browser_download_url'),
                            "name": f"Redis {tag}"
                        })
                        break
        return {"status": "success", "data": results}

    def _init_mariadb(self, install_dir: str, db_data_dir: str):
        exe_name = 'mysql_install_db.exe' if sys.platform == 'win32' else 'mysql_install_db'
        installer = os.path.join(install_dir, 'bin', exe_name)
        if not os.path.exists(installer):
            raise RuntimeError(f"MariaDB Init Error: installer tidak ditemukan di {installer}")
        res = run_silent_command([installer, f"--datadir={db_data_dir}"])
        if res.returncode != 0:
            raise RuntimeError(f"MariaDB Init Error: {res.stderr}")

    def _init_redis(self, install_dir: str, db_data_dir: str):
        os.makedirs(db_data_dir, exist_ok=True)
        conf_path = os.path.join(db_data_dir, REDIS_CONF)
        if not os.path.exists(conf_path):
            default_conf = (
                "bind 127.0.0.1\n"
                "protected-mode yes\n"
                "port 6379\n"
                "timeout 0\n"
                "tcp-keepalive 300\n"
                "maxmemory 256mb\n"
                "maxmemory-policy noeviction\n"
                "databases 16\n"
                "appendonly no\n"
                "dir .\n"
            )
            with open(conf_path, 'w', encoding='utf-8') as f:
                f.write(default_conf)

    def _init_postgres(self, install_dir: str, db_data_dir: str, root_pass: str):
        exe_name = 'initdb.exe' if sys.platform == 'win32' else 'initdb'
        installer = os.path.join(install_dir, 'bin', exe_name)
        if not os.path.exists(installer):
            raise RuntimeError(f"PostgreSQL Init Error: installer tidak ditemukan di {installer}")
        pw_file = os.path.join(install_dir, 'pw.txt')
        with open(pw_file, 'w') as f:
            f.write(root_pass or 'root')
        try:
            res = run_silent_command([installer, "-D", db_data_dir, "-U", "postgres", f"--pwfile={pw_file}", "--encoding=UTF8"])
            if res.returncode != 0:
                raise RuntimeError(f"PostgreSQL Init Error: {res.stderr}")
        finally:
            if os.path.exists(pw_file):
                os.remove(pw_file)

    def _init_database(self, engine: str, install_dir: str, db_data_dir: str, root_pass: str):
        os.makedirs(db_data_dir, exist_ok=True)
        if engine == 'mysql':
            self._init_mariadb(install_dir, db_data_dir)
        elif engine == 'redis':
            self._init_redis(install_dir, db_data_dir)
        else:
            self._init_postgres(install_dir, db_data_dir, root_pass)

    def _unwrap_single_subdir(self, install_dir: str):
        extracted_subdirs = os.listdir(install_dir)
        if len(extracted_subdirs) == 1 and os.path.isdir(os.path.join(install_dir, extracted_subdirs[0])):
            inner = os.path.join(install_dir, extracted_subdirs[0])
            for item in os.listdir(inner): shutil.move(os.path.join(inner, item), install_dir)
            os.rmdir(inner)

    def _register_database(self, db_id, engine, version, port, db_data_dir, install_dir, root_pass: str = ""):
        data = read_json(self.config_path)
        data = [d for d in data if d["id"] != db_id]
        if engine == 'mysql':
            engine_name = 'MariaDB'
        elif engine == 'redis':
            engine_name = 'Redis'
        else:
            engine_name = 'PostgreSQL'
        entry = {
            "id": db_id, "name": f"{engine_name} {version}",
            "engine": engine, "version": version, "port": int(port),
            "dataDir": db_data_dir, "installDir": install_dir
        }
        if root_pass:
            entry["rootPassword"] = root_pass
        data.append(entry)
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
        token = InstallationManager.get_token("database")

        try:
            self._log("backend.database.initiating_install", "info", {"engine": engine, "version": version, "port": port})
            if os.path.exists(install_dir):
                return {"status": "error", "message": "backend.database.already_installed", "args": {"engine": engine, "version": version}}

            if engine == 'mysql':
                self._progress(2, "backend.database.tracking_mariadb")
                url = self._resolve_mariadb_url(version)

            def log_cb(msg, lvl): 
                self._log(msg, lvl)
            def prog_cb(pct, msg, args=None):
                if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg, args)

            download_advanced(url, zip_path, log_cb=log_cb, progress_cb=prog_cb, cancel_check=token.is_cancelled)

            self._log("backend.database.download_complete_extracting", "info")
            self._progress(65, "backend.database.extracting_zip")
            
            extract_archive(zip_path, install_dir, progress_cb=prog_cb, cancel_check=token.is_cancelled)
            if os.path.exists(zip_path):
                os.remove(zip_path)

            self._unwrap_single_subdir(install_dir)

            if is_existing_data:
                self._log("backend.database.data_dir_filled_skipping_init", "success", {"db_id": db_id})
            else:
                self._log("backend.database.preparing_raw_schema", "info")
                self._init_database(engine, install_dir, db_data_dir, root_pass)

            self._register_database(db_id, engine, version, port, db_data_dir, install_dir, root_pass=root_pass)

            self._progress(100, "backend.database.installation_complete")
            self._log("backend.database.ready_to_use", "success", {"engine": engine, "version": version})
            return {"status": "success", "message": "backend.database.install_success", "args": {"engine": engine, "version": version}}

        except OperationCancelledError:
            self._cleanup_install_failure(zip_path, install_dir, is_existing_data, db_data_dir)
            self._progress(0, "backend.database.install_cancelled")
            self._log("backend.database.install_cancelled", "warn")
            return {"status": "cancelled", "message": "backend.database.install_cancelled"}

        except Exception as e:
            self._cleanup_install_failure(zip_path, install_dir, is_existing_data, db_data_dir)
                
            self._progress(-1, str(e))
            self._log("backend.database.install_failed_log", "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
        finally:
            InstallationManager.reset("database")


    @staticmethod
    def _backup_install_and_data_dirs(install_dir: str, install_dir_backup: str, db_data_dir: str, db_data_dir_backup: str, backup_data: bool):
        if os.path.exists(install_dir_backup):
            shutil.rmtree(install_dir_backup, ignore_errors=True)
        if os.path.exists(install_dir):
            shutil.move(install_dir, install_dir_backup)
            
        if backup_data:
            if os.path.exists(db_data_dir_backup):
                shutil.rmtree(db_data_dir_backup, ignore_errors=True)
            if os.path.exists(db_data_dir):
                shutil.copytree(db_data_dir, db_data_dir_backup)

    @staticmethod
    def _rollback_directories(install_dir: str, install_dir_backup: str):
        shutil.rmtree(install_dir, ignore_errors=True)
        if os.path.exists(install_dir_backup):
            shutil.move(install_dir_backup, install_dir)

    def update_database(self, db_id: str, new_version: str, url: str, backup_data: bool = False):
        from core.utils.file_utils import download_advanced, extract_archive, write_json
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": "backend.database.not_found"}
        
        self.stop_database(db_id)
        
        install_dir = db_obj['installDir']
        db_data_dir = db_obj['dataDir']
        
        install_dir_backup = install_dir + "_backup"
        db_data_dir_backup = db_data_dir + "_backup"
        token = InstallationManager.get_token("database")
        zip_path = os.path.join(self.bin_dir, "update.zip")
        
        try:
            self._backup_install_and_data_dirs(install_dir, install_dir_backup, db_data_dir, db_data_dir_backup, backup_data)
                
            os.makedirs(install_dir, exist_ok=True)
            
            def log_cb(msg, lvl): 
                self._log(msg, lvl)
            def prog_cb(pct, msg, args=None):
                if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg, args)
                
            self._log("backend.database.downloading_update", "info")
            if db_obj['engine'] == 'mysql' and not url.startswith('http'):
                url = self._resolve_mariadb_url(new_version)
            
            download_advanced(url, zip_path, log_cb=log_cb, progress_cb=prog_cb, cancel_check=token.is_cancelled)
            
            self._log("backend.database.extracting_update", "info")
            self._progress(65, "backend.database.extracting_zip")
            extract_archive(zip_path, install_dir, progress_cb=prog_cb, cancel_check=token.is_cancelled)
            if os.path.exists(zip_path):
                try:
                    os.remove(zip_path)
                except OSError:
                    pass
            
            self._unwrap_single_subdir(install_dir)
            
            db_obj['version'] = new_version
            db_obj['name'] = f"{'MariaDB' if db_obj['engine'] == 'mysql' else ('Redis' if db_obj['engine'] == 'redis' else 'PostgreSQL')} {new_version}"
            write_json(self.config_path, data)
            
            shutil.rmtree(install_dir_backup, ignore_errors=True)
            
            self._log("backend.database.update_success", "success")
            self._progress(100, "backend.database.update_complete")
            return {"status": "success", "message": "backend.database.update_success"}

        except OperationCancelledError:
            self._rollback_directories(install_dir, install_dir_backup)
            if backup_data and os.path.exists(db_data_dir_backup):
                shutil.rmtree(db_data_dir, ignore_errors=True)
                shutil.move(db_data_dir_backup, db_data_dir)
            if os.path.exists(zip_path):
                try:
                    os.remove(zip_path)
                except OSError:
                    pass
            self._log("backend.database.update_cancelled", "warn")
            self._progress(0, "backend.database.update_cancelled")
            return {"status": "cancelled", "message": "backend.database.update_cancelled"}
            
        except Exception as e:
            self._rollback_directories(install_dir, install_dir_backup)
            self._log("backend.database.update_failed_rollback", "error", {"e": str(e)})
            self._progress(0, "backend.database.update_failed")
            return {"status": "error", "message": "backend.database.update_failed_rollback", "args": {"e": str(e)}}
        finally:
            InstallationManager.reset("database")

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
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
        
    # ==========================================
    # DATABASE CONFIGURATION & CREDENTIALS
    # ==========================================
    def open_path(self, db_id: str, is_file: bool = False):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        if is_file:
            if db_obj['engine'] == 'mysql':
                target = os.path.join(db_obj['dataDir'], MY_INI)
            elif db_obj['engine'] == 'redis':
                target = os.path.join(db_obj['dataDir'], REDIS_CONF)
            else:
                target = os.path.join(db_obj['dataDir'], POSTGRESQL_CON)
        else:
            target = db_obj['dataDir']
        if is_file and db_obj['engine'] == 'mysql' and not os.path.exists(target):
            with open(target, 'w', encoding='utf-8') as f: f.write(MYSQLD_SECTION)
        elif is_file and db_obj['engine'] == 'redis' and not os.path.exists(target):
            self._init_redis(db_obj['installDir'], db_obj['dataDir'])

        if not os.path.exists(target): return {"status": "error", "message": "backend.database.target_not_created"}

        try:
            if sys.platform == 'win32': os.startfile(target)
            elif sys.platform == 'darwin': subprocess.Popen(['open', target])
            else: subprocess.Popen(['xdg-open', target])
            return {"status": "success", "message": "backend.database.opened_success"}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def get_log_content(self, db_id: str, log_type: str = 'startup'):
        """
        Membaca isi (tail) file log sebuah instance database untuk ditampilkan di dalam aplikasi.
        'startup': log proses start/crash milik VyloServe sendiri (db_startup.log, semua engine).
        'native': log error native milik engine (saat ini hanya MySQL/MariaDB yang menulis file *.err sendiri;
        Postgres tidak punya log native karena logging_collector default off).
        """
        try:
            db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
            if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

            if log_type == 'startup':
                log_path = os.path.join(db_obj['dataDir'], DB_STARTUP_LOG)
            elif log_type == 'native' and db_obj.get('engine') == 'mysql':
                err_files = glob.glob(os.path.join(db_obj['dataDir'], '*.err'))
                if not err_files: return {"status": "error", "message": "backend.database.log_not_found"}
                log_path = max(err_files, key=os.path.getmtime)
            else:
                return {"status": "error", "message": "backend.database.log_not_available"}

            content = read_log_tail(log_path)
            return {"status": "success", "data": content}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _emit_new_db_logs(self, log_path: str):
        if log_path not in self._log_offsets:
            self._log_offsets[log_path] = os.path.getsize(log_path) if os.path.exists(log_path) else 0
            return

        lines, new_offset = read_new_lines(log_path, self._log_offsets[log_path])
        self._log_offsets[log_path] = new_offset
        for line in lines:
            level = 'error' if 'error' in line.lower() else 'info'
            # source_override='DatabaseFileLog' (BUKAN auto-detect 'DatabaseManager') supaya
            # baris dari file log bisa difilter terpisah dari pesan sistem Database biasa
            # di modal "System Logs".
            self.api.emit_log(line, level, {}, source_override='DatabaseFileLog')

    def _tail_db_instance_logs(self, db: dict):
        db_id = db.get('id')
        is_running = (db_id in self.processes and self.processes[db_id].poll() is None) or check_port_in_use(db.get('port'))
        if not is_running:
            return

        log_paths = [os.path.join(db['dataDir'], DB_STARTUP_LOG)]
        if db.get('engine') == 'mysql':
            err_files = glob.glob(os.path.join(db['dataDir'], '*.err'))
            if err_files:
                log_paths.append(max(err_files, key=os.path.getmtime))

        for log_path in log_paths:
            self._emit_new_db_logs(log_path)

    def tail_new_logs(self):
        """
        Menyalurkan baris BARU di db_startup.log (semua engine) dan native .err
        (MySQL/MariaDB saja) sejak polling terakhir ke System Logs lewat
        emit_log() -- dipanggil berkala oleh Api.start_log_watcher() (lihat
        docs/backend_services.md §11.2). Hanya untuk instance yang sedang
        berjalan; file yang baru pertama kali dipantau mulai dihitung dari
        AKHIR-nya (gaya `tail -f`), bukan me-replay seluruh histori lama.
        """
        try:
            for db in read_json(self.config_path):
                self._tail_db_instance_logs(db)
        except Exception:
            # Sengaja diam -- dipanggil tiap 2 detik dari api.py log watcher selama aplikasi
            # berjalan; melaporkan tiap kegagalan baca-file (race rotasi log, I/O transien)
            # lewat emit_log akan membanjiri panel System Logs kalau errornya persisten.
            pass

    def _parse_mysql_config(self, conf_file: str, config: dict):
        keys_map = {
            'bind-address': 'bind_address',
            'innodb_buffer_pool_size': 'innodb_buffer_pool_size',
            'max_allowed_packet': 'max_allowed_packet',
            'max_connections': 'max_connections',
            'character-set-server': 'character_set_server',
            'collation-server': 'collation_server',
            'default-storage-engine': 'default_storage_engine'
        }
        config.update(parse_ini_key_values(conf_file, keys_map, comment_chars=('#',)))

    def _parse_postgres_config(self, conf_file: str, config: dict):
        keys_map = {
            'listen_addresses': 'listen_addresses',
            'shared_buffers': 'shared_buffers',
            'work_mem': 'work_mem',
            'maintenance_work_mem': 'maintenance_work_mem',
            'effective_cache_size': 'effective_cache_size',
            'max_connections': 'max_connections',
            'timezone': 'timezone'
        }
        config.update(parse_ini_key_values(conf_file, keys_map, comment_chars=('#',)))

    def _parse_redis_config(self, conf_file: str, config: dict):
        if not os.path.exists(conf_file):
            return
        keys_map = {
            'bind': 'bind',
            'maxmemory': 'maxmemory',
            'maxmemory-policy': 'maxmemory_policy',
            'databases': 'databases',
            'appendonly': 'appendonly'
        }
        try:
            with open(conf_file, 'r', encoding='utf-8') as f:
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#'):
                        continue
                    parts = stripped.split(None, 1)
                    if len(parts) == 2 and parts[0] in keys_map:
                        config[keys_map[parts[0]]] = parts[1].strip()
        except Exception:
            pass

    def get_db_config(self, db_id: str):
        db_obj = next((db for db in read_json(self.config_path) if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        engine, data_dir = db_obj['engine'], db_obj['dataDir']
        config = {"port": db_obj.get("port")}

        if engine == 'mysql':
            config.update({"bind_address": "127.0.0.1", "innodb_buffer_pool_size": "256M", "max_allowed_packet": "64M", "max_connections": "151", "character_set_server": "utf8mb4", "collation_server": "utf8mb4_unicode_ci", "default_storage_engine": "InnoDB"})
            self._parse_mysql_config(os.path.join(data_dir, MY_INI), config)
        elif engine == 'redis':
            config.update({"bind": "127.0.0.1", "maxmemory": "256mb", "maxmemory_policy": "noeviction", "databases": "16", "appendonly": "no"})
            self._parse_redis_config(os.path.join(data_dir, REDIS_CONF), config)
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

    def _update_redis_config_lines(self, lines: list, keys: dict) -> list:
        new_lines = []
        found_keys = set()
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                new_lines.append(line)
                continue
            parts = stripped.split(None, 1)
            matched_key = None
            for k in keys:
                if parts[0] == k:
                    matched_key = k
                    break
            if matched_key:
                found_keys.add(matched_key)
                new_lines.append(f"{matched_key} {keys[matched_key]}\n")
            else:
                new_lines.append(line)

        for k, v in keys.items():
            if k not in found_keys and v is not None:
                new_lines.append(f"{k} {v}\n")
        return new_lines

    def save_db_config(self, db_id: str, new_config: dict):
        data = read_json(self.config_path)
        db_obj = next((db for db in data if db['id'] == db_id), None)
        if not db_obj: return {"status": "error", "message": DB_NOT_FOUND_MSG}

        was_running = check_port_in_use(db_obj['port'])
        db_obj['port'] = int(new_config.get('port', db_obj['port']))
        write_json(self.config_path, data)

        is_mysql = db_obj['engine'] == 'mysql'
        is_redis = db_obj['engine'] == 'redis'
        conf_file = os.path.join(db_obj['dataDir'], MY_INI if is_mysql else (REDIS_CONF if is_redis else POSTGRESQL_CON))
        lines = [MYSQLD_SECTION] if is_mysql else []
        if os.path.exists(conf_file):
            with open(conf_file, 'r', encoding='utf-8') as f: lines = f.readlines()

        if is_mysql:
            keys = {"port": str(new_config.get("port")), "bind-address": new_config.get("bind_address"), "innodb_buffer_pool_size": new_config.get("innodb_buffer_pool_size"), "max_allowed_packet": new_config.get("max_allowed_packet"), "max_connections": str(new_config.get("max_connections")), "character-set-server": new_config.get("character_set_server"), "collation-server": new_config.get("collation_server"), "default-storage-engine": new_config.get("default_storage_engine")}
            new_lines = self._update_config_lines(lines, keys, is_mysql=True)
        elif is_redis:
            keys = {
                "port": str(new_config.get("port", db_obj['port'])),
                "bind": str(new_config.get("bind", "127.0.0.1")),
                "maxmemory": str(new_config.get("maxmemory", "256mb")),
                "maxmemory-policy": str(new_config.get("maxmemory_policy", "noeviction")),
                "databases": str(new_config.get("databases", "16")),
                "appendonly": str(new_config.get("appendonly", "no"))
            }
            new_lines = self._update_redis_config_lines(lines, keys)
        else:
            keys = {"port": str(new_config.get("port")), "listen_addresses": f"'{new_config.get('listen_addresses')}'", "shared_buffers": f"{new_config.get('shared_buffers')}", "work_mem": f"{new_config.get('work_mem')}", "maintenance_work_mem": f"{new_config.get('maintenance_work_mem')}", "effective_cache_size": f"{new_config.get('effective_cache_size')}", "max_connections": str(new_config.get("max_connections")), "timezone": f"'{new_config.get('timezone')}'"}
            new_lines = self._update_config_lines(lines, keys, is_mysql=False)

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
        
        safe_user = username.replace("'", "''")
        safe_pass = new_pass.replace("'", "''")
        cmd.extend(["-e", f"ALTER USER '{safe_user}'@'localhost' IDENTIFIED BY '{safe_pass}'; FLUSH PRIVILEGES;"])
        
        result = run_silent_command(cmd)
        if result.returncode != 0: raise RuntimeError(f"backend.database.mysql_fail|{result.stderr.strip()}")

    def _change_postgres_credentials(self, db_obj: dict, username: str, old_pass: str, new_pass: str):
        exe = os.path.join(db_obj['installDir'], 'bin', 'psql.exe' if sys.platform == 'win32' else 'psql')
        env = os.environ.copy()
        if old_pass: env['PGPASSWORD'] = old_pass
        
        safe_user = username.replace("\"", "\"\"")
        safe_pass = new_pass.replace("'", "''")
        cmd = [exe, "-U", username, "-p", str(db_obj['port']), "-h", "127.0.0.1", "-c", f"ALTER ROLE \"{safe_user}\" WITH PASSWORD '{safe_pass}';"]
        
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

            if username in ('root', 'postgres'):
                all_data = read_json(self.config_path)
                for item in all_data:
                    if item.get('id') == db_id:
                        item['rootPassword'] = new_pass
                write_json(self.config_path, all_data)

            self._log("backend.database.credentials_updated_log", "success")
            return {"status": "success", "message": "backend.database.password_updated_success"}
        except RuntimeError as e:
            err_parts = str(e).split('|', 1)
            return {"status": "error", "message": err_parts[0], "args": {"err": err_parts[1] if len(err_parts) > 1 else ""}}
        except Exception as e:
            return {"status": "error", "message": "backend.database.system_error", "args": {"e": str(e)}}

    # ==========================================
    # SCHEMA MANAGEMENT (MYSQL & POSTGRESQL)
    # ==========================================
    def list_schemas(self, db_id: str, password: str = "") -> dict:
        try:
            data = read_json(self.config_path)
            db_obj = next((db for db in data if db['id'] == db_id), None)
            if not db_obj:
                return {"status": "error", "message": DB_NOT_FOUND_MSG}

            engine = db_obj.get('engine')
            if engine == 'redis':
                return {"status": "error", "message": "backend.database.redis_not_supported_for_schemas"}

            if not check_port_in_use(db_obj['port']):
                return {"status": "error", "message": "backend.database.must_be_running"}

            pw = self._resolve_password(db_obj, password)

            if engine == 'mysql':
                cli = self._resolve_db_cli(db_obj, 'mysql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "mysql"}}
                cmd = [cli, "-u", "root", f"-P{db_obj['port']}", "-h", "127.0.0.1", "--batch", "--skip-column-names", "-e", "SHOW DATABASES;"]
                if pw:
                    cmd.insert(2, f"-p{pw}")
                res = run_silent_command(cmd)
                if res.returncode != 0:
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": res.stderr.strip()}}
                raw_names = [line.strip() for line in res.stdout.splitlines() if line.strip()]

            else:  # postgres
                cli = self._resolve_db_cli(db_obj, 'psql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "psql"}}
                cmd = [cli, "-U", "postgres", "-p", str(db_obj['port']), "-h", "127.0.0.1", "-t", "-A", "-c", "SELECT datname FROM pg_database WHERE datistemplate = false;"]
                env = os.environ.copy()
                if pw:
                    env['PGPASSWORD'] = pw
                res = run_silent_command(cmd, env=env)
                if res.returncode != 0:
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": res.stderr.strip()}}
                raw_names = [line.strip() for line in res.stdout.splitlines() if line.strip()]

            schemas = []
            for name in raw_names:
                schemas.append({
                    "name": name,
                    "is_system": name.lower() in SYSTEM_SCHEMAS
                })
            schemas.sort(key=lambda s: (1 if s["is_system"] else 0, s["name"].lower()))
            return {"status": "success", "data": schemas}

        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def create_schema(self, db_id: str, schema_name: str, password: str = "") -> dict:
        try:
            data = read_json(self.config_path)
            db_obj = next((db for db in data if db['id'] == db_id), None)
            if not db_obj:
                return {"status": "error", "message": DB_NOT_FOUND_MSG}

            engine = db_obj.get('engine')
            if engine == 'redis':
                return {"status": "error", "message": "backend.database.redis_not_supported_for_schemas"}

            schema_name = (schema_name or "").strip()
            if not SCHEMA_NAME_PATTERN.match(schema_name):
                return {"status": "error", "message": "backend.database.schema_name_invalid"}

            if schema_name.lower() in SYSTEM_SCHEMAS:
                return {"status": "error", "message": "backend.database.schema_already_exists", "args": {"name": schema_name}}

            if not check_port_in_use(db_obj['port']):
                return {"status": "error", "message": "backend.database.must_be_running"}

            pw = self._resolve_password(db_obj, password)

            if engine == 'mysql':
                cli = self._resolve_db_cli(db_obj, 'mysql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "mysql"}}
                cmd = [cli, "-u", "root", f"-P{db_obj['port']}", "-h", "127.0.0.1", "-e", f"CREATE DATABASE `{schema_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"]
                if pw:
                    cmd.insert(2, f"-p{pw}")
                res = run_silent_command(cmd)
                if res.returncode != 0:
                    err = res.stderr.strip()
                    if "already exists" in err.lower() or "database exists" in err.lower():
                        return {"status": "error", "message": "backend.database.schema_already_exists", "args": {"name": schema_name}}
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            else:  # postgres
                cli = self._resolve_db_cli(db_obj, 'psql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "psql"}}
                cmd = [cli, "-U", "postgres", "-p", str(db_obj['port']), "-h", "127.0.0.1", "-c", f"CREATE DATABASE \"{schema_name}\" ENCODING 'UTF8';"]
                env = os.environ.copy()
                if pw:
                    env['PGPASSWORD'] = pw
                res = run_silent_command(cmd, env=env)
                if res.returncode != 0:
                    err = res.stderr.strip()
                    if "already exists" in err.lower() or "database exists" in err.lower():
                        return {"status": "error", "message": "backend.database.schema_already_exists", "args": {"name": schema_name}}
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            self._log("backend.database.schema_created_success", "success", {"name": schema_name})
            return {"status": "success", "message": "backend.database.schema_created_success", "args": {"name": schema_name}}

        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def drop_schema(self, db_id: str, schema_name: str, password: str = "") -> dict:
        try:
            data = read_json(self.config_path)
            db_obj = next((db for db in data if db['id'] == db_id), None)
            if not db_obj:
                return {"status": "error", "message": DB_NOT_FOUND_MSG}

            engine = db_obj.get('engine')
            if engine == 'redis':
                return {"status": "error", "message": "backend.database.redis_not_supported_for_schemas"}

            schema_name = (schema_name or "").strip()
            if not SCHEMA_NAME_PATTERN.match(schema_name):
                return {"status": "error", "message": "backend.database.schema_name_invalid"}

            if schema_name.lower() in SYSTEM_SCHEMAS:
                return {"status": "error", "message": "backend.database.schema_system_protected", "args": {"name": schema_name}}

            if not check_port_in_use(db_obj['port']):
                return {"status": "error", "message": "backend.database.must_be_running"}

            pw = self._resolve_password(db_obj, password)

            if engine == 'mysql':
                cli = self._resolve_db_cli(db_obj, 'mysql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "mysql"}}
                cmd = [cli, "-u", "root", f"-P{db_obj['port']}", "-h", "127.0.0.1", "-e", f"DROP DATABASE `{schema_name}`;"]
                if pw:
                    cmd.insert(2, f"-p{pw}")
                res = run_silent_command(cmd)
                if res.returncode != 0:
                    err = res.stderr.strip()
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            else:  # postgres
                cli = self._resolve_db_cli(db_obj, 'psql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "psql"}}
                cmd = [cli, "-U", "postgres", "-p", str(db_obj['port']), "-h", "127.0.0.1", "-c", f"DROP DATABASE \"{schema_name}\";"]
                env = os.environ.copy()
                if pw:
                    env['PGPASSWORD'] = pw
                res = run_silent_command(cmd, env=env)
                if res.returncode != 0:
                    err = res.stderr.strip()
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            self._log("backend.database.schema_dropped_success", "warn", {"name": schema_name})
            return {"status": "success", "message": "backend.database.schema_dropped_success", "args": {"name": schema_name}}

        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def export_schema(self, db_id: str, schema_name: str, target_path: str = "", password: str = "") -> dict:
        try:
            data = read_json(self.config_path)
            db_obj = next((db for db in data if db['id'] == db_id), None)
            if not db_obj:
                return {"status": "error", "message": DB_NOT_FOUND_MSG}

            engine = db_obj.get('engine')
            if engine == 'redis':
                return {"status": "error", "message": "backend.database.redis_not_supported_for_schemas"}

            schema_name = (schema_name or "").strip()
            if not SCHEMA_NAME_PATTERN.match(schema_name):
                return {"status": "error", "message": "backend.database.schema_name_invalid"}

            if not check_port_in_use(db_obj['port']):
                return {"status": "error", "message": "backend.database.must_be_running"}

            if not target_path:
                backups_dir = os.path.join(self.data_dir, "backups")
                os.makedirs(backups_dir, exist_ok=True)
                target_path = os.path.join(backups_dir, f"{schema_name}_{int(time.time())}.sql")
            else:
                os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)

            pw = self._resolve_password(db_obj, password)

            if engine == 'mysql':
                cli = self._resolve_db_cli(db_obj, 'mysqldump') or self._resolve_db_cli(db_obj, 'mariadb-dump')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "mysqldump"}}
                cmd = [cli, "-u", "root", f"-P{db_obj['port']}", "-h", "127.0.0.1", schema_name]
                if pw:
                    cmd.insert(2, f"-p{pw}")
                with open(target_path, 'wb') as out_f:
                    res = subprocess.run(cmd, stdout=out_f, stderr=subprocess.PIPE, creationflags=get_silent_flags())
                if res.returncode != 0:
                    err = res.stderr.decode('utf-8', errors='replace').strip()
                    if os.path.exists(target_path):
                        try: os.remove(target_path)
                        except Exception: pass
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            else:  # postgres
                cli = self._resolve_db_cli(db_obj, 'pg_dump')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "pg_dump"}}
                cmd = [cli, "-U", "postgres", "-p", str(db_obj['port']), "-h", "127.0.0.1", "-f", target_path, schema_name]
                env = os.environ.copy()
                if pw:
                    env['PGPASSWORD'] = pw
                res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, env=env, creationflags=get_silent_flags())
                if res.returncode != 0:
                    err = res.stderr.decode('utf-8', errors='replace').strip()
                    if os.path.exists(target_path):
                        try: os.remove(target_path)
                        except Exception: pass
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            self._log("backend.database.schema_export_success", "success", {"name": schema_name})
            return {"status": "success", "message": "backend.database.schema_export_success", "args": {"name": schema_name}, "target_path": target_path}

        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def import_schema(self, db_id: str, schema_name: str, source_path: str, password: str = "") -> dict:
        try:
            data = read_json(self.config_path)
            db_obj = next((db for db in data if db['id'] == db_id), None)
            if not db_obj:
                return {"status": "error", "message": DB_NOT_FOUND_MSG}

            engine = db_obj.get('engine')
            if engine == 'redis':
                return {"status": "error", "message": "backend.database.redis_not_supported_for_schemas"}

            schema_name = (schema_name or "").strip()
            if not SCHEMA_NAME_PATTERN.match(schema_name):
                return {"status": "error", "message": "backend.database.schema_name_invalid"}

            if not source_path or not os.path.exists(source_path):
                return {"status": "error", "message": "backend.database.schema_sql_file_invalid"}

            if not check_port_in_use(db_obj['port']):
                return {"status": "error", "message": "backend.database.must_be_running"}

            pw = self._resolve_password(db_obj, password)

            # Auto-ensure database exists before importing into it
            self.create_schema(db_id, schema_name, password)

            if engine == 'mysql':
                cli = self._resolve_db_cli(db_obj, 'mysql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "mysql"}}
                cmd = [cli, "-u", "root", f"-P{db_obj['port']}", "-h", "127.0.0.1", schema_name]
                if pw:
                    cmd.insert(2, f"-p{pw}")
                with open(source_path, 'rb') as in_f:
                    res = subprocess.run(cmd, stdin=in_f, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=get_silent_flags())
                if res.returncode != 0:
                    err = res.stderr.decode('utf-8', errors='replace').strip()
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            else:  # postgres
                cli = self._resolve_db_cli(db_obj, 'psql')
                if not cli:
                    return {"status": "error", "message": "backend.database.schema_cli_not_found", "args": {"cli": "psql"}}
                cmd = [cli, "-U", "postgres", "-p", str(db_obj['port']), "-h", "127.0.0.1", "-d", schema_name, "-f", source_path]
                env = os.environ.copy()
                if pw:
                    env['PGPASSWORD'] = pw
                res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, env=env, creationflags=get_silent_flags())
                if res.returncode != 0:
                    err = res.stderr.decode('utf-8', errors='replace').strip()
                    return {"status": "error", "message": "backend.database.schema_exec_failed", "args": {"err": err}}

            self._log("backend.database.schema_import_success", "success", {"name": schema_name})
            return {"status": "success", "message": "backend.database.schema_import_success", "args": {"name": schema_name}}

        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
        
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
            
        redis_dbs = sorted([db for db in dbs if db['engine'] == 'redis'], key=lambda x: [int(i) for i in re.findall(r'\d+', x['version'])], reverse=True)
        if redis_dbs: fallback.append(redis_dbs[0]['id'])
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
