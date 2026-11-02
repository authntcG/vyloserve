import socket
import urllib.error
from unittest.mock import patch, MagicMock
from core.utils.network_utils import (
    check_internet_connection,
    is_network_error,
    build_offline_error_response,
    MSG_NO_INTERNET,
)


def test_check_internet_connection_returns_true_on_first_successful_probe():
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    with patch("core.utils.network_utils.socket.create_connection", return_value=mock_conn) as mock_create:
        assert check_internet_connection(timeout=1.5) is True
        mock_create.assert_called_once_with(("1.1.1.1", 53), timeout=1.5)


def test_check_internet_connection_falls_back_to_next_probe_when_first_fails():
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    with patch(
        "core.utils.network_utils.socket.create_connection",
        side_effect=[OSError("probe 1 down"), mock_conn],
    ) as mock_create:
        assert check_internet_connection(timeout=1.0) is True
        assert mock_create.call_count == 2


def test_check_internet_connection_returns_false_when_all_probes_fail():
    with patch(
        "core.utils.network_utils.socket.create_connection",
        side_effect=OSError("network unreachable"),
    ) as mock_create:
        assert check_internet_connection(timeout=0.5, probes=(("1.1.1.1", 53), ("8.8.8.8", 53))) is False
        assert mock_create.call_count == 2


def test_is_network_error_identifies_network_exceptions():
    assert is_network_error(None) is False
    assert is_network_error(urllib.error.URLError("getaddrinfo failed")) is True
    assert is_network_error(socket.gaierror(11001, "getaddrinfo failed")) is True
    assert is_network_error(socket.timeout("timed out")) is True
    assert is_network_error(TimeoutError("timed out")) is True
    assert is_network_error(ConnectionResetError("reset")) is True
    assert is_network_error(RuntimeError("[Errno 11001] getaddrinfo failed")) is True
    assert is_network_error(RuntimeError("WinError 10060 connection timed out")) is True


def test_is_network_error_returns_false_for_http_error_and_logic_errors():
    http_err = urllib.error.HTTPError(
        url="https://api.github.com",
        code=404,
        msg="Not Found",
        hdrs=None,
        fp=None,
    )
    assert is_network_error(http_err) is False
    assert is_network_error(ValueError("invalid json")) is False


def test_build_offline_error_response():
    res = build_offline_error_response()
    assert res == {
        "status": "error",
        "message": MSG_NO_INTERNET,
        "is_offline": True,
    }

    res_with_args = build_offline_error_response("backend.custom.offline", {"service": "apache"})
    assert res_with_args == {
        "status": "error",
        "message": "backend.custom.offline",
        "is_offline": True,
        "args": {"service": "apache"},
    }
