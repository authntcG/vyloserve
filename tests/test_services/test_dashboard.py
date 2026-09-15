import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.dashboard import DashboardManager

@pytest.fixture
def dashboard_manager(mock_api, tmp_path):
    """Fixture to create a DashboardManager instance with a temporary root directory."""
    with patch('core.services.dashboard.get_project_root', return_value=str(tmp_path)):
        manager = DashboardManager(mock_api)
        os.makedirs(manager.data_dir, exist_ok=True)
        return manager

def test_get_dashboard_default(dashboard_manager):
    """Test get_config when the dashboard settings file does not exist."""
    res = dashboard_manager.get_config()
    assert res['status'] == 'success'
    assert res['data']['apache'] is True
    assert res['data']['database'] is False
    assert res['data']['selected_php'] == []

def test_save_and_get_dashboard(dashboard_manager):
    """Test saving dashboard config and then retrieving it."""
    custom_config = {
        "apache": False,
        "database": True,
        "selected_php": ["php_8_2"],
        "selected_database": ["mysql_8_0"]
    }
    res_save = dashboard_manager.save_config(custom_config)
    assert res_save['status'] == 'success'
    
    res_get = dashboard_manager.get_config()
    assert res_get['status'] == 'success'
    assert res_get['data']['apache'] is False
    assert res_get['data']['database'] is True
    assert "php_8_2" in res_get['data']['selected_php']

@patch('core.services.dashboard.write_json')
def test_save_dashboard_error(mock_write_json, dashboard_manager, mock_api):
    """Test save_config when write_json fails."""
    mock_write_json.return_value = False
    
    res = dashboard_manager.save_config({"apache": True})
    assert res['status'] == 'error'
    assert "diblokir oleh OS" in res['message']
    
    mock_api.emit_log.assert_called_once_with("backend.dashboard.save_failed", "error", {"e": "Proses penulisan diblokir oleh OS."})

@patch('core.services.dashboard.read_json')
def test_get_dashboard_exception(mock_read_json, dashboard_manager, mock_api):
    """Test get_config when an unexpected exception occurs."""
    mock_read_json.side_effect = Exception("Disk failure")
    
    res = dashboard_manager.get_config()
    assert res['status'] == 'error'
    assert res['message'] == 'Disk failure'
    
    mock_api.emit_log.assert_called_once_with("backend.dashboard.read_failed", "error", {"e": "Disk failure"})
