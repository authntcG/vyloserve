import os
import json
import pytest
from core.utils.file_utils import read_json, write_json

def test_read_json_file_not_exist(tmp_path):
    """Memastikan read_json mengembalikan tipe default (list/dict) jika file tidak ada."""
    fake_path = os.path.join(tmp_path, "missing.json")
    
    result_list = read_json(fake_path, list)
    assert result_list == []
    
    result_dict = read_json(fake_path, dict)
    assert result_dict == {}

def test_write_and_read_json(tmp_path):
    """Memastikan write_json dan read_json bekerja secara selaras."""
    test_file = os.path.join(tmp_path, "data.json")
    sample_data = [{"id": 1, "name": "VyloServe"}, {"id": 2, "name": "Test"}]
    
    # Menulis Data
    success = write_json(test_file, sample_data)
    assert success is True
    assert os.path.exists(test_file)
    
    # Membaca Data
    read_data = read_json(test_file, list)
    assert len(read_data) == 2
    assert read_data[0]["name"] == "VyloServe"

def test_read_json_invalid_format(tmp_path):
    """Memastikan sistem tidak crash jika file JSON korup/rusak."""
    test_file = os.path.join(tmp_path, "corrupt.json")
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write("{ ini_bukan_json_valid : true ]")
        
    result = read_json(test_file, list)
    assert result == [] # Harusnya mengembalikan list kosong (fallback)
