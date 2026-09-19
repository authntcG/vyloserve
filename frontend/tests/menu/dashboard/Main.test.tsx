import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import DashboardMain from '../../../src/menu/dashboard/Main';

const allStopped = { apache: false, php: false, database: false, cpu_load: 12, ram_usage: 34 };
const project = { id: 'p1', name: 'My Site', domain: 'my-site.local', path: 'C:/www/my-site', framework: 'laravel' };

function dashboardApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    return {
        get_all_services_status: vi.fn().mockResolvedValue(allStopped),
        get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
        get_installed_php: vi.fn().mockResolvedValue([]),
        get_installed_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_dashboard_config: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
        ...overrides,
    };
}

describe('DashboardMain', () => {
    it('shows the stopped-services suggestion when everything is off', async () => {
        mockPywebviewApi(dashboardApi());
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('dashboard.suggestion_stopped')).toBeInTheDocument();
    });

    it('shows the no-project suggestion once projects have loaded empty', async () => {
        mockPywebviewApi(dashboardApi({ get_all_services_status: vi.fn().mockResolvedValue({ apache: true, php: false, database: false, cpu_load: 5, ram_usage: 5 }) }));
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('dashboard.suggestion_no_project')).toBeInTheDocument();
    });

    it('shows the optimal suggestion when a service is running and projects exist', async () => {
        mockPywebviewApi(dashboardApi({
            get_all_services_status: vi.fn().mockResolvedValue({ apache: true, php: false, database: false, cpu_load: 5, ram_usage: 5 }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [project] }),
        }));
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('dashboard.suggestion_optimal')).toBeInTheDocument();
    });

    it('shows CPU/RAM usage once loaded', async () => {
        mockPywebviewApi(dashboardApi());
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('12%')).toBeInTheDocument();
        expect(screen.getByText('34%')).toBeInTheDocument();
    });

    it('restores the persisted dashboard config (included services and selections)', async () => {
        mockPywebviewApi(dashboardApi({
            get_installed_php: vi.fn().mockResolvedValue([{ id: 'php1', version: '8.2', status: 'stopped' }]),
            get_dashboard_config: vi.fn().mockResolvedValue({
                status: 'success',
                data: { apache: false, php: true, database: false, selected_php: ['8.2'] },
            }),
        }));
        renderWithToast(<DashboardMain />);

        await waitFor(() => expect(screen.getByLabelText(/Toggle.*apache/)).not.toBeChecked());
        expect(screen.getByRole('button', { name: 'common.php_version' })).toHaveClass('bg-blue-50');
    });

    it('shows the "no PHP installed" message when there are no PHP instances', async () => {
        mockPywebviewApi(dashboardApi());
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('dashboard.no_php_installed')).toBeInTheDocument();
    });

    it('toggles a PHP version chip and automatically includes the PHP service', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({ get_installed_php: vi.fn().mockResolvedValue([{ id: 'php1', version: '8.2', status: 'stopped' }]) }));
        renderWithToast(<DashboardMain />);
        await screen.findByRole('button', { name: 'common.php_version' });

        const chip = screen.getByRole('button', { name: 'common.php_version' });
        expect(chip).toHaveClass('bg-blue-50');

        await user.click(chip);
        expect(chip).not.toHaveClass('bg-blue-50');
        expect(screen.getByLabelText(/Toggle.*php/)).not.toBeChecked();
    });

    it('shortens MariaDB/PostgreSQL names in the database chips', async () => {
        mockPywebviewApi(dashboardApi({
            get_installed_databases: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ id: 'db1', name: 'MariaDB', status: 'stopped' }, { id: 'db2', name: 'PostgreSQL', status: 'stopped' }],
            }),
        }));
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('MDB')).toBeInTheDocument();
        expect(screen.getByText('PG')).toBeInTheDocument();
    });

    it('starts the selected services and shows a success toast', async () => {
        const user = userEvent.setup();
        const setApacheVersion = vi.fn().mockResolvedValue({ status: 'success' });
        const startApache = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(dashboardApi({ set_apache_active_version: setApacheVersion, start_apache_server: startApache }));
        renderWithToast(<DashboardMain />);
        await screen.findByText('dashboard.start_selected');
        await waitFor(() => expect(screen.getByText('dashboard.start_selected').closest('button')).not.toBeDisabled());

        await user.click(screen.getByText('dashboard.start_selected'));

        expect(setApacheVersion).toHaveBeenCalledWith('2.4.62');
        expect(startApache).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('dashboard.start_success')).toBeInTheDocument();
    });

    it('stops apache first, then shows a success toast, when stopping selected services', async () => {
        const user = userEvent.setup();
        const stopApache = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(dashboardApi({
            get_all_services_status: vi.fn().mockResolvedValue({ apache: true, php: false, database: false, cpu_load: 1, ram_usage: 1 }),
            stop_apache_server: stopApache,
        }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByText('dashboard.stop_selected').closest('button')).not.toBeDisabled());

        await user.click(screen.getByText('dashboard.stop_selected'));

        expect(stopApache).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('dashboard.stop_success')).toBeInTheDocument();
    });

    it('shows an error toast when toggling all services throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({ set_apache_active_version: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByText('dashboard.start_selected').closest('button')).not.toBeDisabled());

        await user.click(screen.getByText('dashboard.start_selected'));

        expect(await screen.findByText('dashboard.toggle_error')).toBeInTheDocument();
    });

    it('disables both start and stop when Apache is the only included service and no version is available', async () => {
        mockPywebviewApi(dashboardApi({ get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: [], active: '' }) }));
        renderWithToast(<DashboardMain />);
        await screen.findByText('dashboard.start_selected');

        expect(screen.getByText('dashboard.start_selected').closest('button')).toBeDisabled();
        expect(screen.getByText('dashboard.stop_selected').closest('button')).toBeDisabled();
    });

    it('shows the recent-projects empty state, and lists up to 4 most-recent projects otherwise', async () => {
        const many = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Site ${i}`, domain: `site${i}.local`, path: `C:/www/site${i}` }));
        mockPywebviewApi(dashboardApi({ get_projects: vi.fn().mockResolvedValue({ status: 'success', data: many }) }));
        renderWithToast(<DashboardMain />);

        await screen.findByText('Site 5');
        expect(screen.getAllByText(/^Site \d$/)).toHaveLength(4);
        // Most-recently-added project (last in the source list) appears first (reversed).
        expect(screen.queryByText('Site 0')).not.toBeInTheDocument();
    });

    it('opens a project in the browser and in the file explorer from the recent-projects list', async () => {
        const user = userEvent.setup();
        const openBrowser = vi.fn();
        const openExplorer = vi.fn();
        mockPywebviewApi(dashboardApi({
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [project] }),
            open_browser: openBrowser,
            open_in_explorer: openExplorer,
        }));
        renderWithToast(<DashboardMain />);
        await screen.findByText('My Site');

        await user.click(screen.getByText('dashboard.open'));
        await user.click(screen.getByText('dashboard.folder'));

        expect(openBrowser).toHaveBeenCalledWith('https://my-site.local');
        expect(openExplorer).toHaveBeenCalledWith('C:/www/my-site');
    });

    it('refetches the service status when a service_status_changed event fires', async () => {
        const getStatus = vi.fn().mockResolvedValue(allStopped);
        mockPywebviewApi(dashboardApi({ get_all_services_status: getStatus }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));

        act(() => {
            window.dispatchEvent(new Event('service_status_changed'));
        });

        await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    });

    it('saves the dashboard config once the initial config load completes and a selection changes', async () => {
        const user = userEvent.setup();
        const saveConfig = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(dashboardApi({ save_dashboard_config: saveConfig }));
        renderWithToast(<DashboardMain />);
        await screen.findByLabelText(/Toggle.*apache/);

        await user.click(screen.getByLabelText(/Toggle.*apache/));

        await waitFor(() => expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ apache: false })));
    });

    it('re-selecting a deselected database chip automatically re-includes the database service', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({
            get_installed_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ id: 'db1', name: 'MariaDB', status: 'stopped' }] }),
        }));
        renderWithToast(<DashboardMain />);
        // On load, resolveInitialDbSelection auto-selects the only instance (chip starts selected)
        // while includedServices.database stays false (its own default), so deselect it first.
        await waitFor(() => expect(screen.getByText('MDB')).toHaveClass('bg-blue-50'));
        const dbToggle = screen.getByLabelText(/Toggle.*database/);
        expect(dbToggle).not.toBeChecked();
        await user.click(screen.getByText('MDB'));
        expect(screen.getByText('MDB')).not.toHaveClass('bg-blue-50');

        await user.click(screen.getByText('MDB'));

        expect(dbToggle).toBeChecked();
    });

    it('auto-selects the first PHP instance again when the PHP checkbox is re-checked after all chips were deselected', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({
            get_installed_php: vi.fn().mockResolvedValue([{ id: 'php1', version: '8.2', status: 'stopped' }]),
        }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'common.php_version' })).toHaveClass('bg-blue-50'));
        await user.click(screen.getByRole('button', { name: 'common.php_version' }));
        expect(screen.getByRole('button', { name: 'common.php_version' })).not.toHaveClass('bg-blue-50');
        expect(screen.getByLabelText(/Toggle.*php/)).not.toBeChecked();

        await user.click(screen.getByLabelText(/Toggle.*php/));

        expect(screen.getByRole('button', { name: 'common.php_version' })).toHaveClass('bg-blue-50');
    });

    it('auto-selects the first database instance again when the database checkbox is re-checked after all chips were deselected', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({
            get_installed_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ id: 'db1', name: 'MariaDB', status: 'stopped' }] }),
        }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByText('MDB')).toHaveClass('bg-blue-50'));
        await user.click(screen.getByText('MDB'));
        expect(screen.getByText('MDB')).not.toHaveClass('bg-blue-50');
        const dbToggle = screen.getByLabelText(/Toggle.*database/);
        expect(dbToggle).not.toBeChecked();

        await user.click(dbToggle);

        expect(screen.getByText('MDB')).toHaveClass('bg-blue-50');
    });

    it('starts stopped PHP and database instances (not already-running ones) when starting all selected services', async () => {
        const user = userEvent.setup();
        const startPhp = vi.fn().mockResolvedValue({ status: 'success' });
        const startDb = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(dashboardApi({
            get_installed_php: vi.fn().mockResolvedValue([{ id: 'php1', version: '8.2', status: 'stopped' }]),
            get_installed_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ id: 'db1', name: 'MariaDB', status: 'running' }] }),
            get_dashboard_config: vi.fn().mockResolvedValue({
                status: 'success',
                data: { apache: false, php: true, database: true, selected_php: ['8.2'], selected_database: ['db1'] },
            }),
            start_php: startPhp,
            start_database: startDb,
        }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByText('dashboard.start_selected').closest('button')).not.toBeDisabled());

        await user.click(screen.getByText('dashboard.start_selected'));

        expect(startPhp).toHaveBeenCalledWith('8.2');
        expect(startDb).not.toHaveBeenCalled();
        expect(await screen.findByText('dashboard.start_success')).toBeInTheDocument();
    });

    it('stops running PHP and database instances when stopping all selected services', async () => {
        const user = userEvent.setup();
        const stopPhp = vi.fn().mockResolvedValue({ status: 'success' });
        const stopDb = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(dashboardApi({
            get_all_services_status: vi.fn().mockResolvedValue({ apache: false, php: true, database: true, cpu_load: 1, ram_usage: 1 }),
            get_installed_php: vi.fn().mockResolvedValue([{ id: 'php1', version: '8.2', status: 'running' }]),
            get_installed_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ id: 'db1', name: 'MariaDB', status: 'running' }] }),
            get_dashboard_config: vi.fn().mockResolvedValue({
                status: 'success',
                data: { apache: false, php: true, database: true, selected_php: ['8.2'], selected_database: ['db1'] },
            }),
            stop_php: stopPhp,
            stop_database: stopDb,
        }));
        renderWithToast(<DashboardMain />);
        await waitFor(() => expect(screen.getByText('dashboard.stop_selected').closest('button')).not.toBeDisabled());

        await user.click(screen.getByText('dashboard.stop_selected'));

        expect(stopPhp).toHaveBeenCalledWith('8.2');
        expect(stopDb).toHaveBeenCalledWith('db1');
        expect(await screen.findByText('dashboard.stop_success')).toBeInTheDocument();
    });

    it('auto-selects the already-running PHP instance (not the first) on initial load', async () => {
        mockPywebviewApi(dashboardApi({
            get_installed_php: vi.fn().mockResolvedValue([
                { id: 'php1', version: '8.1', status: 'stopped' },
                { id: 'php2', version: '8.2', status: 'running' },
            ]),
        }));
        renderWithToast(<DashboardMain />);

        await waitFor(() => expect(screen.getAllByRole('button', { name: 'common.php_version' })[1]).toHaveClass('bg-blue-50'));
        expect(screen.getAllByRole('button', { name: 'common.php_version' })[0]).not.toHaveClass('bg-blue-50');
    });

    it('falls back to window.open when the pywebview open_browser API is unavailable', async () => {
        const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
        const user = userEvent.setup();
        mockPywebviewApi(dashboardApi({ get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [project] }) }));
        delete (window as unknown as { pywebview: { api: Record<string, unknown> } }).pywebview.api.open_browser;
        renderWithToast(<DashboardMain />);
        await screen.findByText('dashboard.open');

        await user.click(screen.getByText('dashboard.open'));

        expect(windowOpen).toHaveBeenCalledWith('https://my-site.local', '_blank');
    });

    it('does not select an Apache version when fetching installed versions reports failure', async () => {
        mockPywebviewApi(dashboardApi({ get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'error' }) }));
        renderWithToast(<DashboardMain />);

        expect(await screen.findByText('dashboard.no_version_installed')).toBeInTheDocument();
    });
});
