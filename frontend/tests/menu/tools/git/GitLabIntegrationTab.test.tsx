import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import GitLabIntegrationTab from '../../../../src/menu/tools/git/GitLabIntegrationTab';
import InstallGitLabModal from '../../../../src/menu/tools/git/InstallGitLabModal';
import { ToastProvider } from '../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../src/context/AlertContext';
import { GitLabProvider } from '../../../../src/context/GitLabContext';

describe('GitLabIntegrationTab', () => {
    beforeEach(() => {
        (window as any).pywebview = {
            api: {
                get_gitlab_status: vi.fn().mockResolvedValue({
                    installed: false,
                    version: null,
                    path: null,
                    is_external: false,
                    authenticated: false,
                    host: null,
                    username: null,
                }),
                get_available_gitlab_versions: vi.fn().mockResolvedValue({
                    status: 'success',
                    data: [
                        {
                            value: '1.130.0',
                            label: 'GitLab CLI v1.130.0 (Latest Release)',
                            filename: 'glab_1.130.0_windows_amd64.zip',
                            version_text: '1.130.0',
                        },
                    ],
                }),
                install_gitlab_cli: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.install_success',
                    args: { version: '1.130.0' },
                }),
                cancel_gitlab_install: vi.fn().mockResolvedValue({
                    status: 'success',
                }),
                uninstall_gitlab_cli: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.uninstall_success',
                }),
                authenticate_gitlab: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.auth_success',
                    args: { user: 'developer', host: 'gitlab.com' },
                }),
                logout_gitlab: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.logout_success',
                }),
                get_gitlab_accounts: vi.fn().mockResolvedValue({
                    status: 'success',
                    accounts: [],
                    default_account_id: '',
                }),
                remove_gitlab_account: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.logout_success',
                }),
                set_default_gitlab_account: vi.fn().mockResolvedValue({
                    status: 'success',
                }),
                toggle_gitlab_path: vi.fn().mockResolvedValue({
                    status: 'success',
                }),
                get_ssh_keys: vi.fn().mockResolvedValue({
                    status: 'success',
                    data: [],
                }),
                get_gitlab_recent_issues: vi.fn().mockResolvedValue({
                    status: 'success',
                    issues: [
                        { id: '10', title: 'Issue 10 title' },
                        { id: '11', title: 'Issue 11 title' },
                    ],
                }),
            },
        };
    });

    const renderWithProviders = (ui: React.ReactElement) => {
        return render(
            <ToastProvider>
                <AlertProvider>
                    <GitLabProvider>
                        {ui}
                        <InstallGitLabModal />
                    </GitLabProvider>
                </AlertProvider>
            </ToastProvider>
        );
    };

    it('renders uninstalled empty state with install action button', async () => {
        renderWithProviders(<GitLabIntegrationTab />);

        expect(await screen.findByText('tools.gitlab.not_installed_title')).toBeInTheDocument();
        expect(screen.getByText('tools.gitlab.not_installed_desc')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.gitlab.install_cli' })).toBeInTheDocument();
    });

    it('opens version selection modal and triggers CLI installation', async () => {
        renderWithProviders(<GitLabIntegrationTab />);

        const installBtn = await screen.findByRole('button', { name: 'tools.gitlab.install_cli' });
        fireEvent.click(installBtn);

        expect(await screen.findByText('tools.gitlab.select_release')).toBeInTheDocument();
        expect(await screen.findByText('GitLab CLI v1.130.0 (Latest Release)')).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: 'tools.gitlab.install_engine' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.install_gitlab_cli).toHaveBeenCalledWith('1.130.0');
        });
    });

    it('renders installed CLI card and allows uninstalling', async () => {
        (window as any).pywebview.api.get_gitlab_status = vi.fn().mockResolvedValue({
            installed: true,
            version: '1.130.0',
            path: 'C:\\vyloserve\\bin\\glab\\glab.exe',
            is_external: false,
            authenticated: false,
            host: null,
            username: null,
        });

        renderWithProviders(<GitLabIntegrationTab />);

        expect(await screen.findByText('v1.130.0')).toBeInTheDocument();
        const uninstallBtn = await screen.findByText('tools.gitlab.uninstall_cli');
        expect(uninstallBtn).toBeInTheDocument();

        fireEvent.click(uninstallBtn);
        const confirmBtn = await screen.findByRole('button', { name: /tools\.git\.yes_uninstall/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.uninstall_gitlab_cli).toHaveBeenCalledTimes(1);
        });
    });

    it('opens PAT login modal and connects account', async () => {
        (window as any).pywebview.api.get_gitlab_status = vi.fn().mockResolvedValue({
            installed: true,
            version: '1.130.0',
            path: 'C:\\vyloserve\\bin\\glab\\glab.exe',
            is_external: false,
            authenticated: false,
            host: null,
            username: null,
        });

        renderWithProviders(<GitLabIntegrationTab />);

        const [connectBtn] = await screen.findAllByRole('button', { name: /tools\.gitlab\.add_account/i });
        fireEvent.click(connectBtn);

        expect(await screen.findByLabelText('tools.gitlab.token')).toBeInTheDocument();

        const tokenInput = screen.getByLabelText('tools.gitlab.token');
        fireEvent.change(tokenInput, { target: { value: 'glpat-valid123' } });

        const submitBtn = screen.getByRole('button', { name: /tools\.gitlab\.save_connect/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.authenticate_gitlab).toHaveBeenCalledWith(
                'gitlab.com',
                'glpat-valid123',
                'pat',
                'https',
                '',
                '',
                '',
                true,
                '',
                false
            );
        });
    });

    it('renders authenticated status, recent issues and handles logout', async () => {
        (window as any).pywebview.api.get_gitlab_status = vi.fn().mockResolvedValue({
            installed: true,
            version: '1.130.0',
            path: 'C:\\vyloserve\\bin\\glab\\glab.exe',
            is_external: false,
            authenticated: true,
            host: 'gitlab.com',
            username: 'alice',
        });
        (window as any).pywebview.api.get_gitlab_accounts = vi.fn().mockResolvedValue({
            status: 'success',
            accounts: [
                {
                    id: 'gitlab.com_alice',
                    host: 'gitlab.com',
                    username: 'alice',
                    git_name: 'Alice Developer',
                    git_email: 'alice@gitlab.com',
                    auth_type: 'pat',
                    git_protocol: 'https',
                    has_token: true,
                    masked_token: 'glpa••••1234',
                    is_default: true,
                    is_push_active: true,
                }
            ],
            default_account_id: 'gitlab.com_alice',
        });

        renderWithProviders(<GitLabIntegrationTab />);

        expect((await screen.findAllByText(/@alice/)).length).toBeGreaterThan(0);
        expect(await screen.findByText('Issue 10 title')).toBeInTheDocument();
        expect(screen.getByText('Issue 11 title')).toBeInTheDocument();

        const deleteBtn = screen.getByLabelText('tools.gitlab.delete_account');
        fireEvent.click(deleteBtn);

        const confirmBtn = await screen.findByRole('button', { name: /^Delete$/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.remove_gitlab_account).toHaveBeenCalledWith('gitlab.com_alice');
        });
    });

    it('renders warning alert when external GitLab CLI is detected', async () => {
        (window as any).pywebview.api.get_gitlab_status = vi.fn().mockResolvedValue({
            installed: true,
            version: '1.130.0',
            path: 'C:\\Program Files\\GitLab CLI\\glab.exe',
            is_external: true,
            authenticated: false,
            host: null,
            username: null,
        });

        renderWithProviders(<GitLabIntegrationTab />);

        expect(await screen.findByTestId('gitlab-external-alert')).toBeInTheDocument();
        expect(screen.getByText(/tools.gitlab.external_warning_title/)).toBeInTheDocument();
    });
});
