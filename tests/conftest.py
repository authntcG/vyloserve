import sys
import ctypes
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

    import os
    if not hasattr(os, 'startfile'):
        os.startfile = MagicMock()

    import subprocess
    if not hasattr(subprocess, 'CREATE_NEW_PROCESS_GROUP'):
        subprocess.CREATE_NEW_PROCESS_GROUP = 0x00000200
    if not hasattr(subprocess, 'DETACHED_PROCESS'):
        subprocess.DETACHED_PROCESS = 0x00000008

    import shutil
    if hasattr(shutil, '_winapi') and shutil._winapi is None:
        mock_shutil_winapi = MagicMock()
        mock_shutil_winapi.NeedCurrentDirectoryForExePath = MagicMock(return_value=False)
        shutil._winapi = mock_shutil_winapi

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
