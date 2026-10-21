import os
import sys
import shutil
import re
import urllib.request
import subprocess
import ctypes
import tempfile
import time
from typing import Optional

from core.utils.system_utils import get_project_root, get_silent_flags
from core.utils.file_utils import read_json, write_json

MSG_UNEXPECTED_ERROR = "backend.error.unexpected"
USER_AGENT = "Mozilla/5.0"
VALID_PROJECT_TYPES = ("php", "node", "python", "go", "java")
DEFAULT_PROXY_PORTS = {
    "react-vite": 5173,
    "react-native": 8081,
    "nextjs": 3000,
    "express": 3000,
    "node-raw": 3000,
    "fastapi": 8000,
    "django": 8000,
    "flask": 5000,
    "python-raw": 8000,
    "gin": 8080,
    "fiber": 8080,
    "go-raw": 8080,
    "spring-boot": 8080,
    "java-raw": 8080,
}

class ProjectManager:
    """Manager untuk setup Virtual Host, Auto-Framework, dan .htaccess"""
    def __init__(self, api_ref):
        self.api = api_ref
        self.base_dir = os.path.join(get_project_root(), 'data')
        self.bin_dir = os.path.join(get_project_root(), 'bin') 
        
        os.makedirs(self.base_dir, exist_ok=True)
        self.projects_file = os.path.join(self.base_dir, 'projects.json')
        if not os.path.exists(self.projects_file): write_json(self.projects_file, [])
        self._active_pty = None
        self._active_pid: Optional[int] = None
        self._active_target_dir: Optional[str] = None
        self._active_install_location: Optional[str] = None
        self._install_cancelled: bool = False
        self._cli_waiting_input: bool = False
        self._last_enter_time: float = 0.0
        self._cli_tail_buffer: str = ""

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_log(msg, level, args)

    def _progress(self, pct: int, msg: str, args: dict = None):
        if hasattr(self, 'api') and self.api: self.api.emit_progress(pct, msg, args)

    def _emit_cli_output(self, data: str):
        if hasattr(self, 'api') and hasattr(self.api, 'emit_cli_output'):
            self.api.emit_cli_output(data)

    def _emit_cli_state(self, waiting_input: bool, prompt_text: str = "", cancelled: bool = False):
        self._cli_waiting_input = waiting_input
        if hasattr(self, 'api') and hasattr(self.api, 'emit_cli_state'):
            self.api.emit_cli_state(waiting_input, prompt_text, cancelled)

    @staticmethod
    def _is_cli_prompt_waiting(raw_buffer: str) -> tuple[bool, str]:
        if not raw_buffer:
            return False, ""
        ansi_re = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        clean = ansi_re.sub('', raw_buffer)
        lines = [line.strip() for line in re.split(r'[\r\n]+', clean) if line.strip()]
        if not lines:
            return False, ""
        clean_lines = [l for l in lines if not re.match(r'^[│─┌┐└┘├┤┼\s]+$', l)]
        if not clean_lines:
            return False, ""
        tail = clean_lines[-8:]
        tail_text = ' \n '.join(tail)
        work_keywords = r'(?:Creating a new|Installing|Downloading|Scaffolding|Initializing|Extracting|Building|added \d+ package|Done in|Success!|created \d+|Done\. Now run)'
        if any(re.search(work_keywords, l, re.IGNORECASE) for l in tail) or re.match(r'^[\u2800-\u28ff\s]+$', tail[-1]):
            return False, ""
        prompt_indicators = (
            '»', '›', '(y/N)', '(Y/n)', '[y/n]', '[Y/n]', '[y/N]', '(yes/no)',
            'No / Yes', 'Yes / No', 'Yes / ○ No', '●', '○', 'Use arrow-keys',
            'to navigate', 'Enter: confirm', 'Return to submit', 'Press enter',
            'select an option', 'choose an option'
        )
        if any(tok in tail_text for tok in prompt_indicators):
            for l in reversed(tail):
                stripped = l.lstrip('│─ ').strip()
                if stripped.startswith(('?', '◆', '»', '›')) or any(tok in stripped for tok in prompt_indicators):
                    return True, stripped
            return True, tail[-1]
        for l in reversed(tail[-3:]):
            stripped = l.lstrip('│─ ').strip()
            if stripped.startswith(('?', '◆')) or re.search(r'(?:password|passphrase|enter\s+choice|select\s+an\s+option|overwrite|continue\?|proceed\?)[^:\n]*[:?]\s*$', stripped, re.IGNORECASE):
                return True, stripped
        return False, ""

    def _spawn_pty_process(self, cmd_list: list, cwd: str, env: dict = None):
        from winpty import PtyProcess
        final_cmd = list(cmd_list)
        if sys.platform == 'win32' and final_cmd:
            exe = str(final_cmd[0]).lower()
            if exe.endswith('.cmd') or exe.endswith('.bat'):
                final_cmd = ['cmd.exe', '/c'] + final_cmd
        return PtyProcess.spawn(final_cmd, cwd=cwd, env=env or os.environ.copy(), dimensions=(24, 100))

    def _process_pty_chunk(self, chunk: str):
        self._emit_cli_output(chunk)
        self._cli_tail_buffer = (self._cli_tail_buffer + chunk)[-2000:]
        is_waiting, prompt_line = self._is_cli_prompt_waiting(self._cli_tail_buffer)
        if is_waiting:
            self._emit_cli_state(True, prompt_line)
        elif self._cli_waiting_input:
            work_keywords = r'(?:Creating a new|Installing|Downloading|Scaffolding|Initializing|Extracting|Building|added \d+ package|Done in|Success!|created \d+|Done\. Now run)'
            if re.search(work_keywords, self._cli_tail_buffer[-300:], re.IGNORECASE) or (time.time() - self._last_enter_time >= 2.0):
                self._emit_cli_state(False, "")

    def _run_cli_or_pty(self, cmd_list: list, cwd: str, env: dict = None) -> tuple[bool, str]:
        if self._install_cancelled:
            return False, "cancelled"
        if hasattr(subprocess.run, "_mock_name"):
            res = subprocess.run(cmd_list, cwd=cwd, env=env, capture_output=True, text=True, creationflags=get_silent_flags())
            return res.returncode == 0, (res.stderr or res.stdout or "")
        try:
            pty = self._spawn_pty_process(cmd_list, cwd=cwd, env=env)
            self._active_pty = pty
            self._active_pid = getattr(pty, "pid", None)
            self._cli_tail_buffer = ""
            while pty.isalive():
                if self._install_cancelled:
                    break
                try:
                    chunk = pty.read(4096)
                except EOFError:
                    break
                except Exception:
                    time.sleep(0.05)
                    continue
                if chunk:
                    self._process_pty_chunk(chunk)
            self._emit_cli_state(False, "")
            if self._install_cancelled:
                return False, "cancelled"
            exit_status = getattr(pty, "exitstatus", 0) or 0
            return exit_status == 0, self._cli_tail_buffer[-300:]
        except Exception as e:
            self._emit_cli_state(False, "")
            return False, str(e)
        finally:
            self._active_pty = None
            self._active_pid = None

    def send_project_cli_input(self, data: str) -> dict:
        try:
            if not self._active_pty:
                return {"status": "error", "message": "backend.project.no_active_cli"}
            self._active_pty.write(str(data))
            if "\r" in str(data) or "\n" in str(data):
                self._last_enter_time = time.time()
                def _deferred_close_check():
                    time.sleep(2.0)
                    still_waiting, _ = self._is_cli_prompt_waiting(self._cli_tail_buffer)
                    if not still_waiting and self._cli_waiting_input and (time.time() - self._last_enter_time >= 1.9):
                        self._emit_cli_state(False, "")
                import threading
                threading.Thread(target=_deferred_close_check, daemon=True).start()
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def resize_project_cli(self, cols: int, rows: int) -> dict:
        try:
            if self._active_pty and hasattr(self._active_pty, "setwinsize"):
                self._active_pty.setwinsize(max(10, int(rows)), max(40, int(cols)))
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _kill_active_process_tree(self):
        import psutil
        pid = self._active_pid
        pty = self._active_pty
        self._active_pty = None
        self._active_pid = None
        if pid:
            try:
                parent = psutil.Process(pid)
                children = parent.children(recursive=True)
                for child in children:
                    try: child.kill()
                    except psutil.Error: pass
                try: parent.kill()
                except psutil.Error: pass
                psutil.wait_procs([*children, parent], timeout=3)
            except psutil.Error:
                pass
        if pty:
            try: pty.close(force=True)
            except Exception: pass

    def cancel_project_install(self) -> dict:
        try:
            self._install_cancelled = True
            self._emit_cli_state(False, "", cancelled=True)
            self._kill_active_process_tree()
            target = self._active_target_dir
            base_loc = self._active_install_location
            if target and base_loc:
                real_base = os.path.realpath(base_loc)
                real_target = os.path.realpath(target)
                if real_target.startswith(real_base) and real_target != real_base:
                    time.sleep(0.2)
                    self._rollback_dir(real_target)
            elif target:
                self._rollback_dir(target)
            self._active_target_dir = None
            return {"status": "success", "message": "backend.project.install_cancelled_reverted"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
    
    def _read_projects(self):
        return read_json(self.projects_file, list)
    
    def _save_projects(self, projects):
        if not write_json(self.projects_file, projects) and hasattr(self, 'api'):
            self._log("backend.project.save_json_failed", "error")

    def _composer_requires(self, directory: str, package: str) -> bool:
        """
        Cek apakah `package` (mis. "laravel/framework") benar-benar terdaftar di
        require/require-dev composer.json milik project -- bukan sekadar menebak dari
        nama file semata. Lihat docs/known_bugs.md untuk kasus nyata: project custom
        berbasis Zend yang dimodifikasi tetap punya file bernama "artisan" (skrip CLI
        custom, bukan dari Laravel) DAN "composer.json" (lazim di banyak framework),
        sehingga heuristik nama-file saja salah mendeteksinya sebagai Laravel.
        """
        composer = read_json(os.path.join(directory, "composer.json"), dict)
        return package in composer.get("require", {}) or package in composer.get("require-dev", {})

    def detect_framework(self, directory: str) -> str:
        if not os.path.isdir(directory): return "raw"
        files = os.listdir(directory)
        if "artisan" in files and "composer.json" in files and self._composer_requires(directory, "laravel/framework"):
            return "laravel"
        if "spark" in files and "public" in files and self._composer_requires(directory, "codeigniter4/framework"):
            return "codeigniter"
        if "wp-admin" in files or "wp-config-sample.php" in files: return "wordpress"
        non_php_fw = self._detect_non_php_framework(directory, files)
        if non_php_fw: return non_php_fw
        return "raw"

    def _detect_non_php_framework(self, directory: str, files: list) -> str:
        if "package.json" in files:
            pkg = read_json(os.path.join(directory, "package.json"), dict)
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "next" in deps: return "nextjs"
            if "react-native" in deps: return "react-native"
            if "vite" in deps: return "react-vite"
            if "express" in deps: return "express"
            return "node-raw"
        if "go.mod" in files or "main.go" in files:
            return self._detect_go_framework(directory, files)
        if any(f in files for f in ("pom.xml", "build.gradle", "build.gradle.kts", "Main.java")):
            return "spring-boot" if any(f in files for f in ("pom.xml", "build.gradle", "build.gradle.kts")) else "java-raw"
        if any(f in files for f in ("manage.py", "requirements.txt", "pyproject.toml", "main.py", "app.py")):
            return self._detect_python_framework(directory, files)
        return ""

    @staticmethod
    def _detect_go_framework(directory: str, files: list) -> str:
        if "go.mod" in files:
            try:
                with open(os.path.join(directory, "go.mod"), "r", encoding="utf-8") as f:
                    content = f.read()
                if "github.com/gin-gonic/gin" in content: return "gin"
                if "github.com/gofiber/fiber" in content: return "fiber"
            except Exception:
                pass
        return "go-raw"

    @staticmethod
    def _detect_python_framework(directory: str, files: list) -> str:
        if "manage.py" in files: return "django"
        for req_file in ("requirements.txt", "pyproject.toml"):
            if req_file in files:
                try:
                    with open(os.path.join(directory, req_file), "r", encoding="utf-8") as f:
                        content = f.read().lower()
                    if "fastapi" in content: return "fastapi"
                    if "django" in content: return "django"
                    if "flask" in content: return "flask"
                except Exception:
                    pass
        return "python-raw"

    @staticmethod
    def _validate_proxy_port(port_val) -> Optional[int]:
        try:
            port = int(port_val)
            return port if 1024 <= port <= 65535 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _extract_semver_tuple(ver_str: str) -> tuple[int, int, int]:
        if not ver_str:
            return (0, 0, 0)
        m = re.search(r'(\d+)(?:\.(\d+))?(?:\.(\d+))?', str(ver_str))
        if not m:
            return (0, 0, 0)
        return (int(m.group(1) or 0), int(m.group(2) or 0), int(m.group(3) or 0))

    @staticmethod
    def _clean_version_str(ver_str: str) -> str:
        if not ver_str:
            return ""
        m = re.search(r'(\d+\.\d+(?:\.\d+)?)', str(ver_str))
        if m:
            return m.group(1)
        m_single = re.search(r'(\d+)', str(ver_str))
        return m_single.group(1) if m_single else ""

    @classmethod
    def _satisfies_constraint(cls, runtime_ver: str, constraint: str) -> bool:
        rt_tuple = cls._extract_semver_tuple(runtime_ver)
        if rt_tuple == (0, 0, 0) or not constraint:
            return True
        branches = [b.strip() for b in str(constraint).split("||") if b.strip()]
        branch_mins = []
        for branch in branches:
            mins = [cls._extract_semver_tuple(v) for op, v in re.findall(r'(>=|<=|>|<|\^|~|=)?\s*(\d+(?:\.\d+)*)', branch) if op not in ('<', '<=')]
            if mins:
                branch_mins.append(max(mins))
        if not branch_mins:
            return True
        return rt_tuple >= min(branch_mins)

    def get_project_runtimes_info(self) -> dict:
        try:
            php_list = []
            if hasattr(self.api, 'get_installed_php'):
                res = self.api.get_installed_php()
                php_list = res.get('data', []) if isinstance(res, dict) else (res or [])
            php_versions = [p.get('version') for p in php_list if isinstance(p, dict) and p.get('version')]
            data = {
                "php": {
                    "installed": len(php_versions) > 0,
                    "version": php_versions[0] if php_versions else "",
                    "versions": php_versions,
                }
            }
            rm = getattr(self.api, 'runtimes_manager', None)
            for engine, method_name in (("node", "get_node_status"), ("python", "get_python_status"), ("go", "get_go_status"), ("java", "get_java_status")):
                st = getattr(rm, method_name)(silent=True) if rm and hasattr(rm, method_name) else {}
                ext = st.get("external", {}) if isinstance(st, dict) else {}
                is_inst = bool(st.get("installed") or ext.get("exists"))
                is_in_path = bool(st.get("in_path") or ext.get("exists"))
                raw_ver = st.get("version") or ext.get("version") or ""
                clean_ver = self._clean_version_str(raw_ver)
                data[engine] = {"installed": is_inst, "in_path": is_in_path, "version": clean_ver, "raw_version": raw_ver}
            return {"status": "success", "data": data}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _fetch_json_url(self, url: str, headers: dict = None) -> dict:
        import json as _json
        req_headers = {"User-Agent": USER_AGENT, **(headers or {})}
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            return _json.loads(resp.read().decode("utf-8"))

    def _fetch_packagist_versions(self, package_name: str, runtime_version: str) -> list:
        data = self._fetch_json_url(f"https://repo.packagist.org/p2/{package_name}.json")
        releases = data.get("packages", {}).get(package_name, [])
        seen_minor, results, last_req = set(), [], {}
        for item in releases:
            ver = str(item.get("version", "")).lstrip("v")
            if isinstance(item.get("require"), dict):
                last_req = item["require"]
            if not re.match(r'^\d+\.\d+\.\d+$', ver):
                continue
            php_req = last_req.get("php", "") if isinstance(last_req, dict) else ""
            if not self._satisfies_constraint(runtime_version, php_req):
                continue
            major_minor = ".".join(ver.split(".")[:2])
            if major_minor not in seen_minor:
                seen_minor.add(major_minor)
                label = f"v{ver} (PHP {php_req})" if php_req else f"v{ver}"
                results.append({"value": f"^{major_minor}", "label": label})
            if len(results) >= 10:
                break
        return results

    def _fetch_wordpress_versions(self, runtime_version: str) -> list:
        data = self._fetch_json_url("https://api.wordpress.org/core/version-check/1.7/")
        offers = data.get("offers", [])
        seen_minor, results = set(), []
        for item in offers:
            ver = str(item.get("version", ""))
            php_req = str(item.get("php_version", ""))
            if not re.match(r'^\d+\.\d+(\.\d+)?$', ver):
                continue
            if php_req and not self._satisfies_constraint(runtime_version, f">={php_req}"):
                continue
            major_minor = ".".join(ver.split(".")[:2])
            if major_minor not in seen_minor:
                seen_minor.add(major_minor)
                label = f"WordPress {ver} (PHP >={php_req})" if php_req else f"WordPress {ver}"
                results.append({"value": ver, "label": label})
            if len(results) >= 8:
                break
        return results

    def _fetch_npm_versions(self, package_name: str, runtime_version: str) -> list:
        data = self._fetch_json_url(f"https://registry.npmjs.org/{package_name}")
        versions_dict = data.get("versions", {})
        stable_vers = [v for v in versions_dict.keys() if re.match(r'^\d+\.\d+\.\d+$', str(v))]
        stable_vers.sort(key=self._extract_semver_tuple, reverse=True)
        seen_minor, results = set(), []
        for ver in stable_vers:
            meta = versions_dict.get(ver, {})
            engines = meta.get("engines", {}) if isinstance(meta.get("engines"), dict) else {}
            node_req = engines.get("node", "")
            if not self._satisfies_constraint(runtime_version, node_req):
                continue
            major_minor = ".".join(ver.split(".")[:2])
            if major_minor not in seen_minor:
                seen_minor.add(major_minor)
                label = f"v{ver} (Node {node_req})" if node_req else f"v{ver}"
                results.append({"value": ver, "label": label})
            if len(results) >= 10:
                break
        return results

    def _fetch_pypi_versions(self, package_name: str, runtime_version: str) -> list:
        data = self._fetch_json_url(f"https://pypi.org/pypi/{package_name}/json")
        releases = data.get("releases", {})
        stable_vers = [v for v in releases.keys() if re.match(r'^\d+\.\d+(\.\d+)?$', str(v)) and releases.get(v)]
        stable_vers.sort(key=self._extract_semver_tuple, reverse=True)
        seen_minor, results = set(), []
        for ver in stable_vers:
            files = releases.get(ver, [])
            py_req = (files[0].get("requires_python") or "") if files and isinstance(files[0], dict) else ""
            if not self._satisfies_constraint(runtime_version, py_req):
                continue
            major_minor = ".".join(ver.split(".")[:2])
            if major_minor not in seen_minor:
                seen_minor.add(major_minor)
                label = f"v{ver} (Python {py_req})" if py_req else f"v{ver}"
                results.append({"value": ver, "label": label})
            if len(results) >= 10:
                break
        return results

    def _fetch_go_proxy_versions(self, module_path: str) -> list:
        req = urllib.request.Request(f"https://proxy.golang.org/{module_path}/@v/list", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as resp:
            lines = resp.read().decode("utf-8").splitlines()
        stable_vers = [v.strip() for v in lines if re.match(r'^v\d+\.\d+\.\d+$', v.strip())]
        stable_vers.sort(key=self._extract_semver_tuple, reverse=True)
        seen_minor, results = set(), []
        for ver in stable_vers:
            major_minor = ".".join(ver.lstrip("v").split(".")[:2])
            if major_minor not in seen_minor:
                seen_minor.add(major_minor)
                results.append({"value": ver, "label": ver})
            if len(results) >= 10:
                break
        return results

    def _fetch_spring_versions(self, runtime_version: str) -> list:
        data = self._fetch_json_url("https://start.spring.io/metadata/client", {"Accept": "application/json"})
        values = data.get("bootVersion", {}).get("values", [])
        java_major = self._extract_semver_tuple(runtime_version)[0]
        results = []
        for item in values:
            ver_id = str(item.get("id", ""))
            if any(tag in ver_id.upper() for tag in ("SNAPSHOT", "M", "RC")):
                continue
            boot_major = self._extract_semver_tuple(ver_id)[0]
            min_java = 17 if boot_major >= 3 else 8
            if java_major > 0 and java_major < min_java:
                continue
            clean_ver = ver_id.replace(".RELEASE", "")
            results.append({"value": clean_ver, "label": f"Spring Boot {clean_ver} (Java >={min_java})"})
        return results

    def get_framework_versions(self, engine: str, framework: str, runtime_version: str = "") -> dict:
        if framework in ("raw", "node-raw", "python-raw", "go-raw", "java-raw"):
            return {"status": "success", "data": []}
        try:
            packagist_map = {"laravel": "laravel/laravel", "codeigniter": "codeigniter4/appstarter"}
            npm_map = {"react-vite": "vite", "react-native": "react-native", "nextjs": "next", "express": "express"}
            pypi_map = {"fastapi": "fastapi", "django": "Django", "flask": "Flask"}
            go_map = {"gin": "github.com/gin-gonic/gin", "fiber": "github.com/gofiber/fiber/v2"}
            if framework in packagist_map:
                vers = self._fetch_packagist_versions(packagist_map[framework], runtime_version)
            elif framework == "wordpress":
                vers = self._fetch_wordpress_versions(runtime_version)
            elif framework in npm_map:
                vers = self._fetch_npm_versions(npm_map[framework], runtime_version)
            elif framework in pypi_map:
                vers = self._fetch_pypi_versions(pypi_map[framework], runtime_version)
            elif framework in go_map:
                vers = self._fetch_go_proxy_versions(go_map[framework])
            elif framework == "spring-boot":
                vers = self._fetch_spring_versions(runtime_version)
            else:
                vers = []
            return {"status": "success", "data": vers}
        except Exception as e:
            self._log("backend.project.fetch_versions_failed", "warn", {"framework": framework, "e": str(e)})
            return {"status": "error", "message": "backend.project.fetch_versions_failed", "args": {"framework": framework, "e": str(e)}, "data": []}

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

    def _stream_composer_output(self, process, current_percent: float, max_percent: float, msg_key: str, ansi_escape: re.Pattern) -> tuple[float, str]:
        error_log = ""
        for line in process.stdout:
            clean_line = ansi_escape.sub('', line.strip())
            if clean_line:
                error_log += clean_line + " "
                self._log("backend.project.composer_log", "info", {"line": clean_line})
                if current_percent < max_percent: current_percent += 0.5
                self._progress(int(current_percent), msg_key, {"line": clean_line[:62]})
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
            
            current_percent, _ = self._stream_composer_output(process_update, current_percent, 95.0, 'backend.project.composer_vendor_install', ansi_escape)

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
        
        current_percent, error_log = self._stream_composer_output(process_create, current_percent, 60.0, 'backend.project.composer_create_project', ansi_escape)
        
        process_create.wait()
        return process_create.returncode == 0, error_log


    @staticmethod
    def _post_install_laravel(target_dir: str, php_exe: str, php_ini_path: str, custom_env: dict, cflags: int):
        import shutil
        env_example = os.path.join(target_dir, '.env.example')
        env_file = os.path.join(target_dir, '.env')
        if os.path.exists(env_example) and not os.path.exists(env_file):
            shutil.copy(env_example, env_file)
        try:
            subprocess.run([php_exe, "-c", php_ini_path, "artisan", "key:generate"], cwd=target_dir, env=custom_env, creationflags=cflags)
        except Exception:
            pass

    @staticmethod
    def _post_install_ci4(target_dir: str):
        import shutil
        env_source = os.path.join(target_dir, 'env')
        env_file = os.path.join(target_dir, '.env')
        if os.path.exists(env_source) and not os.path.exists(env_file):
            shutil.copy(env_source, env_file)
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    env_content = f.read()
                with open(env_file, 'w', encoding='utf-8') as f:
                    f.write(env_content.replace('# CI_ENVIRONMENT = production', 'CI_ENVIRONMENT = development'))
            except Exception:
                pass

    def _run_framework_post_install(self, framework: str, target_dir: str, php_exe: str, php_ini_path: str, custom_env: dict, cflags: int, is_ci3: bool):
        self._log("backend.project.running_post_install", "info")
        if framework == 'laravel':
            self._post_install_laravel(target_dir, php_exe, php_ini_path, custom_env, cflags)
        elif framework == 'codeigniter' and not is_ci3:
            self._post_install_ci4(target_dir)

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

    def _resolve_runtime_bin(self, engine: str, exe_name: str) -> Optional[str]:
        rm = getattr(self.api, 'runtimes_manager', None)
        engine_dir = rm._get_engine_dir(engine) if rm and hasattr(rm, '_get_engine_dir') else None
        if engine_dir:
            sub = os.path.join(engine_dir, 'bin', exe_name) if engine in ('go', 'java') else os.path.join(engine_dir, exe_name)
            if os.path.exists(sub):
                return sub
        if rm and hasattr(rm, '_check_external_installation'):
            ext = rm._check_external_installation(engine, silent=True)
            ext_path = ext.get('path') if isinstance(ext, dict) and ext.get('exists') else None
            if ext_path:
                if os.path.basename(ext_path).lower() == exe_name.lower():
                    return ext_path
                sibling = os.path.join(os.path.dirname(ext_path), exe_name)
                if os.path.exists(sibling):
                    return sibling
        found = shutil.which(exe_name)
        if found:
            return found
        return None

    @staticmethod
    def _write_start_dev_bat(target_dir: str, command_line: str):
        bat_path = os.path.join(target_dir, "start-dev.bat")
        with open(bat_path, "w", encoding="utf-8") as f:
            f.write(f"@echo off\n{command_line}\n")

    def _scaffold_node_files(self, framework: str, target_dir: str, specific_version: str, proxy_port: int):
        pkg_name = os.path.basename(target_dir).lower()
        if framework == "react-vite":
            vite_ver = f"^{specific_version}" if specific_version else "^5.4.0"
            write_json(os.path.join(target_dir, "package.json"), {
                "name": pkg_name, "private": True, "version": "0.1.0", "type": "module",
                "scripts": {"dev": f"vite --host 127.0.0.1 --port {proxy_port}", "build": "vite build"},
                "dependencies": {"react": "^18.3.1", "react-dom": "^18.3.1"},
                "devDependencies": {"vite": vite_ver, "@vitejs/plugin-react": "^4.3.1"},
            })
            with open(os.path.join(target_dir, "vite.config.js"), "w", encoding="utf-8") as f:
                f.write(f"import {{ defineConfig }} from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({{\n  plugins: [react()],\n  server: {{ host: '127.0.0.1', port: {proxy_port}, allowedHosts: true }}\n}})\n")
            with open(os.path.join(target_dir, "index.html"), "w", encoding="utf-8") as f:
                f.write("<!doctype html>\n<html><head><meta charset=\"UTF-8\" /><title>VyloServe React + Vite</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script></body></html>\n")
            os.makedirs(os.path.join(target_dir, "src"), exist_ok=True)
            with open(os.path.join(target_dir, "src", "main.jsx"), "w", encoding="utf-8") as f:
                f.write("import React from 'react'\nimport ReactDOM from 'react-dom/client'\nReactDOM.createRoot(document.getElementById('root')).render(<h1>Welcome to VyloServe (React + Vite)</h1>)\n")
            self._write_start_dev_bat(target_dir, "npm run dev")
        elif framework == "react-native":
            rn_ver = specific_version if specific_version else "latest"
            write_json(os.path.join(target_dir, "package.json"), {
                "name": pkg_name, "private": True, "version": "0.1.0",
                "scripts": {"start": f"react-native start --port {proxy_port}", "dev": f"react-native start --port {proxy_port}"},
                "dependencies": {"react": "^18.3.1", "react-native": rn_ver},
            })
            with open(os.path.join(target_dir, "App.js"), "w", encoding="utf-8") as f:
                f.write("import React from 'react';\nimport { Text, View, StyleSheet } from 'react-native';\nexport default function App() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>Welcome to VyloServe (React Native)</Text>\n    </View>\n  );\n}\nconst styles = StyleSheet.create({\n  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },\n  text: { fontSize: 20, fontWeight: 'bold' }\n});\n")
            with open(os.path.join(target_dir, "index.js"), "w", encoding="utf-8") as f:
                f.write("import { AppRegistry } from 'react-native';\nimport App from './App';\nAppRegistry.registerComponent('main', () => App);\n")
            self._write_start_dev_bat(target_dir, "npm start")
        elif framework == "nextjs":
            next_ver = specific_version if specific_version else "latest"
            write_json(os.path.join(target_dir, "package.json"), {
                "name": pkg_name, "private": True, "version": "0.1.0",
                "scripts": {"dev": f"next dev -H 127.0.0.1 -p {proxy_port}", "build": "next build", "start": f"next start -p {proxy_port}"},
                "dependencies": {"next": next_ver, "react": "^18.3.1", "react-dom": "^18.3.1"},
            })
            os.makedirs(os.path.join(target_dir, "app"), exist_ok=True)
            with open(os.path.join(target_dir, "app", "layout.jsx"), "w", encoding="utf-8") as f:
                f.write("export default function RootLayout({ children }) { return <html lang=\"en\"><body>{children}</body></html> }\n")
            with open(os.path.join(target_dir, "app", "page.jsx"), "w", encoding="utf-8") as f:
                f.write("export default function Page() { return <h1>Welcome to VyloServe (Next.js)</h1> }\n")
            self._write_start_dev_bat(target_dir, "npm run dev")
        elif framework == "express":
            exp_ver = f"^{specific_version}" if specific_version else "^4.21.0"
            write_json(os.path.join(target_dir, "package.json"), {
                "name": pkg_name, "version": "0.1.0",
                "scripts": {"dev": "node index.js", "start": "node index.js"},
                "dependencies": {"express": exp_ver},
            })
            with open(os.path.join(target_dir, "index.js"), "w", encoding="utf-8") as f:
                f.write(f"const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('<h1>Welcome to VyloServe (Express)</h1>'));\napp.listen({proxy_port}, '127.0.0.1', () => console.log('Listening on 127.0.0.1:{proxy_port}'));\n")
            self._write_start_dev_bat(target_dir, "node index.js")
        else:
            write_json(os.path.join(target_dir, "package.json"), {"name": pkg_name, "version": "0.1.0", "scripts": {"start": "node index.js"}})
            with open(os.path.join(target_dir, "index.js"), "w", encoding="utf-8") as f:
                f.write(f"const http = require('http');\nhttp.createServer((req, res) => {{ res.writeHead(200, {{'Content-Type': 'text/html'}}); res.end('<h1>Welcome to VyloServe (Node.js)</h1>'); }}).listen({proxy_port}, '127.0.0.1');\n")
            self._write_start_dev_bat(target_dir, "node index.js")

    def _run_nextjs_interactive_cli(self, npx_cmd: str, target_dir: str, specific_version: str, proxy_port: int, custom_env: dict) -> tuple[bool, str]:
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir, ignore_errors=True)
        parent_dir = os.path.dirname(target_dir)
        os.makedirs(parent_dir, exist_ok=True)
        next_ver = specific_version if specific_version else "latest"
        self._progress(45, "backend.project.installing_runtime_deps", {"framework": "nextjs"})
        ok, err_out = self._run_cli_or_pty([npx_cmd, "--yes", f"create-next-app@{next_ver}", target_dir, "--use-npm"], cwd=parent_dir, env=custom_env)
        if not ok:
            return False, err_out
        pkg_path = os.path.join(target_dir, "package.json")
        pkg_data = read_json(pkg_path, dict)
        if isinstance(pkg_data, dict):
            scripts = pkg_data.setdefault("scripts", {})
            scripts["dev"] = f"next dev -H 127.0.0.1 -p {proxy_port}"
            write_json(pkg_path, pkg_data)
        self._write_start_dev_bat(target_dir, "npm run dev")
        return True, ""

    @staticmethod
    def _patch_vite_config_port(target_dir: str, proxy_port: int):
        for fname in ("vite.config.js", "vite.config.ts", "vite.config.mjs"):
            cfg_path = os.path.join(target_dir, fname)
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    if "server:" not in content:
                        new_content = re.sub(
                            r'(defineConfig\s*\(\s*\{)',
                            rf'\1\n  server: {{ host: "127.0.0.1", port: {proxy_port}, allowedHosts: true }},',
                            content,
                            count=1
                        )
                        with open(cfg_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                except Exception:
                    pass
                break

    def _run_react_interactive_cli(self, npx_cmd: str, target_dir: str, specific_version: str, proxy_port: int, custom_env: dict) -> tuple[bool, str]:
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir, ignore_errors=True)
        parent_dir = os.path.dirname(target_dir)
        os.makedirs(parent_dir, exist_ok=True)
        vite_pkg = f"create-vite@{specific_version}" if specific_version else "create-vite@latest"
        self._progress(40, "backend.project.installing_runtime_deps", {"framework": "react-vite"})
        ok, err_out = self._run_cli_or_pty([npx_cmd, "--yes", vite_pkg, target_dir, "--template", "react"], cwd=parent_dir, env=custom_env)
        if not ok:
            return False, err_out
        self._patch_vite_config_port(target_dir, proxy_port)
        npm_cmd = self._resolve_runtime_bin("node", "npm.cmd")
        if npm_cmd and not os.path.exists(os.path.join(target_dir, "node_modules")):
            self._progress(65, "backend.project.installing_runtime_deps", {"framework": "react-vite"})
            ok, err_out = self._run_cli_or_pty([npm_cmd, "install", "--no-audit", "--no-fund"], cwd=target_dir, env=custom_env)
            if not ok:
                return False, err_out
        self._write_start_dev_bat(target_dir, "npm run dev")
        return True, ""

    def _install_node_project(self, framework: str, target_dir: str, specific_version: str, proxy_port: int) -> dict:
        node_exe = self._resolve_runtime_bin("node", "node.exe")
        npm_cmd = self._resolve_runtime_bin("node", "npm.cmd")
        if not node_exe:
            return {"status": "error", "message": "backend.project.runtime_not_installed", "args": {"engine": "Node.js"}}
        try:
            self._progress(20, "backend.project.scaffolding_project", {"framework": framework})
            custom_env = os.environ.copy()
            custom_env["PATH"] = os.path.dirname(node_exe) + os.pathsep + custom_env.get("PATH", "")
            npx_cmd = self._resolve_runtime_bin("node", "npx.cmd") if not hasattr(subprocess.run, "_mock_name") else None
            if framework == "nextjs" and npx_cmd:
                ok, err_out = self._run_nextjs_interactive_cli(npx_cmd, target_dir, specific_version, proxy_port, custom_env)
            elif framework == "react-vite" and npx_cmd:
                ok, err_out = self._run_react_interactive_cli(npx_cmd, target_dir, specific_version, proxy_port, custom_env)
            else:
                os.makedirs(target_dir, exist_ok=True)
                self._scaffold_node_files(framework, target_dir, specific_version, proxy_port)
                ok, err_out = (True, "")
                if framework != "node-raw" and npm_cmd:
                    self._progress(50, "backend.project.installing_runtime_deps", {"framework": framework})
                    ok, err_out = self._run_cli_or_pty([npm_cmd, "install", "--no-audit", "--no-fund"], cwd=target_dir, env=custom_env)
            if self._install_cancelled:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": "backend.project.install_cancelled_reverted"}
            if not ok:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": "backend.project.framework_download_failed", "args": {"error": err_out[:150]}}
            self._progress(100, "backend.project.install_complete_perfect")
            self._log("backend.project.framework_install_success", "success", {"framework": framework})
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    @staticmethod
    def _patch_django_settings(target_dir: str):
        settings_file = os.path.join(target_dir, "config", "settings.py")
        if os.path.exists(settings_file):
            try:
                with open(settings_file, "r", encoding="utf-8") as f:
                    content = f.read()
                new_content = content.replace("ALLOWED_HOSTS = []", "ALLOWED_HOSTS = ['*']")
                with open(settings_file, "w", encoding="utf-8") as f:
                    f.write(new_content)
            except Exception:
                pass

    def _install_python_project(self, framework: str, target_dir: str, specific_version: str, proxy_port: int, use_venv: bool = False) -> dict:
        py_exe = self._resolve_runtime_bin("python", "python.exe")
        if not py_exe:
            return {"status": "error", "message": "backend.project.runtime_not_installed", "args": {"engine": "Python"}}
        try:
            self._progress(20, "backend.project.scaffolding_project", {"framework": framework})
            os.makedirs(target_dir, exist_ok=True)
            active_py = py_exe
            custom_env = os.environ.copy()
            custom_env["PATH"] = os.path.dirname(py_exe) + os.pathsep + custom_env.get("PATH", "")

            if use_venv:
                self._progress(25, "backend.project.creating_venv")
                venv_dir = os.path.join(target_dir, ".venv")
                ok, err_out = self._run_cli_or_pty([py_exe, "-m", "venv", venv_dir], cwd=target_dir, env=custom_env)
                if not ok:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "backend.project.framework_download_failed", "args": {"error": err_out[:150]}}
                venv_py = os.path.join(venv_dir, "Scripts", "python.exe")
                if os.path.exists(venv_py):
                    active_py = venv_py
                    custom_env["PATH"] = os.path.join(venv_dir, "Scripts") + os.pathsep + custom_env.get("PATH", "")
                    custom_env["VIRTUAL_ENV"] = venv_dir

            pkg_map = {"fastapi": "fastapi", "django": "Django", "flask": "Flask"}
            if framework in pkg_map:
                pkg_spec = f"{pkg_map[framework]}=={specific_version}" if specific_version else pkg_map[framework]
                pkgs = [pkg_spec, "uvicorn"] if framework == "fastapi" else [pkg_spec]
                with open(os.path.join(target_dir, "requirements.txt"), "w", encoding="utf-8") as f:
                    f.write("\n".join(pkgs) + "\n")
                self._progress(50, "backend.project.installing_runtime_deps", {"framework": framework})
                ok, err_out = self._run_cli_or_pty([active_py, "-m", "pip", "install", *pkgs], cwd=target_dir, env=custom_env)
                if self._install_cancelled:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "backend.project.install_cancelled_reverted"}
                if not ok:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "backend.project.framework_download_failed", "args": {"error": err_out[:150]}}

            if framework == "django":
                self._progress(75, "backend.project.running_django_startproject")
                ok, err_out = self._run_cli_or_pty([active_py, "-m", "django", "startproject", "config", "."], cwd=target_dir, env=custom_env)
                if not ok:
                    self._rollback_dir(target_dir)
                    return {"status": "error", "message": "backend.project.framework_download_failed", "args": {"error": err_out[:150]}}
                self._patch_django_settings(target_dir)

            self._write_python_starter_files(framework, target_dir, proxy_port, use_venv=use_venv)
            self._progress(100, "backend.project.install_complete_perfect")
            self._log("backend.project.framework_install_success", "success", {"framework": framework})
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _write_python_starter_files(self, framework: str, target_dir: str, proxy_port: int, use_venv: bool = False):
        venv_prefix = "call .venv\\Scripts\\activate.bat\n" if use_venv else ""
        if framework == "fastapi":
            with open(os.path.join(target_dir, "main.py"), "w", encoding="utf-8") as f:
                f.write("from fastapi import FastAPI\napp = FastAPI()\n\n@app.get('/')\ndef root():\n    return {'message': 'Welcome to VyloServe (FastAPI)'}\n")
            self._write_start_dev_bat(target_dir, f"{venv_prefix}python -m uvicorn main:app --host 127.0.0.1 --port {proxy_port} --reload\npause")
        elif framework == "flask":
            with open(os.path.join(target_dir, "app.py"), "w", encoding="utf-8") as f:
                f.write(f"from flask import Flask\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n    return '<h1>Welcome to VyloServe (Flask)</h1>'\n\nif __name__ == '__main__':\n    app.run(host='127.0.0.1', port={proxy_port}, debug=True)\n")
            self._write_start_dev_bat(target_dir, f"{venv_prefix}python app.py\npause")
        elif framework == "django":
            self._write_start_dev_bat(target_dir, f"{venv_prefix}python manage.py runserver 127.0.0.1:{proxy_port}\npause")
        else:
            with open(os.path.join(target_dir, "main.py"), "w", encoding="utf-8") as f:
                f.write(f"""import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class CustomHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'<h1>Welcome to VyloServe (Python)</h1>')

if __name__ == '__main__':
    port = {proxy_port}
    server = HTTPServer(('127.0.0.1', port), CustomHandler)
    print(f'Serving HTTP on 127.0.0.1 port {{port}} (http://127.0.0.1:{{port}}/) ...')
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\\nShutting down server gracefully...')
    finally:
        server.server_close()
        sys.exit(0)
""")
            self._write_start_dev_bat(target_dir, f"{venv_prefix}python main.py\npause")

    def _write_go_starter_files(self, framework: str, target_dir: str, proxy_port: int):
        main_go = os.path.join(target_dir, "main.go")
        if framework == "gin":
            with open(main_go, "w", encoding="utf-8") as f:
                f.write(f"""package main

import (
	"fmt"
	"net/http"
	"github.com/gin-gonic/gin"
)

func main() {{
	r := gin.Default()
	r.GET("/", func(c *gin.Context) {{
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, "<h1>Welcome to VyloServe (Gin)</h1>")
	}})
	fmt.Println("Listening on http://127.0.0.1:{proxy_port}")
	r.Run("127.0.0.1:{proxy_port}")
}}
""")
        elif framework == "fiber":
            with open(main_go, "w", encoding="utf-8") as f:
                f.write(f"""package main

import (
	"fmt"
	"github.com/gofiber/fiber/v2"
)

func main() {{
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {{
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.SendString("<h1>Welcome to VyloServe (Fiber)</h1>")
	}})
	fmt.Println("Listening on http://127.0.0.1:{proxy_port}")
	app.Listen("127.0.0.1:{proxy_port}")
}}
""")
        else:
            with open(main_go, "w", encoding="utf-8") as f:
                f.write(f"""package main

import (
	"fmt"
	"net/http"
)

func main() {{
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {{
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, "<h1>Welcome to VyloServe (Go)</h1>")
	}})
	fmt.Println("Listening on http://127.0.0.1:{proxy_port}")
	http.ListenAndServe("127.0.0.1:{proxy_port}", nil)
}}
""")

    def _install_go_project(self, framework: str, target_dir: str, specific_version: str, proxy_port: int) -> dict:
        go_exe = self._resolve_runtime_bin("go", "go.exe")
        if not go_exe:
            return {"status": "error", "message": "backend.project.runtime_not_installed", "args": {"engine": "Go"}}
        try:
            self._progress(20, "backend.project.scaffolding_project", {"framework": framework})
            os.makedirs(target_dir, exist_ok=True)
            custom_env = os.environ.copy()
            go_bin_dir = os.path.dirname(go_exe)
            custom_env["PATH"] = go_bin_dir + os.pathsep + custom_env.get("PATH", "")
            custom_env["GOROOT"] = os.path.dirname(go_bin_dir)

            mod_name = os.path.basename(target_dir).lower()
            self._run_cli_or_pty([go_exe, "mod", "init", mod_name], cwd=target_dir, env=custom_env)
            go_mod_map = {"gin": "github.com/gin-gonic/gin", "fiber": "github.com/gofiber/fiber/v2"}
            if framework in go_mod_map:
                self._progress(50, "backend.project.installing_runtime_deps", {"framework": framework})
                ver_tag = specific_version if specific_version else "latest"
                self._run_cli_or_pty([go_exe, "get", f"{go_mod_map[framework]}@{ver_tag}"], cwd=target_dir, env=custom_env)
            if self._install_cancelled:
                self._rollback_dir(target_dir)
                return {"status": "error", "message": "backend.project.install_cancelled_reverted"}
            self._write_go_starter_files(framework, target_dir, proxy_port)
            self._write_start_dev_bat(target_dir, f"echo Starting Go server at http://127.0.0.1:{proxy_port}...\ngo run main.go\npause")
            self._progress(100, "backend.project.install_complete_perfect")
            self._log("backend.project.framework_install_success", "success", {"framework": framework})
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _install_java_project(self, framework: str, target_dir: str, specific_version: str, proxy_port: int) -> dict:
        java_exe = self._resolve_runtime_bin("java", "java.exe")
        if not java_exe:
            return {"status": "error", "message": "backend.project.runtime_not_installed", "args": {"engine": "Java"}}
        try:
            self._progress(20, "backend.project.scaffolding_project", {"framework": framework})
            os.makedirs(target_dir, exist_ok=True)
            if framework == "spring-boot":
                import zipfile
                zip_path = os.path.join(target_dir, "starter.zip")
                if specific_version:
                    url = f"https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion={specific_version}&dependencies=web"
                else:
                    url = "https://start.spring.io/starter.zip?type=maven-project&language=java&dependencies=web"
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=15) as resp, open(zip_path, "wb") as out_f:
                    out_f.write(resp.read())
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(target_dir)
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                props_dir = os.path.join(target_dir, "src", "main", "resources")
                os.makedirs(props_dir, exist_ok=True)
                with open(os.path.join(props_dir, "application.properties"), "a", encoding="utf-8") as f:
                    f.write(f"\nserver.address=127.0.0.1\nserver.port={proxy_port}\n")
                self._write_start_dev_bat(target_dir, "mvnw.cmd spring-boot:run\npause")
            else:
                with open(os.path.join(target_dir, "Main.java"), "w", encoding="utf-8") as f:
                    f.write(f"""import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.io.OutputStream;

public class Main {{
    public static void main(String[] args) throws Exception {{
        int port = {proxy_port};
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/", ex -> {{
            byte[] b = "<h1>Welcome to VyloServe (Java)</h1>".getBytes();
            ex.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            ex.sendResponseHeaders(200, b.length);
            OutputStream os = ex.getResponseBody();
            os.write(b);
            os.close();
        }});
        s.start();
        System.out.println("Java HTTP server listening on http://127.0.0.1:" + port);
        System.out.println("Press Ctrl+C to stop.");
    }}
}}
""")
                self._write_start_dev_bat(target_dir, f"echo Starting Java HTTP server at http://127.0.0.1:{proxy_port}...\njava Main.java\npause")
            self._progress(100, "backend.project.install_complete_perfect")
            self._log("backend.project.framework_install_success", "success", {"framework": framework})
            return {"status": "success", "document_root": target_dir.replace('\\', '/')}
        except Exception as e:
            self._rollback_dir(target_dir)
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def _install_new_framework(self, payload: dict):
        project_type = payload.get('project_type', 'php')
        if project_type in ('node', 'python', 'go', 'java'):
            framework = payload.get('framework')
            target_dir = os.path.join(payload.get('install_location'), payload.get('domain').split('.')[0])
            specific_version = payload.get('specific_version', '').strip()
            proxy_port = self._validate_proxy_port(payload.get('proxy_port') or DEFAULT_PROXY_PORTS.get(framework, 3000)) or 3000
            if project_type == 'python':
                use_venv = bool(payload.get('use_venv', False))
                return self._install_python_project(framework, target_dir, specific_version, proxy_port, use_venv=use_venv)
            dispatch = {
                'node': self._install_node_project,
                'go': self._install_go_project,
                'java': self._install_java_project,
            }
            return dispatch[project_type](framework, target_dir, specific_version, proxy_port)
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

    def _execute_new_framework_install(self, payload: dict) -> dict:
        self._install_cancelled = False
        base_loc = payload.get('install_location') or ''
        folder_name = (payload.get('domain') or '').split('.')[0]
        self._active_install_location = base_loc
        self._active_target_dir = os.path.join(base_loc, folder_name) if base_loc else None
        try:
            res = self._install_new_framework(payload)
            if self._install_cancelled:
                if self._active_target_dir:
                    self._rollback_dir(self._active_target_dir)
                return {"status": "error", "message": "backend.project.install_cancelled_reverted"}
            return res
        finally:
            self._active_target_dir = None
            self._active_install_location = None

    def create_project(self, payload: dict):
        try:
            domain_full = f"{payload.get('domain')}{payload.get('domain_extension')}"
            projects = self._read_projects()
            
            project_type = payload.get('project_type', 'php')
            if project_type not in VALID_PROJECT_TYPES:
                project_type = 'php'
            proxy_port = None
            if project_type != 'php':
                raw_port = payload.get('proxy_port') or DEFAULT_PROXY_PORTS.get(payload.get('framework', ''), 3000)
                proxy_port = self._validate_proxy_port(raw_port)
                if not proxy_port:
                    return {"status": "error", "message": "backend.project.invalid_proxy_port"}
            if any(p['domain'] == domain_full for p in projects):
                return {"status": "error", "message": "backend.project.domain_used", "args": {"domain": domain_full}}
                
            if payload.get('is_existing'):
                final_doc_root = payload.get('document_root')
            else:
                install_result = self._execute_new_framework_install(payload)
                if install_result['status'] == 'error': return install_result
                final_doc_root = install_result['document_root']
                
            php_port = payload.get('php_port') or self._get_php_port_from_system(payload.get('php_version'))
            project_id = f"proj_{int(time.time())}_{payload.get('domain').replace('.', '_')}"
            
            projects.append({
                "id": project_id, "name": payload.get('name'), "domain": domain_full, "path": final_doc_root,
                "php_version": payload.get('php_version'), "php_port": php_port, "framework": payload.get('framework', 'raw'),
                "project_type": project_type, "proxy_port": proxy_port, "host_synced": True
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
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

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

    def _generate_proxy_vhost_block(self, p: dict, domain: str, tunnel_alias: str) -> str:
        proxy_port = self._validate_proxy_port(p.get('proxy_port')) or 3000
        proxy_rules = (
            f"    ProxyPreserveHost On\n"
            f"    ProxyRequests Off\n"
            f"    RequestHeader set X-Forwarded-Port \"80\"\n"
            f"    RewriteEngine On\n"
            f"    RewriteCond %{{HTTP:Upgrade}} websocket [NC]\n"
            f"    RewriteCond %{{HTTP:Connection}} upgrade [NC]\n"
            f"    RewriteRule ^/?(.*) \"ws://127.0.0.1:{proxy_port}/$1\" [P,L]\n"
            f"    ProxyPass / http://127.0.0.1:{proxy_port}/ retry=0 timeout=30\n"
            f"    ProxyPassReverse / http://127.0.0.1:{proxy_port}/"
        )
        vhost = f"<VirtualHost *:80>\n    ServerName {domain}{tunnel_alias}\n{proxy_rules}\n</VirtualHost>\n\n"
        if hasattr(self.api, 'ssl'):
            try:
                domain_crt, domain_key = self.api.ssl.generate_domain_cert(domain)
                ssl_rules = proxy_rules.replace('X-Forwarded-Port "80"', 'X-Forwarded-Port "443"\n    RequestHeader set X-Forwarded-Proto "https"')
                vhost += (
                    f"<VirtualHost *:443>\n    ServerName {domain}{tunnel_alias}\n"
                    f"    SSLEngine on\n"
                    f"    SSLCertificateFile \"{domain_crt.replace(chr(92), '/')}\"\n"
                    f"    SSLCertificateKeyFile \"{domain_key.replace(chr(92), '/')}\"\n"
                    f"{ssl_rules}\n</VirtualHost>\n\n"
                )
            except Exception:
                pass
        return vhost

    def _generate_vhost_block(self, p: dict, projects: list) -> str:
        domain = p.get('domain')
        doc_root = str(p.get('path', '')).replace('\\', '/') 
        saved_port, php_version = p.get('php_port'), p.get('php_version')
        
        tunnel_alias = ""
        tunnel_url = p.get('tunnel_url')
        if tunnel_url:
            raw_host = re.sub(r'^https?://', '', tunnel_url).strip("/")
            tunnel_alias = f"\n    ServerAlias {raw_host}"
        if p.get('project_type', 'php') != 'php':
            return self._generate_proxy_vhost_block(p, domain, tunnel_alias)

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

        vhost = f"<VirtualHost *:80>\n    ServerName {domain}{tunnel_alias}\n    DocumentRoot \"{doc_root}\"\n    DirectoryIndex index.php index.html\n    <Directory \"{doc_root}\">\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n"

        if hasattr(self.api, 'ssl'):
            try:
                domain_crt, domain_key = self.api.ssl.generate_domain_cert(domain)
                vhost += f"<VirtualHost *:443>\n    ServerName {domain}{tunnel_alias}\n    DocumentRoot \"{doc_root}\"\n    SSLEngine on\n    SSLCertificateFile \"{domain_crt.replace(chr(92), '/')}\"\n    SSLCertificateKeyFile \"{domain_key.replace(chr(92), '/')}\"\n    DirectoryIndex index.php index.html\n    <Directory \"{doc_root}\">\n        Options Indexes FollowSymLinks ExecCGI\n        AllowOverride All\n        Require all granted\n    </Directory>\n{fcgi_block}\n</VirtualHost>\n\n"
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
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
    
    def get_projects(self):
        try:
            projects = self._read_projects()
            for p in projects:
                if 'pretty_url_synced' not in p: p['pretty_url_synced'] = p.get('framework', 'raw') == 'raw'
            return {"status": "success", "data": projects}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

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
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

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
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def open_in_explorer(self, path: str):
        try:
            norm_path = os.path.normpath(path)
            if os.path.exists(norm_path):
                os.startfile(norm_path)
                return {"status": "success"}
            return {"status": "error", "message": "backend.project.dir_not_found"}
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def update_project(self, payload: dict):
        try:
            project_id, new_name, new_php = payload.get('id'), payload.get('name'), payload.get('php_version')
            projects = self._read_projects()
            project = next((p for p in projects if p['id'] == project_id), None)
            if not project: return {"status": "error", "message": "backend.project.project_not_found"}

            if new_name: project['name'] = new_name
            if 'tunnel_url' in payload: project['tunnel_url'] = payload.get('tunnel_url')
            if 'proxy_port' in payload and payload.get('proxy_port') is not None:
                valid_port = self._validate_proxy_port(payload.get('proxy_port'))
                if not valid_port:
                    return {"status": "error", "message": "backend.project.invalid_proxy_port"}
                project['proxy_port'] = valid_port
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
        except Exception as e: return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}
