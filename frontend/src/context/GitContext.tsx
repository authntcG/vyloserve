import React, { createContext, useContext, useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';

export interface GitExternalInfo {
    exists: boolean;
    path: string;
    version: string;
}

export interface GitData {
    installed: boolean;
    version: string;
    in_path: boolean;
    external: GitExternalInfo;
}

export interface GitConfigData {
    userName: string;
    userEmail: string;
}

export interface InstallGitRef {
    submit: () => Promise<boolean>;
}

export interface GitUpdateInfo {
    version_text: string;
    url?: string;
    [key: string]: unknown;
}

export const INITIAL_GIT_DATA: GitData = {
    installed: false,
    version: '',
    in_path: false,
    external: { exists: false, path: '', version: '' }
};

interface GitContextType {
    gitData: GitData;
    configData: GitConfigData;
    setConfigData: React.Dispatch<React.SetStateAction<GitConfigData>>;
    isLoading: boolean;
    updateAvailable: GitUpdateInfo | null;
    isProcessing: boolean;
    isInstallModalOpen: boolean;
    setIsInstallModalOpen: (v: boolean) => void;
    isUninstallModalOpen: boolean;
    setIsUninstallModalOpen: (v: boolean) => void;
    progress: number;
    progressText: string;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    gitRef: React.RefObject<InstallGitRef | null>;
    fetchStatus: () => Promise<void>;
    handleUpdateClick: (update: GitUpdateInfo) => Promise<void>;
    handleTogglePath: (enable: boolean) => Promise<void>;
    handleSaveConfig: () => Promise<void>;
    handleInstallSubmit: () => Promise<void>;
    executeUninstall: () => Promise<void>;
}

const GitContext = createContext<GitContextType | undefined>(undefined);

export function GitProvider({ children }: { readonly children: ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [gitData, setGitData] = useState<GitData>(INITIAL_GIT_DATA);
    const [configData, setConfigData] = useState<GitConfigData>({ userName: '', userEmail: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [updateAvailable, setUpdateAvailable] = useState<GitUpdateInfo | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    const gitRef = useRef<InstallGitRef>(null);

    useEffect(() => {
        const handleProgress = (event: any) => {
            if (event.detail?.source && event.detail.source !== 'GitManager') return;
            const { percent, text } = event.detail;
            setProgress(clampPercent(percent));
            setProgressText(t(text, event.detail.args || {}) as string);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [t]);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const api = window.pywebview?.api;
            if (api) {
                const status = await api.get_git_status();
                setGitData(status);

                const conf = await api.get_git_config();
                if (conf?.status === 'success') {
                    setConfigData({ userName: conf.data.name || '', userEmail: conf.data.email || '' });
                }

                if (status.installed && status.version && status.version !== 'Unknown') {
                    api.get_available_git_versions().then((res: any) => {
                        if (res?.status === 'success' && res.data.length > 0) {
                            const latest = res.data[0];
                            if (latest.version_text && latest.version_text !== status.version) {
                                setUpdateAvailable(latest);
                            } else {
                                setUpdateAvailable(null);
                            }
                        }
                    }).catch(console.error);
                } else {
                    setUpdateAvailable(null);
                }
            }
        } catch (error) {
            console.error(t('tools.git.load_error'), error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStatusRef = useRef(fetchStatus);
    fetchStatusRef.current = fetchStatus;

    useEffect(() => {
        fetchStatusRef.current();
    }, []);

    const handleUpdateClick = async (update: GitUpdateInfo) => {
        if (!await confirm({
            title: t('git.confirm_update_title'),
            message: t('git.confirm_update_msg', { version: update.version_text }),
            type: 'warning'
        })) {
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('common.preparing'));

        try {
            const res = await window.pywebview?.api?.install_git(update.value, update.filename, update.version_text);
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.git.install_success') as string, 'success');
            } else {
                showToast(t(res?.message || 'backend.error.unexpected', res?.args || {}) as string, 'error');
            }
        } catch {
            showToast(t('backend.error.unexpected'), 'error');
        } finally {
            setIsProcessing(false);
            fetchStatus();
        }
    };

    const handleTogglePath = async (enable: boolean) => {
        if (gitData.external?.exists) {
            showToast(t('tools.git.lock_warning'), 'error');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.toggle_git_path(enable);
            if (res?.status === 'success') {
                setGitData(prev => ({ ...prev, in_path: enable }));
                showToast(enable ? t('tools.git.path_added') : t('tools.git.path_removed'), 'success');
            } else {
                showToast(res?.message || t('tools.git.path_error'), 'error');
            }
        } catch {
            showToast(t('tools.git.sys_error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveConfig = async () => {
        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.set_git_config(configData.userName, configData.userEmail);
            if (res?.status === 'success') {
                showToast(t('tools.git.config_saved'), 'success');
            } else {
                showToast(res?.message || t('tools.git.config_error'), 'error');
            }
        } catch {
            showToast(t('tools.git.sys_error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInstallSubmit = async () => {
        if (!gitRef.current) return;
        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('tools.git.starting_install'));

        const success = await gitRef.current.submit();
        if (success) {
            setIsInstallModalOpen(false);
            fetchStatus();
        }
        setIsProcessing(false);
        setIsMinimized(false);
    };

    const executeUninstall = async () => {
        setIsProcessing(true);
        setProgress(100);
        setProgressText(t('tools.git.uninstalling'));
        try {
            const res = await window.pywebview?.api?.uninstall_git();
            if (res?.status === 'success') {
                showToast(t('tools.git.uninstall_success'), 'success');
                setIsUninstallModalOpen(false);
                fetchStatus();
            } else {
                showToast(res?.message || t('tools.git.uninstall_error'), 'error');
            }
        } catch {
            showToast(t('tools.git.sys_error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const value = useMemo<GitContextType>(() => ({
        gitData,
        configData,
        setConfigData,
        isLoading,
        updateAvailable,
        isProcessing,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isUninstallModalOpen,
        setIsUninstallModalOpen,
        progress,
        progressText,
        isMinimized,
        setIsMinimized,
        gitRef,
        fetchStatus,
        handleUpdateClick,
        handleTogglePath,
        handleSaveConfig,
        handleInstallSubmit,
        executeUninstall
    }), [
        gitData,
        configData,
        isLoading,
        updateAvailable,
        isProcessing,
        isInstallModalOpen,
        isUninstallModalOpen,
        progress,
        progressText,
        isMinimized
    ]);

    return (
        <GitContext.Provider value={value}>
            {children}
        </GitContext.Provider>
    );
}

export function useGit(): GitContextType {
    const context = useContext(GitContext);
    if (!context) {
        throw new Error('useGit must be used within a GitProvider');
    }
    return context;
}
