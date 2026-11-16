import os
import sys
import shutil
from typing import Optional
import subprocess
try:
    import winreg
except ImportError:
    winreg = None
import ctypes
import urllib.request
import urllib.error
import urllib.parse
import json
import re
import concurrent.futures

from core.utils.system_utils import (
    get_project_root,
    run_silent_command,
    get_silent_flags,
    is_in_user_path,
    modify_user_path,
)
from core.utils.file_utils import download_advanced, read_json, write_json
from core.utils.network_utils import is_network_error, check_host_reachability
from core.utils.cancellation import InstallationManager, OperationCancelledError
import time
GIT_EXE = "git.exe" if sys.platform == "win32" else "git"
MSG_INSTALL_CANCELLED = "backend.git.install_cancelled"
MSG_EXTRACTING_BINARY = "backend.git.extracting_binary"
MSG_INSTALL_ERROR = "backend.git.install_error"
DEFAULT_GIT_HOST = "github.com"
DEFAULT_GITHUB_HOST = "api.github.com"
GITHUB_API_ACCEPT_HEADER = "application/vnd.github.v3+json"

class GitManager:
    """
    Manager terpusat untuk siklus hidup Git Version Control.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.bin_dir = os.path.join(self.root_dir, 'bin')
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.accounts_path = os.path.join(self.data_dir, 'git_accounts.json')
        os.makedirs(self.bin_dir, exist_ok=True)
        os.makedirs(self.data_dir, exist_ok=True)

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str, args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg, args)

    @staticmethod
    def _is_matching_internal_path(path: str, clean_vylo: str) -> bool:
        real_target = os.path.normpath(os.path.realpath(path)).lower()
        return bool(clean_vylo and (real_target.startswith(clean_vylo) or clean_vylo in real_target))

    @staticmethod
    def _build_posix_clean_paths(clean_vylo: str, env: dict) -> list[str]:
        clean_paths = [p for p in env.get('PATH', '').split(os.pathsep) if not clean_vylo or clean_vylo not in p.lower()]
        for std_dir in ['/usr/bin', '/bin', '/usr/local/bin']:
            if std_dir not in clean_paths and os.path.isdir(std_dir):
                clean_paths.append(std_dir)
        return clean_paths

    def _find_via_which(self, vyloserve_bin: str) -> Optional[str]:
        if sys.platform == 'win32':
            return None
        clean_vylo = os.path.normpath(vyloserve_bin).lower() if vyloserve_bin else ""
        clean_paths = self._build_posix_clean_paths(clean_vylo, os.environ)
        found = shutil.which('git', path=os.pathsep.join(clean_paths))
        if not found:
            return None
        if not self._is_matching_internal_path(found, clean_vylo):
            return found
        remaining = [p for p in clean_paths if os.path.normpath(p) != os.path.normpath(os.path.dirname(found))]
        found_next = shutil.which('git', path=os.pathsep.join(remaining))
        if found_next and not self._is_matching_internal_path(found_next, clean_vylo):
            return found_next
        return None

    def _find_via_where(self, vyloserve_bin: str) -> Optional[str]:
        if sys.platform != 'win32': return None
        clean_vylo = os.path.normpath(vyloserve_bin).lower() if vyloserve_bin else ""
        try:
            res = subprocess.run(['where', 'git'], capture_output=True, text=True, creationflags=get_silent_flags())
            if res.returncode == 0:
                for p in res.stdout.strip().split('\n'):
                    p_clean = os.path.normpath(p.strip())
                    real_p = os.path.normpath(os.path.realpath(p_clean)).lower()
                    if p_clean and (not clean_vylo or clean_vylo not in p_clean.lower()) and (not clean_vylo or not real_p.startswith(clean_vylo)):
                        return p_clean
        except Exception: pass
        return None

    def _find_via_registry(self, vyloserve_bin: str) -> Optional[str]:
        if sys.platform != 'win32': return None
        raw_paths = []
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 0, winreg.KEY_READ) as key:
                sys_path, _ = winreg.QueryValueEx(key, 'Path')
                if sys_path: raw_paths.extend(sys_path.split(';'))
        except Exception: pass

        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_READ) as key:
                user_path, _ = winreg.QueryValueEx(key, 'Path')
                if user_path: raw_paths.extend(user_path.split(';'))
        except Exception: pass

        clean_paths = []
        for p in raw_paths:
            p_clean = p.strip(' "\'')
            if not p_clean: continue
            p_expanded = os.path.expandvars(p_clean) 
            if vyloserve_bin not in os.path.normpath(p_expanded).lower(): clean_paths.append(p_expanded)
        
        fresh_path_env = os.pathsep.join(clean_paths)
        return shutil.which('git', path=fresh_path_env)

    def _find_via_hardcoded(self) -> Optional[str]:
        if sys.platform != 'win32': return None
        standard_paths = [
            os.environ.get('PROGRAMFILES', 'C:\\Program Files') + r'\Git\cmd\git.exe',
            os.environ.get('PROGRAMFILES(X86)', 'C:\\Program Files (x86)') + r'\Git\cmd\git.exe',
            os.environ.get('LOCALAPPDATA', '') + r'\Programs\Git\cmd\git.exe'
        ]
        for sp in standard_paths:
            if sp and os.path.exists(sp): return sp
        return None

    def _validate_git_binary(self, found_path: str, silent: bool = False):
        try:
            creation_flags = get_silent_flags()
            
            result = subprocess.run([found_path, '--version'], capture_output=True, text=True, creationflags=creation_flags)
            
            version_out = result.stdout.strip() or result.stderr.strip()
            
            if version_out:
                import re
                match = re.search(r'git version (\d+\.\d+\.\d+)', version_out)
                if match:
                    if not silent:
                        self._log("backend.git.external_detected", "success", {"version": match.group(1), "path": found_path})
                    return {"exists": True, "version": match.group(1), "path": found_path}
        except Exception: pass
        return None

    # ==========================================
    # PENDETEKSI INSTALASI EKSTERNAL (4 LAPIS)
    # ==========================================
    def _check_external_installation(self, silent: bool = False):
        if not silent and hasattr(self, 'api'):
            self._log("backend.git.scanning_external", "info")

        vyloserve_bin = os.path.normpath(os.path.join(self.root_dir, 'bin')).lower()
        
        found_path = (
            self._find_via_which(vyloserve_bin) or
            self._find_via_where(vyloserve_bin) or
            self._find_via_registry(vyloserve_bin) or
            self._find_via_hardcoded()
        )

        if found_path:
            validated = self._validate_git_binary(found_path, silent=silent)
            if validated: return validated

        return {"exists": False, "version": "Unknown", "path": ""}

    def _is_in_user_path(self, target_path: str) -> bool:
        return is_in_user_path(target_path)


    # ==========================================
    # CORE GIT API & INSTALASI
    # ==========================================
    def get_git_status(self, silent: bool = False):
        git_dir = os.path.join(self.bin_dir, 'git')
        git_exe = os.path.join(git_dir, 'cmd', GIT_EXE if sys.platform == 'win32' else 'git')
        
        internal_installed = os.path.exists(git_exe)
        internal_version = ""
        if internal_installed:
            try:
                res = subprocess.run([git_exe, '--version'], capture_output=True, text=True, creationflags=get_silent_flags())
                raw_ver = res.stdout.strip().replace('git version ', '')
                internal_version = raw_ver.replace('.windows.', '.')
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation(silent=silent)

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(os.path.join(git_dir, 'cmd')),
            'external': external_info
        }

    def _get_linux_git_versions(self) -> dict:
        sys_git = self._check_external_installation(silent=True)
        results = []
        if sys_git.get("exists"):
            ver = sys_git.get("version", "System")
            results.append({
                'value': 'system',
                'label': f"Git v{ver} (System Package)",
                'filename': 'git',
                'version_text': ver
            })
        else:
            results.append({
                'value': 'system',
                'label': "Git (Distro Package - apt/dnf/pacman)",
                'filename': 'git',
                'version_text': 'system'
            })
        return {'status': 'success', 'data': results}

    @staticmethod
    def _check_binary_head(candidate: dict) -> Optional[dict]:
        try:
            head_req = urllib.request.Request(candidate['download_url'], method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(head_req, timeout=4)
            if res.status in (200, 301, 302):
                return candidate
        except Exception:
            pass
        return None

    def _validate_git_candidates_parallel(self, candidates: list, unique_tags: list) -> list:
        valid_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(self._check_binary_head, c) for c in candidates[:20]]
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                if res:
                    valid_results.append(res)

        if not valid_results:
            raise RuntimeError("Biner PortableGit 64-bit tidak ditemukan pada 20 rilis terbaru.")

        original_order = {tag: i for i, tag in enumerate(unique_tags)}
        valid_results.sort(key=lambda x: original_order[x['tag']])
        return valid_results

    def get_available_git_versions(self):
        """ Web Scraper Pintar: Memindai rilis Git & Memvalidasi Biner Asli via HTTP HEAD """
        if sys.platform != 'win32':
            return self._get_linux_git_versions()

        try:
            url = 'https://github.com/git-for-windows/git/releases/'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
            
            pattern = r'expanded_assets/([^"]+)'
            tags = re.findall(pattern, html)
            unique_tags = list(dict.fromkeys(tags))
            
            candidates = []
            for tag in unique_tags:
                clean_ver = tag.lstrip('v').replace('.windows.', '.')
                download_url = f"https://github.com/git-for-windows/git/releases/download/{tag}/PortableGit-{clean_ver}-64-bit.7z.exe"
                filename = f"PortableGit-{clean_ver}-64-bit.7z.exe"
                candidates.append({
                    'tag': tag,
                    'clean_ver': clean_ver,
                    'download_url': download_url,
                    'filename': filename
                })
                
            valid_results = self._validate_git_candidates_parallel(candidates, unique_tags)

            results = []
            for i, v in enumerate(valid_results[:15]): 
                label = f"Git v{v['clean_ver']}"
                if i == 0:
                    label += " (Latest Release)"
                results.append({
                    'value': v['download_url'], 
                    'label': label,
                    'filename': v['filename'],
                    'version_text': v['clean_ver']
                })
                
            return {'status': 'success', 'data': results}
            
        except Exception as e:
            res = {'status': 'error', 'message': "backend.git.fetch_failed"}
            if is_network_error(e):
                res['is_offline'] = True
            return res

    def _extract_sfx(self, exe_path: str, git_dir: str):
        if sys.platform != 'win32' and os.path.exists(exe_path):
            try:
                os.chmod(exe_path, os.stat(exe_path).st_mode | 0o700)
            except OSError:
                pass
        creation_flags = get_silent_flags()
        res = subprocess.run([exe_path, "-y", f"-o{git_dir}"], capture_output=True, creationflags=creation_flags)
        if res.returncode != 0:
            raise RuntimeError("Gagal mengekstrak PortableGit. File instalasi mungkin korup.")
        if os.path.exists(exe_path):
            os.remove(exe_path)

    def _cleanup_git_paths(self, exe_path: str, git_dir: str = None):
        if os.path.exists(exe_path):
            try: os.remove(exe_path)
            except Exception: pass
        if git_dir and os.path.exists(git_dir):
            shutil.rmtree(git_dir, ignore_errors=True)

    def _download_git_binary(self, download_url: str, exe_path: str, token):
        def log_cb(msg, lvl="info"): 
            self._log(msg, lvl)
        def download_prog_cb(pct, msg, args=None):
            clamped_pct = max(5, min(pct, 74))
            self._progress(clamped_pct, msg, args)

        log_cb("backend.git.starting_download", "info")
        download_advanced(download_url, exe_path, log_cb=log_cb, progress_cb=download_prog_cb, cancel_check=token.is_cancelled)
        if token.is_cancelled():
            raise OperationCancelledError()

    def _run_linux_git_pkg_install(self, pkexec: str, apt_get: Optional[str], dnf: Optional[str], pacman: Optional[str]):
        if apt_get:
            subprocess.run([pkexec, apt_get, "update"], capture_output=True)
            if hasattr(self, 'api'):
                self._progress(60, MSG_EXTRACTING_BINARY)
            return subprocess.run([pkexec, apt_get, "install", "-y", "git"], capture_output=True, text=True)
        if dnf:
            if hasattr(self, 'api'):
                self._progress(60, MSG_EXTRACTING_BINARY)
            return subprocess.run([pkexec, dnf, "install", "-y", "git"], capture_output=True, text=True)
        if pacman:
            if hasattr(self, 'api'):
                self._progress(60, MSG_EXTRACTING_BINARY)
            return subprocess.run([pkexec, pacman, "-S", "--noconfirm", "git"], capture_output=True, text=True)
        return None

    def _install_git_linux(self, version_text: str = "") -> dict:
        pkexec = shutil.which("pkexec")
        apt_get = shutil.which("apt-get")
        dnf = shutil.which("dnf")
        pacman = shutil.which("pacman")

        if not pkexec:
            return {"status": "error", "message": "backend.git.no_pkexec"}

        if hasattr(self, 'api'):
            self._log("backend.git.install_start", "info", {"version": version_text or "system"})
            self._progress(20, "backend.git.preparing_download")

        try:
            res = self._run_linux_git_pkg_install(pkexec, apt_get, dnf, pacman)
            if res is None:
                return {"status": "error", "message": "backend.git.unsupported_linux_distro"}

            if res.returncode in (126, 127):
                if hasattr(self, 'api'):
                    self._progress(0, MSG_INSTALL_CANCELLED)
                    self._log(MSG_INSTALL_CANCELLED, "warn")
                return {"status": "cancelled", "message": MSG_INSTALL_CANCELLED}

            if res.returncode != 0:
                raise RuntimeError(res.stderr.strip() or f"Distro package manager exited with code {res.returncode}")

            if hasattr(self, 'api'):
                self._progress(100, "backend.git.install_complete")
                self._log("backend.git.ready_to_use", "success")

            return {"status": "success", "message": "backend.git.install_success"}
        except Exception as e:
            if hasattr(self, 'api'):
                self._progress(-1, "backend.git.install_failed")
                self._log(MSG_INSTALL_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_INSTALL_ERROR, "args": {"e": str(e)}}

    def install_git(self, download_url: str, filename: str, version_text: str):
        if download_url == "system" or filename == "system" or version_text == "system":
            return self._install_git_linux(version_text)

        git_dir = os.path.join(self.bin_dir, 'git')
        exe_path = os.path.join(self.bin_dir, filename)
        token = InstallationManager.get_token("git")

        try:
            # 1. LOG INISIALISASI
            if hasattr(self, 'api'): 
                self._log("backend.git.install_start", "info", {"version": version_text})
                self._progress(5, "backend.git.preparing_download")

            # 2. FASE UNDUHAN
            self._download_git_binary(download_url, exe_path, token)

            # 3. FASE EKSTRAKSI SFX
            if hasattr(self, 'api'): 
                self._log("backend.git.download_complete_extracting", "info")
                self._progress(75, MSG_EXTRACTING_BINARY)
            
            if os.path.exists(git_dir): shutil.rmtree(git_dir, ignore_errors=True)
            self._extract_sfx(exe_path, git_dir)

            # 4. FINALISASI
            if hasattr(self, 'api'): 
                self._progress(100, "backend.git.install_complete")
                self._log("backend.git.ready_to_use", "success")
                
            return {"status": "success", "message": "backend.git.install_success"}

        except OperationCancelledError:
            self._cleanup_git_paths(exe_path, git_dir)
            if hasattr(self, 'api'):
                self._progress(0, MSG_INSTALL_CANCELLED)
                self._log(MSG_INSTALL_CANCELLED, "warn")
            return {"status": "cancelled", "message": MSG_INSTALL_CANCELLED}

        except Exception as e:
            self._cleanup_git_paths(exe_path)
            if hasattr(self, 'api'):
                self._progress(-1, "backend.git.install_failed")
                self._log(MSG_INSTALL_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_INSTALL_ERROR, "args": {"e": str(e)}}
        finally:
            InstallationManager.reset("git")

    def uninstall_git(self):
        git_dir = os.path.join(self.bin_dir, 'git')
        self.toggle_user_path(False)
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir, ignore_errors=True)
        self._log("backend.git.uninstalled", "warn")
        return {"status": "success"}

    def toggle_user_path(self, enable: bool):
        """ Mengatur PATH khusus untuk Git (folder cmd/) """
        target_path = os.path.join(self.bin_dir, 'git', 'cmd')
        try:
            modify_user_path(
                add_paths=[target_path] if enable else None,
                remove_paths=[target_path] if not enable else None,
                auto_broadcast=True
            )
            self._log("backend.git.path_updated", "success")
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": "backend.git.registry_error", "args": {"e": str(e)}}
            
    def _get_git_exe(self) -> str:
        git_dir = os.path.join(self.bin_dir, 'git')
        git_exe = os.path.join(git_dir, 'cmd', GIT_EXE if sys.platform == 'win32' else 'git')
        if os.path.exists(git_exe):
            return git_exe
        return 'git'

    def _extract_gitconfig_credential_hosts(self) -> set:
        hosts_found = set()
        gitconfig_path = os.path.expanduser("~/.gitconfig")
        if os.path.isfile(gitconfig_path):
            try:
                with open(gitconfig_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for m in re.finditer(r'\[credential\s+["\'](?:https?://)?([^"\'/]+)["\']\]', content, re.IGNORECASE):
                    h = self._clean_endpoint(m.group(1))
                    if h and ("." in h or h.startswith("localhost")):
                        hosts_found.add(h)
            except Exception:
                pass
        return hosts_found

    def _extract_www_repo_hosts(self) -> set:
        hosts_found = set()
        www_dir = os.path.join(self.root_dir, "www")
        if not os.path.isdir(www_dir):
            return hosts_found
        try:
            for entry in os.listdir(www_dir):
                cfg_file = os.path.join(www_dir, entry, ".git", "config")
                if os.path.isfile(cfg_file):
                    with open(cfg_file, "r", encoding="utf-8", errors="ignore") as f:
                        cfg_txt = f.read()
                    url_m = re.search(r"url\s*=\s*([^\r\n]+)", cfg_txt)
                    if url_m:
                        remote_u = url_m.group(1).strip()
                        clean_h = self._clean_endpoint(remote_u)
                        if clean_h and clean_h not in (DEFAULT_GIT_HOST, "gitlab.com", "bitbucket.org"):
                            hosts_found.add(clean_h)
        except Exception:
            pass
        return hosts_found

    def _build_legacy_account(self, h: str, uname: str, uemail: str, is_default: bool, now: int) -> dict:
        is_internal = (h.lower() not in (DEFAULT_GIT_HOST, "gitlab.com", "bitbucket.org"))
        acc_id = f"git_legacy_{h}_{uname}".replace(".", "_").replace(" ", "_")
        stored_tok = self._get_stored_git_credential("https", h, uname)
        return {
            "id": acc_id,
            "label": f"{uname} ({h})",
            "endpoint": h,
            "username": uname,
            "remote_username": uname,
            "email": uemail,
            "protocol": "https",
            "auth_mode": "credentials" if stored_tok else "pat",
            "token": stored_tok,
            "ssh_key_path": "",
            "is_default": is_default,
            "requires_vpn": is_internal,
            "created_at": now,
            "updated_at": now,
        }

    def _discover_legacy_git_accounts(self, existing_accounts: list) -> list:
        discovered = list(existing_accounts)
        existing_keys = {(a.get("endpoint", "").lower(), a.get("username", "").lower()) for a in existing_accounts if isinstance(a, dict)}

        name = ""
        email = ""
        try:
            cfg = self.get_git_config()
            if cfg.get("status") == "success":
                name = cfg.get("data", {}).get("name", "").strip()
                email = cfg.get("data", {}).get("email", "").strip()
        except Exception:
            pass

        hosts_found = self._extract_gitconfig_credential_hosts() | self._extract_www_repo_hosts()

        if not hosts_found and (name or email):
            hosts_found.add(DEFAULT_GIT_HOST)

        now = int(time.time())
        for h in sorted(hosts_found):
            uname = name or "developer"
            uemail = email or ""
            key = (h.lower(), uname.lower())
            if key not in existing_keys:
                discovered.append(self._build_legacy_account(h, uname, uemail, len(discovered) == 0, now))
                existing_keys.add(key)

        return discovered

    def _read_accounts_file(self) -> dict:
        data = read_json(self.accounts_path, default_type=dict)
        if not isinstance(data, dict):
            data = {}
        if "accounts" not in data or not isinstance(data["accounts"], list):
            data["accounts"] = []
        if "default_account_id" not in data:
            data["default_account_id"] = ""

        if not data.get("legacy_migrated"):
            migrated = self._discover_legacy_git_accounts(data["accounts"])
            if migrated != data["accounts"]:
                data["accounts"] = migrated
                if not data["default_account_id"] and migrated:
                    data["default_account_id"] = migrated[0]["id"]
            data["legacy_migrated"] = True
            self._write_accounts_file(data)

        return data

    def _write_accounts_file(self, data: dict) -> bool:
        ok = write_json(self.accounts_path, data)
        if ok and sys.platform != "win32":
            try:
                os.chmod(self.accounts_path, 0o600)
            except Exception:
                pass
        return ok

    @staticmethod
    def _mask_token(token: str) -> str:
        if not token:
            return ""
        return "••••••••"

    @staticmethod
    def _clean_endpoint(endpoint: str) -> str:
        ep = (endpoint or DEFAULT_GIT_HOST).strip()
        ep = re.sub(r"^https?://", "", ep, flags=re.IGNORECASE)
        ep = ep.split("/")[0].strip()
        return ep or DEFAULT_GIT_HOST

    # ==========================================
    # MANAJEMEN KONFIGURASI GIT (user.name / user.email)
    # ==========================================
    def get_git_config(self):
        """ Membaca konfigurasi global Git dari OS """
        git_exe = self._get_git_exe()
        try:
            cflags = get_silent_flags()
            name_res = subprocess.run([git_exe, 'config', '--global', 'user.name'], capture_output=True, text=True, creationflags=cflags)
            email_res = subprocess.run([git_exe, 'config', '--global', 'user.email'], capture_output=True, text=True, creationflags=cflags)
            
            return {
                "status": "success", 
                "data": {
                    "name": name_res.stdout.strip(), 
                    "email": email_res.stdout.strip()
                }
            }
        except Exception as e:
            return {"status": "error", "message": "backend.git.read_config_failed", "args": {"e": str(e)}}

    def set_git_config(self, name: str, email: str):
        """ Menyimpan konfigurasi global Git """
        git_exe = self._get_git_exe()

        try:
            cflags = get_silent_flags()
            if name: subprocess.run([git_exe, 'config', '--global', 'user.name', name], creationflags=cflags)
            if email: subprocess.run([git_exe, 'config', '--global', 'user.email', email], creationflags=cflags)
            self._log("backend.git.config_updated", "success")
            return {"status": "success"}
        except Exception as e:
            self._log("backend.git.config_error", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.git.config_error", "args": {"e": str(e)}}

    # ==========================================
    # MANAJEMEN AKUN & PROFIL GIT
    # ==========================================
    def _store_git_credential(self, protocol: str, host: str, username: str, token: str) -> bool:
        """ Menyimpan kredensial ke Git Credential Helper via stdin aman """
        if not (host and username and token):
            return False
        try:
            git_exe = self._get_git_exe()
            cred_payload = f"protocol={protocol}\nhost={host}\nusername={username}\npassword={token}\n\n"
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            env["GCM_INTERACTIVE"] = "never"
            proc = subprocess.Popen(
                [git_exe, "credential", "approve"],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
                creationflags=get_silent_flags(),
                text=True,
            )
            try:
                proc.communicate(input=cred_payload, timeout=2)
                return proc.returncode == 0
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                return False
        except Exception:
            return False

    def _delete_git_credential(self, protocol: str, host: str, username: str) -> bool:
        """ Menghapus kredensial dari Git Credential Helper via stdin """
        if not (host and username):
            return False
        try:
            git_exe = self._get_git_exe()
            cred_payload = f"protocol={protocol}\nhost={host}\nusername={username}\n\n"
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            env["GCM_INTERACTIVE"] = "never"
            proc = subprocess.Popen(
                [git_exe, "credential", "reject"],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
                creationflags=get_silent_flags(),
                text=True,
            )
            try:
                proc.communicate(input=cred_payload, timeout=2)
                return proc.returncode == 0
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                return False
        except Exception:
            return False

    def _get_gcm_exe(self) -> Optional[str]:
        """ Mencari binary git-credential-manager di PortableGit atau PATH """
        candidates = [
            os.path.join(self.bin_dir, "git", "ucrt64", "bin", "git-credential-manager.exe"),
            os.path.join(self.bin_dir, "git", "mingw64", "bin", "git-credential-manager.exe"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c
        return shutil.which("git-credential-manager")

    def _get_stored_git_credential(self, protocol: str, host: str, username: str = "") -> str:
        """ Membaca password/token tersimpan dari Git Credential Helper secara non-interaktif """
        if not host:
            return ""
        try:
            gcm_exe = self._get_gcm_exe()
            cmd = [gcm_exe, "get"] if gcm_exe else [self._get_git_exe(), "credential", "fill"]
            cred_payload = f"protocol={protocol}\nhost={host}\n"
            if username and " " not in username:
                cred_payload += f"username={username}\n"
            cred_payload += "\n"

            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            env["GCM_INTERACTIVE"] = "never"
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                env=env,
                creationflags=get_silent_flags(),
                text=True,
            )
            try:
                stdout_data, _ = proc.communicate(input=cred_payload, timeout=2)
                if proc.returncode == 0 and stdout_data:
                    for line in stdout_data.splitlines():
                        if line.startswith("password="):
                            return line.partition("=")[2].strip()
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
        except Exception:
            pass
        return ""

    def _authenticate_via_gcm_interactive(self, host: str) -> tuple:
        """ Menjalankan alur login interaktif browser via Git Credential Manager """
        if not host:
            return None, None
        try:
            gcm_exe = self._get_gcm_exe()
            cmd = [gcm_exe, "get"] if gcm_exe else [self._get_git_exe(), "-c", "credential.helper=manager", "credential", "fill"]
            cred_payload = f"protocol=https\nhost={host}\n\n"
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                env=env,
                creationflags=get_silent_flags(),
                text=True,
            )
            try:
                stdout_data, _ = proc.communicate(input=cred_payload, timeout=120)
                if proc.returncode == 0 and stdout_data:
                    detected_user = None
                    detected_tok = None
                    for line in stdout_data.splitlines():
                        if line.startswith("username="):
                            detected_user = line.partition("=")[2].strip()
                        elif line.startswith("password="):
                            detected_tok = line.partition("=")[2].strip()
                    if detected_tok:
                        self._store_git_credential("https", host, detected_user or "oauth", detected_tok)
                        return detected_user, detected_tok
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
        except Exception:
            pass
        return None, None

    @staticmethod
    def _request_github_user_profile(url: str, auth_val: str) -> tuple:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "VyloServe-Desktop",
                    "Authorization": auth_val,
                    "Accept": GITHUB_API_ACCEPT_HEADER,
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8", errors="ignore"))
                    if isinstance(data, dict) and (data.get("login") or data.get("id")):
                        return data, ""
        except urllib.error.HTTPError as he:
            return None, f"HTTP {he.code}: {he.reason}"
        except Exception as e:
            return None, str(e)
        return None, ""

    def _verify_github_token_via_api(self, token: str) -> tuple:
        """
        Memvalidasi Personal Access Token / OAuth Token ke GitHub REST API /user.
        Mengembalikan tuple (user_dict, error_message).
        """
        clean_tok = (token or "").strip()
        if not clean_tok:
            return None, "Missing token"

        url = f"https://{DEFAULT_GITHUB_HOST}/user"
        auth_headers = (
            [clean_tok]
            if clean_tok.startswith(("Bearer ", "token "))
            else [f"Bearer {clean_tok}", f"token {clean_tok}"]
        )
        last_error = ""
        for auth_val in auth_headers:
            user_data, err = self._request_github_user_profile(url, auth_val)
            if user_data:
                return user_data, None
            if err:
                last_error = err
        return None, last_error or "Invalid GitHub token"

    def get_git_accounts(self) -> dict:
        """
        Mengambil daftar seluruh akun Git yang tersimpan di data/git_accounts.json,
        dengan token yang disensor untuk keamanan frontend.
        """
        config = self._read_accounts_file()
        default_id = config.get("default_account_id", "")
        accounts = config.get("accounts", [])

        current_config = self.get_git_config()
        curr_name = ""
        curr_email = ""
        if current_config.get("status") == "success":
            curr_name = current_config.get("data", {}).get("name", "")
            curr_email = current_config.get("data", {}).get("email", "")

        safe_accounts = []
        for acc in accounts:
            if not isinstance(acc, dict):
                continue
            acc_id = acc.get("id", "")
            u_name = acc.get("username", "")
            u_email = acc.get("email", "")
            token_val = acc.get("token", "")
            is_def = (acc_id == default_id) or acc.get("is_default", False)
            is_push_active = bool(curr_name and curr_email and (u_name == curr_name) and (u_email == curr_email))
            req_vpn = bool(acc.get("requires_vpn", False))
            vpn_reachable = True
            if req_vpn:
                try:
                    vpn_reachable = check_host_reachability(acc.get("endpoint", DEFAULT_GIT_HOST), timeout=1.0).get("reachable", False)
                except Exception:
                    vpn_reachable = False

            safe_accounts.append({
                "id": acc_id,
                "label": acc.get("label", f"{u_name} ({acc.get('endpoint', DEFAULT_GIT_HOST)})"),
                "endpoint": acc.get("endpoint", DEFAULT_GIT_HOST),
                "username": u_name,
                "email": u_email,
                "protocol": acc.get("protocol", "https"),
                "auth_mode": acc.get("auth_mode", "pat"),
                "has_token": bool(token_val),
                "masked_token": self._mask_token(token_val),
                "ssh_key_path": acc.get("ssh_key_path", ""),
                "requires_vpn": req_vpn,
                "vpn_reachable": vpn_reachable,
                "is_default": is_def,
                "is_push_active": is_push_active,
                "created_at": acc.get("created_at", 0),
                "updated_at": acc.get("updated_at", 0),
            })

        return {
            "status": "success",
            "accounts": safe_accounts,
            "default_account_id": default_id,
            "active_push": {
                "name": curr_name,
                "email": curr_email
            }
        }

    def _verify_github_account_on_save(self, endpoint: str, auth_mode: str, token: str, requires_vpn: bool, remote_username: str) -> tuple[bool, str, Optional[str]]:
        if DEFAULT_GIT_HOST in endpoint.lower() and auth_mode in ("pat", "credentials", "gcm") and token:
            is_reachable = True
            if requires_vpn:
                try:
                    is_reachable = check_host_reachability(endpoint, timeout=1.5).get("reachable", False)
                except Exception:
                    is_reachable = False

            if is_reachable:
                gh_user, _ = self._verify_github_token_via_api(token)
                if not gh_user:
                    return False, "backend.git.github_pat_required", None
                return True, "", gh_user.get("login") or remote_username
        return True, "", remote_username

    def _normalize_account_input(self, account_data: dict) -> tuple:
        if not isinstance(account_data, dict):
            return None, {"status": "error", "message": "backend.git.missing_username"}

        username = (account_data.get("username") or "").strip()
        email = (account_data.get("email") or "").strip()

        if not username:
            return None, {"status": "error", "message": "backend.git.missing_username"}
        if not email:
            return None, {"status": "error", "message": "backend.git.missing_email"}

        endpoint = self._clean_endpoint(account_data.get("endpoint", DEFAULT_GIT_HOST))
        protocol = account_data.get("protocol", "https")
        if protocol not in ("https", "ssh"):
            protocol = "https"

        auth_mode = account_data.get("auth_mode", "pat")
        if auth_mode not in ("pat", "credentials", "oauth", "ssh", "gcm"):
            auth_mode = "pat"

        label = (account_data.get("label") or "").strip() or f"{username} ({endpoint})"

        return {
            "username": username,
            "email": email,
            "endpoint": endpoint,
            "protocol": protocol,
            "auth_mode": auth_mode,
            "label": label,
            "token": (account_data.get("token") or "").strip(),
            "ssh_key_path": (account_data.get("ssh_key_path") or "").strip(),
            "requires_vpn": bool(account_data.get("requires_vpn", False)),
            "set_as_default": bool(account_data.get("set_as_default", False)),
            "account_id": (account_data.get("id") or "").strip(),
        }, None

    def _resolve_gcm_and_github_token(self, endpoint: str, auth_mode: str, token: str, existing_token: str, remote_username: str, requires_vpn: bool) -> tuple:
        active_token = token
        active_remote = remote_username
        if auth_mode == "gcm" and not active_token and not existing_token:
            gcm_user, gcm_tok = self._authenticate_via_gcm_interactive(endpoint)
            if gcm_tok:
                active_token = gcm_tok
                if gcm_user:
                    active_remote = gcm_user
            else:
                return False, "backend.git.gcm_auth_failed", "", ""

        ok, err_msg, new_remote = self._verify_github_account_on_save(endpoint, auth_mode, active_token, requires_vpn, active_remote)
        if not ok:
            return False, err_msg, "", ""
        return True, "", active_token, new_remote or active_remote

    @staticmethod
    def _upsert_account_in_list(accounts: list, existing_idx: Optional[int], norm_data: dict, token: str, remote_username: str, now: int) -> str:
        if existing_idx is not None:
            target_acc = accounts[existing_idx]
            saved_token = token if token else target_acc.get("token", "")
            target_acc.update({
                "label": norm_data["label"],
                "endpoint": norm_data["endpoint"],
                "username": norm_data["username"],
                "remote_username": remote_username or target_acc.get("remote_username", ""),
                "email": norm_data["email"],
                "protocol": norm_data["protocol"],
                "auth_mode": norm_data["auth_mode"],
                "token": saved_token,
                "ssh_key_path": norm_data["ssh_key_path"],
                "requires_vpn": norm_data["requires_vpn"],
                "updated_at": now,
            })
            return norm_data["account_id"]

        acc_id = f"git_{int(time.time() * 1000)}"
        accounts.append({
            "id": acc_id,
            "label": norm_data["label"],
            "endpoint": norm_data["endpoint"],
            "username": norm_data["username"],
            "remote_username": remote_username,
            "email": norm_data["email"],
            "protocol": norm_data["protocol"],
            "auth_mode": norm_data["auth_mode"],
            "token": token,
            "ssh_key_path": norm_data["ssh_key_path"],
            "requires_vpn": norm_data["requires_vpn"],
            "is_default": False,
            "created_at": now,
            "updated_at": now,
        })
        return acc_id

    def _finalize_saved_account(self, config: dict, accounts: list, acc_id: str, norm_data: dict, token: str, existing_idx: Optional[int]):
        if norm_data["set_as_default"] or len(accounts) == 1:
            config["default_account_id"] = acc_id
            for a in accounts:
                a["is_default"] = (a.get("id") == acc_id)
            self.set_git_config(norm_data["username"], norm_data["email"])

        config["accounts"] = accounts
        self._write_accounts_file(config)

        if norm_data["auth_mode"] in ("pat", "credentials") and (token or (existing_idx is not None and accounts[existing_idx].get("token"))):
            active_token = token or accounts[existing_idx].get("token")
            self._store_git_credential(norm_data["protocol"], norm_data["endpoint"], norm_data["username"], active_token)

    def save_git_account(self, account_data: dict) -> dict:
        norm_data, err_res = self._normalize_account_input(account_data)
        if err_res:
            return err_res

        config = self._read_accounts_file()
        accounts = config.get("accounts", [])
        now = int(time.time())

        existing_idx = None
        if norm_data["account_id"]:
            for idx, a in enumerate(accounts):
                if a.get("id") == norm_data["account_id"]:
                    existing_idx = idx
                    break

        existing_token = accounts[existing_idx].get("token", "") if existing_idx is not None else ""
        remote_username = accounts[existing_idx].get("remote_username", "") if existing_idx is not None else ""

        ok, err_msg, token, remote_username = self._resolve_gcm_and_github_token(
            norm_data["endpoint"], norm_data["auth_mode"], norm_data["token"], existing_token, remote_username, norm_data["requires_vpn"]
        )
        if not ok:
            return {"status": "error", "message": err_msg, "args": {"host": norm_data["endpoint"]}}

        acc_id = self._upsert_account_in_list(accounts, existing_idx, norm_data, token, remote_username, now)
        self._finalize_saved_account(config, accounts, acc_id, norm_data, token, existing_idx)

        self._log("backend.git.account_saved", "info", {"user": norm_data["username"], "host": norm_data["endpoint"]})
        return {
            "status": "success",
            "message": "backend.git.account_saved",
            "args": {"user": norm_data["username"], "host": norm_data["endpoint"]},
            "account_id": acc_id,
        }

    def delete_git_account(self, account_id: str) -> dict:
        """
        Menghapus akun Git dari data/git_accounts.json.
        """
        config = self._read_accounts_file()
        accounts = config.get("accounts", [])
        def_id = config.get("default_account_id", "")

        target = next((a for a in accounts if a.get("id") == account_id), None)
        if not target:
            return {"status": "error", "message": "backend.git.account_not_found"}

        user = target.get("username", "user")
        if target.get("auth_mode") in ("pat", "credentials") and target.get("protocol") == "https":
            self._delete_git_credential("https", target.get("endpoint", DEFAULT_GIT_HOST), user)

        accounts = [a for a in accounts if a.get("id") != account_id]
        if def_id == account_id:
            if accounts:
                config["default_account_id"] = accounts[0].get("id", "")
                accounts[0]["is_default"] = True
                self.set_git_config(accounts[0].get("username", ""), accounts[0].get("email", ""))
            else:
                config["default_account_id"] = ""

        config["accounts"] = accounts
        self._write_accounts_file(config)

        self._log("backend.git.account_deleted", "info", {"user": user})
        return {
            "status": "success",
            "message": "backend.git.account_deleted",
            "args": {"user": user},
        }

    def set_default_git_account(self, account_id: str) -> dict:
        """
        Menetapkan akun tertentu sebagai default push dan menyinkronkan identitasnya ke git config global.
        """
        config = self._read_accounts_file()
        accounts = config.get("accounts", [])
        target = next((a for a in accounts if a.get("id") == account_id), None)
        if not target:
            return {"status": "error", "message": "backend.git.account_not_found"}

        config["default_account_id"] = account_id
        for a in accounts:
            a["is_default"] = (a.get("id") == account_id)

        self._write_accounts_file(config)
        u_name = target.get("username", "")
        u_email = target.get("email", "")
        self.set_git_config(u_name, u_email)

        self._log("backend.git.account_default_set", "info", {"user": u_name})
        return {
            "status": "success",
            "message": "backend.git.account_default_set",
            "args": {"user": u_name},
        }

    @staticmethod
    def _parse_ssh_pub_file(ssh_dir: str, fname: str) -> Optional[dict]:
        full_path = os.path.join(ssh_dir, fname)
        if not os.path.isfile(full_path):
            return None
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(4096).strip()
            parts = content.split()
            key_type = parts[0] if len(parts) > 0 else "ssh-key"
            comment = parts[2] if len(parts) > 2 else fname
            return {
                "filename": fname,
                "path": full_path,
                "type": key_type,
                "comment": comment,
                "public_key": content,
            }
        except Exception:
            return None

    def get_ssh_keys(self) -> dict:
        """
        Memindai direktori ~/.ssh/ untuk menemukan public key yang tersedia.
        """
        ssh_dir = os.path.expanduser("~/.ssh")
        if not os.path.isdir(ssh_dir):
            return {"status": "success", "data": []}

        keys = []
        try:
            for fname in os.listdir(ssh_dir):
                if fname.endswith(".pub"):
                    parsed = self._parse_ssh_pub_file(ssh_dir, fname)
                    if parsed:
                        keys.append(parsed)
        except Exception:
            pass

        return {"status": "success", "data": keys}

    @staticmethod
    def _select_account_target(config: dict, accounts: list, account_id: str) -> Optional[dict]:
        if account_id:
            target = next((a for a in accounts if a.get("id") == account_id), None)
            if target:
                return target
        def_id = config.get("default_account_id", "")
        target = next((a for a in accounts if a.get("id") == def_id), None)
        if target:
            return target
        return next((a for a in accounts if a.get("is_default")), accounts[0])

    @staticmethod
    def _is_vpn_blocked(endpoint: str, requires_vpn: bool) -> bool:
        if not requires_vpn:
            return False
        try:
            probe = check_host_reachability(endpoint, timeout=1.5)
            return not probe.get("reachable", False)
        except Exception:
            return True

    def _fetch_remote_account_projects(self, target_acc: dict, endpoint: str, seen_keys: set, projects: list) -> bool:
        token = target_acc.get("token", "").strip()
        username = target_acc.get("username", "").strip()
        remote_username = target_acc.get("remote_username", "").strip()
        protocol = target_acc.get("protocol", "https")
        acc_id = target_acc.get("id", "")
        auth_warning = False

        if DEFAULT_GIT_HOST in endpoint.lower():
            if not token and protocol == "https":
                token = self._get_stored_git_credential("https", endpoint, username)
            if token:
                api_url = f"https://{DEFAULT_GITHUB_HOST}/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100"
                auth_warning = self._fetch_remote_github_repos(token, api_url, acc_id, endpoint, seen_keys, projects)
            if not projects:
                handles = [h for h in dict.fromkeys([remote_username, username]) if h and " " not in h]
                self._fetch_fallback_public_github_repos(handles, acc_id, endpoint, seen_keys, projects)
        elif "gitlab" in endpoint.lower() and token:
            self._fetch_remote_gitlab_repos(endpoint, token, acc_id, seen_keys, projects)

        return auth_warning

    def get_git_account_projects(self, account_id: str = "") -> dict:
        config = self._read_accounts_file()
        accounts = config.get("accounts", [])
        if not accounts:
            return {
                "status": "success",
                "data": {"projects": [], "account_id": "", "host": "", "username": ""},
            }

        target_acc = self._select_account_target(config, accounts, account_id)
        acc_id = target_acc.get("id", "")
        endpoint = self._clean_endpoint(target_acc.get("endpoint", DEFAULT_GIT_HOST))
        username = target_acc.get("username", "").strip()
        requires_vpn = bool(target_acc.get("requires_vpn", False))

        projects = []
        seen_keys = set()
        vpn_blocked = self._is_vpn_blocked(endpoint, requires_vpn)
        auth_warning = False

        if not vpn_blocked:
            auth_warning = self._fetch_remote_account_projects(target_acc, endpoint, seen_keys, projects)

        self._scan_local_www_repos(endpoint, acc_id, seen_keys, projects)

        return {
            "status": "success",
            "data": {
                "projects": projects,
                "account_id": acc_id,
                "host": endpoint,
                "username": username,
                "auth_warning": auth_warning,
                "requires_vpn": requires_vpn,
                "vpn_blocked": vpn_blocked,
                "vpn_host": endpoint,
            },
        }

    @staticmethod
    def _build_github_project_item(r: dict, acc_id: str, endpoint: str) -> dict:
        full_name = r.get("full_name") or r.get("name", "")
        is_private = bool(r.get("private", False))
        return {
            "id": str(r.get("id", "")),
            "name": r.get("name", ""),
            "full_name": full_name,
            "visibility": "private" if is_private else "public",
            "web_url": r.get("html_url") or f"https://github.com/{full_name}",
            "ssh_url": r.get("ssh_url", ""),
            "http_url": r.get("clone_url", ""),
            "default_branch": r.get("default_branch", "main"),
            "last_activity_at": r.get("updated_at", ""),
            "account_id": acc_id,
            "host": endpoint,
            "source": "remote",
        }

    def _append_github_repo_list(self, raw: list, acc_id: str, endpoint: str, seen_keys: set, projects: list):
        if not isinstance(raw, list):
            return
        for r in raw:
            item = self._build_github_project_item(r, acc_id, endpoint)
            fn_lower = item["full_name"].lower()
            if fn_lower not in seen_keys:
                projects.append(item)
                seen_keys.add(fn_lower)

    def _try_fetch_github_repos(self, api_url: str, auth_val: str, acc_id: str, endpoint: str, seen_keys: set, projects: list) -> tuple:
        headers = {
            "User-Agent": "VyloServe-Desktop",
            "Authorization": auth_val,
            "Accept": GITHUB_API_ACCEPT_HEADER,
        }
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8"))
                    self._append_github_repo_list(raw, acc_id, endpoint, seen_keys, projects)
                    return True, False
        except urllib.error.HTTPError as he:
            if he.code in (401, 403):
                return False, True
        except Exception:
            pass
        return False, False

    def _fetch_remote_github_repos(self, token: str, api_url: str, acc_id: str, endpoint: str, seen_keys: set, projects: list) -> bool:
        auth_headers = (
            [token]
            if token.startswith(("Bearer ", "token "))
            else [f"Bearer {token}", f"token {token}"]
        )
        auth_warning = False
        for auth_val in auth_headers:
            succeeded, is_auth_error = self._try_fetch_github_repos(api_url, auth_val, acc_id, endpoint, seen_keys, projects)
            if is_auth_error:
                auth_warning = True
            if succeeded:
                return False
        return auth_warning

    def _fetch_fallback_public_github_repos(self, handles: list, acc_id: str, endpoint: str, seen_keys: set, projects: list):
        headers = {
            "User-Agent": "VyloServe-Desktop",
            "Accept": GITHUB_API_ACCEPT_HEADER,
        }
        for handle in handles:
            pub_url = f"https://{DEFAULT_GITHUB_HOST}/users/{urllib.parse.quote(handle)}/repos?type=all&sort=updated&per_page=100"
            try:
                req = urllib.request.Request(pub_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        raw = json.loads(resp.read().decode("utf-8"))
                        self._append_github_repo_list(raw, acc_id, endpoint, seen_keys, projects)
                        break
            except Exception:
                pass

    def _fetch_remote_gitlab_repos(self, endpoint: str, token: str, acc_id: str, seen_keys: set, projects: list):
        api_url = f"https://{endpoint}/api/v4/projects?membership=true&order_by=last_activity_at&per_page=50"
        headers = {"User-Agent": "VyloServe-Desktop", "PRIVATE-TOKEN": token}
        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8"))
                    if isinstance(raw, list):
                        for p in raw:
                            full_name = p.get("path_with_namespace") or p.get("name", "")
                            projects.append({
                                "id": str(p.get("id", "")),
                                "name": p.get("name", ""),
                                "full_name": full_name,
                                "visibility": p.get("visibility", "private"),
                                "web_url": p.get("web_url") or f"https://{endpoint}/{full_name}",
                                "ssh_url": p.get("ssh_url_to_repo", ""),
                                "http_url": p.get("http_url_to_repo", ""),
                                "default_branch": p.get("default_branch", "main"),
                                "last_activity_at": p.get("last_activity_at", ""),
                                "account_id": acc_id,
                                "host": endpoint,
                                "source": "remote",
                            })
                            seen_keys.add(full_name.lower())
        except Exception:
            pass

    @staticmethod
    def _inspect_local_git_repo(entry: str, www_dir: str, endpoint: str, acc_id: str, seen_keys: set) -> Optional[dict]:
        item_path = os.path.join(www_dir, entry)
        cfg_file = os.path.join(item_path, ".git", "config")
        if not os.path.isfile(cfg_file):
            return None
        try:
            with open(cfg_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            url_match = re.search(r"url\s*=\s*([^\r\n]+)", content)
            if not url_match:
                return None
            remote_url = url_match.group(1).strip()
            if endpoint.lower() not in remote_url.lower():
                return None
            cleaned_url = re.sub(r"\.git$", "", remote_url)
            path_part = cleaned_url.split(endpoint)[-1].lstrip("/:")
            if path_part and path_part.lower() not in seen_keys:
                return {
                    "id": f"local_{entry}",
                    "name": entry,
                    "full_name": path_part,
                    "visibility": "private",
                    "web_url": f"https://{endpoint}/{path_part}",
                    "ssh_url": remote_url if remote_url.startswith("git@") else "",
                    "http_url": remote_url if remote_url.startswith("http") else "",
                    "default_branch": "main",
                    "last_activity_at": "",
                    "account_id": acc_id,
                    "host": endpoint,
                    "source": "local",
                }
        except Exception:
            pass
        return None

    def _scan_local_www_repos(self, endpoint: str, acc_id: str, seen_keys: set, projects: list):
        www_dir = os.path.join(self.root_dir, "www")
        if not os.path.isdir(www_dir):
            return
        try:
            for entry in os.listdir(www_dir):
                item = self._inspect_local_git_repo(entry, www_dir, endpoint, acc_id, seen_keys)
                if item:
                    projects.append(item)
                    seen_keys.add(item["full_name"].lower())
        except Exception:
            pass

