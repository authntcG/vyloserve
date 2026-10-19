import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';

export interface PhpInstance {
    id: string;
    name: string;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dir: string;
    memory_limit: string;
}

export interface PhpExtension {
    name: string;
    active: boolean;
}

interface PhpContextValue {
    // State
    instances: PhpInstance[];
    isLoading: boolean;
    togglingInstanceId: string | null;
    isNewInstanceOpen: boolean;
    installVersion: string;
    installFilename: string;
    installPort: number;
    isInstalling: boolean;
    isFetchingVersions: boolean;
    isSettingsOpen: boolean;
    selectedInstance: PhpInstance | null;
    settingsConfig: any;
    settingsExtensions: PhpExtension[];
    isLoadingSettings: boolean;
    isSavingSettings: boolean;
    availableVersions: any[];
    updatingInstance: { php: PhpInstance; newVersion: string } | null;
    progress: number;
    progressText: string;
    usedPorts: number[];

    // Setters
    setInstallVersion: (v: string) => void;
    setInstallFilename: (f: string) => void;
    setInstallPort: (p: number) => void;
    setIsFetchingVersions: (f: boolean) => void;
    setSettingsConfig: React.Dispatch<React.SetStateAction<any>>;
    setSettingsExtensions: React.Dispatch<React.SetStateAction<PhpExtension[]>>;

    // Modal Control
    openNewInstanceModal: () => void;
    closeNewInstanceModal: () => void;
    closeSettingsModal: () => void;

    // Actions
    fetchInstalledInstances: () => Promise<void>;
    fetchAvailableVersions: () => Promise<void>;
    handleToggleStatus: (php: PhpInstance) => Promise<void>;
    handleInstallPhp: () => Promise<void>;
    handleUpdatePhp: (php: PhpInstance, newVersion: string, filename: string) => Promise<void>;
    handleConfirmUninstall: (php: PhpInstance) => Promise<void>;
    handleOpenSettings: (php: PhpInstance) => Promise<void>;
    handleSaveSettings: () => Promise<void>;
    openPhpIni: (version: string) => void;
    openPhpDir: (version: string) => void;
}

const PhpContext = createContext<PhpContextValue | undefined>(undefined);

export function PhpProvider({ children }: { readonly children: React.ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const tRef = useRef(t);
    tRef.current = t;

    // PHP STATES
    const [instances, setInstances] = useState<PhpInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingInstanceId, setTogglingInstanceId] = useState<string | null>(null);
    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installFilename, setInstallFilename] = useState('');
    const [installPort, setInstallPort] = useState(9000);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isFetchingVersions, setIsFetchingVersions] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<PhpInstance | null>(null);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [settingsExtensions, setSettingsExtensions] = useState<PhpExtension[]>([]);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // UPDATE STATES
    const [availableVersions, setAvailableVersions] = useState<any[]>([]);
    const [updatingInstance, setUpdatingInstance] = useState<{ php: PhpInstance; newVersion: string } | null>(null);

    // PROGRESS WIDGET
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    const usedPorts = useMemo(() => instances.map(inst => inst.port), [instances]);

    // --- FETCH DATA ---
    const fetchInstalledInstances = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await window.pywebview?.api?.get_installed_php();
            setInstances(data || []);
            if (data?.length > 0) {
                setInstallPort(Math.max(...data.map((i: any) => i.port)) + 1);
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.fetch_php_data_error'), 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    const fetchAvailableVersions = useCallback(async () => {
        try {
            const response = await window.pywebview?.api?.get_php_versions();
            if (response?.status === 'success') {
                setAvailableVersions(response.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const fetchInstalledInstancesRef = useRef(fetchInstalledInstances);
    fetchInstalledInstancesRef.current = fetchInstalledInstances;

    const fetchAvailableVersionsRef = useRef(fetchAvailableVersions);
    fetchAvailableVersionsRef.current = fetchAvailableVersions;

    useEffect(() => {
        fetchInstalledInstancesRef.current();
        fetchAvailableVersionsRef.current();
        const handleStatusChange = (e: any) => {
            if (['php', 'all'].includes(e.detail?.service)) {
                fetchInstalledInstancesRef.current();
            }
        };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    }, []);

    useEffect(() => {
        const handleProgress = (e: any) => {
            if (e.detail?.source && e.detail.source !== 'PhpManager') return;
            if (e.detail) {
                const pct = clampPercent(e.detail.percent);
                setProgress(pct);
                setProgressText(tRef.current(e.detail.text || '', e.detail.args || {}) as string);

                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }
                if (pct >= 100 || pct === 0) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => setProgress(0), 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => {
            window.removeEventListener('vylo_progress', handleProgress);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    }, []);

    // --- PHP HANDLERS ---
    const handleUpdatePhp = useCallback(async (php: PhpInstance, newVersion: string, filename: string) => {
        if (!await confirm({
            title: tRef.current('php.confirm_update'),
            message: `${tRef.current('php.update_prefix')}${php.version}${tRef.current('php.update_middle')}${newVersion}${tRef.current('php.update_suffix')}`,
            confirmText: tRef.current('php.yes_update'),
        })) return;

        setInstallVersion(newVersion);
        setInstallPort(php.port);
        setInstallFilename(filename);
        setIsInstalling(true);
        setUpdatingInstance({ php, newVersion });
        setProgressText(tRef.current('php.updating'));
        try {
            const res = await window.pywebview?.api?.update_php(php.version, newVersion, filename);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchInstalledInstances();
                fetchAvailableVersions();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.system_error'), 'error');
        } finally {
            setIsInstalling(false);
            setProgress(0);
            setUpdatingInstance(null);
            setIsNewInstanceOpen(false);
        }
    }, [confirm, showToast, fetchInstalledInstances, fetchAvailableVersions]);

    const handleInstallPhp = useCallback(async () => {
        if (!installVersion) return showToast(tRef.current('php.select_php_version_warning'), 'warning');
        if (usedPorts.includes(installPort)) return showToast(tRef.current('php.port_in_use_error'), 'error');
        setIsInstalling(true);
        try {
            const res = await window.pywebview?.api?.install_php(installVersion, installFilename, installPort);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setIsNewInstanceOpen(false);
                fetchInstalledInstances();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.system_error'), 'error');
        } finally {
            setIsInstalling(false);
        }
    }, [installVersion, usedPorts, installPort, installFilename, showToast, fetchInstalledInstances]);

    const handleOpenSettings = useCallback(async (php: PhpInstance) => {
        setSelectedInstance(php);
        setIsSettingsOpen(true);
        setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_php_config(php.version);
            if (res?.status === 'success') {
                setSettingsConfig(res.config);
                setSettingsExtensions(res.extensions);
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.fetch_config_error'), 'error');
        } finally {
            setIsLoadingSettings(false);
        }
    }, [showToast]);

    const handleSaveSettings = useCallback(async () => {
        if (!selectedInstance) return;
        if (usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port))) {
            return showToast(tRef.current('php.port_used_by_other_error'), 'error');
        }
        setIsSavingSettings(true);
        try {
            const activeExts = settingsExtensions.filter(e => e.active).map(e => e.name);
            const res = await window.pywebview?.api?.save_php_config(selectedInstance.version, settingsConfig, activeExts);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setIsSettingsOpen(false);
                fetchInstalledInstances();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.save_error'), 'error');
        } finally {
            setIsSavingSettings(false);
        }
    }, [selectedInstance, usedPorts, settingsConfig, settingsExtensions, showToast, fetchInstalledInstances]);

    const handleConfirmUninstall = useCallback(async (php: PhpInstance) => {
        if (!await confirm({
            title: tRef.current('php.confirm_uninstall'),
            message: <p className="text-slate-700 dark:text-slate-300">{tRef.current('php.delete_prefix')}<strong className="text-slate-900 dark:text-white">{php.name}</strong>{tRef.current('php.delete_suffix')}</p>,
            type: 'danger',
            confirmText: tRef.current('php.yes_uninstall'),
        })) return;

        try {
            const res = await window.pywebview?.api?.uninstall_php(php.version);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchInstalledInstances();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.delete_error'), 'error');
        }
    }, [confirm, showToast, fetchInstalledInstances]);

    const handleToggleStatus = useCallback(async (php: PhpInstance) => {
        setTogglingInstanceId(php.id);
        try {
            const isRunning = php.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_php(php.version) : await window.pywebview?.api?.start_php(php.version);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setInstances(prev => prev.map(i => i.id === php.id ? { ...i, status: isRunning ? 'stopped' : 'running' } : i));
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'php', running: !isRunning } }));
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('php.toggle_status_error'), 'error');
        } finally {
            setTogglingInstanceId(null);
        }
    }, [showToast]);

    const openNewInstanceModal = useCallback(() => {
        setIsNewInstanceOpen(true);
    }, []);

    const closeNewInstanceModal = useCallback(() => {
        setIsNewInstanceOpen(false);
    }, []);

    const closeSettingsModal = useCallback(() => {
        if (!isSavingSettings) setIsSettingsOpen(false);
    }, [isSavingSettings]);

    const openPhpIni = useCallback((version: string) => {
        window.pywebview?.api?.open_php_ini?.(version);
    }, []);

    const openPhpDir = useCallback((version: string) => {
        window.pywebview?.api?.open_php_dir?.(version);
    }, []);

    const value = useMemo<PhpContextValue>(() => ({
        instances,
        isLoading,
        togglingInstanceId,
        isNewInstanceOpen,
        installVersion,
        installFilename,
        installPort,
        isInstalling,
        isFetchingVersions,
        isSettingsOpen,
        selectedInstance,
        settingsConfig,
        settingsExtensions,
        isLoadingSettings,
        isSavingSettings,
        availableVersions,
        updatingInstance,
        progress,
        progressText,
        usedPorts,
        setInstallVersion,
        setInstallFilename,
        setInstallPort,
        setIsFetchingVersions,
        setSettingsConfig,
        setSettingsExtensions,
        openNewInstanceModal,
        closeNewInstanceModal,
        closeSettingsModal,
        fetchInstalledInstances,
        fetchAvailableVersions,
        handleToggleStatus,
        handleInstallPhp,
        handleUpdatePhp,
        handleConfirmUninstall,
        handleOpenSettings,
        handleSaveSettings,
        openPhpIni,
        openPhpDir,
    }), [
        instances,
        isLoading,
        togglingInstanceId,
        isNewInstanceOpen,
        installVersion,
        installFilename,
        installPort,
        isInstalling,
        isFetchingVersions,
        isSettingsOpen,
        selectedInstance,
        settingsConfig,
        settingsExtensions,
        isLoadingSettings,
        isSavingSettings,
        availableVersions,
        updatingInstance,
        progress,
        progressText,
        usedPorts,
        openNewInstanceModal,
        closeNewInstanceModal,
        closeSettingsModal,
        fetchInstalledInstances,
        fetchAvailableVersions,
        handleToggleStatus,
        handleInstallPhp,
        handleUpdatePhp,
        handleConfirmUninstall,
        handleOpenSettings,
        handleSaveSettings,
        openPhpIni,
        openPhpDir,
    ]);

    return <PhpContext.Provider value={value}>{children}</PhpContext.Provider>;
}

export function usePhp(): PhpContextValue {
    const ctx = useContext(PhpContext);
    if (!ctx) {
        throw new Error('usePhp must be used within a PhpProvider');
    }
    return ctx;
}
