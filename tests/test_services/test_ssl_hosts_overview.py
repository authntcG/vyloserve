import os
import sys
import pytest
from unittest.mock import MagicMock, patch, mock_open
from core.services.ssl_manager import SslManager
from core.services.project import ProjectManager

@pytest.fixture
def mock_api():
    api = MagicMock()
    return api

@pytest.fixture
def ssl_mgr(mock_api, tmp_path):
    with patch('core.services.ssl_manager.get_project_root', return_value=str(tmp_path)):
        with patch('os.makedirs'):
            mgr = SslManager(mock_api)
            return mgr

@pytest.fixture
def proj_mgr(mock_api, tmp_path):
    with patch('core.services.project.get_project_root', return_value=str(tmp_path)):
        with patch('os.makedirs'):
            mgr = ProjectManager(mock_api)
            return mgr

def test_ssl_is_ca_installed_windows(ssl_mgr):
    with patch('sys.platform', 'win32'):
        mock_res = MagicMock()
        mock_res.returncode = 0
        mock_res.stdout = "Issuer: CN=VyloServe Local Root CA"
        with patch('core.services.ssl_manager.run_silent_command', return_value=mock_res):
            assert ssl_mgr.is_ca_installed() is True

        mock_res.returncode = 1
        with patch('core.services.ssl_manager.run_silent_command', return_value=mock_res):
            assert ssl_mgr.is_ca_installed() is False

def test_ssl_install_ca_cert_success(ssl_mgr, mock_api):
    with patch('os.path.exists', return_value=True):
        with patch('sys.platform', 'win32'):
            with patch('ctypes.windll.shell32.ShellExecuteW', return_value=42):
                res = ssl_mgr.install_ca_cert()
                assert res["status"] == "success"
                assert res["message"] == "backend.ssl.ca_trusted_success"

def test_ssl_install_ca_cert_uac_denied(ssl_mgr, mock_api):
    with patch('os.path.exists', return_value=True):
        with patch('sys.platform', 'win32'):
            with patch('ctypes.windll.shell32.ShellExecuteW', return_value=0):
                res = ssl_mgr.install_ca_cert()
                assert res["status"] == "error"
                assert res["message"] == "backend.ssl.ca_uac_denied"

def test_project_get_ssl_hosts_overview(proj_mgr, mock_api):
    mock_api.ssl.ca_crt = "C:/data/ssl/VyloServeRootCA.crt"
    mock_api.ssl.is_ca_installed.return_value = True

    projects = [
        {"id": "p1", "name": "laravel", "domain": "laravel.test"},
        {"id": "p2", "name": "nextjs", "domain": "nextjs.test"}
    ]
    hosts_sample = """127.0.0.1 localhost
127.0.0.1 laravel.test
"""
    with patch.object(proj_mgr, 'get_projects', return_value=projects):
        with patch('core.services.project.os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=hosts_sample)):
                res = proj_mgr.get_ssl_hosts_overview()
                assert res["status"] == "success"
                assert res["ca"]["installed"] is True
                assert res["hosts"]["exists"] is True
                entries = res["hosts"]["entries"]
                assert len(entries) == 2
                assert entries[0]["domain"] == "laravel.test"
                assert entries[0]["is_mapped"] is True
                assert entries[1]["domain"] == "nextjs.test"
                assert entries[1]["is_mapped"] is False

def test_project_sync_all_hosts_success(proj_mgr):
    with patch.object(proj_mgr, 'sync_windows_hosts', return_value={"status": "success", "message": "backend.project.hosts_updated"}):
        with patch.object(proj_mgr, 'sync_apache_vhosts', return_value={"status": "success"}):
            res = proj_mgr.sync_all_hosts()
            assert res["status"] == "success"
            assert res["message"] == "backend.project.hosts_all_synced"

def test_project_sync_all_hosts_error(proj_mgr):
    with patch.object(proj_mgr, 'sync_windows_hosts', return_value={"status": "error", "message": "backend.project.hosts_uac_warning"}):
        with patch.object(proj_mgr, 'sync_apache_vhosts') as mock_vhosts:
            res = proj_mgr.sync_all_hosts()
            assert res["status"] == "error"
            assert res["message"] == "backend.project.hosts_uac_warning"
            mock_vhosts.assert_not_called()
