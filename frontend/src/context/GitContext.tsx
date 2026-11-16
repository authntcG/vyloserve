import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
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

export interface GitAccountItem {
    id: string;
    label: string;
    endpoint: string;
    username: string;
    email: string;
    protocol: 'https' | 'ssh';
    auth_mode: 'pat' | 'oauth' | 'ssh' | 'gcm';
    has_token: boolean;
    masked_token: string;
    ssh_key_path: string;
    is_default: boolean;
    is_push_active: boolean;
    requires_vpn?: boolean;
    vpn_reachable?: boolean;
    created_at?: number;
    updated_at?: number;
}

export interface SshKeyItem {
    filename: string;
    path: string;
    type: string;
    comment: string;
    public_key: string;
}

export interface GitProjectItem {
    id: string;
    name: string;
    full_name: string;
    visibility: 'private' | 'public' | 'internal';
    web_url: string;
    ssh_url: string;
    http_url: string;
    default_branch: string;
    last_activity_at: string;
    account_id: string;
    host: string;
    source: 'remote' | 'local';
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
    isCancelling: boolean;
    isInstallModalOpen: boolean;
    setIsInstallModalOpen: (v: boolean) => void;
    isUninstallModalOpen: boolean;
    setIsUninstallModalOpen: (v: boolean) => void;
    isAccountModalOpen: boolean;
    setIsAccountModalOpen: (v: boolean) => void;
    editingAccount: GitAccountItem | null;
    setEditingAccount: (v: GitAccountItem | null) => void;
    accounts: GitAccountItem[];
    sshKeys: SshKeyItem[];
    isLoadingAccounts: boolean;
    projects: GitProjectItem[];
    isLoadingProjects: boolean;
    projectsAuthWarning: boolean;
    projectsVpnBlocked: boolean;
    projectsVpnHost: string;
    selectedAccountId: string;
    setSelectedAccountId: (id: string) => void;
    fetchProjects: (accountId?: string) => Promise<void>;
    handleOpenProjectInBrowser: (url: string) => Promise<void>;
    progress: number;
    progressText: string;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    gitRef: React.RefObject<InstallGitRef | null>;
    fetchStatus: () => Promise<void>;
    fetchAccounts: () => Promise<void>;
    fetchSshKeys: () => Promise<void>;
    handleUpdateClick: (update: GitUpdateInfo) => Promise<void>;
    handleTogglePath: (enable: boolean) => Promise<void>;
    handleSaveConfig: () => Promise<void>;
    handleInstallSubmit: () => Promise<void>;
    handleCancelInstall: () => Promise<void>;
    executeUninstall: () => Promise<void>;
    handleSaveAccount: (accountData: any) => Promise<boolean>;
    handleDeleteAccount: (accountId: string) => Promise<boolean>;
    handleSetDefaultAccount: (accountId: string) => Promise<boolean>;
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
    const [isCancelling, setIsCancelling] = useState(false);
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<GitAccountItem | null>(null);
    const [accounts, setAccounts] = useState<GitAccountItem[]>([]);
    const [sshKeys, setSshKeys] = useState<SshKeyItem[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [projects, setProjects] = useState<GitProjectItem[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
    const [projectsAuthWarning, setProjectsAuthWarning] = useState<boolean>(false);
    const [projectsVpnBlocked, setProjectsVpnBlocked] = useState<boolean>(false);
    const [projectsVpnHost, setProjectsVpnHost] = useState<string>('');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
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

    const fetchAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_git_accounts) {
                const res = await api.get_git_accounts();
                if (res?.status === 'success' && Array.isArray(res.accounts)) {
                    setAccounts(res.accounts);
                }
            }
        } catch (error) {
            console.error('Failed to fetch Git accounts', error);
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    const fetchSshKeys = async () => {
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_ssh_keys) {
                const res = await api.get_ssh_keys();
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    setSshKeys(res.data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch SSH keys', error);
        }
    };

    const fetchProjects = useCallback(async (accId?: string) => {
        setIsLoadingProjects(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_git_account_projects) {
                const targetId = accId ?? selectedAccountId;
                const res = await api.get_git_account_projects(targetId);
                if (res?.status === 'success' && res.data) {
                    setProjects(Array.isArray(res.data.projects) ? res.data.projects : []);
                    setProjectsAuthWarning(Boolean(res.data.auth_warning));
                    setProjectsVpnBlocked(Boolean(res.data.vpn_blocked));
                    setProjectsVpnHost(res.data.vpn_host || '');
                    if (res.data.account_id && (!selectedAccountId || accId !== undefined)) {
                        setSelectedAccountId(res.data.account_id);
                    }
                } else {
                    setProjects([]);
                    setProjectsAuthWarning(false);
                    setProjectsVpnBlocked(false);
                    setProjectsVpnHost('');
                }
            }
        } catch {
            setProjects([]);
            setProjectsAuthWarning(false);
            setProjectsVpnBlocked(false);
            setProjectsVpnHost('');
        } finally {
            setIsLoadingProjects(false);
        }
    }, [selectedAccountId]);

    const handleOpenProjectInBrowser = useCallback(async (url: string) => {
        if (!url) return;
        try {
            const api = (window as any).pywebview?.api;
            if (api?.open_browser) {
                const res = await api.open_browser(url);
                if (res?.status === 'error') {
                    showToast(t(res.message || 'tools.git.sys_error', res.args || {}) as string, 'error');
                }
            } else {
                window.open(url, '_blank');
            }
        } catch {
            window.open(url, '_blank');
        }
    }, [showToast, t]);

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
            await fetchAccounts();
            await fetchSshKeys();
            await fetchProjects();
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
        setIsCancelling(false);
        setProgress(0);
        setProgressText(t('tools.git.starting_install'));

        try {
            const success = await gitRef.current.submit();
            if (success) {
                setIsInstallModalOpen(false);
                fetchStatus();
            }
        } finally {
            setIsProcessing(false);
            setIsCancelling(false);
            setIsMinimized(false);
        }
    };

    const handleCancelInstall = async () => {
        const ok = await confirm({
            title: t('common.cancel_install_title'),
            message: t('common.cancel_install_confirm'),
            type: 'danger',
            confirmText: t('common.cancel_install'),
            cancelText: t('common.continue_install')
        });
        if (!ok) return;

        setIsCancelling(true);
        try {
            await window.pywebview?.api?.cancel_installation('git');
        } catch (e) {
            console.error(e);
            setIsCancelling(false);
        }
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

    const handleSaveAccount = async (accountData: any) => {
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.save_git_account(accountData);
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.git.account_saved', res.args || {}) as string, 'success');
                setIsAccountModalOpen(false);
                setEditingAccount(null);
                await fetchAccounts();
                const newAccId = res.account_id || '';
                if (newAccId) {
                    setSelectedAccountId(newAccId);
                }
                await fetchProjects(newAccId);
                const conf = await api?.get_git_config();
                if (conf?.status === 'success') {
                    setConfigData({ userName: conf.data.name || '', userEmail: conf.data.email || '' });
                }
                return true;
            }
            showToast(t(res?.message || 'tools.git.sys_error', res?.args || {}) as string, 'error');
            return false;
        } catch (error: any) {
            showToast(error?.message || t('tools.git.sys_error'), 'error');
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteAccount = async (accountId: string) => {
        if (!await confirm({
            title: t('tools.git.delete_account'),
            message: t('tools.git.delete_account_confirm'),
            type: 'danger',
            confirmText: t('common.delete', 'Delete'),
            cancelText: t('common.cancel', 'Cancel')
        })) {
            return false;
        }
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.delete_git_account(accountId);
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.git.account_deleted', res.args || {}) as string, 'success');
                await fetchAccounts();
                setSelectedAccountId('');
                await fetchProjects('');
                const conf = await api?.get_git_config();
                if (conf?.status === 'success') {
                    setConfigData({ userName: conf.data.name || '', userEmail: conf.data.email || '' });
                }
                return true;
            }
            showToast(t(res?.message || 'tools.git.sys_error', res?.args || {}) as string, 'error');
            return false;
        } catch (error: any) {
            showToast(error?.message || t('tools.git.sys_error'), 'error');
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSetDefaultAccount = async (accountId: string) => {
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.set_default_git_account(accountId);
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.git.account_default_set', res.args || {}) as string, 'success');
                await fetchAccounts();
                setSelectedAccountId(accountId);
                await fetchProjects(accountId);
                const conf = await api?.get_git_config();
                if (conf?.status === 'success') {
                    setConfigData({ userName: conf.data.name || '', userEmail: conf.data.email || '' });
                }
                return true;
            }
            showToast(t(res?.message || 'tools.git.sys_error', res?.args || {}) as string, 'error');
            return false;
        } catch (error: any) {
            showToast(error?.message || t('tools.git.sys_error'), 'error');
            return false;
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
        isCancelling,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isUninstallModalOpen,
        setIsUninstallModalOpen,
        isAccountModalOpen,
        setIsAccountModalOpen,
        editingAccount,
        setEditingAccount,
        accounts,
        sshKeys,
        isLoadingAccounts,
        projects,
        isLoadingProjects,
        projectsAuthWarning,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        setSelectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
        progress,
        progressText,
        isMinimized,
        setIsMinimized,
        gitRef,
        fetchStatus,
        fetchAccounts,
        fetchSshKeys,
        handleUpdateClick,
        handleTogglePath,
        handleSaveConfig,
        handleInstallSubmit,
        handleCancelInstall,
        executeUninstall,
        handleSaveAccount,
        handleDeleteAccount,
        handleSetDefaultAccount
    }), [
        gitData,
        configData,
        isLoading,
        updateAvailable,
        isProcessing,
        isCancelling,
        isInstallModalOpen,
        isUninstallModalOpen,
        isAccountModalOpen,
        editingAccount,
        accounts,
        sshKeys,
        isLoadingAccounts,
        projects,
        isLoadingProjects,
        projectsAuthWarning,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
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
