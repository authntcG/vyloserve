import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../../test-utils';
import { mockPywebviewApi, renderWithToast, resetPywebviewApi, dispatchAppEvent } from '../../../test-utils';
import TunnelsMain from '../../../../src/menu/tools/tunnels/Main';

const PROJECTS = [
    { id: 'p1', name: 'Blog', domain: 'blog.test' },
    { id: 'p2', name: 'Shop', domain: 'shop.test' },
];

const NOT_INSTALLED = { installed: false, enabled: false, active_shares: [] };
const INSTALLED_DISABLED = { installed: true, enabled: false, version: 'v2.0.7', active_shares: [] };
const ENABLED = { installed: true, enabled: true, version: 'v2.0.7', env_status: 'Environment: abc', active_shares: [] };
const ENABLED_WITH_SHARE = {
    ...ENABLED,
    active_shares: [{ id: 'share_1', project_id: 'p1', url: 'https://abc.shares.zrok.io' }],
};

function mountWith(status: object, overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const api = mockPywebviewApi({
        get_zrok_status: vi.fn().mockResolvedValue(status),
        get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
        ...overrides,
    });
    renderWithToast(<TunnelsMain />);
    return api;
}

/** Label dan tombol dropdown sama-sama menampilkan teks select_project; yang diklik harus yang di dalam <button>. */
function openDropdownButton(): HTMLElement {
    const match = screen.getAllByText('tools.zrok.select_project').find((el) => el.closest('button'));
    if (!match) throw new Error('project dropdown button not found');
    return match;
}

describe('TunnelsMain', () => {
    afterEach(() => resetPywebviewApi());

    it('shows the empty state when zrok is not installed', async () => {
        mountWith(NOT_INSTALLED);

        expect(await screen.findByText('tools.zrok.not_installed_title')).toBeInTheDocument();
        expect(screen.queryByText('tools.zrok.engine_card_title')).not.toBeInTheDocument();
    });

    it('shows the engine card with version and the enable form when installed but not enabled', async () => {
        mountWith(INSTALLED_DISABLED);

        expect(await screen.findByText('tools.zrok.engine_card_title')).toBeInTheDocument();
        expect(screen.getByText('v2.0.7')).toBeInTheDocument();
        expect(screen.getByText('tools.zrok.enable_account')).toBeInTheDocument();
        expect(screen.queryByText('tools.zrok.share_card_title')).not.toBeInTheDocument();
    });

    it('keeps the enable button disabled until a token is typed, then calls enable_zrok with the trimmed token', async () => {
        const user = userEvent.setup();
        const enableZrok = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.enable_success' });
        mountWith(INSTALLED_DISABLED, { enable_zrok: enableZrok });
        const enableButton = await screen.findByText('common.enable');
        expect(enableButton).toBeDisabled();

        await user.type(screen.getByLabelText('tools.zrok.token_label'), '  my-token  ');
        await user.click(enableButton);

        expect(enableZrok).toHaveBeenCalledWith('my-token');
        expect(await screen.findByText('backend.zrok.enable_success')).toBeInTheDocument();
    });

    it('shows an error toast with the backend message when enable_zrok reports failure', async () => {
        const user = userEvent.setup();
        const enableZrok = vi.fn().mockResolvedValue({ status: 'error', message: 'backend.zrok.enable_failed' });
        mountWith(INSTALLED_DISABLED, { enable_zrok: enableZrok });

        await user.type(await screen.findByLabelText('tools.zrok.token_label'), 'tok');
        await user.click(screen.getByText('common.enable'));

        expect(await screen.findByText('backend.zrok.enable_failed')).toBeInTheDocument();
    });

    it('shows the generic unexpected-error toast when enable_zrok throws', async () => {
        const user = userEvent.setup();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mountWith(INSTALLED_DISABLED, { enable_zrok: vi.fn().mockRejectedValue(new Error('boom')) });

        await user.type(await screen.findByLabelText('tools.zrok.token_label'), 'tok');
        await user.click(screen.getByText('common.enable'));

        expect(await screen.findByText('backend.error.unexpected')).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('shows account info and share cards when enabled, and disables the account via disable_zrok', async () => {
        const user = userEvent.setup();
        const disableZrok = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.disable_success' });
        mountWith(ENABLED, { disable_zrok: disableZrok });

        expect(await screen.findByText('tools.zrok.account_enabled')).toBeInTheDocument();
        expect(screen.getByText('Environment: abc')).toBeInTheDocument();
        expect(screen.getByText('tools.zrok.share_card_title')).toBeInTheDocument();
        expect(screen.getByText('tools.zrok.no_active_shares')).toBeInTheDocument();

        await user.click(screen.getByText('tools.zrok.disable_account'));

        expect(disableZrok).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('backend.zrok.disable_success')).toBeInTheDocument();
    });

    it('shares a selected VyloServe project through the searchable dropdown', async () => {
        const user = userEvent.setup();
        const startShare = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.share_started' });
        mountWith(ENABLED, { start_zrok_share: startShare });
        await screen.findByText('tools.zrok.share_card_title');
        const startButton = screen.getByText('tools.zrok.start_share').closest('button') as HTMLButtonElement;
        expect(startButton).toBeDisabled();

        await user.click(openDropdownButton());
        await user.type(screen.getByPlaceholderText('Search...'), 'shop');
        expect(screen.queryByText('blog.test')).not.toBeInTheDocument();
        await user.click(screen.getByText('shop.test'));
        await user.click(startButton);

        expect(startShare).toHaveBeenCalledWith('p2');
        expect(await screen.findByText('backend.zrok.share_started')).toBeInTheDocument();
    });

    it('shows the no-results hint when the project search matches nothing', async () => {
        const user = userEvent.setup();
        mountWith(ENABLED);
        await screen.findByText('tools.zrok.share_card_title');
        await user.click(openDropdownButton());

        await user.type(screen.getByPlaceholderText('Search...'), 'zzz-no-match');

        expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('shows the no-projects label and keeps the dropdown closed when there are no projects', async () => {
        const user = userEvent.setup();
        mountWith(ENABLED, { get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });

        await user.click(await screen.findByText('tools.zrok.no_projects'));

        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('shares a custom address when the custom mode is selected', async () => {
        const user = userEvent.setup();
        const startShare = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.share_started' });
        mountWith(ENABLED, { start_zrok_share: startShare });
        await user.click(await screen.findByText('tools.zrok.mode_custom'));

        const input = screen.getByLabelText('tools.zrok.custom_target');
        expect(input).toHaveValue('localhost:3000');
        await user.clear(input);
        await user.type(input, 'localhost:5173');
        await user.click(screen.getByText('tools.zrok.start_share'));

        expect(startShare).toHaveBeenCalledWith('localhost:5173');
    });

    it('shows the generic unexpected-error toast when start_zrok_share throws', async () => {
        const user = userEvent.setup();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mountWith(ENABLED, { start_zrok_share: vi.fn().mockRejectedValue(new Error('boom')) });
        await user.click(await screen.findByText('tools.zrok.mode_custom'));

        await user.click(screen.getByText('tools.zrok.start_share'));

        expect(await screen.findByText('backend.error.unexpected')).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('lists active shares with the project domain and stops one via stop_zrok_share', async () => {
        const user = userEvent.setup();
        const stopShare = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.share_stopped' });
        mountWith(ENABLED_WITH_SHARE, { stop_zrok_share: stopShare });

        expect(await screen.findByText('blog.test')).toBeInTheDocument();
        expect(screen.getByText('https://abc.shares.zrok.io')).toHaveAttribute('href', 'https://abc.shares.zrok.io');

        await user.click(screen.getByText('tools.zrok.stop_share'));

        expect(stopShare).toHaveBeenCalledWith('share_1');
        expect(await screen.findByText('backend.zrok.share_stopped')).toBeInTheDocument();
    });

    it('falls back to the raw project id for an active share whose project is unknown', async () => {
        mountWith({ ...ENABLED, active_shares: [{ id: 's9', project_id: 'localhost:9000', url: 'https://x.zrok.io' }] });

        expect(await screen.findByText('localhost:9000')).toBeInTheDocument();
    });

    it('confirms and runs the uninstall, closing the modal on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.zrok.uninstalled' });
        mountWith(INSTALLED_DISABLED, { uninstall_zrok: uninstall });
        await user.click(await screen.findByText('tools.zrok.uninstall'));
        expect(await screen.findByText('tools.zrok.uninstall_confirm_title')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'common.uninstall' }));

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('backend.zrok.uninstalled')).toBeInTheDocument();
    });

    it('shows the backend error message and keeps the modal open when uninstall fails', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'error', message: 'backend.zrok.uninstall_failed' });
        mountWith(INSTALLED_DISABLED, { uninstall_zrok: uninstall });
        await user.click(await screen.findByText('tools.zrok.uninstall'));

        await user.click(screen.getByRole('button', { name: 'common.uninstall' }));

        expect(await screen.findByText('backend.zrok.uninstall_failed')).toBeInTheDocument();
        expect(screen.getByText('tools.zrok.uninstall_confirm_title')).toBeInTheDocument();
    });

    it('shows the generic unexpected-error toast when uninstall throws', async () => {
        const user = userEvent.setup();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mountWith(INSTALLED_DISABLED, { uninstall_zrok: vi.fn().mockRejectedValue(new Error('boom')) });
        await user.click(await screen.findByText('tools.zrok.uninstall'));

        await user.click(screen.getByRole('button', { name: 'common.uninstall' }));

        expect(await screen.findByText('backend.error.unexpected')).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('opens the install modal from the header button when zrok is not installed', async () => {
        const user = userEvent.setup();
        mountWith(NOT_INSTALLED, { get_available_zrok_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });

        await user.click(await screen.findByText('tools.zrok.install_tunnel'));

        expect(await screen.findAllByText('tools.zrok.install_zrok')).not.toHaveLength(0);
    });

    it('disables the header install button and labels it installed when zrok is present', async () => {
        mountWith(INSTALLED_DISABLED);

        const label = await screen.findAllByText('runtimes.installed');

        expect(label.some((el) => el.closest('button')?.hasAttribute('disabled'))).toBe(true);
    });

    it('switches between the All and Zrok tabs without losing the content', async () => {
        const user = userEvent.setup();
        mountWith(ENABLED);
        await screen.findByText('tools.zrok.share_card_title');

        await user.click(screen.getByText('tools.zrok.tab_zrok'));
        expect(screen.getByText('tools.zrok.share_card_title')).toBeInTheDocument();
        await user.click(screen.getByText('tools.zrok.tab_all'));
        expect(screen.getByText('tools.zrok.share_card_title')).toBeInTheDocument();
    });

    it('refetches the status when a matching service_status_changed event fires and ignores others', async () => {
        const api = mountWith(ENABLED);
        await screen.findByText('tools.zrok.share_card_title');
        const initialCalls = api.get_zrok_status.mock.calls.length;

        act(() => dispatchAppEvent('service_status_changed', { service: 'apache' }));
        expect(api.get_zrok_status.mock.calls).toHaveLength(initialCalls);

        act(() => dispatchAppEvent('service_status_changed', { service: 'zrok' }));
        await waitFor(() => expect(api.get_zrok_status.mock.calls).toHaveLength(initialCalls + 1));
    });

    it('shows the background progress widget while an install progress event is running and hides it after completion', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            const api = mountWith(INSTALLED_DISABLED);
            await screen.findByText('tools.zrok.engine_card_title');
            const initialCalls = api.get_zrok_status.mock.calls.length;

            act(() => dispatchAppEvent('vylo_progress', { percent: 40, text: 'backend.zrok.downloading', args: {} }));
            expect(screen.getAllByText('backend.zrok.downloading').length).toBeGreaterThan(0);

            act(() => dispatchAppEvent('vylo_progress', { percent: 100, text: 'backend.zrok.install_success', args: {} }));
            await act(async () => { await vi.advanceTimersByTimeAsync(3100); });

            await waitFor(() => expect(api.get_zrok_status.mock.calls.length).toBeGreaterThan(initialCalls));
            expect(screen.queryAllByText('backend.zrok.downloading')).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('resets the install state when a negative percent progress event arrives', async () => {
        mountWith(INSTALLED_DISABLED);
        await screen.findByText('tools.zrok.engine_card_title');

        act(() => dispatchAppEvent('vylo_progress', { percent: 30, text: 'backend.zrok.downloading', args: {} }));
        expect(screen.getAllByText('backend.zrok.downloading').length).toBeGreaterThan(0);
        act(() => dispatchAppEvent('vylo_progress', { percent: -1, text: '', args: {} }));

        await waitFor(() => expect(screen.queryAllByText('backend.zrok.downloading')).toHaveLength(0));
    });
});
