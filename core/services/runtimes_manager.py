import os
import sys
from typing import Optional
import urllib.request
import urllib.error

import json
import zipfile
import shutil
import subprocess
import winreg
import ctypes
import concurrent.futures

# ---> IMPORT UTILITIES DARI CORE (DRY PRINCIPLE) <---
from core.utils.system_utils import get_project_root, run_silent_command
from core.utils.file_utils import download_advanced, extract_archive

USER_AGENT = 'Mozilla/5.0'
MSG_PREPARE_DL = "backend.runtimes.preparing_download"
MSG_DL_DONE = "backend.runtimes.download_complete_extracting"
MSG_INSTALL_FAILED = "backend.runtimes.install_failed"
MSG_STARTING_BINARY_DOWNLOAD = "backend.runtimes.starting_binary_download"


class RuntimesManager:
    """
    Manager terpusat untuk siklus hidup Runtimes & Engines Eksternal.
    Menangani Node.js, Python, Java (JDK), dan Go.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        # Semua engine akan diinstal secara portable di dalam folder bin/
        self.bin_dir = os.path.join(self.root_dir, 'bin')
        os.makedirs(self.bin_dir, exist_ok=True)

    # ==========================================
    # UTILITIES REGISTRY WINDOWS
    # ==========================================
    def _emit_log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api'): self.api.emit_log(msg, level, args)

    def _emit_progress(self, percent: int, msg: str, args: dict = None):
        if hasattr(self, 'api'): self.api.emit_progress(percent, msg, args)
    def _cleanup_failed_install(self, zip_path: str, e: Exception, name: str):
        import os
        if os.path.exists(zip_path): 
            try: os.remove(zip_path)
            except OSError: pass
        self._emit_progress(-1, MSG_INSTALL_FAILED, {"e": str(e)})
        self._emit_log("backend.runtimes.install_error_named", "error", {"name": name, "e": str(e)})
        return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def _get_cbs(self, start_pct: int, end_pct: int):
        """
        `download_advanced`/`extract_archive` (core/utils/file_utils.py) sudah memanggil
        progress_cb dengan persentase ABSOLUT (0-100), bukan fraksi 0.0-1.0 — lihat
        docs/known_bugs.md. `start_pct`/`end_pct` di sini hanya dipakai sebagai batas
        aman (clamp), bukan faktor pengali, supaya progress tidak pernah meluber ribuan
        persen lalu "melompat mundur" saat tahap berikutnya mengirim nilai tetap.
        """
        def log_cb(msg, lvl="info", args=None):
            self._emit_log(msg, lvl, args)
        def download_cb(pct, msg):
            clamped = max(start_pct, min(pct, end_pct))
            self._emit_progress(clamped, msg)
        return log_cb, download_cb


    def _check_external_installation(self, command: str):
        """
        Mendeteksi instalasi eksternal dengan 3 lapis keamanan (where, registry, env).
        Log Terminal telah dibersihkan dan dialihkan ke UI System Logs secara efisien.
        """
        import os
        import winreg
        import subprocess
        import sys
        import shutil

        # Mengirimkan log ke UI VyloServe (Hanya terpicu saat render halaman)
        self._emit_log("backend.runtimes.scanning_external", "info", {"engine": command})

        vyloserve_bin = os.path.normpath(os.path.join(self.root_dir, 'bin')).lower()
        found_path = None

        found_path = self._check_via_where(command, vyloserve_bin) or self._check_via_registry(command, vyloserve_bin) or self._check_via_env(command, vyloserve_bin)

        if not found_path:
            return {"exists": False, "path": "", "version": ""}

        # =========================================================
        # TAHAP 4: EKSEKUSI UNTUK MEMBACA VERSI
        # =========================================================
        try:
            # FIX: Penyesuaian parameter khusus untuk menghindari mode Interaktif (REPL)
            if command == 'java':
                flag = '-version'
            elif command == 'python':
                flag = '--version' # Sangat krusial! Menghindari masuk ke Python REPL
            elif command == 'go':
                flag = 'version'
            else:
                flag = '-v' # Bawaan untuk node

            is_windows_script = found_path.lower().endswith(('.cmd', '.bat'))
            creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            
            if is_windows_script:
                result = subprocess.run(f'"{found_path}" {flag}', capture_output=True, text=True, shell=True, creationflags=creation_flags)
            else:
                result = subprocess.run([found_path, flag], capture_output=True, text=True, creationflags=creation_flags)
            
            version_out = result.stdout.strip() or result.stderr.strip()
            
            if version_out:
                final_version = version_out.split('\n')[0].strip()
                
                self._emit_log("backend.runtimes.external_detected", "warn", {"engine": command, "version": final_version})
                    
                return {"exists": True, "path": found_path, "version": final_version}
                
        except OSError:
                pass

        return {"exists": True, "path": found_path, "version": "Unknown Version"}

    def _is_in_user_path(self, target_path: str) -> bool:
        """ Mengecek apakah path sudah ada di System PATH Windows """
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_READ)
            path_value, _ = winreg.QueryValueEx(key, 'Path')
            winreg.CloseKey(key)
            paths = [p.lower().rstrip('\\/') for p in path_value.split(';') if p]
            return target_path.lower().rstrip('\\/') in paths
        except Exception:
            return False

    def _get_paths_to_toggle(self, engine: str) -> list:
        if engine == 'node': return [os.path.join(self.bin_dir, 'node')]
        elif engine == 'python': return [os.path.join(self.bin_dir, 'python'), os.path.join(self.bin_dir, 'python', 'Scripts')]
        elif engine == 'java': return [os.path.join(self.bin_dir, 'java', 'bin')]
        elif engine == 'go': return [os.path.join(self.bin_dir, 'go', 'bin')]
        return []

    def _toggle_user_path_env(self, key, paths_to_toggle: list, enable: bool, engine: str) -> bool:
        import winreg, os
        try: path_value, _ = winreg.QueryValueEx(key, 'Path')
        except FileNotFoundError: path_value = ""
        current_paths = [p for p in path_value.split(';') if p]
        modified = False
        for target in paths_to_toggle:
            normalized_target = os.path.normpath(target)
            if enable and normalized_target not in current_paths:
                current_paths.append(normalized_target)
                modified = True
            elif not enable and normalized_target in current_paths:
                current_paths.remove(normalized_target)
                modified = True
        
        if engine == 'java':
            java_home = os.path.normpath(os.path.join(self.bin_dir, 'java'))
            if enable:
                winreg.SetValueEx(key, 'JAVA_HOME', 0, winreg.REG_SZ, java_home)
                modified = True
            else:
                try: winreg.DeleteValue(key, 'JAVA_HOME')
                except OSError: pass
                modified = True
                
        if modified:
            winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, ';'.join(current_paths))
        return modified

    def toggle_user_path(self, engine: str, enable: bool):
        paths_to_toggle = self._get_paths_to_toggle(engine)
        if not paths_to_toggle: return {"status": "error", "message": "backend.runtimes.engine_unsupported"}
        try:
            import winreg, ctypes
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_ALL_ACCESS)
            modified = self._toggle_user_path_env(key, paths_to_toggle, enable, engine)
            if modified:
                ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001A, 0, 'Environment', 0x0002, 5000, ctypes.byref(ctypes.c_ulong()))
            winreg.CloseKey(key)
            self._emit_log("backend.runtimes.path_updated", "success", {"engine": engine.upper()})
            return {"status": "success"}
        except Exception as e:
            self._emit_log("backend.runtimes.path_error_log", "error", {"engine": engine, "e": str(e)})
            return {"status": "error", "message": "backend.runtimes.registry_error", "args": {"e": str(e)}}

    # ==========================================
    # NODE.JS MANAGER
    # ==========================================
    def get_node_status(self):
        node_dir = os.path.join(self.bin_dir, 'node')
        node_exe = os.path.join(node_dir, 'node.exe' if sys.platform == 'win32' else 'node')
        
        internal_installed = os.path.exists(node_exe)
        internal_version = ""
        if internal_installed:
            try:
                result = subprocess.run([node_exe, '-v'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                internal_version = result.stdout.strip()
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation('node')

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(node_dir),
            'external': external_info 
        }

    def get_available_node_versions(self):
        """ Mengambil daftar versi Node.js dari JSON Index Resmi """
        try:
            url = 'https://nodejs.org/dist/index.json'
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                
                versions = []
                # Ambil 20 versi rilis teratas untuk menghindari list yang terlalu panjang
                for item in data[:20]:
                    version_num = item['version'].replace('v', '')
                    lts = item['lts']
                    
                    label = f"Node.js v{version_num}"
                    if lts:
                        label += f" (LTS: {lts})"
                    elif item == data[0]:
                        label += " (Latest Current)"
                        
                    versions.append({
                        'value': version_num,
                        'label': label
                    })
                return {'status': 'success', 'data': versions}
        except Exception as e:
            # Ignore SonarQube urllib warning for now, using Exception is fine when bubbling to UI
            return {'status': 'error', 'message': "backend.runtimes.node_fetch_failed", 'args': {"e": str(e)}}


    def _finalize_node_install(self, node_dir: str, enable_corepack: bool, version: str, zip_filename: str):
        self._emit_progress(85, "backend.runtimes.reorganizing_dir")
        extracted_folder = os.path.join(self.bin_dir, zip_filename.replace('.zip', ''))
        os.rename(extracted_folder, node_dir)
        if enable_corepack:
            self._emit_progress(90, "backend.runtimes.node_enable_corepack")
            corepack_cmd = os.path.join(node_dir, 'corepack.cmd' if sys.platform == 'win32' else 'corepack')
            if os.path.exists(corepack_cmd):
                run_silent_command([corepack_cmd, 'enable'], cwd=node_dir)
        self._emit_progress(100, "backend.runtimes.node_install_complete")
        self._emit_log("backend.runtimes.node_ready", "success", {"version": version})

    def install_node(self, version: str, enable_corepack: bool):
        node_dir = os.path.join(self.bin_dir, 'node')
        zip_path = os.path.join(self.bin_dir, f"node_{version}.zip")

        try:
            # 1. LOG INISIALISASI
            self._emit_log("backend.runtimes.node_install_start", "info", {"version": version})
            self._emit_progress(5, MSG_PREPARE_DL)

            zip_filename = f"node-v{version}-win-x64.zip"
            download_url = f"https://nodejs.org/dist/v{version}/{zip_filename}"

            # 2. FASE UNDUHAN (5% - 60%)
            log_cb, download_prog_cb = self._get_cbs(5, 60)

            if os.path.exists(node_dir): shutil.rmtree(node_dir, ignore_errors=True)

            log_cb(MSG_STARTING_BINARY_DOWNLOAD, "info", {"engine": "Node.js"})
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 85%)
            self._emit_log(MSG_DL_DONE, "info")
            self._emit_progress(65, "backend.runtimes.node_extracting")
            
            _, extract_prog_cb = self._get_cbs(65, 85)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            self._finalize_node_install(node_dir, enable_corepack, version, zip_filename)
            return {"status": "success"}

        except Exception as e:
            return self._cleanup_failed_install(zip_path, e, "Node.js")

    def uninstall_node(self):
        node_dir = os.path.join(self.bin_dir, 'node')
        self.toggle_user_path('node', False)
        if os.path.exists(node_dir):
            shutil.rmtree(node_dir, ignore_errors=True)
        self._emit_log("backend.runtimes.node_uninstalled", "warn")
        return {"status": "success"}


    # ==========================================
    # PYTHON MANAGER
    # ==========================================
    def get_python_status(self):
        python_dir = os.path.join(self.bin_dir, 'python')
        python_exe = os.path.join(python_dir, 'python.exe' if sys.platform == 'win32' else 'python')
        
        internal_installed = os.path.exists(python_exe)
        internal_version = ""
        if internal_installed:
            try:
                res = subprocess.run([python_exe, '--version'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                internal_version = res.stdout.strip()
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation('python')

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(python_dir),
            'external': external_info
        }


    def _group_python_versions(self, matches):
        version_dict = {}
        for v in matches:
            parts = v.split('.')
            minor = int(parts[1])
            patch = int(parts[2])
            if minor >= 8:
                if minor not in version_dict:
                    version_dict[minor] = []
                version_dict[minor].append(patch)
        return version_dict

    def _scan_python_binaries(self, version_dict):
        import urllib.request
        valid_versions = []
        sorted_minors = sorted(version_dict.keys(), reverse=True)
        def check_binary_exists(minor_val, patch_val):
            version_str = "3.{0}.{1}".format(minor_val, patch_val)
            zip_url = "https://www.python.org/ftp/python/{0}/python-{0}-embed-amd64.zip".format(version_str)
            try:
                head_req = urllib.request.Request(zip_url, method='HEAD', headers={'User-Agent': USER_AGENT})
                res = urllib.request.urlopen(head_req, timeout=3)
                return res.status == 200
            except OSError:
                return False
        for minor in sorted_minors:
            sorted_patches = sorted(version_dict[minor], reverse=True)
            for patch in sorted_patches:
                if check_binary_exists(minor, patch):
                    valid_versions.append("3.{0}.{1}".format(minor, patch))
                    break
        return valid_versions

    def get_available_python_versions(self):
        """ Web Scraper Pintar: Memindai & memvalidasi ketersediaan biner Windows """
        import re
        import urllib.request
        import urllib.error

        try:
            # 1. Ambil daftar direktori utama dari FTP Python
            req = urllib.request.Request("https://www.python.org/ftp/python/", headers={'User-Agent': USER_AGENT})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
            
            # Ekstrak seluruh tautan berformat href="3.x.y/"
            matches = set(re.findall(r'href="(3\.\d+\.\d+)/"', html))
            
            version_dict = self._group_python_versions(matches)
            valid_versions = self._scan_python_binaries(version_dict)
            # 5. Format JSON untuk Dropdown Antarmuka React
            results = []
            for i, v in enumerate(valid_versions):
                label = f"Python {v}"
                if i == 0:
                    label += " (Latest Stable)"
                results.append({'value': v, 'label': label})
                
            return {'status': 'success', 'data': results}
            
        except Exception as e:
            # Ignore SonarQube urllib warning for now, using Exception is fine when bubbling to UI
            return {'status': 'error', 'message': "backend.runtimes.py_fetch_failed", 'args': {"e": str(e)}}


    def _finalize_python_install(self, python_dir: str, install_pip: bool, version: str):
        import subprocess
        if install_pip:
            self._emit_log("backend.runtimes.py_unlock_site", "info")
            self._emit_progress(80, "backend.runtimes.configuring_environment")
            pth_file = next((f for f in os.listdir(python_dir) if f.endswith('._pth')), None)
            if pth_file:
                pth_path = os.path.join(python_dir, pth_file)
                with open(pth_path, 'r') as f: content = f.read()
                content = content.replace('#import site', 'import site')
                if 'Lib\\site-packages' not in content:
                    content += '\nLib\\site-packages\n'
                with open(pth_path, 'w') as f: f.write(content)
            os.makedirs(os.path.join(python_dir, 'Lib', 'site-packages'), exist_ok=True)
            self._emit_log("backend.runtimes.py_install_pip", "info")
            self._emit_progress(85, "backend.runtimes.py_setup_pkg_manager")
            version_parts = version.split('.')
            major = int(version_parts[0])
            minor = int(version_parts[1])
            import urllib.request
            if (major, minor) < (3, 10):
                get_pip_url = "https://bootstrap.pypa.io/pip/{0}.{1}/get-pip.py".format(major, minor)
            else:
                get_pip_url = "https://bootstrap.pypa.io/get-pip.py"
            get_pip_path = os.path.join(python_dir, 'get-pip.py')
            urllib.request.urlretrieve(get_pip_url, get_pip_path)
            python_exe = os.path.join(python_dir, 'python.exe')
            import certifi
            custom_env = os.environ.copy()
            custom_env['SSL_CERT_FILE'] = certifi.where()
            custom_env['REQUESTS_CA_BUNDLE'] = certifi.where()
            cflags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            res = subprocess.run([python_exe, get_pip_path, '--no-warn-script-location'], cwd=python_dir, creationflags=cflags, env=custom_env, capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError("Gagal mengeksekusi get-pip.py: {0}".format(res.stderr.strip() or res.stdout.strip()))
            os.remove(get_pip_path)
        self._emit_progress(100, "backend.runtimes.py_install_complete")
        self._emit_log("backend.runtimes.py_ready", "success", {"version": version})

    def install_python(self, version: str, install_pip: bool):
        python_dir = os.path.join(self.bin_dir, 'python')
        zip_path = os.path.join(self.bin_dir, f"python_{version}.zip")

        try:
            # 1. LOG INISIALISASI
            self._emit_log("backend.runtimes.py_install_start", "info", {"version": version})
            self._emit_progress(5, MSG_PREPARE_DL)

            zip_filename = f"python-{version}-embed-amd64.zip"
            download_url = f"https://www.python.org/ftp/python/{version}/{zip_filename}"

            # 2. FASE UNDUHAN (5% - 50%)
            log_cb, download_prog_cb = self._get_cbs(10, 60)

            if os.path.exists(python_dir): shutil.rmtree(python_dir, ignore_errors=True)
            os.makedirs(python_dir, exist_ok=True)

            log_cb(MSG_STARTING_BINARY_DOWNLOAD, "info", {"engine": "Python"})
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (50% - 75%)
            self._emit_log(MSG_DL_DONE, "info")
            self._emit_progress(55, "backend.runtimes.py_extracting")
            
            _, extract_prog_cb = self._get_cbs(65, 80)

            extract_archive(zip_path, python_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            self._finalize_python_install(python_dir, install_pip, version)
            return {"status": "success"}

        except Exception as e:
            return self._cleanup_failed_install(zip_path, e, "Python")

    def uninstall_python(self):
        python_dir = os.path.join(self.bin_dir, 'python')
        self.toggle_user_path('python', False)
        if os.path.exists(python_dir):
            shutil.rmtree(python_dir, ignore_errors=True)
        self._emit_log("backend.runtimes.py_uninstalled", "warn")
        return {"status": "success"}

    # ==========================================
    # JAVA (JDK) MANAGER
    # ==========================================
    def get_java_status(self):
        java_dir = os.path.join(self.bin_dir, 'java')
        java_exe = os.path.join(java_dir, 'bin', 'java.exe' if sys.platform == 'win32' else 'java')
        
        internal_installed = os.path.exists(java_exe)
        internal_version = ""
        if internal_installed:
            try:
                res = subprocess.run([java_exe, '-version'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                # Catatan: Java mencetak versinya di stderr, bukan stdout
                internal_version = res.stderr.strip().split('\n')[0]
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation('java')

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(os.path.join(java_dir, 'bin')),
            'external': external_info
        }
    
    def get_available_java_versions(self):
        """ Mengambil daftar rilis JDK yang tersedia dari Adoptium API """
        try:
            url = 'https://api.adoptium.net/v3/info/available_releases'
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                
                releases = data.get('available_releases', [])
                lts_releases = data.get('available_lts_releases', [])
                most_recent_lts = data.get('most_recent_lts', 0)
                
                formatted_versions = []
                # Urutkan dari versi terbaru ke terlama
                for v in sorted(releases, reverse=True):
                    if v >= 8:  # Kita batasi mulai dari Java 8 ke atas
                        is_lts = v in lts_releases
                        label = f"OpenJDK {v}"
                        if is_lts:
                            label += " (LTS)"
                        if v == most_recent_lts:
                            label += " - Latest Stable"
                            
                        formatted_versions.append({
                            'value': str(v),
                            'label': label,
                            'is_lts': is_lts
                        })
                        
                return {'status': 'success', 'data': formatted_versions}
        except Exception as e:
            return {'status': 'error', 'message': "backend.runtimes.java_fetch_failed", 'args': {"e": str(e)}}

    def install_java(self, version: str):
        java_dir = os.path.join(self.bin_dir, 'java')
        zip_path = os.path.join(self.bin_dir, f"java_{version}.zip")

        try:
            # 1. LOG INISIALISASI (0% - 5%)
            self._emit_log("backend.runtimes.java_install_start", "info", {"version": version})
            self._emit_progress(5, "backend.runtimes.java_init_adoptium")

            # URL API Adoptium
            download_url = f"https://api.adoptium.net/v3/binary/latest/{version}/ga/windows/x64/jdk/hotspot/normal/eclipse"

            # 2. FASE UNDUHAN (5% - 60%)
            log_cb, download_prog_cb = self._get_cbs(10, 60)

            if os.path.exists(java_dir): 
                shutil.rmtree(java_dir, ignore_errors=True)

            log_cb(MSG_STARTING_BINARY_DOWNLOAD, "info", {"engine": "Java"})
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 95%)
            self._emit_log(MSG_DL_DONE, "info")
            self._emit_progress(65, "backend.runtimes.java_extracting")
            
            _, extract_prog_cb = self._get_cbs(65, 95)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE FINALISASI (95% - 100%)
            self._emit_progress(95, "backend.runtimes.reorganizing_dir")

            extracted_folder = None
            for item in os.listdir(self.bin_dir):
                if item.startswith('jdk') and os.path.isdir(os.path.join(self.bin_dir, item)):
                    extracted_folder = os.path.join(self.bin_dir, item)
                    break
            
            if extracted_folder:
                os.rename(extracted_folder, java_dir)
            else:
                raise RuntimeError("Folder biner JDK tidak ditemukan setelah diekstrak.")

            # SUKSES
            self._emit_progress(100, "backend.runtimes.java_install_complete")
            self._emit_log("backend.runtimes.java_ready", "success", {"version": version})

            return {"status": "success"}

        except Exception as e:
            # PENANGANAN ERROR & PEMBERSIHAN
            # Sebelumnya hanya "except OSError" -- RuntimeError yang dilempar di atas
            # (folder JDK tidak ditemukan) tidak tertangkap dan crash keluar fungsi.
            if os.path.exists(zip_path):
                try: os.remove(zip_path)
                except OSError: pass

            self._emit_progress(-1, MSG_INSTALL_FAILED, {"e": str(e)})
            self._emit_log("backend.runtimes.java_install_error", "error", {"e": str(e)})

            return {"status": "error", "message": "backend.runtimes.java_install_error", "args": {"e": str(e)}}

    def uninstall_java(self):
        java_dir = os.path.join(self.bin_dir, 'java')
        self.toggle_user_path('java', False)
        if os.path.exists(java_dir):
            shutil.rmtree(java_dir, ignore_errors=True)
        self._emit_log("backend.runtimes.java_uninstalled", "warn")
        return {"status": "success"}
    
    # ==========================================
    # GO (GOLANG) MANAGER
    # ==========================================
    def get_go_status(self):
        go_dir = os.path.join(self.bin_dir, 'go')
        go_exe = os.path.join(go_dir, 'bin', 'go.exe' if sys.platform == 'win32' else 'go')
        
        internal_installed = os.path.exists(go_exe)
        internal_version = ""
        if internal_installed:
            try:
                res = subprocess.run([go_exe, 'version'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                # Output asli Go: "go version go1.22.3 windows/amd64", kita potong agar rapi
                internal_version = res.stdout.strip().replace('go version ', '').split(' ')[0]
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation('go')

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(os.path.join(go_dir, 'bin')),
            'external': external_info
        }
    
    def get_available_go_versions(self):
        """ Mengambil daftar versi Go dari repositori resmi """
        try:
            url = 'https://go.dev/dl/?mode=json'
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                
                versions = []
                # Ambil 10 rilis mayor/minor teratas agar tidak terlalu panjang
                for item in data[:10]:
                    ver_str = item['version'] # Contoh: "go1.22.3"
                    clean_ver = ver_str.replace('go', '')
                    label = f"Go {clean_ver}"
                    
                    if len(versions) == 0:
                        label += " (Latest Stable)"
                        
                    versions.append({
                        'value': clean_ver,
                        'label': label
                    })
                return {'status': 'success', 'data': versions}
        except Exception as e:
            # Ignore SonarQube urllib warning for now, using Exception is fine when bubbling to UI
            return {'status': 'error', 'message': "backend.runtimes.go_fetch_failed", 'args': {"e": str(e)}}

    def install_go(self, version: str):
        go_dir = os.path.join(self.bin_dir, 'go')
        zip_path = os.path.join(self.bin_dir, "go.zip")

        try:
            # 1. LOG INISIALISASI (0% - 10%)
            self._emit_log("backend.runtimes.go_install_start", "info")
            self._emit_progress(5, MSG_PREPARE_DL)

            # Jika user memilih 'latest', cari tahu versi aslinya
            if version == 'latest':
                self._emit_log("backend.runtimes.go_contact_api", "info")
                self._emit_progress(10, "backend.runtimes.go_search_stable")
                req = urllib.request.Request('https://go.dev/dl/?mode=json', headers={'User-Agent': USER_AGENT})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    version = data[0]['version'].replace('go', '')

            zip_filename = f"go{version}.windows-amd64.zip"
            download_url = f"https://go.dev/dl/{zip_filename}"

            # 2. FASE UNDUHAN (10% - 60%)
            log_cb, download_prog_cb = self._get_cbs(10, 60)

            if os.path.exists(go_dir): 
                shutil.rmtree(go_dir, ignore_errors=True)

            log_cb(MSG_STARTING_BINARY_DOWNLOAD, "info", {"engine": "Go"})
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 95%)
            self._emit_log(MSG_DL_DONE, "info")
            self._emit_progress(65, "backend.runtimes.go_extracting")
            
            _, extract_prog_cb = self._get_cbs(65, 95)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE FINALISASI
            self._emit_progress(100, "backend.runtimes.go_install_complete")
            self._emit_log("backend.runtimes.go_ready", "success", {"version": version})

            return {"status": "success"}

        except Exception as e:
            # PENANGANAN ERROR & PEMBERSIHAN
            # Konsisten dengan install_node/install_python/install_java: tangkap Exception
            # secara umum, bukan hanya OSError, agar error tak terduga tetap ter-handle rapi.
            if os.path.exists(zip_path):
                try: os.remove(zip_path)
                except OSError: pass

            self._emit_progress(-1, MSG_INSTALL_FAILED, {"e": str(e)})
            self._emit_log("backend.runtimes.go_install_error", "error", {"e": str(e)})

            return {"status": "error", "message": "backend.runtimes.go_install_error", "args": {"e": str(e)}}

    def uninstall_go(self):
        go_dir = os.path.join(self.bin_dir, 'go')
        self.toggle_user_path('go', False)
        if os.path.exists(go_dir):
            shutil.rmtree(go_dir, ignore_errors=True)
        self._emit_log("backend.runtimes.go_uninstalled", "warn")
        return {"status": "success"}

    def _check_via_where(self, command: str, vyloserve_bin: str) -> str | None:
        import os, sys, subprocess
        if sys.platform != 'win32': return None
        try:
            res = subprocess.run(['where', command], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
            if res.returncode == 0:
                for p in res.stdout.strip().split('\n'):
                    p_clean = os.path.normpath(p.strip())
                    if p_clean and vyloserve_bin not in p_clean.lower():
                        return p_clean
        except OSError: pass
        return None

    def _check_via_registry(self, command: str, vyloserve_bin: str) -> str | None:
        import sys, os, shutil
        if sys.platform != 'win32': return None
        import winreg
        raw_paths = []
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 0, winreg.KEY_READ) as key:
                sys_path, _ = winreg.QueryValueEx(key, 'Path')
                if sys_path: raw_paths.extend(sys_path.split(';'))
        except (OSError, winreg.error): pass
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_READ) as key:
                user_path, _ = winreg.QueryValueEx(key, 'Path')
                if user_path: raw_paths.extend(user_path.split(';'))
        except (OSError, winreg.error): pass
        clean_paths = []
        for p in raw_paths:
            p_clean = p.strip(' "\'')
            if p_clean:
                p_expanded = os.path.expandvars(p_clean)
                if vyloserve_bin not in os.path.normpath(p_expanded).lower():
                    clean_paths.append(p_expanded)
        return shutil.which(command, path=os.pathsep.join(clean_paths))

    def _check_via_env(self, command: str, vyloserve_bin: str) -> str | None:
        import os, sys, shutil
        if sys.platform == 'win32': return None
        env = os.environ.copy()
        clean_paths = [p for p in env.get('PATH', '').split(os.pathsep) if vyloserve_bin not in p.lower()]
        return shutil.which(command, path=os.pathsep.join(clean_paths))

