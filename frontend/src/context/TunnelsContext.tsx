import React, { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import { type InstallTunnelRef } from '../menu/tools/tunnels/InstallTunnel';

export type ShareMode = 'project' | 'custom';
export type ActiveTab = 'all' | 'zrok' | 'cloudflare';

export interface CloudflareStatus {
    installed: boolean;
    version?: string;
    active_shares: { id: string; target: string; url: string }[];
}

export interface ZrokStatus {
    installed: boolean;
    enabled: boolean;
    version?: string;
    env_status?: string;
    active_shares: { id: string; project_id: string; url: string }[];
}

export interface ZrokActionContext {
    readonly t: any;
    readonly showToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
    readonly onSuccess: () => void;
}

const UNEXPECTED_ERROR_KEY = 'backend.error.unexpected';
const PROGRESS_HIDE_DELAY_MS = 3000;
const SETTLED_PERCENT = 100;

export async function runZrokAction(call: () => Promise<any> | undefined, { t, showToast, onSuccess }: ZrokActionContext) {
    try {
        const res = await call();
        showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
        if (res?.status === 'success') onSuccess();
    } catch (e) {
        console.error('Zrok action failed:', e);
        showToast(t(UNEXPECTED_ERROR_KEY), 'error');
    }
}

export function pickShareTarget(shareMode: ShareMode, selectedProject: string, customTarget: string): string {
    return shareMode === 'project' ? selectedProject : customTarget;
}

export type TunnelBinary = 'zrok' | 'cloudflare';

interface TunnelsContextType {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    zrokStatus: ZrokStatus | null;
    cfStatus: CloudflareStatus | null;
    projects: any[];
    isZrokLoading: boolean;
    isCfLoading: boolean;
    zrokUpdateAvailable: string | null;
    cfUpdateAvailable: string | null;
    isInstallModalOpen: boolean;
    setIsInstallModalOpen: (v: boolean) => void;
    uninstallTarget: TunnelBinary | null;
    setUninstallTarget: (v: TunnelBinary | null) => void;
    isUninstalling: boolean;
    setIsUninstalling: (v: boolean) => void;
    token: string;
    setToken: (v: string) => void;
    isEnabling: boolean;
    selectedProject: string;
    setSelectedProject: (v: string) => void;
    isStarting: boolean;
    shareMode: ShareMode;
    setShareMode: (v: ShareMode) => void;
    customTarget: string;
    setCustomTarget: (v: string) => void;
    isInstalling: boolean;
    progress: number;
    progressText: string;
    zrokInstallRef: React.RefObject<InstallTunnelRef | null>;
    cfInstallRef: React.RefObject<InstallTunnelRef | null>;
    dropdown: {
        isDropdownOpen: boolean;
        setIsDropdownOpen: (v: boolean) => void;
        searchQuery: string;
        setSearchQuery: (v: string) => void;
        dropdownRef: React.RefObject<HTMLDivElement | null>;
        searchInputRef: React.RefObject<HTMLInputElement | null>;
    };
    fetchData: () => void;
    handleUpdateClick: (engine: TunnelBinary, version: string | null) => Promise<void>;
    handleZrokUninstall: () => Promise<void>;
    handleCfUninstall: () => Promise<void>;
    handleInstallSubmit: () => Promise<void>;
    handleEnable: () => Promise<void>;
    handleDisable: () => Promise<void>;
    handleStartShare: () => Promise<void>;
    handleStopShare: (shareId: string) => void;
    openInstallModal: () => void;
}

const TunnelsContext = createContext<TunnelsContextType | undefined>(undefined);

async function fetchLatestRemoteVersion(
    status: { installed: boolean; version?: string } | null,
    fetcher?: () => Promise<any>
): Promise<string | null> {
    if (!status?.installed || !status.version || typeof fetcher !== 'function') {
        return null;
    }
    try {
        const res = await fetcher();
        if (res?.status === 'success' && res.data?.length > 0) {
            const localNorm = status.version.replace(/^v/i, '');
            const remoteNorm = res.data[0].value.replace(/^v/i, '');
            if (remoteNorm !== localNorm && remoteNorm !== 'latest') {
                return res.data[0].value;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return null;
}

export function TunnelsProvider({ children, initialTab = 'all' }: { readonly children: ReactNode; readonly initialTab?: ActiveTab }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
    const [zrokStatus, setZrokStatus] = useState<ZrokStatus | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [isZrokLoading, setIsZrokLoading] = useState(true);

    const [cfStatus, setCfStatus] = useState<CloudflareStatus | null>(null);
    const [isCfLoading, setIsCfLoading] = useState(true);

    const [zrokUpdateAvailable, setZrokUpdateAvailable] = useState<string | null>(null);
    const [cfUpdateAvailable, setCfUpdateAvailable] = useState<string | null>(null);

    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [uninstallTarget, setUninstallTarget] = useState<TunnelBinary | null>(null);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [token, setToken] = useState('');
    const [isEnabling, setIsEnabling] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>('project');
    const [customTarget, setCustomTarget] = useState('localhost:3000');

    // Project Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Progress state
    const [isInstalling, setIsInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    const zrokInstallRef = useRef<InstallTunnelRef>(null);
    const cfInstallRef = useRef<InstallTunnelRef>(null);

    const fetchZrokData = async () => {
        setIsZrokLoading(true);
        try {
            const zStatus = await window.pywebview?.api?.get_zrok_status();
            if (zStatus && typeof zStatus.installed === 'boolean') {
                setZrokStatus(zStatus);
            }
            const pRes = await window.pywebview?.api?.get_projects();
            if (pRes?.status === 'success') {
                setProjects(pRes.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsZrokLoading(false);
        }
    };

    const fetchCfData = async () => {
        setIsCfLoading(true);
        try {
            const clStatus = await window.pywebview?.api?.get_cloudflare_status();
            if (clStatus && typeof clStatus.installed === 'boolean') {
                setCfStatus(clStatus);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCfLoading(false);
        }
    };

    const fetchData = () => {
        fetchZrokData();
        fetchCfData();
    };

    const fetchDataRef = useRef(fetchData);
    fetchDataRef.current = fetchData;

    useEffect(() => {
        fetchDataRef.current();
        const handleStatus = (e: any) => {
            if (['zrok', 'cloudflare', 'all'].includes(e.detail?.service)) {
                fetchDataRef.current();
            }
        };
        window.addEventListener('service_status_changed', handleStatus);
        return () => window.removeEventListener('service_status_changed', handleStatus);
    }, []);

    // Progress listener
    useEffect(() => {
        const handleProg = (e: any) => {
            if (!e.detail) return;
            const percent = e.detail.percent;
            if (hideProgressTimeoutRef.current) {
                window.clearTimeout(hideProgressTimeoutRef.current);
                hideProgressTimeoutRef.current = null;
            }
            if (percent < 0) {
                setIsInstalling(false);
                setProgress(0);
                return;
            }
            if (percent > 0 && percent < SETTLED_PERCENT) setIsInstalling(true);
            setProgress(clampPercent(percent));
            setProgressText(t(e.detail.text || '', e.detail.args || {}) as string);
            if (percent >= SETTLED_PERCENT) {
                hideProgressTimeoutRef.current = window.setTimeout(() => {
                    setProgress(0);
                    setIsInstalling(false);
                    setIsInstallModalOpen(false);
                    fetchDataRef.current();
                }, PROGRESS_HIDE_DELAY_MS);
            }
        };
        window.addEventListener('vylo_progress', handleProg);
        return () => window.removeEventListener('vylo_progress', handleProg);
    }, [t]);

    // Check updates
    useEffect(() => {
        const checkUpdates = async () => {
            const api = window.pywebview?.api;
            const zrokVer = await fetchLatestRemoteVersion(zrokStatus, api?.get_available_zrok_versions);
            setZrokUpdateAvailable(zrokVer);
            const cfVer = await fetchLatestRemoteVersion(cfStatus, api?.get_available_cloudflare_versions);
            setCfUpdateAvailable(cfVer);
        };
        checkUpdates();
    }, [zrokStatus?.installed, zrokStatus?.version, cfStatus?.installed, cfStatus?.version]);

    // Dropdown outside click & focus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isDropdownOpen) {
            setSearchQuery('');
        } else {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isDropdownOpen]);

    const actionContext: ZrokActionContext = { t, showToast, onSuccess: fetchData };

    const handleUpdateClick = async (engine: 'zrok' | 'cloudflare', version: string | null) => {
        if (!version) return;
        if (await confirm({
            title: t(`tools.${engine}.confirm_update.title`),
            message: t(`tools.${engine}.confirm_update.message`, { version }),
            type: 'warning'
        })) {
            setIsInstalling(true);
            setProgress(0);
            setProgressText(t('common.preparing'));

            try {
                let res;
                if (engine === 'cloudflare') {
                    res = await window.pywebview?.api?.install_cloudflare(version);
                } else {
                    res = await window.pywebview?.api?.install_zrok(version);
                }

                if (res?.status === 'success') {
                    showToast(t(`tools.${engine}.update_success`), 'success');
                } else {
                    showToast(res?.message ? t(res.message, res.args || {}) as string : t('backend.error.unexpected'), 'error');
                }
            } catch (e) {
                console.error(e);
                showToast(t('backend.error.unexpected'), 'error');
            } finally {
                setIsInstalling(false);
                fetchData();
            }
        }
    };

    const handleZrokUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview?.api?.uninstall_zrok();
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.zrok.uninstall_success') as string, 'success');
                setUninstallTarget(null);
                setZrokStatus(null);
                fetchData();
            } else {
                showToast(t(res?.message || UNEXPECTED_ERROR_KEY, res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error('Zrok uninstall failed:', e);
            showToast(t(UNEXPECTED_ERROR_KEY), 'error');
        } finally {
            setIsUninstalling(false);
        }
    };

    const handleCfUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview?.api?.uninstall_cloudflare();
            if (res?.status === 'success') {
                showToast(t(res.message || 'tools.cloudflare.uninstall_success') as string, 'success');
                setUninstallTarget(null);
                setCfStatus(null);
                fetchData();
            } else {
                showToast(t(res?.message || UNEXPECTED_ERROR_KEY, res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(t(UNEXPECTED_ERROR_KEY), 'error');
        } finally {
            setIsUninstalling(false);
        }
    };

    const handleInstallSubmit = async () => {
        setIsInstalling(true);
        setProgress(0);
        setProgressText(t('common.preparing'));

        let success = false;
        if (activeTab === 'cloudflare' && cfInstallRef.current) {
            success = await cfInstallRef.current.submit();
        } else if (activeTab === 'zrok' && zrokInstallRef.current) {
            success = await zrokInstallRef.current.submit();
        }

        if (success) {
            setIsInstallModalOpen(false);
            fetchData();
        } else {
            setIsInstalling(false);
        }
    };

    const handleEnable = async () => {
        if (!token.trim()) return;
        setIsEnabling(true);
        await runZrokAction(() => window.pywebview?.api?.enable_zrok(token.trim()), actionContext);
        setIsEnabling(false);
    };

    const handleDisable = () => runZrokAction(() => window.pywebview?.api?.disable_zrok(), actionContext);

    const handleStartShare = async () => {
        const target = pickShareTarget(shareMode, selectedProject, customTarget);
        if (!target) return;
        setIsStarting(true);

        if (activeTab === 'cloudflare') {
            await runZrokAction(() => window.pywebview?.api?.start_cloudflare_share(target), actionContext);
        } else {
            await runZrokAction(() => window.pywebview?.api?.start_zrok_share(target), actionContext);
        }
        setIsStarting(false);
    };

    const handleStopShare = (shareId: string) => {
        if (activeTab === 'cloudflare') {
            runZrokAction(() => window.pywebview?.api?.stop_cloudflare_share(shareId), actionContext);
        } else {
            runZrokAction(() => window.pywebview?.api?.stop_zrok_share(shareId), actionContext);
        }
    };

    const openInstallModal = () => setIsInstallModalOpen(true);

    const value = useMemo<TunnelsContextType>(() => ({
        activeTab,
        setActiveTab,
        zrokStatus,
        cfStatus,
        projects,
        isZrokLoading,
        isCfLoading,
        zrokUpdateAvailable,
        cfUpdateAvailable,
        isInstallModalOpen,
        setIsInstallModalOpen,
        uninstallTarget,
        setUninstallTarget,
        isUninstalling,
        setIsUninstalling,
        token,
        setToken,
        isEnabling,
        selectedProject,
        setSelectedProject,
        isStarting,
        shareMode,
        setShareMode,
        customTarget,
        setCustomTarget,
        isInstalling,
        progress,
        progressText,
        zrokInstallRef,
        cfInstallRef,
        dropdown: {
            isDropdownOpen,
            setIsDropdownOpen,
            searchQuery,
            setSearchQuery,
            dropdownRef,
            searchInputRef
        },
        fetchData,
        handleUpdateClick,
        handleZrokUninstall,
        handleCfUninstall,
        handleInstallSubmit,
        handleEnable,
        handleDisable,
        handleStartShare,
        handleStopShare,
        openInstallModal
    }), [
        activeTab,
        zrokStatus,
        cfStatus,
        projects,
        isZrokLoading,
        isCfLoading,
        zrokUpdateAvailable,
        cfUpdateAvailable,
        isInstallModalOpen,
        uninstallTarget,
        isUninstalling,
        token,
        isEnabling,
        selectedProject,
        isStarting,
        shareMode,
        customTarget,
        isInstalling,
        progress,
        progressText,
        isDropdownOpen,
        searchQuery
    ]);

    return (
        <TunnelsContext.Provider value={value}>
            {children}
        </TunnelsContext.Provider>
    );
}

export function useTunnels(): TunnelsContextType {
    const context = useContext(TunnelsContext);
    if (!context) {
        throw new Error('useTunnels must be used within a TunnelsProvider');
    }
    return context;
}
