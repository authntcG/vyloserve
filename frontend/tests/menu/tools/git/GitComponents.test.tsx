import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import {
    GitInstallButton,
    GitLabInstallButton,
    ExternalCard,
    GitCoreSystemCard,
    GitGlobalConfigCard,
    GitAccountsCard,
    GitAssignedProjectsCard,
} from '../../../../src/menu/tools/git/GitComponents';
import { GitProvider, type GitAccountItem, type GitProjectItem } from '../../../../src/context/GitContext';
import { mockPywebviewApi, resetPywebviewApi, renderWithToast } from '../../../test-utils';

const sampleAccounts: GitAccountItem[] = [
    {
        id: 'acc_1',
        label: 'Work GitHub',
        endpoint: 'github.com',
        username: 'octo_work',
        email: 'work@example.com',
        protocol: 'https',
        auth_mode: 'pat',
        has_token: true,
        masked_token: 'ghp_****',
        ssh_key_path: '',
        is_default: true,
        is_push_active: true,
        requires_vpn: false,
    },
    {
        id: 'acc_2',
        label: 'Corp GitLab',
        endpoint: 'corp.gitlab.com',
        username: 'corp_dev',
        email: 'dev@corp.com',
        protocol: 'ssh',
        auth_mode: 'ssh',
        has_token: false,
        masked_token: '',
        ssh_key_path: '/path/id_rsa',
        is_default: false,
        is_push_active: false,
        requires_vpn: true,
        vpn_reachable: true,
    },
    {
        id: 'acc_3',
        label: 'VPN Disconnected',
        endpoint: 'vpn.gitlab.com',
        username: 'vpn_user',
        email: 'vpn@corp.com',
        protocol: 'ssh',
        auth_mode: 'ssh',
        has_token: false,
        masked_token: '',
        ssh_key_path: '',
        is_default: false,
        is_push_active: false,
        requires_vpn: true,
        vpn_reachable: false,
    }
];

const sampleProjects: GitProjectItem[] = [
    {
        id: 'p_1',
        name: 'backend-api',
        full_name: 'corp/backend-api',
        visibility: 'private',
        web_url: 'https://github.com/corp/backend-api',
        ssh_url: 'git@github.com:corp/backend-api.git',
        http_url: 'https://github.com/corp/backend-api.git',
        default_branch: 'main',
        last_activity_at: '2026-11-15T10:00:00Z',
        account_id: 'acc_1',
        host: 'github.com',
        source: 'remote',
    },
    {
        id: 'p_2',
        name: 'frontend-ui',
        full_name: 'corp/frontend-ui',
        visibility: 'public',
        web_url: 'https://github.com/corp/frontend-ui',
        ssh_url: '',
        http_url: 'https://github.com/corp/frontend-ui.git',
        default_branch: 'master',
        last_activity_at: '',
        account_id: 'acc_1',
        host: 'github.com',
        source: 'local',
    }
];

describe('GitComponents', () => {
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
            get_git_accounts: vi.fn().mockResolvedValue({
                status: 'success',
                accounts: sampleAccounts,
            }),
            get_git_account_projects: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    projects: sampleProjects,
                    auth_warning: false,
                    vpn_blocked: false,
                    account_id: 'acc_1',
                }
            }),
            get_ssh_keys: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: { name: 'Dev', email: 'dev@test.io' } }),
            delete_git_account: vi.fn().mockResolvedValue({ status: 'success' }),
            set_default_git_account: vi.fn().mockResolvedValue({ status: 'success' }),
            toggle_git_path: vi.fn().mockResolvedValue({ status: 'success' }),
            open_browser: vi.fn(),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    const renderWithContext = (ui: React.ReactNode) => {
        return renderWithToast(
            <GitProvider>
                {ui}
            </GitProvider>
        );
    };

    it('renders GitInstallButton and GitLabInstallButton properly', () => {
        const onClick = vi.fn();
        const t = (k: string) => k;

        const { rerender } = renderWithToast(
            <GitInstallButton installed={false} isLoading={false} isBlockedByExternal={false} onClick={onClick} t={t} />
        );
        expect(screen.getByText('tools.git.install_git')).toBeInTheDocument();
        fireEvent.click(screen.getByText('tools.git.install_git'));
        expect(onClick).toHaveBeenCalled();

        rerender(
            <GitInstallButton installed={true} isLoading={false} isBlockedByExternal={false} onClick={onClick} t={t} />
        );
        expect(screen.getByText('common.installed')).toBeInTheDocument();

        rerender(
            <GitLabInstallButton installed={false} isLoading={false} onClick={onClick} t={t} />
        );
        expect(screen.getByText('tools.gitlab.install_cli')).toBeInTheDocument();
    });

    it('renders ExternalCard only when external git exists and not installed', () => {
        const t = (k: string) => k;
        const { rerender } = renderWithToast(
            <ExternalCard gitData={{ installed: true, external: { exists: true, version: '2.40.0', path: 'C:/Git' } }} t={t} />
        );
        expect(screen.queryByText('tools.git.native_os_card_title')).not.toBeInTheDocument();

        rerender(
            <ExternalCard gitData={{ installed: false, external: { exists: true, version: '2.40.0', path: 'C:/Git' } }} t={t} />
        );
        expect(screen.getByText('tools.git.native_os_card_title')).toBeInTheDocument();
        expect(screen.getByText('2.40.0')).toBeInTheDocument();
    });

    it('renders GitCoreSystemCard and handles path toggle', async () => {
        renderWithContext(<GitCoreSystemCard />);
        expect(await screen.findByText('tools.git.core_system_title')).toBeInTheDocument();

        const toggle = screen.getByRole('checkbox', { name: 'tools.git.register_path' });
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(mockApi.toggle_git_path).toHaveBeenCalled();
        });
    });

    it('renders GitGlobalConfigCard and handles changes', async () => {
        renderWithContext(<GitGlobalConfigCard />);
        expect(await screen.findByText('tools.git.global_config')).toBeInTheDocument();

        const nameInput = screen.getByPlaceholderText('tools.git.eg_name');
        const emailInput = screen.getByPlaceholderText('tools.git.eg_email');

        fireEvent.change(nameInput, { target: { value: 'New Name' } });
        fireEvent.change(emailInput, { target: { value: 'new@email.com' } });

        expect(nameInput).toHaveValue('New Name');
        expect(emailInput).toHaveValue('new@email.com');
    });

    it('renders GitAccountsCard and handles account actions', async () => {
        renderWithContext(<GitAccountsCard />);

        expect(await screen.findByText('Work GitHub')).toBeInTheDocument();
        expect(screen.getByText('Corp GitLab')).toBeInTheDocument();
        expect(screen.getByText('VPN Disconnected')).toBeInTheDocument();

        // Check badges
        expect(screen.getByText('tools.git.default_badge')).toBeInTheDocument();
        expect(screen.getByText('tools.git.active_push_badge')).toBeInTheDocument();
        expect(screen.getByText('tools.git.vpn_badge')).toBeInTheDocument();
        expect(screen.getByText('tools.git.vpn_disconnected_badge')).toBeInTheDocument();

        // Click set default on non-default account
        const setDefaultBtns = screen.getAllByTitle('tools.git.set_default');
        expect(setDefaultBtns.length).toBeGreaterThanOrEqual(1);
        fireEvent.click(setDefaultBtns[0]);

        await waitFor(() => {
            expect(mockApi.set_default_git_account).toHaveBeenCalledWith('acc_2');
        });
    });

    it('renders GitAssignedProjectsCard and handles filter chips, copy clone url and open in browser', async () => {
        renderWithContext(<GitAssignedProjectsCard />);

        expect(await screen.findByText('corp/backend-api')).toBeInTheDocument();
        expect(screen.getByText('corp/frontend-ui')).toBeInTheDocument();

        // Click filter private
        const privateChip = screen.getByText('tools.git.filter_private');
        fireEvent.click(privateChip);
        expect(screen.getByText('corp/backend-api')).toBeInTheDocument();
        expect(screen.queryByText('corp/frontend-ui')).not.toBeInTheDocument();

        // Click filter all
        const allChip = screen.getByText('tools.git.filter_all');
        fireEvent.click(allChip);
        expect(screen.getByText('corp/backend-api')).toBeInTheDocument();
        expect(screen.getByText('corp/frontend-ui')).toBeInTheDocument();

        // Copy clone URL
        const copyBtns = screen.getAllByTitle('tools.git.copy_clone_url');
        expect(copyBtns).toHaveLength(2);
        fireEvent.click(copyBtns[0]);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://github.com/corp/backend-api.git');

        // Open in browser
        const openBtns = screen.getAllByText('tools.git.open_repo');
        expect(openBtns).toHaveLength(2);
        fireEvent.click(openBtns[0]);
        expect(mockApi.open_browser).toHaveBeenCalledWith('https://github.com/corp/backend-api');
    });
});
