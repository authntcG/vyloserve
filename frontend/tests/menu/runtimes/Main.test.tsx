import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import RuntimesMain from '../../../src/menu/runtimes/Main';

const notInstalled = { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } };
const nodeInstalled = { installed: true, version: '20.11.0', in_path: false, external: { exists: false, path: '', version: '' } };
const nodeExternal = { installed: false, version: '', in_path: false, external: { exists: true, path: 'C:/nodejs/node.exe', version: '18.0.0' } };

function runtimesApi(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    return {
        get_node_status: vi.fn().mockResolvedValue(notInstalled),
        get_python_status: vi.fn().mockResolvedValue(notInstalled),
        get_java_status: vi.fn().mockResolvedValue(notInstalled),
        get_go_status: vi.fn().mockResolvedValue(notInstalled),
        get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_available_python_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_available_java_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        get_available_go_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        ...overrides,
    };
}

const ENGINES = [
    { key: 'node', tab: 'Node.js', card: 'Node.js (VyloServe)', uninstallLabel: 'runtimes.uninstall_node', statusApi: 'get_node_status', uninstallApi: 'uninstall_node' },
    { key: 'python', tab: 'Python', card: 'Python (VyloServe)', uninstallLabel: 'runtimes.uninstall_python', statusApi: 'get_python_status', uninstallApi: 'uninstall_python' },
    { key: 'java', tab: 'Java JDK', card: 'Java JDK (VyloServe)', uninstallLabel: 'runtimes.uninstall_java', statusApi: 'get_java_status', uninstallApi: 'uninstall_java' },
    { key: 'go', tab: 'Go Compiler', card: 'Go Compiler (VyloServe)', uninstallLabel: 'runtimes.uninstall_go', statusApi: 'get_go_status', uninstallApi: 'uninstall_go' },
] as const;

describe.each(ENGINES)('RuntimesMain — $key engine', ({ tab, card, uninstallLabel, statusApi, uninstallApi }) => {
    it(`shows the installed ${card} once fetched`, async () => {
        mockPywebviewApi(runtimesApi({ [statusApi]: vi.fn().mockResolvedValue(nodeInstalled) }));
        const user = userEvent.setup();
        renderWithToast(<RuntimesMain />);
        await screen.findByText('Node.js');
        await user.click(screen.getByText(tab));

        expect(await screen.findByText(card)).toBeInTheDocument();
    });

    it(`calls ${uninstallApi} and refreshes status when confirming uninstall`, async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success' });
        const getStatus = vi.fn().mockResolvedValueOnce(nodeInstalled).mockResolvedValue(notInstalled);
        mockPywebviewApi(runtimesApi({ [statusApi]: getStatus, [uninstallApi]: uninstall }));
        renderWithToast(<RuntimesMain />);
        await user.click(screen.getByText(tab));
        await screen.findByText(uninstallLabel);

        await user.click(screen.getByText(uninstallLabel));
        await screen.findByText('runtimes.yes_uninstall');
        await user.click(screen.getByText('runtimes.yes_uninstall'));

        expect(uninstall).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    });
});

describe('RuntimesMain', () => {
    it('shows the loading subtitle while fetching, then the detected-engines count', async () => {
        mockPywebviewApi(runtimesApi());
        renderWithToast(<RuntimesMain />);
        expect(screen.getByText('runtimes.loading_data')).toBeInTheDocument();

        await screen.findByText(/runtimes.engines_detected/);
    });

    it('shows the empty state for the Node.js tab when nothing is installed or detected', async () => {
        mockPywebviewApi(runtimesApi());
        renderWithToast(<RuntimesMain />);

        expect(await screen.findByText('runtimes.node_not_installed')).toBeInTheDocument();
    });

    it('shows the installed Node.js card and header actions once fetched', async () => {
        mockPywebviewApi(runtimesApi({ get_node_status: vi.fn().mockResolvedValue(nodeInstalled) }));
        renderWithToast(<RuntimesMain />);

        expect(await screen.findByText('Node.js (VyloServe)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /runtimes.add Node/i })).toBeInTheDocument();
        expect(screen.getByTitle('Table View')).toBeInTheDocument();
    });

    it('shows the locked external-native card for Node.js when detected but not installed', async () => {
        mockPywebviewApi(runtimesApi({ get_node_status: vi.fn().mockResolvedValue(nodeExternal) }));
        renderWithToast(<RuntimesMain />);

        expect(await screen.findByText('Node.js (runtimes.native)')).toBeInTheDocument();
        expect(screen.getByText('C:/nodejs/node.exe')).toBeInTheDocument();
    });

    it('switches tabs, keeping panels in the DOM but toggling visibility', async () => {
        mockPywebviewApi(runtimesApi());
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.node_not_installed');
        const user = userEvent.setup();

        await user.click(screen.getByText('Python'));

        expect(screen.getByText('runtimes.node_not_installed').parentElement?.parentElement).toHaveClass('hidden');
        expect(screen.getByText('runtimes.python_not_installed').parentElement?.parentElement).toHaveClass('block');
    });

    it('enables the register-PATH toggle and shows a success toast when turned on', async () => {
        const user = userEvent.setup();
        const togglePath = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(runtimesApi({ get_node_status: vi.fn().mockResolvedValue(nodeInstalled), toggle_global_path: togglePath }));
        renderWithToast(<RuntimesMain />);
        await screen.findByLabelText('runtimes.register_path');

        await user.click(screen.getByLabelText('runtimes.register_path'));

        expect(togglePath).toHaveBeenCalledWith('node', true);
        expect(await screen.findByText('runtimes.path_added_success')).toBeInTheDocument();
    });

    it('shows the API-provided error toast when toggling PATH registration fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeInstalled),
            toggle_global_path: vi.fn().mockResolvedValue({ status: 'error', message: 'runtimes.custom_toggle_error', args: {} }),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByLabelText('runtimes.register_path');

        await user.click(screen.getByLabelText('runtimes.register_path'));

        expect(await screen.findByText('runtimes.custom_toggle_error')).toBeInTheDocument();
    });

    it('disables the register-PATH toggle when an external native runtime is also installed', async () => {
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue({ ...nodeInstalled, external: { exists: true, path: 'C:/nodejs/node.exe', version: '18.0.0' } }),
        }));
        renderWithToast(<RuntimesMain />);

        expect(await screen.findByLabelText('runtimes.register_path')).toBeDisabled();
    });

    it('opens the uninstall confirmation and calls uninstall_node for the Node.js engine', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success' });
        const getNode = vi.fn().mockResolvedValueOnce(nodeInstalled).mockResolvedValue(notInstalled);
        mockPywebviewApi(runtimesApi({ get_node_status: getNode, uninstall_node: uninstall }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.uninstall_node');

        await user.click(screen.getByText('runtimes.uninstall_node'));
        expect(await screen.findByText(/runtimes.uninstall_title/)).toBeInTheDocument();
        await user.click(screen.getByText('runtimes.yes_uninstall'));

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/runtimes.uninstall_success/)).toBeInTheDocument();
    });

    it('shows the API-provided error when uninstalling fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeInstalled),
            uninstall_node: vi.fn().mockResolvedValue({ status: 'error', message: 'runtimes.custom_uninstall_error', args: {} }),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.uninstall_node');
        await user.click(screen.getByText('runtimes.uninstall_node'));
        await screen.findByText('runtimes.yes_uninstall');

        await user.click(screen.getByText('runtimes.yes_uninstall'));

        expect(await screen.findByText('runtimes.custom_uninstall_error')).toBeInTheDocument();
    });

    it('installs Node.js through the real install form and refreshes the status on success', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        const getNode = vi.fn().mockResolvedValueOnce(notInstalled).mockResolvedValue(nodeInstalled);
        mockPywebviewApi(runtimesApi({
            get_node_status: getNode,
            get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '20.11.0', label: 'v20.11.0 LTS' }] }),
            install_node: install,
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.node_not_installed');
        await user.click(screen.getByText(/runtimes.add/));
        await screen.findByText('v20.11.0 LTS');

        await user.click(screen.getByText('runtimes.install_engine_btn'));

        await waitFor(() => expect(install).toHaveBeenCalledWith('20.11.0', true));
        await screen.findByText('Node.js (VyloServe)');
    });

    it('minimizes the install modal into the background widget while processing, and can be restored', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '20.11.0', label: 'v20.11.0 LTS' }] }),
            install_node: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.node_not_installed');
        await user.click(screen.getByText(/runtimes.add/));
        await screen.findByText('v20.11.0 LTS');
        await user.click(screen.getByText('runtimes.install_engine_btn'));
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'RuntimesManager', percent: 50, text: 'Downloading...' } }));
        });

        // Modal order in the JSX: node, python, java, go
        // keepMounted={isProcessing}, so all render "Close" overlays at once; index 0 is Node's.
        await user.click(screen.getAllByLabelText('Close')[0]);
        const widget = await screen.findByRole('button', { name: /runtimes\.install_title/ });
        expect(widget).toBeInTheDocument();

        await user.click(widget);

        expect(screen.getAllByText('runtimes.installing_btn').length).toBeGreaterThan(0);
    });

    it('updates the progress bar only for RuntimesManager-sourced events while installing', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '20.11.0', label: 'v20.11.0 LTS' }] }),
            install_node: vi.fn().mockReturnValue(new Promise(() => {})),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.node_not_installed');
        await user.click(screen.getByText(/runtimes.add/));
        await screen.findByText('v20.11.0 LTS');
        await user.click(screen.getByText('runtimes.install_engine_btn'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 50, text: 'wrong module' } }));
        });
        expect(screen.queryByText('wrong module')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'RuntimesManager', percent: 65, text: 'Downloading Node.js...' } }));
        });
        await waitFor(() => expect(screen.getAllByText('Downloading Node.js...').length).toBeGreaterThan(0));
        expect(screen.getAllByText('65%').length).toBeGreaterThan(0);
    });

    it('turns off PATH registration for an already-registered engine and shows the "removed" toast', async () => {
        const user = userEvent.setup();
        const togglePath = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue({ ...nodeInstalled, in_path: true }),
            toggle_global_path: togglePath,
        }));
        renderWithToast(<RuntimesMain />);
        await waitFor(() => expect(screen.getByLabelText('runtimes.register_path')).toBeChecked());

        await user.click(screen.getByLabelText('runtimes.register_path'));

        expect(togglePath).toHaveBeenCalledWith('node', false);
        expect(await screen.findByText('runtimes.path_removed_success')).toBeInTheDocument();
    });

    it('shows a generic error toast when toggling PATH registration throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeInstalled),
            toggle_global_path: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByLabelText('runtimes.register_path');

        await user.click(screen.getByLabelText('runtimes.register_path'));

        expect(await screen.findByText('runtimes.path_change_sys_error')).toBeInTheDocument();
    });

    it('shows a generic error toast when uninstalling throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeInstalled),
            uninstall_node: vi.fn().mockRejectedValue(new Error('boom')),
        }));
        renderWithToast(<RuntimesMain />);
        await screen.findByText('runtimes.uninstall_node');
        await user.click(screen.getByText('runtimes.uninstall_node'));
        await screen.findByText('runtimes.yes_uninstall');

        await user.click(screen.getByText('runtimes.yes_uninstall'));

        expect(await screen.findByText('runtimes.uninstall_sys_error')).toBeInTheDocument();
    });

    it.each([
        { tab: 'Python', versionsApi: 'get_available_python_versions', installApi: 'install_python', engineName: 'Python' },
        { tab: 'Java JDK', versionsApi: 'get_available_java_versions', installApi: 'install_java', engineName: 'Java (JDK)' },
        { tab: 'Go Compiler', versionsApi: 'get_available_go_versions', installApi: 'install_go', engineName: 'Go Compiler' },
    ])('opens the install modal and installs $engineName from its own tab', async ({ tab, versionsApi, installApi }) => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi(runtimesApi({
            [versionsApi]: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '1.0', label: 'v1.0' }] }),
            [installApi]: install,
        }));
        renderWithToast(<RuntimesMain />);
        await waitFor(() => expect(screen.getByText(/runtimes\.add/)).not.toBeDisabled());
        await user.click(screen.getByText(tab));
        await user.click(screen.getByText(/runtimes\.add/));
        await screen.findByText('v1.0');

        await user.click(screen.getByText('runtimes.install_engine_btn'));

        await waitFor(() => expect(install).toHaveBeenCalled());
    });

    it('renders subtool when present and triggers folder open & terminal actions', async () => {
        const user = userEvent.setup();
        const openDir = vi.fn().mockResolvedValue({ status: 'success' });
        const listener = vi.fn();
        window.addEventListener('vylo_open_terminal_project', listener);

        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue({
                ...nodeInstalled,
                subtool: 'npm v10.8.2',
            }),
            open_runtime_dir: openDir,
        }));

        renderWithToast(<RuntimesMain />);

        expect(await screen.findByText('npm v10.8.2')).toBeInTheDocument();
        expect(screen.getByText('runtimes.subtools_ecosystem')).toBeInTheDocument();

        // Click Open Folder button
        const openFolderBtn = screen.getByRole('button', { name: /runtimes\.open_folder/i });
        await user.click(openFolderBtn);
        expect(openDir).toHaveBeenCalledWith('node');

        // Click Open in Terminal button
        const openTerminalBtn = screen.getByRole('button', { name: /runtimes\.open_in_terminal/i });
        await user.click(openTerminalBtn);
        expect(listener).toHaveBeenCalled();

        window.removeEventListener('vylo_open_terminal_project', listener);
    });

    it('renders multi-version list in card view and switches to table view', async () => {
        const user = userEvent.setup();
        const nodeWithVersions = {
            ...nodeInstalled,
            installed_versions: [
                { version: '20.18.0', path: 'C:/bin/runtimes/node/20.18.0', subtool: 'npm', is_active: true, in_path: true },
                { version: '18.17.0', path: 'C:/bin/runtimes/node/18.17.0', subtool: 'npm', is_active: false, in_path: false },
            ]
        };

        const setActive = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.runtimes.version_activated', args: { engine: 'NODE', version: '18.17.0' } });
        const uninstallVer = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.runtimes.version_uninstalled', args: { engine: 'NODE', version: '18.17.0' } });

        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeWithVersions),
            set_active_runtime_version: setActive,
            uninstall_runtime_version: uninstallVer,
        }));

        renderWithToast(<RuntimesMain />);

        expect((await screen.findAllByText('Node.js 20.18.0')).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Node.js 18.17.0')).toBeInTheDocument();

        // Switch to Table View
        const tableViewBtn = screen.getByTitle('Table View');
        await user.click(tableViewBtn);

        // Table headers and items should be visible
        expect(screen.getByText('runtimes.th_version')).toBeInTheDocument();
        expect(screen.getByText('NODE 20.18.0')).toBeInTheDocument();
        expect(screen.getByText('NODE 18.17.0')).toBeInTheDocument();

        // Centralized RuntimePathHub remains visible above table
        expect(screen.getByText('runtimes.path_orchestration_title')).toBeInTheDocument();
        expect(screen.getByLabelText('runtimes.register_path')).toBeInTheDocument();
    });

    it('renders centralized RuntimePathHub with PATH toggle and version select', async () => {
        const user = userEvent.setup();
        const nodeWithVersions = {
            ...nodeInstalled,
            in_path: true,
            installed_versions: [
                { version: '20.18.0', path: 'C:/bin/runtimes/node/20.18.0', subtool: 'npm', is_active: true, in_path: true },
                { version: '18.17.0', path: 'C:/bin/runtimes/node/18.17.0', subtool: 'npm', is_active: false, in_path: false },
            ]
        };

        const togglePath = vi.fn().mockResolvedValue({ status: 'success' });
        const setActive = vi.fn().mockResolvedValue({ status: 'success', message: 'backend.runtimes.version_activated' });

        mockPywebviewApi(runtimesApi({
            get_node_status: vi.fn().mockResolvedValue(nodeWithVersions),
            toggle_global_path: togglePath,
            set_active_runtime_version: setActive,
        }));

        renderWithToast(<RuntimesMain />);

        expect(await screen.findByText('runtimes.path_orchestration_title')).toBeInTheDocument();
        const pathToggle = screen.getByLabelText('runtimes.register_path');
        expect(pathToggle).toBeChecked();

        // Clicking toggle in RuntimePathHub calls toggle_global_path
        await user.click(pathToggle);
        expect(togglePath).toHaveBeenCalledWith('node', false);

        // Centralized active version select switches active version
        const versionSelect = screen.getByLabelText('runtimes.active_system_version');
        await user.click(versionSelect);
        const option18 = await screen.findByRole('option', { name: /18\.17\.0/i });
        await user.click(option18);
        expect(setActive).toHaveBeenCalledWith('node', '18.17.0');
    });
});
