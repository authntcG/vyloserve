import os
import sys
import shutil
import ctypes
import builtins
import pytest
from unittest.mock import MagicMock

# Polyfill mock module 'winreg', 'ctypes.windll', 'win11toast', 'winpty', 'os.startfile'
# untuk non-Windows environment (Linux/macOS) agar test suite Windows dapat diuji secara cross-platform
if sys.platform != 'win32':
    if 'winreg' not in sys.modules:
        mock_winreg = MagicMock()
        mock_winreg.HKEY_CURRENT_USER = 1
        mock_winreg.HKEY_LOCAL_MACHINE = 2
        mock_winreg.KEY_READ = 1
        mock_winreg.KEY_ALL_ACCESS = 2
        mock_winreg.REG_SZ = 1
        mock_winreg.REG_EXPAND_SZ = 2
        mock_winreg.error = OSError
        mock_winreg.OpenKey = MagicMock()
        mock_winreg.CloseKey = MagicMock()
        mock_winreg.QueryValueEx = MagicMock()
        mock_winreg.SetValueEx = MagicMock()
        mock_winreg.DeleteValue = MagicMock()
        mock_winreg.DeleteKey = MagicMock()
        sys.modules['winreg'] = mock_winreg

    if not hasattr(ctypes, 'windll'):
        ctypes.windll = MagicMock()

    if not hasattr(ctypes, 'WINFUNCTYPE'):
        ctypes.WINFUNCTYPE = ctypes.CFUNCTYPE

    if 'win11toast' not in sys.modules:
        mock_toast = MagicMock()
        mock_toast.toast = MagicMock()
        sys.modules['win11toast'] = mock_toast

    if 'winpty' not in sys.modules:
        mock_winpty = MagicMock()
        mock_winpty.PtyProcess = MagicMock()
        sys.modules['winpty'] = mock_winpty

    if not hasattr(os, 'startfile'):
        os.startfile = MagicMock()

    import subprocess
    if not hasattr(subprocess, 'CREATE_NEW_PROCESS_GROUP'):
        subprocess.CREATE_NEW_PROCESS_GROUP = 0x00000200
    if not hasattr(subprocess, 'DETACHED_PROCESS'):
        subprocess.DETACHED_PROCESS = 0x00000008

    if hasattr(shutil, '_winapi') and shutil._winapi is None:
        mock_shutil_winapi = MagicMock()
        mock_shutil_winapi.NeedCurrentDirectoryForExePath = MagicMock(return_value=False)
        shutil._winapi = mock_shutil_winapi

REPO_ROOT = os.path.realpath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPO_DATA_DIR = os.path.realpath(os.path.join(REPO_ROOT, 'data'))
REPO_BIN_DIR = os.path.realpath(os.path.join(REPO_ROOT, 'bin'))

def _is_repo_protected_path(path) -> bool:
    if not path or not isinstance(path, (str, bytes, os.PathLike)):
        return False
    try:
        norm = os.path.realpath(os.path.abspath(str(path)))
        return norm.startswith(REPO_DATA_DIR) or norm.startswith(REPO_BIN_DIR)
    except Exception:
        return False

@pytest.fixture(autouse=True)
def guard_repo_filesystem(monkeypatch):
    r"""
    SANGAT PENTING: Mencegah SELURUH unit test memodifikasi, membuat, atau
    menghapus file/folder nyata di dalam direktori `data/` dan `bin/` repository.
    Jika ada service/manager yang diinstansiasi tanpa isolasi tmp_path atau lupa
    me-mock write_json/file-I/O, fixture ini akan langsung melempar RuntimeError
    alih-alih menimpa file konfigurasi development asli (mis. databases.json).
    """
    orig_open = builtins.open
    orig_remove = os.remove
    orig_unlink = getattr(os, 'unlink', os.remove)
    orig_rmdir = os.rmdir
    orig_rmtree = shutil.rmtree
    orig_mkdir = os.mkdir
    orig_makedirs = os.makedirs

    def guarded_open(file, *args, **kwargs):
        mode = args[0] if args else kwargs.get('mode', 'r')
        if any(m in mode for m in ('w', 'a', 'x', '+')):
            if _is_repo_protected_path(file):
                raise RuntimeError(
                    f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to open repository path '{file}' "
                    f"for writing (mode='{mode}'). All tests touching data/ or bin/ must use tmp_path or mock!"
                )
        return orig_open(file, *args, **kwargs)

    def guarded_remove(path, *args, **kwargs):
        if _is_repo_protected_path(path):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to delete repository file at '{path}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_remove(path, *args, **kwargs)

    def guarded_unlink(path, *args, **kwargs):
        if _is_repo_protected_path(path):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to unlink repository file at '{path}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_unlink(path, *args, **kwargs)

    def guarded_rmdir(path, *args, **kwargs):
        if _is_repo_protected_path(path):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to rmdir repository directory at '{path}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_rmdir(path, *args, **kwargs)

    def guarded_rmtree(path, *args, **kwargs):
        if _is_repo_protected_path(path):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to rmtree repository directory at '{path}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_rmtree(path, *args, **kwargs)

    def guarded_mkdir(path, *args, **kwargs):
        if _is_repo_protected_path(path) and not os.path.exists(path):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to mkdir in repository directory at '{path}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_mkdir(path, *args, **kwargs)

    def guarded_makedirs(name, *args, **kwargs):
        if _is_repo_protected_path(name) and not os.path.exists(name):
            raise RuntimeError(
                f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to makedirs in repository directory at '{name}'. "
                f"All tests touching data/ or bin/ must use tmp_path or mock!"
            )
        return orig_makedirs(name, *args, **kwargs)

    monkeypatch.setattr(builtins, 'open', guarded_open)
    monkeypatch.setattr(os, 'remove', guarded_remove)
    monkeypatch.setattr(os, 'unlink', guarded_unlink)
    monkeypatch.setattr(os, 'rmdir', guarded_rmdir)
    monkeypatch.setattr(shutil, 'rmtree', guarded_rmtree)
    monkeypatch.setattr(os, 'mkdir', guarded_mkdir)
    monkeypatch.setattr(os, 'makedirs', guarded_makedirs)

    try:
        from core.utils import file_utils
        orig_write_json = file_utils.write_json
        def guarded_write_json(file_path, data):
            if _is_repo_protected_path(file_path):
                raise RuntimeError(
                    f"CRITICAL TEST ISOLATION ERROR: Unit test attempted to call write_json on repository path '{file_path}'. "
                    f"All tests touching data/ or bin/ must use tmp_path or mock!"
                )
            return orig_write_json(file_path, data)
        monkeypatch.setattr(file_utils, 'write_json', guarded_write_json)
    except Exception:
        pass

@pytest.fixture(autouse=True)
def guard_process_termination(monkeypatch):
    """
    SANGAT PENTING: Mencegah SELURUH unit test membunuh proses nyata di OS developer
    lewat psutil.Process (terminate/kill).
    Jika ada unit test yang lupa me-mock proses kill atau memanggil stop_server dengan PID tiruan,
    fixture autouse ini menjamin proses desktop dan sistem operasi developer tetap aman.
    """
    try:
        import psutil
        monkeypatch.setattr(psutil.Process, "terminate", MagicMock())
        monkeypatch.setattr(psutil.Process, "kill", MagicMock())
        monkeypatch.setattr(psutil, "wait_procs", MagicMock(return_value=([], [])))
    except (ImportError, AttributeError):
        pass

@pytest.fixture(autouse=True)
def guard_registry_and_env(monkeypatch):
    r"""
    SANGAT PENTING: Mencegah SELURUH unit test memodifikasi Registry Windows nyata
    (HKCU\Environment).
    Jika ada test yang lupa me-mock winreg/modify_user_path, fixture autouse ini
    menjamin tidak akan pernah ada path temporary (seperti pytest-xxx) yang lolos ke OS developer.
    """
    try:
        import winreg
        monkeypatch.setattr(winreg, 'SetValueEx', MagicMock())
        monkeypatch.setattr(winreg, 'DeleteValue', MagicMock())
        monkeypatch.setattr(winreg, 'DeleteKey', MagicMock())
    except (ImportError, AttributeError):
        pass

@pytest.fixture(autouse=True)
def guard_root_and_elevated_commands(monkeypatch):
    r"""
    SANGAT PENTING: Mencegah SELURUH unit test memicu prompt UAC Windows (runas)
    atau prompt sudo / pkexec / systemctl / PolicyKit di Linux.
    Jika ada unit test yang mengeksekusi perintah administrator atau manajemen service sistem
    tanpa di-mock secara spesifik di dalam test tersebut, fixture autouse ini secara otomatis
    mencegatnya dan mengembalikan status sukses (returncode=0) sehingga test berjalan otomatis,
    cepat, dan tanpa pernah memunculkan dialog/popup permintaan password kepada developer.
    """
    import subprocess
    orig_subprocess_run = subprocess.run
    orig_subprocess_popen = subprocess.Popen
    orig_subprocess_call = getattr(subprocess, "call", None)
    orig_subprocess_check_call = getattr(subprocess, "check_call", None)
    orig_subprocess_check_output = getattr(subprocess, "check_output", None)

    ELEVATED_KEYWORDS = (
        "pkexec", "sudo", "runas",
        "systemctl", "service",
        "apache2ctl", "apachectl",
        "a2enmod", "a2dismod", "a2enconf", "a2disconf", "a2ensite", "a2dissite",
        "update-ca-certificates",
        "apt", "apt-get", "dpkg", "dnf", "yum", "pacman", "zypper"
    )

    def _is_elevated(cmd) -> bool:
        if not cmd:
            return False
        if isinstance(cmd, (list, tuple)):
            for part in cmd:
                part_str = os.path.basename(str(part)).lower()
                for kw in ELEVATED_KEYWORDS:
                    if part_str == kw or part_str.startswith(kw):
                        return True
            cmd_str = " ".join(str(c) for c in cmd).lower()
        else:
            cmd_str = str(cmd).lower()
        return any(kw in cmd_str for kw in ELEVATED_KEYWORDS)

    def safe_subprocess_run(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        if _is_elevated(cmd):
            is_text = kwargs.get('text') or kwargs.get('universal_newlines')
            empty_out = "" if is_text else b""
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=empty_out, stderr=empty_out)
        return orig_subprocess_run(*args, **kwargs)

    def safe_subprocess_popen(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        if _is_elevated(cmd):
            is_text = kwargs.get('text') or kwargs.get('universal_newlines')
            empty_out = "" if is_text else b""
            mock_proc = MagicMock()
            mock_proc.poll.return_value = 0
            mock_proc.returncode = 0
            mock_proc.communicate.return_value = (empty_out, empty_out)
            mock_proc.wait.return_value = 0
            mock_proc.pid = 99999
            return mock_proc
        return orig_subprocess_popen(*args, **kwargs)

    def safe_subprocess_call(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        if _is_elevated(cmd):
            return 0
        if orig_subprocess_call:
            return orig_subprocess_call(*args, **kwargs)
        return 0

    def safe_subprocess_check_call(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        if _is_elevated(cmd):
            return 0
        if orig_subprocess_check_call:
            return orig_subprocess_check_call(*args, **kwargs)
        return 0

    def safe_subprocess_check_output(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        if _is_elevated(cmd):
            is_text = kwargs.get('text') or kwargs.get('universal_newlines')
            return "" if is_text else b""
        if orig_subprocess_check_output:
            return orig_subprocess_check_output(*args, **kwargs)
        return b""

    monkeypatch.setattr(subprocess, "run", safe_subprocess_run)
    monkeypatch.setattr(subprocess, "Popen", safe_subprocess_popen)
    if orig_subprocess_call:
        monkeypatch.setattr(subprocess, "call", safe_subprocess_call)
    if orig_subprocess_check_call:
        monkeypatch.setattr(subprocess, "check_call", safe_subprocess_check_call)
    if orig_subprocess_check_output:
        monkeypatch.setattr(subprocess, "check_output", safe_subprocess_check_output)

    try:
        from core.utils import system_utils
        orig_run_silent = system_utils.run_silent_command
        def safe_run_silent_command(cmd, *args, **kwargs):
            if _is_elevated(cmd):
                return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")
            return orig_run_silent(cmd, *args, **kwargs)
        monkeypatch.setattr(system_utils, "run_silent_command", safe_run_silent_command)
    except Exception:
        pass

@pytest.fixture
def mock_api():
    """
    Menyediakan instance API tiruan (Mock) agar kelas Service / Manager 
    tidak error saat mencoba memanggil self.api.emit_log() atau self.api.emit_progress()
    """
    api = MagicMock()
    # Mocking basic methods that are commonly used across services
    api.emit_log = MagicMock()
    api.emit_progress = MagicMock()
    return api
