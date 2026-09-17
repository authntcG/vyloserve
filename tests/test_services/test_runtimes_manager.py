import os
import pytest
from unittest.mock import patch, MagicMock

from core.services.runtimes_manager import RuntimesManager

@pytest.fixture
def runtimes_manager(mock_api, tmp_path):
    with patch('core.services.runtimes_manager.get_project_root', return_value=str(tmp_path)):
        return RuntimesManager(mock_api)

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.CloseKey')
def test_is_in_user_path(mock_close, mock_query, mock_open_key, runtimes_manager):
    """Test path existence check in Windows Registry."""
    # When path exists
    mock_query.return_value = (r"C:\Windows;D:\Projects\bin\node;", 1)
    assert runtimes_manager._is_in_user_path(r"D:\Projects\bin\node") is True
    
    # When path does not exist
    mock_query.return_value = (r"C:\Windows;C:\Program Files\Git\cmd;", 1)
    assert runtimes_manager._is_in_user_path(r"D:\Projects\bin\node") is False

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_toggle_user_path_enable(mock_send_msg, mock_close, mock_set, mock_query, mock_open_key, runtimes_manager):
    """Test enabling a path in Windows Registry."""
    mock_query.return_value = (r"C:\Windows;", 1)
    
    res = runtimes_manager.toggle_user_path("node", True)
    assert res['status'] == 'success'
    
    # Check that SetValueEx was called with the new path appended
    args = mock_set.call_args[0]
    assert args[1] == 'Path'
    assert 'bin\\node' in args[4]
    assert 'C:\\Windows' in args[4]
    
    # Check that Windows broadcast message was sent
    mock_send_msg.assert_called_once()

@patch('winreg.OpenKey')
@patch('winreg.QueryValueEx')
@patch('winreg.SetValueEx')
@patch('winreg.CloseKey')
@patch('ctypes.windll.user32.SendMessageTimeoutW')
def test_toggle_user_path_disable(mock_send_msg, mock_close, mock_set, mock_query, mock_open_key, runtimes_manager):
    """Test disabling a path in Windows Registry."""
    mock_path = f"C:\\Windows;{os.path.join(runtimes_manager.bin_dir, 'node')};"
    mock_query.return_value = (mock_path, 1)
    
    res = runtimes_manager.toggle_user_path("node", False)
    assert res['status'] == 'success'
    
    # Check that SetValueEx was called without the node path
    args = mock_set.call_args[0]
    assert args[1] == 'Path'
    assert 'bin\\node' not in args[4]
    assert 'C:\\Windows' in args[4]

@patch('os.remove')
@patch('os.rename')
@patch('core.services.runtimes_manager.download_advanced')
@patch('core.services.runtimes_manager.extract_archive')
def test_install_node(mock_extract, mock_download, mock_rename, mock_remove, runtimes_manager):
    """Test Node.js installation flow."""
    with patch('os.path.exists', return_value=False):
        res = runtimes_manager.install_node("20.14.0", False)
        
        assert res['status'] == 'success'
        mock_download.assert_called_once()
        mock_extract.assert_called_once()
        mock_rename.assert_called_once()
import os
import sys
import json
import urllib.request
import pytest
from unittest.mock import patch, MagicMock

# 45-51
def test_cleanup_failed_install(runtimes_manager):
    with patch('os.path.exists', return_value=True), patch('os.remove') as mock_remove:
        res = runtimes_manager._cleanup_failed_install("some/path.zip", Exception("Test Error"), "Node.js")
        assert res['status'] == 'error'
        assert "Test Error" in res['message']
        mock_remove.assert_called_once()

# 57-59
def test_get_cbs(runtimes_manager):
    log_cb, download_cb = runtimes_manager._get_cbs(10, 60)
    with patch.object(runtimes_manager, '_emit_log') as mock_log, patch.object(runtimes_manager, '_emit_progress') as mock_prog:
        log_cb("Test log", "info")
        mock_log.assert_called_once_with("Test log", "info")
        download_cb(0.5, "Downloading")
        mock_prog.assert_called_once_with(35, "Downloading") # 10 + 0.5 * 50

# 68-119
def test_check_external_installation_found(runtimes_manager):
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\path\\to\\node.exe"), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="v20.0.0\n", stderr="")
        res = runtimes_manager._check_external_installation('node')
        assert res['exists'] is True
        assert res['path'] == "C:\\path\\to\\node.exe"
        assert res['version'] == "v20.0.0"

def test_check_external_installation_not_found(runtimes_manager):
    with patch.object(runtimes_manager, '_check_via_where', return_value=None), \
         patch.object(runtimes_manager, '_check_via_registry', return_value=None), \
         patch.object(runtimes_manager, '_check_via_env', return_value=None):
        res = runtimes_manager._check_external_installation('node')
        assert res['exists'] is False
        assert res['path'] == ""

# 129-130
def test_is_in_user_path_exception(runtimes_manager):
    with patch('winreg.OpenKey', side_effect=Exception("Reg Error")):
        assert runtimes_manager._is_in_user_path("some/path") is False

# 134-137
def test_get_paths_to_toggle(runtimes_manager):
    assert len(runtimes_manager._get_paths_to_toggle('node')) == 1
    assert len(runtimes_manager._get_paths_to_toggle('python')) == 2
    assert len(runtimes_manager._get_paths_to_toggle('java')) == 1
    assert len(runtimes_manager._get_paths_to_toggle('go')) == 1
    assert len(runtimes_manager._get_paths_to_toggle('unknown')) == 0

# 142, 155-162, 180-182
def test_toggle_user_path_java(runtimes_manager):
    with patch('winreg.QueryValueEx', side_effect=FileNotFoundError), \
         patch('winreg.SetValueEx') as mock_set, \
         patch('winreg.DeleteValue') as mock_del:
        
        # Test enable java
        runtimes_manager._toggle_user_path_env(MagicMock(), ["some/java/bin"], True, 'java')
        # should set JAVA_HOME
        assert any(args[0][1] == 'JAVA_HOME' for args in mock_set.call_args_list)

        # Test disable java
        mock_set.reset_mock()
        mock_key = MagicMock()
        runtimes_manager._toggle_user_path_env(mock_key, ["some/java/bin"], False, 'java')
        mock_del.assert_called_with(mock_key, 'JAVA_HOME')

def test_toggle_user_path_exception(runtimes_manager):
    with patch('winreg.OpenKey', side_effect=Exception("Test Exception")):
        res = runtimes_manager.toggle_user_path('node', True)
        assert res['status'] == 'error'
        assert "Test Exception" in res['message']

def test_toggle_user_path_invalid_engine(runtimes_manager):
    res = runtimes_manager.toggle_user_path('invalid', True)
    assert res['status'] == 'error'

# 188-201
def test_get_node_status(runtimes_manager):
    with patch('os.path.exists', return_value=True), \
         patch('subprocess.run') as mock_run, \
         patch.object(runtimes_manager, '_is_in_user_path', return_value=True), \
         patch.object(runtimes_manager, '_check_external_installation', return_value={"exists": False}):
        mock_run.return_value = MagicMock(stdout="v20.0.0")
        res = runtimes_manager.get_node_status()
        assert res['installed'] is True
        assert res['version'] == "v20.0.0"
        assert res['in_path'] is True

# 210-235
def test_get_available_node_versions(runtimes_manager):
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps([
            {"version": "v20.0.0", "lts": "Iron"},
            {"version": "v19.0.0", "lts": False}
        ]).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = runtimes_manager.get_available_node_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 2
        assert res['data'][0]['value'] == "20.0.0"

def test_get_available_node_versions_exception(runtimes_manager):
    with patch('urllib.request.urlopen', side_effect=Exception("Network Error")):
        res = runtimes_manager.get_available_node_versions()
        assert res['status'] == 'error'
        assert "Network Error" in res['message']

# 239-248
def test_finalize_node_install(runtimes_manager):
    with patch('os.rename') as mock_rename, \
         patch('os.path.exists', return_value=True), \
         patch('core.services.runtimes_manager.run_silent_command') as mock_run_silent:
        runtimes_manager._finalize_node_install("some/dir", True, "20.0.0", "node-v20.0.0.zip")
        mock_rename.assert_called_once()
        mock_run_silent.assert_called_once()

# 300-313
def test_get_python_status(runtimes_manager):
    with patch('os.path.exists', return_value=True), \
         patch('subprocess.run') as mock_run, \
         patch.object(runtimes_manager, '_is_in_user_path', return_value=False), \
         patch.object(runtimes_manager, '_check_external_installation', return_value={"exists": False}):
        mock_run.return_value = MagicMock(stdout="Python 3.12.0")
        res = runtimes_manager.get_python_status()
        assert res['installed'] is True
        assert res['version'] == "Python 3.12.0"

# 322-331
def test_group_python_versions(runtimes_manager):
    matches = ["3.12.1", "3.12.0", "3.11.2", "3.7.0"]
    res = runtimes_manager._group_python_versions(matches)
    assert 12 in res
    assert 11 in res
    assert 7 not in res # >= 8
    assert res[12] == [1, 0]

# 334-352
def test_scan_python_binaries(runtimes_manager):
    version_dict = {12: [1, 0], 11: [2]}
    with patch('urllib.request.urlopen') as mock_urlopen:
        # mock returns 200 for 3.12.1 and 404 for others
        def side_effect(req, timeout):
            res = MagicMock()
            if "3.12.1" in req.full_url:
                res.status = 200
            else:
                res.status = 404
                raise OSError()
            return res
        mock_urlopen.side_effect = side_effect
        
        valid = runtimes_manager._scan_python_binaries(version_dict)
        assert valid == ["3.12.1"] # 11.2 will also fail

# 356-382
def test_get_available_python_versions(runtimes_manager):
    with patch('urllib.request.urlopen') as mock_urlopen, \
         patch.object(runtimes_manager, '_scan_python_binaries', return_value=["3.12.1", "3.11.2"]):
        mock_response = MagicMock()
        mock_response.read.return_value = b'href="3.12.1/" href="3.11.2/"'
        mock_urlopen.return_value = mock_response
        
        res = runtimes_manager.get_available_python_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 2
        assert res['data'][0]['value'] == "3.12.1"

# 386-422
def test_finalize_python_install(runtimes_manager):
    with patch('os.listdir', return_value=["python312._pth"]), \
         patch('builtins.open', MagicMock()) as mock_open, \
         patch('os.makedirs'), \
         patch('urllib.request.urlretrieve') as mock_retrieve, \
         patch('certifi.where', return_value="cert.pem"), \
         patch('subprocess.run') as mock_run, \
         patch('os.remove'):
        
        mock_run.return_value = MagicMock(returncode=0)
        
        # We need to mock open carefully to return read string
        mock_file = MagicMock()
        mock_file.read.return_value = "#import site"
        mock_open.return_value.__enter__.return_value = mock_file
        
        runtimes_manager._finalize_python_install("some/dir", True, "3.12.1")
        mock_retrieve.assert_called_once()
        mock_run.assert_called_once()

# 463-468
def test_uninstall_python(runtimes_manager):
    with patch.object(runtimes_manager, 'toggle_user_path'), \
         patch('os.path.exists', return_value=True), \
         patch('shutil.rmtree') as mock_rmtree:
        res = runtimes_manager.uninstall_python()
        assert res['status'] == 'success'
        mock_rmtree.assert_called_once()

# 474-488
def test_get_java_status(runtimes_manager):
    with patch('os.path.exists', return_value=True), \
         patch('subprocess.run') as mock_run, \
         patch.object(runtimes_manager, '_is_in_user_path', return_value=False), \
         patch.object(runtimes_manager, '_check_external_installation', return_value={"exists": False}):
        mock_run.return_value = MagicMock(stderr="openjdk version 21.0.0")
        res = runtimes_manager.get_java_status()
        assert res['installed'] is True
        assert res['version'] == "openjdk version 21.0.0"

# 497-526
def test_get_available_java_versions(runtimes_manager):
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "available_releases": [21, 17, 11, 8],
            "available_lts_releases": [21, 17, 11, 8],
            "most_recent_lts": 21
        }).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = runtimes_manager.get_available_java_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 4
        assert res['data'][0]['value'] == "21"

def test_get_available_java_versions_error(runtimes_manager):
    with patch('urllib.request.urlopen', side_effect=Exception("Test Exception")):
        res = runtimes_manager.get_available_java_versions()
        assert res['status'] == 'error'

# 592-597
def test_uninstall_java(runtimes_manager):
    with patch.object(runtimes_manager, 'toggle_user_path'), \
         patch('os.path.exists', return_value=True), \
         patch('shutil.rmtree') as mock_rmtree:
        res = runtimes_manager.uninstall_java()
        assert res['status'] == 'success'
        mock_rmtree.assert_called_once()

# 603-617
def test_get_go_status(runtimes_manager):
    with patch('os.path.exists', return_value=True), \
         patch('subprocess.run') as mock_run, \
         patch.object(runtimes_manager, '_is_in_user_path', return_value=False), \
         patch.object(runtimes_manager, '_check_external_installation', return_value={"exists": False}):
        mock_run.return_value = MagicMock(stdout="go version go1.22.0 windows/amd64")
        res = runtimes_manager.get_go_status()
        assert res['installed'] is True
        assert res['version'] == "go1.22.0"

# 626-649
def test_get_available_go_versions(runtimes_manager):
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps([
            {"version": "go1.22.0"},
            {"version": "go1.21.0"}
        ]).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = runtimes_manager.get_available_go_versions()
        assert res['status'] == 'success'
        assert len(res['data']) == 2
        assert res['data'][0]['value'] == "1.22.0"

# 716-726
def test_check_via_where(runtimes_manager):
    with patch('sys.platform', 'win32'), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="C:\\valid\\path\\node.exe\nC:\\vyloserve\\bin\\node.exe")
        res = runtimes_manager._check_via_where('node', 'c:\\vyloserve\\bin')
        assert res == "C:\\valid\\path\\node.exe"

# 729-750
def test_check_via_registry(runtimes_manager):
    with patch('sys.platform', 'win32'), \
         patch('winreg.OpenKey', MagicMock()), \
         patch('winreg.QueryValueEx') as mock_query, \
         patch('shutil.which', return_value="C:\\registry\\path\\node.exe"):
        mock_query.return_value = ("C:\\registry\\path;", 1)
        res = runtimes_manager._check_via_registry('node', 'c:\\vyloserve\\bin')
        assert res == "C:\\registry\\path\\node.exe"

# 753-757
def test_check_via_env(runtimes_manager):
    with patch('sys.platform', 'linux'), \
         patch('os.environ.copy', return_value={'PATH': '/usr/bin:/opt/vyloserve/bin'}), \
         patch('shutil.which', return_value="/usr/bin/node"):
        res = runtimes_manager._check_via_env('node', '/opt/vyloserve/bin')
        assert res == "/usr/bin/node"

# More install tests specific exception handling and branches
def test_install_node_error(runtimes_manager):
    with patch.object(runtimes_manager, '_get_cbs', side_effect=Exception("Test Err")):
        res = runtimes_manager.install_node("20.0.0", False)
        assert res['status'] == 'error'

def test_install_python_error(runtimes_manager):
    with patch.object(runtimes_manager, '_get_cbs', side_effect=Exception("Test Err")):
        res = runtimes_manager.install_python("3.12.0", False)
        assert res['status'] == 'error'

def test_install_java_error(runtimes_manager):
    with patch.object(runtimes_manager, '_get_cbs', side_effect=OSError("Test Err")):
        res = runtimes_manager.install_java("21.0.0")
        assert res['status'] == 'error'

def test_install_go_error(runtimes_manager):
    with patch.object(runtimes_manager, '_get_cbs', side_effect=OSError("Test Err")):
        res = runtimes_manager.install_go("1.22.0")
        assert res['status'] == 'error'

def test_install_go_latest(runtimes_manager):
    with patch('urllib.request.urlopen') as mock_urlopen, \
         patch('core.services.runtimes_manager.download_advanced'), \
         patch('core.services.runtimes_manager.extract_archive'), \
         patch('os.remove'):

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps([{"version": "go1.22.0"}]).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = runtimes_manager.install_go("latest")
        assert res['status'] == 'success'

# ==========================================
# uninstall_node / uninstall_go — belum pernah ditest sama sekali
# ==========================================

def test_uninstall_node(runtimes_manager):
    with patch.object(runtimes_manager, 'toggle_user_path') as mock_toggle, \
         patch('os.path.exists', return_value=True), \
         patch('shutil.rmtree') as mock_rmtree:
        res = runtimes_manager.uninstall_node()
    assert res == {"status": "success"}
    mock_toggle.assert_called_once_with('node', False)
    mock_rmtree.assert_called_once()

def test_uninstall_go(runtimes_manager):
    """
    Regression test: uninstall_go() sebelumnya TIDAK PUNYA return statement sama sekali
    (implisit return None), berbeda dari uninstall_node/python/java. Frontend yang
    mengecek res.status akan salah menampilkan error walau uninstall sukses.
    """
    with patch.object(runtimes_manager, 'toggle_user_path') as mock_toggle, \
         patch('os.path.exists', return_value=True), \
         patch('shutil.rmtree') as mock_rmtree:
        res = runtimes_manager.uninstall_go()
    assert res == {"status": "success"}
    mock_toggle.assert_called_once_with('go', False)
    mock_rmtree.assert_called_once()

# ==========================================
# install_python — alur sukses penuh (sebelumnya hanya error path yang ditest)
# ==========================================

def test_install_python_success(runtimes_manager):
    with patch('os.path.exists', return_value=False), \
         patch('os.makedirs'), \
         patch('core.services.runtimes_manager.download_advanced') as mock_download, \
         patch('core.services.runtimes_manager.extract_archive') as mock_extract, \
         patch('os.remove'), \
         patch.object(runtimes_manager, '_finalize_python_install') as mock_finalize:
        res = runtimes_manager.install_python("3.12.1", True)

    assert res == {"status": "success"}
    mock_download.assert_called_once()
    mock_extract.assert_called_once()
    mock_finalize.assert_called_once_with(os.path.join(runtimes_manager.bin_dir, 'python'), True, "3.12.1")

def test_install_python_removes_zip_after_extract(runtimes_manager):
    with patch('os.path.exists', side_effect=[False, True]), \
         patch('os.makedirs'), \
         patch('core.services.runtimes_manager.download_advanced'), \
         patch('core.services.runtimes_manager.extract_archive'), \
         patch('os.remove') as mock_remove, \
         patch.object(runtimes_manager, '_finalize_python_install'):
        runtimes_manager.install_python("3.12.1", False)
    mock_remove.assert_called_once_with(os.path.join(runtimes_manager.bin_dir, "python_3.12.1.zip"))

# ==========================================
# install_java — alur sukses penuh (sebelumnya hanya error path yang ditest)
# ==========================================

def test_install_java_success(runtimes_manager):
    with patch('os.path.exists', return_value=False), \
         patch('core.services.runtimes_manager.download_advanced') as mock_download, \
         patch('core.services.runtimes_manager.extract_archive') as mock_extract, \
         patch('os.remove'), \
         patch('os.listdir', return_value=["jdk-21.0.1+12"]), \
         patch('os.path.isdir', return_value=True), \
         patch('os.rename') as mock_rename:
        res = runtimes_manager.install_java("21")

    assert res == {"status": "success"}
    mock_download.assert_called_once()
    mock_extract.assert_called_once()
    mock_rename.assert_called_once_with(
        os.path.join(runtimes_manager.bin_dir, "jdk-21.0.1+12"),
        os.path.join(runtimes_manager.bin_dir, 'java'),
    )

def test_install_java_raises_when_extracted_jdk_folder_not_found(runtimes_manager):
    with patch('os.path.exists', side_effect=lambda p: p.endswith('.zip')), \
         patch('core.services.runtimes_manager.download_advanced'), \
         patch('core.services.runtimes_manager.extract_archive'), \
         patch('os.remove'), \
         patch('os.listdir', return_value=["not_a_jdk_folder"]):
        res = runtimes_manager.install_java("21")

    assert res['status'] == 'error'
    assert 'tidak ditemukan setelah diekstrak' in res['message']

# ==========================================
# get_available_python_versions / get_available_go_versions — error path
# ==========================================

def test_get_available_python_versions_handles_exception(runtimes_manager):
    with patch('urllib.request.urlopen', side_effect=OSError("network down")):
        res = runtimes_manager.get_available_python_versions()
    assert res['status'] == 'error'
    assert 'network down' in res['message']

def test_get_available_go_versions_handles_exception(runtimes_manager):
    with patch('urllib.request.urlopen', side_effect=OSError("network down")):
        res = runtimes_manager.get_available_go_versions()
    assert res['status'] == 'error'
    assert 'network down' in res['message']

def test_get_available_node_versions_labels_non_lts_as_latest_current(runtimes_manager):
    """Item pertama tanpa LTS harus dilabeli '(Latest Current)', bukan LTS."""
    with patch('urllib.request.urlopen') as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps([
            {"version": "v21.0.0", "lts": False},
        ]).encode('utf-8')
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = runtimes_manager.get_available_node_versions()
    assert "(Latest Current)" in res['data'][0]['label']

# ==========================================
# _check_external_installation — cabang flag per-engine & OS script
# ==========================================

def test_check_external_installation_java_uses_dash_version_flag(runtimes_manager):
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\java\\bin\\java.exe"), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="openjdk version 21\n")
        runtimes_manager._check_external_installation('java')
    assert mock_run.call_args[0][0][1] == '-version'

def test_check_external_installation_python_uses_double_dash_version_flag(runtimes_manager):
    """Krusial: flag harus '--version', BUKAN '-version', agar tidak masuk mode REPL interaktif."""
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\python\\python.exe"), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="Python 3.12.0\n", stderr="")
        runtimes_manager._check_external_installation('python')
    assert mock_run.call_args[0][0][1] == '--version'

def test_check_external_installation_go_uses_version_flag(runtimes_manager):
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\go\\bin\\go.exe"), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="go version go1.22.0\n", stderr="")
        runtimes_manager._check_external_installation('go')
    assert mock_run.call_args[0][0][1] == 'version'

def test_check_external_installation_windows_script_uses_shell(runtimes_manager):
    """Jika binary eksternal berupa .cmd/.bat, harus dijalankan via shell=True dengan string command."""
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\node\\corepack.cmd"), \
         patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(stdout="v1.0.0\n", stderr="")
        runtimes_manager._check_external_installation('node')
    assert mock_run.call_args.kwargs.get('shell') is True

def test_check_external_installation_swallows_version_check_error(runtimes_manager):
    """Jika eksekusi pengecekan versi gagal (OSError), tetap laporkan exists=True dengan versi Unknown."""
    with patch.object(runtimes_manager, '_check_via_where', return_value="C:\\node\\node.exe"), \
         patch('subprocess.run', side_effect=OSError("cannot execute")):
        res = runtimes_manager._check_external_installation('node')
    assert res == {"exists": True, "path": "C:\\node\\node.exe", "version": "Unknown Version"}

# ==========================================
# get_*_status — swallow exception saat cek versi internal
# ==========================================

def test_get_node_status_swallows_version_check_error(runtimes_manager):
    with patch('os.path.exists', return_value=True), \
         patch('subprocess.run', side_effect=OSError("crashed")), \
         patch.object(runtimes_manager, '_is_in_user_path', return_value=False), \
         patch.object(runtimes_manager, '_check_external_installation', return_value={"exists": False}):
        res = runtimes_manager.get_node_status()
    assert res['version'] == "Unknown"

# ==========================================
# _finalize_python_install — versi lama & kegagalan get-pip
# ==========================================

def test_finalize_python_install_uses_versioned_get_pip_url_for_old_python(runtimes_manager):
    with patch('os.listdir', return_value=["python39._pth"]), \
         patch('builtins.open', MagicMock()) as mock_open, \
         patch('os.makedirs'), \
         patch('urllib.request.urlretrieve') as mock_retrieve, \
         patch('certifi.where', return_value="cert.pem"), \
         patch('subprocess.run', return_value=MagicMock(returncode=0)), \
         patch('os.remove'):
        mock_file = MagicMock()
        mock_file.read.return_value = "#import site"
        mock_open.return_value.__enter__.return_value = mock_file

        runtimes_manager._finalize_python_install("some/dir", True, "3.9.0")

    fetched_url = mock_retrieve.call_args[0][0]
    assert fetched_url == "https://bootstrap.pypa.io/pip/3.9/get-pip.py"

def test_finalize_python_install_raises_when_get_pip_fails(runtimes_manager):
    with patch('os.listdir', return_value=["python312._pth"]), \
         patch('builtins.open', MagicMock()) as mock_open, \
         patch('os.makedirs'), \
         patch('urllib.request.urlretrieve'), \
         patch('certifi.where', return_value="cert.pem"), \
         patch('subprocess.run', return_value=MagicMock(returncode=1, stderr="pip install failed", stdout="")), \
         patch('os.remove'):
        mock_file = MagicMock()
        mock_file.read.return_value = "#import site"
        mock_open.return_value.__enter__.return_value = mock_file

        with pytest.raises(RuntimeError, match="Gagal mengeksekusi get-pip.py"):
            runtimes_manager._finalize_python_install("some/dir", True, "3.12.1")

# ==========================================
# install_node / install_go — pembersihan zip setelah ekstraksi berhasil
# ==========================================

def test_install_node_removes_zip_after_successful_extract(runtimes_manager):
    with patch('os.path.exists', side_effect=[False, True]), \
         patch('core.services.runtimes_manager.download_advanced'), \
         patch('core.services.runtimes_manager.extract_archive'), \
         patch('os.remove') as mock_remove, \
         patch.object(runtimes_manager, '_finalize_node_install'):
        runtimes_manager.install_node("20.14.0", False)
    mock_remove.assert_called_once_with(os.path.join(runtimes_manager.bin_dir, "node_20.14.0.zip"))

def test_install_go_removes_zip_after_successful_extract(runtimes_manager):
    with patch('os.path.exists', side_effect=[False, True]), \
         patch('core.services.runtimes_manager.download_advanced'), \
         patch('core.services.runtimes_manager.extract_archive'), \
         patch('os.remove') as mock_remove:
        res = runtimes_manager.install_go("1.22.0")
    assert res['status'] == 'success'
    mock_remove.assert_called_once()

# ==========================================
# _check_via_where / _check_via_registry — cabang tambahan
# ==========================================

def test_check_via_where_returns_none_on_non_windows(runtimes_manager):
    with patch('sys.platform', 'linux'):
        assert runtimes_manager._check_via_where('node', 'c:\\vyloserve\\bin') is None

def test_check_via_where_swallows_oserror(runtimes_manager):
    with patch('sys.platform', 'win32'), \
         patch('subprocess.run', side_effect=OSError("where.exe missing")):
        assert runtimes_manager._check_via_where('node', 'c:\\vyloserve\\bin') is None

def test_check_via_registry_returns_none_on_non_windows(runtimes_manager):
    with patch('sys.platform', 'linux'):
        assert runtimes_manager._check_via_registry('node', 'c:\\vyloserve\\bin') is None

def test_check_via_registry_handles_hklm_read_failure(runtimes_manager):
    """Jika baca HKLM (system-wide PATH) gagal, tetap lanjut baca HKCU tanpa crash."""
    def open_key_side_effect(hive, subkey, *a, **kw):
        if 'CurrentControlSet' in subkey:
            raise OSError("access denied")
        return MagicMock(__enter__=MagicMock(return_value=MagicMock()), __exit__=MagicMock(return_value=False))

    with patch('sys.platform', 'win32'), \
         patch('winreg.OpenKey', side_effect=open_key_side_effect), \
         patch('winreg.QueryValueEx', return_value=("C:\\user\\path;", 1)), \
         patch('shutil.which', return_value="C:\\user\\path\\node.exe"):
        res = runtimes_manager._check_via_registry('node', 'c:\\vyloserve\\bin')
    assert res == "C:\\user\\path\\node.exe"
