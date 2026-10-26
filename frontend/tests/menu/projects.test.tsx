import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, act } from '../test-utils';
import { mockPywebviewApi, renderWithToast } from '../test-utils';
import ProjectsMain from '../../src/menu/projects/Main';
import type { ProjectData } from '../../src/context/ProjectContext';

const mockProjects: ProjectData[] = [
    {
        id: 'proj_php',
        name: 'Laravel App',
        domain: 'laravel.local',
        path: 'C:/www/laravel-app',
        php_version: '8.3',
        php_port: 9003,
        framework: 'laravel',
        project_type: 'php',
        host_synced: true,
    },
    {
        id: 'proj_node',
        name: 'NextJS Portal',
        domain: 'nextjs.local',
        path: 'D:/projects/nextjs-portal',
        php_version: '',
        php_port: 0,
        framework: 'nextjs',
        project_type: 'node',
        proxy_port: 3000,
        host_synced: true,
    },
    {
        id: 'proj_python',
        name: 'Django API',
        domain: 'django.local',
        path: 'D:/projects/django-api',
        php_version: '',
        php_port: 0,
        framework: 'django',
        project_type: 'python',
        proxy_port: 8000,
        host_synced: false,
    },
];

function projectsApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    return {
        get_projects: vi.fn().mockResolvedValue({ status: 'success', data: mockProjects }),
        retry_sync_host: vi.fn().mockResolvedValue({ status: 'success', message: 'Host synced successfully' }),
        open_in_explorer: vi.fn(),
        open_browser: vi.fn(),
        delete_project: vi.fn().mockResolvedValue({ status: 'success', message: 'Project deleted' }),
        get_all_running_project_servers: vi.fn().mockResolvedValue({}),
        start_project_server: vi.fn().mockResolvedValue({ status: 'success', message: 'Server started', pid: 4321, port: 3000 }),
        stop_project_server: vi.fn().mockResolvedValue({ status: 'success', message: 'Server stopped' }),
        get_project_server_logs: vi.fn().mockResolvedValue({ status: 'success', logs: 'Sample server output' }),
        ...overrides,
    };
}

describe('ProjectsMain & ProjectContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ProjectsMain, fetches projects, and displays project cards', async () => {
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        expect(await screen.findByText('Laravel App')).toBeInTheDocument();
        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
        expect(screen.getByText('Django API')).toBeInTheDocument();
        expect(screen.getByText('laravel')).toBeInTheDocument();
        expect(screen.getByText('nextjs')).toBeInTheDocument();
        expect(screen.getByText('django')).toBeInTheDocument();
    });

    it('filters projects using the real-time search input', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const searchInput = screen.getByPlaceholderText(/search projects/i);
        await user.type(searchInput, 'nextjs');

        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
        expect(screen.queryByText('Laravel App')).not.toBeInTheDocument();
        expect(screen.queryByText('Django API')).not.toBeInTheDocument();

        // Clear search
        await user.clear(searchInput);
        expect(screen.getByText('Laravel App')).toBeInTheDocument();
        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
    });

    it('filters projects by runtime chip (PHP, Node.js, Python)', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        // Click 'Node.js' chip
        const nodeChip = screen.getByRole('button', { name: /Node\.js/i });
        await user.click(nodeChip);

        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
        expect(screen.queryByText('Laravel App')).not.toBeInTheDocument();
        expect(screen.queryByText('Django API')).not.toBeInTheDocument();

        // Click 'Python' chip
        const pythonChip = screen.getByRole('button', { name: /Python/i });
        await user.click(pythonChip);

        expect(screen.getByText('Django API')).toBeInTheDocument();
        expect(screen.queryByText('NextJS Portal')).not.toBeInTheDocument();

        // Click 'All' chip
        const allChip = screen.getByRole('button', { name: /^all/i });
        await user.click(allChip);

        expect(screen.getByText('Laravel App')).toBeInTheDocument();
        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
        expect(screen.getByText('Django API')).toBeInTheDocument();
    });

    it('shows empty state with clear filters button when search returns 0 matches', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const searchInput = screen.getByPlaceholderText(/search projects/i);
        await user.type(searchInput, 'nonexistentxyz');

        expect(await screen.findByText(/no matching projects/i)).toBeInTheDocument();
        expect(screen.getByText(/clear filters/i)).toBeInTheDocument();

        await user.click(screen.getByText(/clear filters/i));
        expect(await screen.findByText('Laravel App')).toBeInTheDocument();
    });

    it('shows empty state when no projects exist at all', async () => {
        mockPywebviewApi(projectsApi({ get_projects: vi.fn().mockResolvedValue({ status: 'success', data: [] }) }));
        renderWithToast(<ProjectsMain />);

        expect(await screen.findByText(/no projects found/i)).toBeInTheDocument();
        expect(screen.getByText(/create project/i)).toBeInTheDocument();
    });

    it('opens project document root in explorer via open_in_explorer', async () => {
        const user = userEvent.setup();
        const openExplorer = vi.fn();
        mockPywebviewApi(projectsApi({ open_in_explorer: openExplorer }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const docRootButtons = screen.getAllByText(/open_document_root|open document root/i);
        await user.click(docRootButtons[0]);

        expect(openExplorer).toHaveBeenCalledWith('C:/www/laravel-app');
    });

    it('opens project in browser via open_browser', async () => {
        const user = userEvent.setup();
        const openBrowser = vi.fn();
        mockPywebviewApi(projectsApi({ open_browser: openBrowser }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const browserButtons = screen.getAllByText(/open_in_browser|open in browser/i);
        await user.click(browserButtons[0]);

        expect(openBrowser).toHaveBeenCalledWith('https://laravel.local');
    });

    it('dispatches vylo_open_terminal_project on open in terminal click', async () => {
        const user = userEvent.setup();
        const listener = vi.fn();
        window.addEventListener('vylo_open_terminal_project', listener);

        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const terminalButtons = screen.getAllByText(/open_in_terminal|open in terminal/i);
        await user.click(terminalButtons[0]);

        expect(listener).toHaveBeenCalled();
        const eventDetail = listener.mock.calls[0][0].detail;
        expect(eventDetail.cwd).toBe('C:/www/laravel-app');

        window.removeEventListener('vylo_open_terminal_project', listener);
    });

    it('retries host sync for unsynced project', async () => {
        const user = userEvent.setup();
        const retrySync = vi.fn().mockResolvedValue({ status: 'success', message: 'Synced' });
        mockPywebviewApi(projectsApi({ retry_sync_host: retrySync }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Django API');
        expect(screen.getByText('apache.domain_not_routed')).toBeInTheDocument();

        const retryButton = screen.getByText('apache.retry_sync');
        await user.click(retryButton);

        expect(retrySync).toHaveBeenCalledWith('proj_python');
    });

    it('opens delete confirmation modal and deletes project', async () => {
        const user = userEvent.setup();
        const deleteProject = vi.fn().mockResolvedValue({ status: 'success', message: 'Deleted' });
        mockPywebviewApi(projectsApi({ delete_project: deleteProject }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const deleteButtons = screen.getAllByText('apache.delete_project');
        await user.click(deleteButtons[0]);

        // Expect delete modal
        expect(await screen.findByText('apache.delete_virtual_host')).toBeInTheDocument();

        // Confirm delete button inside the modal (last one in DOM)
        const allDeleteButtons = screen.getAllByRole('button', { name: /apache\.delete_project/i });
        const modalConfirmButton = allDeleteButtons[allDeleteButtons.length - 1];
        await user.click(modalConfirmButton);

        expect(deleteProject).toHaveBeenCalledWith('proj_php', false);
    });

    it('opens new project modal when clicking New Project button', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        const addProjectButton = screen.getByRole('button', { name: /add_project|new project/i });
        await user.click(addProjectButton);

        expect(await screen.findByText(/create_new_project|create new project/i)).toBeInTheDocument();
    });

    it('starts dev server when clicking Start Server on non-PHP project', async () => {
        const user = userEvent.setup();
        const startServer = vi.fn().mockResolvedValue({ status: 'success', message: 'Server started', pid: 7777, port: 3000 });
        mockPywebviewApi(projectsApi({ start_project_server: startServer }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('NextJS Portal');

        const startButtons = screen.getAllByRole('button', { name: /start_server|start server/i });
        expect(startButtons.length).toBeGreaterThan(0);
        await user.click(startButtons[0]);

        expect(startServer).toHaveBeenCalledWith('proj_node');
    });

    it('stops dev server when clicking Stop Server on running project', async () => {
        const user = userEvent.setup();
        const stopServer = vi.fn().mockResolvedValue({ status: 'success', message: 'Server stopped' });
        const runningMock = {
            proj_node: { running: true, port: 3000, pid: 8888 }
        };
        mockPywebviewApi(projectsApi({
            get_all_running_project_servers: vi.fn().mockResolvedValue(runningMock),
            stop_project_server: stopServer
        }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('NextJS Portal');

        const stopButton = await screen.findByRole('button', { name: /stop_server|stop server/i });
        await user.click(stopButton);

        expect(stopServer).toHaveBeenCalledWith('proj_node');
    });

    it('auto-starts server when clicking Open in Browser for stopped non-PHP project', async () => {
        const user = userEvent.setup();
        const startServer = vi.fn().mockResolvedValue({ status: 'success', message: 'Server started', pid: 9999, port: 3000 });
        const openBrowser = vi.fn();
        mockPywebviewApi(projectsApi({
            start_project_server: startServer,
            open_browser: openBrowser,
        }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('NextJS Portal');

        const browserButtons = screen.getAllByRole('button', { name: /open_in_browser/i });
        // The second one is NextJS Portal (first is Laravel)
        await user.click(browserButtons[1]);

        await waitFor(() => {
            expect(startServer).toHaveBeenCalledWith('proj_node');
            expect(openBrowser).toHaveBeenCalledWith('https://nextjs.local');
        }, { timeout: 2000 });
    });

    it('opens server logs modal and displays logs when clicking View Dev Server Logs', async () => {
        const user = userEvent.setup();
        const getLogs = vi.fn().mockResolvedValue({ status: 'success', logs: 'Vite dev server running at http://127.0.0.1:3000/' });
        mockPywebviewApi(projectsApi({
            get_project_server_logs: getLogs,
        }));
        renderWithToast(<ProjectsMain />);

        await screen.findByText('NextJS Portal');

        const viewLogsButtons = screen.getAllByText(/view_server_logs/i);
        await user.click(viewLogsButtons[0]);

        expect(getLogs).toHaveBeenCalledWith('proj_node');
        expect(await screen.findByText(/Vite dev server running at/i)).toBeInTheDocument();
    });

    it('toggles projects view between table and card view', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        // By default, Table view is active
        const tableButton = screen.getByRole('button', { name: /Table View/i });
        const cardButton = screen.getByRole('button', { name: /Card View/i });
        expect(tableButton).toHaveAttribute('aria-pressed', 'true');
        expect(cardButton).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('table')).toBeInTheDocument();

        // Switch to Card View
        await user.click(cardButton);
        expect(cardButton).toHaveAttribute('aria-pressed', 'true');
        expect(tableButton).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.getByText('Laravel App')).toBeInTheDocument();

        // Switch back to Table View
        await user.click(tableButton);
        expect(tableButton).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('integrates filter chips and search into the table toolbar in table view', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(projectsApi());
        renderWithToast(<ProjectsMain />);

        await screen.findByText('Laravel App');

        // Verify table is present
        expect(screen.getByRole('table')).toBeInTheDocument();

        // In table view, search input and filter chips are rendered
        const searchInput = screen.getByPlaceholderText(/search projects/i);
        expect(searchInput).toBeInTheDocument();
        const phpChip = screen.getByRole('button', { name: /^php/i });
        expect(phpChip).toBeInTheDocument();

        // Filter via search while table is active: 0 matches keeps search input rendered inside emptyState slot
        await user.type(searchInput, 'nonexistentdomain');
        expect(await screen.findByText(/no matching projects/i)).toBeInTheDocument();
        // Search input remains mounted and accessible
        expect(screen.getByPlaceholderText(/search projects/i)).toHaveValue('nonexistentdomain');

        // Clear filters resets the list and restores projects
        await user.click(screen.getByText(/clear filters/i));
        expect(await screen.findByText('Laravel App')).toBeInTheDocument();
    });
});
