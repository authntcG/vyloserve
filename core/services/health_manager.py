import os
import sys
import shutil
import re
from typing import Dict, Any, List, Optional

from core.utils.system_utils import get_project_root
from core.utils.file_utils import read_json, write_json, safe_rmtree
from core.utils.network_utils import check_internet_connection


REASON_RECOVERED_CONFIG = "backend.health.recovered_config"
REASON_DEFERRED_OFFLINE = "backend.health.deferred_offline"
REASON_RECOVERED_BINARY = "backend.health.recovered_binary"
REASON_PURGED_UNAVAILABLE = "backend.health.purged_version_unavailable"


class HealthManager:
    """
    Manajer terpusat untuk Startup Module Health Check & Self-Healing Auto-Recovery.
    Memeriksa integritas berkas biner dan konfigurasi dari seluruh modul (Apache, PHP,
    Database, Runtimes, Git/Tools), melakukan pemulihan otomatis lokal/online, dan
    membersihkan modul yang rusak permanen dengan aman (Safe Cleansing).
    """

    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.bin_dir = os.path.join(self.root_dir, 'bin')
        self.data_dir = os.path.join(self.root_dir, 'data')

    def _emit_bootstrap(self, percent: int, stage_key: str, args: Optional[dict] = None, is_recovering: bool = False):
        if hasattr(self.api, 'emit_bootstrap_status'):
            self.api.emit_bootstrap_status(percent, stage_key, args, is_recovering)

    def _cleanup_orphan_temp_files(self) -> int:
        """
        Membersihkan folder ekstraksi sementara (temp_*, zrok_extract) dan file download
        parsial (.tmp, .part, .download, .crdownload) yang tertinggal akibat proses terputus.
        """
        cleaned_count = 0
        if not os.path.exists(self.bin_dir):
            return 0

        try:
            for root, dirs, files in os.walk(self.bin_dir, topdown=True):
                # Hapus folder temp
                to_remove = [d for d in dirs if d.startswith("temp_") or d == "zrok_extract"]
                for d in to_remove:
                    target = os.path.join(root, d)
                    safe_rmtree(target, force=True)
                    cleaned_count += 1
                dirs[:] = [d for d in dirs if d not in to_remove]

                # Hapus file download parsial
                for f in files:
                    if f.endswith(('.tmp', '.part', '.download', '.crdownload')):
                        target = os.path.join(root, f)
                        try:
                            os.remove(target)
                            cleaned_count += 1
                        except OSError:
                            pass
        except Exception:
            pass

        return cleaned_count

    # ==========================================
    # 1. APACHE HEALTH CHECK & HEALING
    # ==========================================
    def _heal_apache_offline(self, ver: str, result: Dict[str, Any]):
        result['deferred_offline'].append({
            "module": f"Apache {ver}",
            "reason_key": REASON_DEFERRED_OFFLINE,
            "args": {"module": f"Apache {ver}"}
        })

    @staticmethod
    def _find_matching_apache_version(apache_mgr, ver: str) -> Optional[dict]:
        avail_res = apache_mgr.get_available_versions()
        if avail_res.get('status') == 'success':
            for v in avail_res.get('data', []):
                if v.get('version') == ver and v.get('url'):
                    return v
        return None

    @staticmethod
    def _purge_broken_apache(apache_mgr, ver: str, target_dir: str, result: Dict[str, Any], apache_data: dict, apache_json_path: str):
        safe_rmtree(target_dir, force=True)
        if apache_data.get('active_version') == ver:
            remaining = apache_mgr._get_installed_folders()
            apache_data['active_version'] = next(iter(remaining.keys())) if remaining else None
            write_json(apache_json_path, apache_data)
        result['purged'].append({
            "module": f"Apache {ver}",
            "reason_key": REASON_PURGED_UNAVAILABLE,
            "args": {"module": f"Apache {ver}", "version": ver}
        })

    def _heal_apache_online(self, apache_mgr, ver: str, target_dir: str, result: Dict[str, Any], apache_data: dict, apache_json_path: str):
        self._emit_bootstrap(20, "backend.health.checking_apache", {"module": f"Apache {ver}"}, is_recovering=True)
        found_match = self._find_matching_apache_version(apache_mgr, ver)
        recovered_ok = False
        if found_match:
            port = apache_mgr.get_range_http_port() if hasattr(apache_mgr, 'get_range_http_port') else apache_mgr.get_http_port()
            install_res = apache_mgr.install_version(ver, found_match['url'], port)
            if install_res.get('status') == 'success':
                recovered_ok = True
                result['recovered'].append({
                    "module": f"Apache {ver}",
                    "type": "binary_reinstalled",
                    "reason_key": REASON_RECOVERED_BINARY,
                    "args": {"module": f"Apache {ver}"}
                })

        if not recovered_ok:
            self._purge_broken_apache(apache_mgr, ver, target_dir, result, apache_data, apache_json_path)

    def _heal_apache_config(self, apache_mgr, ver: str, target_dir: str, result: Dict[str, Any]):
        conf_dir = os.path.join(target_dir, "conf")
        conf_file = os.path.join(conf_dir, "httpd.conf")
        if not os.path.exists(conf_file):
            repaired = False
            if hasattr(apache_mgr, 'restore_httpd_conf'):
                repaired = apache_mgr.restore_httpd_conf(target_dir)
            if repaired:
                result['recovered'].append({
                    "module": f"Apache {ver}",
                    "type": "config_repaired",
                    "reason_key": REASON_RECOVERED_CONFIG,
                    "args": {"module": f"Apache {ver}"}
                })
        else:
            result['healthy_count'] += 1

        apache_mgr._verify_and_patch_httpd()

    @staticmethod
    def _reconcile_active_apache(folder_map: dict, apache_data: dict, apache_json_path: str, result: Dict[str, Any]):
        active_version = apache_data.get('active_version')
        if active_version and active_version not in folder_map:
            new_active = next(iter(folder_map.keys())) if folder_map else None
            apache_data['active_version'] = new_active
            write_json(apache_json_path, apache_data)
            result['recovered'].append({
                "module": "Apache",
                "type": "config_repaired",
                "reason_key": REASON_RECOVERED_CONFIG,
                "args": {"module": "Apache"}
            })

    def _heal_apache_instance(self, apache_mgr, ver: str, folder_name: str, apache_base: str, is_online: bool, result: Dict[str, Any], apache_data: dict, apache_json_path: str):
        target_dir = os.path.join(apache_base, folder_name)
        binary_name = "httpd.exe" if sys.platform == 'win32' else "httpd"
        binary_path = os.path.join(target_dir, "bin", binary_name)

        if not os.path.exists(binary_path):
            if not is_online:
                self._heal_apache_offline(ver, result)
            else:
                self._heal_apache_online(apache_mgr, ver, target_dir, result, apache_data, apache_json_path)
        else:
            self._heal_apache_config(apache_mgr, ver, target_dir, result)

    def _check_and_heal_apache(self, is_online: bool, result: Dict[str, Any]):
        apache_mgr = getattr(self.api, 'apache', None)
        if not apache_mgr:
            return

        apache_base = os.path.join(self.bin_dir, 'apache')
        if not os.path.exists(apache_base):
            return

        folder_map = apache_mgr._get_installed_folders()
        apache_json_path = os.path.join(self.data_dir, 'apache.json')
        apache_data = read_json(apache_json_path, default_type=dict)

        self._reconcile_active_apache(folder_map, apache_data, apache_json_path, result)

        for ver, folder_name in folder_map.items():
            self._heal_apache_instance(apache_mgr, ver, folder_name, apache_base, is_online, result, apache_data, apache_json_path)

    # ==========================================
    # 2. PHP HEALTH CHECK & HEALING
    # ==========================================
    def _heal_php_offline(self, ver: str, result: Dict[str, Any]):
        result['deferred_offline'].append({
            "module": f"PHP {ver}",
            "reason_key": REASON_DEFERRED_OFFLINE,
            "args": {"module": f"PHP {ver}"}
        })

    def _heal_php_online(self, php_mgr, ver: str, target_dir: str, result: Dict[str, Any]):
        self._emit_bootstrap(40, "backend.health.checking_php", {"module": f"PHP {ver}"}, is_recovering=True)
        avail_res = php_mgr.get_versions()
        found_match = None
        if avail_res.get('status') == 'success':
            for v in avail_res.get('data', []):
                if v.get('version') == ver and v.get('filename'):
                    found_match = v
                    break

        recovered_ok = False
        if found_match:
            port, _ = php_mgr._parse_php_ini_info(os.path.join(target_dir, "php.ini"))
            install_res = php_mgr.install_version(ver, found_match['filename'], port)
            if install_res.get('status') == 'success':
                recovered_ok = True
                result['recovered'].append({
                    "module": f"PHP {ver}",
                    "type": "binary_reinstalled",
                    "reason_key": REASON_RECOVERED_BINARY,
                    "args": {"module": f"PHP {ver}"}
                })

        if not recovered_ok:
            safe_rmtree(target_dir, force=True)
            php_mgr.toggle_global_path(target_dir, False)
            result['purged'].append({
                "module": f"PHP {ver}",
                "reason_key": REASON_PURGED_UNAVAILABLE,
                "args": {"module": f"PHP {ver}", "version": ver}
            })

    def _heal_php_config(self, php_mgr, ver: str, target_dir: str, result: Dict[str, Any]):
        ini_path = os.path.join(target_dir, "php.ini")
        if not os.path.exists(ini_path):
            port, _ = php_mgr._parse_php_ini_info(ini_path)
            php_mgr._write_default_php_ini(target_dir, ver, port)
            result['recovered'].append({
                "module": f"PHP {ver}",
                "type": "config_repaired",
                "reason_key": REASON_RECOVERED_CONFIG,
                "args": {"module": f"PHP {ver}"}
            })
        else:
            result['healthy_count'] += 1

        if hasattr(php_mgr, 'ensure_php_config'):
            php_mgr.ensure_php_config(ver)

    def _check_and_heal_php(self, is_online: bool, result: Dict[str, Any]):
        php_mgr = getattr(self.api, 'php', None)
        if not php_mgr:
            return

        php_base = os.path.join(self.bin_dir, 'php')
        if not os.path.exists(php_base):
            return

        folders = [f for f in os.listdir(php_base) if os.path.isdir(os.path.join(php_base, f)) and not f.startswith("temp_")]

        for ver in folders:
            target_dir = os.path.join(php_base, ver)
            binary_name = "php-cgi.exe" if sys.platform == 'win32' else "php"
            binary_path = os.path.join(target_dir, binary_name)

            if not os.path.exists(binary_path):
                if not is_online:
                    self._heal_php_offline(ver, result)
                else:
                    self._heal_php_online(php_mgr, ver, target_dir, result)
            else:
                self._heal_php_config(php_mgr, ver, target_dir, result)

    # ==========================================
    # 3. DATABASE HEALTH CHECK & HEALING
    # ==========================================
    @staticmethod
    def _is_db_binary_present(db_mgr, engine: str, install_dir: str, db: dict) -> bool:
        if not (install_dir and os.path.exists(install_dir)):
            return False
        if engine == 'mysql':
            return os.path.exists(os.path.join(install_dir, 'bin', 'mysqld.exe' if sys.platform == 'win32' else 'mysqld'))
        if engine == 'redis':
            exe_name = 'redis-server.exe' if sys.platform == 'win32' else 'redis-server'
            return bool(db_mgr._resolve_db_cli(db, exe_name)) or os.path.exists(os.path.join(install_dir, exe_name))
        return os.path.exists(os.path.join(install_dir, 'bin', 'postgres.exe' if sys.platform == 'win32' else 'postgres'))

    @staticmethod
    def _find_matching_db_version(db_mgr, engine: str, target_ver: str) -> Optional[dict]:
        avail_res = db_mgr.get_available_versions(engine)
        if avail_res.get('status') == 'success':
            for v in avail_res.get('data', []):
                if str(v.get('version') or '') == target_ver:
                    return v
        return None

    @staticmethod
    def _reinstall_db_binary(db_mgr, dl_url: str, install_dir: str, pkg_filename: str) -> bool:
        try:
            os.makedirs(install_dir, exist_ok=True)
            pkg_file = os.path.join(db_mgr.bin_dir, pkg_filename)
            db_mgr._download_archive(dl_url, pkg_file)
            db_mgr._extract_db_archive(pkg_file, install_dir)
            if os.path.exists(pkg_file):
                os.remove(pkg_file)
            return True
        except Exception:
            return False

    def _attempt_online_db_recovery(self, db_mgr, db: dict, engine: str, db_name: str, install_dir: str, result: Dict[str, Any]) -> bool:
        self._emit_bootstrap(60, "backend.health.checking_databases", {"module": db_name}, is_recovering=True)
        target_ver = str(db.get('version') or '')
        found_match = self._find_matching_db_version(db_mgr, engine, target_ver)

        if found_match and install_dir:
            dl_url = found_match.get('url')
            if dl_url and self._reinstall_db_binary(db_mgr, dl_url, install_dir, found_match.get('filename') or 'pkg.zip'):
                result['recovered'].append({
                    "module": db_name,
                    "type": "binary_reinstalled",
                    "reason_key": REASON_RECOVERED_BINARY,
                    "args": {"module": db_name}
                })
                return True
        return False

    def _heal_single_database(self, db_mgr, db: dict, is_online: bool, result: Dict[str, Any]) -> bool:
        db_name = db.get('name') or f"Database {db.get('version', '')}"
        engine = str(db.get('engine') or 'mysql').lower()
        install_dir = db.get('installDir')
        data_dir = db.get('dataDir')

        if data_dir and os.path.exists(data_dir):
            if hasattr(db_mgr, 'ensure_instance_config') and db_mgr.ensure_instance_config(db):
                result['recovered'].append({
                    "module": db_name,
                    "type": "config_repaired",
                    "reason_key": REASON_RECOVERED_CONFIG,
                    "args": {"module": db_name}
                })

        if self._is_db_binary_present(db_mgr, engine, install_dir, db):
            result['healthy_count'] += 1
            return True

        if not is_online:
            result['deferred_offline'].append({
                "module": db_name,
                "reason_key": REASON_DEFERRED_OFFLINE,
                "args": {"module": db_name}
            })
            return True

        if self._attempt_online_db_recovery(db_mgr, db, engine, db_name, install_dir, result):
            return True

        if install_dir and os.path.exists(install_dir):
            safe_rmtree(install_dir, force=True)
        result['purged'].append({
            "module": db_name,
            "reason_key": REASON_PURGED_UNAVAILABLE,
            "args": {"module": db_name, "version": str(db.get('version') or '')},
            "preserved_data_path": data_dir if data_dir and os.path.exists(data_dir) else None
        })
        return False

    def _check_and_heal_databases(self, is_online: bool, result: Dict[str, Any]):
        db_mgr = getattr(self.api, 'database', None)
        if not db_mgr:
            return

        db_json_path = os.path.join(self.data_dir, 'databases.json')
        databases = read_json(db_json_path, default_type=list)
        if not isinstance(databases, list):
            return

        updated_databases = [
            db for db in databases
            if isinstance(db, dict) and self._heal_single_database(db_mgr, db, is_online, result)
        ]

        if len(updated_databases) != len(databases):
            write_json(db_json_path, updated_databases)

    # ==========================================
    # 4. RUNTIMES HEALTH CHECK & HEALING
    # ==========================================
    def _heal_runtime_version(self, rt_mgr, engine: str, ver: str, ver_dir: str, exe_path: str, is_online: bool, result: Dict[str, Any], engine_dir: str, active_versions: dict) -> bool:
        if os.path.exists(exe_path):
            result['healthy_count'] += 1
            return False

        mod_title = f"{engine.capitalize()} {ver}"
        if not is_online:
            result['deferred_offline'].append({
                "module": mod_title,
                "reason_key": REASON_DEFERRED_OFFLINE,
                "args": {"module": mod_title}
            })
            return False

        self._emit_bootstrap(75, "backend.health.checking_runtimes", {"module": mod_title}, is_recovering=True)
        recovered_ok = False
        try:
            install_res = rt_mgr.install_runtime(engine, ver)
            if install_res.get('status') == 'success':
                recovered_ok = True
                result['recovered'].append({
                    "module": mod_title,
                    "type": "binary_reinstalled",
                    "reason_key": REASON_RECOVERED_BINARY,
                    "args": {"module": mod_title}
                })
        except Exception:
            pass

        if not recovered_ok:
            safe_rmtree(ver_dir, force=True)
            if active_versions.get(engine) == ver:
                rem = [d for d in os.listdir(engine_dir) if os.path.isdir(os.path.join(engine_dir, d))]
                active_versions[engine] = rem[0] if rem else ""
                return True
            result['purged'].append({
                "module": mod_title,
                "reason_key": REASON_PURGED_UNAVAILABLE,
                "args": {"module": mod_title, "version": ver}
            })
        return False

    def _heal_engine_instances(self, rt_mgr, engine: str, engine_dir: str, rel_exe: str, is_online: bool, result: Dict[str, Any], active_versions: dict, path_enabled: dict) -> bool:
        if not os.path.exists(engine_dir):
            if engine in active_versions:
                active_versions.pop(engine, None)
                path_enabled.pop(engine, None)
                return True
            return False

        installed_vers = [d for d in os.listdir(engine_dir) if os.path.isdir(os.path.join(engine_dir, d)) and not d.startswith("temp_")]
        changed = False
        if engine in active_versions and active_versions[engine] not in installed_vers:
            active_versions[engine] = installed_vers[0] if installed_vers else ""
            changed = True

        for ver in installed_vers:
            ver_dir = os.path.join(engine_dir, ver)
            exe_path = os.path.join(ver_dir, rel_exe)
            if self._heal_runtime_version(rt_mgr, engine, ver, ver_dir, exe_path, is_online, result, engine_dir, active_versions):
                changed = True
        return changed

    def _check_and_heal_runtimes(self, is_online: bool, result: Dict[str, Any]):
        rt_mgr = getattr(self.api, 'runtimes_manager', None)
        if not rt_mgr:
            return

        rt_config = rt_mgr._get_config()
        active_versions = rt_config.get("active_versions", {})
        path_enabled = rt_config.get("path_enabled", {})

        exe_map = {
            "node": "node.exe" if sys.platform == 'win32' else "bin/node",
            "python": "python.exe" if sys.platform == 'win32' else "bin/python3",
            "java": "bin/java.exe" if sys.platform == 'win32' else "bin/java",
            "go": "bin/go.exe" if sys.platform == 'win32' else "bin/go",
        }

        config_changed = False
        for engine, rel_exe in exe_map.items():
            engine_dir = os.path.join(self.bin_dir, engine)
            if self._heal_engine_instances(rt_mgr, engine, engine_dir, rel_exe, is_online, result, active_versions, path_enabled):
                config_changed = True

        if config_changed:
            rt_mgr._save_config(rt_config)

    # ==========================================
    # 5. TOOLS HEALTH CHECK (GIT, GLAB, TUNNELS)
    # ==========================================
    def _check_and_heal_tools(self, _is_online: bool, result: Dict[str, Any]):
        git_dir = os.path.join(self.bin_dir, 'git')
        if os.path.exists(git_dir):
            try:
                has_git_files = any(os.scandir(git_dir))
            except Exception:
                has_git_files = False
            if not has_git_files:
                safe_rmtree(git_dir, force=True)
            else:
                git_candidates = [
                    os.path.join(git_dir, 'cmd', 'git.exe' if sys.platform == 'win32' else 'git'),
                    os.path.join(git_dir, 'bin', 'git.exe' if sys.platform == 'win32' else 'git'),
                ]
                if not any(os.path.exists(c) for c in git_candidates):
                    safe_rmtree(git_dir, force=True)
                    result['purged'].append({
                        "module": "Portable Git",
                        "reason_key": REASON_PURGED_UNAVAILABLE,
                        "args": {"module": "Portable Git", "version": ""}
                    })
                else:
                    result['healthy_count'] += 1

        glab_dir = os.path.join(self.bin_dir, 'glab')
        if os.path.exists(glab_dir):
            try:
                has_glab_files = any(os.scandir(glab_dir))
            except Exception:
                has_glab_files = False
            if not has_glab_files:
                safe_rmtree(glab_dir, force=True)
            else:
                glab_exe = os.path.join(glab_dir, 'glab.exe' if sys.platform == 'win32' else 'glab')
                if not os.path.exists(glab_exe):
                    safe_rmtree(glab_dir, force=True)
                    result['purged'].append({
                        "module": "GitLab CLI (glab)",
                        "reason_key": REASON_PURGED_UNAVAILABLE,
                        "args": {"module": "GitLab CLI (glab)", "version": ""}
                    })
                else:
                    result['healthy_count'] += 1

    # ==========================================
    # MAIN WORKFLOW ENTRY POINT
    # ==========================================
    def run_startup_health_check(self) -> Dict[str, Any]:
        """
        Menjalankan alur lengkap pemeriksaan kesehatan modul saat startup:
        1. Pembersihan artefak orphan (5%)
        2. Pemeriksaan & pemulihan Apache (20%)
        3. Pemeriksaan & pemulihan PHP (40%)
        4. Pemeriksaan & pemulihan Database (60%)
        5. Pemeriksaan & pemulihan Runtimes (75%)
        6. Pemeriksaan Tools (90%)
        7. Finalisasi (100%)
        """
        result: Dict[str, Any] = {
            "status": "success",
            "healthy_count": 0,
            "recovered": [],
            "purged": [],
            "deferred_offline": []
        }

        # Step 1: Cleanup temp
        self._emit_bootstrap(5, "backend.health.cleanup_orphans")
        self._cleanup_orphan_temp_files()

        # Cek konektivitas internet sekali di awal
        is_online = check_internet_connection(timeout=1.5)

        # Step 2: Apache
        self._emit_bootstrap(20, "backend.health.checking_apache")
        self._check_and_heal_apache(is_online, result)

        # Step 3: PHP
        self._emit_bootstrap(40, "backend.health.checking_php")
        self._check_and_heal_php(is_online, result)

        # Step 4: Databases
        self._emit_bootstrap(60, "backend.health.checking_databases")
        self._check_and_heal_databases(is_online, result)

        # Step 5: Runtimes
        self._emit_bootstrap(75, "backend.health.checking_runtimes")
        self._check_and_heal_runtimes(is_online, result)

        # Step 6: Tools
        self._emit_bootstrap(90, "backend.health.checking_tools")
        self._check_and_heal_tools(is_online, result)

        # Step 7: Finalize & Sync
        self._emit_bootstrap(100, "backend.health.finalizing")
        if hasattr(self.api, 'project') and hasattr(self.api.project, 'sync_apache_vhosts'):
            try:
                self.api.project.sync_apache_vhosts()
            except Exception:
                pass

        return result
