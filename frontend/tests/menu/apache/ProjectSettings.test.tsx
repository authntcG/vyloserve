import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import ProjectSettings, { type ProjectSettingsRef } from '../../../src/menu/apache/ProjectSettings';
import type { ProjectData } from '../../../src/menu/apache/Main';

const project: ProjectData = {
    id: 'proj_1',
    name: 'My Site',
    domain: 'my-site.local',
    path: 'C:/www/my-site',
    php_version: '8.2',
    php_port: 9002,
};

describe('ProjectSettings', () => {
    it('pre-fills the project name from the project prop and splits the domain into subdomain/tld', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<ProjectSettings project={project} ref={createRef<ProjectSettingsRef>()} />);

        expect(screen.getByLabelText('apache.project_name')).toHaveValue('My Site');
        expect(screen.getByLabelText('apache.local_domain')).toHaveValue('my-site');
        expect(screen.getByText('.local')).toBeInTheDocument();
    });

    it('lists installed PHP versions once fetched', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([{ version: '8.2' }, { version: '8.3' }]) });
        renderWithToast(<ProjectSettings project={project} ref={createRef<ProjectSettingsRef>()} />);

        await screen.findByText('PHP 8.2 (FastCGI)');
        expect(screen.getByText('PHP 8.3 (FastCGI)')).toBeInTheDocument();
    });

    it('shows the "no PHP installed" option when the API returns no versions', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]) });
        renderWithToast(<ProjectSettings project={project} ref={createRef<ProjectSettingsRef>()} />);

        expect(await screen.findByText('apache.no_php_installed')).toBeInTheDocument();
    });

    it('shows a warning and does not call the API when the project name is cleared', async () => {
        const updateProject = vi.fn();
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]), update_project: updateProject });
        const ref = createRef<ProjectSettingsRef>();
        renderWithToast(<ProjectSettings project={project} ref={ref} />);
        fireEvent.change(screen.getByLabelText('apache.project_name'), { target: { value: '   ' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(updateProject).not.toHaveBeenCalled();
        expect(await screen.findByText('apache.empty_project_name')).toBeInTheDocument();
    });

    it('calls update_project with the edited name/php_version, dispatches project_list_updated, and shows a success toast', async () => {
        const updateProject = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.project_updated', args: {} });
        mockPywebviewApi({ get_installed_php: vi.fn().mockResolvedValue([]), update_project: updateProject });
        const listener = vi.fn();
        window.addEventListener('project_list_updated', listener);
        const ref = createRef<ProjectSettingsRef>();
        renderWithToast(<ProjectSettings project={project} ref={ref} />);
        fireEvent.change(screen.getByLabelText('apache.project_name'), { target: { value: 'Renamed Site' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(true);
        expect(updateProject).toHaveBeenCalledWith({ id: 'proj_1', name: 'Renamed Site', php_version: '8.2' });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('apache.project_updated')).toBeInTheDocument();
        window.removeEventListener('project_list_updated', listener);
    });

    it('shows the API-provided error message and resolves false when the API reports failure', async () => {
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            update_project: vi.fn().mockResolvedValue({ status: 'error', message: 'apache.update_conflict', args: {} }),
        });
        const ref = createRef<ProjectSettingsRef>();
        renderWithToast(<ProjectSettings project={project} ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('apache.update_conflict')).toBeInTheDocument();
    });

    it('shows a generic error toast and resolves false when the update call throws', async () => {
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([]),
            update_project: vi.fn().mockRejectedValue(new Error('boom')),
        });
        const ref = createRef<ProjectSettingsRef>();
        renderWithToast(<ProjectSettings project={project} ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('apache.update_settings_error')).toBeInTheDocument();
    });

    it('does not crash and stops loading when fetching PHP versions throws', async () => {
        mockPywebviewApi({ get_installed_php: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<ProjectSettings project={project} ref={createRef<ProjectSettingsRef>()} />);

        expect(await screen.findByLabelText('apache.php_fastcgi_routing')).toBeInTheDocument();
    });

    it('changes the selected PHP version and includes it in the submit payload', async () => {
        const user = userEvent.setup();
        const updateProject = vi.fn().mockResolvedValue({ status: 'success', message: 'apache.project_updated', args: {} });
        mockPywebviewApi({
            get_installed_php: vi.fn().mockResolvedValue([{ version: '8.2' }, { version: '8.3' }]),
            update_project: updateProject,
        });
        const ref = createRef<ProjectSettingsRef>();
        renderWithToast(<ProjectSettings project={project} ref={ref} />);
        await waitFor(() => expect(screen.getByLabelText('apache.php_fastcgi_routing')).not.toBeDisabled());

        await user.selectOptions(screen.getByLabelText('apache.php_fastcgi_routing'), '8.3');
        await act(async () => ref.current!.submit());

        expect(updateProject).toHaveBeenCalledWith(expect.objectContaining({ php_version: '8.3' }));
    });
});
