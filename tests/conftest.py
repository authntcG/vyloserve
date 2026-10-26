import pytest
from unittest.mock import MagicMock

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
