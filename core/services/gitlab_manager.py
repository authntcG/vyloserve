import os
import sys
import shutil
import subprocess
import urllib.request
import json
import re
import time
from typing import Optional, Dict, Any, List, Tuple

from core.utils.system_utils import (
    get_project_root,
    run_silent_command,
    get_silent_flags,
    is_in_user_path,
    modify_user_path,
)
from core.utils.file_utils import (
    download_advanced,
    extract_archive,
    safe_rmtree,
    read_json,
    write_json,
)
from core.utils.cancellation import InstallationManager, OperationCancelledError
from core.utils.network_utils import is_network_error, check_host_reachability

GLAB_EXE = "glab.exe" if sys.platform == "win32" else "glab"
DEFAULT_GITLAB_HOST = "gitlab.com"
GLAB_CONFIG_FILENAME = "config.yml"
DEFAULT_FALLBACK_VERSION = "1.130.0"
GITLAB_RELEASES_API = f"https://{DEFAULT_GITLAB_HOST}/api/v4/projects/gitlab-org%2Fcli/releases"

MSG_GLAB_FETCH_FAILED = "backend.gitlab.fetch_failed"
MSG_GLAB_FETCHING = "backend.gitlab.fetching_version"
MSG_GLAB_DOWNLOADING = "backend.gitlab.downloading"
MSG_GLAB_EXTRACTING = "backend.gitlab.extracting"
MSG_GLAB_INSTALL_SUCCESS = "backend.gitlab.install_success"
MSG_GLAB_INSTALL_CANCELLED = "backend.gitlab.install_cancelled"
MSG_GLAB_INSTALL_FAILED = "backend.gitlab.install_failed"
MSG_GLAB_UNINSTALL_SUCCESS = "backend.gitlab.uninstall_success"
MSG_GLAB_UNINSTALL_FAILED = "backend.gitlab.uninstall_failed"
MSG_GLAB_NOT_INSTALLED = "backend.gitlab.not_installed"
MSG_GLAB_AUTH_SUCCESS = "backend.gitlab.auth_success"
MSG_GLAB_AUTH_FAILED = "backend.gitlab.auth_failed"
MSG_GLAB_LOGOUT_SUCCESS = "backend.gitlab.logout_success"
MSG_GLAB_COMMENT_SUCCESS = "backend.gitlab.comment_success"
MSG_GLAB_COMMENT_FAILED = "backend.gitlab.comment_failed"
MSG_GLAB_MR_COMMENT_SUCCESS = "backend.gitlab.mr_comment_success"
MSG_GLAB_ACTION_FAILED = "backend.gitlab.action_failed"
MSG_GLAB_REPO_NOT_FOUND = "backend.gitlab.repo_not_found"


class GitLabManager:
    """
    Manajer terpusat untuk siklus hidup GitLab CLI (glab),
    autentikasi kredensial, dan interaksi issue/MR untuk AI Assistant.
    """

    def __init__(self, api_ref=None):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.bin_dir = os.path.join(self.root_dir, "bin", "glab")
        self.data_dir = os.path.join(self.root_dir, "data")
        self.config_path = os.path.join(self.data_dir, "gitlab.json")
        os.makedirs(self.data_dir, exist_ok=True)

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, "api") and self.api:
            self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str, args: dict = None):
        if hasattr(self, "api") and self.api:
            self.api.emit_progress(pct, msg, args)

    # ----------------------------------------------------------------------
    # Deteksi Biner (Portable vs Eksternal System PATH)
    # ----------------------------------------------------------------------

    def _get_portable_binary_path(self) -> Optional[str]:
        target = os.path.join(self.bin_dir, GLAB_EXE)
        if os.path.isfile(target):
            if sys.platform != "win32" and not os.access(target, os.X_OK):
                try:
                    os.chmod(target, 0o700)
                except Exception:
                    pass
            return os.path.realpath(target)
        return None

    def _find_via_where(self) -> Optional[str]:
        if sys.platform != "win32":
            return None
        clean_vylo = os.path.realpath(self.root_dir).lower()
        try:
            res = subprocess.run(
                ["where", "glab"],
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
            )
            if res.returncode == 0:
                for line in res.stdout.strip().split("\n"):
                    p_clean = line.strip()
                    if not p_clean:
                        continue
                    real_p = os.path.realpath(p_clean).lower()
                    if not real_p.startswith(clean_vylo):
                        return p_clean
        except Exception:
            pass
        return None

    def _find_via_which(self) -> Optional[str]:
        if sys.platform == "win32":
            return None
        clean_vylo = os.path.realpath(self.root_dir).lower()
        env = os.environ.copy()
        clean_paths = [
            p
            for p in env.get("PATH", "").split(os.pathsep)
            if not p.lower().startswith(clean_vylo)
        ]
        for std_dir in ["/usr/bin", "/usr/local/bin", "/bin", os.path.expanduser("~/.local/bin")]:
            if std_dir not in clean_paths and os.path.isdir(std_dir):
                clean_paths.append(std_dir)

        found = shutil.which("glab", path=os.pathsep.join(clean_paths))
        if found:
            real_target = os.path.realpath(found).lower()
            if not real_target.startswith(clean_vylo):
                return found
        return None

    def get_glab_bin(self) -> Optional[str]:
        portable = self._get_portable_binary_path()
        if portable:
            return portable
        external = self._find_via_where() if sys.platform == "win32" else self._find_via_which()
        if external and os.path.isfile(external):
            return external
        return None

    def get_glab_version(self, bin_path: Optional[str] = None) -> Optional[str]:
        target = bin_path or self.get_glab_bin()
        if not target or not os.path.isfile(target):
            return None
        try:
            res = subprocess.run(
                [target, "--version"],
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=5,
            )
            output = res.stdout if res.returncode == 0 else (res.stdout + res.stderr)
            match = re.search(
                r"glab\s+(?:version\s+)?v?(\d+\.\d+\.\d+)",
                output,
                re.IGNORECASE,
            )
            if match:
                return match.group(1)
        except Exception:
            pass
        return None

    def get_glab_status(self) -> Dict[str, Any]:
        bin_path = self.get_glab_bin()
        if not bin_path:
            return {
                "installed": False,
                "version": None,
                "path": None,
                "in_path": False,
                "is_external": False,
                "authenticated": False,
                "host": None,
                "username": None,
            }

        version = self.get_glab_version(bin_path)
        safe_bin_dir = os.path.realpath(self.bin_dir).lower()
        is_external = not os.path.realpath(bin_path).lower().startswith(safe_bin_dir)
        in_path = is_in_user_path(self.bin_dir)

        config = self._read_config()
        default_host = config.get("default_host", DEFAULT_GITLAB_HOST)
        instances = config.get("instances", {})
        inst = instances.get(default_host, {}) if isinstance(instances, dict) else {}

        authenticated = bool(inst.get("token"))
        username = inst.get("username")
        host = default_host if authenticated else None

        return {
            "installed": True,
            "version": version,
            "path": bin_path,
            "in_path": in_path,
            "is_external": is_external,
            "authenticated": authenticated,
            "host": host,
            "username": username,
        }

    def toggle_user_path(self, enable: bool) -> Dict[str, Any]:
        """ Mengatur PATH khusus untuk biner GitLab CLI (glab) """
        try:
            modify_user_path(
                add_paths=[self.bin_dir] if enable else None,
                remove_paths=[self.bin_dir] if not enable else None,
                auto_broadcast=True
            )
            self._log("backend.gitlab.path_updated", "success")
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": "backend.gitlab.registry_error", "args": {"e": str(e)}}

    # ----------------------------------------------------------------------
    # Unduh & Ekstraksi Biner (Downloader / Lifecycle)
    # ----------------------------------------------------------------------

    @staticmethod
    def _find_platform_glab_asset(links: list) -> Tuple[Optional[str], Optional[str]]:
        for link in links:
            lname = link.get("name", "").lower()
            if sys.platform == "win32":
                if ("windows_amd64.zip" in lname or "windows_x86_64.zip" in lname) and "installer" not in lname:
                    return link.get("direct_asset_url") or link.get("url"), link.get("name")
            else:
                if "linux_amd64.tar.gz" in lname or "linux_x86_64.tar.gz" in lname:
                    return link.get("direct_asset_url") or link.get("url"), link.get("name")
        return None, None

    @staticmethod
    def _get_glab_fallback_asset(ver: str) -> Tuple[str, str]:
        if sys.platform == "win32":
            fname = f"glab_{ver}_windows_amd64.zip"
        else:
            fname = f"glab_{ver}_linux_amd64.tar.gz"
        url = f"https://{DEFAULT_GITLAB_HOST}/gitlab-org/cli/-/releases/v{ver}/downloads/{fname}"
        return url, fname

    @staticmethod
    def _select_gitlab_release_entry(releases: list, requested_version: Optional[str]) -> Tuple[dict, Optional[str]]:
        selected = releases[0]
        target_version = requested_version
        if requested_version:
            for rel in releases:
                tag = rel.get("tag_name", "").lstrip("v")
                if tag == requested_version.lstrip("v"):
                    selected = rel
                    break
        ver_tag = selected.get("tag_name", "").lstrip("v")
        if ver_tag:
            target_version = ver_tag
        return selected, target_version

    def _resolve_download_url(
        self, requested_version: Optional[str] = None
    ) -> Tuple[Optional[str], str]:
        """
        Menentukan URL unduhan resmi biner glab untuk sistem operasi aktif.
        """
        headers = {"User-Agent": "Mozilla/5.0"}
        target_version = requested_version

        # 1. Coba hubungi API rilis GitLab
        try:
            req = urllib.request.Request(
                f"{GITLAB_RELEASES_API}?per_page=5", headers=headers
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                releases = json.loads(resp.read().decode("utf-8"))
                if isinstance(releases, list) and releases:
                    selected_release, target_version = self._select_gitlab_release_entry(releases, requested_version)
                    links = selected_release.get("assets", {}).get("links", [])
                    found_url, _ = self._find_platform_glab_asset(links)
                    if found_url:
                        return found_url, target_version or DEFAULT_FALLBACK_VERSION
        except Exception:
            pass

        # 2. Fallback deterministik jika API rilis tidak dapat dijangkau
        version = target_version or DEFAULT_FALLBACK_VERSION
        fallback_url, _ = self._get_glab_fallback_asset(version)
        return fallback_url, version

    def get_available_gitlab_versions(self) -> Dict[str, Any]:
        """
        Mengambil daftar versi rilis resmi glab dari GitLab Releases API.
        Memvalidasi keberadaan aset arsip biner untuk platform aktif (Windows/Linux).
        """
        headers = {"User-Agent": "Mozilla/5.0"}
        fb_url, fb_name = self._get_glab_fallback_asset(DEFAULT_FALLBACK_VERSION)
        fallback_data = [{
            "value": DEFAULT_FALLBACK_VERSION,
            "label": f"GitLab CLI v{DEFAULT_FALLBACK_VERSION} (Fallback)",
            "filename": fb_name,
            "version_text": DEFAULT_FALLBACK_VERSION,
            "download_url": fb_url
        }]

        try:
            req = urllib.request.Request(
                f"{GITLAB_RELEASES_API}?per_page=15", headers=headers
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                releases = json.loads(resp.read().decode("utf-8"))

            if not isinstance(releases, list) or not releases:
                return {"status": "success", "data": fallback_data}

            results = []
            for rel in releases:
                ver_tag = rel.get("tag_name", "").lstrip("v")
                if not ver_tag:
                    continue

                links = rel.get("assets", {}).get("links", [])
                target_url, target_name = self._find_platform_glab_asset(links)

                if not target_url:
                    target_url, target_name = self._get_glab_fallback_asset(ver_tag)

                label = f"GitLab CLI v{ver_tag}"
                if len(results) == 0:
                    label += " (Latest Release)"

                results.append({
                    "value": ver_tag,
                    "label": label,
                    "filename": target_name,
                    "version_text": ver_tag,
                    "download_url": target_url
                })

            if not results:
                return {"status": "success", "data": fallback_data}

            return {"status": "success", "data": results}

        except Exception as e:
            res: Dict[str, Any] = {
                "status": "error",
                "message": MSG_GLAB_FETCH_FAILED,
                "args": {"e": str(e)},
                "data": fallback_data
            }
            if is_network_error(e):
                res["is_offline"] = True
            return res

    @staticmethod
    def _find_extracted_binary(temp_extract: str) -> Optional[str]:
        for root, _, files in os.walk(temp_extract):
            for f in files:
                if f.lower() == GLAB_EXE.lower():
                    return os.path.join(root, f)
        return None

    @staticmethod
    def _cleanup_install_artifacts(archive_path: Optional[str], temp_extract: str):
        if archive_path and os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except Exception:
                pass
        safe_rmtree(temp_extract)

    def _deploy_glab_binary(self, temp_extract: str) -> str:
        found_binary = self._find_extracted_binary(temp_extract)
        if not found_binary or not os.path.isfile(found_binary):
            raise RuntimeError("GitLab CLI binary not found in extracted archive.")

        final_bin_path = os.path.join(self.bin_dir, GLAB_EXE)
        if os.path.isfile(final_bin_path):
            try:
                os.remove(final_bin_path)
            except Exception:
                pass

        shutil.copy2(found_binary, final_bin_path)
        if sys.platform != "win32":
            try:
                os.chmod(final_bin_path, 0o700)
            except Exception:
                pass
        return final_bin_path

    def install_glab(self, version: Optional[str] = None) -> Dict[str, Any]:
        token = InstallationManager.create_token("gitlab")
        archive_path = None
        temp_extract = os.path.join(self.bin_dir, "_extract_tmp")

        try:
            self._log(MSG_GLAB_FETCHING, "info")
            self._progress(10, MSG_GLAB_FETCHING)

            if token.is_cancelled():
                raise OperationCancelledError("Installation cancelled before start.")

            download_url, actual_version = self._resolve_download_url(version)
            if not download_url:
                return {
                    "status": "error",
                    "message": MSG_GLAB_INSTALL_FAILED,
                    "args": {"e": "Failed to resolve download URL"},
                }

            if token.is_cancelled():
                raise OperationCancelledError("Installation cancelled during resolve.")

            filename = download_url.split("/")[-1].split("?")[0]
            os.makedirs(self.bin_dir, exist_ok=True)
            archive_path = os.path.join(self.bin_dir, filename)

            self._log(MSG_GLAB_DOWNLOADING, "info", {"version": actual_version})
            self._progress(20, MSG_GLAB_DOWNLOADING, {"version": actual_version})

            def download_progress(pct: int, _txt: str = "", args: Optional[dict] = None, **kwargs):
                scaled = 20 + int((pct / 100.0) * 55)
                self._progress(scaled, MSG_GLAB_DOWNLOADING, {"version": actual_version})

            download_advanced(
                download_url,
                archive_path,
                progress_cb=download_progress,
                cancel_check=token.is_cancelled,
            )

            if token.is_cancelled():
                raise OperationCancelledError("Installation cancelled during download.")

            self._log(MSG_GLAB_EXTRACTING, "info")
            self._progress(80, MSG_GLAB_EXTRACTING)

            os.makedirs(temp_extract, exist_ok=True)
            extract_archive(
                archive_path,
                temp_extract,
                cancel_check=token.is_cancelled,
            )

            if token.is_cancelled():
                raise OperationCancelledError("Installation cancelled during extraction.")

            final_bin_path = self._deploy_glab_binary(temp_extract)
            self._cleanup_install_artifacts(archive_path, temp_extract)

            # Verifikasi akhir instalasi
            self._progress(95, MSG_GLAB_EXTRACTING)
            detected_ver = self.get_glab_version(final_bin_path) or actual_version

            self._log(MSG_GLAB_INSTALL_SUCCESS, "info", {"version": detected_ver})
            self._progress(100, MSG_GLAB_INSTALL_SUCCESS, {"version": detected_ver})
            InstallationManager.reset("gitlab")

            return {
                "status": "success",
                "message": MSG_GLAB_INSTALL_SUCCESS,
                "args": {"version": detected_ver},
            }

        except OperationCancelledError:
            self._cleanup_install_artifacts(archive_path, temp_extract)
            self._progress(0, MSG_GLAB_INSTALL_CANCELLED)
            self._log(MSG_GLAB_INSTALL_CANCELLED, "warn")
            InstallationManager.reset("gitlab")
            return {"status": "cancelled", "message": MSG_GLAB_INSTALL_CANCELLED}

        except Exception as e:
            self._cleanup_install_artifacts(archive_path, temp_extract)
            self._progress(0, MSG_GLAB_INSTALL_FAILED, {"e": str(e)})
            self._log(MSG_GLAB_INSTALL_FAILED, "error", {"e": str(e)})
            InstallationManager.reset("gitlab")
            return {
                "status": "error",
                "message": MSG_GLAB_INSTALL_FAILED,
                "args": {"e": str(e)},
            }

    def cancel_glab_install(self) -> Dict[str, Any]:
        cancelled = InstallationManager.cancel("gitlab")
        return {
            "status": "success" if cancelled else "ignored",
            "message": MSG_GLAB_INSTALL_CANCELLED,
        }

    def uninstall_glab(self) -> Dict[str, Any]:
        target = os.path.join(self.bin_dir, GLAB_EXE)
        if not os.path.exists(target):
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED}

        try:
            safe_rmtree(self.bin_dir)
            self._log(MSG_GLAB_UNINSTALL_SUCCESS, "info")
            return {"status": "success", "message": MSG_GLAB_UNINSTALL_SUCCESS}
        except Exception as e:
            self._log(MSG_GLAB_UNINSTALL_FAILED, "error", {"e": str(e)})
            return {
                "status": "error",
                "message": MSG_GLAB_UNINSTALL_FAILED,
                "args": {"e": str(e)},
            }

    # ----------------------------------------------------------------------
    # Kredensial & Autentikasi Aman (Multi-Host)
    # ----------------------------------------------------------------------

    @staticmethod
    def _mask_token(token: str) -> str:
        if not token:
            return ""
        return "••••••••"

    def _find_glab_config_file(self) -> Optional[str]:
        search_paths = []
        if sys.platform == "win32":
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            if local_appdata:
                search_paths.append(os.path.join(local_appdata, "glab-cli", GLAB_CONFIG_FILENAME))
            appdata = os.environ.get("APPDATA", "")
            if appdata:
                search_paths.append(os.path.join(appdata, "glab-cli", GLAB_CONFIG_FILENAME))
        search_paths.append(os.path.expanduser(f"~/.config/glab-cli/{GLAB_CONFIG_FILENAME}"))
        search_paths.append(os.path.join(self.bin_dir, GLAB_CONFIG_FILENAME))

        for p in search_paths:
            if p and os.path.isfile(p):
                return p
        return None

    @staticmethod
    def _parse_single_glab_yml_line(line: str, parsed: Dict[str, Any], current_host: Optional[str]) -> Optional[str]:
        if line.startswith("host:"):
            parsed["host"] = line.split("host:", 1)[1].strip()
        elif line.startswith("git_protocol:"):
            parsed["git_protocol"] = line.split("git_protocol:", 1)[1].strip()
        elif line.startswith("    ") and not line.startswith("        ") and ":" in line:
            host_part, _, _ = line.strip().partition(":")
            if host_part:
                c_host = host_part.strip()
                parsed["hosts"][c_host] = {}
                return c_host
        elif current_host and line.startswith("        ") and ":" in line:
            key_part, _, val_part = line.strip().partition(":")
            if key_part:
                k = key_part.strip()
                v = val_part.strip().strip('"').strip("'")
                parsed["hosts"][current_host][k] = v
        return current_host

    @classmethod
    def _parse_glab_yml_lines(cls, content: str) -> Dict[str, Any]:
        parsed: Dict[str, Any] = {"hosts": {}}
        current_host = None
        for raw_line in content.splitlines():
            line = raw_line.rstrip()
            if not line or line.startswith("#") or line.startswith("hosts:"):
                continue
            current_host = cls._parse_single_glab_yml_line(line, parsed, current_host)
        return parsed

    def _parse_glab_config_yml(self) -> Dict[str, Any]:
        """
        Membaca konfigurasi resmi glab CLI dari config.yml (%LOCALAPPDATA%/glab-cli/config.yml dll).
        """
        found_path = self._find_glab_config_file()
        if not found_path:
            return {}

        try:
            try:
                import yaml
                with open(found_path, "r", encoding="utf-8", errors="ignore") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict):
                        return data
            except ImportError:
                pass

            # Fallback simple parser jika PyYAML tidak terpasang
            with open(found_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            return self._parse_glab_yml_lines(content)
        except Exception:
            return {}

    @staticmethod
    def _read_global_gitconfig_identity() -> Tuple[str, str]:
        gitconfig_name = ""
        gitconfig_email = ""
        gitconfig_path = os.path.expanduser("~/.gitconfig")
        if os.path.isfile(gitconfig_path):
            try:
                with open(gitconfig_path, "r", encoding="utf-8", errors="ignore") as gf:
                    g_content = gf.read()
                nm = re.search(r"name\s*=\s*(.+)", g_content)
                em = re.search(r"email\s*=\s*(.+)", g_content)
                if nm:
                    gitconfig_name = nm.group(1).strip()
                if em:
                    gitconfig_email = em.group(1).strip()
            except Exception:
                pass
        return gitconfig_name, gitconfig_email

    @staticmethod
    def _build_migrated_glab_account(
        clean_h: str, u: str, h_info: dict, glab_yml: dict, gitconfig_name: str, gitconfig_email: str, is_default: bool
    ) -> dict:
        acc_id = f"{clean_h}_{u}"
        is_internal = (DEFAULT_GITLAB_HOST not in clean_h.lower())
        use_keyring = str(h_info.get("use_keyring", "")).lower() in ("true", "1")
        token_val = h_info.get("token") or ""
        now = int(time.time())
        return {
            "id": acc_id,
            "host": clean_h,
            "username": u,
            "git_name": gitconfig_name or u,
            "git_email": gitconfig_email,
            "auth_type": "pat",
            "git_protocol": h_info.get("git_protocol") or glab_yml.get("git_protocol") or "https",
            "token": token_val,
            "use_keyring": use_keyring,
            "ssh_key_path": "",
            "requires_vpn": is_internal,
            "is_default": is_default,
            "created_at": now,
            "updated_at": now,
        }

    def _migrate_legacy_glab_config(self, cfg: Dict[str, Any]) -> Dict[str, Any]:
        """
        Melakukan penemuan akun warisan otomatis dari glab-cli/config.yml.
        """
        glab_yml = self._parse_glab_config_yml()
        hosts_map = glab_yml.get("hosts", {}) if isinstance(glab_yml, dict) else {}
        gitconfig_name, gitconfig_email = self._read_global_gitconfig_identity()

        accounts = cfg.get("accounts", [])
        existing_ids = {a.get("id") for a in accounts if isinstance(a, dict)}
        has_new = False
        default_glab_host = glab_yml.get("host") if isinstance(glab_yml, dict) else ""

        for h, h_info in hosts_map.items():
            if not isinstance(h_info, dict):
                continue
            u = h_info.get("user")
            if not u:
                continue
            clean_h = self._clean_hostname(h)
            acc_id = f"{clean_h}_{u}"
            if acc_id not in existing_ids:
                is_def = (clean_h == default_glab_host or len(accounts) == 0)
                new_acc = self._build_migrated_glab_account(
                    clean_h, u, h_info, glab_yml, gitconfig_name, gitconfig_email, is_def
                )
                accounts.append(new_acc)
                existing_ids.add(acc_id)
                has_new = True
                if new_acc["is_default"] or not cfg.get("default_account_id"):
                    cfg["default_account_id"] = acc_id
                    cfg["default_host"] = clean_h

        cfg["accounts"] = accounts
        cfg["legacy_glab_migrated"] = True
        if has_new:
            self._write_config(cfg)
        return cfg

    @staticmethod
    def _migrate_single_instances_to_accounts(cfg: dict):
        if cfg["accounts"] or not cfg.get("instances"):
            return
        migrated = []
        for h, inst in cfg["instances"].items():
            if isinstance(inst, dict):
                u = inst.get("username", "user")
                acc_id = f"{h}_{u}"
                migrated.append({
                    "id": acc_id,
                    "host": h,
                    "username": u,
                    "git_name": u,
                    "git_email": "",
                    "auth_type": inst.get("auth_type", "pat"),
                    "git_protocol": "https",
                    "token": inst.get("token", ""),
                    "ssh_key_path": "",
                    "requires_vpn": bool(DEFAULT_GITLAB_HOST not in h.lower()),
                    "is_default": (h == cfg.get("default_host", DEFAULT_GITLAB_HOST)),
                    "created_at": inst.get("updated_at", int(time.time())),
                    "updated_at": inst.get("updated_at", int(time.time())),
                })
        cfg["accounts"] = migrated
        if migrated and not cfg.get("default_account_id"):
            cfg["default_account_id"] = migrated[0]["id"]

    def _read_config(self) -> Dict[str, Any]:
        cfg = read_json(self.config_path, default_type=dict)
        if not isinstance(cfg, dict):
            cfg = {}
        if "default_host" not in cfg:
            cfg["default_host"] = DEFAULT_GITLAB_HOST
        if "instances" not in cfg or not isinstance(cfg["instances"], dict):
            cfg["instances"] = {}
        if "accounts" not in cfg or not isinstance(cfg["accounts"], list):
            cfg["accounts"] = []
        if "default_account_id" not in cfg:
            cfg["default_account_id"] = ""

        self._migrate_single_instances_to_accounts(cfg)

        if not cfg.get("legacy_glab_migrated"):
            cfg = self._migrate_legacy_glab_config(cfg)

        return cfg

    def _write_config(self, data: Dict[str, Any]) -> bool:
        ok = write_json(self.config_path, data)
        if ok and sys.platform != "win32":
            try:
                os.chmod(self.config_path, 0o600)
            except Exception:
                pass
        return ok

    def _clean_hostname(self, host: str) -> str:
        h = (host or DEFAULT_GITLAB_HOST).strip()
        h = re.sub(r"^https?://", "", h, flags=re.IGNORECASE)
        h = h.split("/")[0].strip()
        return h or DEFAULT_GITLAB_HOST

    def _get_auth_env(self, host: str) -> Dict[str, str]:
        env = os.environ.copy()
        clean_host = self._clean_hostname(host)
        config = self._read_config()
        instances = config.get("instances", {})
        inst = instances.get(clean_host, {})
        token = inst.get("token")
        if not token and config.get("accounts"):
            for acc in config.get("accounts", []):
                if acc.get("host") == clean_host and acc.get("token"):
                    token = acc.get("token")
                    break
        if token:
            env["GITLAB_TOKEN"] = token
            env["GITLAB_HOST"] = clean_host
        return env

    @staticmethod
    def _try_gitlab_user_request(url: str, hdr: dict) -> Tuple[Optional[dict], str]:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    **hdr,
                    "User-Agent": "VyloServe-GitLab/1.0",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    raw = resp.read().decode("utf-8", errors="ignore")
                    data = json.loads(raw)
                    if isinstance(data, dict) and (data.get("username") or data.get("id")):
                        return data, ""
        except urllib.error.HTTPError as he:
            try:
                err_body = he.read().decode("utf-8", errors="ignore")
                err_json = json.loads(err_body)
                desc = err_json.get("error_description") or err_json.get("message") or he.reason
            except Exception:
                desc = he.reason
            return None, f"HTTP {he.code}: {desc}"
        except Exception as e:
            return None, str(e)
        return None, ""

    def _verify_gitlab_token_via_api(
        self, host: str, token: str, auth_type: str = "pat"
    ) -> Tuple[Optional[dict], Optional[str]]:
        """
        Memvalidasi token langsung ke GitLab REST API /api/v4/user.
        Mencoba header PRIVATE-TOKEN (untuk PAT/credentials) dan Bearer (untuk OAuth).
        Mengembalikan tuple (user_dict, error_message).
        """
        clean_host = self._clean_hostname(host)
        url = f"https://{clean_host}/api/v4/user"

        headers_to_try = []
        if auth_type == "oauth":
            headers_to_try.append({"Authorization": f"Bearer {token}"})
            headers_to_try.append({"PRIVATE-TOKEN": token})
        else:
            headers_to_try.append({"PRIVATE-TOKEN": token})
            headers_to_try.append({"Authorization": f"Bearer {token}"})

        last_error = ""
        for hdr in headers_to_try:
            user_data, err = self._try_gitlab_user_request(url, hdr)
            if user_data:
                return user_data, None
            if err:
                last_error = err

        return None, last_error or "Invalid token or host unreachable"

    def _auth_via_ssh(
        self, clean_host: str, ssh_key_path: str, detected_user: Optional[str], git_name: str
    ) -> Tuple[Optional[str], Optional[dict]]:
        if ssh_key_path and not os.path.exists(ssh_key_path):
            return None, {
                "status": "error",
                "message": "backend.gitlab.ssh_key_not_found",
                "args": {"path": ssh_key_path},
            }

        ssh_cmd = ["ssh", "-T", "-o", "StrictHostKeyChecking=no"]
        if ssh_key_path:
            ssh_cmd.extend(["-i", ssh_key_path])
        ssh_cmd.append(f"git@{clean_host}")

        try:
            res = subprocess.run(
                ssh_cmd,
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=8,
            )
            output = f"{res.stdout}\n{res.stderr}"
            user_match = re.search(r"Welcome to GitLab, @([^\s!]+)!", output)
            if user_match:
                return user_match.group(1), None
        except Exception:
            pass
        return detected_user or git_name or "user", None

    @staticmethod
    def _fetch_glab_cli_user_profile(
        bin_path: str, clean_host: str, user_name_profile: str, user_email_profile: str
    ) -> Tuple[Optional[str], str, str]:
        detected_user = None
        name_profile = user_name_profile
        email_profile = user_email_profile
        try:
            user_res = subprocess.run(
                [bin_path, "api", "user", "--hostname", clean_host],
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=10,
            )
            if user_res.returncode == 0:
                user_data = json.loads(user_res.stdout)
                if isinstance(user_data, dict):
                    detected_user = user_data.get("username")
                    if not name_profile:
                        name_profile = user_data.get("name") or detected_user or ""
                    if not email_profile:
                        email_profile = (
                            user_data.get("commit_email")
                            or user_data.get("public_email")
                            or user_data.get("email")
                            or ""
                        )
        except Exception:
            pass
        return detected_user, name_profile, email_profile

    def _auth_via_browser_oauth(
        self, bin_path: str, clean_host: str, protocol: str, user_name_profile: str, user_email_profile: str
    ) -> Tuple[Optional[str], str, str, Optional[dict]]:
        try:
            res = subprocess.run(
                [bin_path, "auth", "login", "--hostname", clean_host, "--web", "--git-protocol", protocol],
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=120,
            )
            if res.returncode != 0:
                err_out = f"{res.stdout}\n{res.stderr}".strip()
                return None, user_name_profile, user_email_profile, {
                    "status": "error",
                    "message": MSG_GLAB_AUTH_FAILED,
                    "args": {"host": clean_host, "e": err_out or "OAuth browser login cancelled"},
                }
        except subprocess.TimeoutExpired:
            return None, user_name_profile, user_email_profile, {
                "status": "error",
                "message": MSG_GLAB_AUTH_FAILED,
                "args": {"host": clean_host, "e": "OAuth browser login timed out after 120s"},
            }
        except Exception as e:
            return None, user_name_profile, user_email_profile, {
                "status": "error",
                "message": MSG_GLAB_AUTH_FAILED,
                "args": {"host": clean_host, "e": str(e)},
            }

        detected_user, user_name_profile, user_email_profile = self._fetch_glab_cli_user_profile(
            bin_path, clean_host, user_name_profile, user_email_profile
        )

        if not detected_user:
            return None, user_name_profile, user_email_profile, {
                "status": "error",
                "message": MSG_GLAB_AUTH_FAILED,
                "args": {"host": clean_host, "e": "Failed to retrieve user profile after OAuth login"},
            }

        return detected_user, user_name_profile, user_email_profile, None

    @staticmethod
    def _fallback_glab_api_user_check(bin_path: str, clean_host: str, token_str: str) -> Optional[dict]:
        env = os.environ.copy()
        env["GITLAB_TOKEN"] = token_str
        env["GITLAB_HOST"] = clean_host
        try:
            user_res = subprocess.run(
                [bin_path, "api", "user", "--hostname", clean_host],
                capture_output=True,
                text=True,
                env=env,
                creationflags=get_silent_flags(),
                timeout=10,
            )
            if user_res.returncode == 0:
                data = json.loads(user_res.stdout)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return None

    @staticmethod
    def _extract_gitlab_user_identity(
        user_data: dict, detected_user: Optional[str], user_name_profile: str, user_email_profile: str
    ) -> Tuple[str, str, str]:
        final_user = user_data.get("username") or detected_user or "user"
        final_name = user_name_profile or user_data.get("name") or final_user
        final_email = (
            user_email_profile
            or user_data.get("commit_email")
            or user_data.get("public_email")
            or user_data.get("email")
            or ""
        )
        return final_user, final_name, final_email

    def _auth_via_token(
        self,
        bin_path: str,
        clean_host: str,
        token_str: str,
        selected_auth: str,
        protocol: str,
        detected_user: Optional[str],
        user_name_profile: str,
        user_email_profile: str,
    ) -> Tuple[Optional[str], str, str, Optional[dict]]:
        if not token_str:
            return None, user_name_profile, user_email_profile, {
                "status": "error",
                "message": MSG_GLAB_AUTH_FAILED,
                "args": {"host": clean_host, "e": "Missing access token or password"},
            }

        user_data, api_err = self._verify_gitlab_token_via_api(clean_host, token_str, selected_auth)
        if not user_data:
            user_data = self._fallback_glab_api_user_check(bin_path, clean_host, token_str)

        if not user_data or not isinstance(user_data, dict):
            return None, user_name_profile, user_email_profile, {
                "status": "error",
                "message": MSG_GLAB_AUTH_FAILED,
                "args": {"host": clean_host, "e": api_err or "Invalid credentials or unauthorized"},
            }

        final_user, user_name_profile, user_email_profile = self._extract_gitlab_user_identity(
            user_data, detected_user, user_name_profile, user_email_profile
        )

        try:
            subprocess.run(
                [bin_path, "auth", "login", "--hostname", clean_host, "--stdin", "--git-protocol", protocol],
                input=f"{token_str}\n",
                text=True,
                capture_output=True,
                creationflags=get_silent_flags(),
                timeout=10,
            )
        except Exception:
            pass

        if protocol == "https" and final_user:
            try:
                from core.services.git_manager import GitManager
                GitManager(self.api)._store_git_credential("https", clean_host, final_user, token_str)
            except Exception:
                pass

        return final_user, user_name_profile, user_email_profile, None

    def _dispatch_gitlab_auth_strategy(
        self,
        bin_path: str,
        clean_host: str,
        token_str: str,
        selected_auth: str,
        protocol: str,
        detected_user: Optional[str],
        user_name_profile: str,
        user_email_profile: str,
        ssh_key_path: str,
        git_name: str,
        requires_vpn: bool,
        is_reachable: bool,
    ) -> Tuple[Optional[str], str, str, Optional[dict]]:
        if requires_vpn and not is_reachable:
            d_user = detected_user or git_name or "user"
            return d_user, user_name_profile or d_user, user_email_profile, None

        if selected_auth == "ssh" and not token_str:
            d_user, ssh_err = self._auth_via_ssh(clean_host, ssh_key_path, detected_user, git_name)
            if ssh_err:
                return None, user_name_profile, user_email_profile, ssh_err
            return d_user, user_name_profile, user_email_profile, None

        if selected_auth == "oauth" and not token_str:
            return self._auth_via_browser_oauth(bin_path, clean_host, protocol, user_name_profile, user_email_profile)

        return self._auth_via_token(
            bin_path, clean_host, token_str, selected_auth, protocol, detected_user, user_name_profile, user_email_profile
        )

    def _persist_authenticated_gitlab_account(
        self,
        clean_host: str,
        token_str: str,
        selected_auth: str,
        protocol: str,
        final_user: str,
        final_git_name: str,
        final_git_email: str,
        acc_id: str,
        ssh_key_path: str,
        requires_vpn: bool,
        sync_git_config: bool,
    ) -> dict:
        now = int(time.time())
        config = self._read_config()
        config["default_host"] = clean_host
        config["instances"][clean_host] = {
            "token": token_str,
            "username": final_user,
            "auth_type": selected_auth,
            "git_protocol": protocol,
            "updated_at": now,
        }

        accounts = config.get("accounts", [])
        existing_idx = next((i for i, a in enumerate(accounts) if a.get("id") == acc_id), None)
        saved_token = token_str or (accounts[existing_idx].get("token", "") if existing_idx is not None else "")
        use_keyring = accounts[existing_idx].get("use_keyring", False) if existing_idx is not None else False

        account_entry = {
            "id": acc_id,
            "host": clean_host,
            "username": final_user,
            "git_name": final_git_name,
            "git_email": final_git_email,
            "auth_type": selected_auth,
            "git_protocol": protocol,
            "token": saved_token,
            "use_keyring": use_keyring,
            "ssh_key_path": ssh_key_path,
            "requires_vpn": bool(requires_vpn),
            "is_default": False,
            "updated_at": now,
        }

        if existing_idx is not None:
            account_entry["created_at"] = accounts[existing_idx].get("created_at", now)
            accounts[existing_idx] = account_entry
        else:
            account_entry["created_at"] = now
            accounts.append(account_entry)

        if sync_git_config or len(accounts) == 1:
            config["default_account_id"] = acc_id
            for a in accounts:
                a["is_default"] = (a.get("id") == acc_id)

        config["accounts"] = accounts
        self._write_config(config)

        if sync_git_config and (final_git_name or final_git_email):
            try:
                from core.services.git_manager import GitManager
                GitManager(self.api).set_git_config(final_git_name, final_git_email)
            except Exception:
                pass

        self._log(MSG_GLAB_AUTH_SUCCESS, "info", {"user": final_user, "host": clean_host})
        return {
            "status": "success",
            "message": MSG_GLAB_AUTH_SUCCESS,
            "args": {"user": final_user, "host": clean_host},
            "account_id": acc_id,
        }

    def authenticate(
        self,
        host: str,
        token: str = "",
        auth_type: str = "pat",
        git_protocol: str = "https",
        git_name: str = "",
        git_email: str = "",
        ssh_key_path: str = "",
        sync_git_config: bool = False,
        username: str = "",
        requires_vpn: bool = False,
    ) -> Dict[str, Any]:
        """
        Memverifikasi kredensial token atau sesi SSH terhadap host GitLab menggunakan glab CLI
        dan REST API resmi tanpa mengekspos token pada argumen proses (anti-process snooping).
        """
        clean_host = self._clean_hostname(host)
        token_str = (token or "").strip()
        protocol = "ssh" if git_protocol == "ssh" else "https"
        selected_auth = auth_type if auth_type in ("pat", "credentials", "oauth", "ssh") else "pat"

        bin_path = self.get_glab_bin()
        if not bin_path:
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED}

        detected_user = username.strip() or None
        user_name_profile = git_name.strip()
        user_email_profile = git_email.strip()

        is_reachable = True
        if requires_vpn:
            try:
                is_reachable = check_host_reachability(clean_host, timeout=1.5).get("reachable", False)
            except Exception:
                is_reachable = False

        detected_user, user_name_profile, user_email_profile, err = self._dispatch_gitlab_auth_strategy(
            bin_path,
            clean_host,
            token_str,
            selected_auth,
            protocol,
            detected_user,
            user_name_profile,
            user_email_profile,
            ssh_key_path,
            git_name,
            requires_vpn,
            is_reachable,
        )
        if err:
            return err

        final_user = detected_user or git_name or "user"
        final_git_name = user_name_profile or final_user
        final_git_email = user_email_profile or ""
        acc_id = f"{clean_host}_{final_user}"

        return self._persist_authenticated_gitlab_account(
            clean_host,
            token_str,
            selected_auth,
            protocol,
            final_user,
            final_git_name,
            final_git_email,
            acc_id,
            ssh_key_path,
            requires_vpn,
            sync_git_config,
        )

    def get_gitlab_accounts(self) -> Dict[str, Any]:
        """
        Mengambil daftar seluruh akun GitLab yang tersimpan,
        dengan token disensor dan status kesesuaian identitas push Git.
        """
        config = self._read_config()
        default_id = config.get("default_account_id", "")
        default_host = config.get("default_host", DEFAULT_GITLAB_HOST)
        accounts = config.get("accounts", [])

        curr_name = ""
        curr_email = ""
        try:
            from core.services.git_manager import GitManager
            git_mgr = GitManager(self.api)
            conf = git_mgr.get_git_config()
            if conf.get("status") == "success":
                curr_name = conf.get("data", {}).get("name", "")
                curr_email = conf.get("data", {}).get("email", "")
        except Exception:
            pass

        safe_accounts = []
        for acc in accounts:
            if not isinstance(acc, dict):
                continue
            acc_id = acc.get("id", "")
            u_name = acc.get("username", "")
            g_name = acc.get("git_name", u_name)
            g_email = acc.get("git_email", "")
            tok = acc.get("token", "")
            is_def = (acc_id == default_id) or acc.get("is_default", False)
            is_push_active = bool(
                curr_name and curr_email and (curr_name in (u_name, g_name)) and (curr_email == g_email)
            )
            req_vpn = bool(acc.get("requires_vpn", False))
            vpn_reachable = True
            if req_vpn:
                try:
                    vpn_reachable = check_host_reachability(acc.get("host", DEFAULT_GITLAB_HOST), timeout=1.0).get("reachable", False)
                except Exception:
                    vpn_reachable = False

            safe_accounts.append({
                "id": acc_id,
                "host": acc.get("host", DEFAULT_GITLAB_HOST),
                "username": u_name,
                "git_name": g_name,
                "git_email": g_email,
                "auth_type": acc.get("auth_type", "pat"),
                "git_protocol": acc.get("git_protocol", "https"),
                "has_token": bool(tok) or bool(acc.get("use_keyring")),
                "use_keyring": bool(acc.get("use_keyring", False)),
                "masked_token": self._mask_token(tok),
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
            "default_host": default_host,
            "active_push": {"name": curr_name, "email": curr_email},
        }

    def set_default_gitlab_account(self, account_id: str, sync_git_config: bool = True) -> Dict[str, Any]:
        """
        Menjadikan akun GitLab tertentu sebagai akun default dan
        opsional menyinkronkan identitas push-nya ke global Git config.
        """
        config = self._read_config()
        accounts = config.get("accounts", [])
        target = next((a for a in accounts if a.get("id") == account_id), None)
        if not target:
            return {"status": "error", "message": "backend.gitlab.account_not_found"}

        host = target.get("host", DEFAULT_GITLAB_HOST)
        user = target.get("username", "user")

        config["default_account_id"] = account_id
        config["default_host"] = host
        for a in accounts:
            a["is_default"] = (a.get("id") == account_id)

        config["instances"][host] = {
            "token": target.get("token", ""),
            "username": user,
            "auth_type": target.get("auth_type", "pat"),
            "git_protocol": target.get("git_protocol", "https"),
            "updated_at": int(time.time()),
        }

        self._write_config(config)

        if sync_git_config:
            g_name = target.get("git_name") or user
            g_email = target.get("git_email", "")
            if g_name or g_email:
                try:
                    from core.services.git_manager import GitManager
                    GitManager(self.api).set_git_config(g_name, g_email)
                except Exception:
                    pass

        self._log("backend.gitlab.account_switched", "info", {"user": user, "host": host})
        return {
            "status": "success",
            "message": "backend.gitlab.account_switched",
            "args": {"user": user, "host": host},
        }

    def remove_gitlab_account(self, account_id: str) -> Dict[str, Any]:
        """
        Menghapus akun GitLab dari daftar accounts dan konfigurasi instances.
        """
        config = self._read_config()
        accounts = config.get("accounts", [])
        target = next((a for a in accounts if a.get("id") == account_id), None)
        if not target:
            return {"status": "error", "message": "backend.gitlab.account_not_found"}

        user = target.get("username", "user")
        host = target.get("host", DEFAULT_GITLAB_HOST)

        # Bersihkan kredensial dari Git Credential Helper jika tersimpan
        try:
            from core.services.git_manager import GitManager
            GitManager(self.api)._delete_git_credential("https", host, user)
        except Exception:
            pass

        accounts = [a for a in accounts if a.get("id") != account_id]
        if host in config.get("instances", {}):
            # Cek apakah masih ada akun lain pada host yang sama
            other_same_host = next((a for a in accounts if a.get("host") == host), None)
            if other_same_host:
                config["instances"][host] = {
                    "token": other_same_host.get("token", ""),
                    "username": other_same_host.get("username", "user"),
                    "auth_type": other_same_host.get("auth_type", "pat"),
                    "git_protocol": other_same_host.get("git_protocol", "https"),
                    "updated_at": int(time.time()),
                }
            else:
                del config["instances"][host]

        if config.get("default_account_id") == account_id:
            if accounts:
                config["default_account_id"] = accounts[0].get("id", "")
                config["default_host"] = accounts[0].get("host", DEFAULT_GITLAB_HOST)
                accounts[0]["is_default"] = True
            else:
                config["default_account_id"] = ""
                config["default_host"] = DEFAULT_GITLAB_HOST

        config["accounts"] = accounts
        self._write_config(config)

        self._log(MSG_GLAB_LOGOUT_SUCCESS, "info", {"host": host})
        return {
            "status": "success",
            "message": MSG_GLAB_LOGOUT_SUCCESS,
            "args": {"host": host},
        }

    def logout(self, host: Optional[str] = None) -> Dict[str, Any]:
        config = self._read_config()
        target_host = self._clean_hostname(host) if host else config.get("default_host", DEFAULT_GITLAB_HOST)

        if target_host in config.get("instances", {}):
            del config["instances"][target_host]

        # Bersihkan juga dari accounts list untuk host tersebut
        config["accounts"] = [a for a in config.get("accounts", []) if a.get("host") != target_host]

        remaining = list(config.get("instances", {}).keys())
        config["default_host"] = remaining[0] if remaining else DEFAULT_GITLAB_HOST
        if config["accounts"]:
            config["default_account_id"] = config["accounts"][0].get("id", "")
            config["accounts"][0]["is_default"] = True
        else:
            config["default_account_id"] = ""

        self._write_config(config)

        self._log(MSG_GLAB_LOGOUT_SUCCESS, "info", {"host": target_host})
        return {
            "status": "success",
            "message": MSG_GLAB_LOGOUT_SUCCESS,
            "args": {"host": target_host},
        }

    # ----------------------------------------------------------------------
    # Integrasi AI Assistant (Context Retrieval & Action Execution)
    # ----------------------------------------------------------------------

    def detect_project_gitlab_remote(self, project_dir: str) -> Dict[str, Any]:
        """
        Memeriksa remote origin git pada direktori proyek untuk mendeteksi
        apakah proyek mengarah ke GitLab.
        """
        if not project_dir or not os.path.isdir(project_dir):
            return {"is_gitlab": False, "host": None, "repo": None}

        try:
            res = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                cwd=project_dir,
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=5,
            )
            if res.returncode != 0:
                return {"is_gitlab": False, "host": None, "repo": None}

            url = res.stdout.strip()
            # Pola HTTPS: https://gitlab.com/owner/repo.git
            # Pola SSH: git@gitlab.com:owner/repo.git
            ssh_match = re.match(r"^git@([^:]+):(.+?)(?:\.git)?$", url)
            if ssh_match:
                host = ssh_match.group(1)
                repo = ssh_match.group(2)
                return {"is_gitlab": True, "host": host, "repo": repo, "url": url}

            http_match = re.match(r"^https?://([^/]+)/(.+?)(?:\.git)?$", url)
            if http_match:
                host = http_match.group(1)
                repo = http_match.group(2)
                return {"is_gitlab": True, "host": host, "repo": repo, "url": url}

        except Exception:
            pass
        return {"is_gitlab": False, "host": None, "repo": None}

    def get_issue_context(self, repo: str, issue_id: str) -> Dict[str, Any]:
        """
        Mengambil detail issue dan diskusi terkait untuk disuntikkan ke prompt AI.
        """
        bin_path = self.get_glab_bin()
        if not bin_path:
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED}

        config = self._read_config()
        host = config.get("default_host", DEFAULT_GITLAB_HOST)
        env = self._get_auth_env(host)

        try:
            res = subprocess.run(
                [bin_path, "issue", "view", str(issue_id), "-R", repo, "--comments"],
                capture_output=True,
                text=True,
                env=env,
                creationflags=get_silent_flags(),
                timeout=15,
            )
            if res.returncode != 0:
                return {
                    "status": "error",
                    "message": MSG_GLAB_ACTION_FAILED,
                    "args": {"e": res.stderr.strip() or "Issue not found"},
                }

            return {
                "status": "success",
                "issue_id": str(issue_id),
                "repo": repo,
                "content": res.stdout,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": MSG_GLAB_ACTION_FAILED,
                "args": {"e": str(e)},
            }

    @staticmethod
    def _parse_issue_line(line_str: str) -> Optional[dict]:
        clean = line_str.lstrip("#")
        parts = clean.split(None, 1)
        if not parts or not parts[0].isdigit():
            return None
        issue_id = parts[0]
        remainder = parts[1].strip() if len(parts) > 1 else ""
        while remainder.endswith(")") and " (" in remainder:
            remainder = remainder.rsplit(" (", 1)[0].strip()
        return {
            "id": issue_id,
            "title": remainder,
            "raw": line_str,
        }

    @staticmethod
    def _is_vpn_unreachable(def_acc: Optional[dict], host: str) -> bool:
        if def_acc and def_acc.get("requires_vpn"):
            try:
                probe = check_host_reachability(host, timeout=1.5)
                return not probe.get("reachable", False)
            except Exception:
                return True
        return False

    def get_recent_issues(self, repo: Optional[str] = None, limit: int = 5) -> Dict[str, Any]:
        """
        Mengambil daftar issue terbuka terbaru.
        """
        bin_path = self.get_glab_bin()
        if not bin_path:
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED, "issues": []}

        config = self._read_config()
        host = config.get("default_host", DEFAULT_GITLAB_HOST)

        # Cek apakah host akun ini memerlukan VPN dan terputus
        accounts = config.get("accounts", [])
        def_id = config.get("default_account_id", "")
        def_acc = next((a for a in accounts if a.get("id") == def_id), None)
        if not def_acc:
            def_acc = next((a for a in accounts if a.get("host") == host), None)

        if self._is_vpn_unreachable(def_acc, host):
            return {
                "status": "success",
                "issues": [],
                "vpn_blocked": True,
                "vpn_host": host,
            }

        env = self._get_auth_env(host)

        cmd = [bin_path, "issue", "list", "-P", str(max(1, limit))]
        if repo:
            cmd.extend(["-R", repo])

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                creationflags=get_silent_flags(),
                timeout=15,
            )
            if res.returncode != 0:
                return {
                    "status": "error",
                    "message": MSG_GLAB_ACTION_FAILED,
                    "args": {"e": res.stderr.strip() or "Failed to fetch issues"},
                    "issues": [],
                }

            # Parse baris output glab issue list
            issues = []
            for line in res.stdout.strip().split("\n"):
                line_str = line.strip()
                if not line_str or line_str.startswith("Showing"):
                    continue
                parsed_issue = self._parse_issue_line(line_str)
                if parsed_issue:
                    issues.append(parsed_issue)

            return {"status": "success", "issues": issues}
        except Exception as e:
            return {
                "status": "error",
                "message": MSG_GLAB_ACTION_FAILED,
                "args": {"e": str(e)},
                "issues": [],
            }

    def comment_issue(self, repo: str, issue_id: str, comment: str) -> Dict[str, Any]:
        """
        Menambahkan catatan/komentar ke issue GitLab secara defensif
        (tanpa shell string concatenation).
        """
        bin_path = self.get_glab_bin()
        if not bin_path:
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED}

        config = self._read_config()
        host = config.get("default_host", DEFAULT_GITLAB_HOST)
        env = self._get_auth_env(host)

        try:
            res = subprocess.run(
                [
                    bin_path,
                    "issue",
                    "note",
                    str(issue_id),
                    "-R",
                    repo,
                    "-m",
                    comment,
                ],
                capture_output=True,
                text=True,
                env=env,
                creationflags=get_silent_flags(),
                timeout=20,
            )
            if res.returncode != 0:
                err_msg = res.stderr.strip() or res.stdout.strip() or "Command failed"
                return {
                    "status": "error",
                    "message": MSG_GLAB_COMMENT_FAILED,
                    "args": {"id": issue_id, "e": err_msg},
                }

            web_url = None
            url_match = re.search(r"(https?://[^\s]+/issues/\d+[^\s]*)", res.stdout)
            if url_match:
                web_url = url_match.group(1)

            self._log(MSG_GLAB_COMMENT_SUCCESS, "info", {"id": str(issue_id)})
            return {
                "status": "success",
                "message": MSG_GLAB_COMMENT_SUCCESS,
                "args": {"id": str(issue_id)},
                "web_url": web_url,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": MSG_GLAB_COMMENT_FAILED,
                "args": {"id": str(issue_id), "e": str(e)},
            }

    def comment_mr(self, repo: str, mr_id: str, comment: str) -> Dict[str, Any]:
        """
        Menambahkan catatan/komentar ke Merge Request GitLab.
        """
        bin_path = self.get_glab_bin()
        if not bin_path:
            return {"status": "error", "message": MSG_GLAB_NOT_INSTALLED}

        config = self._read_config()
        host = config.get("default_host", DEFAULT_GITLAB_HOST)
        env = self._get_auth_env(host)

        try:
            res = subprocess.run(
                [
                    bin_path,
                    "mr",
                    "note",
                    str(mr_id),
                    "-R",
                    repo,
                    "-m",
                    comment,
                ],
                capture_output=True,
                text=True,
                env=env,
                creationflags=get_silent_flags(),
                timeout=20,
            )
            if res.returncode != 0:
                err_msg = res.stderr.strip() or res.stdout.strip() or "Command failed"
                return {
                    "status": "error",
                    "message": MSG_GLAB_ACTION_FAILED,
                    "args": {"e": err_msg},
                }

            self._log(MSG_GLAB_MR_COMMENT_SUCCESS, "info", {"id": str(mr_id)})
            return {
                "status": "success",
                "message": MSG_GLAB_MR_COMMENT_SUCCESS,
                "args": {"id": str(mr_id)},
            }
        except Exception as e:
            return {
                "status": "error",
                "message": MSG_GLAB_ACTION_FAILED,
                "args": {"e": str(e)},
            }

    def execute_action(
        self, action: str, repo: str, target: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Router aksi dari AI Assistant / Human-in-the-Loop.
        """
        if not repo:
            return {"status": "error", "message": MSG_GLAB_REPO_NOT_FOUND}

        comment = params.get("comment", "") if isinstance(params, dict) else ""

        if action == "comment_issue":
            return self.comment_issue(repo, target, comment)
        elif action == "comment_mr":
            return self.comment_mr(repo, target, comment)
        else:
            return {
                "status": "error",
                "message": MSG_GLAB_ACTION_FAILED,
                "args": {"e": f"Unsupported action: {action}"},
            }

    @staticmethod
    def _format_gitlab_project_item(p: dict, host: str, acc_id: str) -> dict:
        p_id = str(p.get("id", ""))
        full_name = p.get("path_with_namespace") or p.get("name_with_namespace") or p.get("name", "")
        web_url = p.get("web_url") or f"https://{host}/{p.get('path_with_namespace', '')}"
        vis = p.get("visibility", "private")
        return {
            "id": p_id,
            "name": p.get("name", ""),
            "full_name": full_name,
            "visibility": vis,
            "web_url": web_url,
            "ssh_url": p.get("ssh_url_to_repo", ""),
            "http_url": p.get("http_url_to_repo", ""),
            "default_branch": p.get("default_branch", "main"),
            "last_activity_at": p.get("last_activity_at", ""),
            "account_id": acc_id,
            "host": host,
            "source": "remote",
        }

    def _fetch_gitlab_projects_via_rest(
        self, host: str, token: str, auth_type: str, acc_id: str, seen_keys: set, projects: list
    ):
        api_url = f"https://{host}/api/v4/projects?membership=true&order_by=last_activity_at&per_page=50"
        headers = {"User-Agent": "VyloServe-Desktop"}
        if auth_type == "oauth":
            headers["Authorization"] = f"Bearer {token}"
        else:
            headers["PRIVATE-TOKEN"] = token

        try:
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8"))
                    if isinstance(raw, list):
                        for p in raw:
                            item = self._format_gitlab_project_item(p, host, acc_id)
                            projects.append(item)
                            seen_keys.add(item["full_name"].lower())
        except Exception:
            pass

    def _fetch_gitlab_projects_via_cli(self, host: str, acc_id: str, seen_keys: set, projects: list):
        bin_path = self.get_glab_bin()
        if not bin_path:
            return
        try:
            res = subprocess.run(
                [bin_path, "api", "projects?membership=true&order_by=last_activity_at&per_page=50", "--hostname", host],
                capture_output=True,
                text=True,
                creationflags=get_silent_flags(),
                timeout=10,
            )
            if res.returncode == 0:
                raw = json.loads(res.stdout)
                if isinstance(raw, list):
                    for p in raw:
                        item = self._format_gitlab_project_item(p, host, acc_id)
                        if item["full_name"].lower() not in seen_keys:
                            projects.append(item)
                            seen_keys.add(item["full_name"].lower())
        except Exception:
            pass

    def _fetch_remote_gitlab_projects(
        self, host: str, token: str, auth_type: str, acc_id: str, seen_keys: set, projects: list
    ):
        if token:
            self._fetch_gitlab_projects_via_rest(host, token, auth_type, acc_id, seen_keys, projects)
        if not projects:
            self._fetch_gitlab_projects_via_cli(host, acc_id, seen_keys, projects)

    @staticmethod
    def _read_git_remote_url(cfg_file: str) -> Optional[str]:
        try:
            with open(cfg_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            url_match = re.search(r"url\s*=\s*([^\r\n]+)", content)
            return url_match.group(1).strip() if url_match else None
        except Exception:
            return None

    @classmethod
    def _inspect_local_www_entry_for_gitlab(
        cls, entry: str, www_dir: str, host: str, acc_id: str, seen_keys: set
    ) -> Optional[dict]:
        cfg_file = os.path.join(www_dir, entry, ".git", "config")
        if not os.path.isfile(cfg_file):
            return None
        remote_url = cls._read_git_remote_url(cfg_file)
        if not remote_url or host.lower() not in remote_url.lower():
            return None
        cleaned_url = re.sub(r"\.git$", "", remote_url)
        path_part = cleaned_url.split(host)[-1].lstrip("/:")
        if not path_part or path_part.lower() in seen_keys:
            return None
        return {
            "id": f"local_{entry}",
            "name": entry,
            "full_name": path_part,
            "visibility": "private",
            "web_url": f"https://{host}/{path_part}",
            "ssh_url": remote_url if remote_url.startswith("git@") else "",
            "http_url": remote_url if remote_url.startswith("http") else "",
            "default_branch": "main",
            "last_activity_at": "",
            "account_id": acc_id,
            "host": host,
            "source": "local",
        }

    def _scan_local_gitlab_repos(self, host: str, acc_id: str, seen_keys: set, projects: list):
        www_dir = os.path.join(self.root_dir, "www")
        if not os.path.isdir(www_dir):
            return
        try:
            for entry in os.listdir(www_dir):
                item = self._inspect_local_www_entry_for_gitlab(entry, www_dir, host, acc_id, seen_keys)
                if item:
                    projects.append(item)
                    seen_keys.add(item["full_name"].lower())
        except Exception:
            pass

    def get_account_projects(self, account_id: str = "") -> Dict[str, Any]:
        """
        Mengambil daftar repositori/proyek GitLab yang diasosiasikan dengan akun tertentu
        (atau akun default jika account_id kosong).
        Mendukung endpoint GitLab REST API /projects?membership=true,
        serta memindai repositori lokal di www/ yang memiliki remote GitLab host terkait.
        """
        config = self._read_config()
        accounts = config.get("accounts", [])
        if not accounts:
            return {
                "status": "success",
                "data": {"projects": [], "account_id": "", "host": "", "username": ""},
            }

        target_acc = None
        if account_id:
            target_acc = next((a for a in accounts if a.get("id") == account_id), None)
        if not target_acc:
            def_id = config.get("default_account_id", "")
            target_acc = next((a for a in accounts if a.get("id") == def_id), None)
            if not target_acc:
                target_acc = next((a for a in accounts if a.get("is_default")), accounts[0])

        acc_id = target_acc.get("id", "")
        host = self._clean_hostname(target_acc.get("host", DEFAULT_GITLAB_HOST))
        token = target_acc.get("token", "").strip()
        auth_type = target_acc.get("auth_type", "pat")
        username = target_acc.get("username", "")
        requires_vpn = bool(target_acc.get("requires_vpn", False))

        projects: List[Dict[str, Any]] = []
        seen_keys = set()
        vpn_blocked = False

        if requires_vpn:
            try:
                probe = check_host_reachability(host, timeout=1.5)
                if not probe.get("reachable", False):
                    vpn_blocked = True
            except Exception:
                vpn_blocked = True

        # 1. Coba ambil dari GitLab REST API atau glab CLI jika host dapat dijangkau
        if not vpn_blocked:
            self._fetch_remote_gitlab_projects(host, token, auth_type, acc_id, seen_keys, projects)

        # 2. Pindai repositori lokal di www/ yang remote-nya mengarah ke host akun ini
        self._scan_local_gitlab_repos(host, acc_id, seen_keys, projects)

        return {
            "status": "success",
            "data": {
                "projects": projects,
                "account_id": acc_id,
                "host": host,
                "username": username,
                "requires_vpn": requires_vpn,
                "vpn_blocked": vpn_blocked,
                "vpn_host": host,
            },
        }
