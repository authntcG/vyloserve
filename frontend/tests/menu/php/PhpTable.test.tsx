import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, renderWithToast } from '../../test-utils';
import PhpTable from '../../../src/menu/php/PhpTable';
import type { PhpInstance } from '../../../src/context/PhpContext';

const mockPhpInstances: PhpInstance[] = [
    {
        id: 'php-8.3',
        name: 'PHP 8.3',
        version: '8.3.4',
        port: 9003,
        status: 'running',
        dir: 'C:/vyloserve/bin/php/8.3.4',
        memory_limit: '512M',
        is_system: false,
    },
    {
        id: 'php-8.1',
        name: 'PHP 8.1',
        version: '8.1.20',
        port: 9001,
        status: 'stopped',
        dir: 'C:/vyloserve/bin/php/8.1.20',
        memory_limit: '256M',
        is_system: false,
    },
    {
        id: 'php-system',
        name: 'PHP System',
        version: '8.2.1',
        port: 0,
        status: 'stopped',
        dir: 'C:/tools/php',
        memory_limit: '128M',
        is_system: true,
    },
];

const mockUpdateMap = {
    'php-8.3': { version: '8.3.5', filename: 'php-8.3.5.zip' },
    'php-8.1': null,
    'php-system': null,
};

describe('PhpTable', () => {
    it('renders php instances with status badges, version, port, memory and path', () => {
        renderWithToast(
            <PhpTable
                phpInstances={mockPhpInstances}
                togglingInstanceId={null}
                updateMap={mockUpdateMap}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPhpIni={vi.fn()}
                onOpenPhpDir={vi.fn()}
                onUpdatePhp={vi.fn()}
                onUninstallPhp={vi.fn()}
            />
        );

        expect(screen.getByText('PHP 8.3.4')).toBeInTheDocument();
        expect(screen.getByText('PHP 8.1.20')).toBeInTheDocument();
        expect(screen.getByText('PHP 8.2.1')).toBeInTheDocument();

        // Status badges: running, stopped, and system native_os
        expect(screen.getByText('Running')).toBeInTheDocument();
        expect(screen.getByText('Stopped')).toBeInTheDocument();
        expect(screen.getByText('runtimes.native_os')).toBeInTheDocument();

        // Ports: 9003, 9001, and '-' for system
        expect(screen.getByText('9003')).toBeInTheDocument();
        expect(screen.getByText('9001')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();

        // Memory limit
        expect(screen.getByText('512M')).toBeInTheDocument();
        expect(screen.getByText('256M')).toBeInTheDocument();
        expect(screen.getByText('128M')).toBeInTheDocument();

        // Update badge for 8.3
        expect(screen.getByText('8.3.5')).toBeInTheDocument();
    });

    it('handles inline action buttons and hides config button for system instance', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        const onSettings = vi.fn();
        const onOpenDir = vi.fn();

        renderWithToast(
            <PhpTable
                phpInstances={mockPhpInstances}
                togglingInstanceId={null}
                updateMap={mockUpdateMap}
                onToggleStatus={onToggle}
                onOpenSettings={onSettings}
                onOpenPhpIni={vi.fn()}
                onOpenPhpDir={onOpenDir}
                onUpdatePhp={vi.fn()}
                onUninstallPhp={vi.fn()}
            />
        );

        // Toggle running instance (calls onToggle)
        const toggleButtons = screen.getAllByRole('button', { name: 'php.stop_cgi' });
        await user.click(toggleButtons[0]);
        expect(onToggle).toHaveBeenCalledWith(mockPhpInstances[0]);

        // Config buttons: only 2 should exist (for row 0 and row 1), row 2 (system) has NO config button
        const configButtons = screen.getAllByRole('button', { name: 'php.config' });
        expect(configButtons).toHaveLength(2);
        await user.click(configButtons[0]);
        expect(onSettings).toHaveBeenCalledWith(mockPhpInstances[0]);

        // Folder open shortcut in path column
        const dirButtons = screen.getAllByRole('button', { name: 'php.open_directory' });
        expect(dirButtons).toHaveLength(3);
        await user.click(dirButtons[0]);
        expect(onOpenDir).toHaveBeenCalledWith('8.3.4');
    });

    it('opens burger menu for non-system instance and triggers ini, dir, update, and uninstall', async () => {
        const user = userEvent.setup();
        const onIni = vi.fn();
        const onDir = vi.fn();
        const onUpdate = vi.fn();
        const onUninstall = vi.fn();

        renderWithToast(
            <PhpTable
                phpInstances={mockPhpInstances}
                togglingInstanceId={null}
                updateMap={mockUpdateMap}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPhpIni={onIni}
                onOpenPhpDir={onDir}
                onUpdatePhp={onUpdate}
                onUninstallPhp={onUninstall}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(actionButtons[0]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu.closest('body')).toBe(document.body);

        // Check options
        expect(screen.getByText('php.open_php_ini')).toBeInTheDocument();
        expect(screen.getByText('php.open_directory')).toBeInTheDocument();
        expect(screen.getByText('php.update_to')).toBeInTheDocument();
        expect(screen.getByText('php.uninstall')).toBeInTheDocument();

        // Click ini
        await user.click(screen.getByText('php.open_php_ini'));
        expect(onIni).toHaveBeenCalledWith('8.3.4');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        // Reopen & click dir
        await user.click(actionButtons[0]);
        await user.click(screen.getByText('php.open_directory'));
        expect(onDir).toHaveBeenCalledWith('8.3.4');

        // Reopen & click update
        await user.click(actionButtons[0]);
        await user.click(screen.getByText('php.update_to'));
        expect(onUpdate).toHaveBeenCalledWith(mockPhpInstances[0], '8.3.5', 'php-8.3.5.zip');

        // Reopen & click uninstall
        await user.click(actionButtons[0]);
        await user.click(screen.getByText('php.uninstall'));
        expect(onUninstall).toHaveBeenCalledWith(mockPhpInstances[0]);
    });

    it('renders system-managed notice in burger menu for system instance without actions', async () => {
        const user = userEvent.setup();

        renderWithToast(
            <PhpTable
                phpInstances={mockPhpInstances}
                togglingInstanceId={null}
                updateMap={mockUpdateMap}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPhpIni={vi.fn()}
                onOpenPhpDir={vi.fn()}
                onUpdatePhp={vi.fn()}
                onUninstallPhp={vi.fn()}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });
        // Click action button for row 2 (system PHP)
        await user.click(actionButtons[2]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();

        // System notice is visible
        expect(screen.getByText('php.system_managed_instance')).toBeInTheDocument();

        // Non-system actions are not in the menu
        expect(screen.queryByText('php.open_php_ini')).not.toBeInTheDocument();
        expect(screen.queryByText('php.uninstall')).not.toBeInTheDocument();
    });

    it('positions menu upwards when near the bottom of viewport', async () => {
        const user = userEvent.setup();

        renderWithToast(
            <PhpTable
                phpInstances={mockPhpInstances}
                togglingInstanceId={null}
                updateMap={mockUpdateMap}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPhpIni={vi.fn()}
                onOpenPhpDir={vi.fn()}
                onUpdatePhp={vi.fn()}
                onUninstallPhp={vi.fn()}
            />
        );

        const actionButtons = screen.getAllByRole('button', { name: /actions/i });

        vi.spyOn(actionButtons[0], 'getBoundingClientRect').mockReturnValue({
            bottom: 740,
            top: 700,
            left: 800,
            right: 840,
            width: 40,
            height: 40,
            x: 800,
            y: 700,
            toJSON: () => {},
        });

        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        await user.click(actionButtons[0]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        const topStyle = parseInt(menu.style.top, 10);
        expect(topStyle).toBeLessThan(700);
    });
});
