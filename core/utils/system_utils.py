import os
import sys
import socket
import subprocess
from typing import List, Optional

def get_project_root():
    """ 
    Mendapatkan root direktori yang aman.
    Jika berupa .exe, gunakan folder tempat .exe berada (Portable Mode).
    Jika berupa .py, gunakan folder root proyek.
    """
    if getattr(sys, 'frozen', False):
        # Berjalan sebagai executable PyInstaller (.exe)
        # Menghasilkan path folder tempat .exe tersebut diletakkan
        return os.path.dirname(sys.executable)
    else:
        # Berjalan sebagai script Python normal (.py)
        # Asumsi: file ini ada di core/utils/system_utils.py (mundur 3 level ke root)
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_silent_flags() -> int:
    """
    Mendapatkan creation flags untuk menyembunyikan jendela console (CMD) di OS Windows.
    Sangat penting agar background process tidak memunculkan popup hitam.
    
    Returns:
        int: Flag CREATE_NO_WINDOW untuk Windows, atau 0 untuk Mac/Linux.
    """
    return 0x08000000 if sys.platform == 'win32' else 0

def run_silent_command(cmd: List[str], cwd: Optional[str] = None, env: Optional[dict] = None) -> subprocess.CompletedProcess:
    """
    Menjalankan command shell (subprocess.run) secara tersembunyi (tanpa jendela console).
    Digunakan untuk perintah yang ditunggu hingga selesai (Synchronous).
    
    Args:
        cmd (List[str]): Perintah yang akan dieksekusi dalam bentuk list.
        cwd (str, optional): Direktori kerja (Current Working Directory).
        env (dict, optional): Environment variables khusus (misal untuk PHP).
        
    Returns:
        subprocess.CompletedProcess: Hasil eksekusi dari subprocess.
    """
    return subprocess.run(
        cmd, 
        cwd=cwd,
        env=env,
        creationflags=get_silent_flags(), 
        capture_output=True, 
        text=True
    )

def start_silent_process(cmd: List[str], cwd: Optional[str] = None, env: Optional[dict] = None) -> subprocess.Popen:
    """
    Menjalankan proses di latar belakang (subprocess.Popen) secara tersembunyi.
    Digunakan untuk service yang berjalan terus-menerus (Asynchronous) seperti PHP-CGI/Apache.
    
    Args:
        cmd (List[str]): Perintah eksekusi.
        cwd (str, optional): Direktori kerja.
        env (dict, optional): Environment variables khusus.
        
    Returns:
        subprocess.Popen: Objek proses yang sedang berjalan.
    """
    return subprocess.Popen(
        cmd, 
        cwd=cwd,
        env=env,
        creationflags=get_silent_flags(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def check_port_in_use(port: int, host: str = '127.0.0.1', timeout: float = 0.05) -> bool:
    """
    Mengecek apakah sebuah Port TCP sedang digunakan/terbuka.
    Dioptimasi menggunakan Timeout kecil agar tidak membekukan (blocking) aplikasi.
    
    Args:
        port (int): Nomor port yang akan di cek.
        host (str, optional): Host target (Default localhost).
        timeout (float, optional): Batas waktu tunggu dalam detik.
        
    Returns:
        bool: True jika port sedang digunakan (terbuka), False jika kosong.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        return s.connect_ex((host, int(port))) == 0