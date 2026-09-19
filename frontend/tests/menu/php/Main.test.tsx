import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import PhpMain from '../../../src/menu/php/Main';

const instance = {
    id: 'php_1', name: 'PHP 8.2', version: '8.2', port: 9000,
    status: 'stopped' as const, dir: 'C:/php/8.2', memory_limit: '256M',
};

describe('PhpMain', () => {
    it('shows a loading skeleton, then the instance list once fetched', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([instance]) });
        renderWithToast(<PhpMain />);

        expect(await screen.findByText('PHP 8.2')).toBeInTheDocument();
    });

    it('shows the empty state when there are no installed instances', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<PhpMain />);

        expect(await screen.findByText('php.no_php_versions_installed')).toBeInTheDocument();
    });

    it('shows a toast when fetching installed instances throws', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<PhpMain />);

        expect(await screen.findByText('php.fetch_php_data_error')).toBeInTheDocument();
    });

    it('starts a stopped instance and dispatches service_status_changed on success', async () => {
        const user = userEvent.setup();
        const startPhp = vi.fn().mockResolvedValue({ status: 'success', message: 'php.started', args: {} });
        mockPywebviewApi({
            get_installed_php: vi.fn()
                .mockResolvedValueOnce([instance])
                .mockResolvedValue([{ ...instance, status: 'running' }]),
            start_php: startPhp,
        });
        const listener = vi.fn();
        window.addEventListener('service_status_changed', listener);
        renderWithToast(<PhpMain />);
        await screen.findByRole('button', { name: /php.start_cgi/ });

        await user.click(screen.getByRole('button', { name: /php.start_cgi/ }));

        expect(startPhp).toHaveBeenCalledWith('8.2');
        expect(await screen.findByText('php.started')).toBeInTheDocument();
        await screen.findByRole('button', { name: /php.stop_cgi/ });
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('service_status_changed', listener);
    });

    it('shows an error toast and keeps the previous status when toggling fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            start_php: vi.fn().mockResolvedValue({ status: 'error', message: 'php.start_failed', args: {} }),
        });
        renderWithToast(<PhpMain />);
        await screen.findByRole('button', { name: /php.start_cgi/ });

        await user.click(screen.getByRole('button', { name: /php.start_cgi/ }));

        expect(await screen.findByText('php.start_failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /php.start_cgi/ })).toBeInTheDocument();
    });

    it('opens the settings modal, loads the config, and saves changes', async () => {
        const user = userEvent.setup();
        const saveConfig = vi.fn().mockResolvedValue({ status: 'success', message: 'php.config_saved', args: {} });
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            get_php_config: vi.fn().mockResolvedValue({
                status: 'success',
                config: { port: 9000, memory_limit: '256M', max_execution_time: '30', upload_max_filesize: '64M', post_max_size: '64M' },
                extensions: [{ name: 'curl', active: true }],
            }),
            save_php_config: saveConfig,
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.config');

        await user.click(screen.getByText('php.config'));
        await screen.findByText('curl');
        await user.click(screen.getByText('php.save_changes'));

        expect(saveConfig).toHaveBeenCalledWith('8.2', expect.objectContaining({ port: 9000 }), ['curl']);
        expect(await screen.findByText('php.config_saved')).toBeInTheDocument();
    });

    it('disables the settings Apply button, without calling the API, when the port collides with another instance', async () => {
        const user = userEvent.setup();
        const otherInstance = { ...instance, id: 'php_2', name: 'PHP 8.3', version: '8.3', port: 9001 };
        const saveConfig = vi.fn();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance, otherInstance]),
            get_php_config: vi.fn().mockResolvedValue({
                status: 'success',
                config: { port: 9001, memory_limit: '256M', max_execution_time: '30', upload_max_filesize: '64M', post_max_size: '64M' },
                extensions: [],
            }),
            save_php_config: saveConfig,
        });
        renderWithToast(<PhpMain />);
        await waitFor(() => expect(screen.getAllByText('php.config')).toHaveLength(2));

        await user.click(screen.getAllByText('php.config')[0]);
        await screen.findByText('php.save_changes');
        await user.click(screen.getByText('php.save_changes'));

        expect(saveConfig).not.toHaveBeenCalled();
        expect(screen.getByText('php.save_changes')).toBeDisabled();
    });

    it('confirms uninstall, calls the API, and refetches the instance list on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success', message: 'php.uninstalled', args: {} });
        const getInstalled = vi.fn().mockResolvedValueOnce([instance]).mockResolvedValueOnce([]);
        mockPywebviewApi({ get_installed_php: getInstalled, uninstall_php: uninstall });
        renderWithToast(<PhpMain />);
        await screen.findByText('PHP 8.2');

        await user.click(screen.getByText('php.uninstall'));
        expect(await screen.findByText('php.confirm_uninstall')).toBeInTheDocument();
        await user.click(screen.getByText('php.yes_uninstall'));

        expect(uninstall).toHaveBeenCalledWith('8.2');
        expect(await screen.findByText('php.uninstalled')).toBeInTheDocument();
        await waitFor(() => expect(getInstalled).toHaveBeenCalledTimes(2));
    });

    it('opens the file/directory shortcuts via the dropdown actions', async () => {
        const user = userEvent.setup();
        const openIni = vi.fn();
        const openDir = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([instance]), open_php_ini: openIni, open_php_dir: openDir });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.open_php_ini');

        await user.click(screen.getByText('php.open_php_ini'));
        await user.click(screen.getByText('php.open_directory'));

        expect(openIni).toHaveBeenCalledWith('8.2');
        expect(openDir).toHaveBeenCalledWith('8.2');
    });

    it('warns without calling install_php when no version is selected in the add-new modal', async () => {
        const user = userEvent.setup();
        const install = vi.fn();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            install_php: install,
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));

        await user.click(screen.getByText('php.install_and_configure'));

        expect(install).not.toHaveBeenCalled();
    });

    it('installs the selected version and refetches the instance list on success', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success', message: 'php.installed', args: {} });
        const getInstalled = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([instance]);
        mockPywebviewApi({
            get_installed_php: getInstalled,
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.2', filename: 'php-8.2.zip' }] }),
            install_php: install,
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));
        await waitFor(() => expect(screen.getByText('php.install_and_configure')).not.toBeDisabled());

        await user.click(screen.getByText('php.install_and_configure'));

        expect(install).toHaveBeenCalledWith('8.2', 'php-8.2.zip', 9000);
        expect(await screen.findByText('php.installed')).toBeInTheDocument();
        await waitFor(() => expect(getInstalled).toHaveBeenCalledTimes(2));
    });

    it('shows the progress bar only for PhpManager-sourced progress events while installing', async () => {
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.2', filename: 'php-8.2.zip' }] }),
            install_php: vi.fn().mockReturnValue(new Promise(() => {})),
        });
        const user = userEvent.setup();
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));
        await waitFor(() => expect(screen.getByText('php.install_and_configure')).not.toBeDisabled());
        await user.click(screen.getByText('php.install_and_configure'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 40, text: 'php.downloading' } }));
        });

        expect(await screen.findByText('php.downloading')).toBeInTheDocument();
    });

    it('opens the install modal via the empty-state action button', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.download_now');

        await user.click(screen.getByText('php.download_now'));

        expect(await screen.findByText('php.install_php_version')).toBeInTheDocument();
    });

    it('disables the install Apply button, without installing, when the chosen port is already used by another instance', async () => {
        const install = vi.fn();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.2', filename: 'php-8.2.zip' }] }),
            install_php: install,
        });
        const user = userEvent.setup();
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));
        await screen.findByLabelText('php.listening_port');

        fireEvent.change(screen.getByLabelText('php.listening_port'), { target: { value: '9000' } });

        expect(screen.getByText('php.install_and_configure')).toBeDisabled();
        expect(install).not.toHaveBeenCalled();
    });

    it('shows a generic system-error toast when installing throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.2', filename: 'php-8.2.zip' }] }),
            install_php: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));
        await waitFor(() => expect(screen.getByText('php.install_and_configure')).not.toBeDisabled());

        await user.click(screen.getByText('php.install_and_configure'));

        expect(await screen.findByText('php.system_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when fetching settings config throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            get_php_config: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.config');

        await user.click(screen.getByText('php.config'));

        expect(await screen.findByText('php.fetch_config_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when saving settings throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            get_php_config: vi.fn().mockResolvedValue({ status: 'success', config: { port: 9000 }, extensions: [] }),
            save_php_config: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.config');
        await user.click(screen.getByText('php.config'));
        await waitFor(() => expect(screen.getByText('php.save_changes')).not.toBeDisabled());

        await user.click(screen.getByText('php.save_changes'));

        expect(await screen.findByText('php.save_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when confirming uninstall throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            uninstall_php: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.uninstall');
        await user.click(screen.getByText('php.uninstall'));
        await screen.findByText('php.yes_uninstall');

        await user.click(screen.getByText('php.yes_uninstall'));

        expect(await screen.findByText('php.delete_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when toggling status throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            start_php: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<PhpMain />);
        await screen.findByRole('button', { name: /php.start_cgi/ });

        await user.click(screen.getByRole('button', { name: /php.start_cgi/ }));

        expect(await screen.findByText('php.toggle_status_error')).toBeInTheDocument();
    });

    it('closes the install, settings, and uninstall-confirm modals via their own close controls', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([instance]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            get_php_config: vi.fn().mockResolvedValue({ status: 'success', config: {}, extensions: [] }),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');

        await user.click(screen.getByText('php.add_version'));
        await user.click(screen.getAllByLabelText('Close')[0]);
        expect(screen.queryByText('php.install_php_version')).not.toBeInTheDocument();

        await user.click(screen.getByText('php.config'));
        await waitFor(() => expect(screen.getAllByLabelText('Close')[0]).toBeInTheDocument());
        await user.click(screen.getAllByLabelText('Close')[0]);
        expect(screen.queryByText('php.save_changes')).not.toBeInTheDocument();

        await user.click(screen.getByText('php.uninstall'));
        await screen.findByText('php.confirm_uninstall');
        await user.click(screen.getAllByLabelText('Close')[0]);
        expect(screen.queryByText('php.confirm_uninstall')).not.toBeInTheDocument();
    });

    it('minimizes the install modal into the background widget and restores it', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '8.2', filename: 'php-8.2.zip' }] }),
            install_php: vi.fn().mockReturnValue(new Promise(() => {})),
        });
        renderWithToast(<PhpMain />);
        await screen.findByText('php.add_version');
        await user.click(screen.getByText('php.add_version'));
        await waitFor(() => expect(screen.getByText('php.install_and_configure')).not.toBeDisabled());
        await user.click(screen.getByText('php.install_and_configure'));
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 40, text: 'Installing...' } }));
        });
        await user.click(screen.getAllByLabelText('Close')[0]);

        expect(await screen.findByRole('button', { name: /php\.processing/ })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /php\.processing/ }));

        expect(await screen.findByText('php.installing')).toBeInTheDocument();
    });
});
