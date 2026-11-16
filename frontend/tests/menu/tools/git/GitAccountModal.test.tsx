import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GitAccountModal from '../../../../src/menu/tools/git/GitAccountModal';
import { GitProvider, type GitAccountItem } from '../../../../src/context/GitContext';
import { mockPywebviewApi, resetPywebviewApi, renderWithToast } from '../../../test-utils';

const mockSshKey = {
    filename: 'id_ed25519',
    path: 'C:/Users/Tester/.ssh/id_ed25519',
    type: 'ed25519',
    comment: 'tester@vyloserve',
    public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 test-key',
};

const mockEditingAccount: GitAccountItem = {
    id: 'acc_123',
    label: 'Work Account',
    endpoint: 'custom.gitlab.org',
    username: 'developer',
    email: 'dev@company.com',
    protocol: 'https',
    auth_mode: 'pat',
    has_token: true,
    masked_token: 'glpat-****',
    ssh_key_path: '',
    is_default: true,
    is_push_active: true,
    requires_vpn: true,
};

describe('GitAccountModal', () => {
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
            get_git_status: vi.fn().mockResolvedValue({ installed: true, version: '2.44.0', in_path: true, external: { exists: false } }),
            get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: { name: '', email: '' } }),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            get_git_accounts: vi.fn().mockResolvedValue({ status: 'success', accounts: [] }),
            get_ssh_keys: vi.fn().mockResolvedValue({ status: 'success', data: [mockSshKey] }),
            save_git_account: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.git.account_saved' }),
            open_browser: vi.fn(),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    const renderModal = (props: {
        isOpen: boolean;
        onClose?: () => void;
        editingAccount?: GitAccountItem | null;
    }) => {
        return renderWithToast(
            <GitProvider>
                <GitAccountModal
                    isOpen={props.isOpen}
                    onClose={props.onClose || vi.fn()}
                    editingAccount={props.editingAccount ?? null}
                />
            </GitProvider>
        );
    };

    it('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('tools.git.account_modal_title')).not.toBeInTheDocument();
    });

    it('renders new account modal and handles basic form input', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });

        expect(await screen.findByText('tools.git.account_modal_title')).toBeInTheDocument();
        const usernameInput = screen.getByLabelText(/tools\.git\.global_user_name/);
        const emailInput = screen.getByLabelText(/tools\.git\.global_email/);
        const tokenInput = screen.getByLabelText('tools.git.auth_pat');

        await user.type(usernameInput, 'johndoe');
        await user.type(emailInput, 'john@example.com');
        await user.type(tokenInput, 'ghp_secrettoken123');

        expect(usernameInput).toHaveValue('johndoe');
        expect(emailInput).toHaveValue('john@example.com');
        expect(tokenInput).toHaveValue('ghp_secrettoken123');
    });

    it('handles preset change to custom endpoint and enables custom endpoint input', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.git.account_modal_title');

        const presetTrigger = screen.getByLabelText('tools.git.endpoint_preset');
        await user.click(presetTrigger);

        const customOption = await screen.findByRole('option', { name: /Custom Endpoint/ });
        await user.click(customOption);

        const endpointInput = screen.getByLabelText('tools.git.endpoint');
        expect(endpointInput).not.toBeDisabled();

        await user.clear(endpointInput);
        await user.type(endpointInput, 'https://mygit.corp.local/');
        expect(endpointInput).toHaveValue('https://mygit.corp.local/');
    });

    it('handles copy public key in ssh mode', async () => {
        const sshAccount: GitAccountItem = {
            ...mockEditingAccount,
            protocol: 'ssh',
            auth_mode: 'ssh',
            ssh_key_path: mockSshKey.path,
        };
        renderModal({ isOpen: true, editingAccount: sshAccount });
        await screen.findByText('tools.git.account_modal_edit_title');

        const copyBtn = await screen.findByRole('button', { name: 'tools.git.copy_public_key' });
        fireEvent.click(copyBtn);

        expect(writeTextSpy).toHaveBeenCalledWith(mockSshKey.public_key);
    });

    it('handles token page navigation via pywebview open_browser', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.git.account_modal_title');

        const openBtn = screen.getByText('tools.git.open_github_token_page');
        await user.click(openBtn);

        expect(mockApi.open_browser).toHaveBeenCalledWith(
            expect.stringContaining('github.com/settings/tokens/new')
        );
    });

    it('handles token page navigation fallback to window.open when open_browser is absent', async () => {
        const user = userEvent.setup();
        delete (window as any).pywebview.api.open_browser;
        const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        renderModal({ isOpen: true });
        await screen.findByText('tools.git.account_modal_title');

        const openBtn = screen.getByText('tools.git.open_github_token_page');
        await user.click(openBtn);

        expect(windowOpenSpy).toHaveBeenCalledWith(
            expect.stringContaining('github.com/settings/tokens/new'),
            '_blank'
        );
        windowOpenSpy.mockRestore();
    });

    it('submits valid new account form successfully', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.git.account_modal_title');

        await user.type(screen.getByLabelText(/tools\.git\.global_user_name/), 'johndoe');
        await user.type(screen.getByLabelText(/tools\.git\.global_email/), 'john@example.com');
        await user.type(screen.getByLabelText('tools.git.auth_pat'), 'my_pat_token');

        const saveBtn = screen.getByRole('button', { name: /save/i });
        expect(saveBtn).not.toBeDisabled();
        await user.click(saveBtn);

        await waitFor(() => {
            expect(mockApi.save_git_account).toHaveBeenCalledWith(expect.objectContaining({
                username: 'johndoe',
                email: 'john@example.com',
                token: 'my_pat_token',
                protocol: 'https',
                auth_mode: 'pat',
            }));
        });
    });

    it('renders edit mode with pre-filled account information', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true, editingAccount: mockEditingAccount });

        expect(await screen.findByText('tools.git.account_modal_edit_title')).toBeInTheDocument();
        expect(screen.getByLabelText(/tools\.git\.global_user_name/)).toHaveValue('developer');
        expect(screen.getByLabelText(/tools\.git\.global_email/)).toHaveValue('dev@company.com');
        expect(screen.getByLabelText('tools.git.endpoint')).toHaveValue('custom.gitlab.org');

        const saveBtn = screen.getByRole('button', { name: /save/i });
        await user.click(saveBtn);

        await waitFor(() => {
            expect(mockApi.save_git_account).toHaveBeenCalledWith(expect.objectContaining({
                id: 'acc_123',
                username: 'developer',
                email: 'dev@company.com',
                requires_vpn: true,
            }));
        });
    });

    it('toggles password visibility', async () => {
        const user = userEvent.setup();
        renderModal({ isOpen: true });
        await screen.findByText('tools.git.account_modal_title');

        const tokenInput = screen.getByLabelText('tools.git.auth_pat');
        expect(tokenInput).toHaveAttribute('type', 'password');

        const toggleBtn = screen.getByRole('button', { name: /show token/i });
        await user.click(toggleBtn);
        expect(tokenInput).toHaveAttribute('type', 'text');

        const hideBtn = screen.getByRole('button', { name: /hide token/i });
        await user.click(hideBtn);
        expect(tokenInput).toHaveAttribute('type', 'password');
    });
});
