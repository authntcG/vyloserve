import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GitLabAccountModal from '../../../../src/menu/tools/git/GitLabAccountModal';
import { GitLabProvider, type GitLabAccountItem } from '../../../../src/context/GitLabContext';
import { mockPywebviewApi, resetPywebviewApi, renderWithToast } from '../../../test-utils';

const mockSshKey = {
    filename: 'id_rsa',
    path: 'C:/Users/Tester/.ssh/id_rsa',
    type: 'rsa',
    comment: 'tester@gitlab',
    public_key: 'ssh-rsa AAAAB3NzaC1yc2E test-rsa-key',
};

const mockEditingGitLabAccount: GitLabAccountItem = {
    id: 'gl_acc_456',
    host: 'gitlab.enterprise.com',
    username: 'gl_dev',
    git_name: 'GL Developer',
    git_email: 'gldev@corp.com',
    auth_type: 'credentials',
    git_protocol: 'https',
    has_token: true,
    masked_token: 'glpat-****',
    ssh_key_path: '',
    is_default: true,
    is_push_active: true,
    requires_vpn: true,
};

describe('GitLabAccountModal', () => {
    let mockApi: ReturnType<typeof mockPywebviewApi>;
    let writeTextSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        writeTextSpy = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextSpy },
            writable: true,
            configurable: true,
        });

        mockApi = mockPywebviewApi({
            get_gitlab_status: vi.fn().mockResolvedValue({ installed: true, version: '1.130.0', in_path: true, authenticated: true }),
            get_available_gitlab_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            get_gitlab_accounts: vi.fn().mockResolvedValue({ status: 'success', accounts: [] }),
            get_ssh_keys: vi.fn().mockResolvedValue({ status: 'success', data: [mockSshKey] }),
            authenticate_gitlab: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.gitlab.auth_success' }),
            open_browser: vi.fn(),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    const renderModal = (props: {
        isOpen: boolean;
        onClose?: () => void;
        editingAccount?: GitLabAccountItem | null;
    }) => {
        return renderWithToast(
            <GitLabProvider>
                <GitLabAccountModal
                    isOpen={props.isOpen}
                    onClose={props.onClose || vi.fn()}
                    editingAccount={props.editingAccount ?? null}
                />
            </GitLabProvider>
        );
    };

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('tools.gitlab.account_modal_title')).not.toBeInTheDocument();
    });

    it('renders new GitLab account modal with initial defaults', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });

        const hostInput = await screen.findByLabelText('tools.gitlab.host');
        expect(hostInput).toHaveValue('gitlab.com');

        await waitFor(() => {
            expect(mockApi.get_ssh_keys).toHaveBeenCalled();
        });

        await user.clear(hostInput);
        await user.type(hostInput, 'gitlab.custom.io');
        expect(hostInput).toHaveValue('gitlab.custom.io');
    });

    it('updates labels when authMode switches to credentials and ssh', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.gitlab.account_modal_title');

        const authSelectTrigger = screen.getByLabelText('tools.gitlab.auth_mode');

        // Switch to credentials
        await user.click(authSelectTrigger);
        const credOption = await screen.findByRole('option', { name: 'tools.gitlab.auth_credentials' });
        await user.click(credOption);
        expect(screen.getByText('tools.gitlab.password_label')).toBeInTheDocument();

        // Switch to ssh
        await user.click(screen.getByLabelText('tools.gitlab.auth_mode'));
        const sshOption = await screen.findByRole('option', { name: 'tools.gitlab.auth_ssh' });
        await user.click(sshOption);
        expect(screen.queryByText('tools.gitlab.password_label')).not.toBeInTheDocument();
        expect(await screen.findByText('tools.gitlab.copy_public_key')).toBeInTheDocument();
    });

    it('handles copy public key in ssh mode', async () => {
        const sshAccount: GitLabAccountItem = {
            ...mockEditingGitLabAccount,
            auth_type: 'ssh',
            git_protocol: 'ssh',
            ssh_key_path: mockSshKey.path,
        };
        renderModal({ isOpen: true, editingAccount: sshAccount });
        await screen.findByText('tools.gitlab.account_modal_edit_title');

        const copyBtn = await screen.findByRole('button', { name: 'tools.gitlab.copy_public_key' });
        fireEvent.click(copyBtn);

        expect(writeTextSpy).toHaveBeenCalledWith(mockSshKey.public_key);
    });

    it('handles open token URL via pywebview and fallback', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.gitlab.account_modal_title');

        const openBtn = screen.getByText('tools.gitlab.open_token_page');
        await user.click(openBtn);

        expect(mockApi.open_browser).toHaveBeenCalledWith(
            expect.stringContaining('personal_access_tokens')
        );

        // Fallback test
        delete (window as any).pywebview.api.open_browser;
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        await user.click(openBtn);
        expect(windowOpenSpy).toHaveBeenCalledWith(
            expect.stringContaining('personal_access_tokens'),
            '_blank'
        );
        windowOpenSpy.mockRestore();
    });

    it('enforces token requirement for new accounts in PAT mode', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.gitlab.account_modal_title');

        const saveBtn = screen.getByRole('button', { name: 'tools.gitlab.save_connect' });
        expect(saveBtn).toBeDisabled();

        const tokenInput = screen.getByLabelText('tools.gitlab.token');
        await user.type(tokenInput, 'glpat-testtoken123');

        expect(saveBtn).not.toBeDisabled();
        await user.click(saveBtn);

        await waitFor(() => {
            expect(mockApi.authenticate_gitlab).toHaveBeenCalledWith(
                'gitlab.com',
                'glpat-testtoken123',
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

    it('allows editing account without re-entering existing token', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true, editingAccount: mockEditingGitLabAccount });

        expect(await screen.findByText('tools.gitlab.account_modal_edit_title')).toBeInTheDocument();
        expect(screen.getByLabelText('tools.gitlab.host')).toHaveValue('gitlab.enterprise.com');
        expect(screen.getByLabelText('tools.gitlab.username')).toHaveValue('gl_dev');

        const saveBtn = screen.getByRole('button', { name: 'tools.gitlab.save_connect' });
        expect(saveBtn).not.toBeDisabled();
        await user.click(saveBtn);

        await waitFor(() => {
            expect(mockApi.authenticate_gitlab).toHaveBeenCalledWith(
                'gitlab.enterprise.com',
                '',
                'credentials',
                'https',
                'GL Developer',
                'gldev@corp.com',
                '',
                true,
                'gl_dev',
                true
            );
        });
    });

    it('toggles password/token visibility', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.gitlab.account_modal_title');

        const tokenInput = screen.getByLabelText('tools.gitlab.token');
        expect(tokenInput).toHaveAttribute('type', 'password');

        const toggleBtn = screen.getByRole('button', { name: /show token/i });
        await user.click(toggleBtn);
        expect(tokenInput).toHaveAttribute('type', 'text');

        const hideBtn = screen.getByRole('button', { name: /hide token/i });
        await user.click(hideBtn);
        expect(tokenInput).toHaveAttribute('type', 'password');
    });
});
