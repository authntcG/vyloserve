import React, { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';

export interface ProjectData {
    id: string;
    name: string;
    domain: string;
    path: string;
    framework?: string;
}

export interface ServiceStatus {
    apache: boolean;
    php: boolean;
    database: boolean;
    cpu_load: number;
    ram_usage?: number;
}

export interface IncludedServices {
    apache: boolean;
    php: boolean;
    database: boolean;
}

export function resolveInitialPhpSelection(prev: string[], instances: any[]): string[] {
    if (prev.length !== 0 || instances.length === 0) return prev;
    const running = instances.filter((p: any) => p.status === 'running').map((p: any) => p.version);
    return running.length > 0 ? running : [instances[0].version];
}

export function resolveInitialDbSelection(prev: string[], instances: any[]): string[] {
    if (prev.length !== 0 || instances.length === 0) return prev;
    const running = instances.filter((p: any) => p.status === 'running').map((p: any) => p.id);
    return running.length > 0 ? running : [instances[0].id];
}

export async function refreshOverallStatus(
    api: any,
    setStatus: (s: ServiceStatus) => void,
    appendCpuHistory: (v: number) => void,
    appendRamHistory: (v: number) => void
) {
    if (typeof api.get_all_services_status !== 'function') return;
    const resStatus = await api.get_all_services_status();
    setStatus({
        apache: resStatus.apache,
        php: resStatus.php,
        database: resStatus.database,
        cpu_load: resStatus.cpu_load || 0,
        ram_usage: resStatus.ram_usage || 0
    });
    appendCpuHistory(resStatus.cpu_load || 0);
    appendRamHistory(resStatus.ram_usage || 0);
}

export async function refreshApacheStatus(
    api: any,
    isApacheInitializedRef: { current: boolean },
    setApacheVersions: (v: string[]) => void,
    setSelectedApache: (updater: (prev: string) => string) => void
) {
    if (typeof api.get_apache_installed_versions !== 'function') return;
    const resAp = await api.get_apache_installed_versions();
    if (resAp.status !== 'success') return;
    setApacheVersions(resAp.data);
    setSelectedApache(prev => {
        if (isApacheInitializedRef.current) return prev;
        isApacheInitializedRef.current = true;
        return resAp.active || resAp.data[0] || '';
    });
}

export async function refreshPhpStatus(
    api: any,
    isPhpInitializedRef: { current: boolean },
    setPhpInstances: (v: any[]) => void,
    setSelectedPhp: (updater: (prev: string[]) => string[]) => void
) {
    if (typeof api.get_installed_php !== 'function') return;
    const resPhp = await api.get_installed_php();
    setPhpInstances(resPhp);
    setSelectedPhp(prev => {
        if (isPhpInitializedRef.current) return prev;
        isPhpInitializedRef.current = true;
        return resolveInitialPhpSelection(prev, resPhp);
    });
}

export async function refreshDatabaseStatus(
    api: any,
    isDbInitializedRef: { current: boolean },
    setDbInstances: (v: any[]) => void,
    setSelectedDb: (updater: (prev: string[]) => string[]) => void
) {
    if (typeof api.get_installed_databases !== 'function') return;
    const resDb = await api.get_installed_databases();
    if (resDb.status !== 'success') return;
    setDbInstances(resDb.data);
    setSelectedDb(prev => {
        if (isDbInitializedRef.current) return prev;
        isDbInitializedRef.current = true;
        return resolveInitialDbSelection(prev, resDb.data);
    });
}

export async function startApacheIfIncluded(api: any, included: boolean, selectedApache: string) {
    if (included && selectedApache) await api.set_apache_active_version(selectedApache);
}

export async function startSelectedPhpInstances(api: any, included: boolean, selectedPhp: string[], phpInstances: any[]) {
    if (!included) return;
    for (const v of selectedPhp) {
        if (phpInstances.find(p => p.version === v)?.status !== 'running') await api.start_php(v);
    }
}

export async function startSelectedDbInstances(api: any, included: boolean, selectedDb: string[], dbInstances: any[]) {
    if (!included) return;
    for (const id of selectedDb) {
        if (dbInstances.find(p => p.id === id)?.status !== 'running') await api.start_database(id);
    }
}

export async function stopSelectedPhpInstances(api: any, included: boolean, selectedPhp: string[], phpInstances: any[]) {
    if (!included) return;
    for (const v of selectedPhp) {
        if (phpInstances.find(p => p.version === v)?.status === 'running') await api.stop_php(v);
    }
}

export async function stopSelectedDbInstances(api: any, included: boolean, selectedDb: string[], dbInstances: any[]) {
    if (!included) return;
    for (const id of selectedDb) {
        if (dbInstances.find(p => p.id === id)?.status === 'running') await api.stop_database(id);
    }
}

export function anyCanStart(ids: string[], instances: any[], matchKey: string): boolean {
    return ids.some(id => {
        const inst = instances.find((item: any) => item[matchKey] === id);
        return !!inst && inst.status !== 'running';
    });
}

export function anyCanStop(ids: string[], instances: any[], matchKey: string): boolean {
    return ids.some(id => {
        const inst = instances.find((item: any) => item[matchKey] === id);
        return !!inst && inst.status === 'running';
    });
}

export function computeCanStartStop(
    includedServices: IncludedServices,
    selectedApache: string,
    status: ServiceStatus,
    selectedPhp: string[],
    phpInstances: any[],
    selectedDb: string[],
    dbInstances: any[]
) {
    const apacheCanStart = includedServices.apache && !!selectedApache && !status.apache;
    const apacheCanStop = includedServices.apache && !!selectedApache && status.apache;
    const phpCanStart = includedServices.php && selectedPhp.length > 0 && anyCanStart(selectedPhp, phpInstances, 'version');
    const phpCanStop = includedServices.php && selectedPhp.length > 0 && anyCanStop(selectedPhp, phpInstances, 'version');
    const dbCanStart = includedServices.database && selectedDb.length > 0 && anyCanStart(selectedDb, dbInstances, 'id');
    const dbCanStop = includedServices.database && selectedDb.length > 0 && anyCanStop(selectedDb, dbInstances, 'id');

    return {
        canStart: apacheCanStart || phpCanStart || dbCanStart,
        canStop: apacheCanStop || phpCanStop || dbCanStop
    };
}

interface DashboardContextType {
    projects: ProjectData[];
    status: ServiceStatus;
    cpuHistory: number[];
    ramHistory: number[];
    apacheVersions: string[];
    selectedApache: string;
    phpInstances: any[];
    selectedPhp: string[];
    dbInstances: any[];
    selectedDb: string[];
    includedServices: IncludedServices;
    isGlobalLoading: boolean;
    isLoadingProjects: boolean;
    isTogglingAll: 'start' | 'stop' | null;
    canStart: boolean;
    canStop: boolean;
    setSelectedApache: (v: string) => void;
    togglePhpSelection: (version: string) => void;
    toggleDbSelection: (id: string) => void;
    handleTogglePhpIncluded: (checked: boolean) => void;
    handleToggleDbIncluded: (checked: boolean) => void;
    setIncludedServices: React.Dispatch<React.SetStateAction<IncludedServices>>;
    handleToggleAll: (action: 'start' | 'stop') => Promise<void>;
    handleOpenBrowser: (domain: string) => void;
    handleOpenDir: (path: string) => void;
    fetchServicesStatus: () => Promise<void>;
    fetchRecentProjects: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { readonly children: ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [status, setStatus] = useState<ServiceStatus>({ apache: false, php: false, database: false, cpu_load: 0, ram_usage: 0 });

    const [cpuHistory, setCpuHistory] = useState<number[]>(new Array(20).fill(0));
    const [ramHistory, setRamHistory] = useState<number[]>(new Array(20).fill(0));

    const [apacheVersions, setApacheVersions] = useState<string[]>([]);
    const [selectedApache, setSelectedApache] = useState<string>('');
    const [phpInstances, setPhpInstances] = useState<any[]>([]);
    const [selectedPhp, setSelectedPhp] = useState<string[]>([]);

    const [dbInstances, setDbInstances] = useState<any[]>([]);
    const [selectedDb, setSelectedDb] = useState<string[]>([]);

    const [includedServices, setIncludedServices] = useState<IncludedServices>({ apache: true, php: true, database: false });

    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isTogglingAll, setIsTogglingAll] = useState<'start' | 'stop' | null>(null);

    const isPhpInitialized = useRef(false);
    const isApacheInitialized = useRef(false);
    const isDbInitialized = useRef(false);
    const isConfigLoaded = useRef(false);

    const loadDashboardConfig = async () => {
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_dashboard_config === 'function') {
                const res = await api.get_dashboard_config();
                if (res.status === 'success' && res.data) {
                    setIncludedServices({
                        apache: res.data.apache ?? true,
                        php: res.data.php ?? true,
                        database: res.data.database ?? false
                    });

                    if (res.data.selected_php && Array.isArray(res.data.selected_php) && res.data.selected_php.length > 0) {
                        setSelectedPhp(res.data.selected_php);
                        isPhpInitialized.current = true;
                    }

                    if (res.data.selected_database && Array.isArray(res.data.selected_database) && res.data.selected_database.length > 0) {
                        setSelectedDb(res.data.selected_database);
                        isDbInitialized.current = true;
                    }
                }
            }
        } catch (error) {
            console.error("Gagal memuat config dashboard:", error);
        } finally {
            isConfigLoaded.current = true;
        }
    };

    useEffect(() => {
        if (!isConfigLoaded.current) return;

        const saveConfig = async () => {
            try {
                const api = window.pywebview?.api;
                if (api && typeof api.save_dashboard_config === 'function') {
                    const payload = {
                        ...includedServices,
                        selected_php: selectedPhp,
                        selected_database: selectedDb
                    };
                    await api.save_dashboard_config(payload);
                }
            } catch (e) {
                console.error("Gagal menyimpan config:", e);
            }
        };
        saveConfig();
    }, [includedServices, selectedPhp, selectedDb]);

    const fetchRecentProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') {
                    const reversed = [...(res.data || [])].reverse();
                    setProjects(reversed.slice(0, 4));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const fetchServicesStatus = async () => {
        try {
            const api = window.pywebview?.api;
            if (!api) return;

            await refreshOverallStatus(
                api,
                setStatus,
                (v) => setCpuHistory(prev => [...prev, v].slice(-20)),
                (v) => setRamHistory(prev => [...prev, v].slice(-20))
            );
            await refreshApacheStatus(api, isApacheInitialized, setApacheVersions, setSelectedApache);
            await refreshPhpStatus(api, isPhpInitialized, setPhpInstances, setSelectedPhp);
            await refreshDatabaseStatus(api, isDbInitialized, setDbInstances, setSelectedDb);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGlobalLoading(false);
        }
    };

    const fetchServicesStatusRef = useRef(fetchServicesStatus);
    fetchServicesStatusRef.current = fetchServicesStatus;

    const fetchRecentProjectsRef = useRef(fetchRecentProjects);
    fetchRecentProjectsRef.current = fetchRecentProjects;

    useEffect(() => {
        loadDashboardConfig();
        fetchRecentProjectsRef.current();
        fetchServicesStatusRef.current();
        const interval = setInterval(() => {
            fetchServicesStatusRef.current();
        }, 3000);

        const handleStatusSync = () => {
            fetchServicesStatusRef.current();
        };
        const handleProjectSync = () => {
            fetchRecentProjectsRef.current();
        };

        window.addEventListener('service_status_changed', handleStatusSync);
        window.addEventListener('project_list_updated', handleProjectSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener('service_status_changed', handleStatusSync);
            window.removeEventListener('project_list_updated', handleProjectSync);
        };
    }, []);

    const handleToggleAll = async (action: 'start' | 'stop') => {
        setIsTogglingAll(action);
        try {
            const api = window.pywebview?.api;
            if (!api) return;

            if (action === 'start') {
                await startApacheIfIncluded(api, includedServices.apache, selectedApache);
                await startSelectedPhpInstances(api, includedServices.php, selectedPhp, phpInstances);
                await startSelectedDbInstances(api, includedServices.database, selectedDb, dbInstances);
                if (includedServices.apache) await api.start_apache_server();
                showToast(t('dashboard.start_success'), "success");
            } else {
                if (includedServices.apache) await api.stop_apache_server();
                await stopSelectedPhpInstances(api, includedServices.php, selectedPhp, phpInstances);
                await stopSelectedDbInstances(api, includedServices.database, selectedDb, dbInstances);
                showToast(t('dashboard.stop_success'), "success");
            }

            fetchServicesStatus();
            window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'all' } }));
        } catch (error) {
            console.error("Dashboard Toggle Error:", error);
            showToast(t('dashboard.toggle_error'), "error");
        } finally {
            setIsTogglingAll(null);
        }
    };

    const togglePhpSelection = (version: string) => {
        setSelectedPhp(prev => {
            const newSelection = prev.includes(version)
                ? prev.filter(v => v !== version)
                : [...prev, version];

            if (newSelection.length === 0) setIncludedServices(p => ({ ...p, php: false }));
            else if (newSelection.length > 0 && !includedServices.php) setIncludedServices(p => ({ ...p, php: true }));

            return newSelection;
        });
    };

    const toggleDbSelection = (id: string) => {
        setSelectedDb(prev => {
            const newSelection = prev.includes(id)
                ? prev.filter(v => v !== id)
                : [...prev, id];

            if (newSelection.length === 0) setIncludedServices(p => ({ ...p, database: false }));
            else if (newSelection.length > 0 && !includedServices.database) setIncludedServices(p => ({ ...p, database: true }));

            return newSelection;
        });
    };

    const handleTogglePhpIncluded = (checked: boolean) => {
        if (checked && selectedPhp.length === 0 && phpInstances.length > 0) {
            setSelectedPhp([phpInstances[0].version]);
        }
        setIncludedServices(p => ({ ...p, php: checked }));
    };

    const handleToggleDbIncluded = (checked: boolean) => {
        if (checked && selectedDb.length === 0 && dbInstances.length > 0) {
            setSelectedDb([dbInstances[0].id]);
        }
        setIncludedServices(p => ({ ...p, database: checked }));
    };

    const handleOpenBrowser = (domain: string) => {
        const url = `https://${domain}`;
        try {
            if (window.pywebview?.api?.open_browser) window.pywebview.api.open_browser(url);
            else window.open(url, '_blank');
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenDir = (path: string) => {
        try {
            if (window.pywebview?.api?.open_in_explorer) window.pywebview.api.open_in_explorer(path);
        } catch (e) {
            console.error(e);
        }
    };

    const { canStart, canStop } = useMemo(() => computeCanStartStop(
        includedServices,
        selectedApache,
        status,
        selectedPhp,
        phpInstances,
        selectedDb,
        dbInstances
    ), [includedServices, selectedApache, status, selectedPhp, phpInstances, selectedDb, dbInstances]);

    const value = useMemo<DashboardContextType>(() => ({
        projects,
        status,
        cpuHistory,
        ramHistory,
        apacheVersions,
        selectedApache,
        phpInstances,
        selectedPhp,
        dbInstances,
        selectedDb,
        includedServices,
        isGlobalLoading,
        isLoadingProjects,
        isTogglingAll,
        canStart,
        canStop,
        setSelectedApache,
        togglePhpSelection,
        toggleDbSelection,
        handleTogglePhpIncluded,
        handleToggleDbIncluded,
        setIncludedServices,
        handleToggleAll,
        handleOpenBrowser,
        handleOpenDir,
        fetchServicesStatus,
        fetchRecentProjects
    }), [
        projects,
        status,
        cpuHistory,
        ramHistory,
        apacheVersions,
        selectedApache,
        phpInstances,
        selectedPhp,
        dbInstances,
        selectedDb,
        includedServices,
        isGlobalLoading,
        isLoadingProjects,
        isTogglingAll,
        canStart,
        canStop
    ]);

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard(): DashboardContextType {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
