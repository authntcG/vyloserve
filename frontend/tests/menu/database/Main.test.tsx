import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import DatabaseMain from '../../../src/menu/database/Main';

interface DbInstance {
    id: string; name: string; engine: 'mysql' | 'postgres'; version: string;
    port: number; status: 'running' | 'stopped'; dataDir: string;
}

const mysqlDb: DbInstance = {
    id: 'db_1', name: 'MySQL', engine: 'mysql', version: '8.0',
    port: 3306, status: 'stopped', dataDir: 'C:/data/mysql',
};
const pgDb: DbInstance = {
    id: 'db_2', name: 'PostgreSQL', engine: 'postgres', version: '16',
    port: 5432, status: 'running', dataDir: 'C:/data/pg',
};

function apiWithDbs(dbs: DbInstance[]) {
    return { status: 'success', data: dbs };
}

describe('DatabaseMain', () => {
    it('shows the empty state when there are no installed databases', async () => {
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])) });
        renderWithToast(<DatabaseMain />);

        expect(await screen.findByText('database.no_instances_found')).toBeInTheDocument();
    });

    it('lists installed instances and filters them by engine tab', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb])) });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('MySQL');
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'database.postgres' }));

        expect(screen.queryByText('MySQL')).not.toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    it('shows a toast when fetching installed databases throws', async () => {
        mockPywebviewApi({ get_installed_databases: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<DatabaseMain />);

        expect(await screen.findByText('database.fetch_db_error')).toBeInTheDocument();
    });

    it('starts a stopped instance and shows a success toast', async () => {
        const user = userEvent.setup();
        const startDb = vi.fn().mockResolvedValue({ status: 'success', message: 'database.started', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn()
                .mockResolvedValueOnce(apiWithDbs([mysqlDb]))
                .mockResolvedValue(apiWithDbs([{ ...mysqlDb, status: 'running' }])),
            start_database: startDb,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByRole('button', { name: /database.start_db/ });

        await user.click(screen.getByRole('button', { name: /database.start_db/ }));

        expect(startDb).toHaveBeenCalledWith('db_1');
        expect(await screen.findByText('database.started')).toBeInTheDocument();
        await screen.findByRole('button', { name: /database.stop_db/ });
    });

    it('shows an error toast when toggling status fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            start_database: vi.fn().mockResolvedValue({ status: 'error', message: 'database.start_failed', args: {} }),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByRole('button', { name: /database.start_db/ });

        await user.click(screen.getByRole('button', { name: /database.start_db/ }));

        expect(await screen.findByText('database.start_failed')).toBeInTheDocument();
    });

    it('opens the settings modal, loads config, and blocks saving with a toast on a port conflict', async () => {
        const user = userEvent.setup();
        const saveConfig = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb])),
            get_db_config: vi.fn().mockResolvedValue({ status: 'success', config: { port: 5432 } }),
            save_db_config: saveConfig,
        });
        renderWithToast(<DatabaseMain />);
        await waitFor(() => expect(screen.getAllByText('database.config')).toHaveLength(2));

        await user.click(screen.getAllByText('database.config')[0]);
        await waitFor(() => expect(screen.getByLabelText('database.port')).toHaveValue(5432));
        await user.click(screen.getByText('database.save_changes'));

        expect(saveConfig).not.toHaveBeenCalled();
        expect(await screen.findByText('database.port_used_other')).toBeInTheDocument();
    });

    it('saves settings successfully and closes the modal', async () => {
        const user = userEvent.setup();
        const saveConfig = vi.fn().mockResolvedValue({ status: 'success', message: 'database.config_saved', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_db_config: vi.fn().mockResolvedValue({ status: 'success', config: { port: 3306 } }),
            save_db_config: saveConfig,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.config');
        await user.click(screen.getByText('database.config'));
        await waitFor(() => expect(screen.getByText('database.save_changes')).not.toBeDisabled());

        await user.click(screen.getByText('database.save_changes'));

        expect(saveConfig).toHaveBeenCalledWith('db_1', expect.objectContaining({ port: 3306 }));
        expect(await screen.findByText('database.config_saved')).toBeInTheDocument();
    });

    it('confirms uninstall with the delete-raw-data flag and refetches on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success', message: 'database.dropped', args: {} });
        const getInstalled = vi.fn()
            .mockResolvedValueOnce(apiWithDbs([mysqlDb]))
            .mockResolvedValue(apiWithDbs([]));
        mockPywebviewApi({ get_installed_databases: getInstalled, uninstall_database: uninstall });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.drop_engine');

        await user.click(screen.getByText('database.drop_engine'));
        expect(await screen.findByText('database.drop_db_title')).toBeInTheDocument();
        await user.click(screen.getByLabelText('database.delete_raw_data'));
        await user.click(screen.getByText('database.yes_drop'));

        expect(uninstall).toHaveBeenCalledWith('db_1', true);
        expect(await screen.findByText('database.dropped')).toBeInTheDocument();
    });

    it('opens the change-password modal for the selected instance and submits via ChangePassword', async () => {
        const user = userEvent.setup();
        const changeCreds = vi.fn().mockResolvedValue({ status: 'success', message: 'database.password_changed', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([{ ...mysqlDb, status: 'running' }])),
            change_db_credentials: changeCreds,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.change_password');
        await user.click(screen.getByText('database.change_password'));

        fireEvent.change(await screen.findByLabelText('database.new_password'), { target: { value: 'newpass' } });
        await user.click(screen.getByText('database.update_password'));

        expect(changeCreds).toHaveBeenCalledWith('db_1', 'root', '', 'newpass');
        expect(await screen.findByText('database.password_changed')).toBeInTheDocument();
    });

    it('opens the config-file/data-folder shortcuts via the dropdown actions', async () => {
        const user = userEvent.setup();
        const openConf = vi.fn();
        const openDir = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            open_db_config_file: openConf,
            open_db_dir: openDir,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.open_my_ini');

        await user.click(screen.getByText('database.open_my_ini'));
        await user.click(screen.getByText('database.open_data_folder'));

        expect(openConf).toHaveBeenCalledWith('db_1');
        expect(openDir).toHaveBeenCalledWith('db_1');
    });

    it('shows the startup log content in-app when "startup log" is clicked from the dropdown', async () => {
        const user = userEvent.setup();
        const getLogContent = vi.fn().mockResolvedValue({ status: 'success', data: 'server started ok' });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_database_log_content: getLogContent,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('settings.log_file_startup');

        await user.click(screen.getByText('settings.log_file_startup'));

        expect(getLogContent).toHaveBeenCalledWith('db_1', 'startup');
        expect(await screen.findByText('server started ok')).toBeInTheDocument();
    });

    it('shows a "native log" dropdown item for MySQL instances and fetches it when clicked', async () => {
        const user = userEvent.setup();
        const getLogContent = vi.fn().mockResolvedValue({ status: 'success', data: '[ERROR] InnoDB issue' });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_database_log_content: getLogContent,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('settings.log_file_native');

        await user.click(screen.getByText('settings.log_file_native'));

        expect(getLogContent).toHaveBeenCalledWith('db_1', 'native');
        expect(await screen.findByText('[ERROR] InnoDB issue')).toBeInTheDocument();
    });

    it('does not show a "native log" dropdown item for PostgreSQL instances (no native log file)', async () => {
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([pgDb])) });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('settings.log_file_startup');

        expect(screen.queryByText('settings.log_file_native')).not.toBeInTheDocument();
    });

    it('installs a new instance with the selected version and shows the progress widget while installing', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ name: 'MySQL 8.0', version: '8.0', url: 'https://example.com/mysql-8.0.zip' }] }),
            check_port_in_use: vi.fn().mockResolvedValue(false),
            install_database: install,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('database.install_btn'));

        await waitFor(() => expect(install).toHaveBeenCalledWith('mysql', '8.0', 'https://example.com/mysql-8.0.zip', 3306, ''));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'DatabaseManager', percent: 50, text: 'database.downloading' } }));
        });
        expect(await screen.findByText('database.downloading')).toBeInTheDocument();
    });

    it('blocks installation with a toast when the chosen port is already in use locally', async () => {
        const user = userEvent.setup();
        const install = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ name: 'MySQL 8.0', version: '8.0', url: 'https://example.com/mysql-8.0.zip' }] }),
            check_port_in_use: vi.fn().mockResolvedValue(false),
            install_database: install,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('database.install_btn'));

        expect(install).not.toHaveBeenCalled();
        expect(await screen.findByText('database.port_used')).toBeInTheDocument();
    });

    it('requires a superuser password before installing a postgres instance', async () => {
        const user = userEvent.setup();
        const install = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ name: 'PostgreSQL 16', version: '16', url: 'https://example.com/pg-16.zip' }] }),
            install_database: install,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));
        await user.selectOptions(screen.getByDisplayValue('database.mysql_mariadb'), 'postgres');
        await screen.findByText('PostgreSQL 16');

        await user.click(screen.getByText('database.install_btn'));

        expect(install).not.toHaveBeenCalled();
        expect(await screen.findByText('database.pg_password_required')).toBeInTheDocument();
    });

    it('filters by the MySQL/MariaDB tab', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb])) });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('MySQL');

        await user.click(screen.getByRole('button', { name: 'database.mysql_mariadb' }));

        expect(screen.getByText('MySQL')).toBeInTheDocument();
        expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument();
    });

    it('shows a generic error toast when toggling a database instance throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            start_database: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByRole('button', { name: /database.start_db/ });

        await user.click(screen.getByRole('button', { name: /database.start_db/ }));

        expect(await screen.findByText('database.toggle_status_error')).toBeInTheDocument();
    });

    it('shows an error toast and does not call install_database when the new-instance form has no version selected', async () => {
        const user = userEvent.setup();
        const install = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            install_database: install,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));

        await user.click(screen.getByText('database.install_btn'));

        expect(install).not.toHaveBeenCalled();
        expect(await screen.findByText('database.read_install_data_error')).toBeInTheDocument();
    });

    it('shows the API-provided error and stops installing when install_database reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ name: 'MySQL 8.0', version: '8.0', url: 'https://example.com/mysql-8.0.zip' }] }),
            check_port_in_use: vi.fn().mockResolvedValue(false),
            install_database: vi.fn().mockResolvedValue({ status: 'error', message: 'database.install_conflict', args: {} }),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('database.install_btn'));

        expect(await screen.findByText('database.install_conflict')).toBeInTheDocument();
    });

    it('shows a generic install-error toast when install_database throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ name: 'MySQL 8.0', version: '8.0', url: 'https://example.com/mysql-8.0.zip' }] }),
            check_port_in_use: vi.fn().mockResolvedValue(false),
            install_database: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('database.install_btn'));

        expect(await screen.findByText('database.install_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when confirming uninstall throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            uninstall_database: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.drop_engine');
        await user.click(screen.getByText('database.drop_engine'));
        await screen.findByText('database.yes_drop');

        await user.click(screen.getByText('database.yes_drop'));

        expect(await screen.findByText('database.delete_error')).toBeInTheDocument();
    });

    it('shows the API-provided error when confirming uninstall reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            uninstall_database: vi.fn().mockResolvedValue({ status: 'error', message: 'database.uninstall_conflict', args: {} }),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.drop_engine');
        await user.click(screen.getByText('database.drop_engine'));
        await screen.findByText('database.yes_drop');

        await user.click(screen.getByText('database.yes_drop'));

        expect(await screen.findByText('database.uninstall_conflict')).toBeInTheDocument();
    });

    it('shows the API-provided error when opening settings fails to load the config', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_db_config: vi.fn().mockResolvedValue({ status: 'error', message: 'database.config_denied', args: {} }),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.config');

        await user.click(screen.getByText('database.config'));

        expect(await screen.findByText('database.config_denied')).toBeInTheDocument();
    });

    it('shows a generic error toast when fetching settings config throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_db_config: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.config');

        await user.click(screen.getByText('database.config'));

        expect(await screen.findByText('database.fetch_config_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when saving settings throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_db_config: vi.fn().mockResolvedValue({ status: 'success', config: { port: 3306 } }),
            save_db_config: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.config');
        await user.click(screen.getByText('database.config'));
        await waitFor(() => expect(screen.getByText('database.save_changes')).not.toBeDisabled());

        await user.click(screen.getByText('database.save_changes'));

        expect(await screen.findByText('database.save_error')).toBeInTheDocument();
    });

    it('edits a config field in the settings modal and saves the updated value', async () => {
        const user = userEvent.setup();
        const saveConfig = vi.fn().mockResolvedValue({ status: 'success', message: 'database.config_saved', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_db_config: vi.fn().mockResolvedValue({ status: 'success', config: { port: 3306 } }),
            save_db_config: saveConfig,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.config');
        await user.click(screen.getByText('database.config'));
        await screen.findByLabelText('bind-address');

        fireEvent.change(screen.getByLabelText('bind-address'), { target: { value: '0.0.0.0' } });
        await user.click(screen.getByText('database.save_changes'));

        expect(saveConfig).toHaveBeenCalledWith('db_1', expect.objectContaining({ port: 3306, bind_address: '0.0.0.0' }));
    });

    it('ignores progress events from other modules, tracks real progress, and resets installing state on a negative percent', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('database.add_engine');
        await user.click(screen.getByText('database.add_engine'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 50, text: 'wrong module' } }));
        });
        expect(screen.queryByText('wrong module')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'DatabaseManager', percent: 50, text: 'Downloading...' } }));
        });
        expect(await screen.findByText('Downloading...')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();

        // Two consecutive 100% events exercise the "cancel the previous auto-hide timer,
        // then reschedule it" branch (see the code comment on hideProgressTimeoutRef).
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'DatabaseManager', percent: 100, text: 'Finishing...' } }));
        });
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'DatabaseManager', percent: 100, text: 'Still finishing...' } }));
        });
        expect(await screen.findByText('Still finishing...')).toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'DatabaseManager', percent: -1 } }));
        });
        expect(screen.queryByText('Still finishing...')).not.toBeInTheDocument();
    });
});
