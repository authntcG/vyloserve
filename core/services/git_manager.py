import os
import sys
import shutil
from typing import Optional
import subprocess
import winreg
import ctypes
import urllib.request
import json
import re
import concurrent.futures

from core.utils.system_utils import get_project_root, run_silent_command
from core.utils.file_utils import download_advanced
GIT_EXE = "git.exe" if sys.platform == "win32" else "git"

class GitManager:
    """
    Manager terpusat untuk siklus hidup Git Version Control.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.bin_dir = os.path.join(self.root_dir, 'bin')
        os.makedirs(self.bin_dir, exist_ok=True)

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg)

    def _find_via_where(self, vyloserve_bin: str) -> Optional[str]:
        if sys.platform != 'win32': return None
        try:
            res = subprocess.run(['where', 'git'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
            if res.returncode == 0:
                for p in res.stdout.strip().split('\n'):
                    p_clean = os.path.normpath(p.strip())
                    if p_clean and vyloserve_bin not in p_clean.lower(): return p_clean
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

    def _validate_git_binary(self, found_path: str):
        try:
            is_windows_script = found_path.lower().endswith(('.cmd', '.bat'))
            creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            
            if is_windows_script:
                result = subprocess.run(f'"{found_path}" --version', capture_output=True, text=True, shell=True, creationflags=creation_flags)
            else:
                result = subprocess.run([found_path, '--version'], capture_output=True, text=True, creationflags=creation_flags)
            
            version_out = result.stdout.strip() or result.stderr.strip()
            
            if version_out:
                import re
                match = re.search(r'git version (\d+\.\d+\.\d+)', version_out)
                if match:
                    self._log("backend.git.found_external", "success", {"version": match.group(1), "path": found_path})
                    return {"exists": True, "version": match.group(1), "path": found_path}
        except Exception: pass
        return None

    # ==========================================
    # PENDETEKSI INSTALASI EKSTERNAL (4 LAPIS)
    # ==========================================
    def _check_external_installation(self):
        if hasattr(self, 'api'):
            self._log("backend.git.scanning_external", "info")

        vyloserve_bin = os.path.normpath(os.path.join(self.root_dir, 'bin')).lower()
        
        found_path = self._find_via_where(vyloserve_bin) or self._find_via_registry(vyloserve_bin) or self._find_via_hardcoded()

        if found_path:
            validated = self._validate_git_binary(found_path)
            if validated: return validated

        return {"exists": False, "version": "Unknown", "path": ""}

    def _is_in_user_path(self, target_path: str) -> bool:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_READ)
            path_value, _ = winreg.QueryValueEx(key, 'Path')
            winreg.CloseKey(key)
            paths = [p.lower().rstrip('\\/') for p in path_value.split(';') if p]
            return target_path.lower().rstrip('\\/') in paths
        except Exception: return False

    # ==========================================
    # CORE GIT API & INSTALASI
    # ==========================================
    def get_git_status(self):
        git_dir = os.path.join(self.bin_dir, 'git')
        git_exe = os.path.join(git_dir, 'cmd', GIT_EXE if sys.platform == 'win32' else 'git')
        
        internal_installed = os.path.exists(git_exe)
        internal_version = ""
        if internal_installed:
            try:
                res = subprocess.run([git_exe, '--version'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
                internal_version = res.stdout.strip().replace('git version ', '')
            except Exception: internal_version = "Unknown"

        external_info = self._check_external_installation()

        return {
            'installed': internal_installed, 
            'version': internal_version, 
            'in_path': self._is_in_user_path(os.path.join(git_dir, 'cmd')),
            'external': external_info
        }

    def get_available_git_versions(self):
        """ Web Scraper Pintar: Memindai rilis Git & Memvalidasi Biner Asli via HTTP HEAD """
        try:
            # Unduh kerangka utama HTML
            url = 'https://github.com/git-for-windows/git/releases/'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
            
            # Cari fragmen aset GitHub untuk mengekstrak Tag Rilis (Contoh: expanded_assets/v2.55.0.windows.4)
            # Metode ini kebal terhadap perubahan struktur div HTML.
            pattern = r'expanded_assets/([^"]+)'
            tags = re.findall(pattern, html)
            
            # Bersihkan duplikasi tapi tetap pertahankan urutan kronologis dari GitHub
            unique_tags = list(dict.fromkeys(tags))
            
            candidates = []
            for tag in unique_tags:
                # Rumus konversi GitHub Tag ke Filename Biner:
                # v2.55.0.windows.4 -> 2.55.0.4 -> PortableGit-2.55.0.4-64-bit.7z.exe
                clean_ver = tag.lstrip('v').replace('.windows.', '.')
                download_url = f"https://github.com/git-for-windows/git/releases/download/{tag}/PortableGit-{clean_ver}-64-bit.7z.exe"
                filename = f"PortableGit-{clean_ver}-64-bit.7z.exe"
                
                candidates.append({
                    'tag': tag,
                    'clean_ver': clean_ver,
                    'download_url': download_url,
                    'filename': filename
                })
                
            # VALIDASI PARALEL: Hanya sajikan file biner yang benar-benar ada (Menghindari Error 404)
            valid_results = []
            
            def check_binary(candidate):
                try:
                    # Request HEAD tidak mengunduh isi file, hanya mengecek status server dalam milidetik
                    head_req = urllib.request.Request(candidate['download_url'], method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
                    res = urllib.request.urlopen(head_req, timeout=4)
                    if res.status in [200, 301, 302]: # 302 Found (Redirect ke S3 Storage) artinya valid
                        return candidate
                except Exception: pass
                return None

            # Kita batasi pengecekan paralel maksimal 20 rilis terbaru agar hemat resource
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(check_binary, c) for c in candidates[:20]]
                for future in concurrent.futures.as_completed(futures):
                    res = future.result()
                    if res: valid_results.append(res)
                        
            if not valid_results:
                raise RuntimeError("Biner PortableGit 64-bit tidak ditemukan pada 20 rilis terbaru.")

            # Mengembalikan urutan asli sesuai rilis GitHub (karena as_completed bersifat acak)
            original_order = {tag: i for i, tag in enumerate(unique_tags)}
            valid_results.sort(key=lambda x: original_order[x['tag']])

            # Memformat JSON UI (Ambil 15 rilis teratas)
            results = []
            for i, v in enumerate(valid_results[:15]): 
                label = f"Git v{v['clean_ver']}"
                if i == 0: label += " (Latest Release)"
                    
                results.append({
                    'value': v['download_url'], 
                    'label': label,
                    'filename': v['filename'],
                    'version_text': v['clean_ver']
                })
                
            return {'status': 'success', 'data': results}
            
        except Exception:
            return {'status': 'error', 'message': "backend.git.fetch_failed"}

    def _extract_sfx(self, exe_path: str, git_dir: str):
        extraction_cmd = f'"{exe_path}" -y -o"{git_dir}"'
        creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        res = subprocess.run(extraction_cmd, shell=True, capture_output=True, creationflags=creation_flags)
        if res.returncode != 0:
            raise RuntimeError("Gagal mengekstrak PortableGit. File instalasi mungkin korup.")
        if os.path.exists(exe_path):
            os.remove(exe_path)

    def install_git(self, download_url: str, filename: str, version_text: str):
        git_dir = os.path.join(self.bin_dir, 'git')
        exe_path = os.path.join(self.bin_dir, filename)

        try:
            # 1. LOG INISIALISASI
            if hasattr(self, 'api'): 
                self._log("backend.git.install_start", "info", {"version": version_text})
                self._progress(5, "backend.git.preparing_download")

            # 2. FASE UNDUHAN
            def log_cb(msg, lvl="info"): 
                self._log(msg, lvl)
            def download_prog_cb(pct, msg):
                # download_advanced (core/utils/file_utils.py) mengirim persentase ABSOLUT
                # (0-100), bukan fraksi 0.0-1.0 -- lihat docs/known_bugs.md. Clamp ke jendela
                # aman sebelum fase ekstraksi mulai di 75% agar progress tidak meluber lalu
                # "melompat mundur".
                clamped_pct = max(5, min(pct, 74))
                self._progress(clamped_pct, msg)

            if os.path.exists(git_dir): shutil.rmtree(git_dir, ignore_errors=True)

            log_cb("Mulai mengunduh PortableGit dari GitHub...", "info")
            download_advanced(download_url, exe_path, log_cb=log_cb, progress_cb=download_prog_cb)

            # 3. FASE EKSTRAKSI SFX
            if hasattr(self, 'api'): 
                self._log("backend.git.download_complete_extracting", "info")
                self._progress(75, "backend.git.extracting_binary")
            
            self._extract_sfx(exe_path, git_dir)

            # 4. FINALISASI
            if hasattr(self, 'api'): 
                self._progress(100, "backend.git.install_complete")
                self._log("backend.git.ready_to_use", "success")
                
            return {"status": "success", "message": "backend.git.install_success"}

        except Exception as e:
            if os.path.exists(exe_path): 
                try: os.remove(exe_path)
                except Exception: pass
            if hasattr(self, 'api'):
                self._progress(-1, "backend.git.install_failed")
                self._log("backend.git.install_error", "error", {"e": str(e)})
            return {"status": "error", "message": str(e)}

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
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Environment', 0, winreg.KEY_ALL_ACCESS)
            try: path_value, _ = winreg.QueryValueEx(key, 'Path')
            except FileNotFoundError: path_value = ""

            current_paths = [p for p in path_value.split(';') if p]
            normalized_target = os.path.normpath(target_path)
            modified = False

            if enable and normalized_target not in current_paths:
                current_paths.append(normalized_target)
                modified = True
            elif not enable and normalized_target in current_paths:
                current_paths.remove(normalized_target)
                modified = True

            if modified:
                new_path = ';'.join(current_paths)
                winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, new_path)
                HWND_BROADCAST = 0xFFFF
                WM_SETTINGCHANGE = 0x001A
                SMTO_ABORTIFHUNG = 0x0002
                ctypes.windll.user32.SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0, 'Environment', SMTO_ABORTIFHUNG, 5000, ctypes.byref(ctypes.c_ulong()))
                
            winreg.CloseKey(key)
            self._log("backend.git.path_updated", "success")
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": "backend.git.registry_error", "args": {"e": str(e)}}
            
    # ==========================================
    # MANAJEMEN KONFIGURASI GIT (user.name / user.email)
    # ==========================================
    def get_git_config(self):
        """ Membaca konfigurasi global Git dari OS """
        git_dir = os.path.join(self.bin_dir, 'git')
        git_exe = os.path.join(git_dir, 'cmd', GIT_EXE if sys.platform == 'win32' else 'git')
        
        # Fallback ke git native OS jika VyloServe Git belum dipasang tapi native Git ada
        if not os.path.exists(git_exe):
            git_exe = 'git'
            
        try:
            cflags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
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
        git_dir = os.path.join(self.bin_dir, 'git')
        git_exe = os.path.join(git_dir, 'cmd', GIT_EXE if sys.platform == 'win32' else 'git')
        if not os.path.exists(git_exe): git_exe = 'git'

        try:
            cflags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            if name: subprocess.run([git_exe, 'config', '--global', 'user.name', name], creationflags=cflags)
            if email: subprocess.run([git_exe, 'config', '--global', 'user.email', email], creationflags=cflags)
            self._log("backend.git.config_updated", "success")
            return {"status": "success"}
        except Exception as e:
            self._log("backend.git.config_error", "error", {"e": str(e)})
            return {"status": "error", "message": str(e)}
