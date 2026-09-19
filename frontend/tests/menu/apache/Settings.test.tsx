import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import ApacheSettings from '../../../src/menu/apache/Settings';

describe('ApacheSettings', () => {
    it('lists installed versions once fetched and shows the active one as selected', async () => {
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62', '2.4.58'], active: '2.4.58' }),
        });
        renderWithToast(<ApacheSettings />);

        await waitFor(() => expect(screen.getByLabelText('apache.active_version')).toHaveValue('2.4.58'));
    });

    it('dispatches apache_version_changed after successfully fetching installed versions', async () => {
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
        });
        const listener = vi.fn();
        window.addEventListener('apache_version_changed', listener);
        renderWithToast(<ApacheSettings />);

        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        window.removeEventListener('apache_version_changed', listener);
    });

    it('shows the API-provided error toast when fetching installed versions reports failure', async () => {
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.fetch_error_custom', args: {} }),
        });
        renderWithToast(<ApacheSettings />);

        expect(await screen.findByText('apache.fetch_error_custom')).toBeInTheDocument();
    });

    it('shows the generic local-fetch-error toast when fetching installed versions throws', async () => {
        mockPywebviewApi({ get_apache_installed_versions: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<ApacheSettings />);

        expect(await screen.findByText('apache.fetch_version_local_error')).toBeInTheDocument();
    });

    it('shows the "no installation found" option and the install-first message when nothing is installed', async () => {
        mockPywebviewApi({ get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: [], active: '' }) });
        renderWithToast(<ApacheSettings />);

        await screen.findByText('apache.no_apache_installation_found');
        expect(screen.getByText('apache.install_first_config')).toBeInTheDocument();
        expect(screen.getByLabelText('apache.active_version')).toBeDisabled();
    });

    it('calls set_apache_active_version and shows a success toast when a different version is selected', async () => {
        const user = userEvent.setup();
        const setActiveVersion = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.version_switched', args: {} });
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62', '2.4.58'], active: '2.4.62' }),
            set_apache_active_version: setActiveVersion,
        });
        renderWithToast(<ApacheSettings />);
        await waitFor(() => expect(screen.getByLabelText('apache.active_version')).toHaveValue('2.4.62'));

        await user.selectOptions(screen.getByLabelText('apache.active_version'), '2.4.58');

        expect(setActiveVersion).toHaveBeenCalledWith('2.4.58');
        expect(await screen.findByText('apache.version_switched')).toBeInTheDocument();
    });

    it('shows the API-provided error toast when switching the active version fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62', '2.4.58'], active: '2.4.62' }),
            set_apache_active_version: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.switch_conflict', args: {} }),
        });
        renderWithToast(<ApacheSettings />);
        await waitFor(() => expect(screen.getByLabelText('apache.active_version')).toHaveValue('2.4.62'));

        await user.selectOptions(screen.getByLabelText('apache.active_version'), '2.4.58');

        expect(await screen.findByText('apache.switch_conflict')).toBeInTheDocument();
    });

    it('shows the generic save-error toast when switching the active version throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62', '2.4.58'], active: '2.4.62' }),
            set_apache_active_version: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<ApacheSettings />);
        await waitFor(() => expect(screen.getByLabelText('apache.active_version')).toHaveValue('2.4.62'));

        await user.selectOptions(screen.getByLabelText('apache.active_version'), '2.4.58');

        expect(await screen.findByText('apache.save_version_settings_error')).toBeInTheDocument();
    });

    it('opens the httpd.conf/vhosts.conf shortcuts via open_apache_file', async () => {
        const user = userEvent.setup();
        const openFile = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            open_apache_file: openFile,
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByText('httpd.conf'));
        await user.click(screen.getByText('vhosts.conf'));

        expect(openFile).toHaveBeenNthCalledWith(1, 'httpd');
        expect(openFile).toHaveBeenNthCalledWith(2, 'vhosts');
    });

    it('opens the error log externally via its "open externally" icon button, without opening the in-app viewer', async () => {
        const user = userEvent.setup();
        const openFile = vi.fn().mockResolvedValue({ status: 'success' });
        const getLogContent = vi.fn();
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            open_apache_file: openFile,
            get_apache_log_content: getLogContent,
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByTitle('common.open_externally'));

        expect(openFile).toHaveBeenCalledWith('error');
        expect(getLogContent).not.toHaveBeenCalled();
    });

    it('opens the in-app log viewer with the error log tail when the error log shortcut is clicked', async () => {
        const user = userEvent.setup();
        const getLogContent = vi.fn().mockResolvedValue({ status: 'success', data: '[error] something failed' });
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            get_apache_log_content: getLogContent,
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByText('settings.log_file_error'));

        expect(getLogContent).toHaveBeenCalledWith('error');
        expect(await screen.findByText('[error] something failed')).toBeInTheDocument();
    });

    it('opens the in-app log viewer with the access log tail when the access log shortcut is clicked', async () => {
        const user = userEvent.setup();
        const getLogContent = vi.fn().mockResolvedValue({ status: 'success', data: '127.0.0.1 - GET /' });
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            get_apache_log_content: getLogContent,
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByText('settings.log_file_access'));

        expect(getLogContent).toHaveBeenCalledWith('access');
        expect(await screen.findByText('127.0.0.1 - GET /')).toBeInTheDocument();
    });

    it('shows the API-provided error toast when opening a config file fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            open_apache_file: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.file_not_found', args: {} }),
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByText('httpd.conf'));

        expect(await screen.findByText('apache.file_not_found')).toBeInTheDocument();
    });

    it('shows the generic open-file-error toast when open_apache_file throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
            open_apache_file: vi.fn().mockRejectedValue(new Error('boom')),
        });
        renderWithToast(<ApacheSettings />);
        await screen.findByText('httpd.conf');

        await user.click(screen.getByText('httpd.conf'));

        expect(await screen.findByText('apache.open_file_error')).toBeInTheDocument();
    });
});
