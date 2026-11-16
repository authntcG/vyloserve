import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, renderWithToast } from '../../test-utils';
import DatabaseTable from '../../../src/menu/database/DatabaseTable';
import type { DbInstance, AvailableUpdate } from '../../../src/context/DatabaseContext';

const mockDbInstances: DbInstance[] = [
    {
        id: 'mysql-8.0',
        name: 'MySQL 8.0',
        engine: 'mysql',
        version: '8.0.36',
        port: 3306,
        status: 'running',
        dataDir: 'C:/vyloserve/bin/mysql/data',
    },
    {
        id: 'postgres-16',
        name: 'PostgreSQL 16',
        engine: 'postgres',
        version: '16.2',
        port: 5432,
        status: 'stopped',
        dataDir: 'C:/vyloserve/bin/postgres/data',
    },
    {
        id: 'redis-7',
        name: 'Redis Server',
        engine: 'redis',
        version: '7.2.4',
        port: 6379,
        status: 'running',
        dataDir: 'C:/vyloserve/bin/redis/data',
    },
];

const mockUpdates: Record<string, AvailableUpdate | null> = {
    'mysql-8.0': { version: '8.0.37', url: 'https://example.com/mysql.zip' },
    'postgres-16': null,
    'redis-7': null,
};

describe('DatabaseTable', () => {
    it('renders database instances with correct columns and status badges', () => {
        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={vi.fn()}
                onFlushRedis={vi.fn()}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={vi.fn()}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        expect(screen.getByText('MySQL 8.0')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL 16')).toBeInTheDocument();
        expect(screen.getByText('Redis Server')).toBeInTheDocument();

        // Status badges (using fallback labels from t('database.running', 'Running'))
        expect(screen.getAllByText('Running')).toHaveLength(2);
        expect(screen.getByText('Stopped')).toBeInTheDocument();

        // Ports
        expect(screen.getByText('3306')).toBeInTheDocument();
        expect(screen.getByText('5432')).toBeInTheDocument();
        expect(screen.getByText('6379')).toBeInTheDocument();

        // Update badge for MySQL
        expect(screen.getByText('8.0.37')).toBeInTheDocument();
    });

    it('handles inline action buttons: toggle, schemas/flush, config, and data dir', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        const onSchemas = vi.fn();
        const onFlush = vi.fn();
        const onSettings = vi.fn();
        const onDataDir = vi.fn();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={onToggle}
                onOpenSettings={onSettings}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={onSchemas}
                onFlushRedis={onFlush}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={onDataDir}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        // Click toggle status on first row (running MySQL)
        const toggleButtons = screen.getAllByRole('button', { name: 'database.stop_db' });
        await user.click(toggleButtons[0]);
        expect(onToggle).toHaveBeenCalledWith(mockDbInstances[0]);

        // Click Manage Schemas on running MySQL
        const schemaButtons = screen.getAllByRole('button', { name: 'database.manage_schemas' });
        await user.click(schemaButtons[0]);
        expect(onSchemas).toHaveBeenCalledWith(mockDbInstances[0]);

        // Manage Schemas on stopped PostgreSQL is disabled
        expect(schemaButtons[1]).toBeDisabled();

        // Flush Redis on running Redis (fallback is 'Flush Keys')
        const flushButton = screen.getByRole('button', { name: 'Flush Keys' });
        await user.click(flushButton);
        expect(onFlush).toHaveBeenCalledWith(mockDbInstances[2]);

        // Config buttons
        const configButtons = screen.getAllByRole('button', { name: 'database.config' });
        await user.click(configButtons[0]);
        expect(onSettings).toHaveBeenCalledWith(mockDbInstances[0]);

        // Open data folder inline shortcut
        const dataDirButtons = screen.getAllByRole('button', { name: 'database.open_data_folder' });
        await user.click(dataDirButtons[0]);
        expect(onDataDir).toHaveBeenCalledWith(mockDbInstances[0]);
    });

    it('opens burger menu in portal and displays MySQL options including native log and update', async () => {
        const user = userEvent.setup();
        const onConfigFile = vi.fn();
        const onLogs = vi.fn();
        const onPassword = vi.fn();
        const onUpdate = vi.fn();
        const onUninstall = vi.fn();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={onPassword}
                onOpenSchemas={vi.fn()}
                onFlushRedis={vi.fn()}
                onOpenConfigFile={onConfigFile}
                onOpenDataDir={vi.fn()}
                onOpenLogs={onLogs}
                onUpdateDatabase={onUpdate}
                onUninstallDatabase={onUninstall}
            />
        );

        // Click burger menu on MySQL (row 0)
        const menuButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(menuButtons[0]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu.closest('body')).toBe(document.body);

        // Check MySQL specific items
        expect(screen.getByText('database.open_my_ini')).toBeInTheDocument();
        expect(screen.getByText('settings.log_file_startup')).toBeInTheDocument();
        expect(screen.getByText('settings.log_file_native')).toBeInTheDocument();
        expect(screen.getByText('database.change_password')).toBeInTheDocument();
        expect(screen.getByText('database.drop_engine')).toBeInTheDocument();

        // Update item present
        const updateMenuItem = screen.getByText('database.update_to');
        expect(updateMenuItem).toBeInTheDocument();

        // Click config file
        await user.click(screen.getByText('database.open_my_ini'));
        expect(onConfigFile).toHaveBeenCalledWith(mockDbInstances[0]);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        // Reopen menu & test native log
        await user.click(menuButtons[0]);
        await user.click(screen.getByText('settings.log_file_native'));
        expect(onLogs).toHaveBeenCalledWith(mockDbInstances[0], 'native');

        // Reopen menu & test startup log
        await user.click(menuButtons[0]);
        await user.click(screen.getByText('settings.log_file_startup'));
        expect(onLogs).toHaveBeenCalledWith(mockDbInstances[0], 'startup');

        // Reopen menu & test change password
        await user.click(menuButtons[0]);
        await user.click(screen.getByText('database.change_password'));
        expect(onPassword).toHaveBeenCalledWith(mockDbInstances[0]);

        // Reopen menu & test update
        await user.click(menuButtons[0]);
        await user.click(screen.getByText('database.update_to'));
        expect(onUpdate).toHaveBeenCalledWith(mockDbInstances[0]);

        // Reopen menu & test uninstall
        await user.click(menuButtons[0]);
        await user.click(screen.getByText('database.drop_engine'));
        expect(onUninstall).toHaveBeenCalledWith(mockDbInstances[0]);
    });

    it('renders Postgres menu with postgres.conf and no native log', async () => {
        const user = userEvent.setup();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={vi.fn()}
                onFlushRedis={vi.fn()}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={vi.fn()}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        // Click burger menu on Postgres (row 1)
        const menuButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(menuButtons[1]);

        expect(screen.getByText('database.open_postgres_conf')).toBeInTheDocument();
        expect(screen.queryByText('settings.log_file_native')).not.toBeInTheDocument();
        expect(screen.getByText('database.change_password')).toBeInTheDocument();
    });

    it('renders Redis menu with flush keys, redis.conf and no password or schemas', async () => {
        const user = userEvent.setup();
        const onFlush = vi.fn();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={vi.fn()}
                onFlushRedis={onFlush}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={vi.fn()}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        // Click burger menu on Redis (row 2)
        const menuButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(menuButtons[2]);

        expect(screen.getByText('redis.conf')).toBeInTheDocument();
        expect(screen.queryByText('database.change_password')).not.toBeInTheDocument();
        expect(screen.queryByText('settings.log_file_native')).not.toBeInTheDocument();

        // Flush keys inside menu
        const menuFlushBtn = screen.getAllByRole('menuitem').find(btn => btn.textContent?.includes('database.flush_redis'));
        expect(menuFlushBtn).toBeDefined();
        if (menuFlushBtn) {
            await user.click(menuFlushBtn);
            expect(onFlush).toHaveBeenCalledWith(mockDbInstances[2]);
        }
    });

    it('disables update item when isInstalling is true', async () => {
        const user = userEvent.setup();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                isInstalling={true}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={vi.fn()}
                onFlushRedis={vi.fn()}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={vi.fn()}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        const menuButtons = screen.getAllByRole('button', { name: /actions/i });
        await user.click(menuButtons[0]);

        const updateItem = screen.getByRole('menuitem', { name: /database.update_to/i });
        expect(updateItem).toBeDisabled();
    });

    it('positions menu upwards when near the bottom of viewport', async () => {
        const user = userEvent.setup();

        renderWithToast(
            <DatabaseTable
                dbInstances={mockDbInstances}
                togglingDbId={null}
                availableUpdates={mockUpdates}
                onToggleStatus={vi.fn()}
                onOpenSettings={vi.fn()}
                onOpenPasswordModal={vi.fn()}
                onOpenSchemas={vi.fn()}
                onFlushRedis={vi.fn()}
                onOpenConfigFile={vi.fn()}
                onOpenDataDir={vi.fn()}
                onOpenLogs={vi.fn()}
                onUpdateDatabase={vi.fn()}
                onUninstallDatabase={vi.fn()}
            />
        );

        const menuButtons = screen.getAllByRole('button', { name: /actions/i });

        vi.spyOn(menuButtons[0], 'getBoundingClientRect').mockReturnValue({
            bottom: 730,
            top: 690,
            left: 800,
            right: 840,
            width: 40,
            height: 40,
            x: 800,
            y: 690,
            toJSON: () => {},
        });

        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        await user.click(menuButtons[0]);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        const topStyle = parseInt(menu.style.top, 10);
        expect(topStyle).toBeLessThan(690);
    });
});
