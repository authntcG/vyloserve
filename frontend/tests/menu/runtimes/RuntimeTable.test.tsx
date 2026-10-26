import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import RuntimeTable from '../../../src/menu/runtimes/RuntimeTable';
import type { RuntimeVersionItem } from '../../../src/context/RuntimesContext';

describe('RuntimeTable', () => {
    const versions: RuntimeVersionItem[] = [
        {
            version: '20.18.0',
            path: 'C:/vyloserve/bin/runtimes/node/20.18.0',
            subtool: 'npm v10.8.2',
            is_active: true,
            in_path: true,
        },
        {
            version: '18.17.0',
            path: 'C:/vyloserve/bin/runtimes/node/18.17.0',
            subtool: 'npm v9.6.7',
            is_active: false,
            in_path: false,
        },
    ];

    it('renders all version rows and column values correctly', () => {
        render(
            <RuntimeTable
                engine="node"
                versions={versions}
                isProcessing={false}
                updateAvailable="20.19.0"
                onSetActive={vi.fn()}
                onUpdate={vi.fn()}
                onOpenFolder={vi.fn()}
                onOpenTerminal={vi.fn()}
                onUninstall={vi.fn()}
            />
        );

        expect(screen.getByText('NODE 20.18.0')).toBeInTheDocument();
        expect(screen.getByText('NODE 18.17.0')).toBeInTheDocument();
        expect(screen.getByText('runtimes.active_in_path')).toBeInTheDocument();
        expect(screen.getByText('runtimes.isolated_version')).toBeInTheDocument();
        expect(screen.getByText('npm v10.8.2')).toBeInTheDocument();
        expect(screen.getByText('npm v9.6.7')).toBeInTheDocument();
        expect(screen.getByText('20.19.0')).toBeInTheDocument();
    });

    it('handles deactivate, update, open folder, open terminal, and uninstall callbacks', async () => {
        const user = userEvent.setup();
        const setActive = vi.fn();
        const deactivate = vi.fn();
        const update = vi.fn();
        const openFolder = vi.fn();
        const openTerminal = vi.fn();
        const uninstall = vi.fn();

        render(
            <RuntimeTable
                engine="node"
                versions={versions}
                isProcessing={false}
                updateAvailable="20.19.0"
                onSetActive={setActive}
                onDeactivate={deactivate}
                onUpdate={update}
                onOpenFolder={openFolder}
                onOpenTerminal={openTerminal}
                onUninstall={uninstall}
            />
        );

        // Click update badge (passes newVersion and oldVersion)
        await user.click(screen.getByText('20.19.0'));
        expect(update).toHaveBeenCalledWith('20.19.0', '20.18.0');

        // With 1-click active switching, inactive row 1 has the activate button
        const setActiveBtn = screen.getByRole('button', { name: 'runtimes.set_as_active' });
        await user.click(setActiveBtn);
        expect(setActive).toHaveBeenCalledWith('18.17.0');

        // Row 0 has the deactivate button
        const deactivateBtn = screen.getByRole('button', { name: 'runtimes.deactivate_active_version' });
        await user.click(deactivateBtn);
        expect(deactivate).toHaveBeenCalledWith('20.18.0');

        // Click open folder button on first row
        const openFolderBtns = screen.getAllByTitle('runtimes.open_folder');
        await user.click(openFolderBtns[0]);
        expect(openFolder).toHaveBeenCalledWith('20.18.0');

        // Click open terminal on second row
        const openTerminalBtns = screen.getAllByRole('button', { name: 'runtimes.open_in_terminal' });
        await user.click(openTerminalBtns[1]);
        expect(openTerminal).toHaveBeenCalledWith('18.17.0');

        // Click uninstall on first row
        const uninstallBtns = screen.getAllByRole('button', { name: 'runtimes.uninstall_version_title' });
        await user.click(uninstallBtns[0]);
        expect(uninstall).toHaveBeenCalledWith('20.18.0');
    });

    it('shows activate button on inactive rows when no version is active', async () => {
        const user = userEvent.setup();
        const setActive = vi.fn();
        const inactiveVersions = versions.map((v) => ({ ...v, is_active: false, in_path: false }));

        render(
            <RuntimeTable
                engine="node"
                versions={inactiveVersions}
                isProcessing={false}
                onSetActive={setActive}
                onOpenFolder={vi.fn()}
                onOpenTerminal={vi.fn()}
                onUninstall={vi.fn()}
            />
        );

        const setActiveBtns = screen.getAllByRole('button', { name: 'runtimes.set_as_active' });
        expect(setActiveBtns.length).toBe(2);

        await user.click(setActiveBtns[0]);
        expect(setActive).toHaveBeenCalledWith('20.18.0');
    });

    it('filters rows when searching', async () => {
        const user = userEvent.setup();
        render(
            <RuntimeTable
                engine="node"
                versions={versions}
                isProcessing={false}
                onSetActive={vi.fn()}
                onOpenFolder={vi.fn()}
                onOpenTerminal={vi.fn()}
                onUninstall={vi.fn()}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        await user.type(searchInput, '18.17');

        expect(screen.getByText('NODE 18.17.0')).toBeInTheDocument();
        expect(screen.queryByText('NODE 20.18.0')).not.toBeInTheDocument();
    });

    it('renders active_vyloserve and locked tooltip when hasExternal is true', () => {
        const inactiveVersions = versions.map((v) => ({ ...v, is_active: false, in_path: false }));
        const { unmount: unmountFirst } = render(
            <RuntimeTable
                engine="node"
                versions={[{ ...versions[0], is_active: true }, ...inactiveVersions.slice(1)]}
                isProcessing={false}
                hasExternal={true}
                onSetActive={vi.fn()}
                onOpenFolder={vi.fn()}
                onOpenTerminal={vi.fn()}
                onUninstall={vi.fn()}
            />
        );

        expect(screen.getByText('runtimes.active_vyloserve')).toBeInTheDocument();
        unmountFirst();

        // When all are inactive with external detected, activate tooltip reflects external lock
        const { unmount } = render(
            <RuntimeTable
                engine="node"
                versions={inactiveVersions}
                isProcessing={false}
                hasExternal={true}
                onSetActive={vi.fn()}
                onOpenFolder={vi.fn()}
                onOpenTerminal={vi.fn()}
                onUninstall={vi.fn()}
            />
        );

        expect(screen.getAllByTitle('runtimes.set_as_active_vyloserve_tooltip').length).toBe(2);
        unmount();
    });
});
