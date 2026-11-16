import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, renderWithToast, fireEvent } from '../../test-utils';
import ProjectTable from '../../../src/menu/projects/ProjectTable';
import type { ProjectData } from '../../../src/context/ProjectContext';

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
];

describe('ProjectTable & ProjectTableActionMenu', () => {
    it('renders project list inside data table', () => {
        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={vi.fn()}
                onOpenSettings={vi.fn()}
                onSyncHost={vi.fn()}
                onDeleteClick={vi.fn()}
                onOpenBrowser={vi.fn()}
            />
        );

        expect(screen.getByText('Laravel App')).toBeInTheDocument();
        expect(screen.getByText('NextJS Portal')).toBeInTheDocument();
        expect(screen.getByText('laravel.local')).toBeInTheDocument();
        expect(screen.getByText('nextjs.local')).toBeInTheDocument();
    });

    it('opens action menu in a portal when clicking burger button, and closes on Escape', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={vi.fn()}
                onOpenSettings={vi.fn()}
                onSyncHost={vi.fn()}
                onDeleteClick={vi.fn()}
                onOpenBrowser={vi.fn()}
            />
        );

        // Menu shouldn't exist initially
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        // Click action button on first row
        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(actionButtons[0]);

        // Menu is now rendered via portal in document.body
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu.closest('body')).toBe(document.body);

        // Action options are available
        expect(screen.getByText('apache.open_document_root')).toBeInTheDocument();
        expect(screen.getByText('apache.open_in_terminal')).toBeInTheDocument();
        expect(screen.getByText('apache.vhost_settings')).toBeInTheDocument();
        expect(screen.getByText('apache.delete_project')).toBeInTheDocument();

        // Press Escape to dismiss
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('triggers action callback and closes menu upon selection', async () => {
        const user = userEvent.setup();
        const onOpenDocRoot = vi.fn();
        const onDelete = vi.fn();

        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={onOpenDocRoot}
                onOpenSettings={vi.fn()}
                onSyncHost={vi.fn()}
                onDeleteClick={onDelete}
                onOpenBrowser={vi.fn()}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(actionButtons[0]);

        const docRootButton = screen.getByText('apache.open_document_root');
        await user.click(docRootButton);

        expect(onOpenDocRoot).toHaveBeenCalledWith('C:/www/laravel-app');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        // Reopen and click delete
        await user.click(actionButtons[0]);
        const deleteButton = screen.getByText('apache.delete_project');
        await user.click(deleteButton);

        expect(onDelete).toHaveBeenCalledWith('proj_php');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows View Dev Server Logs in action menu for non-PHP projects', async () => {
        const user = userEvent.setup();
        const onViewLogs = vi.fn();

        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={vi.fn()}
                onOpenSettings={vi.fn()}
                onViewLogs={onViewLogs}
                onSyncHost={vi.fn()}
                onDeleteClick={vi.fn()}
                onOpenBrowser={vi.fn()}
            />
        );

        // Click action button for second project (NextJS - non-PHP)
        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(actionButtons[1]);

        const viewLogsButton = screen.getByText('projects.view_server_logs');
        expect(viewLogsButton).toBeInTheDocument();
        await user.click(viewLogsButton);

        expect(onViewLogs).toHaveBeenCalledWith('proj_node');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes menu when clicking outside', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={vi.fn()}
                onOpenSettings={vi.fn()}
                onSyncHost={vi.fn()}
                onDeleteClick={vi.fn()}
                onOpenBrowser={vi.fn()}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(actionButtons[0]);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        // Click outside on body
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('calculates upward positioning when space below trigger is limited', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <ProjectTable
                projects={mockProjects}
                onOpenDocumentRoot={vi.fn()}
                onOpenSettings={vi.fn()}
                onSyncHost={vi.fn()}
                onDeleteClick={vi.fn()}
                onOpenBrowser={vi.fn()}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        
        // Mock getBoundingClientRect for trigger near bottom of window (e.g. y = 700, window.innerHeight = 768)
        vi.spyOn(actionButtons[0], 'getBoundingClientRect').mockReturnValue({
            bottom: 720,
            top: 680,
            left: 800,
            right: 840,
            width: 40,
            height: 40,
            x: 800,
            y: 680,
            toJSON: () => {},
        });

        // Window height 768 means spaceBelow is 768 - 720 = 48 (< 265), but rect.top = 680 (> 255)
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        await user.click(actionButtons[0]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();

        // Top style should be positioned above the trigger
        const topStyle = parseInt(menu.style.top, 10);
        expect(topStyle).toBeLessThan(680);
    });
});
