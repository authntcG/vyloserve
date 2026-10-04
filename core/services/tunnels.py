import re
import os
import json
import shutil
import urllib.request
import threading
import queue
import subprocess
import time
from typing import Optional, Dict, Any

from core.utils.system_utils import get_project_root, run_silent_command, start_silent_process
from core.utils.file_utils import download_advanced, extract_archive

MSG_UNEXPECTED_ERROR = "backend.error.unexpected"
ANSI_ESCAPE_REGEX = r'\x1b\[[0-9;]*m'
GITHUB_API_HEADERS = {'User-Agent': 'Mozilla/5.0'}
MSG_ZROK_EXTRACTING = "backend.zrok.extracting"
MSG_ZROK_INSTALL_SUCCESS = "backend.zrok.install_success"
MSG_ZROK_NOT_INSTALLED = "backend.zrok.not_installed"
# Berapa lama menunggu zrok.exe mencetak URL publik sebelum dianggap gagal. 15 detik
# (nilai lama) terbukti terlalu singkat di kondisi nyata -- handshake OpenZiti/koneksi
# jaringan lambat bisa butuh lebih dari itu. Lihat docs/known_bugs.md untuk root cause lengkap.
ZROK_SHARE_DETECT_TIMEOUT_SECONDS = 30
# SonarQube python:S1192 -- literal "localhost:" dipakai berulang untuk mendeteksi
# target custom (localhost:port) vs. project VyloServe terdaftar.
ZROK_LOCALHOST_PREFIX = "localhost:"

class TunnelsManager:
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = get_project_root()
        self.zrok_dir = os.path.join(self.base_dir, 'bin', 'zrok')
        self.zrok_exe = os.path.join(self.zrok_dir, 'zrok.exe')
        
        # In-memory storage for active shares
        # Format: { "share_id": {"process": Popen, "project_id": "...", "url": "..."} }
        self.active_shares: Dict[str, Dict[str, Any]] = {}

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str, args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg, args)

    @staticmethod
    def _is_localhost_target(value: str) -> bool:
        """True jika `value` adalah target custom "localhost:port", bukan id project VyloServe."""
        return bool(value) and ":" in value and value.lower().startswith(ZROK_LOCALHOST_PREFIX)

    @staticmethod
    def _extract_zrok_public_url(line: str) -> Optional[str]:
        """
        Zrok CLI v2 mencetak log sebagai SATU OBJEK JSON per baris (gaya Go `log/slog`),
        BUKAN teks biasa berwarna ANSI seperti diasumsikan versi kode lama -- contoh output
        ASLI yang pernah diverifikasi langsung dari `zrok.exe share public ... --headless`:

            {"time":"...","level":"INFO",...,"msg":"access your zrok share at the
            following endpoints:\\n 1yiutxunuio0.shares.zrok.io"}

        Dua detail penting yang membuat regex lama ("access your zrok share:\\s+(https?://..)")
        SELALU gagal match, terlepas dari berapa lama ditunggu atau seberapa longgar pola
        URL-nya: (1) frasanya "...at the following endpoints:", bukan sekadar "...share:",
        dan (2) domainnya TIDAK pernah punya skema http(s) di depannya. Lihat
        docs/known_bugs.md untuk kronologi lengkap root cause ini.

        Fungsi ini mem-parsing JSON dulu (field 'msg'), fallback ke baris mentah kalau
        bukan JSON valid (jaga-jaga versi zrok lain yang masih pakai teks biasa), lalu
        mencari frasa endpoint zrok di dalamnya. Selalu mengembalikan URL LENGKAP dengan
        skema https:// (share publik zrok selalu HTTPS), atau None kalau tidak ditemukan.
        """
        stripped = re.sub(ANSI_ESCAPE_REGEX, '', line).strip()
        if not stripped:
            return None

        try:
            data = json.loads(stripped)
            msg = data.get("msg", "") if isinstance(data, dict) else stripped
        except ValueError:  # json.JSONDecodeError adalah subclass ValueError
            msg = stripped

        # Frasa resmi zrok v2 ("access your zrok share at the following endpoints:")
        # dibuat fleksibel di bagian tengah ([^:]*) supaya tetap cocok kalau frasa
        # persisnya berubah lagi di versi mendatang, selama pola dasarnya mirip.
        endpoint_match = re.search(
            r"access your zrok share[^:]*:\s*([a-z0-9][a-z0-9.-]*\.zrok\.io)",
            msg, re.IGNORECASE
        )
        if endpoint_match:
            host = endpoint_match.group(1)
            return host if re.match(r'https?://', host) else f"https://{host}"

        # Fallback: URL lengkap (dengan skema) di mana pun pada baris -- menjaga kompatibilitas
        # dengan format teks lama/versi zrok lain yang mungkin tetap mencetak skema penuh.
        url_match = re.search(r"(https?://[a-z0-9.-]*zrok\.io\S*)", msg, re.IGNORECASE)
        if url_match:
            return url_match.group(1)

        return None

    @staticmethod
    def _parse_zrok_log_line(line: str) -> "tuple[str, bool]":
        """
        Mengurai satu baris output zrok.exe jadi (pesan_bersih, apakah_bermasalah) yang
        enak dibaca di System Logs -- mem-parsing JSON (field 'msg'/'level') kalau
        formatnya JSON (zrok v2), supaya yang di-log adalah PESAN manusiawinya, bukan
        blob JSON mentah; fallback ke baris mentah + heuristik substring untuk format lain.
        """
        stripped = re.sub(ANSI_ESCAPE_REGEX, '', line).strip()
        msg = stripped
        is_problem = False
        try:
            data = json.loads(stripped)
            if isinstance(data, dict) and "msg" in data:
                msg = str(data.get("msg", "")).replace("\n", " ").strip()
                level = str(data.get("level", "")).lower()
                is_problem = level in ("error", "warn", "warning") or "error" in msg.lower() or "warn" in msg.lower()
                return msg, is_problem
        except ValueError:  # json.JSONDecodeError adalah subclass ValueError
            pass
        is_problem = "error" in msg.lower() or "warn" in msg.lower()
        return msg, is_problem

    def _log_zrok_line(self, line: str) -> None:
        """Log satu baris output zrok.exe ke System Logs dengan kategori yang sesuai."""
        msg, is_problem = self._parse_zrok_log_line(line)
        if not msg:
            return
        if is_problem:
            self._log("backend.zrok.process_error", "error", {"msg": msg})
        else:
            self._log("backend.zrok.process_log", "info", {"msg": msg})


    def get_available_zrok_versions(self) -> dict:
        try:
            self._log("backend.zrok.fetching_versions", "info")
            import urllib.request
            import json
            req = urllib.request.Request('https://api.github.com/repos/openziti/zrok/releases', headers=GITHUB_API_HEADERS)
            versions = []
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
                for release in data:
                    has_windows = any('windows_amd64' in asset['name'] for asset in release.get('assets', []))
                    if has_windows:
                        versions.append({"id": release['tag_name'], "value": release['tag_name'], "label": release['name']})
            self._log("backend.zrok.versions_fetched", "info", {"count": len(versions)})
            return {"status": "success", "data": versions}
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _read_zrok_version(self) -> Optional[str]:
        res_ver = run_silent_command([self.zrok_exe, "version"])
        if res_ver.returncode != 0:
            return None
        lines = res_ver.stdout.strip().split("\n")
        for line in reversed(lines):
            if line.strip().startswith("v"):
                return line.strip().split()[0]
        return None

    def _list_active_shares(self) -> list:
        active = []
        for sid, sdata in self.active_shares.items():
            # Check if process is still running
            proc = sdata.get('process')
            if proc and proc.poll() is None:
                active.append({
                    "id": sid,
                    "project_id": sdata.get('project_id'),
                    "url": sdata.get('url')
                })
        return active

    def get_zrok_status(self) -> dict:
        is_installed = os.path.exists(self.zrok_exe)
        is_enabled = False
        zrok_env = None
        version = None

        if is_installed:
            version = self._read_zrok_version()

            # Check if environment is enabled (zrok status)
            res = run_silent_command([self.zrok_exe, "status"])
            clean_stdout = re.sub(ANSI_ESCAPE_REGEX, '', res.stdout).strip()
            
            # Zrok outputs Config table regardless. We must check for 'Environment:' to confirm it is actually enabled.
            if "Environment:" in clean_stdout:
                is_enabled = True
                zrok_env = clean_stdout

        return {
            "installed": is_installed,
            "enabled": is_enabled,
            "version": version,
            "env_status": zrok_env,
            "active_shares": self._list_active_shares()
        }

    def _resolve_zrok_download_url(self, version: str) -> Optional[str]:
        """Cari URL aset Windows AMD64 dari GitHub Releases untuk versi zrok yang diminta."""
        url = 'https://api.github.com/repos/openziti/zrok/releases/latest' if version == "latest" else f'https://api.github.com/repos/openziti/zrok/releases/tags/{version}'
        req = urllib.request.Request(url, headers=GITHUB_API_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            for asset in data.get('assets', []):
                if 'windows_amd64.tar.gz' in asset['name'] or 'windows_amd64.zip' in asset['name']:
                    return asset['browser_download_url']
        return None

    def _download_zrok_archive(self, download_url: str, archive_path: str) -> None:
        """Unduh arsip zrok sambil melaporkan progress 0-80%."""
        req = urllib.request.Request(download_url, headers=GITHUB_API_HEADERS)
        with urllib.request.urlopen(req, timeout=15) as response, open(archive_path, 'wb') as out_file:
            total_size = int(response.info().get('Content-Length', 0))
            downloaded = 0
            block_size = 8192
            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break
                out_file.write(buffer)
                downloaded += len(buffer)
                if total_size > 0:
                    percent = int((downloaded / total_size) * 80) # Scale to 0-80%
                    self._progress(percent, "backend.zrok.downloading", {"url": download_url})

    def _normalize_zrok_exe_name(self) -> None:
        """Rilis zrok terbaru kadang menamai binari 'zrok2.exe' dsb; samakan jadi zrok.exe."""
        if os.path.exists(self.zrok_exe):
            return
        import glob
        exe_files = glob.glob(os.path.join(self.zrok_dir, "zrok*.exe"))
        if not exe_files:
            return
        for _ in range(10):
            try:
                # if dest exists for some reason, remove it
                if os.path.exists(self.zrok_exe):
                    os.remove(self.zrok_exe)
                os.rename(exe_files[0], self.zrok_exe)
                return
            except Exception:
                time.sleep(0.5)
        self._log(MSG_UNEXPECTED_ERROR, "error", {"e": f"Failed to rename after retries: {exe_files[0]} to {self.zrok_exe}"})

    def install_zrok(self, version: str = "latest") -> dict:
        try:
            self._log("backend.zrok.fetching_latest", "info")
            self._progress(10, "backend.zrok.fetching_latest")
            
            download_url = self._resolve_zrok_download_url(version)
            
            if not download_url:
                self._log("backend.zrok.release_not_found", "error")
                return {"status": "error", "message": "backend.zrok.release_not_found"}

            os.makedirs(self.zrok_dir, exist_ok=True)
            filename = download_url.split('/')[-1]
            archive_path = os.path.join(self.zrok_dir, filename)

            self._log("backend.zrok.downloading", "info", {"url": download_url})
            self._download_zrok_archive(download_url, archive_path)
            
            self._log(MSG_ZROK_EXTRACTING, "info")
            self._progress(80, MSG_ZROK_EXTRACTING)
            
            # extract_archive already sends progress (though usually it expects 0-100, but we just let it run)
            # Actually extract_archive takes (archive_path, dest_dir, progress_cb).
            # The progress_cb receives 0-100.
            # To map it properly to 80-99, we'd wrap it. But let's just let it run or use our own cb.
            def ext_cb(p, msg, args=None):
                self._progress(80 + int(p * 0.19), MSG_ZROK_EXTRACTING)
            
            extract_archive(archive_path, self.zrok_dir, ext_cb)
            os.remove(archive_path)

            self._normalize_zrok_exe_name()

            if not os.path.exists(self.zrok_exe):
                self._log("backend.zrok.extract_failed", "error")
                return {"status": "error", "message": "backend.zrok.extract_failed"}

            self._progress(100, MSG_ZROK_INSTALL_SUCCESS)
            self._log(MSG_ZROK_INSTALL_SUCCESS, "success")
            return {"status": "success", "message": MSG_ZROK_INSTALL_SUCCESS}
        except Exception as e:
            self._progress(100, MSG_UNEXPECTED_ERROR)
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def enable_zrok(self, token: str) -> dict:
        try:
            if not os.path.exists(self.zrok_exe):
                self._log(MSG_ZROK_NOT_INSTALLED, "warn")
                return {"status": "error", "message": MSG_ZROK_NOT_INSTALLED}

            self._log("backend.zrok.enabling", "info")
            res = run_silent_command([self.zrok_exe, "enable", token])

            import re
            if res.stdout and res.stdout.strip():
                self._log("backend.zrok.process_log", "info", {"msg": re.sub(ANSI_ESCAPE_REGEX, '', res.stdout).strip()})
            if res.returncode == 0:
                self._log("backend.zrok.enable_success", "success")
                return {"status": "success", "message": "backend.zrok.enable_success"}
            else:
                clean_err = ""
                if res.stderr:
                    clean_err = re.sub(ANSI_ESCAPE_REGEX, '', res.stderr).strip()
                self._log("backend.zrok.enable_failed", "error", {"err": clean_err})
                return {"status": "error", "message": "backend.zrok.enable_failed", "args": {"err": clean_err}}
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def disable_zrok(self) -> dict:
        try:
            if not os.path.exists(self.zrok_exe):
                self._log(MSG_ZROK_NOT_INSTALLED, "warn")
                return {"status": "error", "message": MSG_ZROK_NOT_INSTALLED}

            self._log("backend.zrok.disabling", "info")
            res = run_silent_command([self.zrok_exe, "disable"])

            # Regresi: sebelumnya SELALU return sukses tanpa cek returncode sama sekali --
            # kalau disable gagal (mis. environment sudah disable duluan lewat jalur lain),
            # user tidak pernah tahu. Lihat docs/known_bugs.md.
            if res.returncode == 0:
                self._log("backend.zrok.disable_success", "success")
                return {"status": "success", "message": "backend.zrok.disable_success"}

            clean_err = re.sub(ANSI_ESCAPE_REGEX, '', res.stderr).strip() if res.stderr else ""
            self._log("backend.zrok.disable_failed", "error", {"err": clean_err})
            return {"status": "error", "message": "backend.zrok.disable_failed", "args": {"err": clean_err}}
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def uninstall_zrok(self) -> dict:
        """Menghentikan semua share aktif, lalu menghapus binari Zrok yang terunduh."""
        try:
            self._log("backend.zrok.uninstalling", "info")
            # list() di sini WAJIB ADA, bukan redundan -- stop_zrok_share() men-delete key dari
            # self.active_shares saat iterasi berjalan. Tanpa snapshot list(), iterasi langsung
            # di atas dict akan raise "RuntimeError: dictionary changed size during iteration".
            for share_id in list(self.active_shares):  # NOSONAR (python:S7504): lihat komentar di atas
                self.stop_zrok_share(share_id)

            if os.path.exists(self.zrok_dir):
                shutil.rmtree(self.zrok_dir, ignore_errors=True)

            self._log("backend.zrok.uninstalled", "warn")
            return {"status": "success", "message": "backend.zrok.uninstalled"}
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _spawn_zrok_process(self, zrok_target: str) -> subprocess.Popen:
        cmd = [self.zrok_exe, "share", "public", zrok_target, "--headless"]
        return subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            text=True,
            bufsize=1
        )

    @staticmethod
    def _start_stdout_reader(proc: subprocess.Popen, line_queue: "queue.Queue[Optional[str]]") -> None:
        def reader():
            try:
                for raw_line in proc.stdout:
                    line_queue.put(raw_line)
            finally:
                line_queue.put(None)
        threading.Thread(target=reader, daemon=True).start()

    def _start_stdout_consumer(self, line_queue: "queue.Queue[Optional[str]]", stdout_closed: bool) -> None:
        def consume_stdout():
            if stdout_closed:
                return
            while True:
                line = line_queue.get()
                if line is None:
                    break
                if line.strip():
                    self._log_zrok_line(line)
        threading.Thread(target=consume_stdout, daemon=True).start()

    def _sync_apache_alias_for_share(self, target: str, public_url: str) -> None:
        # INJECT SERVER ALIAS TO APACHE (only if it's a VyloServe project)
        if not self._is_localhost_target(target) and hasattr(self.api, 'project'):
            self._log("backend.zrok.syncing_vhost", "info", {"url": public_url})
            self.api.project.update_project({"id": target, "tunnel_url": public_url})
            # update_project already calls sync_apache_vhosts and reloads Apache if needed!

    def start_zrok_share(self, target: str) -> dict:
        try:
            if not os.path.exists(self.zrok_exe):
                self._log(MSG_ZROK_NOT_INSTALLED, "warn")
                return {"status": "error", "message": MSG_ZROK_NOT_INSTALLED}

            zrok_target = self._resolve_share_target(target)
            if not zrok_target:
                self._log("backend.project.project_not_found", "error")
                return {"status": "error", "message": "backend.project.project_not_found"}

            self._log("backend.zrok.resolved_target", "info", {"target": zrok_target})

            proc = self._spawn_zrok_process(zrok_target)
            share_id = f"zrok_{int(time.time())}"
            line_queue: "queue.Queue[Optional[str]]" = queue.Queue()

            self._start_stdout_reader(proc, line_queue)
            start_time = time.time()
            public_url, stdout_closed = self._wait_for_zrok_url(line_queue, start_time)

            if not public_url:
                elapsed = round(time.time() - start_time, 1)
                self._log("backend.zrok.detect_timeout", "error", {"seconds": elapsed})
                proc.kill()
                return {"status": "error", "message": "backend.zrok.url_not_found"}

            self._start_stdout_consumer(line_queue, stdout_closed)

            # Save process and info
            self.active_shares[share_id] = {
                "process": proc,
                "project_id": target,
                "url": public_url
            }

            self._log("backend.zrok.share_active", "success", {"url": public_url})

            self._sync_apache_alias_for_share(target, public_url)

            return {
                "status": "success",
                "message": "backend.zrok.share_active",
                "args": {"url": public_url},
                "share_id": share_id,
                "url": public_url
            }
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def stop_zrok_share(self, share_id: str) -> dict:
        try:
            if share_id not in self.active_shares:
                self._log("backend.zrok.share_not_found", "warn")
                return {"status": "error", "message": "backend.zrok.share_not_found"}

            share_data = self.active_shares[share_id]
            proc = share_data.get("process")
            project_id = share_data.get("project_id")

            if proc and proc.poll() is None:
                proc.kill()
                proc.wait(timeout=3)

            del self.active_shares[share_id]
            self._log("backend.zrok.share_stopped", "info")

            # REMOVE SERVER ALIAS FROM APACHE
            if project_id and not self._is_localhost_target(project_id) and hasattr(self.api, 'project'):
                projects = self.api.project._read_projects()
                project = next((p for p in projects if p['id'] == project_id), None)
                if project and 'tunnel_url' in project:
                    del project['tunnel_url']
                    self.api.project._save_projects(projects)
                    if hasattr(self.api.project, 'sync_apache_vhosts'):
                        self.api.project.sync_apache_vhosts()

            return {"status": "success", "message": "backend.zrok.share_stopped"}
        except Exception as e:
            self._log(MSG_UNEXPECTED_ERROR, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _resolve_share_target(self, target: str) -> str:
        if not self._is_localhost_target(target):
            projects = self.api.project._read_projects() if hasattr(self.api, 'project') else []
            project = next((p for p in projects if p['id'] == target), None)
            if not project:
                return ""
            self._log("backend.zrok.starting_share", "info", {"project": project.get('name')})
            apache_port = self.api.apache.get_http_port() if hasattr(self.api, 'apache') else 80
            return f"http://127.0.0.1:{apache_port}"
        else:
            self._log("backend.zrok.starting_share", "info", {"project": target})
            return target

    def _wait_for_zrok_url(self, line_queue: "queue.Queue[Optional[str]]", start_time: float) -> tuple[Optional[str], bool]:
        public_url = None
        stdout_closed = False
        while time.time() - start_time < ZROK_SHARE_DETECT_TIMEOUT_SECONDS:
            remaining = max(0.1, ZROK_SHARE_DETECT_TIMEOUT_SECONDS - (time.time() - start_time))
            try:
                line = line_queue.get(timeout=remaining)
            except queue.Empty:
                break
            if line is None:
                stdout_closed = True
                break

            if not line.strip():
                continue
            self._log_zrok_line(line)

            found = self._extract_zrok_public_url(line)
            if found:
                public_url = found
                break
        return public_url, stdout_closed

