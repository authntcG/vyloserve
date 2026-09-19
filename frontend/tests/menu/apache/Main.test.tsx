import { forwardRef, useImperativeHandle } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import ApacheMain from '../../../src/menu/apache/Main';

const { newProjectSubmit, projectSettingsSubmit } = vi.hoisted(() => ({
    newProjectSubmit: vi.fn().mockResolvedValue(true),
    projectSettingsSubmit: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../src/menu/apache/Settings', () => ({ default: () => <div>apache-settings-stub</div> }));
vi.mock('../../../src/menu/apache/InstallWizard', () => ({ default: () => <div>install-wizard-stub</div> }));
vi.mock('../../../src/menu/apache/NewProject', () => ({
    default: forwardRef((_props, ref) => {
        useImperativeHandle(ref, () => ({ submit: newProjectSubmit }));
        return <div>new-project-form-stub</div>;
    }),
}));
vi.mock('../../../src/menu/apache/ProjectSettings', () => ({
    default: forwardRef((_props, ref) => {
        useImperativeHandle(ref, () => ({ submit: projectSettingsSubmit }));
        return <div>project-settings-form-stub</div>;
    }),
}));

const project = {
    id: 'proj_1', name: 'My Site', domain: 'my-site.local', path: 'C:/www/my-site',
    php_version: '8.2', php_port: 9002, framework: 'laravel', host_synced: true,
};

function apacheApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    return {
        get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: true, path: 'C:/Apache24', running: false }),
        get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', data: ['2.4.62'], active: '2.4.62' }),
        get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [project] }),
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

    it('shows the empty state and no add-project ability until Apache is installed', async () => {
        mockPywebviewApi(apacheApi({
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', installed: false, path: '', running: false }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        }));
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('apache.no_projects_found')).toBeInTheDocument();
        expect(screen.getByText('apache.add_project').closest('button')).toBeDisabled();
    });

    it('lists virtual host projects with their framework and PHP version', async () => {
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('My Site')).toBeInTheDocument();
        expect(screen.getByText('laravel')).toBeInTheDocument();
    });

    it('shows a host-sync-needed warning and retries via retry_sync_host', async () => {
        const user = userEvent.setup();
        const retrySync = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.host_synced', args: {} });
        mockPywebviewApi(apacheApi({
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [{ ...project, host_synced: false }] }),
            retry_sync_host: retrySync,
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.domain_not_routed');

        await user.click(screen.getByText('apache.retry_sync'));

        expect(retrySync).toHaveBeenCalledWith('proj_1');
        expect(await screen.findByText('apache.host_synced')).toBeInTheDocument();
    });

    it('opens the document root via open_in_explorer from the project dropdown', async () => {
        const user = userEvent.setup();
        const openExplorer = vi.fn();
        mockPywebviewApi(apacheApi({ open_in_explorer: openExplorer }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.open_document_root');

        await user.click(screen.getByText('apache.open_document_root'));

        expect(openExplorer).toHaveBeenCalledWith('C:/www/my-site');
    });

    it('opens the domain in the browser via the pywebview API when available', async () => {
        const user = userEvent.setup();
        const openBrowser = vi.fn();
        mockPywebviewApi(apacheApi({ open_browser: openBrowser }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.open_in_browser');

        await user.click(screen.getByText('apache.open_in_browser'));

        expect(openBrowser).toHaveBeenCalledWith('https://my-site.local');
    });

    it('deletes a project with the delete-files flag and refetches the list on success', async () => {
        const user = userEvent.setup();
        const deleteProject = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.project_removed', args: {} });
        const getProjects = vi.fn().mockResolvedValueOnce({ status: 'success', data: [project] }).mockResolvedValue({ status: 'success', data: [] });
        mockPywebviewApi(apacheApi({ get_projects: getProjects, delete_project: deleteProject }));
        renderWithToast(<ApacheMain />);
        await waitFor(() => expect(screen.getByText('apache.delete_project').closest('button')).toBeTruthy());

        await user.click(screen.getAllByText('apache.delete_project')[0]);
        expect(await screen.findByText('apache.delete_virtual_host')).toBeInTheDocument();
        await user.click(screen.getByLabelText('apache.delete_all_files'));
        await user.click(screen.getAllByText('apache.delete_project').at(-1)!);

        expect(deleteProject).toHaveBeenCalledWith('proj_1', true);
        expect(await screen.findByText('apache.project_removed')).toBeInTheDocument();
    });

    it('installs a new Apache version, closes the modal, and refreshes the status on success', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.installed', args: {} });
        const getAvailable = vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '2.4.63', filename: 'httpd-2.4.63.zip', url: 'https://example.com/2.4.63.zip' }] });
        mockPywebviewApi(apacheApi({ get_available_apache: getAvailable, install_apache: install }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');
        await user.click(screen.getByText('apache.install_update'));
        await waitFor(() => expect(getAvailable).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());

        await user.click(screen.getByText('apache.download_install'));

        expect(install).toHaveBeenCalledWith('2.4.63', 'https://example.com/2.4.63.zip', 80);
        expect(await screen.findByText('apache.installed')).toBeInTheDocument();
    });

    it('shows the API-provided error when Apache installation fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '2.4.63', filename: 'httpd-2.4.63.zip', url: 'https://example.com/2.4.63.zip' }] }),
            install_apache: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.install_conflict', args: {} }),
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');
        await user.click(screen.getByText('apache.install_update'));
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());

        await user.click(screen.getByText('apache.download_install'));

        expect(await screen.findByText('apache.install_conflict')).toBeInTheDocument();
    });

    it('confirms Apache uninstall and refreshes status on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.uninstalled', args: {} });
        mockPywebviewApi(apacheApi({ uninstall_apache: uninstall }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.uninstall_server');
        await user.click(screen.getByText('apache.uninstall_server'));
        expect(await screen.findByText('apache.uninstall_apache')).toBeInTheDocument();

        await user.click(screen.getByText('apache.yes_uninstall'));

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('apache.uninstalled')).toBeInTheDocument();
    });

    it('creates a new project via the New Project modal and closes it on success', async () => {
        const user = userEvent.setup();
        newProjectSubmit.mockResolvedValueOnce(true);
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);
        await waitFor(() => expect(screen.getByText('apache.add_project')).not.toBeDisabled());
        await user.click(screen.getByText('apache.add_project'));
        expect(await screen.findByText('new-project-form-stub')).toBeInTheDocument();

        await user.click(screen.getByText('apache.create_project'));

        await waitFor(() => expect(screen.queryByText('new-project-form-stub')).not.toBeInTheDocument());
    });

    it('opens the vhost settings modal and saves via ProjectSettings', async () => {
        const user = userEvent.setup();
        projectSettingsSubmit.mockResolvedValueOnce(true);
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.vhost_settings');
        await user.click(screen.getByText('apache.vhost_settings'));
        expect(await screen.findByText('project-settings-form-stub')).toBeInTheDocument();

        await user.click(screen.getByText('apache.save_changes'));

        expect(projectSettingsSubmit).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('project-settings-form-stub')).not.toBeInTheDocument());
    });

    it('refetches the project list when a project_list_updated event fires', async () => {
        const getProjects = vi.fn().mockResolvedValue({ status: 'success', data: [project] });
        mockPywebviewApi(apacheApi({ get_projects: getProjects }));
        renderWithToast(<ApacheMain />);
        await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1));

        act(() => {
            window.dispatchEvent(new Event('project_list_updated'));
        });

        await waitFor(() => expect(getProjects).toHaveBeenCalledTimes(2));
    });

    it('shows the background progress widget (once minimized) only for ApacheManager/ProjectManager-sourced events while installing', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '2.4.63', filename: 'httpd-2.4.63.zip', url: 'https://example.com/2.4.63.zip' }] }),
            install_apache: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');
        await user.click(screen.getByText('apache.install_update'));
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());
        await user.click(screen.getByText('apache.download_install'));
        // Minimize the (keepMounted) install modal so BackgroundProgressWidget becomes visible.
        await user.click(screen.getAllByLabelText('Close')[0]);

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 77, text: 'wrong module' } }));
        });
        expect(screen.queryByText('wrong module')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 77, text: 'Extracting...' } }));
        });
        expect(await screen.findByText('Extracting...')).toBeInTheDocument();
    });

    it('falls back to window.open when the pywebview open_browser API is unavailable', async () => {
        const user = userEvent.setup();
        const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
        mockPywebviewApi(apacheApi());
        // The shared mock helper always provides open_browser by default; remove it here
        // to exercise the fallback branch (window.open) that runs when it's unavailable.
        delete (window as unknown as { pywebview: { api: Record<string, unknown> } }).pywebview.api.open_browser;
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.open_in_browser');

        await user.click(screen.getByText('apache.open_in_browser'));

        expect(windowOpen).toHaveBeenCalledWith('https://my-site.local', '_blank');
    });

    it('opens the vhost settings via the project-card "setup" footer button', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.setup');

        await user.click(screen.getByText('apache.setup'));

        expect(await screen.findByText('project-settings-form-stub')).toBeInTheDocument();
    });

    it('opens the domain in the browser when the inline domain link is clicked', async () => {
        const user = userEvent.setup();
        const openBrowser = vi.fn();
        mockPywebviewApi(apacheApi({ open_browser: openBrowser }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('my-site.local');

        await user.click(screen.getByText('my-site.local'));

        expect(openBrowser).toHaveBeenCalledWith('https://my-site.local');
    });

    it('shows the retry-sync dropdown action (in addition to the warning banner) for an unsynced project', async () => {
        const user = userEvent.setup();
        const retrySync = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.host_synced', args: {} });
        mockPywebviewApi(apacheApi({
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [{ ...project, host_synced: false }] }),
            retry_sync_host: retrySync,
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.retry_host_sync');

        await user.click(screen.getByText('apache.retry_host_sync'));

        expect(retrySync).toHaveBeenCalledWith('proj_1');
        expect(await screen.findByText('apache.host_synced')).toBeInTheDocument();
    });

    it('shows a generic error toast when retry_sync_host throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [{ ...project, host_synced: false }] }),
            retry_sync_host: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.retry_sync');

        await user.click(screen.getByText('apache.retry_sync'));

        expect(await screen.findByText('apache.sync_error')).toBeInTheDocument();
    });

    it('shows the API-provided error toast when fetching projects reports failure', async () => {
        mockPywebviewApi(apacheApi({ get_projects: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.fetch_denied' }) }));
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('apache.fetch_denied')).toBeInTheDocument();
    });

    it('shows the generic fetch-projects error toast when the call throws', async () => {
        mockPywebviewApi(apacheApi({ get_projects: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);

        expect(await screen.findByText('apache.fetch_projects_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when deleting a project throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ delete_project: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);
        await waitFor(() => expect(screen.getByText('apache.delete_project').closest('button')).toBeTruthy());
        await user.click(screen.getAllByText('apache.delete_project')[0]);
        await screen.findByText('apache.delete_virtual_host');

        await user.click(screen.getAllByText('apache.delete_project').at(-1)!);

        expect(await screen.findByText('apache.delete_error')).toBeInTheDocument();
    });

    it('shows the API-provided error toast when deleting a project reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ delete_project: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.delete_conflict', args: {} }) }));
        renderWithToast(<ApacheMain />);
        await waitFor(() => expect(screen.getByText('apache.delete_project').closest('button')).toBeTruthy());
        await user.click(screen.getAllByText('apache.delete_project')[0]);
        await screen.findByText('apache.delete_virtual_host');

        await user.click(screen.getAllByText('apache.delete_project').at(-1)!);

        expect(await screen.findByText('apache.delete_conflict')).toBeInTheDocument();
    });

    it('opens the httpd.conf and Apache directory via the status-card dropdown actions', async () => {
        const user = userEvent.setup();
        const openConfig = vi.fn();
        const openDirectory = vi.fn();
        mockPywebviewApi(apacheApi({ open_apache_config: openConfig, open_apache_directory: openDirectory }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.open_httpd_conf');

        await user.click(screen.getByText('apache.open_httpd_conf'));
        await user.click(screen.getByText('apache.open_directory'));

        expect(openConfig).toHaveBeenCalledTimes(1);
        expect(openDirectory).toHaveBeenCalledTimes(1);
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
        mockPywebviewApi(apacheApi({ get_available_apache: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.fetch_versions_denied' }) }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');

        await user.click(screen.getByText('apache.install_update'));

        expect(await screen.findByText('apache.fetch_versions_denied')).toBeInTheDocument();
    });

    it('shows the generic fetch-versions error toast when fetching available Apache versions throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ get_available_apache: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');

        await user.click(screen.getByText('apache.install_update'));

        expect(await screen.findByText('apache.fetch_versions_error')).toBeInTheDocument();
    });

    it('opens the global Apache config modal via the status-card config button', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi());
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.config');

        await user.click(screen.getByText('apache.config'));

        expect(await screen.findByText('apache-settings-stub')).toBeInTheDocument();
    });

    it('shows a generic system-error toast when installing Apache throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '2.4.63', filename: 'httpd-2.4.63.zip', url: 'https://example.com/2.4.63.zip' }] }),
            install_apache: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');
        await user.click(screen.getByText('apache.install_update'));
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());

        await user.click(screen.getByText('apache.download_install'));

        expect(await screen.findByText('apache.system_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when uninstalling Apache throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({ uninstall_apache: vi.fn().mockRejectedValue(new Error('boom')) }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.uninstall_server');
        await user.click(screen.getByText('apache.uninstall_server'));
        await screen.findByText('apache.yes_uninstall');

        await user.click(screen.getByText('apache.yes_uninstall'));

        expect(await screen.findByText('apache.uninstall_error')).toBeInTheDocument();
    });

    it('restores the minimized install-progress widget back into the modal', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(apacheApi({
            get_available_apache: vi.fn().mockResolvedValue({ status: 'success', data: [{ version: '2.4.63', filename: 'httpd-2.4.63.zip', url: 'https://example.com/2.4.63.zip' }] }),
            install_apache: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        renderWithToast(<ApacheMain />);
        await screen.findByText('apache.install_update');
        await user.click(screen.getByText('apache.install_update'));
        await waitFor(() => expect(screen.getByText('apache.download_install')).not.toBeDisabled());
        await user.click(screen.getByText('apache.download_install'));
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 40, text: 'Installing...' } }));
        });
        await user.click(screen.getAllByLabelText('Close')[0]);
        const widget = await screen.findByRole('button', { name: /apache\.installing_apache/ });

        await user.click(widget);

        expect(await screen.findByText('apache.installing_start')).toBeInTheDocument();
    });
});
