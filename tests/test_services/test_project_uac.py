import os
import pytest
from unittest.mock import patch, MagicMock, mock_open

from core.services.project import ProjectManager

@pytest.fixture
def project_manager(mock_api, tmp_path):
    with patch('core.services.project.get_project_root', return_value=str(tmp_path)):
        return ProjectManager(mock_api)

def test_write_hosts_with_uac_success(project_manager):
    """Test successful hosts write without needing UAC."""
    mock_f = mock_open()
    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'success'
        assert "backend.project.hosts_updated" in res['message']
        mock_f.assert_called_once_with("c:/windows/hosts", 'w', encoding='utf-8')

@patch('ctypes.windll.shell32.ShellExecuteW')
def test_write_hosts_with_uac_permission_error_granted(mock_shell, project_manager):
    """Test UAC elevation granted after permission error."""
    mock_f = mock_open()
    mock_f.side_effect = PermissionError("Access Denied")
    
    mock_shell.return_value = 42 # > 32 means success
    
    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'success'
        assert "backend.project.uac_granted" in res['message']
        mock_shell.assert_called_once()

@patch('ctypes.windll.shell32.ShellExecuteW')
def test_write_hosts_with_uac_permission_error_denied(mock_shell, project_manager):
    """Test UAC elevation denied."""
    mock_f = mock_open()
    mock_f.side_effect = PermissionError("Access Denied")

    mock_shell.return_value = 5 # <= 32 means access denied

    with patch('builtins.open', mock_f):
        res = project_manager._write_hosts_with_uac("c:/windows/hosts", "127.0.0.1 test.local", "c:/temp/hosts")
        assert res['status'] == 'error'
        assert "backend.project.uac_denied" in res['message']
        mock_shell.assert_called_once()

@patch('core.services.project.read_json')
def test_sync_windows_hosts_builds_content_and_delegates_to_uac_writer(mock_read_json, project_manager):
    """
    sync_windows_hosts() harus: (1) mempertahankan baris hosts lama di luar blok
    VyloServe, (2) menghapus TOTAL blok VyloServe lama (termasuk marker BEGIN/END),
    (3) membangun blok baru dari daftar project saat ini, lalu mendelegasikan
    penulisan file ke _write_hosts_with_uac().
    """
    mock_read_json.return_value = [
        {"id": "1", "domain": "app.local"},
        {"id": "2", "domain": "shop.local"},
    ]
    existing_hosts = (
        "127.0.0.1 localhost\n"
        "# --- BEGIN VYLOSERVE HOSTS ---\n"
        "127.0.0.1 old.local\n"
        "# --- END VYLOSERVE HOSTS ---\n"
    )
    m = mock_open(read_data=existing_hosts)
    with patch('builtins.open', m):
        with patch.object(project_manager, '_write_hosts_with_uac', return_value={"status": "success", "message": "ok"}) as mock_write:
            res = project_manager.sync_windows_hosts()

    assert res == {"status": "success", "message": "ok"}
    mock_write.assert_called_once()
    hosts_path_arg, final_content_arg, _temp_file_arg = mock_write.call_args[0]
    assert hosts_path_arg == r"C:\Windows\System32\drivers\etc\hosts"
    assert "127.0.0.1 localhost" in final_content_arg
    assert "old.local" not in final_content_arg
    assert "127.0.0.1 app.local" in final_content_arg
    assert "127.0.0.1 shop.local" in final_content_arg
    assert "# --- BEGIN VYLOSERVE HOSTS ---" in final_content_arg
    assert "# --- END VYLOSERVE HOSTS ---" in final_content_arg

@patch('core.services.project.read_json', return_value=[])
def test_sync_windows_hosts_no_projects_appends_nothing(mock_read_json, project_manager):
    """Edge case: tidak ada project sama sekali -> blok VYLOSERVE tidak boleh ditambahkan."""
    m = mock_open(read_data="127.0.0.1 localhost\n")
    with patch('builtins.open', m):
        with patch.object(project_manager, '_write_hosts_with_uac', return_value={"status": "success"}) as mock_write:
            project_manager.sync_windows_hosts()

    final_content_arg = mock_write.call_args[0][1]
    assert final_content_arg == "127.0.0.1 localhost\n"
    assert "VYLOSERVE" not in final_content_arg

def test_sync_windows_hosts_returns_error_on_read_failure(project_manager):
    """Error path: file hosts tidak bisa dibaca sama sekali (mis. locked oleh proses lain)."""
    with patch('builtins.open', side_effect=OSError("cannot read hosts")):
        res = project_manager.sync_windows_hosts()

    assert res['status'] == 'error'
    assert res['message'] == 'backend.project.hosts_error'
    assert res['args']['e'] == 'cannot read hosts'

def test_sync_hosts_for_project_marks_unsynced_on_uac_failure(project_manager):
    """Jika sync hosts gagal, project terkait harus ditandai host_synced=False dan disimpan."""
    projects = [{"id": "p1", "domain": "a.local", "host_synced": True}]
    with patch.object(project_manager, 'sync_windows_hosts', return_value={"status": "error", "message": "uac_denied"}):
        with patch.object(project_manager, '_save_projects') as mock_save:
            warning = project_manager._sync_hosts_for_project(projects, "p1")

    assert warning is not None
    assert "Administrator" in warning
    assert projects[0]['host_synced'] is False
    mock_save.assert_called_once_with(projects)

def test_sync_hosts_for_project_returns_none_on_success(project_manager):
    """Jika sync hosts sukses, tidak ada warning dan status project tidak diubah."""
    projects = [{"id": "p1", "domain": "a.local", "host_synced": True}]
    with patch.object(project_manager, 'sync_windows_hosts', return_value={"status": "success"}):
        with patch.object(project_manager, '_save_projects') as mock_save:
            warning = project_manager._sync_hosts_for_project(projects, "p1")

    assert warning is None
    assert projects[0]['host_synced'] is True
    mock_save.assert_not_called()

@patch('core.services.project.write_json')
@patch('core.services.project.read_json')
def test_retry_sync_host_success_marks_host_synced_true(mock_read_json, mock_write_json, project_manager):
    mock_read_json.return_value = [{"id": "p1", "domain": "a.local", "host_synced": False}]
    with patch.object(project_manager, 'sync_windows_hosts', return_value={"status": "success"}):
        res = project_manager.retry_sync_host("p1")

    assert res['status'] == 'success'
    written = mock_write_json.call_args[0][1]
    assert written[0]['host_synced'] is True

@patch('core.services.project.write_json')
def test_retry_sync_host_returns_hosts_error_without_saving(mock_write_json, project_manager):
    with patch.object(project_manager, 'sync_windows_hosts', return_value={"status": "error", "message": "uac_denied"}):
        res = project_manager.retry_sync_host("p1")

    assert res == {"status": "error", "message": "uac_denied"}
    mock_write_json.assert_not_called()
