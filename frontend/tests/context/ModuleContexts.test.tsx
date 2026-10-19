import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ApacheProvider, useApache } from '../../src/context/ApacheContext';
import { PhpProvider, usePhp } from '../../src/context/PhpContext';
import { DatabaseProvider, useDatabase } from '../../src/context/DatabaseContext';
import { DashboardProvider, useDashboard } from '../../src/context/DashboardContext';
import { RuntimesProvider, useRuntimes } from '../../src/context/RuntimesContext';
import { TunnelsProvider, useTunnels } from '../../src/context/TunnelsContext';
import { GitProvider, useGit } from '../../src/context/GitContext';
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
    describe('ApacheContext', () => {
        it('throws error when useApache is used outside ApacheProvider', () => {
            expect(() => renderHook(() => useApache())).toThrow('useApache must be used within an ApacheProvider');
        });

        it('initializes inside ApacheProvider', () => {
            const { result } = renderHook(() => useApache(), {
                wrapper: ({ children }) => wrapper({ children: <ApacheProvider>{children}</ApacheProvider> })
            });
            expect(result.current.isApacheRunning).toBe(false);
            expect(result.current.projects).toEqual([]);
        });
    });

    describe('PhpContext', () => {
        it('throws error when usePhp is used outside PhpProvider', () => {
            expect(() => renderHook(() => usePhp())).toThrow('usePhp must be used within a PhpProvider');
        });

        it('initializes inside PhpProvider', () => {
            const { result } = renderHook(() => usePhp(), {
                wrapper: ({ children }) => wrapper({ children: <PhpProvider>{children}</PhpProvider> })
            });
            expect(result.current.instances).toEqual([]);
            expect(typeof result.current.fetchInstalledInstances).toBe('function');
        });
    });

    describe('DatabaseContext', () => {
        it('throws error when useDatabase is used outside DatabaseProvider', () => {
            expect(() => renderHook(() => useDatabase())).toThrow('useDatabase must be used within a DatabaseProvider');
        });

        it('initializes inside DatabaseProvider', () => {
            const { result } = renderHook(() => useDatabase(), {
                wrapper: ({ children }) => wrapper({ children: <DatabaseProvider>{children}</DatabaseProvider> })
            });
            expect(result.current.dbInstances).toEqual([]);
            expect(result.current.activeTab).toBe('all');
        });
    });

    describe('DashboardContext', () => {
        it('throws error when useDashboard is used outside DashboardProvider', () => {
            expect(() => renderHook(() => useDashboard())).toThrow('useDashboard must be used within a DashboardProvider');
        });

        it('initializes inside DashboardProvider', () => {
            const { result } = renderHook(() => useDashboard(), {
                wrapper: ({ children }) => wrapper({ children: <DashboardProvider>{children}</DashboardProvider> })
            });
            expect(result.current.projects).toEqual([]);
            expect(result.current.includedServices.apache).toBe(true);
        });
    });

    describe('RuntimesContext', () => {
        it('throws error when useRuntimes is used outside RuntimesProvider', () => {
            expect(() => renderHook(() => useRuntimes())).toThrow('useRuntimes must be used within a RuntimesProvider');
        });

        it('initializes inside RuntimesProvider', () => {
            const { result } = renderHook(() => useRuntimes(), {
                wrapper: ({ children }) => wrapper({ children: <RuntimesProvider>{children}</RuntimesProvider> })
            });
            expect(result.current.activeTab).toBe('node');
            expect(typeof result.current.fetchStatuses).toBe('function');
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
