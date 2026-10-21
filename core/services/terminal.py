import os
import sys
import uuid
import shutil
import threading
from typing import Dict, Any, List, Optional
from core.utils.system_utils import get_project_root

class TerminalManager:
    """
    Manajer Pseudo-Terminal (PTY) mandiri untuk Dedicated Developer Terminal.
    Mendukung multi-tab, deteksi shell Windows (PowerShell, CMD, Git Bash, WSL),
    injeksi PATH runtime lokal VyloServe, dan streaming I/O bi-directional non-blocking.
    """

    def __init__(self, api=None):
        self.api = api
        self.root_dir = get_project_root()
        self.bin_dir = os.path.join(self.root_dir, 'bin')
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api and hasattr(self.api, 'emit_log'):
            self.api.emit_log(msg, level, args)

    def get_available_shells(self) -> List[Dict[str, Any]]:
        """
        Mendeteksi ketersediaan shell di sistem Windows.
        Mengembalikan daftar shell dengan flag availability dan penanda default.
        """
        shells = []

        # 1. PowerShell Core (pwsh) & Windows PowerShell
        pwsh_path = shutil.which("pwsh")
        powershell_path = shutil.which("powershell")
        if not powershell_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", "C:\\Windows")
            fallback_ps = os.path.join(system_root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
            if os.path.exists(fallback_ps):
                powershell_path = fallback_ps

        primary_ps_path = pwsh_path or powershell_path
        shells.append({
            "id": "powershell",
            "name": "PowerShell",
            "icon": "terminal",
            "available": bool(primary_ps_path),
            "path": primary_ps_path or "",
            "is_default": True
        })

        # 2. Command Prompt (cmd.exe)
        cmd_path = shutil.which("cmd") or os.environ.get("COMSPEC", "")
        if not cmd_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", "C:\\Windows")
            fallback_cmd = os.path.join(system_root, "System32", "cmd.exe")
            if os.path.exists(fallback_cmd):
                cmd_path = fallback_cmd

        shells.append({
            "id": "cmd",
            "name": "Command Prompt",
            "icon": "terminal",
            "available": bool(cmd_path and os.path.exists(cmd_path)),
            "path": cmd_path or "",
            "is_default": False
        })

        # 3. Git Bash
        git_bash_candidates = [
            shutil.which("bash"),
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
            os.path.join(self.bin_dir, "git", "bin", "bash.exe")
        ]
        git_bash_path = next((p for p in git_bash_candidates if p and os.path.exists(p)), None)
        shells.append({
            "id": "git-bash",
            "name": "Git Bash",
            "icon": "terminal",
            "available": bool(git_bash_path),
            "path": git_bash_path or "",
            "is_default": False
        })

        # 4. WSL (Windows Subsystem for Linux)
        wsl_path = shutil.which("wsl")
        if not wsl_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", "C:\\Windows")
            fallback_wsl = os.path.join(system_root, "System32", "wsl.exe")
            if os.path.exists(fallback_wsl):
                wsl_path = fallback_wsl

        shells.append({
            "id": "wsl",
            "name": "WSL",
            "icon": "terminal",
            "available": bool(wsl_path and os.path.exists(wsl_path)),
            "path": wsl_path or "",
            "is_default": False
        })

        return shells

    def _resolve_shell_command(self, shell_id: str) -> Optional[List[str]]:
        """
        Menentukan command line executable berdasarkan shell_id yang diminta.
        """
        available = {s["id"]: s for s in self.get_available_shells()}
        target = available.get(shell_id)

        if shell_id == "powershell":
            if target and target["available"]:
                return [target["path"], "-NoLogo"]
            pwsh = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
            return [pwsh, "-NoLogo"]

        if shell_id == "cmd":
            cmd_exe = (target["path"] if target and target["available"] else None) or shutil.which("cmd") or "cmd.exe"
            return [cmd_exe]

        if shell_id == "git-bash":
            if target and target["available"]:
                return [target["path"], "--login", "-i"]
            return None

        if shell_id == "wsl":
            if target and target["available"]:
                return [target["path"]]
            return None

        # Fallback ke default powershell
        pwsh = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
        return [pwsh, "-NoLogo"]

    def _scan_versions(
        self,
        base_dirs: List[str],
        binary_name: str,
        bin_subdir: str = "",
        display_prefix: str = ""
    ) -> List[Dict[str, str]]:
        """
        Memindai versi engine lokal VyloServe baik dari subdirektori (mis. bin/runtimes/node/26.12.1/node.exe)
        maupun dari root folder flat untuk backward compatibility.
        """
        versions: List[Dict[str, str]] = []
        seen_paths = set()

        for base in base_dirs:
            if not os.path.exists(base):
                continue

            # 1. Cek subdirektori versi (hierarchical structure)
            has_subdirs = False
            try:
                for entry in sorted(os.listdir(base), reverse=True):
                    sub = os.path.join(base, entry)
                    if not os.path.isdir(sub):
                        continue

                    has_subdirs = True
                    sub_bin_dir = os.path.join(sub, bin_subdir) if bin_subdir else sub
                    # Fallback jika bin_subdir tidak ditemukan, cek sub langsung
                    if not os.path.exists(os.path.join(sub_bin_dir, binary_name)) and os.path.exists(os.path.join(sub, binary_name)):
                        sub_bin_dir = sub

                    if os.path.exists(os.path.join(sub_bin_dir, binary_name)) and sub_bin_dir not in seen_paths:
                        seen_paths.add(sub_bin_dir)
                        clean_ver = entry.replace("php-", "").replace("node-", "").replace("python-", "").replace("go", "")
                        display_ver = clean_ver if clean_ver else entry
                        versions.append({
                            "version": display_ver,
                            "path": sub_bin_dir,
                            "display_name": f"{display_prefix} {display_ver} (VyloServe)"
                        })
            except Exception:
                pass

            # 2. Cek langsung di direktori base (flat structure atau empty placeholder)
            target_bin_dir = os.path.join(base, bin_subdir) if bin_subdir else base
            target_exe = os.path.join(target_bin_dir, binary_name)
            if target_bin_dir not in seen_paths:
                if os.path.exists(target_exe) or not has_subdirs:
                    seen_paths.add(target_bin_dir)
                    versions.append({
                        "version": "default",
                        "path": target_bin_dir,
                        "display_name": f"{display_prefix} (VyloServe)"
                    })

        return versions

    def get_runtimes_matrix(self) -> Dict[str, Any]:
        """
        Memindai seluruh engine yang terpasang di VyloServe (bin/) serta
        membandingkannya dengan ketersediaan di Windows OS System PATH.
        Mengembalikan metadata yang digunakan frontend untuk mengatur profil runtime.
        """
        matrix: Dict[str, Any] = {}

        # 1. PHP
        php_vers = self._scan_versions(
            base_dirs=[os.path.join(self.bin_dir, "php")],
            binary_name="php.exe",
            display_prefix="PHP"
        )
        os_php = shutil.which("php")
        matrix["php"] = {
            "name": "PHP Engine",
            "has_vyloserve": len(php_vers) > 0,
            "has_os": bool(os_php),
            "os_path": os_php or "",
            "versions": php_vers,
            "path": php_vers[0]["path"] if php_vers else "",
            "default_mode": php_vers[0]["path"] if php_vers else ("os" if os_php else "none")
        }

        # 2. Node.js
        node_vers = self._scan_versions(
            base_dirs=[os.path.join(self.bin_dir, "runtimes", "node"), os.path.join(self.bin_dir, "node")],
            binary_name="node.exe",
            display_prefix="Node.js"
        )
        os_node = shutil.which("node")
        matrix["node"] = {
            "name": "Node.js",
            "has_vyloserve": len(node_vers) > 0,
            "has_os": bool(os_node),
            "os_path": os_node or "",
            "versions": node_vers,
            "path": node_vers[0]["path"] if node_vers else "",
            "default_mode": node_vers[0]["path"] if node_vers else ("os" if os_node else "none")
        }

        # 3. Python
        py_vers = self._scan_versions(
            base_dirs=[os.path.join(self.bin_dir, "runtimes", "python"), os.path.join(self.bin_dir, "python")],
            binary_name="python.exe",
            display_prefix="Python"
        )
        os_py = shutil.which("python")
        matrix["python"] = {
            "name": "Python",
            "has_vyloserve": len(py_vers) > 0,
            "has_os": bool(os_py),
            "os_path": os_py or "",
            "versions": py_vers,
            "path": py_vers[0]["path"] if py_vers else "",
            "default_mode": py_vers[0]["path"] if py_vers else ("os" if os_py else "none")
        }

        # 4. Java JDK
        java_vers = self._scan_versions(
            base_dirs=[os.path.join(self.bin_dir, "runtimes", "java"), os.path.join(self.bin_dir, "java")],
            binary_name="java.exe",
            bin_subdir="bin",
            display_prefix="Java JDK"
        )
        os_java = shutil.which("java")
        matrix["java"] = {
            "name": "Java JDK",
            "has_vyloserve": len(java_vers) > 0,
            "has_os": bool(os_java),
            "os_path": os_java or "",
            "versions": java_vers,
            "path": java_vers[0]["path"] if java_vers else "",
            "default_mode": java_vers[0]["path"] if java_vers else ("os" if os_java else "none")
        }

        # 5. Go
        go_vers = self._scan_versions(
            base_dirs=[os.path.join(self.bin_dir, "runtimes", "go"), os.path.join(self.bin_dir, "go")],
            binary_name="go.exe",
            bin_subdir="bin",
            display_prefix="Go"
        )
        os_go = shutil.which("go")
        matrix["go"] = {
            "name": "Go",
            "has_vyloserve": len(go_vers) > 0,
            "has_os": bool(os_go),
            "os_path": os_go or "",
            "versions": go_vers,
            "path": go_vers[0]["path"] if go_vers else "",
            "default_mode": go_vers[0]["path"] if go_vers else ("os" if os_go else "none")
        }

        # 6. Composer
        comp_dir = os.path.join(self.bin_dir, "composer")
        comp_vers = []
        if os.path.exists(comp_dir) and (os.path.exists(os.path.join(comp_dir, "composer.phar")) or os.path.exists(os.path.join(comp_dir, "composer.bat"))):
            comp_vers.append({
                "version": "VyloServe",
                "path": comp_dir,
                "display_name": "Composer (VyloServe)"
            })
        os_composer = shutil.which("composer")
        matrix["composer"] = {
            "name": "Composer",
            "has_vyloserve": len(comp_vers) > 0,
            "has_os": bool(os_composer),
            "os_path": os_composer or "",
            "versions": comp_vers,
            "path": comp_dir if comp_vers else "",
            "default_mode": comp_vers[0]["path"] if comp_vers else ("os" if os_composer else "none")
        }

        # 7. Git
        git_vers = []
        for p in (os.path.join(self.bin_dir, "git", "cmd"), os.path.join(self.bin_dir, "git", "bin"), os.path.join(self.bin_dir, "git")):
            if os.path.exists(os.path.join(p, "git.exe")):
                git_vers.append({
                    "version": "VyloServe",
                    "path": p,
                    "display_name": "Git (VyloServe)"
                })
                break
        os_git = shutil.which("git")
        matrix["git"] = {
            "name": "Git",
            "has_vyloserve": len(git_vers) > 0,
            "has_os": bool(os_git),
            "os_path": os_git or "",
            "versions": git_vers,
            "path": git_vers[0]["path"] if git_vers else "",
            "default_mode": git_vers[0]["path"] if git_vers else ("os" if os_git else "none")
        }

        # 8. MariaDB / MySQL Client
        db_cfg_path = os.path.join(self.root_dir, "data", "databases.json")
        mysql_vers = []
        postgres_vers = []
        if os.path.exists(db_cfg_path):
            try:
                from core.utils.file_utils import read_json
                dbs = read_json(db_cfg_path, list)
                for db in dbs:
                    engine_type = db.get("engine", "")
                    inst_bin = os.path.join(db.get("installDir", ""), "bin")
                    if engine_type in ("mysql", "mariadb") and os.path.exists(inst_bin):
                        mysql_vers.append({
                            "version": db.get("version", "default"),
                            "path": inst_bin,
                            "display_name": f"{db.get('name', 'MariaDB/MySQL')} (VyloServe)"
                        })
                    elif engine_type == "postgres" and os.path.exists(inst_bin):
                        postgres_vers.append({
                            "version": db.get("version", "default"),
                            "path": inst_bin,
                            "display_name": f"{db.get('name', 'PostgreSQL')} (VyloServe)"
                        })
            except Exception:
                pass

        os_mysql = shutil.which("mysql")
        if mysql_vers or os_mysql:
            matrix["mysql"] = {
                "name": "MariaDB / MySQL Client",
                "has_vyloserve": len(mysql_vers) > 0,
                "has_os": bool(os_mysql),
                "os_path": os_mysql or "",
                "versions": mysql_vers,
                "path": mysql_vers[0]["path"] if mysql_vers else "",
                "default_mode": mysql_vers[0]["path"] if mysql_vers else ("os" if os_mysql else "none")
            }

        os_psql = shutil.which("psql")
        if postgres_vers or os_psql:
            matrix["postgres"] = {
                "name": "PostgreSQL Client",
                "has_vyloserve": len(postgres_vers) > 0,
                "has_os": bool(os_psql),
                "os_path": os_psql or "",
                "versions": postgres_vers,
                "path": postgres_vers[0]["path"] if postgres_vers else "",
                "default_mode": postgres_vers[0]["path"] if postgres_vers else ("os" if os_psql else "none")
            }

        return matrix

    def _build_session_env(
        self,
        env_overrides: Optional[dict] = None,
        env_profile: Optional[dict] = None
    ) -> Dict[str, str]:
        """
        Menyiapkan variabel lingkungan untuk sesi terminal.
        Menghormati pilihan runtime profile (apakah mengutamakan modul VyloServe
        atau bawaan OS, atau versi spesifik tertentu).
        """
        env = os.environ.copy()
        profile = env_profile or {}
        extra_paths: List[str] = []

        matrix = self.get_runtimes_matrix()

        for engine_key, item in matrix.items():
            user_choice = profile.get(engine_key, item["default_mode"])
            if user_choice in ("os", "none"):
                continue

            target_path = ""
            if isinstance(user_choice, str) and os.path.isdir(user_choice):
                target_path = user_choice
            elif user_choice == "vyloserve":
                if item.get("versions") and len(item["versions"]) > 0:
                    target_path = item["versions"][0]["path"]
                elif item.get("path") and os.path.isdir(item["path"]):
                    target_path = item["path"]

            if target_path and target_path not in extra_paths:
                extra_paths.append(target_path)

                if engine_key == "python":
                    scripts_dir = os.path.join(target_path, "Scripts")
                    if os.path.exists(scripts_dir) and scripts_dir not in extra_paths:
                        extra_paths.append(scripts_dir)
                elif engine_key == "java":
                    java_home = os.path.dirname(target_path) if os.path.basename(target_path).lower() == "bin" else target_path
                    env["JAVA_HOME"] = java_home
                elif engine_key == "go":
                    go_root = os.path.dirname(target_path) if os.path.basename(target_path).lower() == "bin" else target_path
                    env["GOROOT"] = go_root

        if extra_paths:
            current_path = env.get("PATH", "")
            env["PATH"] = os.pathsep.join(extra_paths) + os.pathsep + current_path

        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"

        if env_overrides:
            env.update({str(k): str(v) for k, v in env_overrides.items()})

        return env

    def _resolve_cwd(self, cwd: Optional[str] = None) -> str:
        """
        Memvalidasi dan menormalkan path direktori kerja (mencegah path traversal).
        """
        if cwd:
            try:
                expanded = os.path.expanduser(os.path.expandvars(cwd))
                real = os.path.realpath(expanded)
                if os.path.isdir(real):
                    return real
            except Exception:
                pass

        home = os.path.expanduser("~")
        if os.path.isdir(home):
            return home
        return self.root_dir

    def create_session(
        self,
        shell_id: str = "powershell",
        cwd: Optional[str] = None,
        title: Optional[str] = None,
        env_overrides: Optional[dict] = None,
        env_profile: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Membuat sesi terminal baru dan memulai background reader thread.
        """
        cmd_list = self._resolve_shell_command(shell_id)
        if not cmd_list:
            return {"status": "error", "message": "backend.terminal.shell_not_found"}

        safe_cwd = self._resolve_cwd(cwd)
        env = self._build_session_env(env_overrides, env_profile)
        session_id = str(uuid.uuid4())
        display_title = title or shell_id.capitalize()

        try:
            from winpty import PtyProcess
            pty = PtyProcess.spawn(cmd_list, cwd=safe_cwd, env=env)
        except Exception as e:
            self._log("backend.terminal.spawn_failed", "error", {"e": str(e)})
            return {"status": "error", "message": "backend.terminal.spawn_failed", "args": {"e": str(e)}}

        stop_event = threading.Event()

        def _reader_thread_func():
            try:
                while not stop_event.is_set():
                    try:
                        data = pty.read(1024)
                        if not data:
                            break
                        if hasattr(self.api, "emit_terminal_output"):
                            self.api.emit_terminal_output(session_id, data)
                    except EOFError:
                        break
                    except Exception:
                        break
            finally:
                exit_code = 0
                try:
                    exit_code = pty.exitstatus or 0
                except Exception:
                    pass
                if hasattr(self.api, "emit_terminal_exit"):
                    self.api.emit_terminal_exit(session_id, exit_code)
                with self._lock:
                    self._sessions.pop(session_id, None)

        reader_thread = threading.Thread(target=_reader_thread_func, daemon=True, name=f"TermReader-{session_id[:8]}")
        reader_thread.start()

        session_info = {
            "id": session_id,
            "title": display_title,
            "shell_id": shell_id,
            "cwd": safe_cwd,
            "pty": pty,
            "thread": reader_thread,
            "stop_event": stop_event,
            "pid": getattr(pty, "pid", None)
        }

        with self._lock:
            self._sessions[session_id] = session_info

        return {
            "status": "success",
            "message": "backend.terminal.session_created",
            "session": {
                "id": session_id,
                "title": display_title,
                "shell_id": shell_id,
                "cwd": safe_cwd
            }
        }

    def send_input(self, session_id: str, data: str) -> Dict[str, Any]:
        """
        Mengirim input karakter/ANSI dari UI ke PTY stdin.
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session or not session.get("pty"):
            return {"status": "error", "message": "backend.terminal.session_not_found"}

        try:
            session["pty"].write(data)
            return {"status": "success", "message": "backend.terminal.input_sent"}
        except Exception as e:
            return {"status": "error", "message": "backend.terminal.spawn_failed", "args": {"e": str(e)}}

    def resize(self, session_id: str, cols: int, rows: int) -> Dict[str, Any]:
        """
        Menyesuaikan ukuran dimensi PTY (baris dan kolom).
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session or not session.get("pty"):
            return {"status": "error", "message": "backend.terminal.session_not_found"}

        try:
            safe_rows = max(1, int(rows))
            safe_cols = max(1, int(cols))
            session["pty"].setwinsize(safe_rows, safe_cols)
            return {"status": "success", "message": "backend.terminal.resized"}
        except Exception as e:
            return {"status": "error", "message": "backend.terminal.spawn_failed", "args": {"e": str(e)}}

    def close_session(self, session_id: str) -> Dict[str, Any]:
        """
        Menutup sesi PTY dan membersihkan reader thread.
        """
        with self._lock:
            session = self._sessions.pop(session_id, None)

        if not session:
            return {"status": "error", "message": "backend.terminal.session_not_found"}

        session["stop_event"].set()
        try:
            session["pty"].close()
        except Exception:
            pass

        return {"status": "success", "message": "backend.terminal.session_closed"}

    def list_sessions(self) -> Dict[str, Any]:
        """
        Mengembalikan daftar sesi yang aktif.
        """
        with self._lock:
            active = [
                {
                    "id": s["id"],
                    "title": s["title"],
                    "shell_id": s["shell_id"],
                    "cwd": s["cwd"]
                }
                for s in self._sessions.values()
            ]
        return {"status": "success", "sessions": active}

    def cleanup_all(self):
        """
        Membersihkan seluruh proses PTY yang masih hidup saat aplikasi shutdown.
        """
        with self._lock:
            sessions_to_close = list(self._sessions.values())
            self._sessions.clear()

        for s in sessions_to_close:
            try:
                s["stop_event"].set()
                s["pty"].close()
            except Exception:
                pass
