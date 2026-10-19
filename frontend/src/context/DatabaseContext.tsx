import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import { compareVersions } from '../utils/version';
import type { NewDbInstanceRef } from '../menu/database/NewInstance';
import type { ChangePasswordRef } from '../menu/database/ChangePassword';

export type DbEngineType = 'mysql' | 'postgres';

export interface DbInstance {
    id: string;
    name: string;
    engine: DbEngineType;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dataDir: string;
}

export interface AvailableUpdate {
    version: string;
    url: string;
}

export type DatabaseFilterTab = 'all' | 'mysql' | 'postgres';

interface DatabaseContextValue {
    // State
    dbInstances: DbInstance[];
    isLoading: boolean;
    togglingDbId: string | null;
    activeTab: DatabaseFilterTab;
    setActiveTab: (tab: DatabaseFilterTab) => void;
    selectedDbId: string | null;
    selectedDb: DbInstance | undefined;
    filteredInstances: DbInstance[];
    usedPorts: number[];

    // Updates & Installation
    availableUpdates: Record<string, AvailableUpdate>;
    isInstalling: boolean;
    updatingInstance: { db: DbInstance; update: AvailableUpdate } | null;
    progress: number;
    progressText: string;

    // Logs & Settings
    logViewer: { dbId: string; type: 'startup' | 'native' } | null;
    setLogViewer: (val: { dbId: string; type: 'startup' | 'native' } | null) => void;
    fetchDbLogContent: () => Promise<string | undefined>;
    isSettingsOpen: boolean;
    settingsConfig: any;
    isLoadingSettings: boolean;
    isSavingSettings: boolean;
    handleConfigChange: (key: string, value: string | number) => void;

    // Passwords
    isPasswordModalOpen: boolean;
    isUpdatingPassword: boolean;

    // Modals
    isNewInstanceOpen: boolean;
    openNewInstanceModal: () => void;
    closeNewInstanceModal: () => void;
    openSettingsModal: (db: DbInstance) => void;
    closeSettingsModal: () => void;
    openPasswordModal: (db: DbInstance) => void;
    closePasswordModal: () => void;

    // Refs
    newDbRef: React.RefObject<NewDbInstanceRef | null>;
    passwordRef: React.RefObject<ChangePasswordRef | null>;

    // Actions
    fetchDatabases: () => Promise<void>;
    checkForUpdates: (instances: DbInstance[]) => Promise<void>;
    handleToggleDB: (db: DbInstance) => Promise<void>;
    handleInstallDatabase: () => Promise<void>;
    handleUpdateDatabase: (db: DbInstance) => Promise<void>;
    handleConfirmUninstall: (db: DbInstance) => Promise<void>;
    handleSaveSettings: () => Promise<void>;
    handlePasswordSubmit: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);

export function DatabaseProvider({ children }: { readonly children: React.ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const tRef = useRef(t);
    tRef.current = t;

    const [dbInstances, setDbInstances] = useState<DbInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingDbId, setTogglingDbId] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<DatabaseFilterTab>('all');

    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
    const [logViewer, setLogViewer] = useState<{ dbId: string; type: 'startup' | 'native' } | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);
    const [updatingInstance, setUpdatingInstance] = useState<{ db: DbInstance; update: AvailableUpdate } | null>(null);
    const hideProgressTimeoutRef = useRef<number | null>(null);

    const [availableUpdates, setAvailableUpdates] = useState<Record<string, AvailableUpdate>>({});

    const newDbRef = useRef<NewDbInstanceRef>(null);
    const passwordRef = useRef<ChangePasswordRef>(null);

    const usedPorts = useMemo(() => dbInstances.map(db => db.port), [dbInstances]);
    const selectedDb = useMemo(() => dbInstances.find(p => p.id === selectedDbId), [dbInstances, selectedDbId]);
    const filteredInstances = useMemo(
        () => dbInstances.filter(db => activeTab === 'all' || db.engine === activeTab),
        [dbInstances, activeTab]
    );

    const checkForUpdates = useCallback(async (instances: DbInstance[]) => {
        const api = window.pywebview?.api;
        if (!api || typeof api.get_available_databases !== 'function' || instances.length === 0) {
            setAvailableUpdates({});
            return;
        }
        const engines = Array.from(new Set(instances.map(db => db.engine)));
        const updates: Record<string, AvailableUpdate> = {};
        await Promise.all(engines.map(async (engine) => {
            try {
                const res = await api.get_available_databases(engine);
                if (res?.status !== 'success' || !res.data?.length) return;
                const latest = res.data[0];
                instances
                    .filter(db => db.engine === engine && compareVersions(latest.version, db.version) > 0)
                    .forEach(db => { updates[db.id] = { version: latest.version, url: latest.url }; });
            } catch (e) {
                console.error(e);
            }
        }));
        setAvailableUpdates(updates);
    }, []);

    const fetchDatabases = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await window.pywebview?.api?.get_installed_databases();
            if (res?.status === 'success') {
                const instances = res.data || [];
                setDbInstances(instances);
                checkForUpdates(instances);
            } else if (res?.status === 'error') {
                showToast(tRef.current(res.message || 'database.fetch_db_error', res.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.fetch_db_error'), 'error');
        } finally {
            setIsLoading(false);
        }
    }, [checkForUpdates, showToast]);

    const fetchDatabasesRef = useRef(fetchDatabases);
    fetchDatabasesRef.current = fetchDatabases;

    useEffect(() => {
        fetchDatabasesRef.current();
        const handleStatus = (e: any) => {
            if (['database', 'all'].includes(e.detail?.service)) {
                fetchDatabasesRef.current();
            }
        };
        window.addEventListener('service_status_changed', handleStatus);
        return () => window.removeEventListener('service_status_changed', handleStatus);
    }, []);

    useEffect(() => {
        const handleProg = (e: any) => {
            if (e.detail?.source && e.detail.source !== 'DatabaseManager') return;
            if (e.detail) {
                const p = e.detail.percent;
                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }

                if (p < 0) {
                    setIsInstalling(false);
                    setProgress(0);
                    return;
                }
                if (p > 0 && p < 100) setIsInstalling(true);
                setProgress(clampPercent(p));
                setProgressText(tRef.current(e.detail.text || '', e.detail.args || {}) as string);
                if (p >= 100) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => { setProgress(0); }, 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProg);
        return () => {
            window.removeEventListener('vylo_progress', handleProg);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    }, []);

    const handleToggleDB = useCallback(async (db: DbInstance) => {
        setTogglingDbId(db.id);
        try {
            const isRunning = db.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_database(db.id) : await window.pywebview?.api?.start_database(db.id);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchDatabases();
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'database' } }));
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.toggle_status_error'), 'error');
        } finally {
            setTogglingDbId(null);
        }
    }, [showToast, fetchDatabases]);

    const handleInstallDatabase = useCallback(async () => {
        const formData = newDbRef.current?.getFormData();
        if (!formData) return showToast(tRef.current('database.read_install_data_error'), 'error');
        if (formData.engine === 'postgres' && !formData.rootPass) return showToast(tRef.current('database.pg_password_required'), 'warning');

        try {
            const isUsed = await window.pywebview?.api?.check_port_in_use(formData.port);
            if (isUsed || usedPorts.includes(formData.port)) return showToast(tRef.current('database.port_used'), 'error');

            setIsInstalling(true);
            setProgressText(tRef.current('database.preparing_engine'));
            const res = await window.pywebview?.api?.install_database(formData.engine, formData.version, formData.url, formData.port, formData.rootPass);
            if (res?.status === 'error') {
                showToast(tRef.current(res.message || '', res.args || {}) as string, 'error');
            } else if (res?.status === 'success') {
                showToast(tRef.current(res.message || '', res.args || {}) as string, 'success');
                setIsNewInstanceOpen(false);
                fetchDatabases();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.install_error'), 'error');
        } finally {
            setIsInstalling(false);
            setProgress(0);
        }
    }, [usedPorts, showToast, fetchDatabases]);

    const handleConfirmUninstall = useCallback(async (db: DbInstance) => {
        if (!await confirm({
            title: tRef.current('database.drop_db_title'),
            message: (
                <div className="flex flex-col gap-4">
                    <p className="text-slate-700 dark:text-slate-300">
                        {tRef.current('database.completely_remove')}<strong className="text-slate-900 dark:text-white">{db.name}</strong>?
                    </p>
                    <label htmlFor={`database-delete-data-${db.id}`} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30 cursor-pointer">
                        <input type="checkbox" id={`database-delete-data-${db.id}`} aria-label={tRef.current('database.delete_raw_data')} className="mt-0.5" />
                        <div className="flex flex-col"><span className="text-sm font-semibold text-red-800 dark:text-red-400">{tRef.current('database.delete_raw_data')}</span></div>
                    </label>
                </div>
            ),
            type: 'danger',
            confirmText: tRef.current('database.yes_drop'),
        })) return;

        const shouldDeleteData = (document.getElementById(`database-delete-data-${db.id}`) as HTMLInputElement)?.checked || false;
        try {
            const res = await window.pywebview?.api?.uninstall_database(db.id, shouldDeleteData);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchDatabases();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.delete_error'), 'error');
        }
    }, [confirm, showToast, fetchDatabases]);

    const handleUpdateDatabase = useCallback(async (db: DbInstance) => {
        const update = availableUpdates[db.id];
        if (!update) return;

        const confirmedUpdate = await confirm({
            title: tRef.current('database.confirm_update'),
            message: (
                <p className="text-slate-700 dark:text-slate-300">
                    {tRef.current('database.update_prefix')}<strong className="text-slate-900 dark:text-white">{db.name}</strong>
                    {tRef.current('database.update_middle')}<strong className="text-slate-900 dark:text-white">{update.version}</strong>{tRef.current('database.update_suffix')}
                </p>
            ),
            type: 'warning',
            confirmText: tRef.current('database.yes_update'),
            cancelText: tRef.current('database.cancel_update'),
        });
        if (!confirmedUpdate) return;

        const shouldBackup = await confirm({
            title: tRef.current('database.backup_data_title'),
            message: <p className="text-slate-700 dark:text-slate-300">{tRef.current('database.backup_data_desc')}</p>,
            type: 'warning',
            confirmText: tRef.current('database.yes_backup'),
            cancelText: tRef.current('database.no_backup'),
        });

        setIsInstalling(true);
        setUpdatingInstance({ db, update });
        setProgressText(tRef.current('database.updating_engine'));
        try {
            const res = await window.pywebview?.api?.update_database(db.id, update.version, update.url, shouldBackup);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') fetchDatabases();
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.install_error'), 'error');
        } finally {
            setIsInstalling(false);
            setProgress(0);
            setUpdatingInstance(null);
            setIsNewInstanceOpen(false);
        }
    }, [availableUpdates, confirm, showToast, fetchDatabases]);

    const fetchDbLogContent = useCallback(() => {
        if (!logViewer) return Promise.resolve(undefined);
        return window.pywebview?.api?.get_database_log_content(logViewer.dbId, logViewer.type);
    }, [logViewer]);

    const handleOpenSettings = useCallback(async (db: DbInstance) => {
        setSelectedDbId(db.id);
        setIsSettingsOpen(true);
        setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_db_config(db.id);
            if (res?.status === 'success') {
                setSettingsConfig(res.config);
            } else {
                showToast(tRef.current(res?.message || '', res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.fetch_config_error'), 'error');
        } finally {
            setIsLoadingSettings(false);
        }
    }, [showToast]);

    const handleSaveSettings = useCallback(async () => {
        if (!selectedDb) return;
        if (usedPorts.filter(p => p !== selectedDb.port).includes(Number(settingsConfig.port))) {
            return showToast(tRef.current('database.port_used_other'), 'error');
        }
        setIsSavingSettings(true);
        try {
            const res = await window.pywebview?.api?.save_db_config(selectedDb.id, settingsConfig);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setIsSettingsOpen(false);
                fetchDatabases();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('database.save_error'), 'error');
        } finally {
            setIsSavingSettings(false);
        }
    }, [selectedDb, usedPorts, settingsConfig, showToast, fetchDatabases]);

    const handleConfigChange = useCallback((key: string, value: string | number) => {
        setSettingsConfig((prev: any) => ({ ...prev, [key]: value }));
    }, []);

    const handlePasswordSubmit = useCallback(async () => {
        if (!passwordRef.current) return;
        setIsUpdatingPassword(true);
        const isSuccess = await passwordRef.current.submit();
        setIsUpdatingPassword(false);
        if (isSuccess) {
            setIsPasswordModalOpen(false);
        }
    }, []);

    const openNewInstanceModal = useCallback(() => {
        setIsNewInstanceOpen(true);
    }, []);

    const closeNewInstanceModal = useCallback(() => {
        setIsNewInstanceOpen(false);
    }, []);

    const openSettingsModal = useCallback((db: DbInstance) => {
        handleOpenSettings(db);
    }, [handleOpenSettings]);

    const closeSettingsModal = useCallback(() => {
        if (!isSavingSettings) setIsSettingsOpen(false);
    }, [isSavingSettings]);

    const openPasswordModal = useCallback((db: DbInstance) => {
        setSelectedDbId(db.id);
        setIsPasswordModalOpen(true);
    }, []);

    const closePasswordModal = useCallback(() => {
        if (!isUpdatingPassword) setIsPasswordModalOpen(false);
    }, [isUpdatingPassword]);

    const value = useMemo<DatabaseContextValue>(() => ({
        dbInstances,
        isLoading,
        togglingDbId,
        activeTab,
        setActiveTab,
        selectedDbId,
        selectedDb,
        filteredInstances,
        usedPorts,
        availableUpdates,
        isInstalling,
        updatingInstance,
        progress,
        progressText,
        logViewer,
        setLogViewer,
        fetchDbLogContent,
        isSettingsOpen,
        settingsConfig,
        isLoadingSettings,
        isSavingSettings,
        handleConfigChange,
        isPasswordModalOpen,
        isUpdatingPassword,
        isNewInstanceOpen,
        openNewInstanceModal,
        closeNewInstanceModal,
        openSettingsModal,
        closeSettingsModal,
        openPasswordModal,
        closePasswordModal,
        newDbRef,
        passwordRef,
        fetchDatabases,
        checkForUpdates,
        handleToggleDB,
        handleInstallDatabase,
        handleUpdateDatabase,
        handleConfirmUninstall,
        handleSaveSettings,
        handlePasswordSubmit,
    }), [
        dbInstances,
        isLoading,
        togglingDbId,
        activeTab,
        selectedDbId,
        selectedDb,
        filteredInstances,
        usedPorts,
        availableUpdates,
        isInstalling,
        updatingInstance,
        progress,
        progressText,
        logViewer,
        fetchDbLogContent,
        isSettingsOpen,
        settingsConfig,
        isLoadingSettings,
        isSavingSettings,
        handleConfigChange,
        isPasswordModalOpen,
        isUpdatingPassword,
        isNewInstanceOpen,
        openNewInstanceModal,
        closeNewInstanceModal,
        openSettingsModal,
        closeSettingsModal,
        openPasswordModal,
        closePasswordModal,
        fetchDatabases,
        checkForUpdates,
        handleToggleDB,
        handleInstallDatabase,
        handleUpdateDatabase,
        handleConfirmUninstall,
        handleSaveSettings,
        handlePasswordSubmit,
    ]);

    return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
    const ctx = useContext(DatabaseContext);
    if (!ctx) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return ctx;
}
