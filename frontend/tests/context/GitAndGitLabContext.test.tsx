import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { GitProvider, useGit } from '../../src/context/GitContext';
import { GitLabProvider, useGitLab } from '../../src/context/GitLabContext';
import { ToastProvider } from '../../src/context/ToastContext';
import { AlertProvider } from '../../src/context/AlertContext';
import { mockPywebviewApi, resetPywebviewApi } from '../test-utils';

// Sediakan mock AlertContext agar confirm() segera resolve(true) tanpa UI dialog
vi.mock('../../src/context/AlertContext', async () => {
    const actual = await vi.importActual('../../src/context/AlertContext');
    return {
        ...actual,
        useAlert: () => ({
            alert: vi.fn().mockResolvedValue(undefined),
            confirm: vi.fn().mockResolvedValue(true),
        }),
    };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>
        <AlertProvider>
            {children}
        </AlertProvider>
    </ToastProvider>
);

describe('GitContext and GitLabContext deep test suite', () => {
    let mockApi: ReturnType<typeof mockPywebviewApi>;

    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
            writable: true,
            configurable: true,
        });

        mockApi = mockPywebviewApi({
            get_git_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '2.44.0',
                in_path: true,
                external: { exists: false, path: '', version: '' }
            }),
            get_git_config: vi.fn().mockResolvedValue({
                status: 'success',
                data: { name: 'Git User', email: 'user@example.com' }
            }),
            get_available_git_versions: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version_text: '2.45.0', url: 'https://git.test/dl' }]
            }),
            get_git_accounts: vi.fn().mockResolvedValue({
                status: 'success',
                accounts: [
                    { id: 'acc_1', label: 'Primary', username: 'dev', is_default: true, requires_vpn: false }
                ]
            }),
            get_ssh_keys: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ filename: 'id_ed25519', path: '/path/key', type: 'ed25519', public_key: 'ssh-ed25519 AAA' }]
            }),
            get_git_account_projects: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    projects: [
                        { id: 'p1', name: 'proj1', full_name: 'dev/proj1', web_url: 'https://github.com/dev/proj1' }
                    ],
                    auth_warning: false,
                    vpn_blocked: false,
                    account_id: 'acc_1',
                }
            }),
            toggle_git_path: vi.fn().mockResolvedValue({ status: 'success' }),
            set_git_config: vi.fn().mockResolvedValue({ status: 'success' }),
            save_git_account: vi.fn().mockResolvedValue({ status: 'success' }),
            delete_git_account: vi.fn().mockResolvedValue({ status: 'success' }),
            set_default_git_account: vi.fn().mockResolvedValue({ status: 'success' }),
            install_git: vi.fn().mockResolvedValue({ status: 'success' }),
            cancel_installation: vi.fn().mockResolvedValue({ status: 'success' }),
            uninstall_git: vi.fn().mockResolvedValue({ status: 'success' }),

            // GitLab mock methods
            get_gitlab_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '1.130.0',
                path: 'C:/glab/glab.exe',
                is_external: false,
                authenticated: true,
                host: 'gitlab.com',
                username: 'gldev'
            }),
            get_available_gitlab_versions: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version_text: '1.131.0', filename: 'glab.zip' }]
            }),
            get_gitlab_accounts: vi.fn().mockResolvedValue({
                status: 'success',
                accounts: [
                    { id: 'gl_1', host: 'gitlab.com', username: 'gldev', is_default: true }
                ]
            }),
            get_gitlab_recent_issues: vi.fn().mockResolvedValue({
                status: 'success',
                issues: [{ id: 'iss_1', title: 'Test Issue' }],
                vpn_blocked: false
            }),
            get_gitlab_account_projects: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    projects: [
                        { id: 'gl_p1', name: 'glproj', full_name: 'group/glproj', web_url: 'https://gitlab.com/group/glproj' }
                    ],
                    vpn_blocked: false,
                    account_id: 'gl_1',
                }
            }),
            toggle_gitlab_path: vi.fn().mockResolvedValue({ status: 'success' }),
            authenticate_gitlab: vi.fn().mockResolvedValue({ status: 'success' }),
            remove_gitlab_account: vi.fn().mockResolvedValue({ status: 'success' }),
            set_default_gitlab_account: vi.fn().mockResolvedValue({ status: 'success' }),
            install_gitlab_cli: vi.fn().mockResolvedValue({ status: 'success' }),
            cancel_gitlab_install: vi.fn().mockResolvedValue({ status: 'success' }),
            uninstall_gitlab_cli: vi.fn().mockResolvedValue({ status: 'success' }),
            open_browser: vi.fn(),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    describe('GitContext full coverage', () => {
        it('handles fetchStatus and updates data and config', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            await act(async () => {
                await result.current.fetchStatus();
            });

            expect(result.current.gitData.installed).toBe(true);
            expect(result.current.gitData.version).toBe('2.44.0');
            expect(result.current.configData.userName).toBe('Git User');
            expect(result.current.configData.userEmail).toBe('user@example.com');
        });

        it('handles fetchAccounts, fetchSshKeys, and fetchProjects', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            await act(async () => {
                await result.current.fetchAccounts();
                await result.current.fetchSshKeys();
                await result.current.fetchProjects('acc_1');
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.sshKeys).toHaveLength(1);
            expect(result.current.projects).toHaveLength(1);
        });

        it('handles handleTogglePath, handleSaveConfig, and account management', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            await act(async () => {
                await result.current.handleTogglePath(false);
                await result.current.handleSaveConfig();
                await result.current.handleSaveAccount({ id: 'acc_1', username: 'dev' });
                await result.current.handleSetDefaultAccount('acc_1');
                await result.current.handleDeleteAccount('acc_1');
            });

            expect(mockApi.toggle_git_path).toHaveBeenCalledWith(false);
            expect(mockApi.set_git_config).toHaveBeenCalled();
            expect(mockApi.save_git_account).toHaveBeenCalled();
            expect(mockApi.set_default_git_account).toHaveBeenCalledWith('acc_1');
            expect(mockApi.delete_git_account).toHaveBeenCalledWith('acc_1');
        });

        it('handles vylo_progress events properly', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            act(() => {
                window.dispatchEvent(new CustomEvent('vylo_progress', {
                    detail: { source: 'GitManager', percent: 45, text: 'Downloading Git...' }
                }));
            });

            expect(result.current.progress).toBe(45);
            expect(result.current.progressText).toBe('Downloading Git...');

            // Other sources should be ignored
            act(() => {
                window.dispatchEvent(new CustomEvent('vylo_progress', {
                    detail: { source: 'OtherManager', percent: 90, text: 'Ignored' }
                }));
            });
            expect(result.current.progress).toBe(45);
        });

        it('handles handleOpenProjectInBrowser', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            await act(async () => {
                await result.current.handleOpenProjectInBrowser('https://github.com/test/repo');
            });

            expect(mockApi.open_browser).toHaveBeenCalledWith('https://github.com/test/repo');
        });

        it('handles handleCancelInstall and executeUninstall', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            await act(async () => {
                await result.current.handleCancelInstall();
                await result.current.executeUninstall();
            });

            expect(mockApi.cancel_installation).toHaveBeenCalled();
            expect(mockApi.uninstall_git).toHaveBeenCalled();
        });

        it('handles handleInstallSubmit and handleUpdateClick', async () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });

            // handleInstallSubmit without ref
            await act(async () => {
                await result.current.handleInstallSubmit();
            });

            // handleInstallSubmit with mock ref
            result.current.gitRef.current = {
                submit: vi.fn().mockResolvedValue(true)
            } as any;

            await act(async () => {
                await result.current.handleInstallSubmit();
            });

            expect(result.current.gitRef.current?.submit).toHaveBeenCalled();

            // handleUpdateClick
            mockApi.install_git = vi.fn().mockResolvedValue({ status: 'success' });
            await act(async () => {
                await result.current.handleUpdateClick({
                    value: 'https://github.com/git-for-windows/git/releases/download/v2.41.0/Git-2.41.0-64-bit.exe',
                    filename: 'Git-2.41.0-64-bit.exe',
                    version_text: '2.41.0'
                } as any);
            });

            expect(mockApi.install_git).toHaveBeenCalledWith(
                'https://github.com/git-for-windows/git/releases/download/v2.41.0/Git-2.41.0-64-bit.exe',
                'Git-2.41.0-64-bit.exe',
                '2.41.0'
            );
        });
    });

    describe('GitLabContext full coverage', () => {
        it('throws when used outside GitLabProvider', () => {
            expect(() => renderHook(() => useGitLab())).toThrow('useGitLab must be used within a GitLabProvider');
        });

        it('handles fetchStatus and updates data', async () => {
            const { result } = renderHook(() => useGitLab(), {
                wrapper: ({ children }) => wrapper({ children: <GitLabProvider>{children}</GitLabProvider> })
            });

            await act(async () => {
                await result.current.fetchStatus();
            });

            expect(result.current.statusData.installed).toBe(true);
            expect(result.current.statusData.version).toBe('1.130.0');
            expect(result.current.statusData.authenticated).toBe(true);
        });

        it('handles fetchAccounts, fetchSshKeys, fetchRecentIssues, and fetchProjects', async () => {
            const { result } = renderHook(() => useGitLab(), {
                wrapper: ({ children }) => wrapper({ children: <GitLabProvider>{children}</GitLabProvider> })
            });

            await act(async () => {
                await result.current.fetchAccounts();
                await result.current.fetchSshKeys();
                await result.current.fetchRecentIssues();
                await result.current.fetchProjects('gl_1');
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.sshKeys).toHaveLength(1);
            expect(result.current.issues).toHaveLength(1);
            expect(result.current.projects).toHaveLength(1);
        });

        it('handles handleTogglePath, account operations, and uninstall', async () => {
            const { result } = renderHook(() => useGitLab(), {
                wrapper: ({ children }) => wrapper({ children: <GitLabProvider>{children}</GitLabProvider> })
            });

            await act(async () => {
                await result.current.handleTogglePath(true);
                await result.current.handleSaveAccount({ host: 'gitlab.com', username: 'gldev' });
                await result.current.handleSetDefaultAccount('gl_1');
                await result.current.handleRemoveAccount('gl_1');
                await result.current.handleCancelInstall();
                await result.current.executeUninstall();
            });

            expect(mockApi.toggle_gitlab_path).toHaveBeenCalledWith(true);
            expect(mockApi.authenticate_gitlab).toHaveBeenCalled();
            expect(mockApi.set_default_gitlab_account).toHaveBeenCalledWith('gl_1', true);
            expect(mockApi.remove_gitlab_account).toHaveBeenCalledWith('gl_1');
            expect(mockApi.cancel_gitlab_install).toHaveBeenCalled();
            expect(mockApi.uninstall_gitlab_cli).toHaveBeenCalled();
        });

        it('handles vylo_progress for GitLab', async () => {
            const { result } = renderHook(() => useGitLab(), {
                wrapper: ({ children }) => wrapper({ children: <GitLabProvider>{children}</GitLabProvider> })
            });

            act(() => {
                window.dispatchEvent(new CustomEvent('vylo_progress', {
                    detail: { source: 'GitLabManager', percent: 60, text: 'Extracting GLAB...' }
                }));
            });

            expect(result.current.progress).toBe(60);
            expect(result.current.progressText).toBe('Extracting GLAB...');
        });

        it('handles handleOpenProjectInBrowser for GitLab', async () => {
            const { result } = renderHook(() => useGitLab(), {
                wrapper: ({ children }) => wrapper({ children: <GitLabProvider>{children}</GitLabProvider> })
            });

            await act(async () => {
                await result.current.handleOpenProjectInBrowser('https://gitlab.com/org/repo');
            });

            expect(mockApi.open_browser).toHaveBeenCalledWith('https://gitlab.com/org/repo');
        });
    });
});
