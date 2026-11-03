import socket
import urllib.error
from typing import Any, Dict, Optional, Tuple

MSG_NO_INTERNET = "backend.error.no_internet"

DEFAULT_CONNECTIVITY_PROBES: Tuple[Tuple[str, int], ...] = (
    ("1.1.1.1", 53),  # NOSONAR python:S1313
    ("8.8.8.8", 53),  # NOSONAR python:S1313
    ("api.github.com", 443),
)


def check_internet_connection(
    timeout: float = 2.0,
    probes: Tuple[Tuple[str, int], ...] = DEFAULT_CONNECTIVITY_PROBES,
) -> bool:
    """
    Memeriksa ketersediaan koneksi internet secara cepat (non-blocking lama)
    menggunakan koneksi TCP socket ringan ke endpoint publik.
    """
    for host, port in probes:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def is_network_error(exc: Optional[BaseException]) -> bool:
    """
    Mendeteksi apakah sebuah exception disebabkan oleh masalah konektivitas jaringan
    (DNS gagal, koneksi ditolak/putus, atau timeout), bukan HTTPError dari server.
    """
    if exc is None:
        return False

    if isinstance(exc, urllib.error.HTTPError):
        return False

    if isinstance(exc, urllib.error.URLError):
        return True

    if isinstance(exc, (socket.gaierror, socket.timeout, TimeoutError, ConnectionError)):
        return True

    err_text = str(exc).lower()
    network_indicators = (
        "getaddrinfo failed",
        "name or service not known",
        "temporary failure in name resolution",
        "network is unreachable",
        "no route to host",
        "timed out",
        "connection refused",
        "connection reset",
        "winerror 10051",
        "winerror 10054",
        "winerror 10060",
        "winerror 10061",
        "winerror 10065",
        "errno 11001",
    )
    return any(indicator in err_text for indicator in network_indicators)


def build_offline_error_response(
    fallback_msg_key: str = MSG_NO_INTERNET,
    args: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Membangun dictionary response error standar ketika operasi gagal karena offline.
    """
    res: Dict[str, Any] = {
        "status": "error",
        "message": fallback_msg_key,
        "is_offline": True,
    }
    if args:
        res["args"] = args
    return res
