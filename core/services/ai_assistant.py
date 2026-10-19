import os
import re
import json
import time
import uuid
import threading
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

from core.utils.system_utils import get_project_root
from core.utils.file_utils import read_json, write_json, read_log_tail

MSG_UNEXPECTED_ERROR = "backend.error.unexpected"
DEFAULT_SYSTEM_PROMPT = (
    "You are VyloServe AI Assistant, a friendly and expert developer copilot built into the "
    "VyloServe local server management application on Windows. You help users configure Apache, "
    "PHP versions, MySQL/MariaDB and PostgreSQL databases, development runtimes (Node.js, Python, "
    "Java, Go), Git version control, local tunnels (Zrok and Cloudflare), and troubleshoot server logs and port conflicts. "
    "When a [VyloServe System Environment] block is provided in the context, it represents the exact, "
    "real-time installed software, active versions, ports, PATH status, active public tunnels, and running status on the user's local machine. "
    "When the user asks what is installed, what versions exist, what ports are used, what tunnels are active, or what is currently "
    "running in VyloServe, ALWAYS answer directly and factually using the exact versions and details from "
    "the [VyloServe System Environment] block. Never hallucinate versions or instruct the user to check "
    "manually via terminal/CLI when that data is already given in the environment block. "
    "When public tunnels are active (Zrok or Cloudflare sharing a local project to a public URL), they will be listed under '- Public Tunnels:'. "
    "You can tell the user the exact public URLs and which local domain/target is being forwarded. "
    "For Git and Runtimes, pay special attention to PATH status: "
    "1) 'Active in PATH': The version is installed in VyloServe and added to the user's PATH environment variable, so terminal commands run this version. "
    "2) 'Installed internally, but NOT in PATH': The version is installed in VyloServe, but terminal commands will not use it "
    "(and if an external native version is noted, the terminal runs that native version instead until user toggles 'Add to PATH' in VyloServe). "
    "3) 'Not installed in VyloServe (Native ... detected on host)': It is not installed in VyloServe, but the user has an external installation on their PC. "
    "Clearly explain these distinctions if the user asks about version or path availability. "
    "When a [VyloServe Knowledge Base] snippet is provided in the context, prioritize its official "
    "instructions, exact menu names, and troubleshooting steps. "
    "\n\n"
    "OPERATIONAL ACTION PROPOSALS:\n"
    "When the user asks to start, stop, restart, or switch the version of a server service (Apache, PHP, or Database):\n"
    "1. Cross-reference the request against the [VyloServe System Environment] block.\n"
    "- If the user mentions a mismatched or nonexistent version (for example, saying 'hidupkan apache 7.4.33' when 7.4.33 is a PHP version, not Apache), "
    "politely clarify the difference and propose the correct service cards.\n"
    "- If the requested service is installed, briefly state what will be done in a friendly sentence.\n"
    "2. At the end of your response, output a structured JSON action block using the 'vylo_action' code fence.\n"
    "If the user asks to start/stop multiple services simultaneously (for example: 'hidupkan apache dan database' or 'jalankan apache dan mysql'), output a JSON array of action objects inside the code fence:\n"
    "```vylo_action\n"
    "[\n"
    "  {\n"
    '    "service": "apache",\n'
    '    "action": "start",\n'
    '    "label": "Start Apache"\n'
    "  },\n"
    "  {\n"
    '    "service": "database",\n'
    '    "action": "start",\n'
    '    "target": "all",\n'
    '    "label": "Start Database"\n'
    "  }\n"
    "]\n"
    "```\n"
    "For a single service, output a single JSON object inside the code fence:\n"
    "```vylo_action\n"
    "{\n"
    '  "service": "apache" | "php" | "database",\n'
    '  "action": "start" | "stop" | "restart" | "switch_version",\n'
    '  "target": "<version_or_id>",\n'
    '  "label": "<short human-readable action label>"\n'
    "}\n"
    "```\n"
    "Valid values:\n"
    "- 'apache': action 'start', 'stop', 'restart', or 'switch_version' (target is the version string, e.g. '2.4.58')\n"
    "- 'php': action 'start', 'stop' (target is version string, e.g. '8.2.12'), or 'start_all', 'stop_all' (target is 'all')\n"
    "The VyloServe UI will automatically render each item as an interactive confirmation card with an action button for the user.\n"
    "\n\n"
    "FOLLOW-UP SUGGESTIONS:\n"
    "At the end of your response, if relevant, suggest 2 to 3 concise, context-specific follow-up questions or next steps the user might want to explore, formatted as a JSON array inside a 'vylo_suggestions' code block:\n"
    "```vylo_suggestions\n"
    "[\n"
    '  "How do I configure SSL for this VirtualHost?",\n'
    '  "Check if port 443 is already in use"\n'
    "]\n"
    "```\n"
    "Always provide concise, helpful, and technically accurate responses with clean markdown code snippets."
)

MAX_HISTORY_ITEMS = 40
CONTENT_TYPE_JSON = "application/json"
AI_USER_AGENT = "VyloServe/0.0.6"
MSG_AI_KEY_MISSING = "backend.ai.key_missing"
MSG_AI_CONNECTION_FAILED = "backend.ai.connection_failed"
MSG_AI_KEY_INVALID = "backend.ai.key_invalid"
MSG_AI_FETCH_MODELS_FAILED = "backend.ai.fetch_models_failed"
AI_TIER_PRO = "ai.tier_pro"
AI_TIER_FREE = "ai.tier_free"
MODEL_GEMINI_FLASH_LITE = "gemini-3.5-flash-lite"
DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/v1"


class DocRetriever:
    """
    In-memory semantic section parser and lightweight knowledge retriever
    for docs/user_guide.md to enrich AI Assistant context with zero external dependencies.
    """
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.doc_path = os.path.join(root_dir, 'docs', 'user_guide.md')
        self._sections: List[Dict[str, Any]] = []
        self._last_mtime: float = 0.0

    def _ensure_loaded(self) -> None:
        safe_root = os.path.realpath(self.root_dir)
        target = os.path.realpath(self.doc_path)
        if not target.startswith(safe_root) or not os.path.exists(target):
            self._sections = []
            return

        try:
            mtime = os.path.getmtime(target)
            if self._sections and mtime == self._last_mtime:
                return
            with open(target, 'r', encoding='utf-8') as f:
                content = f.read()
            self._sections = self._parse_markdown(content)
            self._last_mtime = mtime
        except Exception:
            self._sections = []

    def _parse_markdown(self, text: str) -> List[Dict[str, Any]]:
        sections = []
        pattern = re.compile(
            r'<!--\s*section:\s*([a-z0-9_-]+)(?:,\s*module:\s*([a-z0-9_-]+))?(?:,\s*tags:\s*\[(.*?)\])?\s*-->',
            re.IGNORECASE
        )
        matches = list(pattern.finditer(text))
        if not matches:
            return sections

        for i, match in enumerate(matches):
            sec_id = match.group(1).strip()
            module = (match.group(2) or "").strip().lower()
            raw_tags = match.group(3) or ""
            tags = [t.strip().lower() for t in raw_tags.split(',') if t.strip()]

            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            body = text[start_pos:end_pos].strip()

            title = sec_id
            for line in body.splitlines():
                line_stripped = line.strip()
                if line_stripped.startswith('#'):
                    title = line_stripped.lstrip('#').strip()
                    break

            sections.append({
                "id": sec_id,
                "module": module,
                "tags": tags,
                "title": title,
                "content": body
            })

        return sections

    @staticmethod
    def _tokenize(text: str) -> set:
        if not text:
            return set()
        words = re.findall(r'[a-zA-Z0-9_-]+', text.lower())
        stop_words = {
            "dan", "yang", "di", "ke", "dari", "ini", "itu", "untuk", "pada", "adalah",
            "the", "a", "an", "is", "in", "to", "of", "and", "or", "saya", "kamu", "bisa",
            "tidak", "dengan", "akan", "jika", "oleh", "saat", "apakah", "bagaimana"
        }
        return {w for w in words if len(w) > 1 and w not in stop_words}

    def _calculate_relevance(
        self,
        sec: Dict[str, Any],
        query_tokens: set,
        active_screen: str,
        raw_query: str
    ) -> int:
        score = 0
        sec_tags = set(sec.get("tags", []))
        sec_module = sec.get("module", "").lower()
        sec_title_tokens = self._tokenize(sec.get("title", ""))
        sec_content_lower = sec.get("content", "").lower()

        # 1. Screen alignment with section module or tags
        if active_screen and (active_screen == sec_module or active_screen in sec_tags):
            score += 15

        # 2. Tag matching
        common_tags = query_tokens.intersection(sec_tags)
        score += len(common_tags) * 12

        # 3. Title token matching
        common_title = query_tokens.intersection(sec_title_tokens)
        score += len(common_title) * 8

        # 4. Critical error keywords / identifiers
        raw_query_lower = raw_query.lower()
        critical_keywords = [
            "10048", "429", "404", "502", "1045", "2002", "uac", "hosts", "vhost", "fastcgi",
            "listen", "port", "composer", "root", "password", "mariadb", "mysql", "postgres",
            "gemini", "groq", "ollama", "openrouter", "tunnel", "cloudflare", "zrok"
        ]
        for kw in critical_keywords:
            if kw in raw_query_lower:
                if kw in sec_tags or kw in sec_title_tokens:
                    score += 20
                elif kw in sec_content_lower:
                    score += 10

        # 5. Content token presence
        for token in query_tokens:
            if len(token) > 3 and token in sec_content_lower:
                score += 2

        return score

    def search_knowledge_with_meta(
        self,
        query: str = "",
        active_screen: str = "",
        max_chars: int = 1200
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        self._ensure_loaded()
        if not self._sections:
            return "", None

        query_tokens = self._tokenize(query)
        norm_screen = (active_screen or "").lower().strip()
        if norm_screen == "ai-assistant":
            norm_screen = "ai"

        if not query_tokens and not norm_screen:
            return "", None

        scored_sections = []
        for sec in self._sections:
            score = self._calculate_relevance(sec, query_tokens, norm_screen, query)
            if score > 0:
                scored_sections.append((score, sec))

        if not scored_sections:
            return "", None

        scored_sections.sort(key=lambda x: x[0], reverse=True)
        top_sec = scored_sections[0][1]

        content_snippet = top_sec["content"].strip()
        if len(content_snippet) > max_chars:
            cut_idx = content_snippet[:max_chars].rfind("\n\n")
            if cut_idx > 300:
                content_snippet = content_snippet[:cut_idx] + "\n..."
            else:
                content_snippet = content_snippet[:max_chars] + "..."

        snippet = f"[VyloServe Knowledge Base: {top_sec['title']}]\n{content_snippet}"
        meta = {
            "id": top_sec.get("id", ""),
            "title": top_sec.get("title", ""),
            "module": top_sec.get("module", ""),
            "file": "docs/user_guide.md"
        }
        return snippet, meta

    def search_knowledge(
        self,
        query: str = "",
        active_screen: str = "",
        max_chars: int = 1200
    ) -> str:
        snippet, _ = self.search_knowledge_with_meta(query=query, active_screen=active_screen, max_chars=max_chars)
        return snippet


class AIAssistantManager:
    """
    Manager layanan AI Assistant (Server Copilot) untuk VyloServe.
    Mendukung komunikasi streaming dengan Google Gemini dan OpenAI-compatible API
    (Groq, OpenRouter, Ollama) menggunakan pustaka standar urllib tanpa dependensi eksternal.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.data_dir = os.path.join(self.root_dir, 'data')
        self.history_file = os.path.join(self.data_dir, 'ai_chat_history.json')
        self.action_states_file = os.path.join(self.data_dir, 'ai_action_states.json')
        self.usage_file = os.path.join(self.data_dir, 'ai_usage.json')
        self.doc_retriever = DocRetriever(self.root_dir)
        
        self._abort_event = threading.Event()
        self._active_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def _get_settings(self) -> Dict[str, Any]:
        """ Mengambil konfigurasi AI dari SettingsManager """
        try:
            if hasattr(self.api, 'settings'):
                res = self.api.settings.get_settings()
                if res.get("status") == "success":
                    return res.get("data", {})
        except Exception:
            pass
        return {}

    # =========================================================================
    # CHAT HISTORY & ACTION STATES PERSISTENCE
    # =========================================================================

    def get_chat_history(self) -> Dict[str, Any]:
        """ Membaca riwayat percakapan dari data/ai_chat_history.json """
        try:
            history = read_json(self.history_file, default_type=list)
            return {"status": "success", "data": history}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def save_chat_history(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """ Menyimpan riwayat percakapan ke data/ai_chat_history.json """
        try:
            if not isinstance(messages, list):
                return {"status": "error", "message": "backend.ai.invalid_history_format"}

            # Batasi riwayat maksimal agar tidak membebani context window
            trimmed = messages[-MAX_HISTORY_ITEMS:]
            os.makedirs(self.data_dir, exist_ok=True)
            write_json(self.history_file, trimmed)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def clear_chat_history(self) -> Dict[str, Any]:
        """ Mengosongkan riwayat percakapan """
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            write_json(self.history_file, [])
            write_json(self.action_states_file, {})
            return {"status": "success", "message": "backend.ai.history_cleared"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def get_action_states(self) -> Dict[str, Any]:
        """ Membaca status eksekusi action proposal dari data/ai_action_states.json """
        try:
            states = read_json(self.action_states_file, default_type=dict)
            return {"status": "success", "data": states}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def save_action_states(self, states: Dict[str, Any]) -> Dict[str, Any]:
        """ Menyimpan status eksekusi action proposal ke data/ai_action_states.json """
        try:
            if not isinstance(states, dict):
                return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": "Invalid action format"}}
            os.makedirs(self.data_dir, exist_ok=True)
            write_json(self.action_states_file, states)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    def clear_action_states(self) -> Dict[str, Any]:
        """ Mengosongkan data status eksekusi action proposal """
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            write_json(self.action_states_file, {})
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    # =========================================================================
    # TOKEN USAGE TRACKER
    # =========================================================================

    @staticmethod
    def _get_today_and_week_keys() -> Tuple[str, str]:
        now = time.localtime()
        today_key = time.strftime("%Y-%m-%d", now)
        week_key = time.strftime("%Y-W%W", now)
        return today_key, week_key

    def record_usage(
        self,
        provider: str,
        prompt_tokens: int,
        completion_tokens: int,
        rate_limits: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Mencatat konsumsi token (prompt & completion) ke ai_usage.json,
        diagregasikan per hari dan per minggu kalender, serta menyimpan rate limit header.
        """
        today_key, week_key = self._get_today_and_week_keys()
        total_tokens = prompt_tokens + completion_tokens

        with self._lock:
            data = read_json(self.usage_file, default_type=dict)
            daily = data.setdefault("daily", {})
            weekly = data.setdefault("weekly", {})
            provider_quotas = data.setdefault("provider_quotas", {})

            # Update daily
            cur_day = daily.setdefault(today_key, {
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            })
            cur_day["requests"] += 1
            cur_day["prompt_tokens"] += prompt_tokens
            cur_day["completion_tokens"] += completion_tokens
            cur_day["total_tokens"] += total_tokens

            # Update weekly
            cur_week = weekly.setdefault(week_key, {
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            })
            cur_week["requests"] += 1
            cur_week["prompt_tokens"] += prompt_tokens
            cur_week["completion_tokens"] += completion_tokens
            cur_week["total_tokens"] += total_tokens

            # Update provider rate limits if available
            if rate_limits:
                prov_key = (provider or "generic").lower()
                existing_limit = provider_quotas.setdefault(prov_key, {})
                existing_limit.update(rate_limits)
                existing_limit["updated_at"] = int(time.time())

            # Cleanup older than 30 days
            keys = sorted(daily.keys())
            if len(keys) > 30:
                for old_key in keys[:-30]:
                    daily.pop(old_key, None)

            write_json(self.usage_file, data)

    def get_usage_stats(self, provider: str = "") -> Dict[str, Any]:
        """
        Mengambil statistik penggunaan token hari ini, minggu ini, dan status kuota provider.
        """
        today_key, week_key = self._get_today_and_week_keys()
        data = read_json(self.usage_file, default_type=dict)
        daily = data.get("daily", {})
        weekly = data.get("weekly", {})
        provider_quotas = data.get("provider_quotas", {})

        today_stats = daily.get(today_key, {
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        })
        week_stats = weekly.get(week_key, {
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        })

        prov_key = (provider or "").lower()
        quotas = provider_quotas.get(prov_key, {}) if prov_key else provider_quotas

        return {
            "status": "success",
            "data": {
                "today": today_stats,
                "week": week_stats,
                "quotas": quotas,
                "rate_limits": quotas,
                "today_key": today_key,
                "week_key": week_key
            }
        }

    def reset_usage_stats(self) -> Dict[str, Any]:
        """ Mengosongkan data statistik penggunaan token """
        with self._lock:
            write_json(self.usage_file, {"daily": {}, "weekly": {}, "provider_quotas": {}})
        return {"status": "success", "message": "backend.ai.usage_reset_success"}

    # =========================================================================
    # CONTEXT AGGREGATOR
    # =========================================================================

    @staticmethod
    def _describe_installed_binary(ver_label: str, in_path: bool, ext_exists: bool, ext_ver: str, ext_path: str) -> str:
        if in_path:
            desc = f"VyloServe v{ver_label} (Active in PATH)"
            if ext_exists:
                desc += f" [Note: Native {ext_ver or 'version'} also detected at '{ext_path}']"
            return desc
        if ext_exists:
            return (
                f"VyloServe v{ver_label} (Installed in VyloServe, but NOT in PATH; "
                f"Host terminal uses Native {ext_ver or 'version'} at '{ext_path}')"
            )
        return f"VyloServe v{ver_label} (Installed in VyloServe, but NOT in PATH)"

    @staticmethod
    def _describe_binary_status(status: Dict[str, Any]) -> str:
        """
        Memformat status detail biner (Git atau Runtime Engine)
        membedakan secara jelas:
        1. Terinstall di VyloServe & aktif di User PATH
        2. Terinstall di VyloServe tetapi TIDAK di PATH (dan apakah terminal memakai native eksternal)
        3. Belum terinstall di VyloServe tetapi native terdeteksi di host OS
        4. Belum terinstall sama sekali
        """
        if not isinstance(status, dict):
            return "Not installed"

        installed = bool(status.get("installed"))
        internal_ver = str(status.get("version", "")).strip()
        in_path = bool(status.get("in_path"))
        external = status.get("external") if isinstance(status.get("external"), dict) else {}
        ext_exists = bool(external.get("exists"))
        ext_ver = str(external.get("version", "")).strip()
        ext_path = str(external.get("path", "")).strip()

        if installed:
            ver_label = internal_ver if internal_ver else "installed"
            return AIAssistantManager._describe_installed_binary(ver_label, in_path, ext_exists, ext_ver, ext_path)

        if ext_exists:
            return f"Not installed in VyloServe (Native {ext_ver or 'version'} detected on host at '{ext_path}')"
        return "Not installed"

    def _collect_services_status(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'get_all_services_status'):
            return
        res = self.api.get_all_services_status()
        statuses = {}
        if isinstance(res, dict):
            statuses = res.get("data") if "data" in res else res
            if not isinstance(statuses, dict):
                statuses = {}
        status_summary = []
        for svc, is_running in statuses.items():
            if isinstance(is_running, bool):
                status_summary.append(f"{svc}: {'running' if is_running else 'stopped'}")
        if status_summary:
            lines.append(f"- Services Status: {', '.join(status_summary)}")

    def _collect_apache_inventory(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'apache'):
            return
        try:
            ap = self.api.apache
            installed_vers = []
            active_ver = None
            if hasattr(ap, 'get_installed_versions'):
                ap_res = ap.get_installed_versions()
                if isinstance(ap_res, dict) and ap_res.get("status") == "success":
                    installed_vers = ap_res.get("data", [])
                    active_ver = ap_res.get("active")
            is_running = ap.check_is_running() if hasattr(ap, 'check_is_running') else False
            port = ap.get_http_port() if hasattr(ap, 'get_http_port') else 80

            ap_str = f"- Apache: Installed: {', '.join(installed_vers) if installed_vers else 'None'} | Active: {active_ver or 'None'} | Port: {port} | Status: {'running' if is_running else 'stopped'}"
            lines.append(ap_str)
        except Exception:
            pass

    def _collect_php_inventory(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'php'):
            return
        try:
            php = self.api.php
            if hasattr(php, 'get_installed_instances'):
                instances = php.get_installed_instances()
                if isinstance(instances, list) and instances:
                    inst_strs = [f"PHP {inst.get('version')} (Port {inst.get('port')}, {inst.get('status', 'stopped')})" for inst in instances if isinstance(inst, dict)]
                    lines.append(f"- PHP: {', '.join(inst_strs)}")
                else:
                    lines.append("- PHP: None installed")
        except Exception:
            pass

    def _collect_database_inventory(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'database'):
            return
        try:
            db_service = self.api.database
            if hasattr(db_service, 'get_installed'):
                db_res = db_service.get_installed()
                raw_dbs = []
                if isinstance(db_res, dict):
                    raw_dbs = db_res.get("data", [])
                elif isinstance(db_res, list):
                    raw_dbs = db_res
                if raw_dbs:
                    db_strs = [f"{str(d.get('engine', 'db')).capitalize()} {d.get('version')} (Port {d.get('port')}, {d.get('status', 'stopped')})" for d in raw_dbs if isinstance(d, dict)]
                    lines.append(f"- Database: {', '.join(db_strs)}")
                else:
                    lines.append("- Database: None installed")
        except Exception:
            pass

    def _collect_git_inventory(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'git_manager'):
            return
        try:
            try:
                git_st = self.api.git_manager.get_git_status(silent=True)
            except TypeError:
                git_st = self.api.git_manager.get_git_status()
            lines.append(f"- Git: {self._describe_binary_status(git_st)}")
        except Exception:
            pass

    def _collect_runtimes_inventory(self, lines: List[str]) -> None:
        if not hasattr(self.api, 'runtimes_manager'):
            return
        try:
            rt = self.api.runtimes_manager
            rt_parts = []
            checkers = [
                ("Node.js", "get_node_status"),
                ("Python", "get_python_status"),
                ("Java", "get_java_status"),
                ("Go", "get_go_status"),
            ]
            for name, meth in checkers:
                if hasattr(rt, meth):
                    fn = getattr(rt, meth)
                    try:
                        st = fn(silent=True)
                    except TypeError:
                        st = fn()
                    rt_parts.append(f"{name}: {self._describe_binary_status(st)}")
            if rt_parts:
                lines.append(f"- Runtimes: {'; '.join(rt_parts)}")
        except Exception:
            pass

    @staticmethod
    def _format_project_item(p: dict, project_name_map: dict) -> str:
        pid = p.get("id", "")
        name = p.get("name") or p.get("domain") or "project"
        dom = p.get("domain", "")
        fw = p.get("framework", "")
        if pid:
            project_name_map[pid] = dom or name
        return f"{name} ({dom}{f', {fw}' if fw else ''})"

    def _collect_projects_inventory(self, lines: List[str]) -> Dict[str, str]:
        project_name_map = {}
        if not hasattr(self.api, 'project'):
            return project_name_map
        try:
            p_service = self.api.project
            if hasattr(p_service, 'get_projects'):
                p_res = p_service.get_projects()
                p_list = p_res.get("data", []) if isinstance(p_res, dict) else []
                if p_list:
                    p_items = [self._format_project_item(p, project_name_map) for p in p_list if isinstance(p, dict)]
                    lines.append(f"- Projects ({len(p_list)}): {', '.join(p_items)}")
                else:
                    lines.append("- Projects: 0 registered")
        except Exception:
            pass
        return project_name_map

    @staticmethod
    def _collect_active_tunnel_shares(tunnels_svc: Any, method_name: str, label: str, project_map: Dict[str, str]) -> List[str]:
        items = []
        if hasattr(tunnels_svc, method_name):
            st = getattr(tunnels_svc, method_name)()
            shares = st.get("active_shares", []) if isinstance(st, dict) else []
            for s in shares:
                if isinstance(s, dict):
                    raw_pid = s.get("project_id", "custom")
                    target_label = project_map.get(raw_pid, raw_pid)
                    url = s.get("url", "")
                    items.append(f"{label} ({target_label} -> {url})")
        return items

    def _collect_tunnels_inventory(self, lines: List[str], project_map: Dict[str, str]) -> None:
        if not hasattr(self.api, 'tunnels'):
            return
        try:
            tunnels_svc = self.api.tunnels
            active_tunnels = []
            active_tunnels.extend(self._collect_active_tunnel_shares(tunnels_svc, 'get_zrok_status', 'Zrok', project_map))
            active_tunnels.extend(self._collect_active_tunnel_shares(tunnels_svc, 'get_cloudflare_status', 'Cloudflare', project_map))

            if active_tunnels:
                lines.append(f"- Public Tunnels: {', '.join(active_tunnels)}")
            else:
                lines.append("- Public Tunnels: None active")
        except Exception:
            pass

    @staticmethod
    def _append_screen_context_hint(lines: List[str], active_screen: str) -> None:
        norm = (active_screen or "").lower().strip()
        screen_map = {
            "apache": "Apache Module Management",
            "php": "PHP Multi-Version Management",
            "database": "Database Multi-Engine Management",
            "runtimes": "Development Runtimes Management",
            "projects": "Local Projects & VirtualHosts",
            "tunnels": "Local Public Tunnels (Zrok / Cloudflare)",
            "git": "Git Tools & Version Management",
            "docs": "VyloServe User Guide & Documentation",
            "settings": "Application Settings",
            "dashboard": "Main Dashboard",
        }
        if norm in screen_map:
            lines.append(f"- Current View: {screen_map[norm]}")

    def _build_environment_inventory(self, active_screen: str = "") -> List[str]:
        """ Mengumpulkan data inventaris aktual modul dan runtime yang terpasang di VyloServe """
        lines = ["[VyloServe System Environment]"]
        lines.append(f"- Active Screen: {active_screen or 'dashboard'}")

        self._collect_services_status(lines)
        self._collect_apache_inventory(lines)
        self._collect_php_inventory(lines)
        self._collect_database_inventory(lines)
        self._collect_git_inventory(lines)
        self._collect_runtimes_inventory(lines)
        project_map = self._collect_projects_inventory(lines)
        self._collect_tunnels_inventory(lines, project_map)
        self._append_screen_context_hint(lines, active_screen)

        return lines

    def _append_apache_error_log(self, context_lines: List[str]) -> None:
        if not hasattr(self.api, 'apache'):
            return
        try:
            apache_status = self.api.apache.get_status().get("data", {}) if hasattr(self.api.apache, 'get_status') else {}
            active_ver = apache_status.get("active_version") or apache_status.get("version")
            if active_ver:
                error_log_path = os.path.join(self.root_dir, 'bin', 'apache', active_ver, 'logs', 'error.log')
                if os.path.exists(error_log_path):
                    tail = read_log_tail(error_log_path, lines=8)
                    if tail.strip():
                        context_lines.append(f"- Recent Apache Error Log snippet:\n```\n{tail.strip()}\n```")
        except Exception:
            pass

    def get_server_context(self, active_screen: str = "", include_logs: bool = True) -> Dict[str, Any]:
        """
        Mengumpulkan konteks lingkungan server saat ini (layar aktif, inventaris modul terpasang,
        dan baris log error terbaru) untuk disematkan ke AI prompt.
        """
        try:
            context_lines = self._build_environment_inventory(active_screen)
            if include_logs:
                self._append_apache_error_log(context_lines)
            return {"status": "success", "data": "\n".join(context_lines)}
        except Exception as e:
            return {"status": "error", "message": MSG_UNEXPECTED_ERROR, "args": {"e": str(e)}}

    # =========================================================================
    # TEST CONNECTION
    # =========================================================================

    def _test_gemini_ping(self, api_key: str, model: str) -> bool:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": "Ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": CONTENT_TYPE_JSON, "User-Agent": AI_USER_AGENT},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200

    def _test_openai_ping(self, provider: str, api_key: str, model: str, base_url: str) -> bool:
        endpoint = self._resolve_openai_endpoint(provider, base_url)
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Ping"}],
            "max_tokens": 5
        }
        headers = {
            "Content-Type": CONTENT_TYPE_JSON,
            "User-Agent": AI_USER_AGENT
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://vyloserve.local"
            headers["X-Title"] = "VyloServe"

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)

    def test_connection(self, provider: str, api_key: str, model: str, base_url: str = "") -> Dict[str, Any]:
        """
        Menguji konektivitas API provider dengan panggilan ping ringan.
        """
        provider = (provider or "gemini").lower()
        if provider != "ollama" and not api_key:
            return {"status": "error", "message": MSG_AI_KEY_MISSING}

        try:
            if provider == "gemini":
                success = self._test_gemini_ping(api_key, model)
            else:
                success = self._test_openai_ping(provider, api_key, model, base_url)

            if success:
                return {"status": "success", "message": "backend.ai.connection_success"}
            return {"status": "error", "message": MSG_AI_CONNECTION_FAILED, "args": {"e": "HTTP unexpected status"}}
        except urllib.error.HTTPError as e:
            err_detail = e.reason
            try:
                body = e.read().decode('utf-8')
                parsed = json.loads(body)
                err_detail = parsed.get("error", {}).get("message", body[:200])
            except Exception:
                pass
            return {"status": "error", "message": MSG_AI_CONNECTION_FAILED, "args": {"e": f"HTTP {e.code}: {err_detail}"}}
        except Exception as e:
            return {"status": "error", "message": MSG_AI_CONNECTION_FAILED, "args": {"e": str(e)}}

    # =========================================================================
    # DYNAMIC MODELS CATALOG & TIER DETECTION
    # =========================================================================

    @staticmethod
    def _extract_http_error_detail(e: urllib.error.HTTPError) -> str:
        err_detail = str(e.reason or "")
        try:
            body = e.read().decode('utf-8')
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                err_obj = parsed.get("error")
                if isinstance(err_obj, dict):
                    err_detail = err_obj.get("message", str(err_obj))
                elif isinstance(err_obj, str):
                    err_detail = err_obj
                elif "message" in parsed:
                    err_detail = parsed["message"]
                else:
                    err_detail = body[:200]
            else:
                err_detail = body[:200]
        except Exception:
            pass
        return f"HTTP {e.code}: {err_detail}".strip()

    def _detect_gemini_tier(self, api_key: str) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": AI_USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                _ = resp.status
        except urllib.error.HTTPError as e:
            if e.code in (400, 403):
                return {"status": "error", "message": MSG_AI_KEY_INVALID, "tier": "invalid"}
            err_msg = self._extract_http_error_detail(e)
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": err_msg}}
        except Exception as e:
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": str(e)}}

        pro_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key={api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": "P"}]}],
            "generationConfig": {"maxOutputTokens": 1}
        }
        pro_req = urllib.request.Request(
            pro_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": CONTENT_TYPE_JSON, "User-Agent": AI_USER_AGENT},
            method="POST"
        )
        try:
            with urllib.request.urlopen(pro_req, timeout=6) as resp:
                if resp.status == 200:
                    return {"status": "success", "tier": "pro", "is_pro": True, "label": AI_TIER_PRO}
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode('utf-8')
            except Exception:
                pass
            if "FreeTier" in body or "limit: 0" in body or e.code == 429:
                return {"status": "success", "tier": "free", "is_pro": False, "label": AI_TIER_FREE}
        except Exception:
            pass

        return {"status": "success", "tier": "free", "is_pro": False, "label": AI_TIER_FREE}

    def _detect_openrouter_tier(self, api_key: str) -> Dict[str, Any]:
        url = "https://openrouter.ai/api/v1/auth/key"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": AI_USER_AGENT
        })
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8')).get("data", {})
                is_free = data.get("is_free_tier", True)
                limit = data.get("limit")
                usage = data.get("usage", 0)
                is_pro = (not is_free) or (limit is not None and limit > 0) or (usage > 0)
                tier = "pro" if is_pro else "free"
                label = AI_TIER_PRO if is_pro else AI_TIER_FREE
                return {"status": "success", "tier": tier, "is_pro": is_pro, "label": label}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {"status": "error", "message": MSG_AI_KEY_INVALID, "tier": "invalid"}
            err_msg = self._extract_http_error_detail(e)
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": err_msg}}
        except Exception as e:
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": str(e)}}

    def _detect_groq_tier(self, api_key: str) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/models"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": AI_USER_AGENT
        })
        try:
            with urllib.request.urlopen(req, timeout=8):
                return {"status": "success", "tier": "free", "is_pro": False, "label": AI_TIER_FREE}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {"status": "error", "message": MSG_AI_KEY_INVALID, "tier": "invalid"}
            err_msg = self._extract_http_error_detail(e)
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": err_msg}}
        except Exception as e:
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "tier": "error", "args": {"e": str(e)}}

    def _detect_ollama_tier(self, base_url: str = "") -> Dict[str, Any]:
        base = (base_url or "http://localhost:11434").rstrip('/')
        if base.endswith('/v1'):
            base = base[:-3]
        url = f"{base}/api/tags"
        req = urllib.request.Request(url, headers={"User-Agent": AI_USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=5):
                return {"status": "success", "tier": "local", "is_pro": False, "label": "ai.tier_local"}
        except Exception:
            return {"status": "error", "message": "backend.ai.ollama_offline", "tier": "offline"}

    def detect_account_tier(
        self,
        provider: str = "gemini",
        api_key: str = "",
        base_url: str = ""
    ) -> Dict[str, Any]:
        """
        Mendeteksi tipe akun (Free Tier vs Pro / Pay-As-You-Go) berdasarkan API key dan provider.
        """
        provider = (provider or "gemini").lower().strip()
        if provider != "ollama" and not api_key:
            return {"status": "error", "message": MSG_AI_KEY_MISSING, "tier": "invalid"}

        if provider == "gemini":
            return self._detect_gemini_tier(api_key)
        elif provider == "openrouter":
            return self._detect_openrouter_tier(api_key)
        elif provider == "groq":
            return self._detect_groq_tier(api_key)
        elif provider == "ollama":
            return self._detect_ollama_tier(base_url)
        else:
            return {"status": "success", "tier": "free", "is_pro": False, "label": AI_TIER_FREE}

    def _fetch_gemini_models(self, api_key: str, tier: str = "free") -> List[Dict[str, str]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": AI_USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        
        models = []
        exclude_kw = ("tts", "image", "embedding", "robotics", "transcribe", "banana", "lyria", "gemma", "1.5", "2.0", "2.5")
        free_allowed = {MODEL_GEMINI_FLASH_LITE, "gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-lite-latest", "gemini-flash-latest"}

        for m in data.get("models", []):
            name = m.get("name", "")
            methods = m.get("supportedGenerationMethods", [])
            if "generateContent" not in methods or "gemini" not in name.lower():
                continue
            val = name.replace("models/", "")
            if any(k in val.lower() for k in exclude_kw):
                continue
            if tier != "pro" and val not in free_allowed:
                continue

            label = m.get("displayName") or val
            if val == MODEL_GEMINI_FLASH_LITE:
                label = f"{label} (Fast & Recommended)"
            elif val in ("gemini-pro-latest", "gemini-3.1-pro-preview"):
                label = f"{label} (Pro)"
            models.append({"value": val, "label": label})

        models.sort(key=lambda x: 0 if "3.5-flash-lite" in x["value"] else 1)
        return models

    def _fetch_groq_models(self, api_key: str) -> List[Dict[str, str]]:
        url = "https://api.groq.com/openai/v1/models"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": AI_USER_AGENT
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        models = []
        for m in data.get("data", []):
            if not m.get("active", True):
                continue
            m_id = m.get("id", "")
            if "whisper" in m_id.lower():
                continue
            models.append({"value": m_id, "label": m_id})
        return models

    def _fetch_openrouter_models(self, api_key: str = "", tier: str = "free") -> List[Dict[str, str]]:
        url = "https://openrouter.ai/api/v1/models"
        headers = {"User-Agent": AI_USER_AGENT}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        free_models = []
        paid_models = []
        for m in data.get("data", []):
            m_id = m.get("id", "")
            name = m.get("name") or m_id
            if ":free" in m_id.lower():
                free_models.append({"value": m_id, "label": f"{name} (Free)"})
            elif tier == "pro":
                paid_models.append({"value": m_id, "label": name})

        if tier == "pro":
            return free_models + paid_models[:30]
        return free_models

    def _fetch_ollama_models(self, base_url: str = "") -> List[Dict[str, str]]:
        base = (base_url or "http://localhost:11434").rstrip('/')
        if base.endswith('/v1'):
            base = base[:-3]
        url = f"{base}/api/tags"
        req = urllib.request.Request(url, headers={"User-Agent": AI_USER_AGENT})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        models = []
        for m in data.get("models", []):
            name = m.get("name", "")
            if name:
                models.append({"value": name, "label": name})
        return models

    def _resolve_tier_for_models(
        self,
        provider: str,
        api_key: str,
        base_url: str,
        tier: str
    ) -> Tuple[Optional[Dict[str, Any]], str, bool, str]:
        detected_tier = tier
        is_pro = (tier == "pro")
        tier_label = AI_TIER_PRO if is_pro else AI_TIER_FREE

        if detected_tier:
            return None, detected_tier, is_pro, tier_label

        if api_key:
            tier_res = self.detect_account_tier(provider, api_key, base_url)
            if tier_res.get("status") == "error":
                return tier_res, "", False, ""
            detected_tier = tier_res.get("tier", "free")
            is_pro = tier_res.get("is_pro", False)
            tier_label = tier_res.get("label", tier_label)
        elif provider == "ollama":
            tier_res = self.detect_account_tier(provider, api_key, base_url)
            if tier_res.get("status") == "error":
                return tier_res, "", False, ""
            detected_tier = "local"
            tier_label = "ai.tier_local"
        else:
            detected_tier = "free"

        return None, detected_tier, is_pro, tier_label

    def _dispatch_fetch_models(
        self,
        provider: str,
        api_key: str,
        base_url: str,
        detected_tier: str
    ) -> List[Dict[str, str]]:
        if provider == "gemini":
            return self._fetch_gemini_models(api_key, detected_tier)
        if provider == "groq":
            return self._fetch_groq_models(api_key)
        if provider == "openrouter":
            return self._fetch_openrouter_models(api_key, detected_tier)
        if provider == "ollama":
            return self._fetch_ollama_models(base_url)
        return self._fetch_groq_models(api_key)

    def get_available_models(
        self,
        provider: str = "gemini",
        api_key: str = "",
        base_url: str = "",
        tier: str = ""
    ) -> Dict[str, Any]:
        """
        Mengambil daftar model yang aktif secara langsung dari API masing-masing provider,
        disaring sesuai status tier akun pengguna (Free vs Pro).
        """
        provider = (provider or "gemini").lower().strip()
        if provider in ("gemini", "groq") and not api_key:
            return {"status": "error", "message": MSG_AI_KEY_MISSING, "tier": "invalid"}

        err_res, detected_tier, is_pro, tier_label = self._resolve_tier_for_models(
            provider, api_key, base_url, tier
        )
        if err_res:
            return err_res

        try:
            models = self._dispatch_fetch_models(provider, api_key, base_url, detected_tier)
            return {
                "status": "success",
                "data": models,
                "tier": detected_tier,
                "is_pro": is_pro,
                "label": tier_label
            }
        except urllib.error.HTTPError as e:
            err_msg = self._extract_http_error_detail(e)
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "args": {"e": err_msg}}
        except urllib.error.URLError as e:
            if provider == "ollama":
                return {"status": "error", "message": "backend.ai.ollama_offline"}
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "args": {"e": str(e.reason)}}
        except Exception as e:
            return {"status": "error", "message": MSG_AI_FETCH_MODELS_FAILED, "args": {"e": str(e)}}

    # =========================================================================
    # STREAMING MESSAGE HANDLING
    # =========================================================================

    def _resolve_openai_endpoint(self, provider: str, base_url: str = "") -> str:
        provider = provider.lower()
        if provider == "groq":
            return "https://api.groq.com/openai/v1/chat/completions"
        if provider == "openrouter":
            return "https://openrouter.ai/api/v1/chat/completions"

        # ollama or custom
        base = (base_url or DEFAULT_OLLAMA_ENDPOINT).rstrip('/')
        if not base.endswith('/chat/completions'):
            return f"{base}/chat/completions"
        return base

    def abort_generation(self) -> Dict[str, Any]:
        """ Membatalkan proses streaming aktif """
        self._abort_event.set()
        if hasattr(self.api, 'emit_ai_chunk'):
            self.api.emit_ai_chunk(chunk="", is_done=True, error="backend.ai.aborted")
        return {"status": "success"}

    @staticmethod
    def _extract_active_screen(context: str) -> str:
        if not context:
            return ""
        match = re.search(r'- Active Screen:\s*([a-zA-Z0-9_-]+)', context)
        return match.group(1) if match else ""

    def _prepare_message_context_and_sources(self, prompt: str, context: str) -> Tuple[str, List[Dict[str, Any]]]:
        sources: List[Dict[str, Any]] = []
        if "[VyloServe System Environment]" in context:
            sources.append({"type": "system", "label": "VyloServe System Environment"})
        if "Recent Apache Error Log" in context:
            sources.append({"type": "log", "label": "Apache Error Log (error.log)"})

        active_screen = self._extract_active_screen(context)
        kb_snippet, kb_meta = self.doc_retriever.search_knowledge_with_meta(query=prompt, active_screen=active_screen)
        if kb_snippet and kb_meta:
            sources.append({
                "type": "doc",
                "label": f"{kb_meta.get('title', 'User Guide')} (docs/user_guide.md)",
                "id": kb_meta.get("id")
            })

        enriched_context = f"{context}\n\n{kb_snippet}".strip() if kb_snippet else context
        return enriched_context, sources

    def send_message(
        self,
        prompt: str,
        context: str = "",
        model_override: str = "",
        provider_override: str = ""
    ) -> Dict[str, Any]:
        """
        Memulai pengiriman pesan ke AI. Menjalankan thread streaming di latar belakang
        dan langsung mengembalikan message_id ke frontend.
        """
        if not prompt or not prompt.strip():
            return {"status": "error", "message": "backend.ai.empty_prompt"}

        settings = self._get_settings()
        provider = (provider_override or settings.get("ai_provider", "gemini")).lower()
        model = model_override or settings.get("ai_model", MODEL_GEMINI_FLASH_LITE)
        if provider == "gemini" and model in ("gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"):
            model = MODEL_GEMINI_FLASH_LITE
        api_key = settings.get("ai_api_key", "").strip()
        base_url = settings.get("ai_base_url", DEFAULT_OLLAMA_ENDPOINT).strip()
        temperature = float(settings.get("ai_temperature", 0.5))

        if provider != "ollama" and not api_key:
            return {"status": "error", "message": MSG_AI_KEY_MISSING}

        message_id = f"msg_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        self._abort_event.clear()

        history_res = self.get_chat_history()
        history = history_res.get("data", []) if history_res.get("status") == "success" else []

        enriched_context, sources = self._prepare_message_context_and_sources(prompt, context)

        thread = threading.Thread(
            target=self._stream_worker,
            args=(message_id, prompt, enriched_context, history, provider, model, api_key, base_url, temperature, sources),
            daemon=True
        )
        self._active_thread = thread
        thread.start()

        return {"status": "success", "message_id": message_id}

    def _emit_stream_done(
        self,
        message_id: str,
        error: str = "",
        sources: Optional[List[Dict[str, Any]]] = None,
        usage: Optional[Dict[str, Any]] = None
    ) -> None:
        if not hasattr(self.api, 'emit_ai_chunk'):
            return
        emit_kwargs: Dict[str, Any] = {
            "chunk": "",
            "is_done": True,
            "error": error,
            "message_id": message_id
        }
        if sources is not None:
            emit_kwargs["sources"] = sources
        if usage is not None:
            emit_kwargs["usage"] = usage
        self.api.emit_ai_chunk(**emit_kwargs)

    def _save_stream_reply(
        self,
        history: List[Dict[str, Any]],
        message_id: str,
        full_reply_chunks: List[str],
        model: str,
        provider: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        usage: Optional[Dict[str, Any]] = None
    ) -> None:
        if self._abort_event.is_set():
            return
        complete_text = "".join(full_reply_chunks)
        assistant_msg: Dict[str, Any] = {
            "id": message_id,
            "role": "assistant",
            "content": complete_text,
            "model": model,
            "provider": provider,
            "timestamp": int(time.time() * 1000)
        }
        if sources:
            assistant_msg["sources"] = sources
        if usage:
            assistant_msg["usage"] = usage
        history.append(assistant_msg)
        self.save_chat_history(history)
        self._emit_stream_done(message_id, error="", sources=sources, usage=usage)

    def _stream_worker(
        self,
        message_id: str,
        prompt: str,
        context: str,
        history: List[Dict[str, Any]],
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
        temperature: float,
        sources: Optional[List[Dict[str, Any]]] = None
    ):
        full_reply_chunks = []
        user_timestamp = int(time.time() * 1000)
        user_msg: Dict[str, Any] = {
            "id": f"usr_{user_timestamp}",
            "role": "user",
            "content": prompt,
            "timestamp": user_timestamp
        }
        if context:
            user_msg["context"] = context
        history.append(user_msg)

        usage_collector: Dict[str, int] = {}
        rate_limits_collector: Dict[str, Any] = {}

        try:
            if provider == "gemini":
                self._stream_gemini(message_id, prompt, context, history, model, api_key, temperature, full_reply_chunks, usage_collector)
            else:
                self._stream_openai_compatible(message_id, prompt, context, history, provider, model, api_key, base_url, temperature, full_reply_chunks, usage_collector, rate_limits_collector)

            complete_text = "".join(full_reply_chunks)
            prompt_tokens = usage_collector.get("prompt_tokens", 0)
            completion_tokens = usage_collector.get("completion_tokens", 0)
            if prompt_tokens == 0 or completion_tokens == 0:
                prompt_tokens = max(1, len(prompt + (context or "")) // 4)
                completion_tokens = max(1, len(complete_text) // 4)
                usage_collector["prompt_tokens"] = prompt_tokens
                usage_collector["completion_tokens"] = completion_tokens
                usage_collector["total_tokens"] = prompt_tokens + completion_tokens

            self.record_usage(provider, prompt_tokens, completion_tokens, rate_limits_collector)
            self._save_stream_reply(history, message_id, full_reply_chunks, model, provider, sources, usage_collector)
        except urllib.error.HTTPError as e:
            err_msg = self._extract_http_error_detail(e)
            self._emit_stream_done(message_id, error=err_msg, sources=sources)
        except Exception as e:
            self._emit_stream_done(message_id, error=str(e), sources=sources)

    @staticmethod
    def _parse_sse_data(raw_line: bytes) -> Optional[str]:
        line_str = raw_line.decode('utf-8').strip()
        if not line_str.startswith("data: "):
            return None
        payload = line_str[6:].strip()
        return payload if payload else None

    @staticmethod
    def _build_gemini_payload(prompt: str, context: str, history: List[Dict[str, Any]], temperature: float) -> dict:
        contents = []
        for msg in history[:-1]:
            role = "model" if msg.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

        final_user_text = f"[Context:\n{context}]\n\n{prompt}" if context else prompt
        contents.append({"role": "user", "parts": [{"text": final_user_text}]})

        return {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": DEFAULT_SYSTEM_PROMPT}]},
            "generationConfig": {"temperature": temperature}
        }

    @staticmethod
    def _extract_gemini_candidate_text(obj: dict) -> List[str]:
        candidates = obj.get("candidates", [])
        if not candidates:
            return []
        parts = candidates[0].get("content", {}).get("parts", [])
        return [p.get("text", "") for p in parts if p.get("text")]

    def _consume_gemini_stream(
        self,
        resp,
        message_id: str,
        reply_collector: List[str],
        usage_collector: Optional[Dict[str, Any]] = None
    ) -> None:
        for line in resp:
            if self._abort_event.is_set():
                break
            data_json = self._parse_sse_data(line)
            if not data_json:
                continue
            try:
                obj = json.loads(data_json)
                if usage_collector is not None and "usageMetadata" in obj:
                    meta = obj["usageMetadata"]
                    usage_collector["prompt_tokens"] = meta.get("promptTokenCount", usage_collector.get("prompt_tokens", 0))
                    usage_collector["completion_tokens"] = meta.get("candidatesTokenCount", usage_collector.get("completion_tokens", 0))
                    usage_collector["total_tokens"] = meta.get("totalTokenCount", usage_collector.get("total_tokens", 0))

                for chunk in self._extract_gemini_candidate_text(obj):
                    reply_collector.append(chunk)
                    if hasattr(self.api, 'emit_ai_chunk'):
                        self.api.emit_ai_chunk(chunk=chunk, is_done=False, message_id=message_id)
            except Exception:
                pass

    def _stream_gemini(
        self,
        message_id: str,
        prompt: str,
        context: str,
        history: List[Dict[str, Any]],
        model: str,
        api_key: str,
        temperature: float,
        reply_collector: List[str],
        usage_collector: Optional[Dict[str, Any]] = None
    ):
        """ Menangani streaming SSE Google Gemini v1beta """
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
        payload = self._build_gemini_payload(prompt, context, history, temperature)

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": CONTENT_TYPE_JSON, "User-Agent": AI_USER_AGENT},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            self._consume_gemini_stream(resp, message_id, reply_collector, usage_collector)

    @staticmethod
    def _build_openai_payload(
        prompt: str,
        context: str,
        history: List[Dict[str, Any]],
        model: str,
        temperature: float
    ) -> dict:
        messages = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}]
        for msg in history[:-1]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        final_user_text = f"[Context:\n{context}]\n\n{prompt}" if context else prompt
        messages.append({"role": "user", "content": final_user_text})

        return {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True}
        }

    @staticmethod
    def _build_openai_headers(provider: str, api_key: str) -> dict:
        headers = {
            "Content-Type": CONTENT_TYPE_JSON,
            "User-Agent": AI_USER_AGENT
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://vyloserve.local"
            headers["X-Title"] = "VyloServe"
        return headers

    @staticmethod
    def _extract_openai_delta_text(obj: dict) -> str:
        choices = obj.get("choices", [])
        if not choices:
            return ""
        delta = choices[0].get("delta", {})
        return delta.get("content", "")

    @staticmethod
    def _update_openai_stream_usage(obj: dict, usage_collector: Optional[Dict[str, Any]]) -> None:
        if usage_collector is None:
            return
        usage = obj.get("usage")
        if not usage:
            return
        usage_collector["prompt_tokens"] = usage.get("prompt_tokens", usage_collector.get("prompt_tokens", 0))
        usage_collector["completion_tokens"] = usage.get("completion_tokens", usage_collector.get("completion_tokens", 0))
        usage_collector["total_tokens"] = usage.get("total_tokens", usage_collector.get("total_tokens", 0))

    def _emit_openai_chunk(self, obj: dict, message_id: str, reply_collector: List[str]) -> None:
        chunk_text = self._extract_openai_delta_text(obj)
        if chunk_text:
            reply_collector.append(chunk_text)
            if hasattr(self.api, 'emit_ai_chunk'):
                self.api.emit_ai_chunk(chunk=chunk_text, is_done=False, message_id=message_id)

    def _process_openai_stream_payload(
        self,
        data_body: str,
        message_id: str,
        reply_collector: List[str],
        usage_collector: Optional[Dict[str, Any]] = None
    ) -> None:
        try:
            obj = json.loads(data_body)
            self._update_openai_stream_usage(obj, usage_collector)
            self._emit_openai_chunk(obj, message_id, reply_collector)
        except Exception:
            pass

    def _consume_openai_stream(
        self,
        resp,
        message_id: str,
        reply_collector: List[str],
        usage_collector: Optional[Dict[str, Any]] = None
    ) -> None:
        for line in resp:
            if self._abort_event.is_set():
                break
            data_body = self._parse_sse_data(line)
            if not data_body:
                continue
            if data_body == "[DONE]":
                break
            self._process_openai_stream_payload(data_body, message_id, reply_collector, usage_collector)

    def _stream_openai_compatible(
        self,
        message_id: str,
        prompt: str,
        context: str,
        history: List[Dict[str, Any]],
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
        temperature: float,
        reply_collector: List[str],
        usage_collector: Optional[Dict[str, Any]] = None,
        rate_limits_collector: Optional[Dict[str, Any]] = None
    ):
        """ Menangani streaming SSE OpenAI-compatible (Groq, OpenRouter, Ollama) """
        endpoint = self._resolve_openai_endpoint(provider, base_url)
        payload = self._build_openai_payload(prompt, context, history, model, temperature)
        headers = self._build_openai_headers(provider, api_key)

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            if rate_limits_collector is not None and hasattr(resp, "headers"):
                for key, val in resp.headers.items():
                    k_lower = key.lower()
                    if "ratelimit" in k_lower or "rate-limit" in k_lower:
                        rate_limits_collector[k_lower] = val
            self._consume_openai_stream(resp, message_id, reply_collector, usage_collector)
