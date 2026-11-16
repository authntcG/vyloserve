import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ApacheProvider, useApache } from '../../src/context/ApacheContext';
import { PhpProvider, usePhp } from '../../src/context/PhpContext';
import { DatabaseProvider, useDatabase } from '../../src/context/DatabaseContext';
import { DashboardProvider, useDashboard } from '../../src/context/DashboardContext';
import { RuntimesProvider, useRuntimes } from '../../src/context/RuntimesContext';
import { TunnelsProvider, useTunnels } from '../../src/context/TunnelsContext';
import { GitProvider, useGit } from '../../src/context/GitContext';
import { ProjectProvider, useProject } from '../../src/context/ProjectContext';
import { ToastProvider } from '../../src/context/ToastContext';
import { AlertProvider } from '../../src/context/AlertContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>
        <AlertProvider>
            {children}
        </AlertProvider>
    </ToastProvider>
);

describe('Module Contexts error boundaries and initialization', () => {
    let mockApi: any;

    beforeEach(() => {
        mockApi = {
            get_apache_status: vi.fn().mockResolvedValue({ status: 'success', running: false, installed: true, version: '2.4.58' }),
            get_apache_installed_versions: vi.fn().mockResolvedValue({ status: 'success', current: '2.4.58', versions: [] }),
            get_apache_ports_status: vi.fn().mockResolvedValue({ status: 'success', http: 80, https: 443 }),
            start_apache_server: vi.fn().mockResolvedValue({ status: 'success' }),
            stop_apache_server: vi.fn().mockResolvedValue({ status: 'success' }),
            open_apache_config: vi.fn(),
            open_apache_directory: vi.fn(),
            open_apache_htdocs: vi.fn(),
            open_apache_conf_dir: vi.fn(),
            open_apache_logs_dir: vi.fn(),
            open_browser: vi.fn().mockResolvedValue({ status: 'success' }),
            open_in_explorer: vi.fn().mockResolvedValue({ status: 'success' }),

            get_projects: vi.fn().mockResolvedValue({
                status: 'success',
                data: [
                    { id: 'proj_1', name: 'Alpha', domain: 'alpha.local', path: 'C:/www/alpha', framework: 'laravel' }
                ]
            }),
            get_running_dev_servers: vi.fn().mockResolvedValue({ status: 'success', running: [] }),
            start_project_server: vi.fn().mockResolvedValue({ status: 'success', pid: 1234, port: 8000, message: 'backend.project.server_started' }),
            stop_project_server: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.project.server_stopped' }),
            retry_sync_host: vi.fn().mockResolvedValue({ status: 'success' }),
            delete_project: vi.fn().mockResolvedValue({ status: 'success' }),
            get_dev_server_logs: vi.fn().mockResolvedValue({ status: 'success', data: { logs: 'Server output' } }),

            get_installed_php: vi.fn().mockResolvedValue([
                { id: 'php_82', version: '8.2', installed: true, running: false, is_default: true, path_enabled: true, port: 9000 }
            ]),
            get_php_versions: vi.fn().mockResolvedValue({ status: 'success', versions: [] }),
            start_php: vi.fn().mockResolvedValue({ status: 'success' }),
            stop_php: vi.fn().mockResolvedValue({ status: 'success' }),
            open_php_ini: vi.fn(),
            open_php_dir: vi.fn(),

            get_node_status: vi.fn().mockResolvedValue({ installed: true, version: '20.0.0', versions: [{ version: '20.0.0', active: true }] }),
            get_python_status: vi.fn().mockResolvedValue({ installed: false, versions: [] }),
            get_java_status: vi.fn().mockResolvedValue({ installed: false, versions: [] }),
            get_go_status: vi.fn().mockResolvedValue({ installed: false, versions: [] }),
            get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            get_available_go_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            toggle_global_path: vi.fn().mockResolvedValue({ status: 'success' }),
            set_active_runtime_version: vi.fn().mockResolvedValue({ status: 'success' }),
            deactivate_runtime_version: vi.fn().mockResolvedValue({ status: 'success' }),
            open_runtime_dir: vi.fn().mockResolvedValue({ status: 'success' }),
            cancel_installation: vi.fn().mockResolvedValue({ status: 'success' })
        };
        (window as any).pywebview = { api: mockApi };
    });

    describe('ApacheContext', () => {
        it('throws error when useApache is used outside ApacheProvider', () => {
            expect(() => renderHook(() => useApache())).toThrow('useApache must be used within an ApacheProvider');
        });

        it('initializes inside ApacheProvider and handles actions', async () => {
            const { result } = renderHook(() => useApache(), {
                wrapper: ({ children }) => wrapper({ children: <ApacheProvider>{children}</ApacheProvider> })
            });
            expect(typeof result.current.fetchApacheStatus).toBe('function');

            await act(async () => {
                await result.current.fetchApacheStatus();
                await result.current.handleToggleServer();
                result.current.openConfigFile();
                result.current.openDirectory();
                result.current.openLocalhost();
                result.current.openHtdocs();
                result.current.openConfDir();
                result.current.openLogsDir();
            });

            expect(mockApi.get_apache_status).toHaveBeenCalled();
            expect(mockApi.start_apache_server).toHaveBeenCalled();
            expect(mockApi.open_apache_config).toHaveBeenCalled();
            expect(mockApi.open_apache_directory).toHaveBeenCalled();
        });
    });

    describe('ProjectContext', () => {
        it('throws error when useProject is used outside ProjectProvider', () => {
            expect(() => renderHook(() => useProject())).toThrow('useProject must be used within a ProjectProvider');
        });

        it('initializes inside ProjectProvider and handles project operations', async () => {
            const { result } = renderHook(() => useProject(), {
                wrapper: ({ children }) => wrapper({ children: <ProjectProvider>{children}</ProjectProvider> })
            });

            await act(async () => {
                await result.current.fetchProjects();
                await result.current.handleStartServer('proj_1');
                await result.current.handleStopServer('proj_1');
                await result.current.handleOpenBrowser('alpha.local', 'http');
                await result.current.handleOpenDocumentRoot('C:/www/alpha');
                await result.current.handleSyncHost('proj_1');
            });

            expect(mockApi.get_projects).toHaveBeenCalled();
            expect(mockApi.start_project_server).toHaveBeenCalledWith('proj_1');
            expect(mockApi.stop_project_server).toHaveBeenCalledWith('proj_1');
            expect(mockApi.open_browser).toHaveBeenCalledWith('http://alpha.local');
            expect(mockApi.open_in_explorer).toHaveBeenCalledWith('C:/www/alpha');
            expect(mockApi.retry_sync_host).toHaveBeenCalledWith('proj_1');
        });

        it('handles project events and progress updates', async () => {
            const { result } = renderHook(() => useProject(), {
                wrapper: ({ children }) => wrapper({ children: <ProjectProvider>{children}</ProjectProvider> })
            });

            act(() => {
                window.dispatchEvent(new CustomEvent('project_list_updated'));
                window.dispatchEvent(new CustomEvent('vylo_dev_server_state', {
                    detail: { project_id: 'proj_1', status: 'running', port: 3000 }
                }));
                window.dispatchEvent(new CustomEvent('vylo_cli_waiting_input', {
                    detail: { waiting_input: true, prompt: 'Confirm?' }
                }));
                window.dispatchEvent(new CustomEvent('vylo_progress', {
                    detail: { source: 'ProjectManager', percent: 75, text: 'Installing deps...' }
                }));
            });

            expect(result.current.progress).toBe(75);
            expect(result.current.progressText).toBe('Installing deps...');
        });
    });

    describe('PhpContext', () => {
        it('throws error when usePhp is used outside PhpProvider', () => {
            expect(() => renderHook(() => usePhp())).toThrow('usePhp must be used within a PhpProvider');
        });

        it('initializes inside PhpProvider and handles toggle status', async () => {
            const { result } = renderHook(() => usePhp(), {
                wrapper: ({ children }) => wrapper({ children: <PhpProvider>{children}</PhpProvider> })
            });

            await act(async () => {
                await result.current.fetchInstalledInstances();
                await result.current.handleToggleStatus({ id: 'php_82', version: '8.2', running: false } as any);
                result.current.openPhpIni('8.2');
                result.current.openPhpDir('8.2');
            });

            expect(mockApi.get_installed_php).toHaveBeenCalled();
            expect(mockApi.start_php).toHaveBeenCalledWith('8.2');
            expect(mockApi.open_php_ini).toHaveBeenCalledWith('8.2');
            expect(mockApi.open_php_dir).toHaveBeenCalledWith('8.2');
        });
    });

    describe('RuntimesContext', () => {
        it('throws error when useRuntimes is used outside RuntimesProvider', () => {
            expect(() => renderHook(() => useRuntimes())).toThrow('useRuntimes must be used within a RuntimesProvider');
        });

        it('initializes inside RuntimesProvider and handles runtime actions', async () => {
            const { result } = renderHook(() => useRuntimes(), {
                wrapper: ({ children }) => wrapper({ children: <RuntimesProvider>{children}</RuntimesProvider> })
            });

            await act(async () => {
                await result.current.fetchStatuses();
                await result.current.handleTogglePath('node', true);
                await result.current.handleSetActiveVersion('node', '20.0.0');
                await result.current.handleDeactivateVersion('node');
                result.current.handleOpenFolder('node', '20.0.0');
                result.current.handleOpenTerminal('node', '20.0.0');
            });

            expect(mockApi.get_node_status).toHaveBeenCalled();
            expect(mockApi.toggle_global_path).toHaveBeenCalledWith('node', true);
            expect(mockApi.set_active_runtime_version).toHaveBeenCalledWith('node', '20.0.0');
            expect(mockApi.deactivate_runtime_version).toHaveBeenCalledWith('node');
            expect(mockApi.open_runtime_dir).toHaveBeenCalledWith('node', '20.0.0');
        });

        it('handles vylo_progress events for RuntimesManager', async () => {
            const { result } = renderHook(() => useRuntimes(), {
                wrapper: ({ children }) => wrapper({ children: <RuntimesProvider>{children}</RuntimesProvider> })
            });

            act(() => {
                window.dispatchEvent(new CustomEvent('vylo_progress', {
                    detail: { source: 'RuntimesManager', percent: 85, text: 'Configuring Node...' }
                }));
            });

            expect(result.current.progress).toBe(85);
            expect(result.current.progressText).toBe('Configuring Node...');
        });
    });

    describe('TunnelsContext', () => {
        it('throws error when useTunnels is used outside TunnelsProvider', () => {
            expect(() => renderHook(() => useTunnels())).toThrow('useTunnels must be used within a TunnelsProvider');
        });

        it('initializes inside TunnelsProvider', () => {
            const { result } = renderHook(() => useTunnels(), {
                wrapper: ({ children }) => wrapper({ children: <TunnelsProvider>{children}</TunnelsProvider> })
            });
            expect(result.current.activeTab).toBe('all');
            expect(result.current.shareMode).toBe('project');
        });
    });

    describe('GitContext', () => {
        it('throws error when useGit is used outside GitProvider', () => {
            expect(() => renderHook(() => useGit())).toThrow('useGit must be used within a GitProvider');
        });

        it('initializes inside GitProvider', () => {
            const { result } = renderHook(() => useGit(), {
                wrapper: ({ children }) => wrapper({ children: <GitProvider>{children}</GitProvider> })
            });
            expect(result.current.gitData.installed).toBe(false);
            expect(typeof result.current.fetchStatus).toBe('function');
        });
    });
});
