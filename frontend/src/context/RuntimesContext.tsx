import React, { createContext, useContext, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import { type InstallNodeRef } from '../menu/runtimes/InstallNode';
import { type InstallPythonRef } from '../menu/runtimes/InstallPython';
import { type InstallJavaRef } from '../menu/runtimes/InstallJava';
import { type InstallGoRef } from '../menu/runtimes/InstallGo';

export type RuntimeEngine = 'node' | 'python' | 'java' | 'go';

export interface EngineExternalInfo {
    exists: boolean;
    path: string;
    version: string;
}

export interface EngineData {
    installed: boolean;
    version: string;
    updateAvailable?: string;
    in_path: boolean;
    external: EngineExternalInfo;
}

export type RuntimeDataMap = Record<RuntimeEngine, EngineData>;

export const INITIAL_RUNTIME_DATA: RuntimeDataMap = {
    node: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    python: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    java: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    go: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } }
};

interface RuntimesContextType {
    activeTab: RuntimeEngine;
    setActiveTab: (tab: RuntimeEngine) => void;
    runtimeData: RuntimeDataMap;
    isLoading: boolean;
    isProcessing: boolean;
    installingEngine: string | null;
    updatingVersion: string | null;
    progress: number;
    progressText: string;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    isNodeModalOpen: boolean;
    setIsNodeModalOpen: (v: boolean) => void;
    isPythonModalOpen: boolean;
    setIsPythonModalOpen: (v: boolean) => void;
    isJavaModalOpen: boolean;
    setIsJavaModalOpen: (v: boolean) => void;
    isGoModalOpen: boolean;
    setIsGoModalOpen: (v: boolean) => void;
    nodeRef: React.RefObject<InstallNodeRef | null>;
    pythonRef: React.RefObject<InstallPythonRef | null>;
    javaRef: React.RefObject<InstallJavaRef | null>;
    goRef: React.RefObject<InstallGoRef | null>;
    activeEnginesCount: number;
    fetchStatuses: () => Promise<void>;
    handleUpdateClick: (engine: RuntimeEngine, version: string) => Promise<void>;
    handleTogglePath: (engine: RuntimeEngine, enable: boolean) => Promise<void>;
    executeUninstall: (engine: RuntimeEngine) => Promise<void>;
    handleOpenInstall: () => void;
    handleInstallNodeSubmit: () => Promise<void>;
    handleInstallPythonSubmit: () => Promise<void>;
    handleInstallJavaSubmit: () => Promise<void>;
    handleInstallGoSubmit: () => Promise<void>;
}

const RuntimesContext = createContext<RuntimesContextType | undefined>(undefined);

export function RuntimesProvider({ children }: { readonly children: ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [activeTab, setActiveTab] = useState<RuntimeEngine>('node');
    const [runtimeData, setRuntimeData] = useState<RuntimeDataMap>(INITIAL_RUNTIME_DATA);
    const [isLoading, setIsLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [installingEngine, setInstallingEngine] = useState<string | null>(null);
    const [updatingVersion, setUpdatingVersion] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
    const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
    const [isJavaModalOpen, setIsJavaModalOpen] = useState(false);
    const [isGoModalOpen, setIsGoModalOpen] = useState(false);

    const nodeRef = useRef<InstallNodeRef>(null);
    const pythonRef = useRef<InstallPythonRef>(null);
    const javaRef = useRef<InstallJavaRef>(null);
    const goRef = useRef<InstallGoRef>(null);

    const activeEnginesCount = Object.values(runtimeData).filter(data => data.installed || data.external?.exists).length;

    useEffect(() => {
        const handleProgress = (event: any) => {
            if (event.detail?.source && event.detail.source !== 'RuntimesManager') return;
            const { percent, text } = event.detail;
            setProgress(clampPercent(percent));
            setProgressText(t(text, event.detail.args || {}) as string);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [t]);

    const checkForUpdates = async (api: any, nodeStatus: any, pythonStatus: any, javaStatus: any, goStatus: any) => {
        let nodeUpdate: string | undefined;
        let pythonUpdate: string | undefined;
        let javaUpdate: string | undefined;
        let goUpdate: string | undefined;

        const compareVersions = (v1: string, v2: string) => {
            const p1 = v1.replace(/^v/i, '').replace(/^go/i, '').split(/[.-]/).map(Number);
            const p2 = v2.replace(/^v/i, '').replace(/^go/i, '').split(/[.-]/).map(Number);
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                if ((p1[i] || 0) > (p2[i] || 0)) return 1;
                if ((p1[i] || 0) < (p2[i] || 0)) return -1;
            }
            return 0;
        };

        await Promise.all([
            (async () => {
                if (nodeStatus?.installed && nodeStatus.version) {
                    try {
                        const res = await api.get_available_node_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const localNorm = nodeStatus.version.replace(/^v/i, '');
                            const remoteNorm = res.data[0].value.replace(/^v/i, '');
                            if (compareVersions(remoteNorm, localNorm) > 0) nodeUpdate = res.data[0].value;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            })(),
            (async () => {
                if (goStatus?.installed && goStatus.version) {
                    try {
                        const res = await api.get_available_go_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const localNorm = goStatus.version.replace(/^go/i, '');
                            const remoteNorm = res.data[0].value.replace(/^go/i, '');
                            if (compareVersions(remoteNorm, localNorm) > 0) goUpdate = res.data[0].value;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            })(),
            (async () => {
                if (pythonStatus?.installed && pythonStatus.version) {
                    try {
                        const res = await api.get_available_python_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const minM = pythonStatus.version.split('.').slice(0, 2).join('.');
                            if (res.data.some((v: any) => v.value.startsWith(minM + '.') && v.value !== pythonStatus.version)) {
                                pythonUpdate = res.data.find((v: any) => v.value.startsWith(minM + '.') && v.value !== pythonStatus.version)?.value;
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            })(),
            (async () => {
                if (javaStatus?.installed && javaStatus.version) {
                    try {
                        const res = await api.get_available_java_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const minM = javaStatus.version.split('.').slice(0, 2).join('.');
                            if (res.data.some((v: any) => v.value.startsWith(minM + '.') && v.value !== javaStatus.version)) {
                                javaUpdate = res.data.find((v: any) => v.value.startsWith(minM + '.') && v.value !== javaStatus.version)?.value;
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            })()
        ]);

        setRuntimeData(prev => ({
            ...prev,
            node: { ...prev.node, updateAvailable: nodeUpdate },
            python: { ...prev.python, updateAvailable: pythonUpdate },
            java: { ...prev.java, updateAvailable: javaUpdate },
            go: { ...prev.go, updateAvailable: goUpdate }
        }));
    };

    const fetchStatuses = async () => {
        setIsLoading(true);
        try {
            const api = window.pywebview?.api;
            if (api) {
                const [nodeStatus, pythonStatus, javaStatus, goStatus] = await Promise.all([
                    api.get_node_status(),
                    api.get_python_status(),
                    api.get_java_status(),
                    api.get_go_status()
                ]);

                setRuntimeData(prev => ({
                    ...prev,
                    node: { ...prev.node, ...nodeStatus },
                    python: { ...prev.python, ...pythonStatus },
                    java: { ...prev.java, ...javaStatus },
                    go: { ...prev.go, ...goStatus }
                }));

                checkForUpdates(api, nodeStatus, pythonStatus, javaStatus, goStatus);
            }
        } catch (error) {
            console.error(t('runtimes.load_status_error'), error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStatusesRef = useRef(fetchStatuses);
    fetchStatusesRef.current = fetchStatuses;

    useEffect(() => {
        fetchStatusesRef.current();
    }, []);

    const setEngineModalOpen = (engine: RuntimeEngine, isOpen: boolean) => {
        const modalSetters: Record<RuntimeEngine, (v: boolean) => void> = {
            node: setIsNodeModalOpen,
            python: setIsPythonModalOpen,
            java: setIsJavaModalOpen,
            go: setIsGoModalOpen
        };
        modalSetters[engine]?.(isOpen);
    };

    const callEngineInstall = async (engine: RuntimeEngine, version: string) => {
        const api = window.pywebview?.api;
        if (!api) return null;
        switch (engine) {
            case 'node': return await api.install_node(version, true);
            case 'python': return await api.install_python(version, true);
            case 'java': return await api.install_java(version);
            case 'go': return await api.install_go(version);
            default: return null;
        }
    };

    const handleUpdateClick = async (engine: RuntimeEngine, version: string) => {
        if (!await confirm({
            title: t('runtimes.update_title') + engine.toUpperCase(),
            message: t('runtimes.confirm_update_msg', { version }),
            type: 'warning'
        })) {
            return;
        }

        setEngineModalOpen(engine, true);
        setIsMinimized(true);
        setInstallingEngine(engine);
        setUpdatingVersion(version);
        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('common.preparing'));

        try {
            const res = await callEngineInstall(engine, version);
            if (res?.status === 'success') {
                showToast(res.message ? t(res.message, res.args || {}) as string : t('runtimes.update_success', { engine: engine.toUpperCase() }), 'success');
            } else {
                showToast(res?.message ? t(res.message, res.args || {}) as string : t('backend.error.unexpected'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast(t('runtimes.sys_error'), "error");
        } finally {
            setIsProcessing(false);
            setInstallingEngine(null);
            setUpdatingVersion(null);
            setIsMinimized(false);
            setEngineModalOpen(engine, false);
            fetchStatuses();
        }
    };

    const handleTogglePath = async (engine: RuntimeEngine, enable: boolean) => {
        const isExternalExists = runtimeData[engine].external?.exists;
        if (isExternalExists) {
            showToast(t('runtimes.external_lock_warning', { engine }), "error");
            return;
        }

        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.toggle_global_path(engine, enable);
            if (res?.status === 'success') {
                setRuntimeData(prev => ({
                    ...prev,
                    [engine]: { ...prev[engine], in_path: enable }
                }));
                if (enable) showToast(t('runtimes.path_added_success', { engine }), "success");
                else showToast(t('runtimes.path_removed_success', { engine }), "success");
            } else {
                showToast((res?.message ? t(res.message, res.args || {}) : t('runtimes.path_change_error')) as string, "error");
            }
        } catch (error) {
            console.error(error);
            showToast(t('runtimes.path_change_sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const executeUninstall = async (engine: RuntimeEngine) => {
        if (!await confirm({
            title: `${t('runtimes.uninstall_title')}${engine.toUpperCase()}`,
            message: (
                <>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        {t('runtimes.uninstall_confirm_1')}<strong>{engine.toUpperCase()}</strong>{t('runtimes.uninstall_confirm_2')}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                        {t('runtimes.uninstall_warning_1')}<strong>{t('runtimes.uninstall_warning_2')}</strong>{t('runtimes.uninstall_warning_3')}
                    </p>
                </>
            ),
            type: 'danger',
            confirmText: t('runtimes.yes_uninstall')
        })) return;

        setIsProcessing(true);
        try {
            let res;
            if (engine === 'node') res = await window.pywebview?.api?.uninstall_node();
            else if (engine === 'python') res = await window.pywebview?.api?.uninstall_python();
            else if (engine === 'java') res = await window.pywebview?.api?.uninstall_java();
            else if (engine === 'go') res = await window.pywebview?.api?.uninstall_go();

            if (res?.status === 'success') {
                showToast(t('runtimes.uninstall_success', { engine: engine.toUpperCase() }), "success");
                fetchStatuses();
            } else {
                showToast((res?.message ? t(res.message, res.args || {}) : t('runtimes.uninstall_error', { engine })) as string, "error");
            }
        } catch (error) {
            console.error(error);
            showToast(t('runtimes.uninstall_sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenInstall = () => {
        if (activeTab === 'node') setIsNodeModalOpen(true);
        else if (activeTab === 'python') setIsPythonModalOpen(true);
        else if (activeTab === 'java') setIsJavaModalOpen(true);
        else if (activeTab === 'go') setIsGoModalOpen(true);
    };

    const executeInstallation = async (engineName: string, refTrigger: any, closeStateSetter: Function) => {
        if (!refTrigger.current) return;

        setIsProcessing(true);
        setInstallingEngine(engineName);
        setProgress(0);
        setProgressText(t('runtimes.starting_install'));

        const success = await refTrigger.current.submit();

        if (success) {
            closeStateSetter(false);
            fetchStatuses();
        }

        setIsProcessing(false);
        setIsMinimized(false);
        setInstallingEngine(null);
    };

    const handleInstallNodeSubmit = async () => executeInstallation('Node.js', nodeRef, setIsNodeModalOpen);
    const handleInstallPythonSubmit = async () => executeInstallation('Python', pythonRef, setIsPythonModalOpen);
    const handleInstallJavaSubmit = async () => executeInstallation('Java (JDK)', javaRef, setIsJavaModalOpen);
    const handleInstallGoSubmit = async () => executeInstallation('Go Compiler', goRef, setIsGoModalOpen);

    const value = useMemo<RuntimesContextType>(() => ({
        activeTab,
        setActiveTab,
        runtimeData,
        isLoading,
        isProcessing,
        installingEngine,
        updatingVersion,
        progress,
        progressText,
        isMinimized,
        setIsMinimized,
        isNodeModalOpen,
        setIsNodeModalOpen,
        isPythonModalOpen,
        setIsPythonModalOpen,
        isJavaModalOpen,
        setIsJavaModalOpen,
        isGoModalOpen,
        setIsGoModalOpen,
        nodeRef,
        pythonRef,
        javaRef,
        goRef,
        activeEnginesCount,
        fetchStatuses,
        handleUpdateClick,
        handleTogglePath,
        executeUninstall,
        handleOpenInstall,
        handleInstallNodeSubmit,
        handleInstallPythonSubmit,
        handleInstallJavaSubmit,
        handleInstallGoSubmit
    }), [
        activeTab,
        runtimeData,
        isLoading,
        isProcessing,
        installingEngine,
        updatingVersion,
        progress,
        progressText,
        isMinimized,
        isNodeModalOpen,
        isPythonModalOpen,
        isJavaModalOpen,
        isGoModalOpen,
        activeEnginesCount
    ]);

    return (
        <RuntimesContext.Provider value={value}>
            {children}
        </RuntimesContext.Provider>
    );
}

export function useRuntimes(): RuntimesContextType {
    const context = useContext(RuntimesContext);
    if (!context) {
        throw new Error('useRuntimes must be used within a RuntimesProvider');
    }
    return context;
}
