import os
import sys
import urllib.request
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
        if hasattr(self, 'api'):
            self.api.emit_log(f"Memindai instalasi eksternal untuk engine '{command}'...", "info")

        vyloserve_bin = os.path.normpath(os.path.join(self.root_dir, 'bin')).lower()
        found_path = None

        # =========================================================
        # TAHAP 1: MENGGUNAKAN PERINTAH 'where' WINDOWS
        # =========================================================
        if sys.platform == 'win32':
            try:
                res = subprocess.run(['where', command], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
                if res.returncode == 0:
                    paths = res.stdout.strip().split('\n')
                    for p in paths:
                        p_clean = os.path.normpath(p.strip())
                        if p_clean and vyloserve_bin not in p_clean.lower():
                            found_path = p_clean
                            break
            except Exception:
                pass

        # =========================================================
        # TAHAP 2: PEMINDAIAN REGISTRY LANGSUNG
        # =========================================================
        if not found_path and sys.platform == 'win32':
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
                
                if vyloserve_bin not in os.path.normpath(p_expanded).lower():
                    clean_paths.append(p_expanded)
            
            fresh_path_env = os.pathsep.join(clean_paths)
            found_path = shutil.which(command, path=fresh_path_env)

        # =========================================================
        # TAHAP 3: FALLBACK UNTUK MAC/LINUX
        # =========================================================
        if not found_path and sys.platform != 'win32':
            env = os.environ.copy()
            clean_paths = [p for p in env.get('PATH', '').split(os.pathsep) if vyloserve_bin not in p.lower()]
            found_path = shutil.which(command, path=os.pathsep.join(clean_paths))

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
                
                if hasattr(self, 'api'):
                    self.api.emit_log(f"Instalasi eksternal {command} ({final_version}) terdeteksi pada sistem.", "warn")
                    
                return {"exists": True, "path": found_path, "version": final_version}
                
        except Exception:
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

    def toggle_user_path(self, engine: str, enable: bool):
        """ Mengatur PATH untuk engine tertentu """
        paths_to_toggle = []
        
        if engine == 'node':
            paths_to_toggle = [os.path.join(self.bin_dir, 'node')]
        elif engine == 'python':
            paths_to_toggle = [
                os.path.join(self.bin_dir, 'python'),
                os.path.join(self.bin_dir, 'python', 'Scripts')
            ]
        elif engine == 'java':
            paths_to_toggle = [os.path.join(self.bin_dir, 'java', 'bin')]
        elif engine == 'go':
            paths_to_toggle = [os.path.join(self.bin_dir, 'go', 'bin')]
        else:
            return {"status": "error", "message": "Engine tidak didukung."}

        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_ALL_ACCESS)
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

            # Khusus Java, kita juga set variabel JAVA_HOME
            if engine == 'java':
                java_home = os.path.normpath(os.path.join(self.bin_dir, 'java'))
                if enable:
                    winreg.SetValueEx(key, 'JAVA_HOME', 0, winreg.REG_SZ, java_home)
                    modified = True
                else:
                    try:
                        winreg.DeleteValue(key, 'JAVA_HOME')
                        modified = True
                    except: pass

            if modified:
                new_path = ';'.join(current_paths)
                winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, new_path)
                
                # FIX: Menggunakan SendMessageTimeoutW agar tidak hang jika ada aplikasi Windows yang macet
                HWND_BROADCAST = 0xFFFF
                WM_SETTINGCHANGE = 0x001A
                SMTO_ABORTIFHUNG = 0x0002
                ctypes.windll.user32.SendMessageTimeoutW(
                    HWND_BROADCAST, 
                    WM_SETTINGCHANGE, 
                    0, 
                    'Environment', 
                    SMTO_ABORTIFHUNG, 
                    5000, # Timeout 5 detik
                    ctypes.byref(ctypes.c_ulong())
                )
                
            winreg.CloseKey(key)
            if hasattr(self, 'api'): self.api.emit_log(f"Global PATH {engine.upper()} diperbarui.", "success")
            return {"status": "success"}
        except Exception as e:
            if hasattr(self, 'api'): self.api.emit_log(f"Gagal mengatur PATH {engine}: {str(e)}", "error")
            return {"status": "error", "message": f"Registry Error: {str(e)}"}

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
            except: internal_version = "Unknown"

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
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
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
            return {'status': 'error', 'message': f"Gagal mengambil versi Node.js: {str(e)}"}

    def install_node(self, version: str, enable_corepack: bool):
        node_dir = os.path.join(self.bin_dir, 'node')
        zip_path = os.path.join(self.bin_dir, f"node_{version}.zip")

        try:
            # 1. LOG INISIALISASI
            if hasattr(self, 'api'):
                self.api.emit_log(f"Memulai instalasi Node.js v{version}...", "info")
                self.api.emit_progress(5, "Mempersiapkan pengunduhan...")

            zip_filename = f"node-v{version}-win-x64.zip"
            download_url = f"https://nodejs.org/dist/v{version}/{zip_filename}"

            # 2. FASE UNDUHAN (5% - 60%)
            def log_cb(msg, lvl="info"): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def download_prog_cb(pct, msg): 
                scaled_pct = 5 + int(pct * 0.55)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            if os.path.exists(node_dir): shutil.rmtree(node_dir, ignore_errors=True)

            log_cb("Mulai mengunduh binary Node.js dari peladen resmi...", "info")
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 85%)
            if hasattr(self, 'api'): 
                self.api.emit_log("Unduhan selesai. Memulai proses ekstraksi arsip...", "info")
                self.api.emit_progress(65, "Mengekstrak Node.js...")
            
            def extract_prog_cb(pct, msg):
                scaled_pct = 65 + int(pct * 0.20)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE FINALISASI (85% - 100%)
            if hasattr(self, 'api'):
                self.api.emit_progress(85, "Menata ulang struktur direktori...")

            extracted_folder = os.path.join(self.bin_dir, zip_filename.replace('.zip', ''))
            os.rename(extracted_folder, node_dir)

            if enable_corepack:
                if hasattr(self, 'api'): 
                    self.api.emit_progress(90, "Mengaktifkan dukungan Yarn & pnpm (Corepack)...")
                corepack_cmd = os.path.join(node_dir, 'corepack.cmd' if sys.platform == 'win32' else 'corepack')
                if os.path.exists(corepack_cmd):
                    run_silent_command([corepack_cmd, 'enable'], cwd=node_dir)

            if hasattr(self, 'api'): 
                self.api.emit_progress(100, "Instalasi Node.js Selesai!")
                self.api.emit_log(f"Node.js v{version} berhasil diinstal dan siap digunakan.", "success")
            
            return {"status": "success"}

        except Exception as e:
            if os.path.exists(zip_path): 
                try: os.remove(zip_path)
                except: pass
            if hasattr(self, 'api'):
                self.api.emit_progress(-1, f"Instalasi Gagal: {str(e)}")
                self.api.emit_log(f"Gagal memasang Node.js: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def uninstall_node(self):
        node_dir = os.path.join(self.bin_dir, 'node')
        self.toggle_user_path('node', False)
        if os.path.exists(node_dir):
            shutil.rmtree(node_dir, ignore_errors=True)
        if hasattr(self, 'api'): self.api.emit_log("Node.js berhasil dihapus dari sistem.", "warn")
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
            except: internal_version = "Unknown"

        external_info = self._check_external_installation('python')

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(python_dir),
            'external': external_info
        }

    def get_available_python_versions(self):
        """ Web Scraper Pintar: Memindai & memvalidasi ketersediaan biner Windows """
        import re
        import urllib.request
        try:
            # 1. Ambil daftar direktori utama dari FTP Python
            req = urllib.request.Request("https://www.python.org/ftp/python/", headers={'User-Agent': 'Mozilla/5.0'})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
            
            # Ekstrak seluruh tautan berformat href="3.x.y/"
            matches = set(re.findall(r'href="(3\.\d+\.\d+)/"', html))
            
            # 2. Kelompokkan berdasarkan 'Minor' dan 'Patch' (Gunakan INT, bukan FLOAT!)
            version_dict = {}
            for v in matches:
                parts = v.split('.')
                minor = int(parts[1])
                patch = int(parts[2])
                
                # Batasi penyajian untuk versi 3.8 ke atas
                if minor >= 8: 
                    if minor not in version_dict:
                        version_dict[minor] = []
                    version_dict[minor].append(patch)
            
            valid_versions = []
            
            # 3. Urutkan minor secara descending (cth: 13, 12, 11, 10, 9, 8)
            sorted_minors = sorted(version_dict.keys(), reverse=True)
            
            # Helper Pintar: Validasi eksistensi file ZIP dengan metode HEAD (Sangat Cepat)
            def check_binary_exists(minor_val, patch_val):
                version_str = f"3.{minor_val}.{patch_val}"
                zip_url = f"https://www.python.org/ftp/python/{version_str}/python-{version_str}-embed-amd64.zip"
                try:
                    head_req = urllib.request.Request(zip_url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
                    res = urllib.request.urlopen(head_req, timeout=3)
                    return res.status == 200
                except:
                    return False

            # 4. Filter dan Pindai Biner (Hanya cari 1 patch tertinggi yang valid per versi minor)
            for minor in sorted_minors:
                # Urutkan patch dari yang tertinggi ke terendah
                sorted_patches = sorted(version_dict[minor], reverse=True)
                
                for patch in sorted_patches:
                    if check_binary_exists(minor, patch):
                        # Jika file ZIP biner ditemukan, simpan dan langsung lompat ke versi minor berikutnya
                        valid_versions.append(f"3.{minor}.{patch}")
                        break 

            # 5. Format JSON untuk Dropdown Antarmuka React
            results = []
            for i, v in enumerate(valid_versions):
                label = f"Python {v}"
                if i == 0:
                    label += " (Latest Stable)"
                results.append({'value': v, 'label': label})
                
            return {'status': 'success', 'data': results}
            
        except Exception as e:
            return {'status': 'error', 'message': f"Gagal mengambil versi Python: {str(e)}"}

    def install_python(self, version: str, install_pip: bool):
        python_dir = os.path.join(self.bin_dir, 'python')
        zip_path = os.path.join(self.bin_dir, f"python_{version}.zip")

        try:
            # 1. LOG INISIALISASI
            if hasattr(self, 'api'): 
                self.api.emit_log(f"Memulai instalasi Python {version} (Embeddable)...", "info")
                self.api.emit_progress(5, "Mempersiapkan pengunduhan...")

            zip_filename = f"python-{version}-embed-amd64.zip"
            download_url = f"https://www.python.org/ftp/python/{version}/{zip_filename}"

            # 2. FASE UNDUHAN (5% - 50%)
            def log_cb(msg, lvl="info"): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
            def download_prog_cb(pct, msg): 
                scaled_pct = 5 + int(pct * 0.45) 
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            if os.path.exists(python_dir): shutil.rmtree(python_dir, ignore_errors=True)
            os.makedirs(python_dir, exist_ok=True)

            log_cb("Mulai mengunduh binary Python dari peladen resmi...", "info")
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (50% - 75%)
            if hasattr(self, 'api'): 
                self.api.emit_log("Unduhan selesai. Memulai proses ekstraksi arsip...", "info")
                self.api.emit_progress(55, "Mengekstrak Python Embeddable...")
            
            def extract_prog_cb(pct, msg):
                scaled_pct = 50 + int(pct * 0.25)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            extract_archive(zip_path, python_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE PIP & FINALISASI (75% - 100%)
            if install_pip:
                if hasattr(self, 'api'): 
                    self.api.emit_log("Membuka kunci dukungan paket (import site)...", "info")
                    self.api.emit_progress(80, "Mengonfigurasi environment...")
                
                pth_file = next((f for f in os.listdir(python_dir) if f.endswith('._pth')), None)
                if pth_file:
                    pth_path = os.path.join(python_dir, pth_file)
                    with open(pth_path, 'r') as f: content = f.read()
                    with open(pth_path, 'w') as f: f.write(content.replace('#import site', 'import site'))

                if hasattr(self, 'api'): 
                    self.api.emit_log("Mengunduh & Menginstal pip...", "info")
                    self.api.emit_progress(85, "Menyiapkan package manager...")
                
                get_pip_url = "https://bootstrap.pypa.io/get-pip.py"
                get_pip_path = os.path.join(python_dir, 'get-pip.py')
                urllib.request.urlretrieve(get_pip_url, get_pip_path)
                
                python_exe = os.path.join(python_dir, 'python.exe')
                run_silent_command([python_exe, get_pip_path], cwd=python_dir)
                os.remove(get_pip_path)

            if hasattr(self, 'api'): 
                self.api.emit_progress(100, "Instalasi Python Selesai!")
                self.api.emit_log(f"Python {version} berhasil diinstal dan siap digunakan.", "success")
            return {"status": "success"}

        except Exception as e:
            if os.path.exists(zip_path): 
                try: os.remove(zip_path)
                except: pass
            if hasattr(self, 'api'):
                self.api.emit_progress(-1, f"Instalasi Gagal: {str(e)}")
                self.api.emit_log(f"Gagal memasang Python: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def uninstall_python(self):
        python_dir = os.path.join(self.bin_dir, 'python')
        self.toggle_user_path('python', False)
        if os.path.exists(python_dir):
            shutil.rmtree(python_dir, ignore_errors=True)
        if hasattr(self, 'api'): self.api.emit_log("Python berhasil dihapus dari sistem.", "warn")
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
            except: internal_version = "Unknown"

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
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
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
            return {'status': 'error', 'message': f"Gagal mengambil daftar versi Java: {str(e)}"}

    def install_java(self, version: str):
        java_dir = os.path.join(self.bin_dir, 'java')
        zip_path = os.path.join(self.bin_dir, f"java_{version}.zip")

        try:
            # 1. LOG INISIALISASI (0% - 5%)
            if hasattr(self, 'api'):
                self.api.emit_log(f"Memulai instalasi OpenJDK {version} (Eclipse Temurin)...", "info")
                self.api.emit_progress(5, "Menginisialisasi pengunduhan dari Adoptium API...")

            # URL API Adoptium
            download_url = f"https://api.adoptium.net/v3/binary/latest/{version}/ga/windows/x64/jdk/hotspot/normal/eclipse"

            # 2. FASE UNDUHAN (5% - 60%)
            def log_cb(msg, lvl="info"): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
                
            def download_prog_cb(pct, msg): 
                # Skala progres download di 5% hingga 60%
                scaled_pct = 5 + int(pct * 0.55)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            if os.path.exists(java_dir): 
                shutil.rmtree(java_dir, ignore_errors=True)

            log_cb(f"Mulai mengunduh binary Java dari peladen resmi...", "info")
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 95%)
            if hasattr(self, 'api'): 
                self.api.emit_log("Unduhan selesai. Memulai proses ekstraksi arsip...", "info")
                self.api.emit_progress(65, "Mengekstrak Java Development Kit...")
            
            def extract_prog_cb(pct, msg):
                # Skala progres ekstraksi di 65% hingga 95%
                scaled_pct = 65 + int(pct * 0.30)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE FINALISASI (95% - 100%)
            if hasattr(self, 'api'):
                self.api.emit_progress(95, "Menata ulang struktur direktori...")

            # Cari folder hasil ekstrak (biasanya bernama jdk-21.x.x+x)
            extracted_folder = None
            for item in os.listdir(self.bin_dir):
                if item.startswith('jdk-') and os.path.isdir(os.path.join(self.bin_dir, item)):
                    extracted_folder = os.path.join(self.bin_dir, item)
                    break
            
            if extracted_folder:
                os.rename(extracted_folder, java_dir)
            else:
                raise Exception("Folder biner JDK tidak ditemukan setelah diekstrak.")

            # SUKSES
            if hasattr(self, 'api'): 
                self.api.emit_progress(100, "Instalasi Java Selesai!")
                self.api.emit_log(f"Java JDK {version} berhasil diinstal dan siap digunakan.", "success")
                
            return {"status": "success"}

        except Exception as e:
            # PENANGANAN ERROR & PEMBERSIHAN
            if os.path.exists(zip_path): 
                try: os.remove(zip_path)
                except: pass
                
            if hasattr(self, 'api'):
                self.api.emit_progress(-1, f"Instalasi Gagal: {str(e)}")
                self.api.emit_log(f"Gagal menginstal Java JDK: {str(e)}", "error")
                
            return {"status": "error", "message": str(e)}

    def uninstall_java(self):
        java_dir = os.path.join(self.bin_dir, 'java')
        self.toggle_user_path('java', False)
        if os.path.exists(java_dir):
            shutil.rmtree(java_dir, ignore_errors=True)
        if hasattr(self, 'api'): self.api.emit_log("Java JDK berhasil dihapus dari sistem.", "warn")
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
            except: internal_version = "Unknown"

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
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
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
            return {'status': 'error', 'message': f"Gagal mengambil versi Go: {str(e)}"}

    def install_go(self, version: str):
        go_dir = os.path.join(self.bin_dir, 'go')
        zip_path = os.path.join(self.bin_dir, "go.zip")

        try:
            # 1. LOG INISIALISASI (0% - 10%)
            if hasattr(self, 'api'): 
                self.api.emit_log(f"Memulai persiapan instalasi Go Compiler...", "info")
                self.api.emit_progress(5, "Mempersiapkan pengunduhan...")
            
            # Jika user memilih 'latest', cari tahu versi aslinya
            if version == 'latest':
                if hasattr(self, 'api'): 
                    self.api.emit_log("Menghubungi API Go Dev untuk resolusi rilis terbaru...", "info")
                    self.api.emit_progress(10, "Mencari rilis Go stabil terbaru...")
                req = urllib.request.Request('https://go.dev/dl/?mode=json', headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    version = data[0]['version'].replace('go', '')

            zip_filename = f"go{version}.windows-amd64.zip"
            download_url = f"https://go.dev/dl/{zip_filename}"

            # 2. FASE UNDUHAN (10% - 60%)
            def log_cb(msg, lvl="info"): 
                if hasattr(self, 'api'): self.api.emit_log(msg, lvl)
                
            def download_prog_cb(pct, msg): 
                # Skala progres download di 10% hingga 60%
                scaled_pct = 10 + int(pct * 0.50)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            if os.path.exists(go_dir): 
                shutil.rmtree(go_dir, ignore_errors=True)

            log_cb(f"Mulai mengunduh binary Go (v{version})...", "info")
            download_advanced(download_url, zip_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI (60% - 95%)
            if hasattr(self, 'api'): 
                self.api.emit_log("Unduhan selesai. Memulai proses ekstraksi arsip...", "info")
                self.api.emit_progress(65, "Mengekstrak file biner Go Compiler...")
            
            def extract_prog_cb(pct, msg):
                # Skala progres ekstraksi di 65% hingga 95%
                scaled_pct = 65 + int(pct * 0.30)
                if hasattr(self, 'api'): self.api.emit_progress(scaled_pct, msg)

            extract_archive(zip_path, self.bin_dir, progress_cb=extract_prog_cb)
            
            if os.path.exists(zip_path):
                os.remove(zip_path)

            # 4. FASE FINALISASI
            if hasattr(self, 'api'): 
                self.api.emit_progress(100, "Instalasi Go Selesai!")
                self.api.emit_log(f"Go v{version} berhasil diinstal dan siap digunakan.", "success")
                
            return {"status": "success"}

        except Exception as e:
            # PENANGANAN ERROR & PEMBERSIHAN
            if os.path.exists(zip_path): 
                try: os.remove(zip_path)
                except: pass
                
            if hasattr(self, 'api'):
                self.api.emit_progress(-1, f"Instalasi Gagal: {str(e)}")
                self.api.emit_log(f"Gagal menginstal Go Compiler: {str(e)}", "error")
                
            return {"status": "error", "message": str(e)}

    def uninstall_go(self):
        go_dir = os.path.join(self.bin_dir, 'go')
        self.toggle_user_path('go', False)
        if os.path.exists(go_dir):
            shutil.rmtree(go_dir, ignore_errors=True)
        if hasattr(self, 'api'): self.api.emit_log("Go Compiler berhasil dihapus dari sistem.", "warn")
        return {"status": "success"}