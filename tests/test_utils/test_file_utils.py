import os
import json
import pytest
import urllib.error
from unittest.mock import patch, MagicMock, call
from core.utils.file_utils import read_json, write_json, extract_archive, download_advanced

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

def test_read_json_empty_file_returns_default(tmp_path):
    """File ada tapi kosong (0 byte) -> harus mengembalikan default, bukan error JSONDecodeError."""
    test_file = os.path.join(tmp_path, "empty.json")
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write("")
    assert read_json(test_file, list) == []
    assert read_json(test_file, dict) == {}

def test_write_json_returns_false_on_failure(tmp_path):
    """Jika penulisan gagal (mis. disk penuh/permission), harus return False, bukan melempar exception."""
    test_file = os.path.join(tmp_path, "data.json")
    with patch('builtins.open', side_effect=OSError("disk full")):
        assert write_json(test_file, {"a": 1}) is False

@patch('core.utils.file_utils.zipfile.ZipFile')
def test_extract_archive_zip(mock_zipfile):
    """Test extracting a zip archive."""
    mock_zip_instance = MagicMock()
    mock_zipfile.return_value.__enter__.return_value = mock_zip_instance

    member1 = MagicMock(filename='file1.txt')
    member2 = MagicMock(filename='file2.txt')
    mock_zip_instance.infolist.return_value = [member1, member2]

    progress_mock = MagicMock()

    success = extract_archive('test.zip', '/dest', progress_mock)

    assert success is True
    assert mock_zip_instance.extract.call_count == 2
    mock_zip_instance.extract.assert_any_call(member1, '/dest')
    mock_zip_instance.extract.assert_any_call(member2, '/dest')
    progress_mock.assert_called()

@patch('core.utils.file_utils.zipfile.ZipFile')
def test_extract_archive_zip_blocks_path_traversal(mock_zipfile):
    """Security path: member arsip dengan path traversal (zip slip) harus ditolak, bukan diekstrak diam-diam."""
    mock_zip_instance = MagicMock()
    mock_zipfile.return_value.__enter__.return_value = mock_zip_instance

    malicious_member = MagicMock(filename='../../evil.exe')
    mock_zip_instance.infolist.return_value = [malicious_member]

    with pytest.raises(RuntimeError):
        extract_archive('test.zip', '/dest')

    mock_zip_instance.extract.assert_not_called()

@patch('core.utils.file_utils.tarfile.open')
def test_extract_archive_tar_gz(mock_tarfile):
    """Test extracting a tar.gz archive."""
    mock_tar_instance = MagicMock()
    mock_tarfile.return_value.__enter__.return_value = mock_tar_instance
    mock_tar_instance.getmembers.return_value = []

    progress_mock = MagicMock()
    success = extract_archive('test.tar.gz', '/dest', progress_mock)

    assert success is True
    mock_tar_instance.extractall.assert_called_once_with('/dest', members=[])
    progress_mock.assert_called_once_with(80, "Selesai mengekstrak TAR.GZ...")

@patch('core.utils.file_utils.tarfile.open')
def test_extract_archive_tar_gz_blocks_path_traversal(mock_tarfile):
    """Security path: member tar.gz dengan path traversal (zip slip) harus ditolak."""
    mock_tar_instance = MagicMock()
    mock_tarfile.return_value.__enter__.return_value = mock_tar_instance

    malicious_member = MagicMock(name='../../evil.sh')
    malicious_member.name = '../../evil.sh'
    mock_tar_instance.getmembers.return_value = [malicious_member]

    with pytest.raises(RuntimeError):
        extract_archive('test.tar.gz', '/dest')

    mock_tar_instance.extractall.assert_not_called()

def test_extract_archive_invalid_extension():
    """Test that extract_archive ignores unknown extensions and returns True."""
    success = extract_archive('test.rar', '/dest')
    assert success is True

@patch('core.utils.file_utils.urllib.request.urlopen')
def test_download_advanced_single_stream(mock_urlopen, tmp_path):
    """Test download_advanced falling back to single stream."""
    mock_response = MagicMock()
    mock_response.info.return_value.get.side_effect = lambda key, default=None: '100' if key == 'Content-Length' else 'none'
    mock_urlopen.return_value.__enter__.return_value = mock_response
    
    dest_path = os.path.join(tmp_path, "downloaded.bin")
    mock_response.read.side_effect = [b'data1', b'data2', b'']
    
    progress_mock = MagicMock()
    log_mock = MagicMock()
    
    success = download_advanced('http://example.com/file.zip', dest_path, log_mock, progress_mock)
    
    assert success is True
    assert os.path.exists(dest_path)
    with open(dest_path, 'rb') as f:
        assert f.read() == b'data1data2'
        
    log_mock.assert_any_call("Memeriksa kapabilitas peladen unduhan...", "info")
    log_mock.assert_any_call("Server memblokir Multi-Part. Melanjutkan dengan mode Single-Stream standar.", "warn")

@patch('core.utils.file_utils.urllib.request.urlopen')
def test_download_advanced_multi_part(mock_urlopen, tmp_path):
    """Test download_advanced using multi-part download."""
    mock_response = MagicMock()
    mock_response.info.return_value.get.side_effect = lambda key, default=None: '100' if key == 'Content-Length' else 'bytes'
    mock_response.read.side_effect = [b'chunk', b''] * 8
    mock_urlopen.return_value.__enter__.return_value = mock_response
    
    dest_path = os.path.join(tmp_path, "downloaded.bin")
    
    progress_mock = MagicMock()
    log_mock = MagicMock()
    
    success = download_advanced('http://example.com/file.zip', dest_path, log_mock, progress_mock)
    
    assert success is True
    assert os.path.exists(dest_path)
    assert os.path.getsize(dest_path) == 100
    log_mock.assert_any_call("Server mendukung 'Range Bytes'. Memulai Akselerasi Multi-Part (8 Koneksi)...", "success")

@patch('core.utils.file_utils.urllib.request.urlopen')
def test_download_advanced_404(mock_urlopen):
    """Test download_advanced raising runtime error on 404."""
    mock_urlopen.side_effect = urllib.error.HTTPError('url', 404, 'Not Found', {}, None)

    with pytest.raises(RuntimeError, match="404 Not Found"):
        download_advanced('http://example.com/file.zip', '/dest')

@patch('core.utils.file_utils.urllib.request.urlopen')
def test_download_advanced_non_404_http_error(mock_urlopen):
    """Error HTTP selain 404 (mis. 500) harus tetap dilempar sebagai RuntimeError dengan kode aslinya."""
    mock_urlopen.side_effect = urllib.error.HTTPError('url', 500, 'Server Error', {}, None)

    with pytest.raises(RuntimeError, match="kode error: 500"):
        download_advanced('http://example.com/file.zip', '/dest')

@patch('core.utils.file_utils.urllib.request.urlopen')
def test_download_advanced_head_check_failure_falls_back_to_unknown_size(mock_urlopen, tmp_path):
    """
    Jika HEAD request gagal dengan error umum (bukan HTTPError, mis. server tidak
    mendukung HEAD), total_size dianggap 0 dan tetap lanjut download via single-stream
    tanpa progress berbasis persentase (karena ukuran file tidak diketahui).
    """
    mock_get_response = MagicMock()
    mock_get_response.read.side_effect = [b'x' * (1024 * 1024), b'']  # persis 1 MB lalu selesai

    def urlopen_side_effect(req, timeout=None):
        if req.get_method() == 'HEAD':
            raise OSError("HEAD not supported by server")
        cm = MagicMock()
        cm.__enter__.return_value = mock_get_response
        return cm

    mock_urlopen.side_effect = urlopen_side_effect

    dest_path = os.path.join(tmp_path, "downloaded.bin")
    progress_mock = MagicMock()

    success = download_advanced('http://example.com/file.zip', dest_path, progress_cb=progress_mock)

    assert success is True
    progress_mock.assert_any_call(35, "Mengunduh... 1.0 MB (Ukuran server anonim)")
