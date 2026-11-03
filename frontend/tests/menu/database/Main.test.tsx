import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen, waitFor, within } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import DatabaseMain from '../../../src/menu/database/Main';

interface DbInstance {
    id: string; name: string; engine: 'mysql' | 'postgres' | 'redis'; version: string;
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
const redisDb: DbInstance = {
    id: 'db_3', name: 'Redis Server', engine: 'redis', version: '5.0.14',
    port: 6379, status: 'running', dataDir: 'C:/data/redis',
};

function apiWithDbs(dbs: DbInstance[]) {
    return { status: 'success', data: dbs };
}

describe('DatabaseMain', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    it('shows the empty state when there are no installed databases', async () => {
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([])) });
        renderWithToast(<DatabaseMain />);

        expect(await screen.findByText('database.no_instances_found')).toBeInTheDocument();
        expect(screen.getByText('database.no_instances_desc')).toBeInTheDocument();
        expect(screen.getByText('database.download_db_now')).toBeInTheDocument();
    });

    it('lists installed instances and filters them by engine tab', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb])) });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('MySQL');
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /database\.postgres/i }));

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
        let resolveInstall: any;
        const install = vi.fn().mockImplementation(() => new Promise(res => { resolveInstall = res; }));
        // Regresi: list database baru WAJIB ter-refresh begitu install_database() resolve sukses --
        // sebelumnya refresh-nya cuma dipicu dari sisi lain (event vylo_progress mencapai 100%),
        // bukan dari respons await install_database() itu sendiri. Kalau event progress akhir tidak
        // sempat "pas" 100% (race/urutan event), list tidak pernah ter-refresh meski instalasi
        // backend sebenarnya sukses -- database baru "menghilang" dari UI. Lihat docs/known_bugs.md.
        const getInstalled = vi.fn()
            .mockResolvedValueOnce(apiWithDbs([]))
            .mockResolvedValue(apiWithDbs([mysqlDb]));
        mockPywebviewApi({
            get_installed_databases: getInstalled,
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
        expect(await screen.findByText(/database\.downloading/i)).toBeInTheDocument();

        act(() => {
            resolveInstall({ status: 'success' });
        });

        // Wait for it to close
        await waitFor(() => expect(screen.queryByText(/database\.downloading/i)).not.toBeInTheDocument());

        // Inti dari regresi ini: database yang baru selesai diinstal benar-benar
        // MUNCUL di list (bukan cuma widget progress-nya yang tertutup).
        expect(getInstalled).toHaveBeenCalledTimes(2);
        expect(await screen.findByText('MySQL')).toBeInTheDocument();
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
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'database.mysql_mariadb' }));
        await user.click(screen.getByRole('option', { name: 'database.postgres' }));
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

        await user.click(screen.getByRole('button', { name: /database\.mysql_mariadb/i }));

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

    // ==========================================
    // Cek & eksekusi update versi engine per-instance
    // ==========================================

    it('shows an "Update" badge next to the instance name when a newer engine version exists', async () => {
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] }),
        });
        renderWithToast(<DatabaseMain />);

        // Badge di title kartu (pola sama persis dengan updateVer di php/Main.tsx) -- aksi
        // update sendiri ada sebagai item menu dropdown "Update to {{version}}", bukan tombol
        // langsung di badge-nya.
        expect(await screen.findByText('Update')).toBeInTheDocument();
        expect(screen.getByText('database.update_to')).toBeInTheDocument();
    });

    it('does not show the update badge when the installed version already matches the latest available version', async () => {
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: mysqlDb.version, url: 'https://example.com/mysql-8.0.zip', name: 'MariaDB 8.0' }] }),
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('MySQL');
        expect(screen.queryByText('Update')).not.toBeInTheDocument();
        expect(screen.queryByText('database.update_to')).not.toBeInTheDocument();
    });

    it('does not show the update badge when the installed version is NEWER than the latest reported (compareVersions, not string inequality)', async () => {
        // Regresi: perbandingan versi WAJIB pakai compareVersions() (numerik per-segmen),
        // bukan string inequality -- "8.0" vs "8.10" secara leksikografis TIDAK sama, tapi
        // "8.10" bukan versi lebih baru dari mis. "8.9". Di sini instance sudah di versi
        // yang LEBIH BARU dari yang dilaporkan "tersedia" -- tidak boleh muncul badge.
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([{ ...mysqlDb, version: '8.10' }])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.9', url: 'https://example.com/mysql-8.9.zip', name: 'MariaDB 8.9' }] }),
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('MySQL');
        expect(screen.queryByText('Update')).not.toBeInTheDocument();
    });

    it('checks for updates once per unique engine, not once per instance', async () => {
        const getAvailable = vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] });
        mockPywebviewApi({
            // Dua instance MySQL -- harus cukup SATU panggilan get_available_databases('mysql'),
            // bukan dua (lihat checkForUpdates() di Main.tsx: Array.from(new Set(engines))).
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, { ...mysqlDb, id: 'db_3', name: 'MySQL 2', port: 3307 }])),
            get_available_databases: getAvailable,
        });
        renderWithToast(<DatabaseMain />);

        await waitFor(() => expect(screen.getAllByText('Update')).toHaveLength(2));
        expect(getAvailable).toHaveBeenCalledTimes(1);
        expect(getAvailable).toHaveBeenCalledWith('mysql');
    });

    it('updates an installed instance through the confirm + backup-choice flow, with backup enabled', async () => {
        const user = userEvent.setup();
        const updateDb = vi.fn().mockResolvedValue({ status: 'success', message: 'database.update_success', args: {} });
        const getInstalled = vi.fn()
            .mockResolvedValueOnce(apiWithDbs([mysqlDb]))
            .mockResolvedValue(apiWithDbs([{ ...mysqlDb, version: '8.1' }]));
        mockPywebviewApi({
            get_installed_databases: getInstalled,
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] }),
            update_database: updateDb,
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('Update');
        await user.click(screen.getByText('database.update_to'));

        expect(await screen.findByText('database.confirm_update')).toBeInTheDocument();
        await user.click(screen.getByText('database.yes_update'));

        expect(await screen.findByText('database.backup_data_title')).toBeInTheDocument();
        await user.click(screen.getByText('database.yes_backup'));

        expect(updateDb).toHaveBeenCalledWith('db_1', '8.1', 'https://example.com/mysql-8.1.zip', true);
        expect(await screen.findByText('database.update_success')).toBeInTheDocument();
    });

    it('updates without a backup when the user chooses "No, Skip Backup"', async () => {
        const user = userEvent.setup();
        const updateDb = vi.fn().mockResolvedValue({ status: 'success', message: 'database.update_success', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] }),
            update_database: updateDb,
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('Update');
        await user.click(screen.getByText('database.update_to'));
        await screen.findByText('database.confirm_update');
        await user.click(screen.getByText('database.yes_update'));
        await screen.findByText('database.backup_data_title');
        await user.click(screen.getByText('database.no_backup'));

        expect(updateDb).toHaveBeenCalledWith('db_1', '8.1', 'https://example.com/mysql-8.1.zip', false);
    });

    it('aborts the update entirely (never calls update_database) when the user cancels the initial confirm step', async () => {
        const user = userEvent.setup();
        const updateDb = vi.fn();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] }),
            update_database: updateDb,
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('Update');
        await user.click(screen.getByText('database.update_to'));
        await screen.findByText('database.confirm_update');
        await user.click(screen.getByText('database.cancel_update'));

        await waitFor(() => expect(screen.queryByText('database.confirm_update')).not.toBeInTheDocument());
        expect(screen.queryByText('database.backup_data_title')).not.toBeInTheDocument();
        expect(updateDb).not.toHaveBeenCalled();
    });

    it('shows an error toast and keeps the update badge when update_database fails', async () => {
        const user = userEvent.setup();
        const updateDb = vi.fn().mockResolvedValue({ status: 'error', message: 'database.update_failed_rollback', args: {} });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
            get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.1', url: 'https://example.com/mysql-8.1.zip', name: 'MariaDB 8.1' }] }),
            update_database: updateDb,
        });
        renderWithToast(<DatabaseMain />);

        await screen.findByText('Update');
        await user.click(screen.getByText('database.update_to'));
        await screen.findByText('database.confirm_update');
        await user.click(screen.getByText('database.yes_update'));
        await screen.findByText('database.backup_data_title');
        await user.click(screen.getByText('database.yes_backup'));

        expect(await screen.findByText('database.update_failed_rollback')).toBeInTheDocument();
        // Badge tetap ada -- instance belum berhasil di-update, jadi aksi update harus bisa dicoba lagi.
        expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('toggles between card view and table view', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb])),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('MySQL');

        const tableBtn = screen.getByRole('button', { name: /Table View/i });
        const cardBtn = screen.getByRole('button', { name: /Card View/i });

        expect(cardBtn).toHaveAttribute('aria-pressed', 'true');
        expect(tableBtn).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();

        // Switch to Table View
        await user.click(tableBtn);
        expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
        expect(cardBtn).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByText('3306')).toBeInTheDocument();

        // Switch back to Card View
        await user.click(cardBtn);
        expect(cardBtn).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('integrates filter chips into the table toolbar when in table view', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb])),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('MySQL');

        // Switch to Table View
        const tableBtn = screen.getByRole('button', { name: /Table View/i });
        await user.click(tableBtn);
        expect(screen.getByRole('table')).toBeInTheDocument();

        // Chips are present in the table toolbar
        const pgChip = screen.getByRole('button', { name: /database\.postgres/i });
        expect(pgChip).toBeInTheDocument();

        // Filter by PostgreSQL inside table view
        await user.click(pgChip);
        expect(screen.queryByText('MySQL')).not.toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
        expect(screen.getByText('5432')).toBeInTheDocument();
    });

    it('filters by Redis tab and displays Redis instances', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([mysqlDb, pgDb, redisDb])),
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('Redis Server');
        expect(screen.getByText('MySQL')).toBeInTheDocument();

        const redisChip = screen.getByRole('button', { name: /^Redis/i });
        await user.click(redisChip);

        expect(screen.queryByText('MySQL')).not.toBeInTheDocument();
        expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument();
        expect(screen.getByText('Redis Server')).toBeInTheDocument();
        expect(screen.getByText('6379')).toBeInTheDocument();
        // Redis should not have "Manage Schemas" button
        expect(screen.queryByRole('button', { name: /database\.manage_schemas/i })).not.toBeInTheDocument();
    });

    it('opens schema manager modal and lists schemas', async () => {
        const user = userEvent.setup();
        const listSchemas = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'app_production', is_system: false },
                { name: 'information_schema', is_system: true },
            ],
        });
        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([pgDb])),
            list_database_schemas: listSchemas,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('PostgreSQL');

        const manageBtn = screen.getByTitle('database.manage_schemas');
        await user.click(manageBtn);

        expect(listSchemas).toHaveBeenCalledWith('db_2', '');
        expect(await screen.findByText('app_production')).toBeInTheDocument();
        expect(screen.getByText('information_schema')).toBeInTheDocument();
        expect(screen.getByText('database.system_db_badge')).toBeInTheDocument();
        expect(screen.getByText('database.schemas_count')).toBeInTheDocument();
        expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('creates a new schema successfully in schema manager', async () => {
        const user = userEvent.setup();
        const listSchemas = vi.fn()
            .mockResolvedValueOnce({
                status: 'success',
                data: [{ name: 'existing_db', is_system: false }],
            })
            .mockResolvedValue({
                status: 'success',
                data: [
                    { name: 'existing_db', is_system: false },
                    { name: 'brand_new_db', is_system: false },
                ],
            });
        const createSchema = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.database.schema_create_success',
            args: { name: 'brand_new_db' },
        });

        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([pgDb])),
            list_database_schemas: listSchemas,
            create_database_schema: createSchema,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('PostgreSQL');

        await user.click(screen.getByTitle('database.manage_schemas'));
        expect(await screen.findByText('existing_db')).toBeInTheDocument();

        const input = screen.getByPlaceholderText('database.placeholder_schema_name');
        await user.type(input, 'brand_new_db');

        const submitBtn = screen.getByRole('button', { name: /database\.create_schema_btn/i });
        await user.click(submitBtn);

        expect(createSchema).toHaveBeenCalledWith('db_2', 'brand_new_db', '');
        expect(await screen.findByText('brand_new_db')).toBeInTheDocument();
    });

    it('drops a user schema after confirmation in schema manager', async () => {
        const user = userEvent.setup();
        const listSchemas = vi.fn()
            .mockResolvedValueOnce({
                status: 'success',
                data: [
                    { name: 'app_test', is_system: false },
                    { name: 'information_schema', is_system: true },
                ],
            })
            .mockResolvedValue({
                status: 'success',
                data: [{ name: 'information_schema', is_system: true }],
            });
        const dropSchema = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.database.schema_drop_success',
            args: { name: 'app_test' },
        });

        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([pgDb])),
            list_database_schemas: listSchemas,
            drop_database_schema: dropSchema,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('PostgreSQL');

        await user.click(screen.getByTitle('database.manage_schemas'));
        expect(await screen.findByText('app_test')).toBeInTheDocument();

        // Click row drop button by title
        const dropBtn = screen.getByTitle('database.drop_schema');
        await user.click(dropBtn);

        // Confirmation modal appears with confirm button
        const confirmBtn = await screen.findByRole('button', { name: /database\.drop_schema/i });
        await user.click(confirmBtn);

        expect(dropSchema).toHaveBeenCalledWith('db_2', 'app_test', '');
    });

    it('exports and imports SQL schemas through schema modal', async () => {
        const user = userEvent.setup();
        const exportSchema = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.database.schema_export_success',
            args: { name: 'app_export', path: 'C:/exports/app_export.sql' },
        });
        const importSchema = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.database.schema_import_success',
            args: { name: 'app_export', path: 'C:/exports/app_export.sql' },
        });

        mockPywebviewApi({
            get_installed_databases: vi.fn().mockResolvedValue(apiWithDbs([pgDb])),
            list_database_schemas: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ name: 'app_export', is_system: false }],
            }),
            browse_save_file: vi.fn().mockResolvedValue('C:/exports/app_export.sql'),
            browse_open_file: vi.fn().mockResolvedValue('C:/exports/app_export.sql'),
            export_database_schema: exportSchema,
            import_database_schema: importSchema,
        });
        renderWithToast(<DatabaseMain />);
        await screen.findByText('PostgreSQL');

        await user.click(screen.getByTitle('database.manage_schemas'));
        expect(await screen.findByText('app_export')).toBeInTheDocument();

        // Test Export
        const exportBtn = screen.getByTitle('database.export_sql');
        await user.click(exportBtn);
        expect(exportSchema).toHaveBeenCalledWith('db_2', 'app_export', 'C:/exports/app_export.sql', '');

        // Test Import
        const importBtn = screen.getByTitle('database.import_sql');
        await user.click(importBtn);
        expect(importSchema).toHaveBeenCalledWith('db_2', 'app_export', 'C:/exports/app_export.sql', '');
    });
});
