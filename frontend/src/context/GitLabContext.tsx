import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import { compareVersions } from '../utils/version';

export interface GitLabStatusData {
    installed: boolean;
    version: string | null;
    path: string | null;
    in_path?: boolean;
    is_external: boolean;
    authenticated: boolean;
    host: string | null;
    username: string | null;
}

export interface GitLabAccountItem {
    id: string;
    host: string;
    username: string;
    git_name: string;
    git_email: string;
    auth_type: 'pat' | 'oauth' | 'ssh' | 'credentials';
    git_protocol: 'https' | 'ssh';
    has_token: boolean;
    masked_token: string;
    ssh_key_path: string;
    is_default: boolean;
    is_push_active: boolean;
    requires_vpn?: boolean;
    vpn_reachable?: boolean;
    use_keyring?: boolean;
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

export interface GitLabIssueItem {
    id: string;
    title: string;
    raw?: string;
}

export interface GitLabProjectItem {
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

export interface InstallGitLabRef {
    submit: () => Promise<boolean>;
}

export const INITIAL_GITLAB_DATA: GitLabStatusData = {
    installed: false,
    version: null,
    path: null,
    in_path: false,
    is_external: false,
    authenticated: false,
    host: null,
    username: null,
};

interface GitLabContextType {
    statusData: GitLabStatusData;
    isLoadingStatus: boolean;
    fetchStatus: (silent?: boolean) => Promise<void>;
    isInstallModalOpen: boolean;
    setIsInstallModalOpen: (v: boolean) => void;
    isUninstallModalOpen: boolean;
    setIsUninstallModalOpen: (v: boolean) => void;
    isLoginModalOpen: boolean;
    setIsLoginModalOpen: (v: boolean) => void;
    isAccountModalOpen: boolean;
    setIsAccountModalOpen: (v: boolean) => void;
    editingAccount: GitLabAccountItem | null;
    setEditingAccount: (v: GitLabAccountItem | null) => void;
    accounts: GitLabAccountItem[];
    isLoadingAccounts: boolean;
    sshKeys: SshKeyItem[];
    updateAvailable: any;
    isProcessing: boolean;
    isCancelling: boolean;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
    progress: number;
    progressText: string;
    gitlabRef: React.RefObject<InstallGitLabRef | null>;
    issues: GitLabIssueItem[];
    isLoadingIssues: boolean;
    issuesVpnBlocked: boolean;
    issuesVpnHost: string;
    fetchRecentIssues: () => Promise<void>;
    projects: GitLabProjectItem[];
    isLoadingProjects: boolean;
    projectsVpnBlocked: boolean;
    projectsVpnHost: string;
    selectedAccountId: string;
    setSelectedAccountId: (id: string) => void;
    fetchProjects: (accountId?: string) => Promise<void>;
    handleOpenProjectInBrowser: (url: string) => Promise<void>;
    fetchAccounts: () => Promise<void>;
    fetchSshKeys: () => Promise<void>;
    handleUpdateClick: (update: any) => Promise<void>;
    handleInstallSubmit: () => Promise<void>;
    handleCancelInstall: () => Promise<void>;
    executeUninstall: () => Promise<void>;
    handleTogglePath: (enable: boolean) => Promise<void>;
    handleSaveAccount: (accountData: any) => Promise<boolean>;
    handleRemoveAccount: (accountId: string) => Promise<boolean>;
    handleSetDefaultAccount: (accountId: string, syncGit?: boolean) => Promise<boolean>;
}

const GitLabContext = createContext<GitLabContextType | undefined>(undefined);

export function GitLabProvider({ children }: { readonly children: ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [statusData, setStatusData] = useState<GitLabStatusData>(INITIAL_GITLAB_DATA);
    const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

    const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
    const [isUninstallModalOpen, setIsUninstallModalOpen] = useState<boolean>(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
    const [editingAccount, setEditingAccount] = useState<GitLabAccountItem | null>(null);

    const [accounts, setAccounts] = useState<GitLabAccountItem[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [sshKeys, setSshKeys] = useState<SshKeyItem[]>([]);
    const [updateAvailable, setUpdateAvailable] = useState<any>(null);

    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isCancelling, setIsCancelling] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [progressText, setProgressText] = useState<string>('');

    const [issues, setIssues] = useState<GitLabIssueItem[]>([]);
    const [isLoadingIssues, setIsLoadingIssues] = useState<boolean>(false);
    const [issuesVpnBlocked, setIssuesVpnBlocked] = useState<boolean>(false);
    const [issuesVpnHost, setIssuesVpnHost] = useState<string>('');

    const [projects, setProjects] = useState<GitLabProjectItem[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
    const [projectsVpnBlocked, setProjectsVpnBlocked] = useState<boolean>(false);
    const [projectsVpnHost, setProjectsVpnHost] = useState<string>('');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');

    const gitlabRef = useRef<InstallGitLabRef>(null);

    useEffect(() => {
        const handleProgress = (event: any) => {
            if (event.detail?.source && event.detail.source !== 'GitLabManager') return;
            const { percent, text } = event.detail;
            setProgress(clampPercent(percent));
            setProgressText(t(text, event.detail.args || {}) as string);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [t]);

    const fetchAccounts = useCallback(async () => {
        setIsLoadingAccounts(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_gitlab_accounts) {
                const res = await api.get_gitlab_accounts();
                if (res?.status === 'success' && Array.isArray(res.accounts)) {
                    setAccounts(res.accounts);
                }
            }
        } catch (error) {
            console.error('Failed to fetch GitLab accounts', error);
        } finally {
            setIsLoadingAccounts(false);
        }
    }, []);

    const fetchSshKeys = useCallback(async () => {
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
    }, []);

    const fetchStatus = useCallback(async (silent = false) => {
        if (!silent) setIsLoadingStatus(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_gitlab_status) {
                const res = await api.get_gitlab_status(true);
                if (res) {
                    setStatusData(res);
                }
                if (res?.installed && res?.version) {
                    api?.get_available_gitlab_versions?.().then((vRes: any) => {
                        if (vRes?.status === 'success' && Array.isArray(vRes.data) && vRes.data.length > 0) {
                            const latest = vRes.data[0];
                            if (latest.version_text && compareVersions(latest.version_text, res.version) > 0) {
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
        } catch {
            // Best effort fetch
        } finally {
            if (!silent) setIsLoadingStatus(false);
        }
    }, [fetchAccounts, fetchSshKeys]);

    const fetchRecentIssues = useCallback(async () => {
        if (!statusData.installed || !statusData.authenticated) {
            setIssues([]);
            setIssuesVpnBlocked(false);
            setIssuesVpnHost('');
            return;
        }
        setIsLoadingIssues(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_gitlab_recent_issues) {
                const res = await api.get_gitlab_recent_issues('', 5);
                if (res?.status === 'success') {
                    setIssues(Array.isArray(res.issues) ? res.issues : []);
                    setIssuesVpnBlocked(Boolean(res.vpn_blocked));
                    setIssuesVpnHost(res.vpn_host || '');
                } else {
                    setIssues([]);
                    setIssuesVpnBlocked(false);
                    setIssuesVpnHost('');
                }
            }
        } catch {
            setIssues([]);
            setIssuesVpnBlocked(false);
            setIssuesVpnHost('');
        } finally {
            setIsLoadingIssues(false);
        }
    }, [statusData.installed, statusData.authenticated]);

    const fetchProjects = useCallback(async (accId?: string) => {
        setIsLoadingProjects(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_gitlab_account_projects) {
                const targetId = accId ?? selectedAccountId;
                const res = await api.get_gitlab_account_projects(targetId);
                if (res?.status === 'success' && res.data) {
                    setProjects(Array.isArray(res.data.projects) ? res.data.projects : []);
                    setProjectsVpnBlocked(Boolean(res.data.vpn_blocked));
                    setProjectsVpnHost(res.data.vpn_host || '');
                    if (res.data.account_id && !selectedAccountId) {
                        setSelectedAccountId(res.data.account_id);
                    }
                } else {
                    setProjects([]);
                    setProjectsVpnBlocked(false);
                    setProjectsVpnHost('');
                }
            }
        } catch {
            setProjects([]);
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

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (statusData.installed && statusData.authenticated) {
            fetchRecentIssues();
            fetchProjects();
        }
    }, [statusData.installed, statusData.authenticated, fetchRecentIssues, fetchProjects]);

    const handleInstallSubmit = async () => {
        if (!gitlabRef.current) return;
        setIsProcessing(true);
        setIsCancelling(false);
        setProgress(0);
        setProgressText(t('tools.gitlab.starting_install'));

        try {
            const success = await gitlabRef.current.submit();
            if (success) {
                setIsInstallModalOpen(false);
                await fetchStatus();
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
            await (window as any).pywebview?.api?.cancel_gitlab_install();
        } catch (e) {
            console.error(e);
            setIsCancelling(false);
        }
    };

    const handleUpdateClick = async (update: any) => {
        if (!await confirm({
            title: t('tools.gitlab.confirm_update_title'),
            message: t('tools.gitlab.confirm_update_msg', { version: update.version_text }),
            type: 'warning'
        })) {
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('common.preparing'));

        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.install_gitlab_cli(update.version_text);
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.gitlab.install_success', res.args || {}) as string, 'success');
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

    const executeUninstall = async () => {
        setIsProcessing(true);
        setProgress(100);
        setProgressText(t('tools.gitlab.uninstalling'));
        try {
            const res = await (window as any).pywebview?.api?.uninstall_gitlab_cli();
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.gitlab.uninstall_success', res.args || {}) as string, 'success');
                setIsUninstallModalOpen(false);
                await fetchStatus();
            } else {
                showToast(t(res?.message || 'tools.gitlab.uninstall_failed', res?.args || {}) as string, 'error');
            }
        } catch (e: any) {
            showToast(e?.message || t('tools.git.sys_error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTogglePath = async (enable: boolean) => {
        if (statusData.is_external) {
            showToast(t('tools.git.lock_warning'), 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.toggle_gitlab_path(enable);
            if (res?.status === 'success') {
                setStatusData(prev => ({ ...prev, in_path: enable }));
                showToast(enable ? t('tools.gitlab.path_added') : t('tools.gitlab.path_removed'), 'success');
            } else {
                showToast(res?.message || t('tools.gitlab.path_error'), 'error');
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
            const res = await api?.authenticate_gitlab(
                accountData.host || 'gitlab.com',
                accountData.token || '',
                accountData.auth_type || 'pat',
                accountData.git_protocol || 'https',
                accountData.git_name || '',
                accountData.git_email || '',
                accountData.ssh_key_path || '',
                Boolean(accountData.sync_git_config),
                accountData.username || '',
                Boolean(accountData.requires_vpn)
            );
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.gitlab.auth_success', res.args || {}) as string, 'success');
                setIsAccountModalOpen(false);
                setIsLoginModalOpen(false);
                setEditingAccount(null);
                await fetchStatus();
                const newAccId = res.account_id || '';
                if (newAccId) {
                    setSelectedAccountId(newAccId);
                }
                await fetchProjects(newAccId);
                await fetchRecentIssues();
                return true;
            }
            showToast(t(res?.message || 'backend.gitlab.auth_failed', res?.args || {}) as string, 'error');
            return false;
        } catch (error: any) {
            showToast(error?.message || t('tools.git.sys_error'), 'error');
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveAccount = async (accountId: string) => {
        if (!await confirm({
            title: t('tools.gitlab.delete_account'),
            message: t('tools.gitlab.delete_account_confirm'),
            type: 'danger',
            confirmText: t('common.delete', 'Delete'),
            cancelText: t('common.cancel', 'Cancel')
        })) {
            return false;
        }
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.remove_gitlab_account(accountId);
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.gitlab.logout_success', res.args || {}) as string, 'success');
                await fetchStatus();
                setSelectedAccountId('');
                await fetchProjects('');
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

    const handleSetDefaultAccount = async (accountId: string, syncGit: boolean = true) => {
        setIsProcessing(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.set_default_gitlab_account(accountId, syncGit);
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.gitlab.account_switched', res.args || {}) as string, 'success');
                await fetchStatus();
                setSelectedAccountId(accountId);
                await fetchProjects(accountId);
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

    const value = useMemo<GitLabContextType>(() => ({
        statusData,
        isLoadingStatus,
        fetchStatus,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isUninstallModalOpen,
        setIsUninstallModalOpen,
        isLoginModalOpen,
        setIsLoginModalOpen,
        isAccountModalOpen,
        setIsAccountModalOpen,
        editingAccount,
        setEditingAccount,
        accounts,
        isLoadingAccounts,
        sshKeys,
        updateAvailable,
        isProcessing,
        isCancelling,
        isMinimized,
        setIsMinimized,
        progress,
        progressText,
        gitlabRef,
        issues,
        isLoadingIssues,
        issuesVpnBlocked,
        issuesVpnHost,
        fetchRecentIssues,
        projects,
        isLoadingProjects,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        setSelectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
        fetchAccounts,
        fetchSshKeys,
        handleUpdateClick,
        handleInstallSubmit,
        handleCancelInstall,
        executeUninstall,
        handleTogglePath,
        handleSaveAccount,
        handleRemoveAccount,
        handleSetDefaultAccount,
    }), [
        statusData,
        isLoadingStatus,
        fetchStatus,
        isInstallModalOpen,
        isUninstallModalOpen,
        isLoginModalOpen,
        isAccountModalOpen,
        editingAccount,
        accounts,
        isLoadingAccounts,
        sshKeys,
        updateAvailable,
        isProcessing,
        isCancelling,
        isMinimized,
        progress,
        progressText,
        issues,
        isLoadingIssues,
        issuesVpnBlocked,
        issuesVpnHost,
        fetchRecentIssues,
        projects,
        isLoadingProjects,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
        fetchAccounts,
        fetchSshKeys,
        handleUpdateClick,
    ]);

    return (
        <GitLabContext.Provider value={value}>
            {children}
        </GitLabContext.Provider>
    );
}

export function useGitLab() {
    const context = useContext(GitLabContext);
    if (!context) {
        throw new Error('useGitLab must be used within a GitLabProvider');
    }
    return context;
}
