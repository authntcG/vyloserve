import os
import sys
import time
import uuid
import json
import socket
import socketserver
import threading
from email import policy
from email.parser import BytesParser
from typing import Dict, Any, List, Optional

from core.utils.system_utils import get_project_root, check_port_in_use
from core.utils.file_utils import read_json, write_json

DEFAULT_SMTP_PORT = 1025
MAX_STORED_EMAILS = 100
MSG_UNEXPECTED = "backend.error.unexpected"
SMTP_AUTH_SUCCESS_RESP = b"235 2.7.0 Authentication successful\r\n"
MIME_TEXT_HTML = "text/html"


class _SmtpSessionHandler(socketserver.StreamRequestHandler):
    """
    Handler koneksi SMTP berbasis teks stream.
    Mendukung perintah RFC standar: HELO, EHLO, AUTH, MAIL FROM, RCPT TO, DATA, RSET, NOOP, QUIT.
    """

    def _handle_auth(self, arg: str):
        if arg.upper().startswith("PLAIN") and len(arg.split()) > 1:
            self.wfile.write(SMTP_AUTH_SUCCESS_RESP)
        elif arg.upper().startswith("LOGIN"):
            self.wfile.write(b"334 VXNlcm5hbWU6\r\n")  # Base64 "Username:"
            self.wfile.flush()
            _ = self.rfile.readline()
            self.wfile.write(b"334 UGFzc3dvcmQ6\r\n")  # Base64 "Password:"
            self.wfile.flush()
            _ = self.rfile.readline()
            self.wfile.write(SMTP_AUTH_SUCCESS_RESP)
        else:
            self.wfile.write(SMTP_AUTH_SUCCESS_RESP)
        self.wfile.flush()

    def _handle_command(self, verb: str, arg: str, state: dict) -> bool:
        if verb in ("HELO", "EHLO"):
            self.wfile.write(b"250-VyloServe Local SMTP Server\r\n")
            self.wfile.write(b"250-AUTH LOGIN PLAIN\r\n")
            self.wfile.write(b"250-PIPELINING\r\n")
            self.wfile.write(b"250 8BITMIME\r\n")
            self.wfile.flush()
        elif verb == "AUTH":
            self._handle_auth(arg)
        elif verb == "MAIL":
            addr = arg[5:].strip() if arg.upper().startswith("FROM:") else arg
            state["mail_from"] = addr.strip("<> ")
            self.wfile.write(b"250 2.1.0 Ok\r\n")
            self.wfile.flush()
        elif verb == "RCPT":
            addr = arg[3:].strip() if arg.upper().startswith("TO:") else arg
            state["rcpt_to"].append(addr.strip("<> "))
            self.wfile.write(b"250 2.1.5 Ok\r\n")
            self.wfile.flush()
        elif verb == "DATA":
            state["in_data"] = True
            state["data_buffer"] = bytearray()
            self.wfile.write(b"354 End data with <CR><LF>.<CR><LF>\r\n")
            self.wfile.flush()
        elif verb in ("RSET", "NOOP"):
            if verb == "RSET":
                state["mail_from"] = ""
                state["rcpt_to"] = []
                state["data_buffer"] = bytearray()
            self.wfile.write(b"250 2.0.0 Ok\r\n")
            self.wfile.flush()
        elif verb == "QUIT":
            self.wfile.write(b"221 2.0.0 Bye\r\n")
            self.wfile.flush()
            return False
        else:
            self.wfile.write(b"502 5.5.2 Command not implemented\r\n")
            self.wfile.flush()
        return True

    def _handle_data_line(self, line: bytes, state: dict):
        if line in (b".\r\n", b".\n", b"."):
            state["in_data"] = False
            self.server_ref._handle_raw_email(state["mail_from"], state["rcpt_to"], bytes(state["data_buffer"]))
            self.wfile.write(b"250 2.0.0 Ok: queued\r\n")
            self.wfile.flush()
            state["mail_from"] = ""
            state["rcpt_to"] = []
            state["data_buffer"] = bytearray()
        else:
            # Unescape leading period as per RFC 5321 (dot-stuffing)
            clean_line = line[1:] if line.startswith(b"..") else line
            state["data_buffer"].extend(clean_line)

    def handle(self):
        self.server_ref = self.server.mail_manager  # type: ignore
        self.wfile.write(b"220 VyloServe Local SMTP Ready\r\n")
        self.wfile.flush()

        state = {
            "mail_from": "",
            "rcpt_to": [],
            "in_data": False,
            "data_buffer": bytearray(),
        }

        while True:
            try:
                line = self.rfile.readline()
                if not line:
                    break

                if state["in_data"]:
                    self._handle_data_line(line, state)
                    continue

                cmd_line = line.decode('utf-8', errors='replace').strip()
                if not cmd_line:
                    continue

                parts = cmd_line.split(' ', 1)
                verb = parts[0].upper()
                arg = parts[1].strip() if len(parts) > 1 else ""

                if not self._handle_command(verb, arg, state):
                    break
            except Exception:
                break


class _ThreadingSmtpServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address, request_handler_class, mail_manager):
        self.mail_manager = mail_manager
        super().__init__(server_address, request_handler_class)


class MailSandboxManager:
    """
    Manager server SMTP lokal untuk pengujian email developer (Laravel, WordPress, Node.js, Python, dsb.).
    Menangkap email keluar di port 1025 dan menyimpannya di file data/mail_sandbox.json.
    """

    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.storage_path = os.path.join(self.data_dir, 'mail_sandbox.json')
        self.host = "127.0.0.1"
        self.port = DEFAULT_SMTP_PORT

        self._server: Optional[_ThreadingSmtpServer] = None
        self._server_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        os.makedirs(self.data_dir, exist_ok=True)
        if not os.path.exists(self.storage_path):
            write_json(self.storage_path, [])

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api:
            self.api.emit_log(msg, level, args)

    # ==========================================
    # SERVER LIFECYCLE
    # ==========================================
    def get_status(self) -> dict:
        is_running = self._server is not None
        messages = self._read_messages()
        unread_count = sum(1 for m in messages if not m.get('is_read', False))
        return {
            "status": "success",
            "running": is_running,
            "host": self.host,
            "port": self.port,
            "total_messages": len(messages),
            "unread_count": unread_count,
        }

    def start_server(self, port: int = DEFAULT_SMTP_PORT) -> dict:
        try:
            port = int(port)
            if port < 1 or port > 65535:
                return {"status": "error", "message": "backend.mail_sandbox.invalid_port"}

            with self._lock:
                if self._server is not None:
                    return {
                        "status": "success",
                        "message": "backend.mail_sandbox.already_running",
                        "args": {"port": self.port}
                    }

                if check_port_in_use(port):
                    return {
                        "status": "error",
                        "message": "backend.mail_sandbox.port_in_use",
                        "args": {"port": port}
                    }

                self.port = port
                self._server = _ThreadingSmtpServer((self.host, self.port), _SmtpSessionHandler, self)
                self._server_thread = threading.Thread(target=self._server.serve_forever, daemon=True)
                self._server_thread.start()

            self._log("backend.mail_sandbox.started", "success", {"port": self.port})
            return {
                "status": "success",
                "message": "backend.mail_sandbox.started",
                "args": {"port": self.port}
            }
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def stop_server(self) -> dict:
        try:
            with self._lock:
                if self._server is None:
                    return {"status": "success", "message": "backend.mail_sandbox.not_running"}

                server_to_stop = self._server
                self._server = None
                server_to_stop.shutdown()
                server_to_stop.server_close()
                self._server_thread = None

            self._log("backend.mail_sandbox.stopped", "info")
            return {"status": "success", "message": "backend.mail_sandbox.stopped"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    # ==========================================
    # MESSAGE STORAGE & PARSING
    # ==========================================
    def _read_messages(self) -> List[dict]:
        data = read_json(self.storage_path, default_type=list)
        return data if isinstance(data, list) else []

    def _save_messages(self, messages: List[dict]):
        # Enforce ring buffer of MAX_STORED_EMAILS
        trimmed = messages[:MAX_STORED_EMAILS]
        write_json(self.storage_path, trimmed)

    @staticmethod
    def _extract_part_payload(part) -> str:
        try:
            content = part.get_content()
            return content if isinstance(content, str) else ""
        except Exception:
            payload = part.get_payload(decode=True)
            return payload.decode('utf-8', errors='replace') if payload else ""

    def _extract_multipart_bodies(self, parsed) -> tuple[str, str, List[dict]]:
        text_body = ""
        html_body = ""
        attachments = []
        for part in parsed.walk():
            content_type = part.get_content_type()
            disposition = str(part.get_content_disposition() or "")
            filename = part.get_filename()

            if filename or disposition.lower() == 'attachment':
                payload = part.get_payload(decode=True)
                size = len(payload) if payload else 0
                attachments.append({
                    "filename": filename or "attachment",
                    "content_type": content_type,
                    "size_bytes": size
                })
            elif content_type == 'text/plain' and not text_body:
                text_body = self._extract_part_payload(part)
            elif content_type == MIME_TEXT_HTML and not html_body:
                html_body = self._extract_part_payload(part)
        return text_body, html_body, attachments

    def _parse_mime_bytes(self, raw_bytes: bytes, mail_from: str, rcpt_to: List[str]) -> dict:
        msg_id = f"mail_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        parser = BytesParser(policy=policy.default)
        parsed = parser.parsebytes(raw_bytes)

        subject = str(parsed.get('subject', '(No Subject)'))
        sender = str(parsed.get('from', mail_from or 'unknown@local'))
        to_recipients = [str(x) for x in parsed.get_all('to', [])] if parsed.get('to') else rcpt_to
        cc_recipients = [str(x) for x in parsed.get_all('cc', [])] if parsed.get('cc') else []
        bcc_recipients = [str(x) for x in parsed.get_all('bcc', [])] if parsed.get('bcc') else []

        if parsed.is_multipart():
            text_body, html_body, attachments = self._extract_multipart_bodies(parsed)
        else:
            attachments = []
            content_type = parsed.get_content_type()
            content = self._extract_part_payload(parsed)
            html_body = content if content_type == MIME_TEXT_HTML else ""
            text_body = "" if content_type == MIME_TEXT_HTML else content

        headers = {k: str(v) for k, v in parsed.items()}
        raw_source = raw_bytes.decode('utf-8', errors='replace')

        return {
            "id": msg_id,
            "subject": subject,
            "sender": sender,
            "recipients": to_recipients,
            "cc": cc_recipients,
            "bcc": bcc_recipients,
            "timestamp": int(time.time()),
            "size_bytes": len(raw_bytes),
            "headers": headers,
            "text_body": text_body,
            "html_body": html_body,
            "raw_source": raw_source,
            "attachments": attachments,
            "is_read": False,
        }

    def _handle_raw_email(self, mail_from: str, rcpt_to: List[str], raw_bytes: bytes):
        try:
            item = self._parse_mime_bytes(raw_bytes, mail_from, rcpt_to)
            with self._lock:
                messages = self._read_messages()
                messages.insert(0, item)
                self._save_messages(messages)

            self._log("backend.mail_sandbox.email_captured", "info", {
                "subject": item["subject"][:40],
                "sender": item["sender"][:30]
            })

            # Emit real-time event to UI window
            if hasattr(self.api, '_window') and self.api._window:
                safe_json = json.dumps({
                    "id": item["id"],
                    "subject": item["subject"],
                    "sender": item["sender"],
                    "timestamp": item["timestamp"],
                    "size_bytes": item["size_bytes"]
                })
                self.api._window.evaluate_js(
                    f"window.dispatchEvent(new CustomEvent('vylo_mail_received', {{detail: {safe_json}}}))"
                )
        except Exception as e:
            self._log(MSG_UNEXPECTED, "error", {"e": str(e)})

    # ==========================================
    # MESSAGES API
    # ==========================================
    def get_messages(self) -> dict:
        try:
            messages = self._read_messages()
            # Summary view without heavy raw_source or full html_body
            summaries = [
                {
                    "id": m["id"],
                    "subject": m.get("subject", "(No Subject)"),
                    "sender": m.get("sender", ""),
                    "recipients": m.get("recipients", []),
                    "timestamp": m.get("timestamp", 0),
                    "size_bytes": m.get("size_bytes", 0),
                    "attachments_count": len(m.get("attachments", [])),
                    "is_read": m.get("is_read", False),
                    "snippet": (m.get("text_body") or m.get("subject") or "")[:120].strip(),
                }
                for m in messages
            ]
            return {"status": "success", "data": summaries}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def get_message_detail(self, msg_id: str) -> dict:
        try:
            with self._lock:
                messages = self._read_messages()
                msg = next((m for m in messages if m["id"] == msg_id), None)
                if not msg:
                    return {"status": "error", "message": "backend.mail_sandbox.not_found"}

                if not msg.get("is_read"):
                    msg["is_read"] = True
                    self._save_messages(messages)

            return {"status": "success", "data": msg}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def delete_message(self, msg_id: str) -> dict:
        try:
            with self._lock:
                messages = self._read_messages()
                filtered = [m for m in messages if m["id"] != msg_id]
                if len(filtered) == len(messages):
                    return {"status": "error", "message": "backend.mail_sandbox.not_found"}
                self._save_messages(filtered)

            return {"status": "success", "message": "backend.mail_sandbox.deleted"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def clear_messages(self) -> dict:
        try:
            with self._lock:
                self._save_messages([])
            self._log("backend.mail_sandbox.cleared", "info")
            return {"status": "success", "message": "backend.mail_sandbox.cleared"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def send_test_email(self) -> dict:
        """Mengirim email pengujian multipart ke server SMTP lokal yang sedang berjalan"""
        if self._server is None:
            return {"status": "error", "message": "backend.mail_sandbox.not_running"}

        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"VyloServe Test Email — {time.strftime('%H:%M:%S')}"
            msg['From'] = "system@vyloserve.local"
            msg['To'] = "developer@vyloserve.local"

            plain_text = (
                "Halo dari VyloServe Local SMTP Sandbox!\n\n"
                "Ini adalah email percobaan untuk memverifikasi bahwa server SMTP lokal Anda "
                "berjalan dengan sempurna di port " + str(self.port) + ".\n\n"
                "Semua email keluar dari aplikasi lokal (Laravel, WordPress, Node.js) akan ditangkap di sini."
            )
            html_text = f"""
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 8px;">
                <h2 style="color: #0284c7; margin-top: 0;">🚀 VyloServe Local SMTP Sandbox</h2>
                <p>Halo Pengembang! Email percobaan berhasil ditangkap oleh server SMTP lokal Anda di <strong>port {self.port}</strong>.</p>
                <div style="background: #f8fafc; padding: 12px; border-left: 4px solid #0284c7; margin: 16px 0; font-family: monospace; font-size: 13px;">
                    MAIL_HOST=127.0.0.1<br>
                    MAIL_PORT={self.port}<br>
                    MAIL_ENCRYPTION=null
                </div>
                <p style="color: #64748b; font-size: 13px;">Tidak ada email yang benar-benar dikirim ke internet. Seluruh data aman di komputer Anda.</p>
            </div>
            """

            msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_text, 'html', 'utf-8'))

            with smtplib.SMTP(self.host, self.port, timeout=5) as client:
                client.sendmail(msg['From'], [msg['To']], msg.as_string())

            return {"status": "success", "message": "backend.mail_sandbox.test_email_sent"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}
