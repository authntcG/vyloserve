import os
import socket
import psutil
from typing import Dict, Any, List, Optional, Tuple
from core.utils.system_utils import get_project_root

SYSTEM_PROTECTED_PROCESSES = {
    "system",
    "idle",
    "system idle process",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "winlogon.exe",
}

MSG_UNEXPECTED = "backend.error.unexpected"

class PortManager:
    """
    Manager untuk memindai port jaringan lokal (TCP/UDP) yang sedang aktif,
    mengasosiasikan proses (PID, executable, command line, memory usage),
    serta menghentikan (kill/terminate) proses yang menduduki port secara aman.
    """
    def __init__(self, api_ref):
        self.api = api_ref
        self.root_dir = get_project_root()
        self.bin_dir = os.path.realpath(os.path.join(self.root_dir, 'bin'))

    def _log(self, msg: str, level: str = "info", args: dict = None):
        if hasattr(self, 'api') and self.api:
            self.api.emit_log(msg, level, args)

    def _resolve_proc_info(self, pid: Optional[int], current_pid: int) -> tuple[str, str, str, float, bool, bool]:
        if pid is None or pid <= 4:
            return "System", "", "", 0.0, True, False

        if pid == current_pid:
            return "VyloServe", "", "", 0.0, True, True

        process_name = "Unknown"
        exe_path = ""
        cmdline = ""
        memory_mb = 0.0
        is_protected = False
        is_vylo_managed = False

        try:
            proc = psutil.Process(pid)
            process_name = proc.name() or "Unknown"
            try:
                exe_path = proc.exe() or ""
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                exe_path = ""
            try:
                cmd_list = proc.cmdline()
                cmdline = " ".join(cmd_list) if cmd_list else ""
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                cmdline = ""
            try:
                mem_info = proc.memory_info()
                memory_mb = round(mem_info.rss / (1024 * 1024), 1)
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                memory_mb = 0.0

            if process_name.lower() in SYSTEM_PROTECTED_PROCESSES:
                is_protected = True

            if exe_path:
                real_exe = os.path.realpath(exe_path)
                if real_exe.startswith(self.bin_dir) or real_exe.startswith(os.path.realpath(self.root_dir)):
                    is_vylo_managed = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

        return process_name, exe_path, cmdline, memory_mb, is_protected, is_vylo_managed

    def get_listening_ports(self) -> Dict[str, Any]:
        """
        Memindai semua socket TCP yang berstatus LISTEN dan port UDP aktif.
        Mengembalikan informasi port, protokol, IP lokal, PID, nama proses, path, dan status proteksi.
        """
        try:
            current_pid = os.getpid()
            connections = psutil.net_connections(kind='inet')
            results: List[Dict[str, Any]] = []
            seen_keys = set()

            for conn in connections:
                is_tcp_listen = conn.type == socket.SOCK_STREAM and conn.status == psutil.CONN_LISTEN
                is_udp = conn.type == socket.SOCK_DGRAM and conn.laddr and conn.laddr.port

                if not (is_tcp_listen or is_udp):
                    continue

                protocol = "TCP" if conn.type == socket.SOCK_STREAM else "UDP"
                port = conn.laddr.port
                ip = conn.laddr.ip if conn.laddr else "0.0.0.0"
                pid = conn.pid

                entry_key = (protocol, ip, port, pid)
                if entry_key in seen_keys:
                    continue
                seen_keys.add(entry_key)

                process_name, exe_path, cmdline, memory_mb, is_protected, is_vylo_managed = self._resolve_proc_info(pid, current_pid)

                results.append({
                    "id": f"{protocol}-{ip}-{port}-{pid or 'none'}-{len(results)}",
                    "port": port,
                    "protocol": protocol,
                    "local_address": ip,
                    "pid": pid,
                    "process_name": process_name,
                    "exe_path": exe_path,
                    "cmdline": cmdline,
                    "memory_mb": memory_mb,
                    "is_protected": is_protected,
                    "is_vylo_managed": is_vylo_managed
                })

            results.sort(key=lambda x: (x["port"], x["protocol"]))
            return {"status": "success", "data": results}
        except Exception as e:
            self._log(MSG_UNEXPECTED, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}

    def kill_process(self, pid: int, force: bool = False) -> Dict[str, Any]:
        """
        Menghentikan proses berdasarkan PID.
        Melindungi proses sistem krusial dan proses VyloServe sendiri.
        """
        if not isinstance(pid, int) or pid <= 4:
            return {"status": "error", "message": "backend.port_manager.invalid_pid", "args": {"pid": str(pid)}}

        current_pid = os.getpid()
        if pid == current_pid:
            return {"status": "error", "message": "backend.port_manager.cannot_kill_self"}

        try:
            proc = psutil.Process(pid)
            proc_name = proc.name() or "Unknown"

            if proc_name.lower() in SYSTEM_PROTECTED_PROCESSES:
                return {
                    "status": "error",
                    "message": "backend.port_manager.system_process_protected",
                    "args": {"name": proc_name, "pid": pid}
                }

            if force:
                proc.kill()
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=2.0)
                except psutil.TimeoutExpired:
                    proc.kill()

            self._log("backend.port_manager.killed_success", "info", {"name": proc_name, "pid": pid})
            return {
                "status": "success",
                "message": "backend.port_manager.killed_success",
                "args": {"name": proc_name, "pid": pid}
            }
        except psutil.NoSuchProcess:
            return {
                "status": "error",
                "message": "backend.port_manager.process_not_found",
                "args": {"pid": pid}
            }
        except psutil.AccessDenied:
            self._log("backend.port_manager.access_denied_admin", "error", {"pid": pid})
            return {
                "status": "error",
                "message": "backend.port_manager.access_denied_admin",
                "args": {"pid": pid}
            }
        except Exception as e:
            self._log(MSG_UNEXPECTED, "error", {"e": str(e)})
            return {"status": "error", "message": MSG_UNEXPECTED, "args": {"e": str(e)}}
