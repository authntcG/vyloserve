import pytest
import os
from unittest.mock import patch, MagicMock

from core.services.project import ProjectManager

@pytest.fixture
def project_manager(mock_api, tmp_path):
    with patch('core.services.project.get_project_root', return_value=str(tmp_path)):
        # Make a mock data_dir and json file so read_json doesn't fail
        data_dir = tmp_path / 'data'
        data_dir.mkdir(exist_ok=True)
        return ProjectManager(mock_api)

def test_determine_framework_package(project_manager):
    """Test framework determination for Composer."""
    # Laravel
    pkg, is_legacy = project_manager._determine_framework_package("laravel", "", "8.1.0")
    assert pkg == "laravel/laravel"
    assert is_legacy is False
    
    pkg, is_legacy = project_manager._determine_framework_package("laravel", "10.0.0", "8.1.0")
    assert pkg == "laravel/laravel:10.0.0"
    assert is_legacy is False

    # CodeIgniter Modern (PHP 8.1+)
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "", "8.1.0")
    assert pkg == "codeigniter4/appstarter"
    assert is_legacy is False

    # CodeIgniter Legacy (PHP 7.4)
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "", "7.4.3")
    assert pkg == "codeigniter/framework"
    assert is_legacy is True
    
    # Specific CI version
    pkg, is_legacy = project_manager._determine_framework_package("codeigniter", "4.2.0", "7.4.3")
    assert pkg == "codeigniter4/appstarter:4.2.0"
    assert is_legacy is False

@patch('os.path.exists')
@patch('os.path.isdir')
def test_generate_vhost_block_smart_routing(mock_isdir, mock_exists, project_manager):
    """Test vhost block generation and smart routing to /public."""
    # We want to mock exists for the "public" dir check
    mock_exists.return_value = True
    mock_isdir.return_value = True
    
    # Mock finding the PHP port
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9005):
        # We don't want to actually save projects during the test
        with patch.object(project_manager, '_save_projects'):
            project = {
                "domain": "test.local",
                "path": "c:\\www\\test_project",
                "php_version": "8.1",
                "php_port": 9000
            }
            
            block = project_manager._generate_vhost_block(project, [project])
            
            # The docroot should be intelligently appended with /public
            assert 'DocumentRoot "c:/www/test_project/public"' in block
            assert '<Directory "c:/www/test_project/public">' in block
            assert 'ServerName test.local' in block
            
            # The port should be updated to what the system returned
            assert 'SetHandler "proxy:fcgi://127.0.0.1:9005/"' in block
            assert project['php_port'] == 9005

def test_generate_vhost_block_explicit_public(project_manager):
    """Test vhost block when path already ends in public."""
    with patch.object(project_manager, '_get_php_port_from_system', return_value=9002):
        with patch.object(project_manager, '_save_projects'):
            project = {
                "domain": "test2.local",
                "path": "c:/www/test2/public",
                "php_version": "8.0",
                "php_port": 9002
            }
            
            block = project_manager._generate_vhost_block(project, [project])
            
            # Should not duplicate /public
            assert 'DocumentRoot "c:/www/test2/public"' in block
            assert '<Directory "c:/www/test2/public">' in block
