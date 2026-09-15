import os
import pytest
from unittest.mock import patch, MagicMock, mock_open

from core.services.apache import ApacheManager

@pytest.fixture
def apache_manager(mock_api, tmp_path):
    with patch('core.services.apache.get_project_root', return_value=str(tmp_path)):
        return ApacheManager(mock_api)

def test_apache_configure_httpd(apache_manager):
    """Test string replacements for httpd.conf during installation."""
    
    # Fake original httpd.conf content
    original_content = (
        'Define SRVROOT "c:/Apache24"\n'
        'Listen 80\n'
        '#ServerName www.example.com:80\n'
        'DocumentRoot "c:/Apache24/htdocs"\n'
        '<Directory "c:/Apache24/htdocs">\n'
        '    Options Indexes FollowSymLinks\n'
        '    DirectoryIndex index.html\n'
        '</Directory>\n'
        '#LoadModule proxy_module modules/mod_proxy.so\n'
        '#LoadModule proxy_fcgi_module modules/mod_proxy_fcgi.so\n'
    )
    
    mock_file = mock_open(read_data=original_content)
    
    with patch('builtins.open', mock_file):
        with patch.object(apache_manager, '_ensure_default_htdocs', return_value="d:/www"):
            with patch.object(apache_manager, 'update_global_php_proxy'):
                
                apache_manager._configure_httpd("d:/apache", 8080)
                
                # Check that open was called to read and write
                mock_file.assert_any_call(os.path.join("d:/apache", "conf", "httpd.conf"), 'r', encoding='utf-8')
                mock_file.assert_any_call(os.path.join("d:/apache", "conf", "httpd.conf"), 'w', encoding='utf-8')
                
                # Get what was written
                written_content = "".join(call.args[0] for call in mock_file().write.call_args_list)
                
                # Assert replacements
                assert 'Define SRVROOT "d:/apache"' in written_content
                assert 'Listen 8080' in written_content
                assert 'ServerName localhost:8080' in written_content
                assert 'DocumentRoot "d:/www"' in written_content
                assert '<Directory "d:/www">' in written_content
                assert 'DirectoryIndex index.php index.html' in written_content
                assert 'Options Indexes FollowSymLinks ExecCGI' in written_content
                assert 'LoadModule proxy_module modules/mod_proxy.so' in written_content
                assert '#LoadModule' not in written_content # Should be uncommented
                
                # Check includes
                assert 'IncludeOptional conf/extra/httpd-vyloserve-php.conf' in written_content
                assert 'IncludeOptional conf/extra/vyloserve-vhosts.conf' in written_content

@patch('core.services.apache.read_json')
def test_apache_get_active_version(mock_read_json, apache_manager):
    """Test reading active version from JSON."""
    mock_read_json.return_value = {"active_version": "2.4.68"}
    assert apache_manager._get_active_version() == "2.4.68"
    
    mock_read_json.return_value = {}
    assert apache_manager._get_active_version() is None
