import os
import json
import re
import urllib.request
import subprocess

class ProjectManager:
    # Standarisasi: Hanya menerima api_ref
    def __init__(self, api_ref):
        self.api = api_ref
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        
        self.base_dir = os.path.join(root_dir, 'data')
        self.bin_dir = os.path.join(root_dir, 'bin') # Folder untuk menyimpan Composer
        
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)

        self.projects_file = os.path.join(self.base_dir, 'projects.json')
        self.hosts_file = r"C:\Windows\System32\drivers\etc\hosts"
        
        if not os.path.exists(self.projects_file):
            with open(self.projects_file, 'w') as f:
                json.dump([], f)
    
    def _ensure_php_extensions(self, php_version):
        php_dir = os.path.join(self.bin_dir, 'php', php_version)
        php_ini_path = os.path.join(php_dir, 'php.ini')
        ext_dir_path = os.path.join(php_dir, 'ext')

        # 1. AUTO-HEAL: Jika php.ini tidak ada, salin ulang dari template bawaan
        dev_ini = os.path.join(php_dir, 'php.ini-development')
        if not os.path.exists(php_ini_path):
            if os.path.exists(dev_ini):
                import shutil
                shutil.copy(dev_ini, php_ini_path)
            else:
                self.api.emit_log("Gagal mengonfigurasi PHP: php.ini-development tidak ditemukan.", "error")
                return False

        try:
            # 2. BACA FILE DAN BERSIHKAN DARI ERROR SEBELUMNYA
            with open(php_ini_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            clean_lines = []
            skip_mode = False
            required_exts = ['openssl', 'mbstring', 'fileinfo', 'curl', 'zip', 'pdo_mysql', 'pdo_sqlite']
            
            for line in lines:
                # Menghapus blok konfigurasi VyloServe lama yang mungkin rusak
                if "; --- VyloServe Auto Config ---" in line:
                    skip_mode = True
                if skip_mode and "; --- End VyloServe Config ---" in line:
                    skip_mode = False
                    continue
                
                if not skip_mode:
                    # Mencegah peringatan "Module already loaded" dengan menjadikan komentar 
                    # ekstensi yang akan kita kelola secara manual di bawah.
                    is_managed = False
                    for req_ext in required_exts:
                        if line.strip().startswith(f"extension={req_ext}") or line.strip().startswith(f"extension=php_{req_ext}.dll"):
                            clean_lines.append(f"; (VyloServe Managed) {line}")
                            is_managed = True
                            break
                    
                    if not is_managed:
                        clean_lines.append(line)

            content = "".join(clean_lines)

            # 3. SUNTIKKAN KONFIGURASI SUPER BERSIH DI PALING BAWAH
            ext_dir_unix = ext_dir_path.replace('\\', '/')
            auto_config = f"\n\n; --- VyloServe Auto Config ---\n"
            auto_config += f"extension_dir=\"{ext_dir_unix}\"\n"

            for ext in required_exts:
                dll_filename = f"php_{ext}.dll"
                dll_full_path = os.path.join(ext_dir_path, dll_filename)

                # Validasi fisik: Hanya tulis ekstensi jika file .dll BENAR-BENAR ada
                if os.path.exists(dll_full_path):
                    auto_config += f"extension={ext}\n"
                else:
                    self.api.emit_log(f"Warning: File fisik {dll_filename} tidak ada. Ekstensi {ext} dilewati.", "warn")

            auto_config += "; --- End VyloServe Config ---\n"

            # Simpan file yang sudah sehat
            with open(php_ini_path, 'w', encoding='utf-8') as f:
                f.write(content + auto_config)
                
            return True
            
        except Exception as e:
            self.api.emit_log(f"Gagal memodifikasi php.ini: {str(e)}", "error")
            return False
    
    def _read_projects(self):
        try:
            if not os.path.exists(self.projects_file):
                return []
            with open(self.projects_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            self.api.emit_log(f"Gagal membaca projects.json: {str(e)}", "error")
            return []
    
    def _save_projects(self, projects):
        try:
            with open(self.projects_file, 'w', encoding='utf-8') as f:
                json.dump(projects, f, indent=4)
        except Exception as e:
            if hasattr(self, 'api') and self.api:
                self.api.emit_log(f"Gagal menyimpan ke projects.json: {str(e)}", "error")

    # ---> 1. FITUR DETEKSI OTOMATIS (SMART DETECT) <---
    def detect_framework(self, directory):
        if not os.path.isdir(directory):
            return "raw"
            
        files = os.listdir(directory)
        
        if "artisan" in files and "composer.json" in files:
            return "laravel"
        if "spark" in files and "public" in files:
            return "codeigniter"
        if "wp-admin" in files or "wp-config-sample.php" in files:
            return "wordpress"
            
        return "raw"

    def _get_php_port_from_system(self, php_version):
        """
        Membaca port FastCGI langsung dari sistem manajemen PHP.
        Sebagai fallback jika payload dari frontend tidak memiliki informasi port.
        """
        try:
            # Coba panggil fungsi get_installed_php milik class Api utama
            if hasattr(self.api, 'get_installed_php'):
                php_response = self.api.get_installed_php()
                
                # Ekstrak data list (karena response bisa berupa dictionary {"data": [...]} atau list langsung)
                php_list = php_response.get('data', []) if isinstance(php_response, dict) else php_response
                
                for php in php_list:
                    if php.get('version') == php_version:
                        # Sesuaikan dengan key yang Anda gunakan ('port' atau 'fastcgi_port')
                        return int(php.get('port', php.get('fastcgi_port', 9000)))
                        
        except Exception as e:
            self.api.emit_log(f"Gagal membaca port asli untuk PHP {php_version}: {str(e)}", "warn")
            
        return 9000 # Fallback absolut

    # ---> 2. FITUR AUTO-INSTALL COMPOSER <---
    def _ensure_composer_exists(self):
        """Mengunduh composer.phar secara otomatis jika belum ada"""
        composer_dir = os.path.join(self.bin_dir, 'composer')
        if not os.path.exists(composer_dir):
            os.makedirs(composer_dir)
            
        composer_path = os.path.join(composer_dir, 'composer.phar')
        
        if not os.path.exists(composer_path):
            self.api.emit_log("Composer belum tersedia. Mengunduh composer.phar...", "warn")
            try:
                urllib.request.urlretrieve("https://getcomposer.org/download/latest-stable/composer.phar", composer_path)
                self.api.emit_log("Composer berhasil diunduh.", "success")
            except Exception as e:
                self.api.emit_log(f"Gagal mengunduh Composer: {str(e)}", "error")
                return None
        return composer_path

    def _rollback_dir(self, target_dir):
        """Menghapus folder proyek jika instalasi gagal di tengah jalan"""
        import shutil
        if os.path.exists(target_dir):
            if hasattr(self.api, "_window") and self.api._window:
                self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 100, text: 'Melakukan rollback instalasi...' }} }}))")
            self.api.emit_log(f"Instalasi gagal! Melakukan rollback (menghapus direktori: {target_dir})...", "warn")
            try:
                shutil.rmtree(target_dir, ignore_errors=True)
                self.api.emit_log("Rollback direktori berhasil dilakukan.", "info")
            except Exception as e:
                self.api.emit_log(f"Gagal menghapus folder saat rollback: {str(e)}", "error")

    # ---> 3. MESIN INSTALASI FRAMEWORK BARU <---
    def _install_new_framework(self, payload):
        framework = payload.get('framework')
        target_dir = os.path.join(payload.get('install_location'), payload.get('domain').split('.')[0])
        php_version = payload.get('php_version')
        specific_version = payload.get('specific_version', '').strip()
        
        php_exe = os.path.join(self.bin_dir, 'php', php_version, 'php.exe')
        if not os.path.exists(php_exe):
            return {"status": "error", "message": f"File php.exe untuk versi {php_version} tidak ditemukan."}

        if framework in ['laravel', 'codeigniter']:
            if hasattr(self.api, "_window") and self.api._window:
                self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 20, text: 'Mengonfigurasi PHP...' }} }}))")
            
            self._ensure_php_extensions(php_version)

            composer_phar = self._ensure_composer_exists()
            if not composer_phar:
                return {"status": "error", "message": "Composer gagal disiapkan."}

            # ==========================================================
            # LOGIKA PEMILIHAN VERSI (SMART ROUTING)
            # ==========================================================
            package = ""
            is_ci3 = False # Penanda apakah ini CI3 atau CI4
            
            if framework == 'laravel':
                package = 'laravel/laravel'
                if specific_version: package += f":{specific_version}"
                
            elif framework == 'codeigniter':
                php_parts = php_version.split('.')
                php_major = int(php_parts[0])
                php_minor = int(php_parts[1]) if len(php_parts) > 1 else 0

                if specific_version:
                    # Jika user mengetik versi manual, ikuti kemauan user
                    package = f"codeigniter4/appstarter:{specific_version}"
                else:
                    # Jika otomatis, baca dari dokumentasi resmi
                    if php_major > 8 or (php_major == 8 and php_minor >= 1):
                        # PHP 8.1 ke atas -> CodeIgniter 4 Terbaru
                        package = "codeigniter4/appstarter" 
                    else:
                        # PHP di bawah 8.1 (e.g. PHP 7.4) -> Turun ke CodeIgniter 3
                        package = "codeigniter/framework"
                        is_ci3 = True

            self.api.emit_log(f"Menjalankan instalasi {package} menggunakan PHP {php_version}...", "info")
            
            try:
                php_ini_path = os.path.join(self.bin_dir, 'php', php_version, 'php.ini')
                import copy
                custom_env = os.environ.copy()
                custom_env["COMPOSER_PROCESS_TIMEOUT"] = "2000"
                custom_env["COMPOSER_MAX_PARALLEL_HTTP"] = "1"
                
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 30, text: 'Membersihkan cache Composer...' }} }}))")
                
                try:
                    subprocess.run([php_exe, "-c", php_ini_path, composer_phar, "clear-cache"], env=custom_env, startupinfo=startupinfo)
                except Exception:
                    pass

                import re
                ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
                current_percent = 40.0 

                # ---> LANGKAH 1: UNDUH SKELETON SAJA (--no-install) <---
                self.api.emit_log("Mengunduh struktur dasar framework...", "info")
                cmd_create = [
                    php_exe, "-c", php_ini_path, composer_phar, 
                    "create-project", package, target_dir, 
                    "--prefer-dist", "--no-interaction", "--no-install", 
                    "--no-scripts" # <--- TAMBAHKAN INI
                ]
                
                process_create = subprocess.Popen(
                    cmd_create, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                    text=True, startupinfo=startupinfo, env=custom_env
                )
                
                for line in process_create.stdout:
                    clean_line = ansi_escape.sub('', line.strip())
                    if clean_line:
                        self.api.emit_log(f"[Composer] {clean_line}", "info")
                        if current_percent < 60.0: current_percent += 0.5
                        
                        safe_text = clean_line.replace("'", "\\'").replace('"', '\\"').replace('\n', '')[:62]
                        if hasattr(self.api, "_window") and self.api._window:
                            self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: {int(current_percent)}, text: 'Composer: {safe_text}' }} }}))")
                
                process_create.wait()
                if process_create.returncode != 0:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "Gagal mengunduh struktur dasar framework. Rollback selesai."}

                # ---> LANGKAH 1.5: MATIKAN SECURITY ADVISORY BLOCK (BYPASS) <---
                # Jika framework versi lama diinstal, Composer tidak akan nge-block proses karena CVE warning.
                self.api.emit_log("Menyesuaikan konfigurasi keamanan Composer lokal...", "info")
                try:
                    subprocess.run(
                        [php_exe, "-c", php_ini_path, composer_phar, "config", "policy.advisories.block", "false"], 
                        env=custom_env, cwd=target_dir, startupinfo=startupinfo
                    )
                except Exception as e:
                    self.api.emit_log(f"Peringatan konfigurasi: {str(e)}", "warn")

                # =======================================================================
                # ---> LANGKAH 2: HAPUS LOCK FILE DAN JALANKAN UPDATE (DENGAN AUTO-RETRY)
                # =======================================================================
                self.api.emit_log("Menyesuaikan dependensi framework dengan versi PHP lokal...", "info")
                
                max_retries = 3
                update_success = False
                
                for attempt in range(max_retries):
                    lock_file = os.path.join(target_dir, "composer.lock")
                    if os.path.exists(lock_file):
                        os.remove(lock_file)
                        
                    cmd_update = [
                        php_exe, "-c", php_ini_path, composer_phar, 
                        "update", "--no-interaction", "--prefer-dist",
                        "--no-scripts" # Mencegah eksekusi script sebelum env siap
                    ]
                    
                    # Berikan jeda waktu jika ini adalah percobaan ulang (Menunggu Antivirus melepas file)
                    if attempt > 0:
                        self.api.emit_log(f"Percobaan ke-{attempt+1} meracik vendor (Menunggu Antivirus/OS melepas file)...", "warn")
                        import time
                        time.sleep(3) 
                        
                    process_update = subprocess.Popen(
                        cmd_update, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                        text=True, startupinfo=startupinfo, env=custom_env, cwd=target_dir
                    )
                    
                    for line in process_update.stdout:
                        clean_line = ansi_escape.sub('', line.strip())
                        if clean_line:
                            self.api.emit_log(f"[Composer] {clean_line}", "info")
                            if current_percent < 95.0: current_percent += 0.5
                            
                            safe_text = clean_line.replace("'", "\\'").replace('"', '\\"').replace('\n', '')[:62]
                            if hasattr(self.api, "_window") and self.api._window:
                                self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: {int(current_percent)}, text: 'Instalasi Vendor: {safe_text}' }} }}))")

                    process_update.wait()
                    
                    # Jika berhasil (Return Code 0), langsung keluar dari Loop
                    if process_update.returncode == 0:
                        update_success = True
                        break 
                        
                # Jika setelah 3 kali percobaan tetap gagal
                if not update_success:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "Gagal meracik dependensi (Vendor) karena OS/Antivirus terus-menerus mengunci file. Rollback selesai."}

                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 100, text: 'Instalasi selesai sempurna!' }} }}))")
                
                self.api.emit_log("Menjalankan post-installation script framework...", "info")
                
                if framework == 'laravel':
                    env_example = os.path.join(target_dir, '.env.example')
                    env_file = os.path.join(target_dir, '.env')
                    
                    # 1. Salin .env.example ke .env
                    if os.path.exists(env_example) and not os.path.exists(env_file):
                        import shutil
                        shutil.copy(env_example, env_file)
                        self.api.emit_log("File .env Laravel berhasil dibuat.", "success")
                        
                    # 2. Generate Application Key (Wajib untuk Laravel)
                    self.api.emit_log("Men-generate Laravel APP_KEY...", "info")
                    try:
                        subprocess.run(
                            [php_exe, "-c", php_ini_path, "artisan", "key:generate"], 
                            cwd=target_dir, env=custom_env, startupinfo=startupinfo
                        )
                        self.api.emit_log("Laravel APP_KEY berhasil di-generate.", "success")
                    except Exception as e:
                        self.api.emit_log(f"Peringatan: Gagal generate key Laravel: {str(e)}", "warn")
                        
                elif framework == 'codeigniter' and not is_ci3:
                    # Otomatisasi untuk CodeIgniter 4
                    env_example = os.path.join(target_dir, 'env')
                    env_file = os.path.join(target_dir, '.env')
                    
                    if os.path.exists(env_example) and not os.path.exists(env_file):
                        import shutil
                        shutil.copy(env_example, env_file)
                        
                        # Ubah environment dari production ke development agar error terlihat
                        try:
                            with open(env_file, 'r', encoding='utf-8') as f:
                                env_content = f.read()
                            env_content = env_content.replace('# CI_ENVIRONMENT = production', 'CI_ENVIRONMENT = development')
                            with open(env_file, 'w', encoding='utf-8') as f:
                                f.write(env_content)
                            self.api.emit_log("File .env CodeIgniter berhasil dibuat dan di-set ke mode Development.", "success")
                        except Exception as e:
                            self.api.emit_log(f"Peringatan saat modifikasi .env CI4: {str(e)}", "warn")

                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 100, text: 'Instalasi selesai sempurna!' }} }}))")
                
                # ==========================================================
                # ASSIGN DOCUMENT ROOT BERDASARKAN JENIS FRAMEWORK
                # ==========================================================
                self.api.emit_log(f"Instalasi {framework.capitalize()} berhasil disesuaikan dengan PHP {php_version}!", "success")
                
                if is_ci3:
                    # CodeIgniter 3 tidak punya folder /public, jalankan di root folder
                    final_doc_root = target_dir.replace('\\', '/')
                else:
                    # CodeIgniter 4 dan Laravel menggunakan /public
                    final_doc_root = os.path.join(target_dir, "public").replace('\\', '/')
                    
                return {"status": "success", "document_root": final_doc_root}
                
            except Exception as e:
                import traceback
                self.api.emit_log(f"Error Eksekusi Composer: {traceback.format_exc()}", "error")
                return {"status": "error", "message": f"Gagal menjalankan Composer: {str(e)}"}
        
        elif framework == 'wordpress':
            import urllib.request
            import zipfile
            
            self.api.emit_log("Memulai instalasi WordPress (Download dari server resmi)...", "info")
            if hasattr(self.api, "_window") and self.api._window:
                self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 10, text: 'Menyiapkan direktori WordPress...' }} }}))")

            if not os.path.exists(target_dir):
                os.makedirs(target_dir)

            wp_url = "https://wordpress.org/latest.zip"
            zip_path = os.path.join(target_dir, "latest.zip")

            try:
                # 1. Mengunduh WordPress terbaru
                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 30, text: 'Mengunduh file inti WordPress (Tunggu sebentar)...' }} }}))")
                
                urllib.request.urlretrieve(wp_url, zip_path)

                # 2. Mengekstrak file ZIP
                self.api.emit_log("Mengekstrak arsip WordPress...", "info")
                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 70, text: 'Mengekstrak file WordPress...' }} }}))")

                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(target_dir)

                # 3. Merapikan Folder
                # WordPress secara default terekstrak ke dalam folder "wordpress/" (misal: target_dir/wordpress/wp-admin)
                # Kita harus memindahkan seluruh isinya ke target_dir (root folder proyek)
                wp_extracted_dir = os.path.join(target_dir, "wordpress")
                if os.path.exists(wp_extracted_dir):
                    import shutil
                    for item in os.listdir(wp_extracted_dir):
                        s = os.path.join(wp_extracted_dir, item)
                        d = os.path.join(target_dir, item)
                        shutil.move(s, d)
                    # Hapus folder "wordpress" yang sudah kosong
                    os.rmdir(wp_extracted_dir)

                # 4. Hapus file zip sisa unduhan
                if os.path.exists(zip_path):
                    os.remove(zip_path)

                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 100, text: 'Instalasi WordPress selesai!' }} }}))")

                self.api.emit_log("Instalasi WordPress berhasil!", "success")
                
                # Document Root WordPress adalah Root Folder proyek itu sendiri
                final_doc_root = target_dir.replace('\\', '/')
                return {"status": "success", "document_root": final_doc_root}

            except Exception as e:
                import traceback
                self.api.emit_log(f"Error Instalasi WordPress: {traceback.format_exc()}", "error")
                self._rollback_dir(target_dir)
                return {"status": "error", "message": f"Gagal menginstal WordPress: {str(e)}"}

        elif framework == 'raw':
            # Instalasi Proyek PHP Kosong (Raw)
            self.api.emit_log("Membuat proyek PHP murni (Raw)...", "info")
            if hasattr(self.api, "_window") and self.api._window:
                self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 50, text: 'Menyiapkan file awal...' }} }}))")
                
            try:
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)
                
                # Buat file index.php sederhana sebagai template awal
                index_file = os.path.join(target_dir, "index.php")
                with open(index_file, "w", encoding="utf-8") as f:
                    f.write("<?php\n\necho '<h1>Welcome to VyloServe</h1>';\n\n// Uncomment baris di bawah untuk melihat info PHP\n// phpinfo();\n")
                
                if hasattr(self.api, "_window") and self.api._window:
                    self.api._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{ detail: {{ percent: 100, text: 'Proyek PHP berhasil dibuat!' }} }}))")

                self.api.emit_log("Proyek PHP berhasil disiapkan!", "success")
                final_doc_root = target_dir.replace('\\', '/')
                return {"status": "success", "document_root": final_doc_root}
            
            except Exception as e:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": f"Gagal membuat proyek Raw: {str(e)}"}

    # ---> 4. LOGIKA UTAMA CREATE PROJECT <---
    def create_project(self, payload):
        try:
            domain_full = f"{payload.get('domain')}{payload.get('domain_extension')}"
            
            # Validasi domain ganda
            projects = self._read_projects()
            if any(p['domain'] == domain_full for p in projects):
                return {"status": "error", "message": f"Domain {domain_full} sudah digunakan."}
                
            final_doc_root = ""
            
            if payload.get('is_existing'):
                final_doc_root = payload.get('document_root')
            else:
                # Install framework baru
                install_result = self._install_new_framework(payload)
                if install_result['status'] == 'error':
                    return install_result
                final_doc_root = install_result['document_root']
                
            # ---> PERBAIKAN: Ambil port dari Payload atau Deteksi Sistem <---
            php_port = payload.get('php_port')
            
            # Jika React gagal mengirim port, lakukan deteksi langsung ke sistem PHP
            if not php_port:
                php_port = self._get_php_port_from_system(payload.get('php_version'))
                
            # Mulai proses penyimpanan ke database
            import time
            project_id = f"proj_{int(time.time())}_{payload.get('domain').replace('.', '_')}"
            
            # Simpan ke Database
            new_project = {
                "id": project_id,
                "name": payload.get('name'),
                "domain": domain_full,
                "path": final_doc_root,
                "php_version": payload.get('php_version'),
                "php_port": php_port,
                "framework": payload.get('framework', 'raw'),
                "host_synced": True # Asumsikan berhasil secara default
            }
            projects.append(new_project)
            self._save_projects(projects)
            
            # Sinkronisasi Apache Vhosts
            if hasattr(self, 'sync_apache_vhosts'):
                vhost_result = self.sync_apache_vhosts()
                if isinstance(vhost_result, dict) and vhost_result.get('status') == 'error':
                    self.api.emit_log(f"Peringatan Vhost: {vhost_result.get('message')}", "warn")
                    
            # ---> PERBAIKAN LOGIKA: BYPASS ERROR WINDOWS HOSTS <---
            warning_msg = None
            if hasattr(self, 'sync_windows_hosts'):
                hosts_result = self.sync_windows_hosts()
                
                # JIKA ERROR (Akses Ditolak karena tidak Run as Administrator)
                if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error':
                    self.api.emit_log(f"Peringatan Hosts: {hosts_result.get('message')}", "warn")
                    
                    # Ubah status host_synced menjadi False pada file JSON
                    for p in projects:
                        if p['id'] == project_id:
                            p['host_synced'] = False
                            break
                    self._save_projects(projects)
                    
                    # Siapkan pesan peringatan (Instalasi tetap dianggap sukses)
                    warning_msg = "Proyek berhasil diinstal, tetapi gagal menambahkan domain ke file Hosts Windows (Akses Ditolak). Harap restart aplikasi sebagai Administrator lalu klik 'Sync Windows Host'."
            
            # Restart Apache
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'):
                self.api.emit_log("Merestart Apache untuk menerapkan konfigurasi baru...", "info")
                self.api.apache.restart_server() 
                
            if warning_msg:
                # Return success dengan membawa warning message
                return {"status": "success", "message": warning_msg}
            else:
                return {"status": "success", "message": f"Proyek {domain_full} berhasil disiapkan!"}

        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            self.api.emit_log(f"CRITICAL ERROR di create_project: {error_trace}", "error")
            return {"status": "error", "message": f"Terjadi kesalahan internal pada Python: {str(e)}"}

    # ---> SISTEM ELEGAN UNTUK FILE HOSTS WINDOWS <---
    def sync_windows_hosts(self):
        """
        Menyinkronkan domain lokal ke file C:\Windows\System32\drivers\etc\hosts.
        Jika gagal karena butuh hak akses, akan memunculkan Pop-Up UAC Administrator secara otomatis.
        """
        import os
        import ctypes
        import tempfile

        hosts_path = r"C:\Windows\System32\drivers\etc\hosts"
        
        try:
            # 1. Baca isi file hosts asli Windows
            with open(hosts_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # 2. Bersihkan konfigurasi VyloServe yang lama (jika ada)
            clean_lines = []
            skip = False
            for line in lines:
                if "# --- BEGIN VYLOSERVE HOSTS ---" in line:
                    skip = True
                if not skip:
                    clean_lines.append(line)
                if "# --- END VYLOSERVE HOSTS ---" in line:
                    skip = False
                    continue

            # 3. Susun konfigurasi routing domain yang baru dari database
            projects = self._read_projects()
            new_hosts_block = "\n# --- BEGIN VYLOSERVE HOSTS ---\n"
            has_domains = False
            for p in projects:
                if p.get('domain'):
                    new_hosts_block += f"127.0.0.1 {p['domain']}\n"
                    has_domains = True
            new_hosts_block += "# --- END VYLOSERVE HOSTS ---\n"

            final_content = "".join(clean_lines)
            if has_domains:
                final_content += new_hosts_block

            # 4. Tulis konten final ke file Temp (di C:\Users\User\AppData\Local\Temp)
            # Folder ini selalu memiliki izin read/write tanpa perlu Administrator
            temp_dir = tempfile.gettempdir()
            temp_file = os.path.join(temp_dir, 'vyloserve_hosts_temp.txt')
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(final_content)

            # 5. Coba menimpa file Hosts secara langsung 
            # (Berhasil jika kebetulan user sudah membuka VyloServe via Run as Administrator)
            try:
                with open(hosts_path, 'w', encoding='utf-8') as f:
                    f.write(final_content)
                return {"status": "success", "message": "Berhasil mengupdate Windows Hosts."}
                
            except PermissionError:
                # =========================================================
                # 6. TRIGGER UAC PROMPT ADMINISTRATOR!
                # =========================================================
                self.api.emit_log("Meminta akses Administrator via UAC untuk menimpa file Hosts...", "info")
                
                # Perintah Windows CMD untuk menyalin (menimpa) file Temp ke lokasi Hosts asli
                command = f'/c copy /Y "{temp_file}" "{hosts_path}"'
                
                # Menjalankan perintah dengan verb "runas" untuk mentrigger UAC
                # Parameter 0 di akhir berarti SW_HIDE (Jendela CMD berwarna hitam tidak akan terlihat oleh user)
                result = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", command, None, 0)
                
                # Berdasarkan dokumentasi Windows API, jika result > 32, eksekusi berhasil dijalankan
                if result > 32:
                    return {"status": "success", "message": "Akses diberikan! File Hosts berhasil diperbarui."}
                else:
                    return {"status": "error", "message": "Sistem membatalkan karena Anda menolak izin Administrator (UAC)."}
                    
        except Exception as e:
            return {"status": "error", "message": f"Error saat membaca/menulis Hosts: {str(e)}"}

    # ---> GENERATOR APACHE VIRTUAL HOST <---
    def sync_apache_vhosts(self):
        """Menghasilkan file konfigurasi Virtual Host Apache dengan Deteksi Dinamis"""
        import os
        try:
            projects = self._read_projects()
            
            # 1. AUTO-HEALING: Deteksi path Apache secara langsung, lupakan file .txt
            if not hasattr(self.api, 'apache'):
                return {"status": "error", "message": "Modul API Apache tidak termuat."}
                
            status = self.api.apache.get_status()
            if not status.get("installed") or not status.get("path"):
                return {"status": "error", "message": "Apache belum terinstal."}
                
            apache_dir = status["path"]
            extra_dir = os.path.join(apache_dir, 'conf', 'extra')
            os.makedirs(extra_dir, exist_ok=True)
            
            vhosts_file = os.path.join(extra_dir, 'vyloserve-vhosts.conf')
            
            # 2. RANGKAI VHOST MURNI
            vhost_content = "# --- VYLOSERVE AUTO-GENERATED VHOSTS ---\n\n"
            
            for p in projects:
                domain = p.get('domain')
                doc_root = str(p.get('path', '')).replace('\\', '/') 
                
                saved_port = p.get('php_port')
                php_version = p.get('php_version')
                
                # Sinkronisasi port
                actual_port = self._get_php_port_from_system(php_version)
                php_port = actual_port if actual_port else (saved_port or 9000)
                
                if php_port != saved_port:
                    p['php_port'] = php_port
                    self._save_projects(projects)
                
                # 3. ARSITEKTUR BERSIH (Tanpa GENERIC, Tanpa //./)
                # ---> ARSITEKTUR VHOST THE HOLY GRAIL <---
                fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:{php_port}/"
    </FilesMatch>"""

                # 1. BLOK HTTP BIASA (PORT 80)
                vhost_content += f"""<VirtualHost *:80>
    ServerName {domain}
    DocumentRoot "{doc_root}"
    
    DirectoryIndex index.php index.html
    
    <Directory "{doc_root}">
        Options Indexes FollowSymLinks ExecCGI
        AllowOverride All
        Require all granted
    </Directory>
{fcgi_block}
</VirtualHost>\n\n"""

                # 2. BLOK HTTPS AMAN (PORT 443)
                if hasattr(self.api, 'ssl'):
                    try:
                        domain_crt, domain_key = self.api.ssl.generate_domain_cert(domain)
                        crt_safe = domain_crt.replace('\\', '/')
                        key_safe = domain_key.replace('\\', '/')
                        
                        vhost_content += f"""<VirtualHost *:443>
    ServerName {domain}
    DocumentRoot "{doc_root}"
    
    SSLEngine on
    SSLCertificateFile "{crt_safe}"
    SSLCertificateKeyFile "{key_safe}"
    
    DirectoryIndex index.php index.html
    
    <Directory "{doc_root}">
        Options Indexes FollowSymLinks ExecCGI
        AllowOverride All
        Require all granted
    </Directory>
{fcgi_block}
</VirtualHost>\n\n"""
                    except Exception as ssl_err:
                        self.api.emit_log(f"Gagal memuat SSL untuk {domain}: {ssl_err}", "warn")

            with open(vhosts_file, 'w', encoding='utf-8') as f:
                f.write(vhost_content)

            return {"status": "success", "message": "Konfigurasi VHosts berhasil ditulis ulang."}
            
        except Exception as e:
            self.api.emit_log(f"Gagal mensinkronkan Vhosts: {str(e)}", "error")
            return {"status": "error", "message": str(e)}
    
    def get_projects(self):
        """Mengambil seluruh data proyek untuk ditampilkan di UI Frontend"""
        try:
            projects = self._read_projects()
            # Pembersihan fallback untuk proyek lama yang mungkin belum punya atribut pretty_url_synced
            for p in projects:
                if 'pretty_url_synced' not in p:
                    p['pretty_url_synced'] = True if p.get('framework', 'raw') == 'raw' else False
                    
            return {"status": "success", "data": projects}
        except Exception as e:
            self.api.emit_log(f"Gagal memuat daftar proyek: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def delete_project(self, project_id, delete_files=False):
        """Menghapus proyek dari Virtual Host beserta opsi hapus file fisik"""
        try:
            projects = self._read_projects()
            project_to_delete = next((p for p in projects if p['id'] == project_id), None)
            
            if not project_to_delete:
                return {"status": "error", "message": "Data proyek tidak ditemukan di database."}
            
            # 1. Simpan salinan sementara daftar proyek tanpa proyek yang dihapus
            new_projects = [p for p in projects if p['id'] != project_id]
            self._save_projects(new_projects)
            
            # 2. Sinkronisasi Hosts (Memicu pop-up UAC Windows)
            if hasattr(self, 'sync_windows_hosts'):
                hosts_result = self.sync_windows_hosts()
                # Jika UAC Dibatalkan atau Akses Ditolak
                if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error':
                    self._save_projects(projects) # ROLLBACK! Kembalikan proyek ke file JSON
                    return {"status": "error", "message": "Proses dibatalkan: Akses Administrator (UAC) ditolak."}
            
            # 3. Sinkronisasi ulang Apache VHost (Aman dilakukan setelah UAC sukses)
            if hasattr(self, 'sync_apache_vhosts'):
                self.sync_apache_vhosts()
            
            # Restart Apache
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'):
                self.api.apache.restart_server()
                
            # 4. FITUR BARU: Hapus File Fisik jika opsi dicentang
            if delete_files:
                doc_root = project_to_delete.get('path', '')
                if doc_root:
                    import shutil
                    # Mundur ke root folder jika doc_root mengarah ke /public (Laravel/CI)
                    base_path = doc_root.replace('/public', '').replace('\\public', '')
                    if os.path.exists(base_path):
                        shutil.rmtree(base_path, ignore_errors=True)
                
            self.api.emit_log(f"Proyek {project_to_delete['domain']} berhasil dihapus.", "info")
            return {"status": "success", "message": f"Virtual Host {project_to_delete['domain']} telah dihapus."}
            
        except Exception as e:
            self._save_projects(projects) # Rollback darurat jika ada error kode
            self.api.emit_log(f"Gagal menghapus proyek: {str(e)}", "error")
            return {"status": "error", "message": f"Terjadi kesalahan saat menghapus: {str(e)}"}

    def sync_pretty_url(self, project_id):
        """Membuat/menimpa file .htaccess agar routing framework berjalan sempurna & Force HTTPS"""
        try:
            projects = self._read_projects()
            project = next((p for p in projects if p['id'] == project_id), None)
            
            if not project:
                return {"status": "error", "message": "Proyek tidak ditemukan."}
            
            doc_root = project.get('path')
            framework = project.get('framework', 'raw')
            
            if not os.path.exists(doc_root):
                return {"status": "error", "message": "Direktori proyek tidak ditemukan."}
                
            htaccess_path = os.path.join(doc_root, '.htaccess')
            
            # Template Standar Industri dengan tambahan Force HTTPS
            force_https_rule = """
    # Force HTTPS (VyloServe)
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
"""
            content = ""
            if framework == 'laravel':
                content = f"""<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>
    RewriteEngine On{force_https_rule}
    RewriteCond %{'{HTTP:Authorization}'} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{'{HTTP:Authorization}'}]
    RewriteCond %{'{REQUEST_FILENAME}'} !-d
    RewriteCond %{'{REQUEST_URI}'} (.+)/$
    RewriteRule ^ %1 [L,R=301]
    RewriteCond %{'{REQUEST_FILENAME}'} !-d
    RewriteCond %{'{REQUEST_FILENAME}'} !-f
    RewriteRule ^ index.php [L]
</IfModule>"""
            elif framework == 'codeigniter':
                content = f"""<IfModule mod_rewrite.c>
    RewriteEngine On{force_https_rule}
    RewriteCond %{'{REQUEST_FILENAME}'} !-f
    RewriteCond %{'{REQUEST_FILENAME}'} !-d
    RewriteRule ^(.*)$ index.php/$1 [L]
</IfModule>"""
            elif framework == 'wordpress':
                content = f"""<IfModule mod_rewrite.c>
    RewriteEngine On{force_https_rule}
</IfModule>
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{'{HTTP:Authorization}'}]
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{'{REQUEST_FILENAME}'} !-f
RewriteCond %{'{REQUEST_FILENAME}'} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress"""
            else:
                content = f"<IfModule mod_rewrite.c>\n    RewriteEngine On{force_https_rule}\n</IfModule>"

            with open(htaccess_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            project['pretty_url_synced'] = True
            self._save_projects(projects)
            
            self.api.emit_log(f"File .htaccess berhasil digenerate dengan HTTPS untuk {project['domain']}", "success")
            return {"status": "success", "message": "Pretty URL & HTTPS berhasil dikonfigurasi!"}
            
        except Exception as e:
            self.api.emit_log(f"Gagal sinkronisasi Pretty URL: {str(e)}", "error")
            return {"status": "error", "message": str(e)}

    def open_in_explorer(self, path):
        """Membuka folder Document Root secara langsung di Windows File Explorer"""
        try:
            # Gunakan os.path.normpath untuk memastikan format slash benar (C:\...)
            normalized_path = os.path.normpath(path)
            if os.path.exists(normalized_path):
                os.startfile(normalized_path)
                return {"status": "success"}
            else:
                return {"status": "error", "message": "Direktori sudah tidak ada atau telah dipindahkan."}
        except Exception as e:
            return {"status": "error", "message": f"Gagal membuka explorer: {str(e)}"}
    
    def retry_sync_host(self, project_id):
        """Mencoba ulang sinkronisasi file Windows Hosts yang tertunda"""
        try:
            if hasattr(self, 'sync_windows_hosts'):
                hosts_result = self.sync_windows_hosts()
                # Jika masih error (user belum run as administrator)
                if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error':
                    return hosts_result 
            
            # Jika kali ini berhasil, update JSON
            projects = self._read_projects()
            for p in projects:
                if p['id'] == project_id:
                    p['host_synced'] = True
                    break
            self._save_projects(projects)
            
            return {"status": "success", "message": "Berhasil menyinkronkan domain ke file Windows Hosts!"}
        except Exception as e:
            return {"status": "error", "message": f"Gagal menyinkronkan: {str(e)}"}
    
    def update_project(self, payload):
        """Memperbarui pengaturan proyek (Nama & Versi PHP) dan meregenerasi setup server"""
        try:
            project_id = payload.get('id')
            new_name = payload.get('name')
            new_php_version = payload.get('php_version')

            projects = self._read_projects()
            project = next((p for p in projects if p['id'] == project_id), None)

            if not project:
                return {"status": "error", "message": "Data proyek tidak ditemukan di database."}

            # 1. Update Nama Proyek
            if new_name:
                project['name'] = new_name
            
            # 2. Update Versi PHP & Port FastCGI
            if new_php_version and project.get('php_version') != new_php_version:
                project['php_version'] = new_php_version
                
                # Mengambil port FastCGI yang baru sesuai versi PHP yang dipilih
                new_port = self._get_php_port_from_system(new_php_version)
                project['php_port'] = new_port
                self.api.emit_log(f"Versi PHP untuk {project['domain']} diubah ke {new_php_version} (Port: {new_port})", "info")

            # 3. Simpan perubahan ke JSON
            self._save_projects(projects)

            # 4. Sinkronisasi ulang file VHost Apache dengan port baru
            if hasattr(self, 'sync_apache_vhosts'):
                self.sync_apache_vhosts()

            # 5. Restart Apache untuk menerapkan rute VHost baru
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'):
                self.api.emit_log("Merestart Apache untuk menerapkan konfigurasi proyek...", "info")
                self.api.apache.restart_server()

            return {"status": "success", "message": "Pengaturan proyek berhasil disimpan!"}
            
        except Exception as e:
            self.api.emit_log(f"Gagal memperbarui proyek: {str(e)}", "error")
            return {"status": "error", "message": f"Terjadi kesalahan saat menyimpan: {str(e)}"}