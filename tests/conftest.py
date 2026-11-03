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
