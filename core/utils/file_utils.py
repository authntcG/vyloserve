import os
import json
import zipfile
import tarfile
import urllib.request
import urllib.error
import concurrent.futures
import threading
from typing import Any, Callable, Optional, Union

def read_json(file_path: str, default_type: type = list) -> Any:
    """
    Membaca file JSON secara aman. Jika gagal atau file tidak ada, 
    mengembalikan tipe default kosong (list/dict).
    
    Args:
        file_path (str): Lokasi path absolut file JSON.
        default_type (type): Tipe data kembalian bawaan (list atau dict).
        
    Returns:
        Any: Data JSON yang diparsing.
    """
    if not os.path.exists(file_path):
        return default_type()
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read().strip()
            if not content:
                return default_type()
            return json.loads(content)
    except Exception:
        return default_type()

def write_json(file_path: str, data: Any) -> bool:
    """
    Menyimpan data (list/dict) ke dalam format file JSON dengan rapi.
    
    Args:
        file_path (str): Lokasi path absolut file JSON.
        data (Any): List/Dict yang akan disimpan.
        
    Returns:
        bool: True jika berhasil, False jika terjadi error.
    """
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        return True
    except Exception:
        return False

def extract_archive(file_path: str, extract_to: str, progress_cb: Optional[Callable[[int, str], None]] = None) -> bool:
    """
    Mengekstrak file Arsip (.zip atau .tar.gz) secara universal dengan aman.
    Mendukung pelaporan progress persentase jika callback disertakan.
    
    Args:
        file_path (str): Path file arsip mentah.
        extract_to (str): Path direktori tujuan ekstraksi.
        progress_cb (Callable, optional): Fungsi callback untuk update UI (percent, text).
        
    Returns:
        bool: True jika ekstraksi sukses.
    """
    try:
        if file_path.endswith('.zip'):
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                members = zip_ref.infolist()
                total_files = len(members)
                last_percent = -1
                
                for index, member in enumerate(members):
                    zip_ref.extract(member, extract_to)
                    
                    if progress_cb and (index % 50 == 0 or index == total_files - 1):
                        # Ekstraksi dipetakan antara 65% - 80% dari keseluruhan proses instalasi
                        extract_percent = 65 + int((index / total_files) * 15)
                        if extract_percent != last_percent:
                            progress_cb(extract_percent, f"Mengekstrak... ({index}/{total_files} file)")
                            last_percent = extract_percent
                            
        elif file_path.endswith('.tar.gz'):
            with tarfile.open(file_path, 'r:gz') as tar_ref:
                tar_ref.extractall(extract_to)
                if progress_cb: progress_cb(80, "Selesai mengekstrak TAR.GZ...")
                
        return True
    except Exception as e:
        raise Exception(f"Gagal mengekstrak arsip: {str(e)}")

def download_advanced(url: str, dest_path: str, 
                      log_cb: Optional[Callable[[str, str], None]] = None, 
                      progress_cb: Optional[Callable[[int, str], None]] = None) -> bool:
    """
    Super Downloader. Akan mendeteksi apakah server mengizinkan Multi-part (Range Bytes).
    Jika iya, file akan dipisah 8 jalur & diunduh menggunakan Multi-Threading (IDM Style).
    Jika tidak, akan jatuh pada mode Single-Stream konvensional.
    
    Args:
        url (str): Link unduhan target.
        dest_path (str): File ZIP/TAR hasil unduhan di lokal.
        log_cb (Callable, optional): Callback untuk log(message, level).
        progress_cb (Callable, optional): Callback untuk progress(percent, message).
    """
    if log_cb: log_cb("Memeriksa kapabilitas peladen unduhan...", "info")
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            total_size = int(response.info().get('Content-Length', 0))
            accept_ranges = response.info().get('Accept-Ranges', 'none')
    except urllib.error.HTTPError as http_err:
        if http_err.code == 404: raise Exception("File instalasi (404 Not Found) di server asal.")
        raise Exception(f"Server mengembalikan kode error: {http_err.code}")
    except Exception:
        total_size = 0
        accept_ranges = 'none'

    # ---> MODE IDM MULTI-THREADING (AKSELERASI 8x) <---
    if total_size > 0 and accept_ranges.lower() == 'bytes':
        if log_cb: log_cb("Server mendukung 'Range Bytes'. Memulai Akselerasi Multi-Part (8 Koneksi)...", "success")
        num_connections = 8
        part_size = total_size // num_connections
        
        # Pre-alokasi file raksasa untuk mencegah fragmentasi Disk
        with open(dest_path, "wb") as f:
            f.seek(total_size - 1)
            f.write(b'\0')
            
        downloaded_bytes = 0
        last_percent = -1
        lock = threading.Lock()
        
        def download_chunk(start, end):
            nonlocal downloaded_bytes, last_percent
            req_chunk = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Range': f'bytes={start}-{end}'
            })
            with urllib.request.urlopen(req_chunk, timeout=30) as res, open(dest_path, 'r+b') as f:
                f.seek(start)
                while True:
                    chunk = res.read(32768) # Chunk 32KB
                    if not chunk: break
                    f.write(chunk)
                    
                    with lock:
                        downloaded_bytes += len(chunk)
                        dl_percent = int((downloaded_bytes * 100) / total_size)
                        # Petakan progress ke hitungan UI (10% - 60% untuk fase download)
                        overall_percent = 10 + int(dl_percent * 0.5) 
                        
                        if progress_cb and overall_percent != last_percent and overall_percent <= 60:
                            progress_cb(overall_percent, f"Mengunduh (Multi-Part)... {dl_percent}%")
                            last_percent = overall_percent

        # Luncurkan pasukan executor
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_connections) as executor:
            futures = []
            for i in range(num_connections):
                start = i * part_size
                end = start + part_size - 1 if i < num_connections - 1 else total_size - 1
                futures.append(executor.submit(download_chunk, start, end))
            
            # Tangkap exception di individual thread jika ada
            for future in concurrent.futures.as_completed(futures):
                future.result() 

    # ---> MODE SINGLE STREAM (FALLBACK) <---
    else:
        if log_cb: log_cb("Server memblokir Multi-Part. Melanjutkan dengan mode Single-Stream standar.", "warn")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response, open(dest_path, 'wb') as out_file:
            block_size = 32768
            read_size = 0
            last_percent = -1
            
            while True:
                buffer = response.read(block_size)
                if not buffer: break
                out_file.write(buffer)
                read_size += len(buffer)
                
                if total_size > 0:
                    dl_percent = int((read_size * 100) / total_size)
                    overall_percent = 10 + int(dl_percent * 0.5) 
                    if progress_cb and overall_percent != last_percent and overall_percent <= 60:
                        progress_cb(overall_percent, f"Mengunduh... {dl_percent}%")
                        last_percent = overall_percent
                else:
                    mb_downloaded = (read_size) / (1024 * 1024)
                    if progress_cb and read_size % (1024 * 1024) < block_size:
                        progress_cb(35, f"Mengunduh... {mb_downloaded:.1f} MB (Ukuran server anonim)")
                        
    return True