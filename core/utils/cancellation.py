import threading
from typing import Dict, Set
import psutil

class OperationCancelledError(Exception):
    """Dilempar ketika operasi download, ekstraksi, atau instalasi dibatalkan pengguna."""
    pass

class CancellationToken:
    """
    Token pembatalan thread-safe untuk mengoordinasikan penghentian operasi instalasi,
    download, ekstraksi, dan pemutusan proses eksternal (subprocess).
    """
    def __init__(self, module: str):
        self.module = module
        self._event = threading.Event()
        self._active_pids: Set[int] = set()
        self._lock = threading.Lock()

    def cancel(self):
        """Memicu sinyal pembatalan dan membunuh subprocess yang terdaftar."""
        self._event.set()
        self.kill_active_processes()

    def is_cancelled(self) -> bool:
        """Mengecek apakah pembatalan telah dipicu."""
        return self._event.is_set()

    def register_pid(self, pid: int):
        """Mendaftarkan PID proses eksternal agar dapat dimatikan jika dibatalkan."""
        if not pid:
            return
        with self._lock:
            self._active_pids.add(pid)

    def unregister_pid(self, pid: int):
        """Menghapus PID proses eksternal yang telah selesai secara normal."""
        with self._lock:
            self._active_pids.discard(pid)

    def kill_active_processes(self):
        """Membunuh seluruh proses eksternal yang terdaftar beserta child process-nya."""
        with self._lock:
            pids = list(self._active_pids)
        for pid in pids:
            try:
                parent = psutil.Process(pid)
                children = parent.children(recursive=True)
                for child in children:
                    try:
                        child.kill()
                    except psutil.Error:
                        pass
                try:
                    parent.kill()
                except psutil.Error:
                    pass
                psutil.wait_procs([*children, parent], timeout=3)
            except psutil.Error:
                pass
            with self._lock:
                self._active_pids.discard(pid)

class InstallationManager:
    """
    Registry terpusat untuk mengelola CancellationToken per modul instalasi di VyloServe.
    """
    _tokens: Dict[str, CancellationToken] = {}
    _lock = threading.Lock()

    @classmethod
    def create_token(cls, module: str) -> CancellationToken:
        """Membuat token pembatalan baru untuk memulai siklus operasi baru."""
        with cls._lock:
            token = CancellationToken(module)
            cls._tokens[module] = token
            return token

    @classmethod
    def get_token(cls, module: str) -> CancellationToken:
        """Mengambil token aktif untuk modul tertentu, atau membuat baru jika belum ada."""
        with cls._lock:
            if module not in cls._tokens:
                cls._tokens[module] = CancellationToken(module)
            return cls._tokens[module]

    @classmethod
    def cancel(cls, module: str) -> bool:
        """Membatalkan proses aktif pada modul yang diminta jika ada."""
        with cls._lock:
            token = cls._tokens.get(module)
            if token and not token.is_cancelled():
                token.cancel()
                return True
            return False

    @classmethod
    def is_cancelled(cls, module: str) -> bool:
        """Memeriksa apakah modul dalam status dibatalkan."""
        with cls._lock:
            token = cls._tokens.get(module)
            return token.is_cancelled() if token else False

    @classmethod
    def reset(cls, module: str):
        """Membersihkan token setelah proses instalasi selesai atau dibatalkan."""
        with cls._lock:
            cls._tokens.pop(module, None)

    @classmethod
    def reset_all(cls):
        """Membersihkan seluruh token (digunakan terutama saat testing/teardown)."""
        with cls._lock:
            cls._tokens.clear()
