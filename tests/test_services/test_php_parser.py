import pytest
from unittest.mock import MagicMock
import sys
from core.services.php import PhpManager

@pytest.fixture
def php_manager(mock_api):
    # Mock OS root to prevent side effects
    return PhpManager(mock_api)

def test_php_process_ini_line(php_manager):
    """Test line processing for php.ini."""
    new_config = {
        "port": 9005,
        "memory_limit": "512M",
        "max_execution_time": "120"
    }
    ckeys = ['memory_limit', 'max_execution_time', 'upload_max_filesize', 'post_max_size']
    found_keys = set()
    
    # Port configuration
    line = "; vyloserve_port = 9000\n"
    res = php_manager._process_ini_line(line, new_config, ckeys, found_keys)
    assert res == "; vyloserve_port = 9005\n"
    
    # Memory limit configuration
    line2 = "memory_limit = 128M\n"
    res2 = php_manager._process_ini_line(line2, new_config, ckeys, found_keys)
    assert res2 == "memory_limit = 512M\n"
    assert "memory_limit" in found_keys
    
    # Extensions should be stripped out (returned as None)
    line3 = ";extension=curl\n"
    res3 = php_manager._process_ini_line(line3, new_config, ckeys, found_keys)
    assert res3 is None
    
    # Unrelated config
    line4 = "display_errors = On\n"
    res4 = php_manager._process_ini_line(line4, new_config, ckeys, found_keys)
    assert res4 == "display_errors = On\n"

def test_php_update_ini_lines(php_manager):
    """Test full ini lines update and extension appending."""
    lines = [
        "[PHP]\n",
        "; vyloserve_port = 9000\n",
        "memory_limit = 128M\n",
        "extension=mbstring\n",
        ";extension=pdo_mysql\n"
    ]
    
    new_config = {
        "port": 9000,
        "memory_limit": "256M",
        "post_max_size": "50M" # New key not in original lines
    }
    
    active_extensions = ["curl", "pdo_pgsql"]
    
    new_lines = php_manager._update_ini_lines(lines, new_config, active_extensions)
    
    content = "".join(new_lines)
    
    # Check basic modifications
    assert "memory_limit = 256M" in content
    assert "; vyloserve_port = 9000" in content
    
    # Check injected new keys
    assert "post_max_size = 50M" in content
    
    # Check extensions
    assert "extension=mbstring" not in content # Replaced by the new active_extensions list
    assert "extension=curl\n" in content
    assert "extension=pdo_pgsql\n" in content
    
    # Check extension dir for Windows
    if sys.platform == 'win32':
        assert 'extension_dir = "ext"\n' in content
