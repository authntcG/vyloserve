import os
import sys
import json
import pytest
from unittest.mock import MagicMock, patch, mock_open

from core.services.gitlab_manager import (
    GitLabManager,
    GLAB_EXE,
    DEFAULT_FALLBACK_VERSION,
    MSG_GLAB_INSTALL_SUCCESS,
    MSG_GLAB_INSTALL_CANCELLED,
    MSG_GLAB_INSTALL_FAILED,
    MSG_GLAB_UNINSTALL_SUCCESS,
    MSG_GLAB_NOT_INSTALLED,
    MSG_GLAB_AUTH_SUCCESS,
    MSG_GLAB_AUTH_FAILED,
    MSG_GLAB_LOGOUT_SUCCESS,
    MSG_GLAB_COMMENT_SUCCESS,
    MSG_GLAB_COMMENT_FAILED,
    MSG_GLAB_MR_COMMENT_SUCCESS,
    MSG_GLAB_ACTION_FAILED,
    MSG_GLAB_REPO_NOT_FOUND,
)
from core.utils.cancellation import InstallationManager, OperationCancelledError


@pytest.fixture
def mock_api():
    api = MagicMock()
    api.emit_log = MagicMock()
    api.emit_progress = MagicMock()
    return api


@pytest.fixture
def manager(mock_api, tmp_path):
    with patch("core.services.gitlab_manager.get_project_root", return_value=str(tmp_path)), \
         patch.object(GitLabManager, "_find_glab_config_file", return_value=None):
        mgr = GitLabManager(mock_api)
        yield mgr


def test_init_creates_directories(manager, tmp_path):
    assert not os.path.exists(manager.bin_dir)
    assert os.path.isdir(manager.data_dir)
    assert manager.config_path == os.path.join(str(tmp_path), "data", "gitlab.json")


def test_log_and_progress_emit(manager, mock_api):
    manager._log("backend.gitlab.test", "info", {"k": "v"})
    mock_api.emit_log.assert_called_once_with("backend.gitlab.test", "info", {"k": "v"})

    manager._progress(50, "backend.gitlab.test_progress", {"k": "v"})
    mock_api.emit_progress.assert_called_once_with(50, "backend.gitlab.test_progress", {"k": "v"})


def test_get_portable_binary_path_not_exists(manager):
    assert manager._get_portable_binary_path() is None


def test_get_portable_binary_path_exists(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("mock binary")

    res = manager._get_portable_binary_path()
    assert res is not None
    assert os.path.realpath(res).lower() == os.path.realpath(target).lower()


def test_find_via_where_windows(manager):
    with patch("core.services.gitlab_manager.sys.platform", "win32"), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="C:\\Program Files\\glab\\bin\\glab.exe\n")
        found = manager._find_via_where()
        assert found == "C:\\Program Files\\glab\\bin\\glab.exe"


def test_find_via_where_filters_vyloserve(manager):
    with patch("core.services.gitlab_manager.sys.platform", "win32"), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        vylo_path = os.path.join(manager.root_dir, "bin", "glab", "glab.exe")
        mock_run.return_value = MagicMock(returncode=0, stdout=f"{vylo_path}\n")
        found = manager._find_via_where()
        assert found is None


def test_find_via_which_linux(manager):
    with patch("core.services.gitlab_manager.sys.platform", "linux"), \
         patch("core.services.gitlab_manager.shutil.which", return_value="/usr/bin/glab"):
        found = manager._find_via_which()
        assert found == "/usr/bin/glab"


def test_find_via_which_filters_vyloserve(manager):
    with patch("core.services.gitlab_manager.sys.platform", "linux"), \
         patch("core.services.gitlab_manager.shutil.which", return_value=os.path.join(manager.root_dir, "bin", "glab", "glab")):
        found = manager._find_via_which()
        assert found is None


def test_get_glab_bin_prefers_portable(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    portable = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(portable, "w") as f:
        f.write("bin")

    with patch.object(manager, "_find_via_where", return_value="C:\\other\\glab.exe"):
        bin_path = manager.get_glab_bin()
        assert os.path.realpath(bin_path).lower() == os.path.realpath(portable).lower()


def test_get_glab_version_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="glab version 1.45.0 (2024-05-01)\n")
        ver = manager.get_glab_version(target)
        assert ver == "1.45.0"


def test_get_glab_version_failure(manager):
    assert manager.get_glab_version("non_existent_path") is None


def test_get_glab_status_not_installed(manager):
    with patch.object(manager, "get_glab_bin", return_value=None):
        status = manager.get_glab_status()
        assert status["installed"] is False
        assert status["version"] is None
        assert status["path"] is None
        assert status["authenticated"] is False


def test_get_glab_status_installed_and_authenticated(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch.object(manager, "get_glab_version", return_value="1.130.0"), \
         patch.object(manager, "_read_config", return_value={
             "default_host": "gitlab.com",
             "instances": {
                 "gitlab.com": {"token": "glpat-test", "username": "octocat"}
             }
         }):
        status = manager.get_glab_status()
        assert status["installed"] is True
        assert status["version"] == "1.130.0"
        assert status["is_external"] is False
        assert status["authenticated"] is True
        assert status["host"] == "gitlab.com"
        assert status["username"] == "octocat"


def test_resolve_download_url_from_api(manager):
    mock_response = [
        {
            "tag_name": "v1.130.0",
            "assets": {
                "links": [
                    {
                        "name": "glab_1.130.0_windows_amd64.zip",
                        "direct_asset_url": "https://gitlab.com/download/windows.zip",
                        "url": "https://gitlab.com/download/windows.zip"
                    },
                    {
                        "name": "glab_1.130.0_linux_amd64.tar.gz",
                        "direct_asset_url": "https://gitlab.com/download/linux.tar.gz",
                        "url": "https://gitlab.com/download/linux.tar.gz"
                    }
                ]
            }
        }
    ]

    with patch("core.services.gitlab_manager.urllib.request.urlopen") as mock_url:
        mock_url.return_value.__enter__.return_value.read.return_value = json.dumps(mock_response).encode("utf-8")
        with patch("core.services.gitlab_manager.sys.platform", "win32"):
            url, ver = manager._resolve_download_url()
            assert url == "https://gitlab.com/download/windows.zip"
            assert ver == "1.130.0"

        with patch("core.services.gitlab_manager.sys.platform", "linux"):
            url, ver = manager._resolve_download_url()
            assert url == "https://gitlab.com/download/linux.tar.gz"
            assert ver == "1.130.0"


def test_resolve_download_url_fallback(manager):
    with patch("core.services.gitlab_manager.urllib.request.urlopen", side_effect=Exception("Network down")):
        with patch("core.services.gitlab_manager.sys.platform", "win32"):
            url, ver = manager._resolve_download_url()
            assert ver == DEFAULT_FALLBACK_VERSION
            assert "windows_amd64.zip" in url


def test_get_available_gitlab_versions_success(manager):
    mock_response = [
        {
            "tag_name": "v1.130.0",
            "assets": {
                "links": [
                    {
                        "name": "glab_1.130.0_windows_amd64.zip",
                        "direct_asset_url": "https://gitlab.com/download/windows.zip",
                        "url": "https://gitlab.com/download/windows.zip",
                    }
                ]
            },
        },
        {
            "tag_name": "v1.129.0",
            "assets": {
                "links": [
                    {
                        "name": "glab_1.129.0_windows_amd64.zip",
                        "direct_asset_url": "https://gitlab.com/download/windows-129.zip",
                        "url": "https://gitlab.com/download/windows-129.zip",
                    }
                ]
            },
        },
    ]

    with patch("core.services.gitlab_manager.urllib.request.urlopen") as mock_url:
        mock_url.return_value.__enter__.return_value.read.return_value = json.dumps(mock_response).encode("utf-8")
        with patch("core.services.gitlab_manager.sys.platform", "win32"):
            res = manager.get_available_gitlab_versions()
            assert res["status"] == "success"
            assert len(res["data"]) == 2
            assert res["data"][0]["value"] == "1.130.0"
            assert "Latest Release" in res["data"][0]["label"]
            assert res["data"][1]["value"] == "1.129.0"


def test_get_available_gitlab_versions_network_error(manager):
    import urllib.error
    with patch("core.services.gitlab_manager.urllib.request.urlopen", side_effect=urllib.error.URLError("DNS lookup failed")):
        with patch("core.services.gitlab_manager.sys.platform", "win32"):
            res = manager.get_available_gitlab_versions()
            assert res["status"] == "error"
            assert res.get("is_offline") is True
            assert len(res["data"]) == 1
            assert res["data"][0]["value"] == DEFAULT_FALLBACK_VERSION


def test_install_glab_success(manager, tmp_path):
    def fake_extract(archive_path, extract_to, cancel_check=None):
        bin_sub = os.path.join(extract_to, "bin")
        os.makedirs(bin_sub, exist_ok=True)
        with open(os.path.join(bin_sub, GLAB_EXE), "w") as f:
            f.write("mock binary content")
        return True

    with patch.object(manager, "_resolve_download_url", return_value=("https://example.com/glab.zip", "1.130.0")), \
         patch("core.services.gitlab_manager.download_advanced", return_value=True), \
         patch("core.services.gitlab_manager.extract_archive", side_effect=fake_extract), \
         patch.object(manager, "get_glab_version", return_value="1.130.0"):

        res = manager.install_glab()
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_INSTALL_SUCCESS
        assert res["args"]["version"] == "1.130.0"
        assert os.path.isfile(os.path.join(manager.bin_dir, GLAB_EXE))


def test_install_glab_download_progress_callback(manager):
    def fake_download(url, dest, progress_cb=None, **kwargs):
        if progress_cb:
            progress_cb(50, "backend.runtimes.downloading_multipart", {"percent": 50})
        return True

    def fake_extract(archive_path, extract_to, **kwargs):
        bin_sub = os.path.join(extract_to, "bin")
        os.makedirs(bin_sub, exist_ok=True)
        with open(os.path.join(bin_sub, GLAB_EXE), "w") as f:
            f.write("mock binary content")
        return True

    with patch.object(manager, "_resolve_download_url", return_value=("https://example.com/glab.zip", "1.130.0")), \
         patch("core.services.gitlab_manager.download_advanced", side_effect=fake_download), \
         patch("core.services.gitlab_manager.extract_archive", side_effect=fake_extract), \
         patch.object(manager, "get_glab_version", return_value="1.130.0"):

        res = manager.install_glab()
        assert res["status"] == "success"


def test_install_glab_cancelled(manager):
    with patch.object(manager, "_resolve_download_url", return_value=("https://example.com/glab.zip", "1.130.0")), \
         patch("core.services.gitlab_manager.download_advanced", side_effect=OperationCancelledError("User cancelled")):

        res = manager.install_glab()
        assert res["status"] == "cancelled"
        assert res["message"] == MSG_GLAB_INSTALL_CANCELLED


def test_install_glab_failed(manager):
    with patch.object(manager, "_resolve_download_url", side_effect=RuntimeError("Download server down")):
        res = manager.install_glab()
        assert res["status"] == "error"
        assert res["message"] == MSG_GLAB_INSTALL_FAILED
        assert "Download server down" in res["args"]["e"]


def test_cancel_glab_install(manager):
    with patch("core.services.gitlab_manager.InstallationManager.cancel", return_value=True):
        res = manager.cancel_glab_install()
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_INSTALL_CANCELLED


def test_uninstall_glab_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    res = manager.uninstall_glab()
    assert res["status"] == "success"
    assert res["message"] == MSG_GLAB_UNINSTALL_SUCCESS
    assert not os.path.exists(target)


def test_uninstall_glab_not_installed(manager):
    res = manager.uninstall_glab()
    assert res["status"] == "error"
    assert res["message"] == MSG_GLAB_NOT_INSTALLED


def test_authenticate_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch.object(manager, "_verify_gitlab_token_via_api", return_value=({"username": "testuser", "name": "testuser"}, None)), \
         patch("core.services.git_manager.GitManager._store_git_credential"), \
         patch("core.services.git_manager.GitManager.set_git_config"), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="✓ Logged in to gitlab.com as testuser (via environment)\n", stderr="")

        res = manager.authenticate("https://gitlab.com", "glpat-secret123")
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_AUTH_SUCCESS
        assert res["args"]["user"] == "testuser"
        assert res["args"]["host"] == "gitlab.com"

        # Verifikasi bahwa token tersimpan di config dan proses env terisolasi
        cfg = manager._read_config()
        assert cfg["instances"]["gitlab.com"]["token"] == "glpat-secret123"
        assert cfg["instances"]["gitlab.com"]["username"] == "testuser"


def test_authenticate_failed(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch.object(manager, "_verify_gitlab_token_via_api", return_value=(None, "x Invalid personal access token")), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="x Invalid personal access token\n")

        res = manager.authenticate("gitlab.com", "bad-token")
        assert res["status"] == "error"
        assert res["message"] == MSG_GLAB_AUTH_FAILED


def test_logout(manager):
    manager._write_config({
        "default_host": "gitlab.com",
        "instances": {
            "gitlab.com": {"token": "glpat-123", "username": "user1"},
            "gitlab.internal.co": {"token": "glpat-456", "username": "user2"}
        }
    })

    res = manager.logout("gitlab.com")
    assert res["status"] == "success"
    assert res["message"] == MSG_GLAB_LOGOUT_SUCCESS

    cfg = manager._read_config()
    assert "gitlab.com" not in cfg["instances"]
    assert cfg["default_host"] == "gitlab.internal.co"


def test_detect_project_gitlab_remote_ssh(manager, tmp_path):
    proj_dir = str(tmp_path / "repo")
    os.makedirs(proj_dir, exist_ok=True)

    with patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="git@gitlab.com:vyloteam/vyloserve.git\n")
        res = manager.detect_project_gitlab_remote(proj_dir)
        assert res["is_gitlab"] is True
        assert res["host"] == "gitlab.com"
        assert res["repo"] == "vyloteam/vyloserve"


def test_detect_project_gitlab_remote_http(manager, tmp_path):
    proj_dir = str(tmp_path / "repo")
    os.makedirs(proj_dir, exist_ok=True)

    with patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="https://gitlab.example.org/group/project.git\n")
        res = manager.detect_project_gitlab_remote(proj_dir)
        assert res["is_gitlab"] is True
        assert res["host"] == "gitlab.example.org"
        assert res["repo"] == "group/project"


def test_get_issue_context(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="Issue #42 Title\nDescription\nComments...", stderr="")
        res = manager.get_issue_context("vyloteam/vyloserve", "42")
        assert res["status"] == "success"
        assert res["issue_id"] == "42"
        assert "Issue #42 Title" in res["content"]


def test_get_recent_issues(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    stdout_sample = "#101 Memory leak in server runtime\n#102 Fix dark mode contrast\n"
    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=stdout_sample, stderr="")
        res = manager.get_recent_issues("vyloteam/vyloserve", limit=5)
        assert res["status"] == "success"
        assert len(res["issues"]) == 2
        assert res["issues"][0]["id"] == "101"
        assert res["issues"][0]["title"] == "Memory leak in server runtime"


def test_comment_issue_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="https://gitlab.com/vyloteam/vyloserve/-/issues/42#note_1234\n",
            stderr="",
        )
        res = manager.comment_issue("vyloteam/vyloserve", "42", "Fix implemented.")
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_COMMENT_SUCCESS
        assert res["args"]["id"] == "42"
        assert res["web_url"] == "https://gitlab.com/vyloteam/vyloserve/-/issues/42#note_1234"


def test_comment_mr_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="MR note created\n", stderr="")
        res = manager.comment_mr("vyloteam/vyloserve", "15", "Approved changes.")
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_MR_COMMENT_SUCCESS


def test_execute_action_router(manager):
    with patch.object(manager, "comment_issue", return_value={"status": "success"}) as mock_issue, \
         patch.object(manager, "comment_mr", return_value={"status": "success"}) as mock_mr:

        # Test no repo
        res = manager.execute_action("comment_issue", "", "42", {"comment": "test"})
        assert res["status"] == "error"
        assert res["message"] == MSG_GLAB_REPO_NOT_FOUND

        # Test comment_issue
        manager.execute_action("comment_issue", "my/repo", "42", {"comment": "test"})
        mock_issue.assert_called_once_with("my/repo", "42", "test")

        # Test comment_mr
        manager.execute_action("comment_mr", "my/repo", "15", {"comment": "test"})
        mock_mr.assert_called_once_with("my/repo", "15", "test")

        # Test unsupported action
        res = manager.execute_action("unknown_action", "my/repo", "1", {})
        assert res["status"] == "error"
        assert res["message"] == MSG_GLAB_ACTION_FAILED


# ==========================================
# Unit tests for GitLab Multi-Mode Auth & Accounts
# ==========================================

def test_toggle_user_path(manager):
    with patch("core.services.gitlab_manager.modify_user_path", return_value=True) as mock_modify:
        res = manager.toggle_user_path(True)
        assert res["status"] == "success"
        mock_modify.assert_called_once_with(add_paths=[manager.bin_dir], remove_paths=None, auto_broadcast=True)

    with patch("core.services.gitlab_manager.modify_user_path", return_value=True) as mock_modify:
        res = manager.toggle_user_path(False)
        assert res["status"] == "success"
        mock_modify.assert_called_once_with(add_paths=None, remove_paths=[manager.bin_dir], auto_broadcast=True)

    with patch("core.services.gitlab_manager.modify_user_path", side_effect=Exception("Registry error")):
        res = manager.toggle_user_path(True)
        assert res["status"] == "error"
        assert res["message"] == "backend.gitlab.registry_error"


def test_authenticate_ssh_mode_success(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="Welcome to GitLab, @john_ssh!",
            stderr=""
        )
        res = manager.authenticate(
            host="gitlab.company.com",
            token="",
            auth_type="ssh",
            git_protocol="ssh",
            git_name="John SSH",
            git_email="john@company.com",
            sync_git_config=True,
        )
        assert res["status"] == "success"
        assert res["args"]["user"] == "john_ssh"
        assert res["args"]["host"] == "gitlab.company.com"


def test_authenticate_ssh_mode_missing_key(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch("core.services.gitlab_manager.os.path.exists", return_value=False):
        res = manager.authenticate(
            host="gitlab.com",
            token="",
            auth_type="ssh",
            ssh_key_path="C:\\nonexistent\\key",
        )
        assert res["status"] == "error"
        assert res["message"] == "backend.gitlab.ssh_key_not_found"


def test_authenticate_pat_with_user_api(manager):
    os.makedirs(manager.bin_dir, exist_ok=True)
    target = os.path.join(manager.bin_dir, GLAB_EXE)
    with open(target, "w") as f:
        f.write("bin")

    fake_user = {"username": "pat_user", "name": "Pat Developer", "commit_email": "pat@dev.org"}
    mock_run = MagicMock(returncode=0, stdout="", stderr="")

    with patch.object(manager, "get_glab_bin", return_value=target), \
         patch.object(manager, "_verify_gitlab_token_via_api", return_value=(fake_user, None)), \
         patch("core.services.gitlab_manager.subprocess.run", return_value=mock_run), \
         patch("core.services.git_manager.GitManager._store_git_credential") as mock_store_cred, \
         patch("core.services.git_manager.GitManager.set_git_config"):

        res = manager.authenticate(
            host="gitlab.com",
            token="glpat-validsecrettoken123",
            auth_type="pat",
            sync_git_config=True,
        )
        assert res["status"] == "success"
        assert res["args"]["user"] == "pat_user"
        mock_store_cred.assert_called_once_with("https", "gitlab.com", "pat_user", "glpat-validsecrettoken123")


def test_get_gitlab_accounts(manager):
    mock_config = {
        "default_host": "gitlab.com",
        "default_account_id": "acc-gitlab-1",
        "accounts": [
            {
                "id": "acc-gitlab-1",
                "host": "gitlab.com",
                "username": "janedoe",
                "git_name": "Jane Doe",
                "git_email": "jane@doe.org",
                "auth_type": "pat",
                "git_protocol": "https",
                "token": "glpat-supersecrettoken12345",
            }
        ],
        "instances": {}
    }
    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch("core.services.git_manager.GitManager.get_git_config", return_value={"status": "success", "data": {"name": "Jane Doe", "email": "jane@doe.org"}}):
        res = manager.get_gitlab_accounts()
        assert res["status"] == "success"
        assert len(res["accounts"]) == 1
        acc = res["accounts"][0]
        assert acc["id"] == "acc-gitlab-1"
        assert acc["is_default"] is True
        assert acc["is_push_active"] is True
        assert acc["has_token"] is True
        assert acc["masked_token"] == "••••••••"
        assert "token" not in acc  # raw token must not leak


def test_set_default_gitlab_account(manager):
    mock_config = {
        "default_host": "gitlab.com",
        "default_account_id": "acc-1",
        "accounts": [
            {
                "id": "acc-1",
                "host": "gitlab.com",
                "username": "user1",
                "git_name": "User One",
                "git_email": "user1@dev.org",
                "token": "tok1"
            },
            {
                "id": "acc-2",
                "host": "self-hosted.internal",
                "username": "user2",
                "git_name": "User Two",
                "git_email": "user2@internal.org",
                "token": "tok2"
            }
        ],
        "instances": {}
    }
    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch.object(manager, "_write_config") as mock_write, \
         patch("core.services.git_manager.GitManager.set_git_config") as mock_set_git:
        
        res = manager.set_default_gitlab_account("acc-2", sync_git_config=True)
        assert res["status"] == "success"
        assert res["message"] == "backend.gitlab.account_switched"
        assert mock_write.call_args[0][0]["default_account_id"] == "acc-2"
        assert mock_write.call_args[0][0]["default_host"] == "self-hosted.internal"
        mock_set_git.assert_called_once_with("User Two", "user2@internal.org")

        # Non-existent
        res_err = manager.set_default_gitlab_account("acc-none")
        assert res_err["status"] == "error"
        assert res_err["message"] == "backend.gitlab.account_not_found"


def test_remove_gitlab_account(manager):
    mock_config = {
        "default_host": "gitlab.com",
        "default_account_id": "acc-1",
        "accounts": [
            {
                "id": "acc-1",
                "host": "gitlab.com",
                "username": "user1",
                "token": "tok1"
            },
            {
                "id": "acc-2",
                "host": "gitlab.com",
                "username": "user2",
                "token": "tok2"
            }
        ],
        "instances": {
            "gitlab.com": {"token": "tok1", "username": "user1"}
        }
    }
    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch.object(manager, "_write_config") as mock_write, \
         patch("core.services.git_manager.GitManager._delete_git_credential") as mock_del_cred:
        
        # Remove acc-1
        res = manager.remove_gitlab_account("acc-1")
        assert res["status"] == "success"
        assert res["message"] == MSG_GLAB_LOGOUT_SUCCESS
        saved = mock_write.call_args[0][0]
        assert len(saved["accounts"]) == 1
        assert saved["accounts"][0]["id"] == "acc-2"
        assert saved["default_account_id"] == "acc-2"
        assert saved["instances"]["gitlab.com"]["username"] == "user2"
        mock_del_cred.assert_called_once_with("https", "gitlab.com", "user1")

        # Non-existent
        res_err = manager.remove_gitlab_account("acc-999")
        assert res_err["status"] == "error"
        assert res_err["message"] == "backend.gitlab.account_not_found"


def test_get_account_projects_empty_accounts(manager):
    with patch.object(manager, "_read_config", return_value={"accounts": []}):
        res = manager.get_account_projects("nonexistent")
        assert res["status"] == "success"
        assert res["data"]["projects"] == []


def test_get_account_projects_remote_and_local(manager, tmp_path):
    mock_acc = {
        "id": "acc-gitlab-1",
        "host": "gitlab.com",
        "username": "janedoe",
        "token": "glpat-tok",
        "auth_type": "pat",
    }
    mock_config = {
        "accounts": [mock_acc],
        "default_account_id": "acc-gitlab-1",
    }

    # Setup local www directory with a matching repo
    www_dir = tmp_path / "www"
    repo_dir = www_dir / "my-web-app"
    git_dir = repo_dir / ".git"
    git_dir.mkdir(parents=True)
    cfg_file = git_dir / "config"
    cfg_file.write_text("[remote \"origin\"]\n\turl = https://gitlab.com/janedoe/local-app.git\n", encoding="utf-8")

    api_response = [
        {
            "id": 101,
            "name": "remote-app",
            "path_with_namespace": "janedoe/remote-app",
            "visibility": "public",
            "web_url": "https://gitlab.com/janedoe/remote-app",
            "ssh_url_to_repo": "git@gitlab.com:janedoe/remote-app.git",
            "http_url_to_repo": "https://gitlab.com/janedoe/remote-app.git",
            "default_branch": "main",
            "last_activity_at": "2026-11-13T10:00:00Z",
        }
    ]
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps(api_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch.object(manager, "root_dir", str(tmp_path)), \
         patch("urllib.request.urlopen", return_value=mock_resp):

        res = manager.get_account_projects("acc-gitlab-1")
        assert res["status"] == "success"
        projects = res["data"]["projects"]
        assert len(projects) == 2
        # Remote project
        assert projects[0]["id"] == "101"
        assert projects[0]["source"] == "remote"
        assert projects[0]["visibility"] == "public"
        # Local project
        assert projects[1]["id"] == "local_my-web-app"
        assert projects[1]["source"] == "local"
        assert projects[1]["full_name"] == "janedoe/local-app"


def test_gitlab_mask_token_constant(manager):
    assert manager._mask_token("glpat-abcdef1234567890") == "••••••••"
    assert manager._mask_token("") == ""


def test_get_gitlab_accounts_vpn_probing(manager):
    mock_config = {
        "default_host": "git.neuron.id",
        "default_account_id": "acc-vpn",
        "accounts": [
            {
                "id": "acc-vpn",
                "host": "git.neuron.id",
                "username": "galih",
                "git_name": "Galih Respati",
                "git_email": "galih@neuron.id",
                "auth_type": "pat",
                "requires_vpn": True,
            }
        ],
    }
    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch("core.services.gitlab_manager.check_host_reachability", return_value={"reachable": False, "host": "git.neuron.id"}):
        res = manager.get_gitlab_accounts()
        assert res["status"] == "success"
        acc = res["accounts"][0]
        assert acc["requires_vpn"] is True
        assert acc["vpn_reachable"] is False


def test_get_recent_issues_vpn_unreachable_short_circuit(manager):
    mock_config = {
        "default_host": "git.neuron.id",
        "default_account_id": "acc-vpn",
        "accounts": [{"id": "acc-vpn", "host": "git.neuron.id", "requires_vpn": True}],
    }
    with patch.object(manager, "get_glab_bin", return_value="C:\\dummy\\glab.exe"), \
         patch.object(manager, "_read_config", return_value=mock_config), \
         patch("core.services.gitlab_manager.check_host_reachability", return_value={"reachable": False, "host": "git.neuron.id"}), \
         patch("subprocess.run") as mock_sub:
        res = manager.get_recent_issues()
        assert res["status"] == "success"
        assert res["vpn_blocked"] is True
        assert res["vpn_host"] == "git.neuron.id"
        assert res["issues"] == []
        mock_sub.assert_not_called()


def test_get_account_projects_vpn_unreachable_short_circuit(manager, tmp_path):
    mock_acc = {
        "id": "acc-vpn",
        "host": "git.neuron.id",
        "username": "galih",
        "requires_vpn": True,
        "token": "glpat-token",
    }
    mock_config = {"accounts": [mock_acc], "default_account_id": "acc-vpn"}

    # Siapkan repo lokal di www/corp-service
    www_dir = tmp_path / "www"
    www_dir.mkdir(parents=True, exist_ok=True)
    git_dir = www_dir / "corp-service" / ".git"
    git_dir.mkdir(parents=True, exist_ok=True)
    (git_dir / "config").write_text('[remote "origin"]\n\turl = https://git.neuron.id/corp/corp-service.git\n')

    with patch.object(manager, "_read_config", return_value=mock_config), \
         patch.object(manager, "root_dir", str(tmp_path)), \
         patch("core.services.gitlab_manager.check_host_reachability", return_value={"reachable": False, "host": "git.neuron.id"}), \
         patch("urllib.request.urlopen") as mock_url:
        res = manager.get_account_projects("acc-vpn")
        assert res["status"] == "success"
        data = res["data"]
        assert data["vpn_blocked"] is True
        assert data["vpn_host"] == "git.neuron.id"
        mock_url.assert_not_called()
        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "corp-service"
        assert data["projects"][0]["source"] == "local"


def test_migrate_legacy_glab_config(manager):
    glab_yml_data = {
        "host": "git.neuron.id",
        "hosts": {
            "git.neuron.id": {
                "user": "galih",
                "git_protocol": "https",
                "use_keyring": "true",
            }
        }
    }
    init_cfg = {"accounts": [], "default_host": "gitlab.com", "default_account_id": ""}
    with patch.object(manager, "_parse_glab_config_yml", return_value=glab_yml_data), \
         patch.object(manager, "_write_config") as mock_write:
        cfg = manager._migrate_legacy_glab_config(init_cfg)
        assert len(cfg["accounts"]) == 1
        acc = cfg["accounts"][0]
        assert acc["host"] == "git.neuron.id"
        assert acc["username"] == "galih"
        assert acc["requires_vpn"] is True
        assert acc["use_keyring"] is True
        assert cfg["default_account_id"] == "git.neuron.id_galih"
        mock_write.assert_called_once()


def test_read_git_remote_url_variants(tmp_path):
    from core.services.gitlab_manager import GitLabManager

    cfg = tmp_path / "config"
    cfg.write_text('[remote "origin"]\n\turl = git@gitlab.com:team/project.git\n')
    assert GitLabManager._read_git_remote_url(str(cfg)) == "git@gitlab.com:team/project.git"

    # File without url
    cfg_empty = tmp_path / "config_empty"
    cfg_empty.write_text('[core]\n\trepositoryformatversion = 0\n')
    assert GitLabManager._read_git_remote_url(str(cfg_empty)) is None

    # Non-existent file
    assert GitLabManager._read_git_remote_url(str(tmp_path / "missing")) is None


def test_inspect_local_www_entry_for_gitlab_cases(tmp_path):
    from core.services.gitlab_manager import GitLabManager

    www_dir = tmp_path / "www"
    www_dir.mkdir()

    # Case 1: no .git/config
    p_no_git = www_dir / "no_git"
    p_no_git.mkdir()
    res = GitLabManager._inspect_local_www_entry_for_gitlab("no_git", str(www_dir), "gitlab.com", "acc_1", set())
    assert res is None

    # Case 2: matched gitlab repo
    p_gl = www_dir / "my_app"
    git_dir = p_gl / ".git"
    git_dir.mkdir(parents=True)
    (git_dir / "config").write_text('[remote "origin"]\n\turl = git@gitlab.com:mygroup/my_app.git\n')

    res_success = GitLabManager._inspect_local_www_entry_for_gitlab("my_app", str(www_dir), "gitlab.com", "acc_1", set())
    assert res_success is not None
    assert res_success["name"] == "my_app"
    assert res_success["full_name"] == "mygroup/my_app"
    assert res_success["ssh_url"] == "git@gitlab.com:mygroup/my_app.git"

    # Case 3: already in seen_keys
    res_seen = GitLabManager._inspect_local_www_entry_for_gitlab("my_app", str(www_dir), "gitlab.com", "acc_1", {"mygroup/my_app"})
    assert res_seen is None

    # Case 4: different host
    res_diff = GitLabManager._inspect_local_www_entry_for_gitlab("my_app", str(www_dir), "github.com", "acc_1", set())
    assert res_diff is None


