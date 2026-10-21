import os
import json
import urllib.error
import pytest
from unittest.mock import patch, MagicMock
from core.services.ai_assistant import AIAssistantManager

@pytest.fixture
def mock_api():
    api = MagicMock()
    api.settings = MagicMock()
    api.settings.get_settings.return_value = {
        "status": "success",
        "data": {
            "ai_provider": "gemini",
            "ai_model": "gemini-3.5-flash-lite",
            "ai_api_key": "test-key-123",
            "ai_base_url": "http://localhost:11434/v1",
            "ai_temperature": 0.7,
        }
    }
    api.get_all_services_status.return_value = {
        "status": "success",
        "data": {"apache": True, "php": False, "database": True}
    }
    return api

@pytest.fixture
def ai_manager(mock_api):
    manager = AIAssistantManager(mock_api)
    return manager

# ==========================================
# _get_settings
# ==========================================

def test_get_settings_success(ai_manager):
    settings = ai_manager._get_settings()
    assert settings.get("ai_provider") == "gemini"
    assert settings.get("ai_api_key") == "test-key-123"

def test_get_settings_fallback_on_exception(ai_manager):
    ai_manager.api.settings.get_settings.side_effect = RuntimeError("settings error")
    settings = ai_manager._get_settings()
    assert settings == {}

# ==========================================
# CHAT HISTORY PERSISTENCE
# ==========================================

@patch('core.services.ai_assistant.read_json')
def test_get_chat_history_success(mock_read, ai_manager):
    mock_read.return_value = [{"role": "user", "content": "hello"}]
    res = ai_manager.get_chat_history()
    assert res["status"] == "success"
    assert len(res["data"]) == 1

@patch('core.services.ai_assistant.read_json', side_effect=IOError("disk read fail"))
def test_get_chat_history_error(mock_read, ai_manager):
    res = ai_manager.get_chat_history()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

@patch('core.services.ai_assistant.write_json')
@patch('core.services.ai_assistant.os.makedirs')
def test_save_chat_history_success(mock_makedirs, mock_write, ai_manager):
    msgs = [{"role": "user", "content": f"msg {i}"} for i in range(50)]
    res = ai_manager.save_chat_history(msgs)
    assert res["status"] == "success"
    mock_makedirs.assert_called_once()
    # Harus di-trim ke MAX_HISTORY_ITEMS (40)
    args, _ = mock_write.call_args
    assert len(args[1]) == 40
    assert args[1][-1]["content"] == "msg 49"

def test_save_chat_history_invalid_format(ai_manager):
    res = ai_manager.save_chat_history("not-a-list")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.invalid_history_format"

@patch('core.services.ai_assistant.write_json', side_effect=IOError("write fail"))
def test_save_chat_history_exception(mock_write, ai_manager):
    res = ai_manager.save_chat_history([])
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

@patch('core.services.ai_assistant.write_json')
@patch('core.services.ai_assistant.os.makedirs')
def test_clear_chat_history_success(mock_makedirs, mock_write, ai_manager):
    res = ai_manager.clear_chat_history()
    assert res["status"] == "success"
    assert res["message"] == "backend.ai.history_cleared"
    mock_write.assert_any_call(ai_manager.history_file, [])
    mock_write.assert_any_call(ai_manager.action_states_file, {})
    assert mock_write.call_count == 2

@patch('core.services.ai_assistant.write_json', side_effect=RuntimeError("clear fail"))
def test_clear_chat_history_exception(mock_write, ai_manager):
    res = ai_manager.clear_chat_history()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

@patch('core.services.ai_assistant.read_json')
def test_get_action_states_success(mock_read, ai_manager):
    mock_read.return_value = {"msg_1:0": "success"}
    res = ai_manager.get_action_states()
    assert res["status"] == "success"
    assert res["data"] == {"msg_1:0": "success"}

@patch('core.services.ai_assistant.read_json', side_effect=IOError("disk read fail"))
def test_get_action_states_error(mock_read, ai_manager):
    res = ai_manager.get_action_states()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

@patch('core.services.ai_assistant.write_json')
@patch('core.services.ai_assistant.os.makedirs')
def test_save_action_states_success(mock_makedirs, mock_write, ai_manager):
    res = ai_manager.save_action_states({"msg_1:0": "success"})
    assert res["status"] == "success"
    mock_write.assert_called_once_with(ai_manager.action_states_file, {"msg_1:0": "success"})

def test_save_action_states_invalid_format(ai_manager):
    res = ai_manager.save_action_states("not-a-dict")
    assert res["status"] == "error"

@patch('core.services.ai_assistant.write_json', side_effect=IOError("write fail"))
def test_save_action_states_exception(mock_write, ai_manager):
    res = ai_manager.save_action_states({"msg_1:0": "success"})
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

# ==========================================
# CONTEXT AGGREGATOR
# ==========================================

@patch('core.services.ai_assistant.read_log_tail')
@patch('core.services.ai_assistant.os.path.exists')
def test_get_server_context_with_logs(mock_exists, mock_tail, ai_manager):
    mock_exists.return_value = True
    mock_tail.return_value = "[error] AH00016: Apache test error"
    ai_manager.api.apache = MagicMock()
    ai_manager.api.apache.get_status.return_value = {"status": "success", "data": {"active_version": "2.4.58"}}

    res = ai_manager.get_server_context(active_screen="apache", include_logs=True)
    assert res["status"] == "success"
    ctx = res["data"]
    assert "Active Screen: apache" in ctx
    assert "apache: running" in ctx
    assert "php: stopped" in ctx
    assert "database: running" in ctx
    assert "Recent Apache Error Log snippet" in ctx
    assert "AH00016" in ctx

def test_get_server_context_without_logs(ai_manager):
    res = ai_manager.get_server_context(active_screen="dashboard", include_logs=False)
    assert res["status"] == "success"
    ctx = res["data"]
    assert "Active Screen: dashboard" in ctx
    assert "Services Status:" in ctx
    assert "Recent Apache Error Log" not in ctx

def test_get_server_context_handles_exception(ai_manager):
    ai_manager.api.get_all_services_status.side_effect = RuntimeError("status fail")
    res = ai_manager.get_server_context()
    assert res["status"] == "error"
    assert res["message"] == "backend.error.unexpected"

# ==========================================
# TEST CONNECTION
# ==========================================

def test_test_connection_missing_key(ai_manager):
    res = ai_manager.test_connection(provider="gemini", api_key="", model="gemini-3.5-flash-lite")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.key_missing"

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_test_connection_gemini_success(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    res = ai_manager.test_connection(provider="gemini", api_key="valid-key", model="gemini-3.5-flash-lite")
    assert res["status"] == "success"
    assert res["message"] == "backend.ai.connection_success"

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_test_connection_openai_compatible_success(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    res = ai_manager.test_connection(provider="groq", api_key="gsk-key", model="llama-3.3-70b-versatile")
    assert res["status"] == "success"
    assert res["message"] == "backend.ai.connection_success"

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_test_connection_ollama_without_key_success(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    res = ai_manager.test_connection(provider="ollama", api_key="", model="llama3", base_url="http://localhost:11434")
    assert res["status"] == "success"

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_test_connection_http_error(mock_urlopen, ai_manager):
    err = urllib.error.HTTPError(
        url="https://api.example.com",
        code=401,
        msg="Unauthorized",
        hdrs={},
        fp=MagicMock(read=lambda: b'{"error": {"message": "Invalid API key provided"}}')
    )
    mock_urlopen.side_effect = err

    res = ai_manager.test_connection(provider="gemini", api_key="bad-key", model="gemini-3.5-flash-lite")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.connection_failed"
    assert "Invalid API key provided" in res["args"]["e"]

@patch('core.services.ai_assistant.urllib.request.urlopen', side_effect=Exception("network down"))
def test_test_connection_generic_error(mock_urlopen, ai_manager):
    res = ai_manager.test_connection(provider="gemini", api_key="key", model="gemini-3.5-flash-lite")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.connection_failed"
    assert "network down" in res["args"]["e"]

# ==========================================
# ENDPOINT RESOLUTION & ABORT
# ==========================================

def test_resolve_openai_endpoint(ai_manager):
    assert ai_manager._resolve_openai_endpoint("groq") == "https://api.groq.com/openai/v1/chat/completions"
    assert ai_manager._resolve_openai_endpoint("openrouter") == "https://openrouter.ai/api/v1/chat/completions"
    assert ai_manager._resolve_openai_endpoint("ollama", "http://localhost:11434/v1") == "http://localhost:11434/v1/chat/completions"
    assert ai_manager._resolve_openai_endpoint("ollama", "http://localhost:11434/v1/chat/completions") == "http://localhost:11434/v1/chat/completions"
    assert ai_manager._resolve_openai_endpoint("custom", "http://my-proxy:8080") == "http://my-proxy:8080/chat/completions"

def test_abort_generation(ai_manager):
    res = ai_manager.abort_generation()
    assert res["status"] == "success"
    assert ai_manager._abort_event.is_set()
    ai_manager.api.emit_ai_chunk.assert_called_with(chunk="", is_done=True, error="backend.ai.aborted")

# ==========================================
# SEND MESSAGE & STREAMING
# ==========================================

def test_send_message_empty_prompt(ai_manager):
    res = ai_manager.send_message(prompt="   ")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.empty_prompt"

def test_send_message_missing_key(ai_manager):
    ai_manager.api.settings.get_settings.return_value = {
        "status": "success",
        "data": {"ai_provider": "gemini", "ai_api_key": ""}
    }
    res = ai_manager.send_message(prompt="How to start Apache?")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.key_missing"

@patch('core.services.ai_assistant.threading.Thread')
def test_send_message_success_spawns_thread(mock_thread_cls, ai_manager):
    mock_thread_instance = MagicMock()
    mock_thread_cls.return_value = mock_thread_instance

    res = ai_manager.send_message(prompt="Hello copilot", context="Active screen: Apache")
    assert res["status"] == "success"
    assert res["message_id"].startswith("msg_")
    mock_thread_cls.assert_called_once()
    mock_thread_instance.start.assert_called_once()

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_stream_gemini_sse_parsing(mock_urlopen, ai_manager):
    sse_payload = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "Hello "}]}}]}\n\n',
        b': keep-alive\n\n',
        b'data: {"candidates": [{"content": {"parts": [{"text": "world!"}]}}]}\n\n',
    ]
    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = iter(sse_payload)
    mock_urlopen.return_value = mock_resp

    collector = []
    ai_manager._stream_gemini(
        message_id="msg_test",
        prompt="Hi",
        context="",
        history=[],
        model="gemini-3.5-flash-lite",
        api_key="key",
        temperature=0.5,
        reply_collector=collector
    )

    assert "".join(collector) == "Hello world!"
    assert ai_manager.api.emit_ai_chunk.call_count == 2
    ai_manager.api.emit_ai_chunk.assert_any_call(chunk="Hello ", is_done=False, message_id="msg_test")
    ai_manager.api.emit_ai_chunk.assert_any_call(chunk="world!", is_done=False, message_id="msg_test")

@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_stream_openai_compatible_sse_parsing(mock_urlopen, ai_manager):
    sse_payload = [
        b'data: {"choices": [{"delta": {"content": "Server "}}]}\n\n',
        b'data: {"choices": [{"delta": {"content": "running"}}]}\n\n',
        b'data: [DONE]\n\n',
    ]
    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = iter(sse_payload)
    mock_urlopen.return_value = mock_resp

    collector = []
    ai_manager._stream_openai_compatible(
        message_id="msg_test",
        prompt="Status?",
        context="status",
        history=[],
        provider="groq",
        model="llama-3.3-70b-versatile",
        api_key="gsk-key",
        base_url="",
        temperature=0.5,
        reply_collector=collector
    )

    assert "".join(collector) == "Server running"
    assert ai_manager.api.emit_ai_chunk.call_count == 2
    ai_manager.api.emit_ai_chunk.assert_any_call(chunk="Server ", is_done=False, message_id="msg_test")
    ai_manager.api.emit_ai_chunk.assert_any_call(chunk="running", is_done=False, message_id="msg_test")

@patch.object(AIAssistantManager, 'save_chat_history')
@patch.object(AIAssistantManager, '_stream_gemini')
def test_stream_worker_success(mock_gemini, mock_save, ai_manager):
    def fake_stream(*args, **kwargs):
        # reply_collector ada di argumen terakhir
        reply_col = args[7]
        reply_col.append("Assistant reply.")

    mock_gemini.side_effect = fake_stream

    ai_manager._stream_worker(
        message_id="msg_123",
        prompt="Tell me about Apache",
        context="",
        history=[],
        provider="gemini",
        model="gemini-3.5-flash-lite",
        api_key="key",
        base_url="",
        temperature=0.5
    )

    mock_save.assert_called_once()
    saved_history = mock_save.call_args[0][0]
    assert len(saved_history) == 2
    assert saved_history[0]["role"] == "user"
    assert saved_history[1]["role"] == "assistant"
    call_kwargs = ai_manager.api.emit_ai_chunk.call_args[1]
    assert call_kwargs["chunk"] == ""
    assert call_kwargs["is_done"] is True
    assert call_kwargs["error"] == ""
    assert call_kwargs["message_id"] == "msg_123"
    assert "usage" in call_kwargs

@patch('core.services.ai_assistant.threading.Thread')
def test_send_message_auto_migrates_deprecated_model(mock_thread, ai_manager):
    ai_manager._get_settings = MagicMock(return_value={
        "ai_provider": "gemini",
        "ai_model": "gemini-2.0-flash",
        "ai_api_key": "valid-key"
    })
    res = ai_manager.send_message("Hello")
    assert res["status"] == "success"
    # Thread target args should contain gemini-3.5-flash-lite at index 5
    call_args = mock_thread.call_args[1]["args"]
    assert call_args[5] == "gemini-3.5-flash-lite"


# ==========================================
# DYNAMIC MODELS CATALOG
# ==========================================

def test_get_available_models_missing_key(ai_manager):
    res_gemini = ai_manager.get_available_models("gemini", api_key="")
    assert res_gemini["status"] == "error"
    assert res_gemini["message"] == "backend.ai.key_missing"

    res_groq = ai_manager.get_available_models("groq", api_key="")
    assert res_groq["status"] == "error"
    assert res_groq["message"] == "backend.ai.key_missing"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_gemini_success(mock_urlopen, ai_manager):
    payload = {
        "models": [
            {
                "name": "models/gemini-3.5-flash-lite",
                "displayName": "Gemini 3.5 Flash Lite",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/gemini-3.5-flash",
                "displayName": "Gemini 3.5 Flash",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/gemini-2.0-flash",
                "displayName": "Gemini 2.0 Flash (Deprecated)",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/text-embedding-004",
                "displayName": "Embedding 004",
                "supportedGenerationMethods": ["embedContent"]
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.get_available_models("gemini", api_key="test-key", tier="free")
    assert res["status"] == "success"
    models = res["data"]
    # Deprecated 2.0-flash and embedding must be filtered out
    assert len(models) == 2
    assert models[0]["value"] == "gemini-3.5-flash-lite"
    assert models[1]["value"] == "gemini-3.5-flash"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_gemini_pro_tier(mock_urlopen, ai_manager):
    payload = {
        "models": [
            {
                "name": "models/gemini-3.5-flash-lite",
                "displayName": "Gemini 3.5 Flash Lite",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/gemini-3.1-pro-preview",
                "displayName": "Gemini 3.1 Pro Preview",
                "supportedGenerationMethods": ["generateContent"]
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.get_available_models("gemini", api_key="test-key", tier="pro")
    assert res["status"] == "success"
    models = res["data"]
    assert len(models) == 2
    assert any("pro" in m["value"] for m in models)


# ==========================================
# ACCOUNT TIER DETECTION
# ==========================================

def test_detect_account_tier_missing_key(ai_manager):
    res = ai_manager.detect_account_tier("gemini", api_key="")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.key_missing"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_gemini_free(mock_urlopen, ai_manager):
    # First call: models list (success)
    mock_resp_models = MagicMock()
    # Second call: probe pro model -> 429 quota exceeded FreeTier
    mock_fp = MagicMock()
    mock_fp.read.return_value = b'{"error": {"message": "limit: 0", "quotaId": "GenerateContent-FreeTier"}}'
    err_429 = urllib.error.HTTPError("http://test", 429, "Too Many Requests", {}, mock_fp)

    mock_urlopen.side_effect = [
        MagicMock(__enter__=MagicMock(return_value=mock_resp_models)),
        err_429
    ]

    res = ai_manager.detect_account_tier("gemini", api_key="test-key")
    assert res["status"] == "success"
    assert res["tier"] == "free"
    assert res["is_pro"] is False


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_gemini_pro(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_resp.status = 200

    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.detect_account_tier("gemini", api_key="pro-key")
    assert res["status"] == "success"
    assert res["tier"] == "pro"
    assert res["is_pro"] is True


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_gemini_invalid_key(mock_urlopen, ai_manager):
    mock_fp = MagicMock()
    mock_fp.read.return_value = b'{"error": {"message": "API key not valid"}}'
    err_400 = urllib.error.HTTPError("http://test", 400, "Bad Request", {}, mock_fp)
    mock_urlopen.side_effect = err_400

    res = ai_manager.detect_account_tier("gemini", api_key="bad-key")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.key_invalid"
    assert res["tier"] == "invalid"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_openrouter_free_and_pro(mock_urlopen, ai_manager):
    # Free
    payload_free = {"data": {"is_free_tier": True, "limit": 0, "usage": 0}}
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload_free).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.detect_account_tier("openrouter", api_key="test-key")
    assert res["status"] == "success"
    assert res["tier"] == "free"

    # Pro
    payload_pro = {"data": {"is_free_tier": False, "limit": 100, "usage": 5}}
    mock_resp.read.return_value = json.dumps(payload_pro).encode('utf-8')
    res_pro = ai_manager.detect_account_tier("openrouter", api_key="pro-key")
    assert res_pro["status"] == "success"
    assert res_pro["tier"] == "pro"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_groq(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_urlopen.return_value.__enter__.return_value = mock_resp
    res = ai_manager.detect_account_tier("groq", api_key="test-key")
    assert res["status"] == "success"
    assert res["tier"] == "free"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_detect_account_tier_ollama(mock_urlopen, ai_manager):
    mock_resp = MagicMock()
    mock_urlopen.return_value.__enter__.return_value = mock_resp
    res = ai_manager.detect_account_tier("ollama")
    assert res["status"] == "success"
    assert res["tier"] == "local"



@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_groq_success(mock_urlopen, ai_manager):
    payload = {
        "data": [
            {"id": "llama-3.3-70b-versatile", "active": True},
            {"id": "whisper-large-v3", "active": True},
            {"id": "inactive-model", "active": False}
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.get_available_models("groq", api_key="gsk_test")
    assert res["status"] == "success"
    models = res["data"]
    assert len(models) == 1
    assert models[0]["value"] == "llama-3.3-70b-versatile"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_openrouter_success(mock_urlopen, ai_manager):
    payload = {
        "data": [
            {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 Free"},
            {"id": "openai/gpt-4o", "name": "GPT-4o"}
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res_free = ai_manager.get_available_models("openrouter")
    assert res_free["status"] == "success"
    assert len(res_free["data"]) == 1
    assert res_free["data"][0]["value"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert "(Free)" in res_free["data"][0]["label"]

    res_pro = ai_manager.get_available_models("openrouter", tier="pro")
    assert res_pro["status"] == "success"
    assert len(res_pro["data"]) == 2
    assert res_pro["data"][0]["value"] == "meta-llama/llama-3.3-70b-instruct:free"
    assert res_pro["data"][1]["value"] == "openai/gpt-4o"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_ollama_success(mock_urlopen, ai_manager):
    payload = {
        "models": [
            {"name": "llama3.2:latest"},
            {"name": "qwen2.5-coder:latest"}
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(payload).encode('utf-8')
    mock_urlopen.return_value.__enter__.return_value = mock_resp

    res = ai_manager.get_available_models("ollama", base_url="http://localhost:11434/v1")
    assert res["status"] == "success"
    models = res["data"]
    assert len(models) == 2
    assert models[0]["value"] == "llama3.2:latest"
    assert models[1]["value"] == "qwen2.5-coder:latest"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_ollama_offline(mock_urlopen, ai_manager):
    import urllib.error
    mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

    res = ai_manager.get_available_models("ollama")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.ollama_offline"


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_http_error(mock_urlopen, ai_manager):
    import urllib.error
    mock_fp = MagicMock()
    mock_fp.read.return_value = b'{"error": {"message": "Invalid API Key"}}'
    err = urllib.error.HTTPError("http://test", 401, "Unauthorized", {}, mock_fp)
    mock_urlopen.side_effect = err

    res = ai_manager.get_available_models("gemini", api_key="bad-key")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.fetch_models_failed"
    assert "Invalid API Key" in res["args"]["e"]


@patch('core.services.ai_assistant.urllib.request.urlopen')
def test_get_available_models_generic_exception(mock_urlopen, ai_manager):
    mock_urlopen.side_effect = RuntimeError("DNS failed")

    res = ai_manager.get_available_models("gemini", api_key="test-key")
    assert res["status"] == "error"
    assert res["message"] == "backend.ai.fetch_models_failed"
    assert "DNS failed" in res["args"]["e"]


def test_doc_retriever_loads_and_parses_sections(ai_manager):
    retriever = ai_manager.doc_retriever
    retriever._ensure_loaded()
    assert len(retriever._sections) > 0

    section_ids = [s["id"] for s in retriever._sections]
    assert "apache" in section_ids
    assert "php" in section_ids
    assert "database" in section_ids
    assert "error-codes" in section_ids
    assert "faq" in section_ids


def test_doc_retriever_search_by_screen_context(ai_manager):
    retriever = ai_manager.doc_retriever
    snippet = retriever.search_knowledge(query="", active_screen="apache")
    assert "[VyloServe Knowledge Base:" in snippet
    assert "Apache" in snippet


def test_doc_retriever_search_by_error_keywords(ai_manager):
    retriever = ai_manager.doc_retriever
    snippet = retriever.search_knowledge(query="kenapa error OS 10048 port 80?", active_screen="apache")
    assert "[VyloServe Knowledge Base:" in snippet
    assert "10048" in snippet or "80" in snippet or "Apache" in snippet


def test_doc_retriever_search_by_laravel_vhost(ai_manager):
    retriever = ai_manager.doc_retriever
    snippet = retriever.search_knowledge(query="bagaimana cara buat virtual host laravel?")
    assert "[VyloServe Knowledge Base:" in snippet
    assert "Project" in snippet or "Virtual Host" in snippet or "Laravel" in snippet


def test_doc_retriever_character_limit_budget(ai_manager):
    retriever = ai_manager.doc_retriever
    snippet = retriever.search_knowledge(query="apache", active_screen="apache", max_chars=300)
    assert len(snippet) < 450


def test_doc_retriever_handles_missing_file_gracefully(tmp_path):
    from core.services.ai_assistant import DocRetriever
    empty_retriever = DocRetriever(str(tmp_path))
    assert empty_retriever.search_knowledge("apache") == ""


def test_doc_retriever_falls_back_to_bundled_resource_when_frozen(tmp_path, monkeypatch):
    from core.services.ai_assistant import DocRetriever
    monkeypatch.setattr("sys.frozen", True, raising=False)
    retriever = DocRetriever(str(tmp_path))
    snippet = retriever.search_knowledge("apache")
    assert "[VyloServe Knowledge Base:" in snippet


def test_send_message_enriches_context_with_knowledge(ai_manager, monkeypatch):
    monkeypatch.setattr(ai_manager, '_get_settings', lambda: {
        "ai_provider": "gemini",
        "ai_model": "gemini-3.5-flash-lite",
        "ai_api_key": "valid-key"
    })

    with patch('threading.Thread') as mock_thread:
        res = ai_manager.send_message("kenapa error 10048?", context="- Active Screen: apache")
        assert res["status"] == "success"
        mock_thread.assert_called_once()
        passed_context = mock_thread.call_args[1]["args"][2]
        assert "- Active Screen: apache" in passed_context
        assert "[VyloServe Knowledge Base:" in passed_context


def test_get_server_context_with_full_environment(ai_manager):
    ai_manager.api.apache = MagicMock()
    ai_manager.api.apache.get_installed_versions.return_value = {
        "status": "success",
        "data": ["2.4.58", "2.4.54"],
        "active": "2.4.58"
    }
    ai_manager.api.apache.check_is_running.return_value = True
    ai_manager.api.apache.get_http_port.return_value = 8080

    ai_manager.api.php = MagicMock()
    ai_manager.api.php.get_installed_instances.return_value = [
        {"version": "8.2.12", "port": 9000, "status": "running"}
    ]

    ai_manager.api.database = MagicMock()
    ai_manager.api.database.get_installed.return_value = {
        "status": "success",
        "data": [
            {"engine": "mysql", "version": "8.0.35", "port": 3306, "status": "running"}
        ]
    }

    ai_manager.api.git_manager = MagicMock()
    ai_manager.api.git_manager.get_git_status.return_value = {
        "installed": True,
        "version": "2.44.0",
        "in_path": False,
        "external": {"exists": True, "version": "2.43.0", "path": r"C:\Program Files\Git\cmd\git.exe"}
    }

    ai_manager.api.runtimes_manager = MagicMock()
    ai_manager.api.runtimes_manager.get_node_status.return_value = {
        "installed": True,
        "version": "20.11.0",
        "in_path": True,
        "external": {"exists": False}
    }
    ai_manager.api.runtimes_manager.get_python_status.return_value = {
        "installed": True,
        "version": "3.11.8",
        "in_path": False,
        "external": {"exists": True, "version": "Python 3.12.1", "path": r"C:\Python312\python.exe"}
    }
    ai_manager.api.runtimes_manager.get_java_status.return_value = {
        "installed": False,
        "version": "",
        "in_path": False,
        "external": {"exists": True, "version": "OpenJDK 17", "path": r"C:\Program Files\Java\jdk-17\bin\java.exe"}
    }
    ai_manager.api.runtimes_manager.get_go_status.return_value = {
        "installed": False,
        "version": "",
        "in_path": False,
        "external": {"exists": False}
    }

    ai_manager.api.project = MagicMock()
    ai_manager.api.project.get_projects.return_value = {
        "status": "success",
        "data": [
            {"id": "proj_1", "name": "blog", "domain": "blog.local", "framework": "Laravel"}
        ]
    }

    ai_manager.api.tunnels = MagicMock()
    ai_manager.api.tunnels.get_zrok_status.return_value = {
        "active_shares": [{"project_id": "proj_1", "url": "https://xyz.shares.zrok.io"}]
    }
    ai_manager.api.tunnels.get_cloudflare_status.return_value = {
        "active_shares": [{"project_id": "localhost:3000", "url": "https://abc.trycloudflare.com"}]
    }

    res = ai_manager.get_server_context(active_screen="apache", include_logs=False)
    assert res["status"] == "success"
    ai_manager.api.git_manager.get_git_status.assert_called_with(silent=True)
    ai_manager.api.runtimes_manager.get_node_status.assert_called_with(silent=True)
    ai_manager.api.runtimes_manager.get_python_status.assert_called_with(silent=True)
    ai_manager.api.runtimes_manager.get_java_status.assert_called_with(silent=True)
    ai_manager.api.runtimes_manager.get_go_status.assert_called_with(silent=True)
    ctx = res["data"]
    assert "[VyloServe System Environment]" in ctx
    assert "Apache: Installed: 2.4.58, 2.4.54 | Active: 2.4.58 | Port: 8080 | Status: running" in ctx
    assert "PHP 8.2.12 (Port 9000, running)" in ctx
    assert "Mysql 8.0.35 (Port 3306, running)" in ctx
    assert "- Git: VyloServe v2.44.0 (Installed in VyloServe, but NOT in PATH; Host terminal uses Native 2.43.0 at 'C:\\Program Files\\Git\\cmd\\git.exe')" in ctx
    assert "Node.js: VyloServe v20.11.0 (Active in PATH)" in ctx
    assert "Python: VyloServe v3.11.8 (Installed in VyloServe, but NOT in PATH; Host terminal uses Native Python 3.12.1 at 'C:\\Python312\\python.exe')" in ctx
    assert "Java: Not installed in VyloServe (Native OpenJDK 17 detected on host at 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe')" in ctx
    assert "Go: Not installed" in ctx
    assert "Projects (1): blog (blog.local, Laravel)" in ctx
    assert "- Public Tunnels: Zrok (blog.local -> https://xyz.shares.zrok.io), Cloudflare (localhost:3000 -> https://abc.trycloudflare.com)" in ctx
    assert "Current View: Apache Module Management" in ctx


def test_describe_binary_status_scenarios():
    from core.services.ai_assistant import AIAssistantManager

    # 1. Invalid status input
    assert AIAssistantManager._describe_binary_status(None) == "Not installed"

    # 2. Installed in VyloServe & active in PATH (no external)
    s1 = {"installed": True, "version": "20.11.0", "in_path": True, "external": {"exists": False}}
    assert AIAssistantManager._describe_binary_status(s1) == "VyloServe v20.11.0 (Active in PATH)"

    # 3. Installed in VyloServe & active in PATH with external also noted
    s2 = {
        "installed": True,
        "version": "2.44.0",
        "in_path": True,
        "external": {"exists": True, "version": "2.43.0", "path": r"C:\Git\cmd\git.exe"}
    }
    assert "VyloServe v2.44.0 (Active in PATH)" in AIAssistantManager._describe_binary_status(s2)
    assert "[Note: Native 2.43.0 also detected at 'C:\\Git\\cmd\\git.exe']" in AIAssistantManager._describe_binary_status(s2)

    # 4. Installed in VyloServe, but NOT in PATH with external native in use
    s3 = {
        "installed": True,
        "version": "3.11.8",
        "in_path": False,
        "external": {"exists": True, "version": "Python 3.12.0", "path": r"C:\Python312\python.exe"}
    }
    desc3 = AIAssistantManager._describe_binary_status(s3)
    assert "VyloServe v3.11.8 (Installed in VyloServe, but NOT in PATH" in desc3
    assert "Host terminal uses Native Python 3.12.0 at 'C:\\Python312\\python.exe'" in desc3

    # 5. Installed in VyloServe, but NOT in PATH (no external)
    s4 = {"installed": True, "version": "1.22.3", "in_path": False, "external": {"exists": False}}
    assert AIAssistantManager._describe_binary_status(s4) == "VyloServe v1.22.3 (Installed in VyloServe, but NOT in PATH)"

    # 6. Not installed in VyloServe, but native detected
    s5 = {
        "installed": False,
        "version": "",
        "in_path": False,
        "external": {"exists": True, "version": "OpenJDK 17", "path": r"C:\Java\bin\java.exe"}
    }
    assert AIAssistantManager._describe_binary_status(s5) == "Not installed in VyloServe (Native OpenJDK 17 detected on host at 'C:\\Java\\bin\\java.exe')"

    # 7. Not installed anywhere
    s6 = {"installed": False, "version": "", "in_path": False, "external": {"exists": False}}
    assert AIAssistantManager._describe_binary_status(s6) == "Not installed"


def test_doc_retriever_search_knowledge_with_meta(ai_manager):
    retriever = ai_manager.doc_retriever
    snippet, meta = retriever.search_knowledge_with_meta(query="VirtualHost", active_screen="apache")
    assert snippet != ""
    assert "[VyloServe Knowledge Base:" in snippet
    assert meta is not None
    assert meta["file"] == "docs/user_guide.md"
    assert "id" in meta
    assert "title" in meta


def test_send_message_extracts_and_passes_sources(ai_manager, monkeypatch):
    monkeypatch.setattr(ai_manager, '_get_settings', lambda: {
        "ai_provider": "gemini",
        "ai_model": "gemini-3.5-flash-lite",
        "ai_api_key": "valid-key"
    })

    with patch('threading.Thread') as mock_thread:
        context_input = (
            "[VyloServe System Environment]\n"
            "- Active Screen: apache\n"
            "- Recent Apache Error Log snippet:\n```AH00016```"
        )
        res = ai_manager.send_message("kenapa error 10048?", context=context_input)
        assert res["status"] == "success"
        mock_thread.assert_called_once()
        passed_sources = mock_thread.call_args[1]["args"][9]
        source_types = [s["type"] for s in passed_sources]
        assert "system" in source_types
        assert "log" in source_types
        assert "doc" in source_types


@patch('core.services.ai_assistant.AIAssistantManager._stream_gemini')
def test_stream_worker_saves_sources_and_emits(mock_gemini, ai_manager):
    mock_gemini.side_effect = lambda mid, prompt, ctx, hist, model, key, temp, chunks, *extra: chunks.append("Hello world")
    ai_manager.save_chat_history = MagicMock()
    ai_manager.api.emit_ai_chunk = MagicMock()

    sources = [{"type": "system", "label": "VyloServe System Environment"}]
    history = []

    ai_manager._stream_worker(
        message_id="msg_test_1",
        prompt="Check apache",
        context="some context",
        history=history,
        provider="gemini",
        model="gemini-3.5-flash-lite",
        api_key="test-key",
        base_url="",
        temperature=0.5,
        sources=sources
    )

    ai_manager.save_chat_history.assert_called_once()
    saved_history = ai_manager.save_chat_history.call_args[0][0]
    assistant_msg = saved_history[-1]
    assert assistant_msg["role"] == "assistant"
    assert assistant_msg["content"] == "Hello world"
    assert assistant_msg["sources"] == sources

    call_kwargs = ai_manager.api.emit_ai_chunk.call_args[1]
    assert call_kwargs["chunk"] == ""
    assert call_kwargs["is_done"] is True
    assert call_kwargs["error"] == ""
    assert call_kwargs["message_id"] == "msg_test_1"
    assert call_kwargs["sources"] == sources
    assert "usage" in call_kwargs


def test_record_usage_and_get_stats(ai_manager):
    # Reset first for test isolation
    ai_manager.reset_usage_stats()

    # Initial empty usage stats
    res_empty = ai_manager.get_usage_stats("gemini")
    assert res_empty["status"] == "success"
    assert res_empty["data"]["today"]["total_tokens"] == 0
    assert res_empty["data"]["today"]["requests"] == 0

    # Record first usage
    ai_manager.record_usage(
        provider="gemini",
        prompt_tokens=150,
        completion_tokens=250,
        rate_limits={"x-ratelimit-remaining-requests": "14500"}
    )

    res = ai_manager.get_usage_stats("gemini")
    assert res["status"] == "success"
    data = res["data"]
    assert data["today"]["total_tokens"] == 400
    assert data["today"]["prompt_tokens"] == 150
    assert data["today"]["completion_tokens"] == 250
    assert data["today"]["requests"] == 1
    assert data["week"]["total_tokens"] == 400
    assert data["rate_limits"]["x-ratelimit-remaining-requests"] == "14500"

    # Reset stats
    reset_res = ai_manager.reset_usage_stats()
    assert reset_res["status"] == "success"
    assert reset_res["message"] == "backend.ai.usage_reset_success"

    res_after_reset = ai_manager.get_usage_stats("gemini")
    assert res_after_reset["data"]["today"]["total_tokens"] == 0
    assert res_after_reset["data"]["today"]["requests"] == 0


def test_consume_gemini_stream_with_usage(ai_manager):
    raw_lines = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "Hello "}]}}]}\n',
        b'data: {"candidates": [{"content": {"parts": [{"text": "world!"}]}}], "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5, "totalTokenCount": 15}}\n'
    ]
    reply_collector = []
    usage_collector = {}
    ai_manager.api.emit_ai_chunk = MagicMock()

    ai_manager._consume_gemini_stream(raw_lines, "msg_gem", reply_collector, usage_collector)

    assert "".join(reply_collector) == "Hello world!"
    assert usage_collector["prompt_tokens"] == 10
    assert usage_collector["completion_tokens"] == 5
    assert usage_collector["total_tokens"] == 15


def test_consume_openai_stream_with_usage(ai_manager):
    raw_lines = [
        b'data: {"choices": [{"delta": {"content": "OpenAI "}}]}\n',
        b'data: {"choices": [{"delta": {"content": "streaming"}}]}\n',
        b'data: {"choices": [], "usage": {"prompt_tokens": 20, "completion_tokens": 8, "total_tokens": 28}}\n',
        b'data: [DONE]\n'
    ]
    reply_collector = []
    usage_collector = {}
    ai_manager.api.emit_ai_chunk = MagicMock()

    ai_manager._consume_openai_stream(raw_lines, "msg_oai", reply_collector, usage_collector)

    assert "".join(reply_collector) == "OpenAI streaming"
    assert usage_collector["prompt_tokens"] == 20
    assert usage_collector["completion_tokens"] == 8
    assert usage_collector["total_tokens"] == 28


def test_parse_sse_data():
    assert AIAssistantManager._parse_sse_data(b': keep-alive\n\n') is None
    assert AIAssistantManager._parse_sse_data(b'data: \n\n') is None
    assert AIAssistantManager._parse_sse_data(b'data: [DONE]\n') == "[DONE]"
    assert AIAssistantManager._parse_sse_data(b'data: {"test": 123}\n') == '{"test": 123}'


def test_modular_collectors_empty_or_missing(ai_manager):
    lines = []
    # When api lacks attributes
    ai_manager.api = MagicMock()
    del ai_manager.api.get_all_services_status
    del ai_manager.api.apache
    del ai_manager.api.php
    del ai_manager.api.database
    del ai_manager.api.git_manager
    del ai_manager.api.runtimes_manager
    del ai_manager.api.project
    del ai_manager.api.tunnels

    ai_manager._collect_services_status(lines)
    ai_manager._collect_apache_inventory(lines)
    ai_manager._collect_php_inventory(lines)
    ai_manager._collect_database_inventory(lines)
    ai_manager._collect_git_inventory(lines)
    ai_manager._collect_runtimes_inventory(lines)
    p_map = ai_manager._collect_projects_inventory(lines)
    ai_manager._collect_tunnels_inventory(lines, p_map)
    assert lines == []
    assert p_map == {}

