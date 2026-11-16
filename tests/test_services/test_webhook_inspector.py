import os
import io
import json
import urllib.error
from unittest.mock import MagicMock, patch
import pytest

from core.services.webhook_inspector import (
    WebhookInspectorManager,
    _WebhookRequestHandler,
    DEFAULT_WEBHOOK_PORT,
    MAX_STORED_WEBHOOKS
)


@pytest.fixture
def api_mock():
    mock = MagicMock()
    mock._window = MagicMock()
    mock.emit_log = MagicMock()
    mock.tunnels = MagicMock()
    return mock


@pytest.fixture
def webhook_manager(api_mock, tmp_path):
    with patch("core.services.webhook_inspector.get_project_root", return_value=str(tmp_path)):
        return WebhookInspectorManager(api_mock)


def test_webhook_inspector_init(webhook_manager, api_mock):
    assert webhook_manager.api == api_mock
    assert webhook_manager.host == "127.0.0.1"
    assert webhook_manager.port == DEFAULT_WEBHOOK_PORT
    assert os.path.exists(webhook_manager.storage_path)


def test_webhook_inspector_status(webhook_manager):
    status = webhook_manager.get_status()
    assert status["status"] == "success"
    assert status["running"] is False
    assert status["port"] == DEFAULT_WEBHOOK_PORT
    assert status["total_captured"] == 0
    assert status["tunnel_active"] is False


@patch("core.services.webhook_inspector.check_port_in_use", return_value=False)
@patch("core.services.webhook_inspector._CustomThreadingHttpServer")
@patch("core.services.webhook_inspector.threading.Thread")
def test_webhook_inspector_start_stop(mock_thread, mock_server_cls, mock_port_check, webhook_manager):
    # Invalid port
    res_inv = webhook_manager.start_listener(0)
    assert res_inv["status"] == "error"
    assert res_inv["message"] == "backend.webhook.invalid_port"

    # Port in use
    with patch("core.services.webhook_inspector.check_port_in_use", return_value=True):
        res_busy = webhook_manager.start_listener(8787)
        assert res_busy["status"] == "error"
        assert res_busy["message"] == "backend.webhook.port_in_use"

    # Happy path start
    mock_srv_inst = MagicMock()
    mock_server_cls.return_value = mock_srv_inst

    res_start = webhook_manager.start_listener(8787)
    assert res_start["status"] == "success"
    assert res_start["message"] == "backend.webhook.started"
    assert webhook_manager._server is not None

    # Already running
    res_already = webhook_manager.start_listener(8787)
    assert res_already["status"] == "success"
    assert res_already["message"] == "backend.webhook.already_running"

    # Stop listener
    res_stop = webhook_manager.stop_listener()
    assert res_stop["status"] == "success"
    assert res_stop["message"] == "backend.webhook.stopped"
    assert webhook_manager._server is None
    mock_srv_inst.shutdown.assert_called_once()
    mock_srv_inst.server_close.assert_called_once()

    # Stop when not running
    res_stop_again = webhook_manager.stop_listener()
    assert res_stop_again["status"] == "success"
    assert res_stop_again["message"] == "backend.webhook.not_running"


def test_webhook_inspector_tunnel(webhook_manager, api_mock):
    # Tunnel when listener stopped
    res_tunnel_stopped = webhook_manager.start_public_tunnel()
    assert res_tunnel_stopped["status"] == "error"
    assert res_tunnel_stopped["message"] == "backend.webhook.not_running"

    # Listener running, tunnel starts
    webhook_manager._server = MagicMock()
    api_mock.tunnels.start_cloudflare_share.return_value = {
        "status": "success",
        "share_id": "share_123",
        "url": "https://random.trycloudflare.com"
    }

    res_start_tunnel = webhook_manager.start_public_tunnel()
    assert res_start_tunnel["status"] == "success"
    assert res_start_tunnel["url"] == "https://random.trycloudflare.com"
    assert webhook_manager.tunnel_share_id == "share_123"

    # Stop tunnel
    api_mock.tunnels.stop_cloudflare_share.return_value = {"status": "success"}
    res_stop_tunnel = webhook_manager.stop_public_tunnel()
    assert res_stop_tunnel["status"] == "success"
    assert webhook_manager.tunnel_share_id is None

    # Stop tunnel when not active
    res_stop_again = webhook_manager.stop_public_tunnel()
    assert res_stop_again["status"] == "success"
    assert res_stop_again["message"] == "backend.webhook.tunnel_not_active"


def test_webhook_inspector_history_crud(webhook_manager):
    # Empty history
    assert webhook_manager.get_history()["data"] == []

    # Emulate captured request
    item = {
        "id": "wh_12345",
        "method": "POST",
        "path": "/api/webhook/order",
        "client_ip": "127.0.0.1",
        "timestamp": 1700000000,
        "size_bytes": 45,
        "is_json": True,
        "headers": {"Content-Type": "application/json"},
        "query_params": {"ref": "promo"},
        "body": '{"event": "created"}',
        "json_data": {"event": "created"}
    }
    webhook_manager._record_webhook(item)

    history = webhook_manager.get_history()
    assert len(history["data"]) == 1
    assert history["data"][0]["id"] == "wh_12345"
    assert history["data"][0]["method"] == "POST"

    # Detail
    detail_res = webhook_manager.get_webhook_detail("wh_12345")
    assert detail_res["status"] == "success"
    assert detail_res["data"]["json_data"] == {"event": "created"}

    # Not found
    assert webhook_manager.get_webhook_detail("invalid")["status"] == "error"

    # Clear history
    clear_res = webhook_manager.clear_history()
    assert clear_res["status"] == "success"
    assert webhook_manager.get_history()["data"] == []


def test_webhook_inspector_ring_buffer_limit(webhook_manager):
    for i in range(MAX_STORED_WEBHOOKS + 10):
        webhook_manager._record_webhook({
            "id": f"wh_{i}",
            "method": "GET",
            "path": f"/{i}",
            "client_ip": "127.0.0.1",
            "timestamp": 1700000000,
            "size_bytes": 0,
            "is_json": False,
            "headers": {},
            "query_params": {},
            "body": "",
            "json_data": None
        })

    items = webhook_manager._read_history()
    assert len(items) == MAX_STORED_WEBHOOKS


def test_webhook_inspector_response_config(webhook_manager):
    res_cfg = webhook_manager.set_response_config(201, "application/json", '{"created": true}')
    assert res_cfg["status"] == "success"
    assert res_cfg["data"]["status_code"] == 201

    get_cfg = webhook_manager.get_response_config()
    assert get_cfg["data"]["content_type"] == "application/json"


@patch("urllib.request.urlopen")
def test_send_http_request_success(mock_urlopen, webhook_manager):
    # URL required validation
    res_empty = webhook_manager.send_http_request("GET", "")
    assert res_empty["status"] == "error"
    assert res_empty["message"] == "backend.webhook.url_required"

    # Invalid scheme
    res_scheme = webhook_manager.send_http_request("GET", "ftp://example.com")
    assert res_scheme["status"] == "error"
    assert res_scheme["message"] == "backend.webhook.invalid_url_scheme"

    # Successful GET
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.reason = "OK"
    mock_resp.headers = {"Content-Type": "application/json"}
    mock_resp.read.return_value = b'{"msg": "pong"}'
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res_get = webhook_manager.send_http_request("GET", "http://127.0.0.1:8787/ping")
    assert res_get["status"] == "success"
    assert res_get["data"]["status_code"] == 200
    assert res_get["data"]["is_json"] is True
    assert res_get["data"]["body"] == '{"msg": "pong"}'


@patch("urllib.request.urlopen")
def test_send_http_request_http_error(mock_urlopen, webhook_manager):
    # Simulated 404 response
    he = urllib.error.HTTPError(
        url="http://127.0.0.1:8787/missing",
        code=404,
        msg="Not Found",
        hdrs=MagicMock(items=lambda: [("Content-Type", "text/plain")]),
        fp=io.BytesIO(b"Page Not Found")
    )
    mock_urlopen.side_effect = he

    res_404 = webhook_manager.send_http_request("GET", "http://127.0.0.1:8787/missing")
    assert res_404["status"] == "success"
    assert res_404["data"]["status_code"] == 404
    assert res_404["data"]["body"] == "Page Not Found"


@patch("urllib.request.urlopen")
def test_send_http_request_network_error(mock_urlopen, webhook_manager):
    mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

    res_err = webhook_manager.send_http_request("GET", "http://127.0.0.1:9999/down")
    assert res_err["status"] == "error"
    assert res_err["message"] == "backend.webhook.network_error"


def test_send_sample_webhook(webhook_manager):
    # Not running
    assert webhook_manager.send_sample_webhook()["status"] == "error"

    # Running
    webhook_manager._server = MagicMock()
    with patch.object(webhook_manager, "send_http_request", return_value={"status": "success"}) as mock_req:
        res = webhook_manager.send_sample_webhook()
        assert res["status"] == "success"
        mock_req.assert_called_once()
        args = mock_req.call_args[0]
        assert args[0] == "POST"
        assert "/api/webhook/sample-order" in args[1]


def test_webhook_request_handler_flow():
    server_mock = MagicMock()
    inspector_mock = MagicMock()
    inspector_mock.response_config = {
        "status_code": 200,
        "content_type": "application/json",
        "body": '{"status": "ok"}'
    }
    server_mock.inspector_ref = inspector_mock

    # Simulate incoming POST request with JSON
    body_content = b'{"event": "payment", "amount": 1000}'
    headers_mock = MagicMock()
    headers_mock.get = MagicMock(side_effect=lambda k, d=None: len(body_content) if k == "Content-Length" else d)
    headers_mock.items = MagicMock(return_value=[("Content-Type", "application/json"), ("X-Test", "123")])

    input_stream = io.BytesIO(body_content)
    output_stream = io.BytesIO()

    handler = _WebhookRequestHandler.__new__(_WebhookRequestHandler)
    handler.server = server_mock
    handler.command = "POST"
    handler.path = "/api/v1/pay?currency=IDR&mode=live"
    handler.client_address = ("192.168.1.50", 54321)
    handler.headers = headers_mock
    handler.rfile = input_stream
    handler.wfile = output_stream

    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()

    handler._handle_any_request()

    inspector_mock._record_webhook.assert_called_once()
    recorded = inspector_mock._record_webhook.call_args[0][0]
    assert recorded["method"] == "POST"
    assert recorded["path"] == "/api/v1/pay"
    assert recorded["client_ip"] == "192.168.1.50"
    assert recorded["query_params"] == {"currency": "IDR", "mode": "live"}
    assert recorded["is_json"] is True
    assert recorded["json_data"]["amount"] == 1000

    handler.send_response.assert_called_with(200)
    handler.send_header.assert_any_call("Content-Type", "application/json")
    handler.send_header.assert_any_call("Access-Control-Allow-Origin", "*")
