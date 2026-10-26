import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';
import { clampPercent } from '../utils/progress';
import type { NewProjectRef } from '../menu/projects/NewProject';

export interface ProjectData {
    id: string;
    name: string;
    domain: string;
    path: string;
    php_version: string;
    php_port: number;
    project_type?: 'php' | 'node' | 'python' | 'go' | 'java';
    proxy_port?: number | null;
    framework?: string;
    host_synced?: boolean;
}

export interface RunningServerInfo {
    running: boolean;
    port?: number;
    pid?: number;
    uptime?: number;
    starting?: boolean;
}

export interface ProjectContextValue {
    // Projects Data
    projects: ProjectData[];
    isFetchingProjects: boolean;
    selectedProjectId: string | null;
    selectedProject: ProjectData | undefined;

    // Mutation States
    isCreatingProject: boolean;
    isUpdatingProject: boolean;
    isDeletingProject: boolean;
    isDeleteFiles: boolean;
    setIsDeleteFiles: (val: boolean) => void;

    // Modals Visibility
    isNewProjectModalOpen: boolean;
    isProjectSettingsOpen: boolean;
    isDeleteConfirmOpen: boolean;
    isCliModalOpen: boolean;
    cliPromptText: string;

    // Dev Server States
    runningServers: Record<string, RunningServerInfo>;
    isServerLogsModalOpen: boolean;
    serverLogsProject: ProjectData | null;
    serverLogsContent: string;
    isFetchingLogs: boolean;

    // Progress
    progress: number;
    progressText: string;

    // Modal Controls
    openNewProjectModal: () => void;
    closeNewProjectModal: () => void;
    openProjectSettingsModal: (projectId: string) => void;
    closeProjectSettingsModal: () => void;
    openDeleteConfirmModal: (projectId: string) => void;
    closeDeleteConfirmModal: () => void;
    restoreProgressWidget: () => void;

    // Refs
    projectFormRef: React.RefObject<NewProjectRef | null>;
    projectSettingsRef: React.RefObject<any>;

    // Actions
    fetchProjects: () => Promise<void>;
    handleCreateSubmit: () => Promise<void>;
    handleUpdateProjectSubmit: () => Promise<void>;
    handleDeleteProjectSubmit: () => Promise<void>;
    handleSyncHost: (projectId: string) => Promise<void>;
    handleOpenBrowser: (domain: string) => Promise<void>;
    handleOpenDocumentRoot: (path: string) => Promise<void>;
    confirmCancelProjectInstall: () => Promise<void>;

    // Dev Server Actions
    handleStartServer: (projectId: string) => Promise<void>;
    handleStopServer: (projectId: string) => Promise<void>;
    handleViewServerLogs: (projectId: string) => Promise<void>;
    refreshServerLogs: () => Promise<void>;
    closeServerLogsModal: () => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { readonly children: React.ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const tRef = useRef(t);
    tRef.current = t;

    // Projects State
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Modals State
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [isDeleteFiles, setIsDeleteFiles] = useState(false);
    const [isUpdatingProject, setIsUpdatingProject] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCliModalOpen, setIsCliModalOpen] = useState(false);
    const [cliPromptText, setCliPromptText] = useState('');

    // Dev Server States
    const [runningServers, setRunningServers] = useState<Record<string, RunningServerInfo>>({});
    const [isServerLogsModalOpen, setIsServerLogsModalOpen] = useState(false);
    const [serverLogsProject, setServerLogsProject] = useState<ProjectData | null>(null);
    const [serverLogsContent, setServerLogsContent] = useState('');
    const [isFetchingLogs, setIsFetchingLogs] = useState(false);

    // Progress State
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    const projectFormRef = useRef<NewProjectRef>(null);
    const projectSettingsRef = useRef<any>(null);

    const fetchRunningServers = useCallback(async () => {
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_all_running_project_servers) {
                const res = await api.get_all_running_project_servers();
                if (res && typeof res === 'object') {
                    setRunningServers(res);
                }
            }
        } catch {
            // best-effort
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
            await fetchRunningServers();
        } catch (e) {
            console.error(e);
            showToast(tRef.current('projects.fetch_projects_error', 'Failed to fetch projects'), 'error');
        } finally {
            setIsFetchingProjects(false);
        }
    }, [showToast, fetchRunningServers]);

    const fetchProjectsRef = useRef(fetchProjects);
    fetchProjectsRef.current = fetchProjects;

    // Listen to project_list_updated event
    useEffect(() => {
        fetchProjectsRef.current();
        const handleProjectListUpdated = () => { fetchProjectsRef.current(); };
        window.addEventListener('project_list_updated', handleProjectListUpdated);
        return () => window.removeEventListener('project_list_updated', handleProjectListUpdated);
    }, []);

    // Listen to progress and CLI prompts for ProjectManager
    useEffect(() => {
        const handleProg = (e: any) => {
            if (e.detail?.source && e.detail.source !== 'ProjectManager') return;
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
                if (pct > 0 && pct < 100) {
                    setIsCreatingProject(true);
                }
                if (pct >= 100 || pct === 0) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => {
                        setProgress(0);
                        setIsCreatingProject(false);
                        setIsCliModalOpen(false);
                    }, 3000);
                }
            }
        };

        const handleCliState = (e: any) => {
            if (!e.detail) return;
            const isWaiting = Boolean(e.detail.waiting_input);
            setIsCliModalOpen(isWaiting);
            setCliPromptText(e.detail.prompt || '');
        };

        window.addEventListener('vylo_progress', handleProg);
        window.addEventListener('vylo_cli_state', handleCliState);
        return () => {
            window.removeEventListener('vylo_progress', handleProg);
            window.removeEventListener('vylo_cli_state', handleCliState);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    }, []);

    // Listen to real-time project server state changes from Python
    useEffect(() => {
        const handleServerChange = (e: any) => {
            const detail = e.detail;
            if (detail?.project_id) {
                setRunningServers(prev => {
                    if (detail.status === 'running') {
                        return {
                            ...prev,
                            [detail.project_id]: {
                                running: true,
                                port: detail.port,
                                pid: detail.pid,
                                starting: false,
                            }
                        };
                    } else if (detail.status === 'stopped') {
                        const copy = { ...prev };
                        delete copy[detail.project_id];
                        return copy;
                    }
                    return prev;
                });
            }
        };

        window.addEventListener('vylo_project_server_changed', handleServerChange as EventListener);
        return () => {
            window.removeEventListener('vylo_project_server_changed', handleServerChange as EventListener);
        };
    }, []);

    const handleStartServer = useCallback(async (projectId: string) => {
        setRunningServers(prev => ({
            ...prev,
            [projectId]: { ...prev[projectId], running: false, starting: true }
        }));
        try {
            const api = (window as any).pywebview?.api;
            if (api?.start_project_server) {
                const res = await api.start_project_server(projectId);
                if (res?.status === 'success' || res?.status === 'info') {
                    showToast(tRef.current(res.message || 'backend.project.server_started', res.args || {}) as string, res.status === 'info' ? 'info' : 'success');
                    if (res.pid) {
                        setRunningServers(prev => ({
                            ...prev,
                            [projectId]: { running: true, port: res.port, pid: res.pid, starting: false }
                        }));
                    }
                } else if (res?.status === 'error') {
                    showToast(tRef.current(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
                    setRunningServers(prev => {
                        const copy = { ...prev };
                        delete copy[projectId];
                        return copy;
                    });
                }
            }
        } catch (err: any) {
            showToast(tRef.current('backend.error.unexpected', { e: err.message }) as string, 'error');
            setRunningServers(prev => {
                const copy = { ...prev };
                delete copy[projectId];
                return copy;
            });
        }
    }, [showToast]);

    const handleStopServer = useCallback(async (projectId: string) => {
        try {
            const api = (window as any).pywebview?.api;
            if (api?.stop_project_server) {
                const res = await api.stop_project_server(projectId);
                if (res?.status === 'success' || res?.status === 'info') {
                    showToast(tRef.current(res.message || 'backend.project.server_stopped', res.args || {}) as string, 'info');
                    setRunningServers(prev => {
                        const copy = { ...prev };
                        delete copy[projectId];
                        return copy;
                    });
                } else if (res?.status === 'error') {
                    showToast(tRef.current(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
                }
            }
        } catch (err: any) {
            showToast(tRef.current('backend.error.unexpected', { e: err.message }) as string, 'error');
        }
    }, [showToast]);

    const handleOpenBrowser = useCallback(async (domain: string) => {
        const url = `https://${domain}`;
        try {
            const project = projects.find(p => p.domain === domain);
            if (project && project.project_type && project.project_type !== 'php') {
                const serverStatus = runningServers[project.id];
                if (!serverStatus?.running) {
                    showToast(tRef.current('projects.auto_starting_server') as string, 'info');
                    await handleStartServer(project.id);
                    await new Promise(res => setTimeout(res, 800));
                }
            }

            if (window.pywebview?.api?.open_browser) {
                window.pywebview.api.open_browser(url);
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            console.error(e);
            window.open(url, '_blank');
        }
    }, [projects, runningServers, handleStartServer, showToast]);

    const handleViewServerLogs = useCallback(async (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        setServerLogsProject(project);
        setIsServerLogsModalOpen(true);
        setIsFetchingLogs(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_project_server_logs) {
                const res = await api.get_project_server_logs(projectId);
                if (res?.status === 'success') {
                    setServerLogsContent(res.logs || '');
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingLogs(false);
        }
    }, [projects]);

    const refreshServerLogs = useCallback(async () => {
        if (!serverLogsProject) return;
        setIsFetchingLogs(true);
        try {
            const api = (window as any).pywebview?.api;
            if (api?.get_project_server_logs) {
                const res = await api.get_project_server_logs(serverLogsProject.id);
                if (res?.status === 'success') {
                    setServerLogsContent(res.logs || '');
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingLogs(false);
        }
    }, [serverLogsProject]);

    const closeServerLogsModal = useCallback(() => {
        setIsServerLogsModalOpen(false);
        setServerLogsProject(null);
        setServerLogsContent('');
    }, []);

    const handleOpenDocumentRoot = useCallback(async (path: string) => {
        try {
            window.pywebview?.api?.open_in_explorer(path);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleCreateSubmit = useCallback(async () => {
        if (!projectFormRef.current) return;
        setIsCreatingProject(true);
        setIsCliModalOpen(false);
        setCliPromptText('');
        if (await projectFormRef.current.submit()) {
            setIsNewProjectModalOpen(false);
            fetchProjects();
        }
        setIsCliModalOpen(false);
        setCliPromptText('');
        setIsCreatingProject(false);
    }, [fetchProjects]);

    const confirmCancelProjectInstall = useCallback(async () => {
        const isConfirmed = await confirm({
            title: tRef.current('apache.cli_cancel_confirm_title'),
            message: tRef.current('apache.cli_cancel_confirm_desc'),
            type: 'danger',
            confirmText: tRef.current('apache.cli_cancel_confirm_yes'),
        });
        if (!isConfirmed) return;
        setIsCliModalOpen(false);
        setCliPromptText('');
        try {
            const api = window.pywebview?.api as any;
            await api?.cancel_project_install?.();
        } catch (e) {
            console.error(e);
        }
    }, [confirm]);

    const handleUpdateProjectSubmit = useCallback(async () => {
        if (!projectSettingsRef.current) return;
        setIsUpdatingProject(true);
        if (await projectSettingsRef.current.submit()) {
            setIsProjectSettingsOpen(false);
            fetchProjects();
        }
        setIsUpdatingProject(false);
    }, [fetchProjects]);

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
        if (isCreatingProject) setIsNewProjectModalOpen(true);
    }, [isCreatingProject]);

    const value = useMemo<ProjectContextValue>(() => ({
        projects,
        isFetchingProjects,
        selectedProjectId,
        selectedProject,
        isCreatingProject,
        isUpdatingProject,
        isDeletingProject,
        isDeleteFiles,
        setIsDeleteFiles,
        isNewProjectModalOpen,
        isProjectSettingsOpen,
        isDeleteConfirmOpen,
        isCliModalOpen,
        cliPromptText,
        progress,
        progressText,
        openNewProjectModal,
        closeNewProjectModal,
        openProjectSettingsModal,
        closeProjectSettingsModal,
        openDeleteConfirmModal,
        closeDeleteConfirmModal,
        restoreProgressWidget,
        projectFormRef,
        projectSettingsRef,
        fetchProjects,
        handleCreateSubmit,
        handleUpdateProjectSubmit,
        handleDeleteProjectSubmit,
        handleSyncHost,
        handleOpenBrowser,
        handleOpenDocumentRoot,
        confirmCancelProjectInstall,
        runningServers,
        isServerLogsModalOpen,
        serverLogsProject,
        serverLogsContent,
        isFetchingLogs,
        handleStartServer,
        handleStopServer,
        handleViewServerLogs,
        refreshServerLogs,
        closeServerLogsModal,
    }), [
        projects,
        isFetchingProjects,
        selectedProjectId,
        selectedProject,
        isCreatingProject,
        isUpdatingProject,
        isDeletingProject,
        isDeleteFiles,
        isNewProjectModalOpen,
        isProjectSettingsOpen,
        isDeleteConfirmOpen,
        isCliModalOpen,
        cliPromptText,
        progress,
        progressText,
        openNewProjectModal,
        closeNewProjectModal,
        openProjectSettingsModal,
        closeProjectSettingsModal,
        openDeleteConfirmModal,
        closeDeleteConfirmModal,
        restoreProgressWidget,
        fetchProjects,
        handleCreateSubmit,
        handleUpdateProjectSubmit,
        handleDeleteProjectSubmit,
        handleSyncHost,
        handleOpenBrowser,
        handleOpenDocumentRoot,
        confirmCancelProjectInstall,
        runningServers,
        isServerLogsModalOpen,
        serverLogsProject,
        serverLogsContent,
        isFetchingLogs,
        handleStartServer,
        handleStopServer,
        handleViewServerLogs,
        refreshServerLogs,
        closeServerLogsModal,
    ]);

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
    const ctx = useContext(ProjectContext);
    if (!ctx) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return ctx;
}
