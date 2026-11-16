import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import InstallGitLabModal from '../../../../src/menu/tools/git/InstallGitLabModal';
import { ToastProvider } from '../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../src/context/AlertContext';
import { GitLabProvider, useGitLab } from '../../../../src/context/GitLabContext';
import { NetworkProvider } from '../../../../src/context/NetworkContext';

function TestTrigger() {
    const { setIsInstallModalOpen } = useGitLab();
    return (
        <button type="button" onClick={() => setIsInstallModalOpen(true)}>
            Open GitLab Modal
        </button>
    );
}

describe('InstallGitLabModal', () => {
    beforeEach(() => {
        (window as any).pywebview = {
            api: {
                get_gitlab_status: vi.fn().mockResolvedValue({
                    installed: false,
                    version: null,
                    path: null,
                    is_external: false,
                    authenticated: false,
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
                        {
                            value: '1.129.0',
                            label: 'GitLab CLI v1.129.0',
                            filename: 'glab_1.129.0_windows_amd64.zip',
                            version_text: '1.129.0',
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
            },
        };
    });

    const renderComponent = () => {
        return render(
            <NetworkProvider>
                <ToastProvider>
                    <AlertProvider>
                        <GitLabProvider>
                            <TestTrigger />
                            <InstallGitLabModal />
                        </GitLabProvider>
                    </AlertProvider>
                </ToastProvider>
            </NetworkProvider>
        );
    };

    it('opens modal and displays available release options', async () => {
        renderComponent();

        fireEvent.click(screen.getByText('Open GitLab Modal'));

        expect(await screen.findByText('tools.gitlab.select_release')).toBeInTheDocument();
        expect(await screen.findByText('GitLab CLI v1.130.0 (Latest Release)')).toBeInTheDocument();
    });

    it('submits selected version and calls install_gitlab_cli with chosen version', async () => {
        renderComponent();

        fireEvent.click(screen.getByText('Open GitLab Modal'));
        await screen.findByText('GitLab CLI v1.130.0 (Latest Release)');

        const submitBtn = screen.getByRole('button', { name: 'tools.gitlab.install_engine' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.install_gitlab_cli).toHaveBeenCalledWith('1.130.0');
        });
    });

    it('handles offline state and shows retry banner when fetching versions reports offline', async () => {
        (window as any).pywebview.api.get_available_gitlab_versions = vi.fn().mockResolvedValue({
            status: 'error',
            is_offline: true,
            data: [],
        });

        renderComponent();
        fireEvent.click(screen.getByText('Open GitLab Modal'));

        expect(await screen.findByText('tools.gitlab.error_fetching')).toBeInTheDocument();
    });
});
