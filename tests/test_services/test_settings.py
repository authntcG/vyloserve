import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.settings import SettingsManager

@pytest.fixture
def settings_manager(mock_api, tmp_path):
    """Fixture to create a SettingsManager instance with a temporary root directory."""
    with patch('core.services.settings.get_project_root', return_value=str(tmp_path)):
        manager = SettingsManager(mock_api)
        # Ensure the data directory exists since file_utils might expect it
        os.makedirs(manager.data_dir, exist_ok=True)
        return manager

def test_get_settings_default(settings_manager):
    """Test get_settings when the settings file does not exist."""
    res = settings_manager.get_settings()
    assert res['status'] == 'success'
    assert res['data']['language'] == 'en'

def test_save_and_get_settings(settings_manager):
    """Test saving settings and then retrieving the merged settings."""
    # Simpan custom language
    res_save = settings_manager.save_settings({"language": "id", "theme": "dark"})
    assert res_save['status'] == 'success'
    
    # Ambil kembali
    res_get = settings_manager.get_settings()
    assert res_get['status'] == 'success'
    assert res_get['data']['language'] == 'id'
    assert res_get['data']['theme'] == 'dark'

@patch('core.services.settings.write_json')
def test_save_settings_error(mock_write_json, settings_manager, mock_api):
    """Test save_settings when write_json fails."""
    mock_write_json.return_value = False
    
    res = settings_manager.save_settings({"language": "fr"})
    assert res['status'] == 'error'
    assert "diblokir oleh OS" in res['message']
    
    # Verify that the API emitted an error log
    mock_api.emit_log.assert_called_once()
    assert "Gagal menyimpan pengaturan aplikasi" in mock_api.emit_log.call_args[0][0]

@patch('core.services.settings.read_json')
def test_get_settings_exception(mock_read_json, settings_manager, mock_api):
    """Test get_settings when an unexpected exception occurs."""
    mock_read_json.side_effect = Exception("Disk failure")
    
    res = settings_manager.get_settings()
    assert res['status'] == 'error'
    assert res['message'] == 'Disk failure'
    
    mock_api.emit_log.assert_called_once()
    assert "Gagal membaca pengaturan aplikasi" in mock_api.emit_log.call_args[0][0]
