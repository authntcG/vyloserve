import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import NewApacheProject, { type NewProjectRef } from '../../../src/menu/apache/NewProject';

const phpVersions = [
    { name: 'PHP', version: '8.2', port: 9002 },
    { name: 'PHP', version: '8.3', port: 9003 },
];

describe('NewApacheProject', () => {
    it('defaults to fresh-install mode and slugifies the project name into the domain', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);

        await user.type(screen.getByLabelText('apache.project_name'), 'My Cool App!');
        await user.click(screen.getByText('apache.advanced_settings'));

        expect(screen.getByDisplayValue('my-cool-app')).toBeInTheDocument();
    });

    it('auto-selects the last installed PHP version once fetched', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue(phpVersions) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        expect(await screen.findByDisplayValue('PHP (8.3)')).toBeInTheDocument();
    });

    it('shows the "no PHP installed" option when there are no PHP versions', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        expect(await screen.findByText('apache.no_php_installed_exc')).toBeInTheDocument();
    });

    it('shows the workspace-required warning until an install location is set, then browses and persists it', async () => {
        const user = userEvent.setup();
        const browseDirectory = vi.fn().mockResolvedValue('C:/workspace');
        const saveAppSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            browse_directory: browseDirectory,
            save_app_settings: saveAppSettings,
        });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        expect(screen.getByText('apache.workspace_required')).toBeInTheDocument();

        await user.click(screen.getAllByText('apache.browse')[0]);

        expect(browseDirectory).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('C:/workspace')).toBeInTheDocument();
        expect(saveAppSettings).toHaveBeenCalledWith({ default_apache_install_location: 'C:/workspace' });
    });

    it('restores the last-used install location from backend settings on mount', async () => {
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { default_apache_install_location: 'C:/remembered' } }),
        });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        expect(await screen.findByText('C:/remembered')).toBeInTheDocument();
    });

    it('detects the framework and appends /public for a browsed existing Laravel project', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            browse_directory: vi.fn().mockResolvedValue('C:/sites/my-app'),
            detect_framework: vi.fn().mockResolvedValue('laravel'),
        });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        await user.click(screen.getByRole('button', { name: /apache.link_existing/ }));

        await user.click(screen.getByText('apache.browse'));

        expect(await screen.findByDisplayValue('C:/sites/my-app/public')).toBeInTheDocument();
        expect(screen.getByText(/LARAVEL/)).toBeInTheDocument();
    });

    it('does not append /public for a browsed existing WordPress project', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            browse_directory: vi.fn().mockResolvedValue('C:/sites/blog'),
            detect_framework: vi.fn().mockResolvedValue('wordpress'),
        });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        await user.click(screen.getByRole('button', { name: /apache.link_existing/ }));

        await user.click(screen.getByText('apache.browse'));

        expect(await screen.findByDisplayValue('C:/sites/blog')).toBeInTheDocument();
    });

    it('warns and does not submit when required fields (name/domain/php version) are missing', async () => {
        const create = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]), create_project: create });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(create).not.toHaveBeenCalled();
        expect(await screen.findByText('apache.new_project_req_error')).toBeInTheDocument();
    });

    it('warns and does not submit a fresh install without a workspace location', async () => {
        const user = userEvent.setup();
        const create = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue(phpVersions), create_project: create });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(create).not.toHaveBeenCalled();
        expect(await screen.findByText('apache.new_project_workspace_error')).toBeInTheDocument();
    });

    it('warns and does not submit an existing-project link without a document root', async () => {
        const user = userEvent.setup();
        const create = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue(phpVersions), create_project: create });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');
        await user.click(screen.getByRole('button', { name: /apache.link_existing/ }));

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(create).not.toHaveBeenCalled();
        expect(await screen.findByText('apache.new_project_docroot_error')).toBeInTheDocument();
    });

    it('creates a fresh-install project with the correct payload and dispatches project_list_updated on success', async () => {
        const user = userEvent.setup();
        const create = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.project_created', args: {} });
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue(phpVersions), create_project: create });
        const listener = vi.fn();
        window.addEventListener('project_list_updated', listener);
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');
        await user.click(screen.getByText('apache.advanced_settings'));
        await user.type(screen.getByPlaceholderText('apache.placeholder_workspace_location'), 'C:/workspace');

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(true);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'My App', domain: 'my-app', php_version: '8.3', php_port: 9003,
            is_existing: false, framework: 'laravel', install_location: 'C:/workspace',
        }));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('apache.project_created')).toBeInTheDocument();
        window.removeEventListener('project_list_updated', listener);
    });

    it('shows the API-provided error and resolves false when creation reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue(phpVersions),
            create_project: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.project_conflict', args: {} }),
        });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');
        await user.click(screen.getByText('apache.advanced_settings'));
        await user.type(screen.getByPlaceholderText('apache.placeholder_workspace_location'), 'C:/workspace');

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('apache.project_conflict')).toBeInTheDocument();
    });

    it('shows a generic backend-error toast and resolves false when creation throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue(phpVersions),
            create_project: vi.fn().mockRejectedValue(new Error('boom')),
        });
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');
        await user.click(screen.getByText('apache.advanced_settings'));
        await user.type(screen.getByPlaceholderText('apache.placeholder_workspace_location'), 'C:/workspace');

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('apache.new_project_backend_error')).toBeInTheDocument();
    });

    it('shows the progress bar only for ProjectManager-sourced events while creating', async () => {
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue(phpVersions),
            create_project: vi.fn().mockReturnValue(new Promise(() => {})),
        });
        const user = userEvent.setup();
        const ref = createRef<NewProjectRef>();
        renderWithToast(<NewApacheProject ref={ref} />);
        await screen.findByDisplayValue('PHP (8.3)');
        await user.type(screen.getByLabelText('apache.project_name'), 'My App');
        await user.click(screen.getByText('apache.advanced_settings'));
        await user.type(screen.getByPlaceholderText('apache.placeholder_workspace_location'), 'C:/workspace');

        act(() => {
            ref.current!.submit();
        });

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ProjectManager', percent: 33, text: 'apache.copying_files' } }));
        });

        expect(await screen.findByText('apache.copying_files')).toBeInTheDocument();
        expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('lets the user type the workspace location directly on the fresh-install field', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        // Single atomic change: once installLocation is non-empty, the component swaps this
        // input for a read-only "confirmed workspace" label, so per-keystroke typing can't be used here.
        fireEvent.change(screen.getByPlaceholderText('apache.placeholder_workspace'), { target: { value: 'C:/typed-workspace' } });

        expect(screen.getByText('C:/typed-workspace')).toBeInTheDocument();
    });

    it('lets the user type the project directory directly when linking an existing project', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        await user.click(screen.getByRole('button', { name: /apache.link_existing/ }));

        await user.type(screen.getByPlaceholderText('apache.placeholder_project_directory'), 'C:/typed-project');

        expect(screen.getByDisplayValue('C:/typed-project')).toBeInTheDocument();
    });

    it('changes the framework-to-install select', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        await user.selectOptions(screen.getByDisplayValue('apache.framework_laravel'), 'wordpress');

        expect(screen.getByDisplayValue('apache.framework_wordpress')).toBeInTheDocument();
    });

    it('edits the domain name/extension, specific version, and environment fields in Advanced Settings', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        await user.click(screen.getByText('apache.advanced_settings'));

        await user.type(screen.getByDisplayValue('.test'), '2');
        await user.type(screen.getByPlaceholderText('apache.placeholder_specific_version'), '8.3.1');
        await user.selectOptions(screen.getByDisplayValue('apache.php_engine'), 'php');

        expect(screen.getByDisplayValue('.test2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('8.3.1')).toBeInTheDocument();
    });

    it('does not crash and leaves the PHP version list empty when fetching installed PHP versions throws', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);

        expect(await screen.findByText('apache.no_php_installed_exc')).toBeInTheDocument();
    });

    it('leaves the document root unchanged when the user cancels the browse-existing dialog', async () => {
        const user = userEvent.setup();
        const detectFramework = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]), browse_directory: vi.fn().mockResolvedValue(''), detect_framework: detectFramework });
        renderWithToast(<NewApacheProject ref={createRef<NewProjectRef>()} />);
        await user.click(screen.getByRole('button', { name: /apache.link_existing/ }));

        await user.click(screen.getByText('apache.browse'));

        expect(detectFramework).not.toHaveBeenCalled();
        expect(screen.getByPlaceholderText('apache.placeholder_project_directory')).toHaveValue('');
    });
});
