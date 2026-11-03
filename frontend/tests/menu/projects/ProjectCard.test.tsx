import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import ProjectCard, { type ProjectCardProps } from '../../../src/menu/projects/ProjectCard';
import type { ProjectData, RunningServerInfo } from '../../../src/context/ProjectContext';

const phpProject: ProjectData = {
    id: 'proj_php_1',
    name: 'Laravel Website',
    domain: 'laravel.local',
    path: 'C:/www/laravel-website',
    php_version: '8.3',
    php_port: 9003,
    framework: 'laravel',
    project_type: 'php',
    host_synced: true,
};

const nodeProject: ProjectData = {
    id: 'proj_node_1',
    name: 'Next.js App',
    domain: 'nextjs.local',
    path: 'C:/www/nextjs-app',
    php_version: '',
    php_port: 0,
    framework: 'nextjs',
    project_type: 'node',
    proxy_port: 3000,
    host_synced: true,
};

function renderCard(props: Partial<ProjectCardProps> = {}) {
    const defaultProps: ProjectCardProps = {
        project: phpProject,
        onStartServer: vi.fn(),
        onStopServer: vi.fn(),
        onViewLogs: vi.fn(),
        onOpenDocumentRoot: vi.fn(),
        onOpenSettings: vi.fn(),
        onSyncHost: vi.fn(),
        onDeleteClick: vi.fn(),
        onOpenBrowser: vi.fn(),
        ...props,
    };
    return {
        ...render(<ProjectCard {...defaultProps} />),
        props: defaultProps,
    };
}

describe('ProjectCard', () => {
    it('renders PHP project card with domain, framework, and action buttons', async () => {
        const user = userEvent.setup();
        const { props } = renderCard({ project: phpProject });

        expect(screen.getByText('Laravel Website')).toBeInTheDocument();
        expect(screen.getByText('laravel')).toBeInTheDocument();
        expect(screen.getByText(/8.3/)).toBeInTheDocument();

        // Footer buttons: Open in Browser and Setup
        const openBrowserBtn = screen.getByRole('button', { name: /apache.open_in_browser/i });
        const setupBtn = screen.getByRole('button', { name: /apache.setup/i });

        expect(openBrowserBtn).toBeInTheDocument();
        expect(setupBtn).toBeInTheDocument();

        // Verify min-w-0 and truncate span are present to prevent two-line wrapping
        expect(openBrowserBtn).toHaveClass('min-w-0');
        expect(setupBtn).toHaveClass('min-w-0');
        expect(openBrowserBtn.querySelector('.truncate')).toBeInTheDocument();
        expect(setupBtn.querySelector('.truncate')).toBeInTheDocument();

        await user.click(openBrowserBtn);
        expect(props.onOpenBrowser).toHaveBeenCalledWith('laravel.local');

        await user.click(setupBtn);
        expect(props.onOpenSettings).toHaveBeenCalledWith('proj_php_1');
    });

    it('renders Node project card with Start Server and Open in Browser buttons when stopped', async () => {
        const user = userEvent.setup();
        const { props } = renderCard({ project: nodeProject });

        expect(screen.getByText('Next.js App')).toBeInTheDocument();
        expect(screen.getByText('nextjs')).toBeInTheDocument();

        const startBtn = screen.getByRole('button', { name: /projects.start_server/i });
        const openBrowserBtn = screen.getByRole('button', { name: /apache.open_in_browser/i });

        expect(startBtn).toBeInTheDocument();
        expect(openBrowserBtn).toBeInTheDocument();

        expect(startBtn).toHaveClass('min-w-0');
        expect(openBrowserBtn).toHaveClass('min-w-0');
        expect(startBtn.querySelector('.truncate')).toBeInTheDocument();
        expect(openBrowserBtn.querySelector('.truncate')).toBeInTheDocument();

        await user.click(startBtn);
        expect(props.onStartServer).toHaveBeenCalledWith('proj_node_1');

        await user.click(openBrowserBtn);
        expect(props.onOpenBrowser).toHaveBeenCalledWith('nextjs.local');
    });

    it('renders Node project card with Stop Server button when running', async () => {
        const user = userEvent.setup();
        const serverInfo: RunningServerInfo = {
            running: true,
            pid: 9876,
            port: 3000,
        };
        const { props } = renderCard({ project: nodeProject, serverInfo });

        const stopBtn = screen.getByRole('button', { name: /projects.stop_server/i });
        expect(stopBtn).toBeInTheDocument();
        expect(stopBtn).toHaveClass('min-w-0');
        expect(stopBtn.querySelector('.truncate')).toBeInTheDocument();
        expect(screen.getByText(/9876/)).toBeInTheDocument();

        await user.click(stopBtn);
        expect(props.onStopServer).toHaveBeenCalledWith('proj_node_1');
    });

    it('disables Start Server button and displays spinner when server is starting', () => {
        const serverInfo: RunningServerInfo = {
            running: false,
            starting: true,
        };
        renderCard({ project: nodeProject, serverInfo });

        const startingBtn = screen.getByRole('button', { name: /projects.server_starting/i });
        expect(startingBtn).toBeDisabled();
        expect(startingBtn.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders host unsynced warning and triggers sync callback when retry is clicked', async () => {
        const user = userEvent.setup();
        const unsyncedProject: ProjectData = {
            ...phpProject,
            host_synced: false,
        };
        const { props } = renderCard({ project: unsyncedProject });

        expect(screen.getByText('apache.domain_not_routed')).toBeInTheDocument();
        const retrySyncBtn = screen.getByRole('button', { name: /apache.retry_sync/i });
        await user.click(retrySyncBtn);

        expect(props.onSyncHost).toHaveBeenCalledWith('proj_php_1');
    });

    it('triggers open in browser when clicking the local domain link', async () => {
        const user = userEvent.setup();
        const { props } = renderCard({ project: phpProject });

        const domainLink = screen.getByText('laravel.local');
        await user.click(domainLink);

        expect(props.onOpenBrowser).toHaveBeenCalledWith('laravel.local');
    });
});
