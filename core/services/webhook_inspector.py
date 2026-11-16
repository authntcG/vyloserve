import os
import sys
import time
import uuid
import json
import threading
from urllib.parse import urlparse, parse_qs
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, List, Optional

from core.utils.system_utils import get_project_root, check_port_in_use
from core.utils.file_utils import read_json, write_json

DEFAULT_WEBHOOK_PORT = 8787
MAX_STORED_WEBHOOKS = 100
MSG_UNEXPECTED = "backend.error.unexpected"
MIME_APPLICATION_JSON = "application/json"
MSG_WEBHOOK_NOT_RUNNING = "backend.webhook.not_running"


class _WebhookRequestHandler(BaseHTTPRequestHandler):
    """
    HTTP Request Handler untuk menangkap semua panggilan webhook masuk (GET, POST, PUT, PATCH, DELETE, dll.).
    """

    def log_message(self, format, *args):
        # Meredam logging console bawaan BaseHTTPRequestHandler
        pass

    def _handle_any_request(self):
        inspector = self.server.inspector_ref  # type: ignore

        # 1. Parse URL & Query Params
        parsed_url = urlparse(self.path)
        path = parsed_url.path or "/"
        query_params = {k: v[0] if len(v) == 1 else v for k, v in parse_qs(parsed_url.query).items()}

        # 2. Extract Headers
        headers = {k: str(v) for k, v in self.headers.items()}

        # 3. Read Body
        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
        body_text = body_bytes.decode('utf-8', errors='replace')

        is_json = False
        json_data = None
        if body_text.strip():
            try:
                json_data = json.loads(body_text)
                is_json = True
            except Exception:
                is_json = False

        # 4. Save to history
        client_ip = self.client_address[0] if self.client_address else "127.0.0.1"
        item = {
            "id": f"wh_{int(time.time())}_{uuid.uuid4().hex[:8]}",
            "method": self.command.upper(),
            "path": path,
            "query_params": query_params,
            "headers": headers,
            "body": body_text,
            "is_json": is_json,
            "json_data": json_data,
            "client_ip": client_ip,
            "size_bytes": len(body_bytes),
            "timestamp": int(time.time()),
        }

        inspector._record_webhook(item)

        # 5. Respond with configured response
        resp_cfg = inspector.response_config
        status_code = int(resp_cfg.get("status_code", 200))
        content_type = str(resp_cfg.get("content_type", MIME_APPLICATION_JSON))
        resp_body = str(resp_cfg.get("body", '{"status": "ok", "received_by": "VyloServe"}')).encode('utf-8')

        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(resp_body)))
        self.send_header("X-Powered-By", "VyloServe-Webhook-Inspector")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()
        self.wfile.write(resp_body)

    def do_GET(self):
        self._handle_any_request()

    def do_POST(self):
        self._handle_any_request()

    def do_PUT(self):
        self._handle_any_request()

    def do_PATCH(self):
        self._handle_any_request()

    def do_DELETE(self):
        self._handle_any_request()

    def do_HEAD(self):
        self._handle_any_request()

    def do_OPTIONS(self):
        self._handle_any_request()


class _CustomThreadingHttpServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address, request_handler_class, inspector_ref):
        self.inspector_ref = inspector_ref
        super().__init__(server_address, request_handler_class)


class WebhookInspectorManager:
    """
    Manager penerima Webhook lokal dan Klien HTTP ringan (API Tester).
    Menangkap request masuk di port 8787 dan terintegrasi dengan Cloudflare Tunnel.
    """

    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.storage_path = os.path.join(self.data_dir, 'webhook_history.json')
        self.host = "127.0.0.1"
        self.port = DEFAULT_WEBHOOK_PORT

        self._server: Optional[_CustomThreadingHttpServer] = None
        self._server_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Cloudflare Tunnel integration state
        self.tunnel_share_id: Optional[str] = None
        self.tunnel_public_url: Optional[str] = None

        # Configurable default response
        self.response_config = {
            "status_code": 200,
            "content_type": MIME_APPLICATION_JSON,
            "body": '{"status": "ok", "received_by": "VyloServe"}'
        }

        os.makedirs(self.data_dir, exist_ok=True)
        if not os.path.exists(self.storage_path):
            write_json(self.storage_path, [])

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api:
            self.api.emit_log(msg, level, args)

    # ==========================================
    # LISTENER LIFECYCLE
    # ==========================================
    def get_status(self) -> dict:
        is_running = self._server is not None
        history = self._read_history()
        return {
            "status": "success",
            "running": is_running,
            "host": self.host,
            "port": self.port,
            "total_captured": len(history),
            "tunnel_active": bool(self.tunnel_public_url),
            "tunnel_url": self.tunnel_public_url or "",
            "response_config": self.response_config
        }

    def start_listener(self, port: int = DEFAULT_WEBHOOK_PORT) -> dict:
        try:
            port = int(port)
            if port < 1 or port > 65535:
                return {"status": "error", "message": "backend.webhook.invalid_port"}

            with self._lock:
                if self._server is not None:
                    return {
                        "status": "success",
                        "message": "backend.webhook.already_running",
                        "args": {"port": self.port}
                    }

                if check_port_in_use(port):
                    return {
                        "status": "error",
                        "message": "backend.webhook.port_in_use",
                        "args": {"port": port}
                    }

                self.port = port
                self._server = _CustomThreadingHttpServer((self.host, self.port), _WebhookRequestHandler, self)
                self._server_thread = threading.Thread(target=self._server.serve_forever, daemon=True)
                self._server_thread.start()

            self._log("backend.webhook.started", "success", {"port": self.port})
            return {
                "status": "success",
                "message": "backend.webhook.started",
                "args": {"port": self.port}
            }
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def stop_listener(self) -> dict:
        try:
            # Stop tunnel if running
            if self.tunnel_share_id:
                self.stop_public_tunnel()

            with self._lock:
                if self._server is None:
                    return {"status": "success", "message": MSG_WEBHOOK_NOT_RUNNING}

                server_to_stop = self._server
                self._server = None
                server_to_stop.shutdown()
                server_to_stop.server_close()
                self._server_thread = None

            self._log("backend.webhook.stopped", "info")
            return {"status": "success", "message": "backend.webhook.stopped"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    # ==========================================
    # CLOUDFLARE TUNNEL INTEGRATION
    # ==========================================
    def start_public_tunnel(self) -> dict:
        """Mengekspos listener webhook lokal via Cloudflare Tunnel agar layanan eksternal bisa menembak webhook"""
        if self._server is None:
            return {"status": "error", "message": MSG_WEBHOOK_NOT_RUNNING}

        if not hasattr(self.api, 'tunnels') or not self.api.tunnels:
            return {"status": "error", "message": "backend.tunnels.not_loaded"}

        try:
            target = f"localhost:{self.port}"
            res = self.api.tunnels.start_cloudflare_share(target)
            if res.get("status") == "success":
                self.tunnel_share_id = res.get("share_id")
                self.tunnel_public_url = res.get("url")
                return {
                    "status": "success",
                    "message": "backend.webhook.tunnel_started",
                    "args": {"url": self.tunnel_public_url},
                    "url": self.tunnel_public_url
                }
            return res
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def stop_public_tunnel(self) -> dict:
        """Menghentikan tunnel publik Cloudflare"""
        if not self.tunnel_share_id:
            return {"status": "success", "message": "backend.webhook.tunnel_not_active"}

        try:
            share_id = self.tunnel_share_id
            self.tunnel_share_id = None
            self.tunnel_public_url = None
            if hasattr(self.api, 'tunnels') and self.api.tunnels:
                return self.api.tunnels.stop_cloudflare_share(share_id)
            return {"status": "success", "message": "backend.webhook.tunnel_stopped"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    # ==========================================
    # STORAGE & WEBHOOK EVENT HANDLING
    # ==========================================
    def _read_history(self) -> List[dict]:
        data = read_json(self.storage_path, default_type=list)
        return data if isinstance(data, list) else []

    def _save_history(self, history: List[dict]):
        trimmed = history[:MAX_STORED_WEBHOOKS]
        write_json(self.storage_path, trimmed)

    def _record_webhook(self, item: dict):
        with self._lock:
            history = self._read_history()
            history.insert(0, item)
            self._save_history(history)

        self._log("backend.webhook.request_captured", "info", {
            "method": item["method"],
            "path": item["path"]
        })

        # Emit real-time event to UI
        if hasattr(self.api, '_window') and self.api._window:
            safe_json = json.dumps({
                "id": item["id"],
                "method": item["method"],
                "path": item["path"],
                "timestamp": item["timestamp"],
                "size_bytes": item["size_bytes"]
            })
            self.api._window.evaluate_js(
                f"window.dispatchEvent(new CustomEvent('vylo_webhook_received', {{detail: {safe_json}}}))"
            )

    def get_history(self) -> dict:
        try:
            history = self._read_history()
            # Ringkasan cepat tanpa payload body raksasa
            summaries = [
                {
                    "id": h["id"],
                    "method": h.get("method", "GET"),
                    "path": h.get("path", "/"),
                    "client_ip": h.get("client_ip", "127.0.0.1"),
                    "timestamp": h.get("timestamp", 0),
                    "size_bytes": h.get("size_bytes", 0),
                    "is_json": h.get("is_json", False),
                    "query_count": len(h.get("query_params", {})),
                    "header_count": len(h.get("headers", {})),
                    "snippet": (h.get("body") or "")[:80].strip(),
                }
                for h in history
            ]
            return {"status": "success", "data": summaries}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def get_webhook_detail(self, webhook_id: str) -> dict:
        try:
            history = self._read_history()
            item = next((h for h in history if h["id"] == webhook_id), None)
            if not item:
                return {"status": "error", "message": "backend.webhook.not_found"}
            return {"status": "success", "data": item}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def clear_history(self) -> dict:
        try:
            with self._lock:
                self._save_history([])
            self._log("backend.webhook.cleared", "info")
            return {"status": "success", "message": "backend.webhook.cleared"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def set_response_config(self, status_code: int = 200, content_type: str = MIME_APPLICATION_JSON, body: str = '{"status": "ok"}') -> dict:
        try:
            self.response_config = {
                "status_code": int(status_code),
                "content_type": str(content_type),
                "body": str(body)
            }
            return {"status": "success", "message": "backend.webhook.config_updated", "data": self.response_config}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def get_response_config(self) -> dict:
        return {"status": "success", "data": self.response_config}

    def send_sample_webhook(self) -> dict:
        """Mengirim request POST contoh ke listener lokal untuk verifikasi cepat"""
        if self._server is None:
            return {"status": "error", "message": MSG_WEBHOOK_NOT_RUNNING}

        target_url = f"http://127.0.0.1:{self.port}/api/webhook/sample-order"
        headers = {
            "Content-Type": MIME_APPLICATION_JSON,
            "X-VyloServe-Signature": "sha256=abcdef1234567890",
            "User-Agent": "VyloServe-Webhook-Tester/1.0"
        }
        body = json.dumps({
            "event": "payment.succeeded",
            "order_id": f"ORD-{int(time.time())}",
            "amount": 250000,
            "currency": "IDR",
            "customer": {
                "name": "Alex Developer",
                "email": "alex@vyloserve.local"
            },
            "timestamp": int(time.time())
        }, indent=2)

        return self.send_http_request("POST", target_url, headers=headers, body=body)

    # ==========================================
    # LIGHTWEIGHT API CLIENT (HTTP REQUESTER)
    # ==========================================
    @staticmethod
    def _execute_http_dispatch(req: urllib.request.Request, timeout: int) -> tuple[int, str, Dict[str, str], str]:
        try:
            with urllib.request.urlopen(req, timeout=max(1, int(timeout))) as resp:
                resp_code = resp.status
                resp_reason = resp.reason or "OK"
                resp_headers = {k: str(v) for k, v in resp.headers.items()}
                raw_content = resp.read()
                resp_body = raw_content.decode('utf-8', errors='replace')
                return resp_code, resp_reason, resp_headers, resp_body
        except urllib.error.HTTPError as he:
            resp_code = he.code
            resp_reason = he.reason or "HTTP Error"
            resp_headers = {k: str(v) for k, v in he.headers.items()}
            raw_content = he.read()
            resp_body = raw_content.decode('utf-8', errors='replace')
            return resp_code, resp_reason, resp_headers, resp_body

    def send_http_request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        body: str = "",
        timeout: int = 15
    ) -> dict:
        """
        Klien HTTP lokal serbaguna (Bebas CORS browser) untuk menguji endpoint lokal maupun eksternal.
        """
        try:
            method = (method or "GET").strip().upper()
            url = (url or "").strip()

            if not url:
                return {"status": "error", "message": "backend.webhook.url_required"}

            parsed = urlparse(url)
            if parsed.scheme.lower() not in ("http", "https"):
                return {"status": "error", "message": "backend.webhook.invalid_url_scheme", "args": {"url": url}}

            headers_dict = dict(headers or {})
            if "User-Agent" not in headers_dict:
                headers_dict["User-Agent"] = "VyloServe-ApiClient/1.0"

            req_data: Optional[bytes] = None
            if method in ("POST", "PUT", "PATCH") and body:
                req_data = body.encode('utf-8')
                if "Content-Type" not in headers_dict:
                    headers_dict["Content-Type"] = MIME_APPLICATION_JSON

            req = urllib.request.Request(url, data=req_data, headers=headers_dict, method=method)

            start_t = time.perf_counter()
            resp_code, resp_reason, resp_headers, resp_body = self._execute_http_dispatch(req, timeout)
            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 1)

            # Check if response is valid JSON
            is_json = False
            try:
                if resp_body.strip():
                    json.loads(resp_body)
                    is_json = True
            except Exception:
                is_json = False

            return {
                "status": "success",
                "data": {
                    "status_code": resp_code,
                    "reason": resp_reason,
                    "elapsed_ms": elapsed_ms,
                    "size_bytes": len(resp_body.encode('utf-8')),
                    "headers": resp_headers,
                    "body": resp_body,
                    "is_json": is_json,
                }
            }
        except urllib.error.URLError as ue:
            return {
                "status": "error",
                "message": "backend.webhook.network_error",
                "args": {"err": str(ue.reason)}
            }
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}
