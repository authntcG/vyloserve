import os
import re
import urllib.request
import subprocess
import ctypes
import tempfile
import time
from typing import Optional

from core.utils.system_utils import get_project_root, get_silent_flags
from core.utils.file_utils import read_json, write_json

class ProjectManager:
    """Manager untuk setup Virtual Host, Auto-Framework, dan .htaccess"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'data')
        self.bin_dir = os.path.join(get_project_root(), 'bin') 
        
        os.makedirs(self.base_dir, exist_ok=True)
        self.projects_file = os.path.join(self.base_dir, 'projects.json')
        if not os.path.exists(self.projects_file): write_json(self.projects_file, [])

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg)
    
    def _read_projects(self):
        return read_json(self.projects_file, list)
    
    def _save_projects(self, projects):
        if not write_json(self.projects_file, projects) and hasattr(self, 'api'):
            self._log("backend.project.save_json_failed", "error")

    def detect_framework(self, directory: str) -> str:
        if not os.path.isdir(directory): return "raw"
        files = os.listdir(directory)
        if "artisan" in files and "composer.json" in files: return "laravel"
        if "spark" in files and "public" in files: return "codeigniter"
        if "wp-admin" in files or "wp-config-sample.php" in files: return "wordpress"
        return "raw"

    def _get_php_port_from_system(self, php_version: str) -> int:
        try:
            if hasattr(self.api, 'get_installed_php'):
                php_response = self.api.get_installed_php()
                php_list = php_response.get('data', []) if isinstance(php_response, dict) else php_response
                for php in php_list:
                    if php.get('version') == php_version:
                        return int(php.get('port', php.get('fastcgi_port', 9000)))
        except Exception as e:
            self._log("backend.project.read_php_port_failed", "warn", {"e": str(e)})
        return 9000

    def _ensure_composer_exists(self) -> Optional[str]:
        composer_dir = os.path.join(self.bin_dir, 'composer')
        os.makedirs(composer_dir, exist_ok=True)
        composer_path = os.path.join(composer_dir, 'composer.phar')
        
        if not os.path.exists(composer_path):
            self._log("backend.project.downloading_composer", "warn")
            try:
                urllib.request.urlretrieve("https://getcomposer.org/download/latest-stable/composer.phar", composer_path)
                self._log("backend.project.composer_download_success", "success")
            except Exception as e:
                self._log("backend.project.composer_download_failed", "error", {"e": str(e)})
                return None
        return composer_path

    def _rollback_dir(self, target_dir: str):
        import shutil
        if os.path.exists(target_dir):
            self._progress(100, "backend.project.rolling_back")
            self._log("backend.project.install_failed_rollback", "warn", {"target_dir": target_dir})
            shutil.rmtree(target_dir, ignore_errors=True)

    def _determine_framework_package(self, framework: str, specific_version: str, php_version: str) -> tuple[str, bool]:
        if framework == 'laravel':
            return f"laravel/laravel:{specific_version}" if specific_version else "laravel/laravel", False
        elif framework == 'codeigniter':
            php_major = int(php_version.split('.')[0])
            php_minor = int(php_version.split('.')[1]) if len(php_version.split('.')) > 1 else 0
            if specific_version: 
                return f"codeigniter4/appstarter:{specific_version}", False
            if php_major > 8 or (php_major == 8 and php_minor >= 1): 
                return "codeigniter4/appstarter", False
            return "codeigniter/framework", True
        return "", False

    def _stream_composer_output(self, process, current_percent: float, max_percent: float, prefix: str, ansi_escape: re.Pattern) -> tuple[float, str]:
        error_log = ""
        for line in process.stdout:
            clean_line = ansi_escape.sub('', line.strip())
            if clean_line:
                error_log += clean_line + " "
                self._log("backend.project.composer_log", "info", {"line": clean_line})
                if current_percent < max_percent: current_percent += 0.5
                self._progress(int(current_percent), f"{prefix}: {clean_line[:62]}")
        return current_percent, error_log

    def _run_composer_update_with_retries(self, php_exe: str, php_ini_path: str, composer_phar: str, target_dir: str, custom_env: dict, cflags: int, current_percent: float, ansi_escape: re.Pattern) -> bool:
        self._log("backend.project.adjusting_dependencies", "info")
        for attempt in range(3):
            lock_file = os.path.join(target_dir, "composer.lock")
            if os.path.exists(lock_file): os.remove(lock_file)
                
            if attempt > 0: time.sleep(3) 
                
            process_update = subprocess.Popen(
                [php_exe, "-c", php_ini_path, composer_phar, "update", "--no-interaction", "--prefer-dist", "--no-scripts"], 
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=custom_env, cwd=target_dir, creationflags=cflags
            )
            
            current_percent, _ = self._stream_composer_output(process_update, current_percent, 95.0, 'Instalasi Vendor', ansi_escape)

            process_update.wait()
            if process_update.returncode == 0:
                return True
            self._log("backend.project.retry_update", "warn", {"attempt": attempt + 1})
        return False

    def _run_composer_create_project(self, php_exe: str, php_ini_path: str, composer_phar: str, package: str, target_dir: str, custom_env: dict, cflags: int, current_percent: float, ansi_escape: re.Pattern) -> tuple[bool, str]:
        # Hapus Folder Jika Sudah Ada (Mencegah Error "Directory is not empty")
        if os.path.exists(target_dir):
            import shutil
            shutil.rmtree(target_dir, ignore_errors=True)

        self._log("backend.project.downloading_framework", "info")
        process_create = subprocess.Popen(
            [php_exe, "-c", php_ini_path, composer_phar, "create-project", package, target_dir, "--prefer-dist", "--no-interaction", "--no-install", "--no-scripts"], 
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=custom_env, creationflags=cflags
        )
        
        current_percent, error_log = self._stream_composer_output(process_create, current_percent, 60.0, 'Composer', ansi_escape)
        
        process_create.wait()
        return process_create.returncode == 0, error_log


    def _run_framework_post_install(self, framework: str, target_dir: str, php_exe: str, php_ini_path: str, custom_env: dict, cflags: int, is_ci3: bool):
        self._log("backend.project.running_post_install", "info")
        import shutil
        if framework == 'laravel':
            if os.path.exists(os.path.join(target_dir, '.env.example')) and not os.path.exists(os.path.join(target_dir, '.env')):
                shutil.copy(os.path.join(target_dir, '.env.example'), os.path.join(target_dir, '.env'))
            try: subprocess.run([php_exe, "-c", php_ini_path, "artisan", "key:generate"], cwd=target_dir, env=custom_env, creationflags=cflags)
            except Exception: pass
        elif framework == 'codeigniter' and not is_ci3:
            if os.path.exists(os.path.join(target_dir, 'env')) and not os.path.exists(os.path.join(target_dir, '.env')):
                shutil.copy(os.path.join(target_dir, 'env'), os.path.join(target_dir, '.env'))
                try:
                    with open(os.path.join(target_dir, '.env'), 'r', encoding='utf-8') as f: env_content = f.read()
                    with open(os.path.join(target_dir, '.env'), 'w', encoding='utf-8') as f: f.write(env_content.replace('# CI_ENVIRONMENT = production', 'CI_ENVIRONMENT = development'))
                except Exception: pass

    def _install_wordpress(self, target_dir: str) -> dict:
        import zipfile
        self._log("backend.project.installing_wp", "info")
        os.makedirs(target_dir, exist_ok=True)
        zip_path = os.path.join(target_dir, "latest.zip")
        try:
            urllib.request.urlretrieve("https://wordpress.org/latest.zip", zip_path)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref: zip_ref.extractall(target_dir)

            wp_extracted_dir = os.path.join(target_dir, "wordpress")
            if os.path.exists(wp_extracted_dir):
                import shutil
                for item in os.listdir(wp_extracted_dir): shutil.move(os.path.join(wp_extracted_dir, item), os.path.join(target_dir, item))
                os.rmdir(wp_extracted_dir)

            if os.path.exists(zip_path): os.remove(zip_path)
            self._log("backend.project.wp_install_success", "success")
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": "backend.project.wp_install_failed", "args": {"e": str(e)}}

    def _install_raw_project(self, target_dir: str) -> dict:
        self._log("backend.project.creating_raw_php", "info")
        try:
            os.makedirs(target_dir, exist_ok=True)
            with open(os.path.join(target_dir, "index.php"), "w", encoding="utf-8") as f:
                f.write("<?php\n\necho '<h1>Welcome to VyloServe</h1>';\n\n// phpinfo();\n")
            self._log("backend.project.raw_php_success", "success")
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": "backend.project.raw_php_failed", "args": {"e": str(e)}}

    def _install_composer_framework(self, framework: str, target_dir: str, php_version: str, specific_version: str, php_exe: str) -> dict:
        self._progress(20, "backend.project.configuring_php")

        composer_phar = self._ensure_composer_exists()
        if not composer_phar: return {"status": "error", "message": "backend.project.composer_failed"}

        package, is_ci3 = self._determine_framework_package(framework, specific_version, php_version)
        self._log("backend.project.installing_package", "info", {"package": package, "php_version": php_version})
        
        try:
            php_ini_path = os.path.join(self.bin_dir, 'php', php_version, 'php.ini')
            custom_env = os.environ.copy()
            custom_env.update({"COMPOSER_PROCESS_TIMEOUT": "2000", "COMPOSER_MAX_PARALLEL_HTTP": "1"})
            cflags = get_silent_flags()

            try: subprocess.run([php_exe, "-c", php_ini_path, composer_phar, "clear-cache"], env=custom_env, creationflags=cflags)
            except Exception: pass

            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            current_percent = 40.0 

            success_create, error_log = self._run_composer_create_project(php_exe, php_ini_path, composer_phar, package, target_dir, custom_env, cflags, current_percent, ansi_escape)
            
            if not success_create:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": "backend.project.framework_download_failed", "args": {"error": error_log[:150]}}

            try: subprocess.run([php_exe, "-c", php_ini_path, composer_phar, "config", "policy.advisories.block", "false"], env=custom_env, cwd=target_dir, creationflags=cflags)
            except Exception: pass

            update_success = self._run_composer_update_with_retries(php_exe, php_ini_path, composer_phar, target_dir, custom_env, cflags, current_percent, ansi_escape) 
                    
            if not update_success:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": "backend.project.dependency_failed"}

            self._run_framework_post_install(framework, target_dir, php_exe, php_ini_path, custom_env, cflags, is_ci3)

            self._progress(100, "backend.project.install_complete_perfect")
            self._log("backend.project.framework_install_success", "success", {"framework": framework.capitalize()})
            return {"status": "success", "document_root": target_dir.replace('\\', '/') if is_ci3 else os.path.join(target_dir, "public").replace('\\', '/')}
            
        except Exception as e:
            return {"status": "error", "message": "backend.project.composer_run_failed", "args": {"e": str(e)}}

    def _install_new_framework(self, payload: dict):
        framework = payload.get('framework')
        target_dir = os.path.join(payload.get('install_location'), payload.get('domain').split('.')[0])
        php_version = payload.get('php_version')
        specific_version = payload.get('specific_version', '').strip()
        
        php_exe = os.path.join(self.bin_dir, 'php', php_version, 'php.exe')
        if not os.path.exists(php_exe):
            return {"status": "error", "message": "backend.project.php_exe_not_found", "args": {"php_version": php_version}}

        if framework in ['laravel', 'codeigniter']:
            return self._install_composer_framework(framework, target_dir, php_version, specific_version, php_exe)
        elif framework == 'wordpress':
            return self._install_wordpress(target_dir)
        elif framework == 'raw':
            return self._install_raw_project(target_dir)

    def _sync_hosts_for_project(self, projects: list, project_id: str) -> Optional[str]:
        if not hasattr(self, 'sync_windows_hosts'): return None
        hosts_result = self.sync_windows_hosts()
        if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error':
            for p in projects:
                if p['id'] == project_id:
                    p['host_synced'] = False
                    break
            self._save_projects(projects)
            return "backend.project.hosts_uac_warning"
        return None

    def _write_hosts_with_uac(self, hosts_path: str, final_content: str, temp_file: str):
        try:
            with open(hosts_path, 'w', encoding='utf-8') as f: f.write(final_content)
            return {"status": "success", "message": "backend.project.hosts_updated"}
        except PermissionError:
            self._log("backend.project.request_uac", "info")
            result = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", f'/c copy /Y "{temp_file}" "{hosts_path}"', None, 0)
            if result > 32: return {"status": "success", "message": "backend.project.uac_granted"}
            else: return {"status": "error", "message": "backend.project.uac_denied"}

    def create_project(self, payload: dict):
        try:
            domain_full = f"{payload.get('domain')}{payload.get('domain_extension')}"
            projects = self._read_projects()
            
            if any(p['domain'] == domain_full for p in projects):
                return {"status": "error", "message": "backend.project.domain_used", "args": {"domain": domain_full}}
                
            if payload.get('is_existing'):
                final_doc_root = payload.get('document_root')
            else:
                install_result = self._install_new_framework(payload)
                if install_result['status'] == 'error': return install_result
                final_doc_root = install_result['document_root']
                
            php_port = payload.get('php_port') or self._get_php_port_from_system(payload.get('php_version'))
            project_id = f"proj_{int(time.time())}_{payload.get('domain').replace('.', '_')}"
            
            projects.append({
                "id": project_id, "name": payload.get('name'), "domain": domain_full, "path": final_doc_root,
                "php_version": payload.get('php_version'), "php_port": php_port, "framework": payload.get('framework', 'raw'),
                "host_synced": True
            })
            self._save_projects(projects)
            
            if hasattr(self, 'sync_apache_vhosts'): self.sync_apache_vhosts()
            warning_msg = self._sync_hosts_for_project(projects, project_id)
            
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'):
                if self.api.apache.check_is_running():
                    self.api.apache.restart_server() 
                
            if warning_msg:
                return {"status": "success", "message": warning_msg}
            return {"status": "success", "message": "backend.project.project_ready", "args": {"domain": domain_full}}

        except Exception as e:
            self._log("backend.project.critical_error", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def sync_windows_hosts(self):
        hosts_path = r"C:\Windows\System32\drivers\etc\hosts"
        try:
            with open(hosts_path, 'r', encoding='utf-8') as f: lines = f.readlines()
            
            clean_lines, skip = [], False
            for line in lines:
                if "# --- BEGIN VYLOSERVE HOSTS ---" in line: skip = True
                if not skip: clean_lines.append(line)
                if "# --- END VYLOSERVE HOSTS ---" in line: skip = False; continue

            projects = self._read_projects()
            new_hosts_block = "\n# --- BEGIN VYLOSERVE HOSTS ---\n"
            has_domains = False
            for p in projects:
                if p.get('domain'):
                    new_hosts_block += f"127.0.0.1 {p['domain']}\n"; has_domains = True
            new_hosts_block += "# --- END VYLOSERVE HOSTS ---\n"

            final_content = "".join(clean_lines) + (new_hosts_block if has_domains else "")

            temp_file = os.path.join(tempfile.gettempdir(), 'vyloserve_hosts_temp.txt')
            with open(temp_file, 'w', encoding='utf-8') as f: f.write(final_content)

            return self._write_hosts_with_uac(hosts_path, final_content, temp_file)
        except Exception as e:
            return {"status": "error", "message": "backend.project.hosts_error", "args": {"e": str(e)}}

    def _generate_vhost_block(self, p: dict, projects: list) -> str:
        domain = p.get('domain')
        doc_root = str(p.get('path', '')).replace('\\', '/') 
        saved_port, php_version = p.get('php_port'), p.get('php_version')
        
        if not doc_root.rstrip('/').endswith('public'):
            public_dir = os.path.join(doc_root, "public").replace('\\', '/')
            if os.path.exists(public_dir) and os.path.isdir(public_dir):
                doc_root = public_dir
                self._log("backend.project.smart_routing", "info", {"domain": domain})
        
        php_port = self._get_php_port_from_system(php_version) or saved_port or 9000
        if php_port != saved_port:
            p['php_port'] = php_port
            self._save_projects(projects)
        
        fcgi_block = f"""
    ProxyFCGIBackendType GENERIC
    ProxyFCGISetEnvIf "reqenv('SCRIPT_FILENAME') =~ m#^/?(.*)$#" SCRIPT_FILENAME "$1"
    <FilesMatch "\\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:{php_port}/"
    </FilesMatch>"""

        vhost = f"<VirtualHost *:80>\n    ServerName {domain}\n    DocumentRoot \"{doc_root}\"\n    DirectoryIndex index.php index.html\n    <Directory \"{doc_root}\">\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n"

        if hasattr(self.api, 'ssl'):
            try:
                domain_crt, domain_key = self.api.ssl.generate_domain_cert(domain)
                vhost += f"<VirtualHost *:443>\n    ServerName {domain}\n    DocumentRoot \"{doc_root}\"\n    SSLEngine on\n    SSLCertificateFile \"{domain_crt.replace(chr(92), '/')}\"\n    SSLCertificateKeyFile \"{domain_key.replace(chr(92), '/')}\"\n    DirectoryIndex index.php index.html\n    <Directory \"{doc_root}\">\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n"
            except Exception: pass
            
        return vhost

    def sync_apache_vhosts(self):
        try:
            projects = self._read_projects()
            if not hasattr(self.api, 'apache'): return {"status": "error", "message": "backend.project.apache_not_loaded"}

            status = self.api.apache.get_status()
            if not status.get("installed"): return {"status": "error", "message": "backend.project.apache_not_installed"}
                
            extra_dir = os.path.join(status["path"], 'conf', 'extra')
            os.makedirs(extra_dir, exist_ok=True)
            vhosts_file = os.path.join(extra_dir, 'vyloserve-vhosts.conf')
            
            vhost_content = "# --- VYLOSERVE AUTO-GENERATED VHOSTS ---\n\n"
            for p in projects:
                vhost_content += self._generate_vhost_block(p, projects)

            with open(vhosts_file, 'w', encoding='utf-8') as f: f.write(vhost_content)
            return {"status": "success", "message": "backend.project.vhosts_written"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
    
    def get_projects(self):
        try:
            projects = self._read_projects()
            for p in projects:
                if 'pretty_url_synced' not in p: p['pretty_url_synced'] = p.get('framework', 'raw') == 'raw'
            return {"status": "success", "data": projects}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def _delete_ssl_cert(self, domain: str):
        if hasattr(self.api, 'ssl'):
            try: self.api.ssl.delete_domain_cert(domain)
            except Exception: pass

    def delete_project(self, project_id: str, delete_files: bool = False):
        try:
            projects = self._read_projects()
            project_to_delete = next((p for p in projects if p['id'] == project_id), None)
            if not project_to_delete: return {"status": "error", "message": "backend.project.project_not_found"}
            
            self._delete_ssl_cert(project_to_delete['domain'])
            
            self._save_projects([p for p in projects if p['id'] != project_id])
            
            if hasattr(self, 'sync_windows_hosts'):
                hosts_result = self.sync_windows_hosts()
                if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error':
                    self._save_projects(projects) # Rollback
                    return {"status": "error", "message": "backend.project.cancelled_uac_denied"}
            
            if hasattr(self, 'sync_apache_vhosts'): self.sync_apache_vhosts()
            
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'):
                if self.api.apache.check_is_running():
                    self.api.apache.restart_server() 
            
            if delete_files and 'path' in project_to_delete:
                import shutil
                base_path = project_to_delete['path'].replace('/public', '').replace('\\public', '')
                if os.path.exists(base_path): shutil.rmtree(base_path, ignore_errors=True)
                
            self._log("backend.project.project_deleted", "info", {"domain": project_to_delete['domain']})
            return {"status": "success", "message": "backend.project.project_deleted"}
        except Exception as e:
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def retry_sync_host(self, project_id: str):
        try:
            if hasattr(self, 'sync_windows_hosts'):
                hosts_result = self.sync_windows_hosts()
                if isinstance(hosts_result, dict) and hosts_result.get('status') == 'error': return hosts_result 
            
            projects = self._read_projects()
            for p in projects:
                if p['id'] == project_id: p['host_synced'] = True; break
            self._save_projects(projects)
            
            return {"status": "success", "message": "backend.project.domain_synced"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def open_in_explorer(self, path: str):
        try:
            norm_path = os.path.normpath(path)
            if os.path.exists(norm_path):
                os.startfile(norm_path)
                return {"status": "success"}
            return {"status": "error", "message": "backend.project.dir_not_found"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

    def update_project(self, payload: dict):
        try:
            project_id, new_name, new_php = payload.get('id'), payload.get('name'), payload.get('php_version')
            projects = self._read_projects()
            project = next((p for p in projects if p['id'] == project_id), None)
            if not project: return {"status": "error", "message": "backend.project.project_not_found"}

            if new_name: project['name'] = new_name
            if new_php and project.get('php_version') != new_php:
                project['php_version'] = new_php
                project['php_port'] = self._get_php_port_from_system(new_php)
                self._log("backend.project.php_version_changed", "info", {"new_php": new_php})

            self._save_projects(projects)
            if hasattr(self, 'sync_apache_vhosts'): self.sync_apache_vhosts()
            
            # ---> FIX: Cek Apache berjalan sebelum restart <---
            if hasattr(self.api, 'apache') and hasattr(self.api.apache, 'restart_server'): 
                if self.api.apache.check_is_running():
                    self.api.apache.restart_server()

            return {"status": "success", "message": "backend.project.settings_saved"}
        except Exception as e: return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
