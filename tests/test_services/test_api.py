import pytest
from unittest.mock import MagicMock, patch
from core.api import Api

@pytest.fixture
def api_instance():
    # Patch all the manager instantiations in Api.__init__
    with patch('core.api.PhpManager'), \
         patch('core.api.ApacheManager'), \
         patch('core.api.ProjectManager'), \
         patch('core.api.SslManager'), \
         patch('core.api.DashboardManager'), \
         patch('core.api.DatabaseManager'), \
         patch('core.api.RuntimesManager'), \
         patch('core.api.GitManager'), \
         patch('core.api.SettingsManager'):
        api = Api()
        yield api

def test_set_window_and_emitters(api_instance):
    mock_window = MagicMock()
    api_instance.set_window(mock_window)
    assert api_instance._window == mock_window
    
    api_instance.emit_log("test log", "info")
    mock_window.evaluate_js.assert_called_once()
    assert "test log" in mock_window.evaluate_js.call_args[0][0]
    
    api_instance.emit_progress(50, "test progress")
    assert mock_window.evaluate_js.call_count == 2
    assert "test progress" in mock_window.evaluate_js.call_args[0][0]

def test_emit_events_include_caller_source(api_instance):
    """
    emit_log()/emit_progress() harus otomatis menyertakan nama class pemanggil
    sebagai field 'source' di payload JSON, agar frontend bisa memfilter event
    'vylo_progress'/'vylo_log' per modul dan tidak "bocor" ke halaman lain yang
    kebetulan mounted bersamaan (lihat docs/known_bugs.md #7).
    """
    mock_window = MagicMock()
    api_instance.set_window(mock_window)

    class FakeApacheManager:
        """Meniru pola nyata: service memanggil self.api.emit_progress(...)."""
        def __init__(self, api):
            self.api = api

        def do_install_step(self):
            self.api.emit_progress(50, "working")

    FakeApacheManager(api_instance).do_install_step()

    payload = mock_window.evaluate_js.call_args[0][0]
    assert '"source": "FakeApacheManager"' in payload

def test_emit_events_source_is_null_when_called_without_wrapping_class(api_instance):
    """Panggilan langsung (bukan dari dalam method sebuah class) tidak boleh crash; source jadi null."""
    mock_window = MagicMock()
    api_instance.set_window(mock_window)

    api_instance.emit_log("pesan langsung")

    payload = mock_window.evaluate_js.call_args[0][0]
    assert '"source": null' in payload

def test_project_endpoints_fallback_when_project_module_not_loaded(api_instance):
    """
    Regression test: PROJECT_NOT_LOADED_MSG sebelumnya direferensikan di beberapa
    fallback branch tapi tidak pernah didefinisikan (NameError laten jika
    self.project pernah tidak ter-set). Lihat docs/known_bugs.md #11.
    """
    from core.api import PROJECT_NOT_LOADED_MSG
    del api_instance.project

    expected = {"status": "error", "message": PROJECT_NOT_LOADED_MSG}
    assert api_instance.get_projects() == expected
    assert api_instance.delete_project("id") == expected
    assert api_instance.retry_sync_host("id") == expected
    assert api_instance.open_in_explorer("path") == expected
    assert api_instance.update_project({"id": "1"}) == expected

def test_test_connection(api_instance):
    res = api_instance.test_connection("ping")
    assert res['status'] == "success"

def test_start_stop_service(api_instance):
    api_instance.start_service("apache")
    api_instance.apache.start_server.assert_called_once()
    
    api_instance.start_service("php")
    api_instance.php.start_all.assert_called_once()
    
    api_instance.start_service("database")
    api_instance.database.start_all.assert_called_once()
    
    api_instance.stop_service("apache")
    api_instance.apache.stop_server.assert_called_once()
    
    api_instance.stop_service("php")
    api_instance.php.stop_all.assert_called_once()
    
    api_instance.stop_service("database")
    api_instance.database.stop_all.assert_called_once()

@patch('core.api.psutil')
def test_get_all_services_status(mock_psutil, api_instance):
    mock_psutil.cpu_percent.return_value = 25.5
    mock_psutil.virtual_memory.return_value.percent = 60.0
    
    api_instance.apache.check_is_running.return_value = True
    api_instance.php.check_is_running.return_value = False
    api_instance.database.check_is_running.return_value = True
    
    res = api_instance.get_all_services_status()
    assert res["apache"] is True
    assert res["php"] is False
    assert res["database"] is True
    assert res["cpu_load"] == 26
    assert res["ram_usage"] == 60.0

def test_php_endpoints(api_instance):
    api_instance.get_php_versions()
    api_instance.php.get_versions.assert_called_once()
    
    api_instance.install_php("8.1", "php.zip", 9000)
    api_instance.php.install_version.assert_called_once_with("8.1", "php.zip", 9000)
    
    api_instance.get_installed_php()
    api_instance.php.get_installed_instances.assert_called_once()
    
    api_instance.get_php_config("8.1")
    api_instance.php.get_config.assert_called_once_with("8.1")
    
    api_instance.save_php_config("8.1", {}, [])
    api_instance.php.save_config.assert_called_once_with("8.1", {}, [])
    
    api_instance.open_php_ini("8.1")
    api_instance.php.open_path.assert_called_with("8.1", is_file=True)
    
    api_instance.open_php_dir("8.1")
    api_instance.php.open_path.assert_called_with("8.1", is_file=False)
    
    api_instance.uninstall_php("8.1")
    api_instance.php.uninstall_version.assert_called_once_with("8.1")
    
    api_instance.start_php("8.1")
    api_instance.php.start_php.assert_called_once_with("8.1")
    
    api_instance.stop_php("8.1")
    api_instance.php.stop_php.assert_called_once_with("8.1")

def test_apache_endpoints(api_instance):
    api_instance.get_available_apache()
    api_instance.apache.get_available_versions.assert_called_once()
    
    api_instance.install_apache("2.4", "url", 80)
    api_instance.apache.install_version.assert_called_once_with("2.4", "url", 80)
    
    api_instance.get_apache_status()
    api_instance.apache.get_status.assert_called_once()
    
    api_instance.uninstall_apache()
    api_instance.apache.uninstall.assert_called_once()
    
    api_instance.open_apache_directory()
    api_instance.apache.open_directory.assert_called_once()
    
    api_instance.open_apache_config()
    api_instance.apache.open_config.assert_called_once()
    
    api_instance.get_apache_installed_versions()
    api_instance.apache.get_installed_versions.assert_called_once()
    
    api_instance.set_apache_active_version("2.4")
    api_instance.apache.set_active_version.assert_called_once_with("2.4")
    
    api_instance.open_apache_file("logs")
    api_instance.apache.open_apache_file.assert_called_once_with("logs")
    
    api_instance.start_apache_server()
    api_instance.apache.start_server.assert_called_once()
    
    api_instance.stop_apache_server()
    api_instance.apache.stop_server.assert_called_once()

def test_project_endpoints(api_instance):
    mock_window = MagicMock()
    mock_file = MagicMock()
    mock_file.replace.return_value = "d:/test"
    mock_window.create_file_dialog.return_value = [mock_file]
    api_instance.set_window(mock_window)
    assert api_instance.browse_directory() == "d:/test"
    
    with patch('webbrowser.open'):
        assert api_instance.open_browser("url")["status"] == "success"
    with patch('webbrowser.open', side_effect=Exception("error")):
        assert api_instance.open_browser("url")["status"] == "error"
        
    api_instance.detect_framework("dir")
    api_instance.project.detect_framework.assert_called_once_with("dir")
    
    api_instance.create_project({"domain": "test"})
    api_instance.project.create_project.assert_called_once_with({"domain": "test"})
    
    api_instance.get_projects()
    api_instance.project.get_projects.assert_called_once()
    
    api_instance.delete_project("id", True)
    api_instance.project.delete_project.assert_called_once_with("id", True)
    
    api_instance.retry_sync_host("id")
    api_instance.project.retry_sync_host.assert_called_once_with("id")
    
    api_instance.open_in_explorer("path")
    api_instance.project.open_in_explorer.assert_called_once_with("path")
    
    api_instance.update_project({"id": "1"})
    api_instance.project.update_project.assert_called_once_with({"id": "1"})

@patch('os._exit')
def test_close_app(mock_exit, api_instance):
    api_instance.close_app()
    mock_exit.assert_called_once_with(0)
    
    cb = MagicMock()
    api_instance.quit_callback = cb
    api_instance.close_app()
    cb.assert_called_once()

def test_dashboard_settings_endpoints(api_instance):
    api_instance.get_dashboard_config()
    api_instance.dashboard.get_config.assert_called_once()
    
    api_instance.save_dashboard_config({})
    api_instance.dashboard.save_config.assert_called_once_with({})
    
    api_instance.get_app_settings()
    api_instance.settings.get_settings.assert_called_once()
    
    api_instance.save_app_settings({})
    api_instance.settings.save_settings.assert_called_once_with({})

def test_database_endpoints(api_instance):
    api_instance.get_installed_databases()
    api_instance.database.get_installed.assert_called_once()
    
    api_instance.check_port_in_use(3306)
    api_instance.database.is_port_in_use.assert_called_once_with(3306)
    
    api_instance.get_available_databases("mysql")
    api_instance.database.get_available_versions.assert_called_once_with("mysql")
    
    api_instance.install_database("mysql", "8.0", "url", 3306, "pass")
    api_instance.database.install_database.assert_called_once_with("mysql", "8.0", "url", 3306, "pass")
    
    api_instance.uninstall_database("id", True)
    api_instance.database.uninstall_database.assert_called_once_with("id", True)
    
    api_instance.open_db_config_file("id")
    api_instance.database.open_path.assert_called_once_with("id", is_file=True)
    
    api_instance.open_db_dir("id")
    api_instance.database.open_path.assert_called_with("id", is_file=False)
    
    api_instance.get_db_config("id")
    api_instance.database.get_db_config.assert_called_once_with("id")
    
    api_instance.save_db_config("id", {})
    api_instance.database.save_db_config.assert_called_once_with("id", {})
    
    api_instance.start_database("id")
    api_instance.database.start_database.assert_called_once_with("id")
    
    api_instance.stop_database("id")
    api_instance.database.stop_database.assert_called_once_with("id")
    
    api_instance.change_db_credentials("id", "user", "old", "new")
    api_instance.database.change_db_credentials.assert_called_once_with("id", "user", "old", "new")

def test_runtimes_endpoints(api_instance):
    api_instance.get_node_status()
    api_instance.runtimes_manager.get_node_status.assert_called_once()
    
    api_instance.install_node("latest", True)
    api_instance.runtimes_manager.install_node.assert_called_once_with("latest", True)
    
    api_instance.uninstall_node()
    api_instance.runtimes_manager.uninstall_node.assert_called_once()
    
    api_instance.get_available_node_versions()
    api_instance.runtimes_manager.get_available_node_versions.assert_called_once()
    
    api_instance.get_python_status()
    api_instance.runtimes_manager.get_python_status.assert_called_once()
    
    api_instance.install_python("3.10", True)
    api_instance.runtimes_manager.install_python.assert_called_once_with("3.10", True)
    
    api_instance.uninstall_python()
    api_instance.runtimes_manager.uninstall_python.assert_called_once()
    
    api_instance.get_available_python_versions()
    api_instance.runtimes_manager.get_available_python_versions.assert_called_once()
    
    api_instance.get_java_status()
    api_instance.runtimes_manager.get_java_status.assert_called_once()
    
    api_instance.install_java("17")
    api_instance.runtimes_manager.install_java.assert_called_once_with("17")
    
    api_instance.uninstall_java()
    api_instance.runtimes_manager.uninstall_java.assert_called_once()
    
    api_instance.get_available_java_versions()
    api_instance.runtimes_manager.get_available_java_versions.assert_called_once()
    
    api_instance.get_go_status()
    api_instance.runtimes_manager.get_go_status.assert_called_once()
    
    api_instance.get_available_go_versions()
    api_instance.runtimes_manager.get_available_go_versions.assert_called_once()
    
    api_instance.install_go("1.21")
    api_instance.runtimes_manager.install_go.assert_called_once_with("1.21")
    
    api_instance.uninstall_go()
    api_instance.runtimes_manager.uninstall_go.assert_called_once()
    
    api_instance.toggle_global_path("node", True)
    api_instance.runtimes_manager.toggle_user_path.assert_called_once_with("node", True)

def test_git_endpoints(api_instance):
    api_instance.get_git_status()
    api_instance.git_manager.get_git_status.assert_called_once()
    
    api_instance.get_available_git_versions()
    api_instance.git_manager.get_available_git_versions.assert_called_once()
    
    api_instance.install_git("url", "file", "version")
    api_instance.git_manager.install_git.assert_called_once_with("url", "file", "version")
    
    api_instance.uninstall_git()
    api_instance.git_manager.uninstall_git.assert_called_once()
    
    api_instance.toggle_git_path(True)
    api_instance.git_manager.toggle_user_path.assert_called_once_with(True)
    
    api_instance.get_git_config()
    api_instance.git_manager.get_git_config.assert_called_once()
    
    api_instance.set_git_config("name", "email")
    api_instance.git_manager.set_git_config.assert_called_once_with("name", "email")
