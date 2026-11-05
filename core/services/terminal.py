import os
import sys
import re
import uuid
import time
import shutil
import threading
from typing import Dict, Any, List, Optional, Tuple
from core.utils.system_utils import get_project_root, set_path_in_env
from core.utils.file_utils import read_json, write_json

CMD_DIR_COMMANDS = ("cd", "chdir", "pushd", "dir", "md", "mkdir", "rd", "rmdir", "tree")
ANSI_ESCAPE_RE = re.compile(r'\x1b(?:\[[0-9;?]*[a-zA-Z~]|\][^\x07\x1b]*(\x07|\x1b\\)|[PX^_].*?\x1b\\|.)')

DIR_WINDOWS = "C:\\Windows"
EXE_POWERSHELL = "powershell.exe"
MSG_SPAWN_FAILED = "backend.terminal.spawn_failed"
MSG_SESSION_NOT_FOUND = "backend.terminal.session_not_found"

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

    @staticmethod
    def _resolve_default_mode(versions: list, os_path: Optional[str]) -> str:
        if versions:
            return versions[0]["path"]
        return "os" if os_path else "none"

    def _detect_linux_shells(self) -> List[Dict[str, Any]]:
        default_user_shell = os.environ.get("SHELL", "")
        bash_path = shutil.which("bash") or ("/bin/bash" if os.path.exists("/bin/bash") else "")
        is_bash_default = bool(not default_user_shell or "bash" in default_user_shell)

        zsh_path = shutil.which("zsh") or ("/bin/zsh" if os.path.exists("/bin/zsh") else "")
        is_zsh_default = bool(default_user_shell and "zsh" in default_user_shell)

        sh_path = shutil.which("sh") or ("/bin/sh" if os.path.exists("/bin/sh") else "")
        pwsh_path = shutil.which("pwsh")

        return [
            {
                "id": "bash",
                "name": "Bash",
                "icon": "terminal",
                "available": bool(bash_path),
                "path": bash_path,
                "is_default": is_bash_default
            },
            {
                "id": "zsh",
                "name": "Zsh",
                "icon": "terminal",
                "available": bool(zsh_path),
                "path": zsh_path,
                "is_default": is_zsh_default and not is_bash_default
            },
            {
                "id": "sh",
                "name": "POSIX Shell",
                "icon": "terminal",
                "available": bool(sh_path),
                "path": sh_path,
                "is_default": False
            },
            {
                "id": "powershell",
                "name": "PowerShell Core",
                "icon": "terminal",
                "available": bool(pwsh_path),
                "path": pwsh_path or "",
                "is_default": False
            }
        ]

    def _detect_powershell(self) -> Dict[str, Any]:
        pwsh_path = shutil.which("pwsh")
        powershell_path = shutil.which("powershell")
        if not powershell_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", DIR_WINDOWS)
            fallback_ps = os.path.join(system_root, "System32", "WindowsPowerShell", "v1.0", EXE_POWERSHELL)
            if os.path.exists(fallback_ps):
                powershell_path = fallback_ps

        primary_ps_path = pwsh_path or powershell_path
        return {
            "id": "powershell",
            "name": "PowerShell",
            "icon": "terminal",
            "available": bool(primary_ps_path),
            "path": primary_ps_path or "",
            "is_default": sys.platform == "win32"
        }

    def _detect_cmd(self) -> Dict[str, Any]:
        cmd_path = shutil.which("cmd") or os.environ.get("COMSPEC", "")
        if not cmd_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", DIR_WINDOWS)
            fallback_cmd = os.path.join(system_root, "System32", "cmd.exe")
            if os.path.exists(fallback_cmd):
                cmd_path = fallback_cmd

        return {
            "id": "cmd",
            "name": "Command Prompt",
            "icon": "terminal",
            "available": bool(cmd_path and os.path.exists(cmd_path)),
            "path": cmd_path or "",
            "is_default": False
        }

    def _detect_git_bash(self) -> Dict[str, Any]:
        git_bash_candidates = [
            shutil.which("bash"),
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
            os.path.join(self.bin_dir, "git", "bin", "bash.exe")
        ]
        git_bash_path = next((p for p in git_bash_candidates if p and os.path.exists(p)), None)
        return {
            "id": "git-bash",
            "name": "Git Bash",
            "icon": "terminal",
            "available": bool(git_bash_path),
            "path": git_bash_path or "",
            "is_default": False
        }

    def _detect_wsl(self) -> Dict[str, Any]:
        wsl_path = shutil.which("wsl")
        if not wsl_path and sys.platform == "win32":
            system_root = os.environ.get("SystemRoot", DIR_WINDOWS)
            fallback_wsl = os.path.join(system_root, "System32", "wsl.exe")
            if os.path.exists(fallback_wsl):
                wsl_path = fallback_wsl

        return {
            "id": "wsl",
            "name": "WSL",
            "icon": "terminal",
            "available": bool(wsl_path and os.path.exists(wsl_path)),
            "path": wsl_path or "",
            "is_default": False
        }

    def get_available_shells(self) -> List[Dict[str, Any]]:
        """
        Mendeteksi ketersediaan shell di sistem operasi (Windows / Linux / macOS).
        Mengembalikan daftar shell dengan flag availability dan penanda default.
        """
        if sys.platform != "win32":
            return self._detect_linux_shells()

        return [
            self._detect_powershell(),
            self._detect_cmd(),
            self._detect_git_bash(),
            self._detect_wsl()
        ]

    def _resolve_powershell_cmd(self, target: Optional[Dict[str, Any]]) -> List[str]:
        if target and target.get("available"):
            return [target["path"], "-NoLogo"]
        pwsh = shutil.which("pwsh") or shutil.which("powershell") or (EXE_POWERSHELL if sys.platform == "win32" else "pwsh")
        return [pwsh, "-NoLogo"]

    def _resolve_cmd_shell(self, target: Optional[Dict[str, Any]]) -> List[str]:
        if target and target.get("available"):
            return [target["path"]]
        return [shutil.which("cmd") or "cmd.exe"]

    def get_default_shell_id(self) -> str:
        """
        Mengembalikan ID shell default yang sesuai untuk platform OS saat ini.
        Di Windows: 'powershell'. Di Linux/macOS: 'bash' (atau 'zsh' jika default user shell).
        """
        for s in self.get_available_shells():
            if s.get("is_default") and s.get("available"):
                return s["id"]
        for s in self.get_available_shells():
            if s.get("available"):
                return s["id"]
        return "powershell" if sys.platform == "win32" else "bash"

    def _resolve_shell_command(self, shell_id: str) -> Optional[List[str]]:
        """
        Menentukan command line executable berdasarkan shell_id yang diminta lintas-platform.
        """
        available = {s["id"]: s for s in self.get_available_shells()}
        target = available.get(shell_id)

        # Linux Shells
        if shell_id in ("bash", "zsh", "sh"):
            if target and target["available"]:
                return [target["path"]]
            bin_path = shutil.which(shell_id) or (f"/bin/{shell_id}" if os.path.exists(f"/bin/{shell_id}") else None)
            return [bin_path] if bin_path else ["/bin/sh"]

        if shell_id == "powershell":
            return self._resolve_powershell_cmd(target)
        if shell_id == "cmd":
            return self._resolve_cmd_shell(target)
        if shell_id == "git-bash":
            return [target["path"], "--login", "-i"] if (target and target.get("available")) else None
        if shell_id == "wsl":
            return [target["path"]] if (target and target.get("available")) else None

        if sys.platform != "win32":
            default_sh = shutil.which("bash") or shutil.which("sh") or "/bin/sh"
            return [default_sh]

        return self._resolve_powershell_cmd(None)

    @staticmethod
    def _get_binary_candidates(binary_name: str) -> List[str]:
        cands = [binary_name]
        clean = binary_name.replace(".exe", "")
        if clean not in cands:
            cands.append(clean)
        exe_name = f"{clean}.exe"
        if exe_name not in cands:
            cands.append(exe_name)
        if clean == "python" and "python3" not in cands:
            cands.append("python3")
        return cands

    def _scan_hierarchical_versions(
        self,
        base: str,
        binary_name: str,
        bin_subdir: str,
        display_prefix: str,
        seen_paths: set
    ) -> List[Dict[str, str]]:
        found = []
        cands = self._get_binary_candidates(binary_name)
        try:
            for entry in sorted(os.listdir(base), reverse=True):
                sub = os.path.join(base, entry)
                if not os.path.isdir(sub):
                    continue

                sub_bin_dir = os.path.join(sub, bin_subdir) if bin_subdir else sub
                bin_exists_in_sub_bin = any(os.path.exists(os.path.join(sub_bin_dir, b)) for b in cands)
                bin_exists_in_sub = any(os.path.exists(os.path.join(sub, b)) for b in cands)
                bin_exists_in_nested_bin = any(os.path.exists(os.path.join(sub, "bin", b)) for b in cands)

                if not bin_exists_in_sub_bin and bin_exists_in_sub:
                    sub_bin_dir = sub
                elif not bin_exists_in_sub_bin and bin_exists_in_nested_bin:
                    sub_bin_dir = os.path.join(sub, "bin")

                if any(os.path.exists(os.path.join(sub_bin_dir, b)) for b in cands) and sub_bin_dir not in seen_paths:
                    seen_paths.add(sub_bin_dir)
                    clean_ver = entry.replace("php-", "").replace("node-", "").replace("python-", "").replace("go", "")
                    display_ver = clean_ver if clean_ver else entry
                    found.append({
                        "version": display_ver,
                        "path": sub_bin_dir,
                        "display_name": f"{display_prefix} {display_ver} (VyloServe)"
                    })
        except Exception:
            pass
        return found

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
        cands = self._get_binary_candidates(binary_name)

        for base in base_dirs:
            if not os.path.exists(base):
                continue

            sub_versions = self._scan_hierarchical_versions(base, binary_name, bin_subdir, display_prefix, seen_paths)
            versions.extend(sub_versions)

            target_bin_dir = os.path.join(base, bin_subdir) if bin_subdir else base
            target_exists = any(os.path.exists(os.path.join(target_bin_dir, b)) for b in cands)
            if target_bin_dir not in seen_paths and (target_exists or not sub_versions):
                seen_paths.add(target_bin_dir)
                versions.append({
                    "version": "default",
                    "path": target_bin_dir,
                    "display_name": f"{display_prefix} (VyloServe)"
                })

        return versions

    def _build_runtime_entry(
        self,
        name: str,
        binary_name: str,
        base_dirs: List[str],
        display_prefix: str,
        bin_subdir: str = "",
        os_cmd: Optional[str] = None
    ) -> Dict[str, Any]:
        vers = self._scan_versions(
            base_dirs=base_dirs,
            binary_name=binary_name,
            bin_subdir=bin_subdir,
            display_prefix=display_prefix
        )
        os_binary = shutil.which(os_cmd or binary_name.replace(".exe", ""))
        return {
            "name": name,
            "has_vyloserve": len(vers) > 0,
            "has_os": bool(os_binary),
            "os_path": os_binary or "",
            "versions": vers,
            "path": vers[0]["path"] if vers else "",
            "default_mode": self._resolve_default_mode(vers, os_binary)
        }

    def _detect_composer_entry(self) -> Dict[str, Any]:
        comp_dir = os.path.join(self.bin_dir, "composer")
        comp_vers = []
        has_local_composer = os.path.exists(comp_dir) and (
            os.path.exists(os.path.join(comp_dir, "composer.phar"))
            or os.path.exists(os.path.join(comp_dir, "composer.bat"))
            or os.path.exists(os.path.join(comp_dir, "composer"))
        )
        if has_local_composer:
            comp_vers.append({
                "version": "VyloServe",
                "path": comp_dir,
                "display_name": "Composer (VyloServe)"
            })
        os_composer = shutil.which("composer")
        return {
            "name": "Composer",
            "has_vyloserve": len(comp_vers) > 0,
            "has_os": bool(os_composer),
            "os_path": os_composer or "",
            "versions": comp_vers,
            "path": comp_dir if comp_vers else "",
            "default_mode": self._resolve_default_mode(comp_vers, os_composer)
        }

    def _detect_git_entry(self) -> Dict[str, Any]:
        git_vers = []
        git_bins = ["git.exe"] if sys.platform == "win32" else ["git", "git.exe"]
        for p in (os.path.join(self.bin_dir, "git", "cmd"), os.path.join(self.bin_dir, "git", "bin"), os.path.join(self.bin_dir, "git")):
            if any(os.path.exists(os.path.join(p, b)) for b in git_bins):
                git_vers.append({
                    "version": "VyloServe",
                    "path": p,
                    "display_name": "Git (VyloServe)"
                })
                break
        os_git = shutil.which("git")
        return {
            "name": "Git",
            "has_vyloserve": len(git_vers) > 0,
            "has_os": bool(os_git),
            "os_path": os_git or "",
            "versions": git_vers,
            "path": git_vers[0]["path"] if git_vers else "",
            "default_mode": self._resolve_default_mode(git_vers, os_git)
        }

    def _parse_installed_db_binaries(self) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        db_cfg_path = os.path.join(self.root_dir, "data", "databases.json")
        mysql_vers = []
        postgres_vers = []
        if not os.path.exists(db_cfg_path):
            return mysql_vers, postgres_vers
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
        return mysql_vers, postgres_vers

    def _build_db_client_entry(self, name: str, versions: list, cli_name: str) -> Optional[Dict[str, Any]]:
        os_bin = shutil.which(cli_name)
        if not versions and not os_bin:
            return None
        return {
            "name": name,
            "has_vyloserve": len(versions) > 0,
            "has_os": bool(os_bin),
            "os_path": os_bin or "",
            "versions": versions,
            "path": versions[0]["path"] if versions else "",
            "default_mode": self._resolve_default_mode(versions, os_bin)
        }

    def _detect_db_entries(self) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        mysql_vers, postgres_vers = self._parse_installed_db_binaries()
        mysql_entry = self._build_db_client_entry("MariaDB / MySQL Client", mysql_vers, "mysql")
        pg_entry = self._build_db_client_entry("PostgreSQL Client", postgres_vers, "psql")
        return mysql_entry, pg_entry

    def get_runtimes_matrix(self) -> Dict[str, Any]:
        """
        Memindai seluruh engine yang terpasang di VyloServe (bin/) serta
        membandingkannya dengan ketersediaan di Windows / Linux OS System PATH.
        Mengembalikan metadata yang digunakan frontend untuk mengatur profil runtime.
        """
        exe_ext = ".exe" if sys.platform == "win32" else ""
        matrix: Dict[str, Any] = {
            "php": self._build_runtime_entry("PHP Engine", f"php{exe_ext}", [os.path.join(self.bin_dir, "php")], "PHP"),
            "node": self._build_runtime_entry(
                "Node.js", f"node{exe_ext}", [os.path.join(self.bin_dir, "runtimes", "node"), os.path.join(self.bin_dir, "node")], "Node.js"
            ),
            "python": self._build_runtime_entry(
                "Python", f"python{exe_ext}", [os.path.join(self.bin_dir, "runtimes", "python"), os.path.join(self.bin_dir, "python")], "Python"
            ),
            "java": self._build_runtime_entry(
                "Java JDK", f"java{exe_ext}", [os.path.join(self.bin_dir, "runtimes", "java"), os.path.join(self.bin_dir, "java")], "Java JDK", bin_subdir="bin"
            ),
            "go": self._build_runtime_entry(
                "Go", f"go{exe_ext}", [os.path.join(self.bin_dir, "runtimes", "go"), os.path.join(self.bin_dir, "go")], "Go", bin_subdir="bin"
            ),
            "composer": self._detect_composer_entry(),
            "git": self._detect_git_entry(),
        }

        mysql_entry, pg_entry = self._detect_db_entries()
        if mysql_entry:
            matrix["mysql"] = mysql_entry
        if pg_entry:
            matrix["postgres"] = pg_entry

        return matrix

    def _resolve_engine_target_path(self, user_choice: Any, item: Dict[str, Any]) -> str:
        if isinstance(user_choice, str) and os.path.isdir(user_choice):
            return user_choice
        if user_choice == "vyloserve":
            if item.get("versions") and len(item["versions"]) > 0:
                return item["versions"][0]["path"]
            if item.get("path") and os.path.isdir(item["path"]):
                return item["path"]
        return ""

    def _apply_engine_env_vars(self, engine_key: str, target_path: str, extra_paths: List[str], env: Dict[str, str]) -> None:
        if engine_key == "python":
            scripts_dir = os.path.join(target_path, "Scripts")
            bin_dir = os.path.join(target_path, "bin")
            if os.path.exists(scripts_dir) and scripts_dir not in extra_paths:
                extra_paths.append(scripts_dir)
            if os.path.exists(bin_dir) and bin_dir not in extra_paths:
                extra_paths.append(bin_dir)
        elif engine_key == "node":
            bin_dir = os.path.join(target_path, "bin")
            if os.path.exists(bin_dir) and bin_dir not in extra_paths:
                extra_paths.append(bin_dir)
        elif engine_key in ("java", "go"):
            base_home = os.path.dirname(target_path) if os.path.basename(target_path).lower() == "bin" else target_path
            env["JAVA_HOME" if engine_key == "java" else "GOROOT"] = base_home

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

            target_path = self._resolve_engine_target_path(user_choice, item)
            if target_path and target_path not in extra_paths:
                extra_paths.append(target_path)
                self._apply_engine_env_vars(engine_key, target_path, extra_paths, env)

        if extra_paths:
            set_path_in_env(env, extra_paths)

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

    def _run_pty_reader_loop(self, pty, session_id: str, stop_event: threading.Event) -> None:
        try:
            while not stop_event.is_set():
                try:
                    data = pty.read(1024)
                    if not data:
                        break
                    if hasattr(self.api, "emit_terminal_output"):
                        self.api.emit_terminal_output(session_id, data)
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

    def create_session(
        self,
        shell_id: Optional[str] = None,
        cwd: Optional[str] = None,
        title: Optional[str] = None,
        env_overrides: Optional[dict] = None,
        env_profile: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Membuat sesi terminal baru dan memulai background reader thread.
        """
        if not shell_id:
            shell_id = self.get_default_shell_id()
        cmd_list = self._resolve_shell_command(shell_id)
        if not cmd_list:
            return {"status": "error", "message": "backend.terminal.shell_not_found"}

        safe_cwd = self._resolve_cwd(cwd)
        env = self._build_session_env(env_overrides, env_profile)
        session_id = str(uuid.uuid4())
        display_title = title or shell_id.capitalize()

        try:
            if sys.platform == 'win32':
                from winpty import PtyProcess
                pty = PtyProcess.spawn(cmd_list, cwd=safe_cwd, env=env)
            else:
                from ptyprocess import PtyProcessUnicode
                pty = PtyProcessUnicode.spawn(cmd_list, cwd=safe_cwd, env=env)
        except Exception as e:
            self._log(MSG_SPAWN_FAILED, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_SPAWN_FAILED, "args": {"e": str(e)}}

        stop_event = threading.Event()
        reader_thread = threading.Thread(
            target=self._run_pty_reader_loop,
            args=(pty, session_id, stop_event),
            daemon=True,
            name=f"TermReader-{session_id[:8]}"
        )
        reader_thread.start()

        session_info = {
            "id": session_id,
            "title": display_title,
            "shell_id": shell_id,
            "cwd": safe_cwd,
            "pty": pty,
            "thread": reader_thread,
            "stop_event": stop_event,
            "pid": getattr(pty, "pid", None),
            "cmd_line": "",
            "pending_char": "",
            "last_input_char": ""
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

    @staticmethod
    def _extract_ansi_escape(data: str, i: int) -> Optional[str]:
        if data[i] == "\x1b":
            match = ANSI_ESCAPE_RE.match(data, i)
            if match:
                return match.group(0)
        return None

    @staticmethod
    def _resolve_cmd_pending(ch: str, pending_char: str) -> Tuple[str, str, str]:
        if ch == ":":
            return pending_char + ":", pending_char + ":", ":"
        if ch == "\t":
            return ".\\" + pending_char + "\t\\", ".\\" + pending_char + "\\", "\\"
        return ".\\" + pending_char, ".\\" + pending_char, pending_char

    @staticmethod
    def _resolve_cmd_tab(cmd_line: str) -> Tuple[str, str, str]:
        words = cmd_line.split()
        is_dir_cmd = bool(words and words[0].lower() in CMD_DIR_COMMANDS)
        if is_dir_cmd and cmd_line.endswith(" "):
            return ".\\\t\\", cmd_line + ".\\", "\\"
        if is_dir_cmd or "\\" in cmd_line or "/" in cmd_line:
            if is_dir_cmd and len(words) >= 2:
                last_arg = words[-1]
                if not last_arg.startswith((".", "\\", "/", "-")) and ":" not in last_arg:
                    erase_seq = "\x08" * len(last_arg)
                    return f"{erase_seq}.\\{last_arg}\t\\", cmd_line[:-len(last_arg)] + f".\\{last_arg}\\", "\\"
            return "\t\\", cmd_line + "\\", "\\"
        return "\t", cmd_line, "\t"

    @staticmethod
    def _normalize_cmd_char(ch: str, last_char: str) -> str:
        if ch == "/" and (last_char in (".", ":", "/", "\\", "\t") or last_char.isalnum() or last_char in ("_", "-")):
            return "\\"
        return ch

    @staticmethod
    def _should_prefix_relative_dir(cmd_line: str, ch: str) -> bool:
        words = cmd_line.split()
        return len(words) == 1 and words[0].lower() in CMD_DIR_COMMANDS and cmd_line.endswith(" ") and (ch.isalnum() or ch in ("_", "-"))

    @staticmethod
    def _process_cmd_reset(ch: str, pending_char: str, out: list) -> Tuple[str, str, str]:
        if pending_char:
            out.append(pending_char)
        out.append(ch)
        return "", "", ch

    @staticmethod
    def _process_cmd_backspace(ch: str, pending_char: str, cmd_line: str, out: list) -> Tuple[str, str, str]:
        if pending_char:
            return cmd_line, "", ch
        out.append(ch)
        return (cmd_line[:-1] if cmd_line else ""), "", ch

    def _process_cmd_normal_char(
        self, ch: str, next_ch: Optional[str], cmd_line: str, last_char: str, out: list
    ) -> Tuple[str, str, str, bool]:
        if ch in ("/", "\\") and last_char in ("\\", "/"):
            return cmd_line, "", last_char, False
        norm_ch = self._normalize_cmd_char(ch, last_char)
        if self._should_prefix_relative_dir(cmd_line, norm_ch):
            if next_ch is not None:
                if next_ch != ":":
                    out.append(".\\")
                    cmd_line += ".\\"
            else:
                return cmd_line, norm_ch, last_char, True
        out.append(norm_ch)
        return cmd_line + norm_ch, "", norm_ch, False

    def _handle_cmd_control_char(
        self, ch: str, cmd_line: str, pending_char: str, last_char: str, out: list
    ) -> Tuple[bool, str, str, str]:
        if ch in ("\r", "\n", "\x03", "\x15"):
            new_cmd, new_pending, new_last = self._process_cmd_reset(ch, pending_char, out)
            return True, new_cmd, new_pending, new_last
        if ch in ("\x08", "\x7f"):
            new_cmd, new_pending, new_last = self._process_cmd_backspace(ch, pending_char, cmd_line, out)
            return True, new_cmd, new_pending, new_last
        return False, cmd_line, pending_char, last_char

    def _translate_cmd_input(self, session: dict, data: str) -> str:
        """
        Di Command Prompt (cmd.exe) Windows, ReadConsole tidak otomatis menambahkan prefix
        relative path ('.\\') dan trailing backslash ('\\') pada proses Tab-autocomplete.
        Selain itu, karakter '/' pada path tidak dikenali oleh mesin Tab-autocompletion CMD.

        Fungsi ini menormalkan input untuk sesi CMD.
        """
        cmd_line = session.get("cmd_line", "")
        pending_char = session.get("pending_char", "")
        last_char = session.get("last_input_char", "")
        out = []
        i = 0
        n = len(data)

        while i < n:
            seq = self._extract_ansi_escape(data, i)
            if seq:
                out.append(seq)
                i += len(seq)
                continue

            ch = data[i]

            handled, cmd_line, pending_char, last_char = self._handle_cmd_control_char(
                ch, cmd_line, pending_char, last_char, out
            )
            if handled:
                i += 1
                continue

            if pending_char:
                out_chunk, line_add, last_char = self._resolve_cmd_pending(ch, pending_char)
                out.append(out_chunk)
                cmd_line += line_add
                pending_char = ""
                if ch in (":", "\t"):
                    i += 1
                    continue

            if ch == "\t":
                out_tab, cmd_line, last_char = self._resolve_cmd_tab(cmd_line)
                out.append(out_tab)
                i += 1
                continue

            next_ch = data[i + 1] if i + 1 < n else None
            cmd_line, pending_char, last_char, _ = self._process_cmd_normal_char(
                ch, next_ch, cmd_line, last_char, out
            )
            i += 1

        session["cmd_line"] = cmd_line
        session["pending_char"] = pending_char
        session["last_input_char"] = last_char
        return "".join(out)

    def send_input(self, session_id: str, data: str, line_context: str = "") -> Dict[str, Any]:
        """
        Mengirim input karakter/ANSI dari UI ke PTY stdin.
        Menerima line_context opsional dari active buffer terminal untuk sinkronisasi state.
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session or not session.get("pty"):
            return {"status": "error", "message": MSG_SESSION_NOT_FOUND}

        try:
            # Sinkronisasi baris perintah aktual dari xterm jika dikirim saat Tab autocomplete
            if line_context and data == "\t":
                cmd_after_prompt = line_context
                for prompt_char in (">", "$", "#"):
                    if prompt_char in cmd_after_prompt:
                        cmd_after_prompt = cmd_after_prompt[cmd_after_prompt.rfind(prompt_char) + 1:]
                cmd_after_prompt = cmd_after_prompt.strip()
                if cmd_after_prompt:
                    session["cmd_line"] = cmd_after_prompt

            if session.get("shell_id") == "cmd" and data:
                data = self._translate_cmd_input(session, data)

            session["pty"].write(data)
            return {"status": "success", "message": "backend.terminal.input_sent"}
        except Exception as e:
            return {"status": "error", "message": MSG_SPAWN_FAILED, "args": {"e": str(e)}}

    def resize(self, session_id: str, cols: int, rows: int) -> Dict[str, Any]:
        """
        Menyesuaikan ukuran dimensi PTY (baris dan kolom).
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session or not session.get("pty"):
            return {"status": "error", "message": MSG_SESSION_NOT_FOUND}

        try:
            safe_rows = max(1, int(rows))
            safe_cols = max(1, int(cols))
            session["pty"].setwinsize(safe_rows, safe_cols)
            return {"status": "success", "message": "backend.terminal.resized"}
        except Exception as e:
            return {"status": "error", "message": MSG_SPAWN_FAILED, "args": {"e": str(e)}}

    def close_session(self, session_id: str) -> Dict[str, Any]:
        """
        Menutup sesi PTY dan membersihkan reader thread.
        """
        with self._lock:
            session = self._sessions.pop(session_id, None)

        if not session:
            return {"status": "error", "message": MSG_SESSION_NOT_FOUND}

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

    @property
    def config_file(self) -> str:
        return os.path.join(self.root_dir, "data", "terminal_config.json")

    @property
    def sessions_file(self) -> str:
        return os.path.join(self.root_dir, "data", "terminal_sessions.json")

    DEFAULT_SETTINGS: Dict[str, Any] = {
        "fontFamily": "Consolas, 'Fira Code', Monaco, monospace",
        "fontSize": 13,
        "lineHeight": 1.2,
        "theme": "vyloserve-dark",
        "cursorStyle": "block",
        "cursorBlink": True,
        "cursorBlinkStyle": "classic",
        "defaultCwd": "",
        "defaultShell": "powershell",
        "scrollback": 5000,
        "copyOnSelect": False
    }

    def _sanitize_history_buffer(self, raw_buffer: Any) -> str:
        """
        Membersihkan dan membatasi kuota buffer riwayat log (maksimal 1.000 baris atau ~150KB)
        untuk mencegah konsumsi memori dan disk yang berlebihan.
        """
        if not isinstance(raw_buffer, str):
            return ""
        if len(raw_buffer) > 150000:
            raw_buffer = raw_buffer[-150000:]
        lines = raw_buffer.splitlines()
        if len(lines) > 1000:
            lines = lines[-1000:]
        return "\n".join(lines)

    @staticmethod
    def _inspect_process_cwd(pid: int) -> Optional[str]:
        try:
            import psutil
            if not psutil.pid_exists(pid):
                return None
            proc = psutil.Process(pid)
            for child in reversed(proc.children(recursive=True)):
                try:
                    child_cwd = child.cwd()
                    if child_cwd and os.path.isdir(child_cwd):
                        return child_cwd
                except Exception:
                    pass
            proc_cwd = proc.cwd()
            if proc_cwd and os.path.isdir(proc_cwd):
                return proc_cwd
        except Exception:
            pass
        return None

    def get_session_cwd(self, session_id: str) -> Dict[str, Any]:
        """
        Mendeteksi direktori kerja terkini (last CWD) dari sesi terminal yang sedang berjalan.
        Menginspeksi proses PTY dan sub-proses aktif (mis. saat menjalankan dev server/tooling)
        via psutil, dengan fallback ke direktori awal sesi jika proses telah keluar.
        """
        with self._lock:
            session = self._sessions.get(session_id)

        if not session:
            return {"status": "error", "message": MSG_SESSION_NOT_FOUND}

        pid = session.get("pid")
        detected_cwd = self._inspect_process_cwd(pid) if pid else None

        if not detected_cwd:
            detected_cwd = session.get("cwd", "")

        safe_cwd = self._resolve_cwd(detected_cwd)
        return {"status": "success", "cwd": safe_cwd}

    def get_terminal_config(self) -> Dict[str, Any]:
        """
        Mengambil konfigurasi terminal tersimpan (misal default environment profile dan preferensi).
        """
        data = read_json(self.config_file, dict)
        if not isinstance(data.get("default_profile"), dict):
            data["default_profile"] = {}
        saved_settings = data.get("settings")
        if not isinstance(saved_settings, dict):
            data["settings"] = self.DEFAULT_SETTINGS.copy()
        else:
            data["settings"] = {**self.DEFAULT_SETTINGS, **saved_settings}
        return {"status": "success", "config": data}

    def save_terminal_default_profile(self, profile: dict) -> Dict[str, Any]:
        """
        Menyimpan profil environment default untuk semua tab terminal baru.
        """
        if not isinstance(profile, dict):
            return {"status": "error", "message": "backend.terminal.invalid_profile"}

        cfg = read_json(self.config_file, dict)
        cfg["default_profile"] = profile
        write_json(self.config_file, cfg)
        return {"status": "success", "message": "backend.terminal.config_saved", "config": cfg}

    def _sanitize_setting_value(self, key: str, value: Any) -> Any:
        if key == "defaultCwd" and value:
            return self._resolve_cwd(str(value))
        if key == "fontSize" and isinstance(value, (int, float)):
            return max(9, min(24, int(value)))
        if key == "scrollback" and isinstance(value, int):
            return max(500, min(20000, value))
        if key in ("cursorStyle", "cursorBlinkStyle") and value in ("block", "underline", "bar", "classic", "smooth", "gradient", "none"):
            return value
        if key in ("cursorBlink", "copyOnSelect") and isinstance(value, bool):
            return value
        return value

    def save_terminal_settings(self, settings: dict) -> Dict[str, Any]:
        """
        Menyimpan preferensi kustomisasi terminal (font, tema, kursor, dll).
        """
        if not isinstance(settings, dict):
            return {"status": "error", "message": "backend.terminal.invalid_settings"}

        cfg = read_json(self.config_file, dict)
        current_settings = cfg.get("settings", {})
        if not isinstance(current_settings, dict):
            current_settings = self.DEFAULT_SETTINGS.copy()

        merged_settings = {**self.DEFAULT_SETTINGS, **current_settings}
        for k, v in settings.items():
            if k in self.DEFAULT_SETTINGS:
                merged_settings[k] = self._sanitize_setting_value(k, v)

        cfg["settings"] = merged_settings
        write_json(self.config_file, cfg)
        return {"status": "success", "message": "backend.terminal.settings_saved", "settings": merged_settings}

    def get_saved_sessions(self) -> Dict[str, Any]:
        """
        Mengambil seluruh preset sesi dan multi-tab workspace yang tersimpan.
        """
        data = read_json(self.sessions_file, dict)
        presets = data.get("presets", []) if isinstance(data.get("presets"), list) else []
        workspaces = data.get("workspaces", []) if isinstance(data.get("workspaces"), list) else []
        return {
            "status": "success",
            "presets": presets,
            "workspaces": workspaces
        }

    def save_preset(self, preset_data: dict) -> Dict[str, Any]:
        """
        Menyimpan atau memperbarui preset sesi terminal tunggal.
        """
        if not isinstance(preset_data, dict):
            return {"status": "error", "message": "backend.terminal.invalid_preset"}

        name = str(preset_data.get("name", "")).strip()
        if not name:
            return {"status": "error", "message": "backend.terminal.preset_name_required"}

        preset_id = str(preset_data.get("id") or uuid.uuid4())
        shell_id = str(preset_data.get("shell_id", "powershell"))
        safe_cwd = self._resolve_cwd(preset_data.get("cwd", ""))
        last_cwd = self._resolve_cwd(preset_data.get("lastCwd") or safe_cwd)
        history_buffer = self._sanitize_history_buffer(preset_data.get("historyBuffer", ""))
        env_profile = preset_data.get("envProfile", {})
        if not isinstance(env_profile, dict):
            env_profile = {}

        color = str(preset_data.get("color", "emerald"))
        icon = str(preset_data.get("icon", "terminal"))

        preset_record = {
            "id": preset_id,
            "name": name,
            "shell_id": shell_id,
            "cwd": safe_cwd,
            "lastCwd": last_cwd,
            "historyBuffer": history_buffer,
            "envProfile": env_profile,
            "color": color,
            "icon": icon,
            "createdAt": preset_data.get("createdAt") or int(time.time() * 1000)
        }

        data = read_json(self.sessions_file, dict)
        presets = data.get("presets", []) if isinstance(data.get("presets"), list) else []
        workspaces = data.get("workspaces", []) if isinstance(data.get("workspaces"), list) else []

        idx = next((i for i, p in enumerate(presets) if p.get("id") == preset_id), -1)
        if idx >= 0:
            presets[idx] = preset_record
        else:
            presets.append(preset_record)

        data["presets"] = presets
        data["workspaces"] = workspaces
        write_json(self.sessions_file, data)

        return {
            "status": "success",
            "message": "backend.terminal.preset_saved",
            "preset": preset_record
        }

    def delete_preset(self, preset_id: str) -> Dict[str, Any]:
        """
        Menghapus preset sesi berdasarkan ID.
        """
        if not preset_id:
            return {"status": "error", "message": "backend.terminal.preset_not_found"}

        data = read_json(self.sessions_file, dict)
        presets = data.get("presets", []) if isinstance(data.get("presets"), list) else []
        workspaces = data.get("workspaces", []) if isinstance(data.get("workspaces"), list) else []

        new_presets = [p for p in presets if p.get("id") != preset_id]
        if len(new_presets) == len(presets):
            return {"status": "error", "message": "backend.terminal.preset_not_found"}

        data["presets"] = new_presets
        data["workspaces"] = workspaces
        write_json(self.sessions_file, data)

        return {"status": "success", "message": "backend.terminal.preset_deleted"}

    def _clean_workspace_tab(self, tab: dict) -> Dict[str, Any]:
        tab_cwd = self._resolve_cwd(tab.get("cwd", ""))
        tab_last_cwd = self._resolve_cwd(tab.get("lastCwd") or tab_cwd)
        tab_history = self._sanitize_history_buffer(tab.get("historyBuffer", ""))
        title = tab.get("title") or tab.get("name") or "Terminal"
        env_profile = tab.get("envProfile")
        return {
            "title": str(title),
            "shell_id": str(tab.get("shell_id", "powershell")),
            "cwd": tab_cwd,
            "lastCwd": tab_last_cwd,
            "historyBuffer": tab_history,
            "envProfile": env_profile if isinstance(env_profile, dict) else {},
            "color": str(tab.get("color", "emerald")),
            "icon": str(tab.get("icon", "terminal"))
        }

    def save_workspace(self, workspace_data: dict) -> Dict[str, Any]:
        """
        Menyimpan atau memperbarui preset multi-tab workspace.
        """
        if not isinstance(workspace_data, dict):
            return {"status": "error", "message": "backend.terminal.invalid_workspace"}

        name = str(workspace_data.get("name", "")).strip()
        if not name:
            return {"status": "error", "message": "backend.terminal.workspace_name_required"}

        workspace_id = str(workspace_data.get("id") or uuid.uuid4())
        raw_tabs = workspace_data.get("tabs", [])
        if not isinstance(raw_tabs, list) or len(raw_tabs) == 0:
            return {"status": "error", "message": "backend.terminal.workspace_tabs_required"}

        cleaned_tabs = [self._clean_workspace_tab(tab) for tab in raw_tabs if isinstance(tab, dict)]

        if len(cleaned_tabs) == 0:
            return {"status": "error", "message": "backend.terminal.workspace_tabs_required"}

        workspace_record = {
            "id": workspace_id,
            "name": name,
            "tabs": cleaned_tabs,
            "createdAt": workspace_data.get("createdAt") or int(time.time() * 1000)
        }

        data = read_json(self.sessions_file, dict)
        presets = data.get("presets", []) if isinstance(data.get("presets"), list) else []
        workspaces = data.get("workspaces", []) if isinstance(data.get("workspaces"), list) else []

        idx = next((i for i, w in enumerate(workspaces) if w.get("id") == workspace_id), -1)
        if idx >= 0:
            workspaces[idx] = workspace_record
        else:
            workspaces.append(workspace_record)

        data["presets"] = presets
        data["workspaces"] = workspaces
        write_json(self.sessions_file, data)

        return {
            "status": "success",
            "message": "backend.terminal.workspace_saved",
            "workspace": workspace_record
        }

    def delete_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """
        Menghapus workspace berdasarkan ID.
        """
        if not workspace_id:
            return {"status": "error", "message": "backend.terminal.workspace_not_found"}

        data = read_json(self.sessions_file, dict)
        presets = data.get("presets", []) if isinstance(data.get("presets"), list) else []
        workspaces = data.get("workspaces", []) if isinstance(data.get("workspaces"), list) else []

        new_workspaces = [w for w in workspaces if w.get("id") != workspace_id]
        if len(new_workspaces) == len(workspaces):
            return {"status": "error", "message": "backend.terminal.workspace_not_found"}

        data["presets"] = presets
        data["workspaces"] = new_workspaces
        write_json(self.sessions_file, data)

        return {"status": "success", "message": "backend.terminal.workspace_deleted"}
