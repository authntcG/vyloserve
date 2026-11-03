from unittest.mock import patch
import pytest
from core.services.database import DatabaseManager

def test_database_manager_process_config_line(mock_api, tmp_path):
    """
    Menguji fungsionalitas parser config baris-per-baris untuk PostgreSQL
    tanpa perlu membuat file config asli.
    """
    # 1. Setup Manajer dengan API Tiruan dalam direktori terisolasi
    with patch('core.services.database.get_project_root', return_value=str(tmp_path)):
        manager = DatabaseManager(mock_api)
    
    # 2. Skenario Uji
    keys = {
        "shared_buffers": "256MB",
        "work_mem": "16MB"
    }
    found_keys = set()
    
    # Kasus A: Baris yang cocok (mengandung target key)
    line = "shared_buffers = 128MB\t\t# default value\n"
    new_line = manager._process_config_line(line, keys, found_keys)
    
    assert new_line == "shared_buffers = 256MB\n"
    assert "shared_buffers" in found_keys
    
    # Kasus B: Baris yang dikomentari harus dilewati
    line_commented = "#work_mem = 4MB\n"
    new_line_commented = manager._process_config_line(line_commented, keys, found_keys)
    
    # Harus kembali ke string asli karena tidak di-replace (dianggap komentar)
    assert new_line_commented == line_commented 
    assert "work_mem" not in found_keys
    
    # Kasus C: Baris yang tidak relevan
    line_unrelated = "max_connections = 100\n"
    new_line_unrelated = manager._process_config_line(line_unrelated, keys, found_keys)
    
    assert new_line_unrelated == line_unrelated
