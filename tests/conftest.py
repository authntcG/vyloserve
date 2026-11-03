import os
import shutil
import builtins
import pytest
from unittest.mock import MagicMock

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
