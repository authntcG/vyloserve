import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import type { ApacheVersionData } from '../menu/apache/InstallWizard';
import type { NewProjectRef } from '../menu/apache/NewProject';

export interface ProjectData {
    id: string;
    name: string;
    domain: string;
    path: string;
    php_version: string;
    php_port: number;
    framework?: string;
    host_synced?: boolean;
}

interface ApacheContextValue {
    // Status
    isFetchingApacheStatus: boolean;
    isApacheInstalled: boolean;
    installedApacheVersion: string | null;
    updateAvailable: string | null;
    apachePath: string;
    isApacheRunning: boolean;
    isTogglingServer: boolean;

    // Installation
    isInstallServerOpen: boolean;
    availableVersions: ApacheVersionData[];
    isFetchingVersions: boolean;
    installVersion: string;
    installUrl: string;
    httpPort: number;
    httpsPort: number;
    isInstalling: boolean;
    progress: number;
    progressText: string;
    setInstallVersion: React.Dispatch<React.SetStateAction<string>>;
    setInstallUrl: React.Dispatch<React.SetStateAction<string>>;
    setHttpPort: React.Dispatch<React.SetStateAction<number>>;
    setHttpsPort: React.Dispatch<React.SetStateAction<number>>;

    // Projects
    projects: ProjectData[];
    isFetchingProjects: boolean;
    selectedProjectId: string | null;
    selectedProject: ProjectData | undefined;
    isCreatingProject: boolean;
    isUpdatingProject: boolean;
    isDeletingProject: boolean;
    isDeleteFiles: boolean;
    setIsDeleteFiles: (val: boolean) => void;

    // Modal Visibility
    isOptionsOpen: boolean;
    isNewProjectModalOpen: boolean;
    isProjectSettingsOpen: boolean;
    isDeleteConfirmOpen: boolean;

    // Modal Control
    openInstallModal: () => void;
    closeInstallModal: () => void;
    openOptionsModal: () => void;
    closeOptionsModal: () => void;
    openNewProjectModal: () => void;
    closeNewProjectModal: () => void;
    openProjectSettingsModal: (projectId: string) => void;
    closeProjectSettingsModal: () => void;
    openDeleteConfirmModal: (projectId: string) => void;
    closeDeleteConfirmModal: () => void;
    restoreProgressWidget: () => void;

    // Refs for Modals
    projectFormRef: React.RefObject<NewProjectRef | null>;
    projectSettingsRef: React.RefObject<any>;

    // Actions
    fetchApacheStatus: () => Promise<void>;
    fetchProjects: () => Promise<void>;
    fetchAvailableVersions: () => Promise<void>;
    handleToggleServer: () => Promise<void>;
    handleInstallApache: () => Promise<void>;
    handleUpdateApacheClick: () => Promise<void>;
    handleUninstall: () => Promise<void>;
    handleCreateSubmit: () => Promise<void>;
    handleUpdateProjectSubmit: () => Promise<void>;
    handleDeleteProjectSubmit: () => Promise<void>;
    handleSyncHost: (projectId: string) => Promise<void>;
    handleOpenBrowser: (domain: string) => Promise<void>;
    handleOpenDocumentRoot: (path: string) => Promise<void>;
    openConfigFile: () => void;
    openDirectory: () => void;
}

const ApacheContext = createContext<ApacheContextValue | undefined>(undefined);

export function ApacheProvider({ children }: { readonly children: React.ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const tRef = useRef(t);
    tRef.current = t;

    // State Global & Instalasi
    const [isFetchingApacheStatus, setIsFetchingApacheStatus] = useState(true);
    const [isApacheInstalled, setIsApacheInstalled] = useState(false);
    const [installedApacheVersion, setInstalledApacheVersion] = useState<string | null>(null);
    const [apachePath, setApachePath] = useState<string>(t('apache.not_installed'));
    const [isApacheRunning, setIsApacheRunning] = useState(false);
    const [isTogglingServer, setIsTogglingServer] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

    const [isInstallServerOpen, setIsInstallServerOpen] = useState(false);
    const [availableVersions, setAvailableVersions] = useState<ApacheVersionData[]>([]);
    const [isFetchingVersions, setIsFetchingVersions] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installUrl, setInstallUrl] = useState('');
    const [httpPort, setHttpPort] = useState(80);
    const [httpsPort, setHttpsPort] = useState(443);
    const [isInstalling, setIsInstalling] = useState(false);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    // State Project Management
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(true);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [isDeleteFiles, setIsDeleteFiles] = useState(false);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isUpdatingProject, setIsUpdatingProject] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    const projectFormRef = useRef<NewProjectRef>(null);
    const projectSettingsRef = useRef<any>(null);

    const handleOpenBrowser = useCallback(async (domain: string) => {
        const url = `https://${domain}`;
        try {
            if (window.pywebview?.api?.open_browser) window.pywebview.api.open_browser(url);
            else window.open(url, '_blank');
        } catch (e) {
            console.error(e);
        }
    }, []);

    const fetchProjects = useCallback(async () => {
        setIsFetchingProjects(true);
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') {
                    setProjects(res.data || []);
                } else {
                    showToast(tRef.current(res.message) as string, 'error');
                }
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.fetch_projects_error'), 'error');
        } finally {
            setIsFetchingProjects(false);
        }
    }, [showToast]);

    const handleCreateSubmit = useCallback(async () => {
        if (!projectFormRef.current) return;
        setIsCreatingProject(true);
        if (await projectFormRef.current.submit()) {
            setIsNewProjectModalOpen(false);
        }
        setIsCreatingProject(false);
    }, []);

    const handleUpdateProjectSubmit = useCallback(async () => {
        if (!projectSettingsRef.current) return;
        setIsUpdatingProject(true);
        if (await projectSettingsRef.current.submit()) {
            setIsProjectSettingsOpen(false);
        }
        setIsUpdatingProject(false);
    }, []);

    const handleDeleteProjectSubmit = useCallback(async () => {
        if (!selectedProjectId) return;
        setIsDeletingProject(true);
        try {
            const res = await window.pywebview?.api?.delete_project(selectedProjectId, isDeleteFiles);
            if (res?.status === 'success') {
                showToast((res.message ? tRef.current(res.message, res.args || {}) : tRef.current('apache.project_deleted')) as string, 'success');
                fetchProjects();
                setIsDeleteConfirmOpen(false);
            } else {
                showToast(tRef.current(res?.message || '', res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.delete_error'), 'error');
        } finally {
            setIsDeletingProject(false);
            setIsDeleteFiles(false);
        }
    }, [selectedProjectId, isDeleteFiles, showToast, fetchProjects]);

    const handleSyncHost = useCallback(async (projectId: string) => {
        try {
            const res = await window.pywebview?.api?.retry_sync_host(projectId);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') fetchProjects();
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.sync_error'), 'error');
        }
    }, [showToast, fetchProjects]);

    const handleOpenDocumentRoot = useCallback(async (path: string) => {
        try {
            window.pywebview?.api?.open_in_explorer(path);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const openConfigFile = useCallback(() => {
        window.pywebview?.api?.open_apache_config?.();
    }, []);

    const openDirectory = useCallback(() => {
        window.pywebview?.api?.open_apache_directory?.();
    }, []);

    const fetchApacheStatus = useCallback(async () => {
        setIsFetchingApacheStatus(true);
        try {
            const res = await window.pywebview?.api?.get_apache_status();
            if (res?.status === 'success') {
                setIsApacheInstalled(res.installed);
                setApachePath(res.path || tRef.current('apache.not_installed'));
                setIsApacheRunning(res.running || false);
            }
            const ver = await window.pywebview?.api?.get_apache_installed_versions();
            let activeVersion = null;
            if (ver?.status === 'success') {
                activeVersion = ver.active || ver.data[0];
                setInstalledApacheVersion(activeVersion);
            }
            if (res?.status === 'success' && res.installed && activeVersion) {
                const avail = await window.pywebview?.api?.get_available_apache();
                if (avail?.status === 'success') {
                    const filtered = avail.data.filter((v: ApacheVersionData) => v.version !== activeVersion);
                    setAvailableVersions(filtered);
                    if (filtered.length > 0) {
                        setUpdateAvailable(filtered[0].version);
                    } else {
                        setUpdateAvailable(null);
                    }
                }
            } else {
                setUpdateAvailable(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingApacheStatus(false);
        }
    }, []);

    // Stabilized refs for event listeners
    const fetchApacheStatusRef = useRef(fetchApacheStatus);
    fetchApacheStatusRef.current = fetchApacheStatus;

    const fetchProjectsRef = useRef(fetchProjects);
    fetchProjectsRef.current = fetchProjects;

    useEffect(() => {
        fetchProjectsRef.current();
        const handleProjectListUpdated = () => { fetchProjectsRef.current(); };
        window.addEventListener('project_list_updated', handleProjectListUpdated);
        return () => window.removeEventListener('project_list_updated', handleProjectListUpdated);
    }, []);

    useEffect(() => {
        fetchApacheStatusRef.current();
        const handleVersionChanged = () => { fetchApacheStatusRef.current(); };
        window.addEventListener('apache_version_changed', handleVersionChanged);
        return () => window.removeEventListener('apache_version_changed', handleVersionChanged);
    }, []);

    useEffect(() => {
        const handleStatus = (e: any) => {
            const service = e.detail?.service;
            if (service !== 'apache' && service !== 'all') return;
            if (typeof e.detail.running === 'boolean') {
                setIsApacheRunning(e.detail.running);
            } else {
                fetchApacheStatusRef.current();
            }
        };

        const handleProg = (e: any) => {
            if (e.detail?.source && !['ApacheManager', 'ProjectManager'].includes(e.detail.source)) return;
            if (e.detail) {
                const text = e.detail.text || '';
                const args = e.detail.args || {};
                const pct = clampPercent(e.detail.percent);
                setProgress(pct);
                setProgressText(tRef.current(text, args) as string);

                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }
                if (pct >= 100 || pct === 0) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => {
                        setProgress(0);
                        setIsCreatingProject(false);
                    }, 3000);
                }
            }
        };

        window.addEventListener('service_status_changed', handleStatus);
        window.addEventListener('vylo_progress', handleProg);
        return () => {
            window.removeEventListener('service_status_changed', handleStatus);
            window.removeEventListener('vylo_progress', handleProg);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    }, []);

    const handleToggleServer = useCallback(async () => {
        setIsTogglingServer(true);
        try {
            const api = window.pywebview?.api;
            const res = isApacheRunning ? await api?.stop_apache_server() : await api?.start_apache_server();
            if (res?.status === 'success') {
                showToast(tRef.current(res.message || '', res.args || {}) as string, 'success');
                setIsApacheRunning(!isApacheRunning);
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'apache', running: !isApacheRunning } }));
            } else {
                showToast(tRef.current(res?.message || '', res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.toggle_error'), 'error');
        } finally {
            setIsTogglingServer(false);
        }
    }, [isApacheRunning, showToast]);

    const fetchAvailableVersions = useCallback(async () => {
        setIsFetchingVersions(true);
        try {
            const res = await window.pywebview?.api?.get_available_apache();
            if (res?.status === 'success') {
                const filtered = res.data.filter((v: ApacheVersionData) => v.version !== installedApacheVersion);
                setAvailableVersions(filtered);
                if (filtered.length > 0) {
                    setInstallVersion(filtered[0].version);
                    setInstallUrl(filtered[0].url);
                }
            } else {
                showToast(tRef.current(res?.message || '', res?.args || {}) as string, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.fetch_versions_error'), 'error');
        } finally {
            setIsFetchingVersions(false);
        }
    }, [installedApacheVersion, showToast]);

    const openInstallModal = useCallback(() => {
        setIsInstallServerOpen(true);
        if (availableVersions.length === 0) fetchAvailableVersions();
    }, [availableVersions.length, fetchAvailableVersions]);

    const closeInstallModal = useCallback(() => {
        setIsInstallServerOpen(false);
    }, []);

    const openOptionsModal = useCallback(() => {
        setIsOptionsOpen(true);
    }, []);

    const closeOptionsModal = useCallback(() => {
        setIsOptionsOpen(false);
    }, []);

    const openNewProjectModal = useCallback(() => {
        setIsNewProjectModalOpen(true);
    }, []);

    const closeNewProjectModal = useCallback(() => {
        setIsNewProjectModalOpen(false);
    }, []);

    const openProjectSettingsModal = useCallback((projectId: string) => {
        setSelectedProjectId(projectId);
        setIsProjectSettingsOpen(true);
    }, []);

    const closeProjectSettingsModal = useCallback(() => {
        if (!isUpdatingProject) setIsProjectSettingsOpen(false);
    }, [isUpdatingProject]);

    const openDeleteConfirmModal = useCallback((projectId: string) => {
        setSelectedProjectId(projectId);
        setIsDeleteFiles(false);
        setIsDeleteConfirmOpen(true);
    }, []);

    const closeDeleteConfirmModal = useCallback(() => {
        if (!isDeletingProject) setIsDeleteConfirmOpen(false);
    }, [isDeletingProject]);

    const restoreProgressWidget = useCallback(() => {
        if (isInstalling) setIsInstallServerOpen(true);
        if (isCreatingProject) setIsNewProjectModalOpen(true);
    }, [isInstalling, isCreatingProject]);

    const handleInstallApache = useCallback(async () => {
        if (!installVersion || !installUrl) return;
        setIsInstalling(true);
        setProgress(0);
        setProgressText(tRef.current('apache.installing_start'));
        try {
            const res = await window.pywebview?.api?.install_apache(installVersion, installUrl, httpPort);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setIsInstallServerOpen(false);
                fetchApacheStatus();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.system_error'), 'error');
        } finally {
            setIsInstalling(false);
        }
    }, [installVersion, installUrl, httpPort, showToast, fetchApacheStatus]);

    const handleUpdateApacheClick = useCallback(async () => {
        if (!updateAvailable) return;

        let target = availableVersions.find(v => v.version === updateAvailable);
        if (!target) {
            setIsFetchingVersions(true);
            try {
                const res = await window.pywebview?.api?.get_available_apache();
                if (res?.status === 'success') {
                    const filtered = res.data.filter((v: ApacheVersionData) => v.version !== installedApacheVersion);
                    setAvailableVersions(filtered);
                    target = filtered.find((v: ApacheVersionData) => v.version === updateAvailable) || filtered[0];
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsFetchingVersions(false);
            }
        }

        if (!target) return;

        const isConfirmed = await confirm({
            title: tRef.current('apache.confirm_update'),
            message: `${tRef.current('apache.update_prefix')}${installedApacheVersion || ''}${tRef.current('apache.update_middle')}${target.version}${tRef.current('apache.update_suffix')}`,
            type: 'warning',
            confirmText: tRef.current('apache.yes_update'),
        });

        if (!isConfirmed) return;

        setInstallVersion(target.version);
        setInstallUrl(target.url);
        setIsInstallServerOpen(false);
        setIsInstalling(true);
        setProgress(0);
        setProgressText(tRef.current('apache.updating_start', { version: target.version }));

        try {
            const res = await window.pywebview?.api?.install_apache(target.version, target.url, httpPort);
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchApacheStatus();
                fetchAvailableVersions();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.system_error'), 'error');
        } finally {
            setIsInstalling(false);
            setProgress(0);
            setIsInstallServerOpen(false);
        }
    }, [updateAvailable, availableVersions, installedApacheVersion, confirm, httpPort, showToast, fetchApacheStatus, fetchAvailableVersions]);

    const handleUninstall = useCallback(async () => {
        if (!await confirm({
            title: tRef.current('apache.uninstall_apache'),
            message: <p className="text-slate-700 dark:text-slate-300">{tRef.current('apache.confirm_uninstall')} <strong className="text-slate-900 dark:text-white">Apache Web Server</strong>?</p>,
            type: 'danger',
            confirmText: tRef.current('apache.yes_uninstall'),
        })) return;

        try {
            const res = await window.pywebview?.api?.uninstall_apache();
            showToast(tRef.current(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchApacheStatus();
            }
        } catch (e) {
            console.error(e);
            showToast(tRef.current('apache.uninstall_error'), 'error');
        }
    }, [confirm, showToast, fetchApacheStatus]);

    const value = useMemo<ApacheContextValue>(() => ({
        isFetchingApacheStatus,
        isApacheInstalled,
        installedApacheVersion,
        updateAvailable,
        apachePath,
        isApacheRunning,
        isTogglingServer,
        isInstallServerOpen,
        availableVersions,
        isFetchingVersions,
        installVersion,
        installUrl,
        httpPort,
        httpsPort,
        isInstalling,
        progress,
        progressText,
        setInstallVersion,
        setInstallUrl,
        setHttpPort,
        setHttpsPort,
        projects,
        isFetchingProjects,
        selectedProjectId,
        selectedProject,
        isCreatingProject,
        isUpdatingProject,
        isDeletingProject,
        isDeleteFiles,
        setIsDeleteFiles,
        isOptionsOpen,
        isNewProjectModalOpen,
        isProjectSettingsOpen,
        isDeleteConfirmOpen,
        openInstallModal,
        closeInstallModal,
        openOptionsModal,
        closeOptionsModal,
        openNewProjectModal,
        closeNewProjectModal,
        openProjectSettingsModal,
        closeProjectSettingsModal,
        openDeleteConfirmModal,
        closeDeleteConfirmModal,
        restoreProgressWidget,
        projectFormRef,
        projectSettingsRef,
        fetchApacheStatus,
        fetchProjects,
        fetchAvailableVersions,
        handleToggleServer,
        handleInstallApache,
        handleUpdateApacheClick,
        handleUninstall,
        handleCreateSubmit,
        handleUpdateProjectSubmit,
        handleDeleteProjectSubmit,
        handleSyncHost,
        handleOpenBrowser,
        handleOpenDocumentRoot,
        openConfigFile,
        openDirectory,
    }), [
        isFetchingApacheStatus,
        isApacheInstalled,
        installedApacheVersion,
        updateAvailable,
        apachePath,
        isApacheRunning,
        isTogglingServer,
        isInstallServerOpen,
        availableVersions,
        isFetchingVersions,
        installVersion,
        installUrl,
        httpPort,
        httpsPort,
        isInstalling,
        progress,
        progressText,
        projects,
        isFetchingProjects,
        selectedProjectId,
        selectedProject,
        isCreatingProject,
        isUpdatingProject,
        isDeletingProject,
        isDeleteFiles,
        isOptionsOpen,
        isNewProjectModalOpen,
        isProjectSettingsOpen,
        isDeleteConfirmOpen,
        openInstallModal,
        closeInstallModal,
        openOptionsModal,
        closeOptionsModal,
        openNewProjectModal,
        closeNewProjectModal,
        openProjectSettingsModal,
        closeProjectSettingsModal,
        openDeleteConfirmModal,
        closeDeleteConfirmModal,
        restoreProgressWidget,
        fetchApacheStatus,
        fetchProjects,
        fetchAvailableVersions,
        handleToggleServer,
        handleInstallApache,
        handleUpdateApacheClick,
        handleUninstall,
        handleCreateSubmit,
        handleUpdateProjectSubmit,
        handleDeleteProjectSubmit,
        handleSyncHost,
        handleOpenBrowser,
        handleOpenDocumentRoot,
        openConfigFile,
        openDirectory,
    ]);

    return <ApacheContext.Provider value={value}>{children}</ApacheContext.Provider>;
}

export function useApache(): ApacheContextValue {
    const ctx = useContext(ApacheContext);
    if (!ctx) {
        throw new Error('useApache must be used within an ApacheProvider');
    }
    return ctx;
}
