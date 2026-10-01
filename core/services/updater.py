import urllib.request
import json
import os
import subprocess
import tempfile
import re
import threading
import traceback
from core.utils.file_utils import download_advanced
from core.utils.system_utils import get_project_root

MSG_DOWNLOADING = "backend.updater.downloading"
MSG_READY_TO_INSTALL = "backend.updater.ready_to_install"
MSG_DOWNLOAD_FAILED = "backend.updater.download_failed"

class UpdaterManager:
    def __init__(self, api):
        self.api = api
        self.base_dir = get_project_root()
        self.repo_url = "https://api.github.com/repos/authntcG/vyloserve/releases"
        
        self.state = {
            "result": None,
            "is_downloading": False,
            "is_ready": False,
            "asset_name": None,
            "progress_percent": 0,
            "progress_text": MSG_DOWNLOADING
        }
        self._cleanup_temp()

    def _cleanup_temp(self):
        """Hapus file sisa installer saat startup sesuai rule 'wajib unduh ulang bila keluar aplikasi'"""
        temp_dir = os.path.join(self.base_dir, 'temp')
        if os.path.exists(temp_dir):
            for f in os.listdir(temp_dir):
                if f.endswith(('.exe', '.bat', '.tmp')):
                    try:
                        os.remove(os.path.join(temp_dir, f))
                    except Exception:
                        pass

    def _parse_version(self, version_str: str) -> tuple:
        clean = re.sub(r'^v\.?', '', version_str.lower())
        parts = clean.split('-')
        main_part = parts[0]
        prerelease = parts[1] if len(parts) > 1 else 'z'
        
        nums = main_part.split('.')
        major = int(nums[0]) if len(nums) > 0 and nums[0].isdigit() else 0
        minor = int(nums[1]) if len(nums) > 1 and nums[1].isdigit() else 0
        patch = int(nums[2]) if len(nums) > 2 and nums[2].isdigit() else 0
        
        return (major, minor, patch, prerelease)

    def get_update_status(self):
        return self.state

    def _fetch_releases(self):
        req = urllib.request.Request(self.repo_url, headers={'User-Agent': 'VyloServe-Updater'})
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception as e:
            return e

    def _find_latest_update(self, releases, current_version_tuple, receive_prerelease):
        latest_release = None
        for release in releases:
            if release.get("draft"): continue
            
            release_ver_tuple = self._parse_version(release.get("tag_name", ""))
            
            # Deteksi prerelease dari boolean GitHub ATAU dari tuple nama tag-nya (tidak berakhiran 'z')
            is_prerelease = release.get("prerelease") or release_ver_tuple[3] != 'z'
            
            if not receive_prerelease and is_prerelease:
                continue
            
            if release_ver_tuple > current_version_tuple:
                if not latest_release or release_ver_tuple > self._parse_version(latest_release.get("tag_name", "")):
                    latest_release = release
        return latest_release

    def _find_installer_asset(self, latest_release):
        installer_asset = None
        for asset in latest_release.get("assets", []):
            name = asset.get("name", "")
            if "Setup" in name and name.endswith(".exe"):
                installer_asset = asset
                break
        
        if not installer_asset:
            for asset in latest_release.get("assets", []):
                if asset.get("name", "").endswith(".exe"):
                    installer_asset = asset
                    break
        return installer_asset

    def check_for_updates(self):
        from main import APP_VERSION
        current_version_tuple = self._parse_version(APP_VERSION)
        
        settings_res = self.api.settings.get_settings()
        receive_prerelease = settings_res.get('data', {}).get('receive_prerelease_updates', False)

        releases = self._fetch_releases()
        if isinstance(releases, Exception):
            res = {"status": "error", "message": "backend.updater.network_error", "args": {"e": str(releases)}}
            self.state["result"] = res
            return res

        if not releases:
            res = {"status": "error", "message": "backend.updater.no_releases"}
            self.state["result"] = res
            return res

        latest_release = self._find_latest_update(releases, current_version_tuple, receive_prerelease)
        
        if not latest_release:
            res = {"status": "success", "is_update_available": False, "message": "backend.updater.already_latest"}
            self.state["result"] = res
            return res

        installer_asset = self._find_installer_asset(latest_release)

        if not installer_asset:
            res = {"status": "error", "message": "backend.updater.no_installer"}
            self.state["result"] = res
            return res

        res = {
            "status": "success",
            "is_update_available": True,
            "version": latest_release.get("tag_name"),
            "changelog": latest_release.get("body", ""),
            "asset_url": installer_asset.get("browser_download_url"),
            "asset_name": installer_asset.get("name")
        }
        self.state["result"] = res
        return res

    def start_download_update(self, asset_url: str, asset_name: str):
        if self.state["is_downloading"]:
            return {"status": "error", "message": "backend.updater.already_downloading"}
            
        self.state["is_downloading"] = True
        self.state["is_ready"] = False
        self.state["asset_name"] = asset_name
        self.state["progress_percent"] = 0
        self.state["progress_text"] = MSG_DOWNLOADING
        
        self.api.emit_progress(0, MSG_DOWNLOADING, {"file": asset_name})
        
        # Jalankan di background daemon thread
        threading.Thread(target=self._download_thread, args=(asset_url, asset_name), daemon=True).start()
        
        return {"status": "success", "message": "backend.updater.downloading", "args": {"file": asset_name}}

    def _download_thread(self, asset_url: str, asset_name: str):
        temp_dir = os.path.join(self.base_dir, 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        dest_path = os.path.join(temp_dir, asset_name)
        
        try:
            req = urllib.request.Request(asset_url, headers={'User-Agent': 'VyloServe-Updater'})
            with urllib.request.urlopen(req) as response:
                total_size = int(response.getheader('Content-Length', 0))
                downloaded = 0
                chunk_size = 1024 * 1024 # 1MB chunk
                
                with open(dest_path, 'wb') as f:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = int((downloaded / total_size) * 100)
                            self.state["progress_percent"] = percent
                            # Emit real-time progress ke UI via event window global
                            self.api.emit_progress(percent, MSG_DOWNLOADING, {"file": asset_name})
                            
            self.state["is_ready"] = True
            self.state["is_downloading"] = False
            self.state["progress_text"] = MSG_READY_TO_INSTALL
            self.state["progress_percent"] = 100

            # Emit final progress untuk menghilangkan widget loading di UI
            self.api.emit_progress(100, MSG_READY_TO_INSTALL, {})

            # Beri tahu UI bahwa update sudah siap di-install (pop modal)
            if self.api._window:
                self.api._window.evaluate_js("window.dispatchEvent(new CustomEvent('vylo_update_ready'))")

        except Exception as e:
            self.state["is_downloading"] = False
            self.state["progress_text"] = MSG_DOWNLOAD_FAILED
            self.state["progress_percent"] = 0
            self.api.emit_log("backend.updater.download_error", "error", {"e": str(e)})
            # percent=100 dipakai di sini bukan sebagai "selesai sukses", melainkan sinyal
            # bagi frontend untuk auto-hide widget progress (kontrak percent>=100 di AGENTS.md);
            # status gagal sesungguhnya dibawa oleh progress_text/key, bukan oleh percent.
            self.api.emit_progress(100, MSG_DOWNLOAD_FAILED, {})

    def install_update(self):
        if not self.state["is_ready"] or not self.state["asset_name"]:
            return {"status": "error", "message": "backend.updater.not_ready"}
            
        temp_dir = os.path.join(self.base_dir, 'temp')
        installer_path = os.path.join(temp_dir, self.state["asset_name"])
        
        if not os.path.exists(installer_path):
            return {"status": "error", "message": "backend.updater.not_ready"}
            
        try:
            # Buat script .vbs temporer untuk memberikan jeda waktu dan 
            # mengeksekusi installer dengan izin UAC (ShellExecute "runas").
            # Hal ini mencegah kegagalan eksekusi jika CreateProcess biasa ditolak oleh Windows.
            vbs_path = os.path.join(temp_dir, 'launcher.vbs')
            with open(vbs_path, 'w') as f:
                f.write('WScript.Sleep 2000\n')
                f.write('Set UAC = CreateObject("Shell.Application")\n')
                f.write(f'UAC.ShellExecute "{installer_path}", "/SILENT /SUPPRESSMSGBOXES", "", "runas", 1\n')
            
            subprocess.Popen(['wscript.exe', vbs_path], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS)
            
            # Matikan VyloServe setelah jeda kecil agar response ke frontend terkirim
            import threading
            threading.Timer(0.5, self.api.close_app).start()
            
            return {"status": "success", "message": "backend.updater.restarting"}
        except Exception as e:
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
