import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import ApacheMain from '../../../src/menu/apache/Main';

vi.mock('../../../src/menu/apache/Settings', () => ({ default: () => <div>apache-settings-stub</div> }));
vi.mock('../../../src/menu/apache/InstallWizard', () => ({
    default: (props: any) => <div>install-wizard-stub:{props?.version}</div>,
}));

function apacheApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    return {
        get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: true, path: 'C:/Apache24', running: false }),
        get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
        get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        ...overrides,
    };
}

describe('ApacheMain', () => {
    it('shows the not-installed empty state when Apache is not installed', async () => {
        mockPywebviewApi(apacheApi({ get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }) }));
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('apache.not_installed_title')).toBeInTheDocument();
    });

    it('shows the installed server card with its version once fetched', async () => {
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('Apache 2.4.62 (Win64)')).toBeInTheDocument();
    });

    it('starts a stopped Apache server and shows a success toast', async () => {
        const user = userEvent.setup();
        const start = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.started', args: {} });
        mockPywebviewApi(apacheApi({ start_apache_server: start }));
        renderWithToast(<ApacheMain />);
        await screen.findByRole('button', { name: /apache.start_server/ });

        await user.click(screen.getByRole('button', { name: /apache.start_server/ }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('apache.started')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /apache.stop_server/ })).toBeInTheDocument();
    });

    it('shows an error toast when toggling the server fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ start_apache_server: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.start_failed', args: {} }) }));
        renderWithToast(<ApacheMain />);
        await screen.findByRole('button', { name: /apache.start_server/ });

        await user.click(screen.getByRole('button', { name: /apache.start_server/ }));

        expect(await screen.findByText('apache.start_failed')).toBeInTheDocument();
    });

    it('reflects a service_status_changed(apache) event without a full refetch', async () => {
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);
        await screen.findByRole('button', { name: /apache.start_server/ });

        act(() => {
            window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'apache', running: true } }));
        });

        expect(await screen.findByRole('button', { name: /apache.stop_server/ })).toBeInTheDocument();
    });

    it('confirms Apache update from burger option, starts in minimized mode, and refreshes status on success', async () => {
        const user = userEvent.setup();
        const installApache = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.updated', args: {} });
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.63', url: 'https://example.com/2.4.63.zip' }],
            }),
            install_apache: installApache,
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText(/ui\.update\.update_to_target/));
        await user.click(screen.getByRole('button', { name: 'apache.yes_update' }));

        expect(installApache).toHaveBeenCalledWith('2.4.63', 'https://example.com/2.4.63.zip', 80);
        expect(await screen.findByText('apache.updated')).toBeInTheDocument();
    });

    it('cancels Apache update from burger option without calling install_apache', async () => {
        const user = userEvent.setup();
        const installApache = vi.fn();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.63', url: 'https://example.com/2.4.63.zip' }],
            }),
            install_apache: installApache,
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText(/ui\.update\.update_to_target/));
        expect(await screen.findByText('apache.confirm_update')).toBeInTheDocument();
        await user.click(screen.getByText('Cancel'));

        expect(installApache).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByText('apache.confirm_update')).not.toBeInTheDocument());
    });

    it('restores the minimized update widget and opens the modal with the target version pre-selected', async () => {
        let installResolve: (val: any) => void = () => {};
        const installPromise = new Promise((resolve) => { installResolve = resolve; });
        const installApache = vi.fn().mockReturnValue(installPromise);

        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.63', url: 'https://example.com/2.4.63.zip' }],
            }),
            install_apache: installApache,
        }));
        const user = userEvent.setup();
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText(/ui\.update\.update_to_target/));
        expect(await screen.findByText('apache.confirm_update')).toBeInTheDocument();
        await user.click(screen.getByText('apache.yes_update'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', {
                detail: { source: 'ApacheManager', percent: 45, text: 'Downloading 2.4.63...' },
            }));
        });

        const widget = await screen.findByRole('button', { name: /apache\.updating_apache/ });
        await user.click(widget);

        expect(await screen.findByText('install-wizard-stub:2.4.63')).toBeInTheDocument();

        await act(async () => {
            installResolve({ status: 'success', message: 'done', args: {} });
            await installPromise;
        });
    });

    it('shows the API-provided error when Apache update fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.63', url: 'https://example.com/2.4.63.zip' }],
            }),
            install_apache: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.update_failed', args: {} }),
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText(/ui\.update\.update_to_target/));
        await user.click(screen.getByRole('button', { name: 'apache.yes_update' }));

        expect(await screen.findByText('apache.update_failed')).toBeInTheDocument();
    });

    it('installs Apache cleanly via Install Now modal when not installed', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.installed_now', args: {} });
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn()
                .mockResolvedValueOnce({ status: 'success', installed: false, path: '', running: false })
                .mockResolvedValue({ status: 'success', installed: true, path: 'C:/Apache24', running: false }),
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.62', url: 'https://example.com/2.4.62.zip' }],
            }),
            install_apache: install,
        }));
        renderWithToast(<ApacheMain />);

        await screen.findByText('apache.not_installed_title');
        await user.click(screen.getAllByText('apache.install_now')[0]);
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());

        await user.click(screen.getByText('apache.download_install'));

        expect(install).toHaveBeenCalledWith('2.4.62', 'https://example.com/2.4.62.zip', 80);
        expect(await screen.findByText('apache.installed_now')).toBeInTheDocument();
    });

    it('confirms Apache uninstall and refreshes status on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.uninstalled', args: {} });
        mockPywebviewApi(apacheApi({ uninstall_apache: uninstall }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText('apache.uninstall_server'));
        expect(await screen.findByText('apache.uninstall_apache')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'apache.yes_uninstall' }));

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('apache.uninstalled')).toBeInTheDocument();
    });

    it('shows the background progress widget (once minimized) only for ApacheManager-sourced events while installing', async () => {
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.63', url: 'https://example.com/2.4.63.zip' }],
            }),
            install_apache: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        const user = userEvent.setup();
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText(/ui\.update\.update_to_target/));
        expect(await screen.findByText('apache.confirm_update')).toBeInTheDocument();
        await user.click(screen.getByText('apache.yes_update'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 77, text: 'wrong module' } }));
        });
        expect(screen.queryByText('wrong module')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 77, text: 'right module' } }));
        });
        expect(await screen.findByText('right module')).toBeInTheDocument();
    });

    it('opens all shortcuts and directories via the status-card dropdown actions', async () => {
        const user = userEvent.setup();
        const openConfig = vi.fn();
        const openDir = vi.fn();
        const openLocalhost = vi.fn();
        const openHtdocs = vi.fn();
        const openConfDir = vi.fn();
        const openLogsDir = vi.fn();
        const openFile = vi.fn();

        mockPywebviewApi(apacheApi({
            open_apache_config: openConfig,
            open_apache_directory: openDir,
            open_browser: openLocalhost,
            open_apache_htdocs: openHtdocs,
            open_apache_conf_dir: openConfDir,
            open_apache_logs_dir: openLogsDir,
            open_apache_file: openFile,
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText('apache.quick_open_localhost'));
        expect(openLocalhost).toHaveBeenCalledWith('http://localhost');

        await user.click(screen.getByText('apache.quick_open_htdocs'));
        expect(openHtdocs).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('apache.open_httpd_conf'));
        expect(openConfig).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('apache.quick_open_vhosts_conf'));
        expect(openFile).toHaveBeenCalledWith('vhosts');

        await user.click(screen.getByText('apache.quick_open_conf_dir'));
        expect(openConfDir).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('apache.quick_open_logs_dir'));
        expect(openLogsDir).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('apache.open_directory'));
        expect(openDir).toHaveBeenCalledTimes(1);
    });

    it('renders the Open Browser quick button in footer when Apache server is running', async () => {
        const user = userEvent.setup();
        const openBrowser = vi.fn();
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: true, path: 'C:/Apache24', running: true }),
            open_browser: openBrowser,
        }));
        renderWithToast(<ApacheMain />);

        const openBrowserBtn = await screen.findByRole('button', { name: /open browser/i });
        expect(openBrowserBtn).toBeInTheDocument();

        await user.click(openBrowserBtn);
        expect(openBrowser).toHaveBeenCalledWith('http://localhost');
    });

    it('shows a generic error toast when toggling the server throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ start_apache_server: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);
        await screen.findByRole('button', { name: /apache.start_server/ });

        await user.click(screen.getByRole('button', { name: /apache.start_server/ }));

        expect(await screen.findByText('apache.toggle_error')).toBeInTheDocument();
    });

    it('shows the API-provided error and empty version list when fetching available Apache versions fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }),
            get_available_apache: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.cannot_reach_mirror', args: {} }),
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText('apache.install_now'));

        expect(await screen.findByText('apache.cannot_reach_mirror')).toBeInTheDocument();
        expect(await screen.findByText('install-wizard-stub:')).toBeInTheDocument();
    });

    it('shows the generic fetch-versions error toast when fetching available Apache versions throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }),
            get_available_apache: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText('apache.install_now'));

        expect(await screen.findByText('apache.fetch_versions_error')).toBeInTheDocument();
    });

    it('opens the global Apache config modal via the status-card config button', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByRole('button', { name: /apache\.config/ }));

        expect(await screen.findByText('apache-settings-stub')).toBeInTheDocument();
    });

    it('shows a generic system-error toast when installing Apache throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }),
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.62', url: 'https://example.com/2.4.62.zip' }],
            }),
            install_apache: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<ApacheMain />);

        await screen.findByText('apache.not_installed_title');
        await user.click(screen.getAllByText('apache.install_now')[0]);
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());

        await user.click(screen.getByText('apache.download_install'));

        expect(await screen.findByText('apache.system_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when uninstalling Apache throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ uninstall_apache: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);

        await user.click(await screen.findByText('apache.uninstall_server'));
        await user.click(screen.getByRole('button', { name: 'apache.yes_uninstall' }));

        expect(await screen.findByText('apache.uninstall_error')).toBeInTheDocument();
    });

    it('restores the minimized install-progress widget back into the modal', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }),
            get_available_apache: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ version: '2.4.62', url: 'https://example.com/2.4.62.zip' }],
            }),
            install_apache: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        renderWithToast(<ApacheMain />);

        await screen.findByText('apache.not_installed_title');
        await user.click(screen.getAllByText('apache.install_now')[0]);
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());
        await user.click(screen.getByText('apache.download_install'));

        await user.click(screen.getAllByLabelText('Close')[0]);
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', {
                detail: { source: 'ApacheManager', percent: 45, text: 'Installing...' },
            }));
        });
        const widget = await screen.findByRole('button', { name: /apache\.installing_apache/ });
        await user.click(widget);

        expect(await screen.findByText('apache.install_apache_server')).toBeInTheDocument();
    });
});
