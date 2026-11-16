import os
import io
import time
import json
from unittest.mock import MagicMock, patch
import pytest

from core.services.mail_sandbox import (
    MailSandboxManager,
    _SmtpSessionHandler,
    DEFAULT_SMTP_PORT,
    MAX_STORED_EMAILS
)


@pytest.fixture
def api_mock():
    mock = MagicMock()
    mock._window = MagicMock()
    mock.emit_log = MagicMock()
    return mock


@pytest.fixture
def mail_manager(api_mock, tmp_path):
    with patch("core.services.mail_sandbox.get_project_root", return_value=str(tmp_path)):
        return MailSandboxManager(api_mock)


def test_mail_sandbox_init(mail_manager, api_mock):
    assert mail_manager.api == api_mock
    assert mail_manager.host == "127.0.0.1"
    assert mail_manager.port == DEFAULT_SMTP_PORT
    assert os.path.exists(mail_manager.storage_path)


def test_mail_sandbox_status(mail_manager):
    status = mail_manager.get_status()
    assert status["status"] == "success"
    assert status["running"] is False
    assert status["port"] == DEFAULT_SMTP_PORT
    assert status["total_messages"] == 0
    assert status["unread_count"] == 0


@patch("core.services.mail_sandbox.check_port_in_use", return_value=False)
@patch("core.services.mail_sandbox._ThreadingSmtpServer")
@patch("core.services.mail_sandbox.threading.Thread")
def test_mail_sandbox_start_stop(mock_thread, mock_server_cls, mock_port_check, mail_manager):
    # Invalid port
    res_inv = mail_manager.start_server(0)
    assert res_inv["status"] == "error"
    assert res_inv["message"] == "backend.mail_sandbox.invalid_port"

    # Port in use
    with patch("core.services.mail_sandbox.check_port_in_use", return_value=True):
        res_busy = mail_manager.start_server(1025)
        assert res_busy["status"] == "error"
        assert res_busy["message"] == "backend.mail_sandbox.port_in_use"

    # Happy path start
    mock_srv_inst = MagicMock()
    mock_server_cls.return_value = mock_srv_inst

    res_start = mail_manager.start_server(1025)
    assert res_start["status"] == "success"
    assert res_start["message"] == "backend.mail_sandbox.started"
    assert mail_manager._server is not None

    # Already running
    res_already = mail_manager.start_server(1025)
    assert res_already["status"] == "success"
    assert res_already["message"] == "backend.mail_sandbox.already_running"

    # Stop server
    res_stop = mail_manager.stop_server()
    assert res_stop["status"] == "success"
    assert res_stop["message"] == "backend.mail_sandbox.stopped"
    assert mail_manager._server is None
    mock_srv_inst.shutdown.assert_called_once()
    mock_srv_inst.server_close.assert_called_once()

    # Stop when not running
    res_stop_again = mail_manager.stop_server()
    assert res_stop_again["status"] == "success"
    assert res_stop_again["message"] == "backend.mail_sandbox.not_running"


def test_mail_sandbox_mime_parsing(mail_manager):
    # Multipart email with text, html, and attachment
    raw_mime = (
        b"From: Alice <alice@example.com>\r\n"
        b"To: Bob <bob@example.com>\r\n"
        b"Subject: Hello VyloServe\r\n"
        b"Content-Type: multipart/mixed; boundary=\"BOUNDARY\"\r\n"
        b"\r\n"
        b"--BOUNDARY\r\n"
        b"Content-Type: text/plain; charset=\"utf-8\"\r\n"
        b"\r\n"
        b"Hello in plain text!\r\n"
        b"--BOUNDARY\r\n"
        b"Content-Type: text/html; charset=\"utf-8\"\r\n"
        b"\r\n"
        b"<h1>Hello in HTML</h1>\r\n"
        b"--BOUNDARY\r\n"
        b"Content-Type: application/octet-stream\r\n"
        b"Content-Disposition: attachment; filename=\"test.txt\"\r\n"
        b"\r\n"
        b"Attachment data\r\n"
        b"--BOUNDARY--\r\n"
    )

    parsed = mail_manager._parse_mime_bytes(raw_mime, "alice@example.com", ["bob@example.com"])
    assert parsed["subject"] == "Hello VyloServe"
    assert "alice@example.com" in parsed["sender"]
    assert "Hello in plain text!" in parsed["text_body"]
    assert "<h1>Hello in HTML</h1>" in parsed["html_body"]
    assert len(parsed["attachments"]) == 1
    assert parsed["attachments"][0]["filename"] == "test.txt"
    assert parsed["is_read"] is False


def test_mail_sandbox_message_crud(mail_manager):
    # Empty messages list
    assert mail_manager.get_messages()["data"] == []

    # Emulate incoming email
    raw_email = b"From: dev@vyloserve.local\r\nTo: app@vyloserve.local\r\nSubject: Invoice\r\n\r\nInvoice Body"
    mail_manager._handle_raw_email("dev@vyloserve.local", ["app@vyloserve.local"], raw_email)

    messages_res = mail_manager.get_messages()
    assert len(messages_res["data"]) == 1
    msg_summary = messages_res["data"][0]
    assert msg_summary["subject"] == "Invoice"
    assert msg_summary["is_read"] is False

    msg_id = msg_summary["id"]

    # Get detail (marks as read)
    detail_res = mail_manager.get_message_detail(msg_id)
    assert detail_res["status"] == "success"
    assert detail_res["data"]["is_read"] is True

    # Detail not found
    assert mail_manager.get_message_detail("non_existent")["status"] == "error"

    # Delete message
    del_res = mail_manager.delete_message(msg_id)
    assert del_res["status"] == "success"
    assert len(mail_manager.get_messages()["data"]) == 0

    # Delete non-existent
    assert mail_manager.delete_message("non_existent")["status"] == "error"

    # Test clear_messages
    mail_manager._handle_raw_email("a@b.com", ["c@d.com"], raw_email)
    mail_manager._handle_raw_email("e@f.com", ["g@h.com"], raw_email)
    assert len(mail_manager.get_messages()["data"]) == 2

    clear_res = mail_manager.clear_messages()
    assert clear_res["status"] == "success"
    assert len(mail_manager.get_messages()["data"]) == 0


def test_mail_sandbox_ring_buffer_limit(mail_manager):
    raw_email = b"From: a@b.com\r\nTo: c@d.com\r\nSubject: Test\r\n\r\nBody"
    for i in range(MAX_STORED_EMAILS + 10):
        mail_manager._handle_raw_email(f"sender_{i}@local", ["rcpt@local"], raw_email)

    messages = mail_manager._read_messages()
    assert len(messages) == MAX_STORED_EMAILS


@patch("smtplib.SMTP")
def test_send_test_email(mock_smtp_cls, mail_manager):
    # Not running
    res_stopped = mail_manager.send_test_email()
    assert res_stopped["status"] == "error"
    assert res_stopped["message"] == "backend.mail_sandbox.not_running"

    # Running
    mail_manager._server = MagicMock()
    mock_client = MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_client

    res_success = mail_manager.send_test_email()
    assert res_success["status"] == "success"
    assert res_success["message"] == "backend.mail_sandbox.test_email_sent"
    mock_client.sendmail.assert_called_once()


def test_smtp_session_handler_flow():
    server_mock = MagicMock()
    mail_manager_mock = MagicMock()
    server_mock.mail_manager = mail_manager_mock

    # Simulate client sending EHLO, MAIL FROM, RCPT TO, DATA with dot-stuffing, QUIT
    input_stream = io.BytesIO(
        b"EHLO client.local\r\n"
        b"MAIL FROM:<sender@test.local>\r\n"
        b"RCPT TO:<receiver@test.local>\r\n"
        b"DATA\r\n"
        b"Subject: Test\r\n"
        b"..leading dot\r\n"
        b"Hello world\r\n"
        b".\r\n"
        b"QUIT\r\n"
    )
    output_stream = io.BytesIO()

    # Instantiate handler
    handler = _SmtpSessionHandler.__new__(_SmtpSessionHandler)
    handler.server = server_mock
    handler.rfile = input_stream
    handler.wfile = output_stream
    handler.handle()

    mail_manager_mock._handle_raw_email.assert_called_once()
    args = mail_manager_mock._handle_raw_email.call_args[0]
    assert args[0] == "sender@test.local"
    assert args[1] == ["receiver@test.local"]
    raw_data = args[2]
    assert b".leading dot" in raw_data
    assert b"Hello world" in raw_data
