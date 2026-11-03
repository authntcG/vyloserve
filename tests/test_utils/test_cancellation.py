import pytest
from unittest.mock import MagicMock, patch
import psutil
from core.utils.cancellation import (
    CancellationToken,
    InstallationManager,
    OperationCancelledError
)

class TestCancellationToken:
    def test_initial_state_not_cancelled(self):
        token = CancellationToken("apache")
        assert token.module == "apache"
        assert not token.is_cancelled()

    def test_cancel_triggers_event(self):
        token = CancellationToken("php")
        token.cancel()
        assert token.is_cancelled()

    def test_register_and_unregister_pid(self):
        token = CancellationToken("database")
        token.register_pid(1234)
        assert 1234 in token._active_pids
        token.unregister_pid(1234)
        assert 1234 not in token._active_pids

    def test_register_none_or_zero_pid_ignored(self):
        token = CancellationToken("test")
        token.register_pid(0)
        token.register_pid(None) # type: ignore
        assert len(token._active_pids) == 0

    @patch("core.utils.cancellation.psutil.wait_procs")
    @patch("core.utils.cancellation.psutil.Process")
    def test_kill_active_processes(self, mock_process_cls, mock_wait_procs):
        mock_parent = MagicMock()
        mock_child = MagicMock()
        mock_parent.children.return_value = [mock_child]
        mock_process_cls.return_value = mock_parent

        token = CancellationToken("node")
        token.register_pid(9999)
        token.cancel()

        mock_process_cls.assert_called_with(9999)
        mock_child.kill.assert_called_once()
        mock_parent.kill.assert_called_once()
        mock_wait_procs.assert_called_once()
        assert 9999 not in token._active_pids

    @patch("core.utils.cancellation.psutil.Process")
    def test_kill_processes_handles_psutil_error(self, mock_process_cls):
        mock_process_cls.side_effect = psutil.NoSuchProcess(pid=8888)
        token = CancellationToken("python")
        token.register_pid(8888)
        # Should not raise exception
        token.kill_active_processes()
        assert 8888 not in token._active_pids


class TestInstallationManager:
    def setup_method(self):
        InstallationManager.reset_all()

    def teardown_method(self):
        InstallationManager.reset_all()

    def test_get_token_creates_and_caches(self):
        t1 = InstallationManager.get_token("apache")
        t2 = InstallationManager.get_token("apache")
        assert t1 is t2
        assert not t1.is_cancelled()

    def test_cancel_active_module(self):
        t1 = InstallationManager.get_token("database")
        success = InstallationManager.cancel("database")
        assert success is True
        assert t1.is_cancelled()
        assert InstallationManager.is_cancelled("database") is True

    def test_cancel_already_cancelled_or_absent_returns_false(self):
        assert InstallationManager.cancel("nonexistent") is False
        InstallationManager.get_token("git")
        assert InstallationManager.cancel("git") is True
        assert InstallationManager.cancel("git") is False

    def test_get_token_after_cancelled_returns_fresh_token(self):
        t_cancelled = InstallationManager.get_token("php")
        InstallationManager.cancel("php")
        assert t_cancelled.is_cancelled()

        InstallationManager.reset("php")
        t_fresh = InstallationManager.get_token("php")
        assert t_fresh is not t_cancelled
        assert not t_fresh.is_cancelled()

    def test_create_token_replaces_existing(self):
        t1 = InstallationManager.get_token("php")
        t2 = InstallationManager.create_token("php")
        assert t2 is not t1
        assert not t2.is_cancelled()

    def test_reset_module(self):
        InstallationManager.get_token("runtimes")
        InstallationManager.reset("runtimes")
        assert "runtimes" not in InstallationManager._tokens

    def test_is_cancelled_for_absent_module(self):
        assert InstallationManager.is_cancelled("unknown") is False
