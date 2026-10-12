import os
import pytest
from unittest.mock import patch, mock_open, MagicMock
from core.services.markdown_viewer import MarkdownViewerManager
import sys

@pytest.fixture
def manager():
    return MarkdownViewerManager(api_ref=MagicMock())

def test_select_directory_no_window(manager):
    with patch.dict('sys.modules', {'webview': MagicMock(windows=[])}):
        result = manager.select_directory()
        assert result['status'] == 'error'
        assert result['message'] == 'backend.md.no_window'

def test_select_directory_success(manager):
    mock_window = MagicMock()
    mock_window.create_file_dialog.return_value = ["/selected/path"]
    
    # Mocking webview.FOLDER_DIALOG
    mock_webview = MagicMock()
    mock_webview.windows = [mock_window]
    mock_webview.FOLDER_DIALOG = 2

    with patch.dict('sys.modules', {'webview': mock_webview}):
        result = manager.select_directory()
        assert result['status'] == 'success'
        assert result['data'] == "/selected/path"

def test_select_directory_cancelled(manager):
    mock_window = MagicMock()
    mock_window.create_file_dialog.return_value = None
    
    mock_webview = MagicMock()
    mock_webview.windows = [mock_window]
    mock_webview.FOLDER_DIALOG = 2

    with patch.dict('sys.modules', {'webview': mock_webview}):
        result = manager.select_directory()
        assert result['status'] == 'success'
        assert result['data'] is None

def test_get_markdown_tree_folder_not_found(manager):
    with patch('core.services.markdown_viewer.os.path.exists', return_value=False):
        result = manager.get_markdown_tree("/invalid")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.md.folder_not_found'

def test_get_markdown_tree_success(manager):
    # Mock os.path.exists to always be true
    # Mock os.path.isdir to return True for /root and /root/subdir, False for files
    def mock_isdir(path):
        normalized = path.replace('\\', '/')
        return normalized in ['/root', '/root/subdir', '/root/.git']

    def mock_listdir(path):
        normalized = path.replace('\\', '/')
        if normalized == '/root':
            return ['file1.md', 'file2.txt', 'subdir', '.git']
        elif normalized == '/root/subdir':
            return ['subfile.md']
        return []

    with patch('core.services.markdown_viewer.os.path.exists', return_value=True), \
         patch('core.services.markdown_viewer.os.path.isdir', side_effect=mock_isdir), \
         patch('core.services.markdown_viewer.os.listdir', side_effect=mock_listdir):
         
        result = manager.get_markdown_tree("/root")
        assert result['status'] == 'success'
        assert len(result['data']) == 2
        
        # Directories first
        assert result['data'][0]['type'] == 'dir'
        assert result['data'][0]['name'] == 'subdir'
        assert len(result['data'][0]['children']) == 1
        assert result['data'][0]['children'][0]['name'] == 'subfile.md'
        
        # Files second
        assert result['data'][1]['type'] == 'file'
        assert result['data'][1]['name'] == 'file1.md'

def test_read_markdown_file_not_found(manager):
    with patch('core.services.markdown_viewer.os.path.exists', return_value=False):
        result = manager.read_markdown_file("/invalid.md")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.md.file_not_found'

def test_read_markdown_file_success(manager):
    m_open = mock_open(read_data="# Hello World")
    with patch('core.services.markdown_viewer.os.path.exists', return_value=True), \
         patch('builtins.open', m_open):
        result = manager.read_markdown_file("/valid.md")
        assert result['status'] == 'success'
        assert result['data'] == "# Hello World"
        m_open.assert_called_once_with("/valid.md", 'r', encoding='utf-8', errors='replace')

def test_get_local_media_not_found(manager):
    with patch('core.services.markdown_viewer.os.path.exists', return_value=False):
        result = manager.get_local_media_base64("/invalid.png")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.md.media_not_found'

def test_get_local_media_success(manager):
    m_open = mock_open(read_data=b"image_data")
    with patch('core.services.markdown_viewer.os.path.exists', return_value=True), \
         patch('builtins.open', m_open), \
         patch('core.services.markdown_viewer.mimetypes.guess_type', return_value=("image/png", None)):
        result = manager.get_local_media_base64("/image.png")
        assert result['status'] == 'success'
        assert result['data'] == "data:image/png;base64,aW1hZ2VfZGF0YQ=="
        m_open.assert_called_once_with("/image.png", 'rb')

def test_select_directory_exception(manager):
    with patch('builtins.__import__', side_effect=Exception("Test Error")):
        result = manager.select_directory()
        assert result['status'] == 'error'
        assert result['message'] == 'backend.error.unexpected'

def test_get_markdown_tree_exception(manager):
    with patch('core.services.markdown_viewer.os.path.exists', side_effect=Exception("Test Error")):
        result = manager.get_markdown_tree("/root")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.error.unexpected'

def test_build_tree_permission_error(manager):
    with patch('core.services.markdown_viewer.os.path.isdir', return_value=True), \
         patch('core.services.markdown_viewer.os.listdir', side_effect=PermissionError("Denied")):
        result = manager._build_tree("/root")
        assert result is None

def test_build_tree_empty_dir(manager):
    with patch('core.services.markdown_viewer.os.path.isdir', return_value=True), \
         patch('core.services.markdown_viewer.os.listdir', return_value=[]):
        result = manager._build_tree("/root")
        assert result is None

def test_get_markdown_tree_empty(manager):
    with patch('core.services.markdown_viewer.os.path.exists', return_value=True), \
         patch('core.services.markdown_viewer.os.path.isdir', return_value=True), \
         patch('core.services.markdown_viewer.MarkdownViewerManager._build_tree', return_value=None):
        result = manager.get_markdown_tree("/root")
        assert result['status'] == 'success'
        assert result['data'] == []

def test_read_markdown_file_exception(manager):
    with patch('core.services.markdown_viewer.os.path.exists', side_effect=Exception("Test Error")):
        result = manager.read_markdown_file("/file.md")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.error.unexpected'

def test_get_local_media_base64_exception(manager):
    with patch('core.services.markdown_viewer.os.path.exists', side_effect=Exception("Test Error")):
        result = manager.get_local_media_base64("/file.png")
        assert result['status'] == 'error'
        assert result['message'] == 'backend.error.unexpected'

def test_get_local_media_base64_unknown_mime(manager):
    m_open = mock_open(read_data=b"image_data")
    with patch('core.services.markdown_viewer.os.path.exists', return_value=True), \
         patch('builtins.open', m_open), \
         patch('core.services.markdown_viewer.mimetypes.guess_type', return_value=(None, None)):
        result = manager.get_local_media_base64("/file.unknown")
        assert result['status'] == 'success'
        assert result['data'] == "data:application/octet-stream;base64,aW1hZ2VfZGF0YQ=="
