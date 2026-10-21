import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import { ApacheProvider, useApache } from '../../../src/context/ApacheContext';
import ApacheCliInstallModal from '../../../src/menu/apache/ApacheCliInstallModal';

function mockApacheApi(overrides: Record<string, any> = {}) {
    return {
        get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: true, path: 'C:/Apache24', running: false }),
        get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
        get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        cancel_project_install: vi.fn().mockResolvedValue({ status: 'success' }),
        send_project_cli_input: vi.fn().mockResolvedValue({ status: 'success' }),
        resize_project_cli: vi.fn().mockResolvedValue({ status: 'success' }),
        ...overrides,
    };
}

function Harness({ onMount }: { onMount?: (ctx: ReturnType<typeof useApache>) => void }) {
    const ctx = useApache();
    if (onMount) onMount(ctx);
    return <ApacheCliInstallModal />;
}

describe('ApacheCliInstallModal', () => {
    it('does not display when isCreatingProject is false', () => {
        mockPywebviewApi(mockApacheApi());
        renderWithToast(
            <ApacheProvider>
                <Harness />
            </ApacheProvider>
        );

        expect(screen.queryByText('apache.cli_modal_title')).not.toBeInTheDocument();
    });

    it('automatically opens on vylo_cli_state waiting_input: true and auto-closes on waiting_input: false', async () => {
        mockPywebviewApi(mockApacheApi());

        renderWithToast(
            <ApacheProvider>
                <Harness />
            </ApacheProvider>
        );

        // Progress starts
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', {
                detail: { source: 'ProjectManager', percent: 20, text: 'Scaffolding...' }
            }));
        });

        // Modal should be kept mounted in background but hidden
        const modalEl = screen.getByRole('dialog', { hidden: true });
        expect(modalEl.className).toContain('invisible');

        // CLI fires prompt waiting_input: true
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_cli_state', {
                detail: { waiting_input: true, prompt: '? Select framework » No / Yes' }
            }));
        });

        // Terminal modal pops up automatically
        await waitFor(() => {
            expect(screen.getByRole('dialog').className).toContain('visible');
        });
        expect(screen.getByText('apache.cli_modal_title')).toBeInTheDocument();
        expect(screen.getByText('apache.cli_waiting_input_badge')).toBeInTheDocument();
        expect(screen.getByText('? Select framework » No / Yes')).toBeInTheDocument();

        // User finishes input, CLI emits waiting_input: false
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_cli_state', {
                detail: { waiting_input: false, prompt: '' }
            }));
        });

        // Modal closes automatically
        await waitFor(() => {
            const modalEl = screen.getByRole('dialog', { hidden: true });
            expect(modalEl.className).toContain('invisible');
        });
    });

    it('shows confirmation when user clicks cancel and calls cancel_project_install on confirm', async () => {
        const user = userEvent.setup();
        const cancelProjectInstall = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(mockApacheApi({ cancel_project_install: cancelProjectInstall }));

        renderWithToast(
            <ApacheProvider>
                <Harness />
            </ApacheProvider>
        );

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', {
                detail: { source: 'ProjectManager', percent: 30, text: 'Installing...' }
            }));
            window.dispatchEvent(new CustomEvent('vylo_cli_state', {
                detail: { waiting_input: true, prompt: 'Continue? [Y/n]' }
            }));
        });

        expect(await screen.findByText('apache.cli_modal_title')).toBeInTheDocument();

        // Click Cancel & Revert button
        const cancelBtn = screen.getByRole('button', { name: 'apache.cli_cancel_install_btn' });
        await user.click(cancelBtn);

        // Confirmation modal appears
        expect(await screen.findByText('apache.cli_cancel_confirm_title')).toBeInTheDocument();
        expect(screen.getByText('apache.cli_cancel_confirm_desc')).toBeInTheDocument();

        // Confirm cancellation
        await user.click(screen.getByRole('button', { name: 'apache.cli_cancel_confirm_yes' }));

        expect(cancelProjectInstall).toHaveBeenCalledTimes(1);
    });

    it('cancels the confirm dialog without calling cancel_project_install if user clicks cancel on dialog', async () => {
        const user = userEvent.setup();
        const cancelProjectInstall = vi.fn();
        mockPywebviewApi(mockApacheApi({ cancel_project_install: cancelProjectInstall }));

        renderWithToast(
            <ApacheProvider>
                <Harness />
            </ApacheProvider>
        );

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', {
                detail: { source: 'ProjectManager', percent: 30, text: 'Installing...' }
            }));
            window.dispatchEvent(new CustomEvent('vylo_cli_state', {
                detail: { waiting_input: true, prompt: 'Prompt?' }
            }));
        });

        expect(await screen.findByText('apache.cli_modal_title')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'apache.cli_cancel_install_btn' }));
        expect(await screen.findByText('apache.cli_cancel_confirm_title')).toBeInTheDocument();

        // Click secondary cancel button in confirm modal
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(cancelProjectInstall).not.toHaveBeenCalled();
    });
});
