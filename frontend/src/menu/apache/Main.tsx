import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';

// ---> IMPORT UI KIT COMPONENTS <---
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { clampPercent } from '../../utils/progress';

import ApacheSettings from './Settings';
import NewApacheProject, { type NewProjectRef } from './NewProject';
import ProjectSettings from './ProjectSettings';
import ApacheInstallWizard, { type ApacheVersionData } from './InstallWizard';

export interface ProjectData {
    id: string; name: string; domain: string; path: string;
    php_version: string; php_port: number; framework?: string; host_synced?: boolean;
}

interface ApacheStatusSectionProps {
    readonly isFetching: boolean;
    readonly isInstalled: boolean;
    readonly installedVersion: string | null;
    readonly isRunning: boolean;
    readonly isToggling: boolean;
    readonly apachePath: string;
    readonly onToggleServer: () => void;
    readonly onOpenOptions: () => void;
    readonly onOpenConfig: () => void;
    readonly onOpenDirectory: () => void;
    readonly onUninstallClick: () => void;
    readonly onInstallClick: () => void;
    readonly t: any;
}

function ApacheStatusSection({ isFetching, isInstalled, installedVersion, isRunning, isToggling, apachePath, onToggleServer, onOpenOptions, onOpenConfig, onOpenDirectory, onUninstallClick, onInstallClick, t }: ApacheStatusSectionProps) {
    if (isFetching) {
        return <div className="mb-8"><SkeletonCard /></div>;
    }
    if (!isInstalled) {
        return <div className="mb-8"><EmptyState icon="dns" title={t('apache.not_installed_title')} description={t('apache.not_installed_desc')} actionText={t('apache.install_now')} onAction={onInstallClick} /></div>;
    }
    return (
        <div className="mb-8">
            <Card
                title={`Apache ${installedVersion || t('common.unknown')} (Win64)`}
                status={isRunning ? 'running' : 'stopped'}
                gridCols="grid-cols-2 md:grid-cols-3"
                dropdownActions={
                    <>
                        <button type="button" onClick={onOpenConfig} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('apache.open_httpd_conf')}</button>
                        <button type="button" onClick={onOpenDirectory} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('apache.open_directory')}</button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        <button type="button" onClick={onUninstallClick} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">{t('apache.uninstall_server')}</button>
                    </>
                }
                footerActions={
                    <>
                        <button type="button" onClick={onToggleServer} disabled={isToggling} className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:scale-100 ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                            {isToggling ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {isRunning ? t('apache.stopping') : t('apache.starting')}</> : <><span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span> {isRunning ? t('apache.stop_server') : t('apache.start_server')}</>}
                        </button>
                        <button type="button" onClick={onOpenOptions} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">tune</span> {t('apache.config')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.listening_port')}</span>
                    <span className="font-mono text-sm text-primary dark:text-blue-400">80, 443</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.architecture')}</span>
                    <span className="font-mono text-sm text-slate-900 dark:text-slate-200">x64 (VS17/VS18)</span>
                </div>
                <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.server_path')}</span>
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={apachePath}>{apachePath}</span>
                </div>
            </Card>
        </div>
    );
}

interface ApacheProjectCardProps {
    readonly project: ProjectData;
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
    readonly t: any;
}

function ApacheProjectCard({ project, onOpenDocumentRoot, onOpenSettings, onSyncHost, onDeleteClick, onOpenBrowser, t }: ApacheProjectCardProps) {
    return (
        <Card title={project.name || t('apache.untitled_project')} gridCols="grid-cols-1"
            dropdownActions={
                <>
                    <button type="button" onClick={() => onOpenDocumentRoot(project.path)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('apache.open_document_root')}</button>
                    <button type="button" onClick={() => onOpenSettings(project.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('apache.vhost_settings')}</button>
                    {project.host_synced === false && (
                        <button type="button" onClick={() => onSyncHost(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">{t('apache.retry_host_sync')}</button>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                    <button type="button" onClick={() => onDeleteClick(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">{t('apache.delete_project')}</button>
                </>
            }
            footerActions={
                <>
                    <button type="button" onClick={() => onOpenBrowser(project.domain)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">open_in_browser</span> {t('apache.open_in_browser')}
                    </button>
                    <button type="button" onClick={() => onOpenSettings(project.id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">settings</span> {t('apache.setup')}
                    </button>
                </>
            }
        >
            <div className="flex flex-col w-full gap-4">
                <div className="grid grid-cols-2 gap-y-4 gap-x-3 w-full">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.framework')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200 capitalize">{project.framework || t('common.unknown')}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.php_engine')}</span>
                        <span className="text-sm font-medium text-primary dark:text-blue-400 font-mono">{project.php_version || t('common.unknown')} <span className="text-slate-400 text-xs">(Port {project.php_port || t('common.not_available')})</span></span>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.local_domain')}</span>
                        <button type="button" onClick={() => onOpenBrowser(project.domain)} className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit truncate outline-none">
                            {project.domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </button>
                    </div>
                </div>
                {project.host_synced === false && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-1">
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg flex gap-3 items-start animate-in fade-in">
                            <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-[20px] shrink-0">admin_panel_settings</span>
                            <div className="flex flex-col gap-1.5 w-full">
                                <span className="text-sm font-semibold text-red-800 dark:text-red-500">{t('apache.domain_not_routed')}</span>
                                <span className="text-xs text-red-700 dark:text-red-400/80 leading-relaxed">{t('apache.domain_not_routed_desc')}</span>
                                <button type="button" onClick={() => onSyncHost(project.id)} className="mt-1 self-start text-xs font-medium text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/50 hover:bg-red-300 dark:hover:bg-red-700/60 px-3 py-1.5 rounded-md flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">sync</span> {t('apache.retry_sync')}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

interface ApacheProjectsSectionProps {
    readonly isFetching: boolean;
    readonly projects: ProjectData[];
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
    readonly t: any;
}

function ApacheProjectsSection({ isFetching, projects, onOpenDocumentRoot, onOpenSettings, onSyncHost, onDeleteClick, onOpenBrowser, t }: ApacheProjectsSectionProps) {
    if (isFetching) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                {[1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)}
            </div>
        );
    }
    if (projects.length === 0) {
        return <EmptyState icon="folder_open" title={t('apache.no_projects_found')} description={t('apache.no_projects_desc')} />;
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
            {projects.map(project => (
                <ApacheProjectCard
                    key={project.id}
                    project={project}
                    onOpenDocumentRoot={onOpenDocumentRoot}
                    onOpenSettings={onOpenSettings}
                    onSyncHost={onSyncHost}
                    onDeleteClick={onDeleteClick}
                    onOpenBrowser={onOpenBrowser}
                    t={t}
                />
            ))}
        </div>
    );
}

export default function ApacheMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // State Global & Instalasi
    const [isFetchingApacheStatus, setIsFetchingApacheStatus] = useState(true);
    const [isApacheInstalled, setIsApacheInstalled] = useState(false);
    const [installedApacheVersion, setInstalledApacheVersion] = useState<string | null>(null);
    const [apachePath, setApachePath] = useState<string>(t('apache.not_installed'));
    const [isApacheRunning, setIsApacheRunning] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [isTogglingServer, setIsTogglingServer] = useState(false);

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
    const [isUninstallServerOpen, setIsUninstallServerOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [isDeleteFiles, setIsDeleteFiles] = useState(false);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isUpdatingProject, setIsUpdatingProject] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const projectFormRef = useRef<NewProjectRef>(null);
    const projectSettingsRef = useRef<any>(null);

    const handleOpenBrowser = async (domain: string) => {
        const url = `https://${domain}`;
        try {
            if (window.pywebview?.api?.open_browser) window.pywebview.api.open_browser(url);
            else window.open(url, '_blank');
        } catch (e) { console.error(e); }
    };

    const fetchProjects = async () => {
        setIsFetchingProjects(true);
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') setProjects(res.data || []);
                else showToast(t(res.message) as string, 'error');
            }
        } catch (e) { console.error(e); showToast(t('apache.fetch_projects_error'), "error"); }
        finally { setIsFetchingProjects(false); }
    };

    useEffect(() => {
        fetchProjects();
        window.addEventListener('project_list_updated', fetchProjects);
        return () => window.removeEventListener('project_list_updated', fetchProjects);
    }, []);

    const handleCreateSubmit = async () => {
        if (!projectFormRef.current) return;
        setIsCreatingProject(true);
        if (await projectFormRef.current.submit()) setIsNewProjectModalOpen(false);
        setIsCreatingProject(false);
    };

    const handleUpdateProjectSubmit = async () => {
        if (!projectSettingsRef.current) return;
        setIsUpdatingProject(true);
        if (await projectSettingsRef.current.submit()) setIsProjectSettingsOpen(false);
        setIsUpdatingProject(false);
    };

    const handleDeleteProjectSubmit = async () => {
        if (!selectedProjectId) return;
        setIsDeletingProject(true);
        try {
            const res = await window.pywebview?.api?.delete_project(selectedProjectId, isDeleteFiles);
            if (res?.status === 'success') {
                showToast((res.message ? t(res.message, res.args || {}) : t('apache.project_deleted')) as string, "success");
                fetchProjects(); setIsDeleteConfirmOpen(false);
            } else showToast(t(res?.message || '', res?.args || {}) as string, "error");
        } catch (e) { console.error(e); showToast(t('apache.delete_error'), "error"); }
        finally { setIsDeletingProject(false); setIsDeleteFiles(false); }
    };

    const handleSyncHost = async (projectId: string) => {
        try {
            const res = await window.pywebview?.api?.retry_sync_host(projectId);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? "success" : "error");
            if (res?.status === 'success') fetchProjects();
        } catch (e) { console.error(e); showToast(t('apache.sync_error'), "error"); }
    };

    const handleOpenDocumentRoot = async (path: string) => {
        try { window.pywebview?.api?.open_in_explorer(path); } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const handleStatus = (e: any) => {
            const service = e.detail?.service;
            if (service !== 'apache' && service !== 'all') return;
            if (typeof e.detail.running === 'boolean') setIsApacheRunning(e.detail.running);
            else fetchApacheStatus();
        };
        const handleProg = (e: any) => {
            // Halaman ini menampilkan progress utk 2 sumber: instalasi Apache sendiri (ApacheManager)
            // dan pembuatan project baru (ProjectManager). Filter sumber lain agar tidak "bocor"
            // dari modul lain yang kebetulan mounted bersamaan (lihat docs/known_bugs.md #7).
            if (e.detail?.source && !['ApacheManager', 'ProjectManager'].includes(e.detail.source)) return;
            if (e.detail) {
                const text = e.detail.text || '';
                const args = e.detail.args || {};
                const pct = clampPercent(e.detail.percent);
                setProgress(pct);
                setProgressText(t(text, args) as string);

                // Batalkan timer auto-hide sebelumnya setiap ada event baru -- mencegah timer basi
                // dari event 100%/0% mid-flow (bukan akhir proses sebenarnya) menyembunyikan widget
                // saat instalasi/pembuatan project masih berjalan. Lihat docs/known_bugs.md.
                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }
                if (pct >= 100 || pct === 0) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => { setProgress(0); setIsCreatingProject(false); }, 3000);
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
    }, [t]);

    const fetchApacheStatus = async () => {
        setIsFetchingApacheStatus(true);
        try {
            const res = await window.pywebview?.api?.get_apache_status();
            if (res?.status === 'success') {
                setIsApacheInstalled(res.installed);
                setApachePath(res.path || t('apache.not_installed'));
                setIsApacheRunning(res.running || false);
            }
            const ver = await window.pywebview?.api?.get_apache_installed_versions();
            if (ver?.status === 'success') setInstalledApacheVersion(ver.active || ver.data[0]);
        } catch (e) { console.error(e); }
        finally { setIsFetchingApacheStatus(false); }
    };

    useEffect(() => {
        fetchApacheStatus();
        window.addEventListener('apache_version_changed', fetchApacheStatus);
        return () => window.removeEventListener('apache_version_changed', fetchApacheStatus);
    }, []);

    const handleToggleServer = async () => {
        setIsTogglingServer(true);
        try {
            const api = window.pywebview?.api;
            const res = isApacheRunning ? await api?.stop_apache_server() : await api?.start_apache_server();
            if (res?.status === 'success') {
                showToast(t(res.message || '', res.args || {}) as string, 'success');
                setIsApacheRunning(!isApacheRunning);
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'apache', running: !isApacheRunning } }));
            } else showToast(t(res?.message || '', res?.args || {}) as string, 'error');
        } catch (e) { console.error(e); showToast(t('apache.toggle_error'), "error"); }
        finally { setIsTogglingServer(false); }
    };

    const fetchAvailableVersions = async () => {
        setIsFetchingVersions(true);
        try {
            const res = await window.pywebview?.api?.get_available_apache();
            if (res?.status === 'success') {
                const filtered = res.data.filter((v: ApacheVersionData) => v.version !== installedApacheVersion);
                setAvailableVersions(filtered);
                if (filtered.length > 0) {
                    setInstallVersion(filtered[0].version); setInstallUrl(filtered[0].url);
                }
            } else showToast(t(res?.message || '', res?.args || {}) as string, 'error');
        } catch (e) { console.error(e); showToast(t('apache.fetch_versions_error'), "error"); }
        finally { setIsFetchingVersions(false); }
    };

    const handleOpenInstallModal = () => {
        setIsInstallServerOpen(true);
        if (availableVersions.length === 0) fetchAvailableVersions();
    };

    const handleInstallApache = async () => {
        if (!installVersion || !installUrl) return;
        setIsInstalling(true); setProgress(0); setProgressText(t('apache.installing_start'));
        try {
            const res = await window.pywebview?.api?.install_apache(installVersion, installUrl, httpPort);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsInstallServerOpen(false); fetchApacheStatus(); }
        } catch (e) { console.error(e); showToast(t('apache.system_error'), "error"); }
        finally { setIsInstalling(false); }
    };

    const handleUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview?.api?.uninstall_apache();
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsUninstallServerOpen(false); fetchApacheStatus(); }
        } catch (e) { console.error(e); showToast(t('apache.uninstall_error'), "error"); }
        finally { setIsUninstalling(false); }
    };

    return (
        <>
            <div className="flex flex-col w-full">
                {/* ---> PENGGUNAAN KOMPONEN PAGE HEADER <--- */}
                <PageHeader
                    icon="dns"
                    title={t('apache.title')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {isApacheInstalled ? t('apache.installed_instance') : t('apache.not_installed')} • {projects.length} {t('apache.virtual_hosts')}
                        </>
                    }
                    actions={
                        <button type="button" onClick={handleOpenInstallModal} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">download</span> {t('apache.install_update')}
                        </button>
                    }
                />

                <ApacheStatusSection
                    isFetching={isFetchingApacheStatus}
                    isInstalled={isApacheInstalled}
                    installedVersion={installedApacheVersion}
                    isRunning={isApacheRunning}
                    isToggling={isTogglingServer}
                    apachePath={apachePath}
                    onToggleServer={handleToggleServer}
                    onOpenOptions={() => setIsOptionsOpen(true)}
                    onOpenConfig={() => window.pywebview?.api?.open_apache_config()}
                    onOpenDirectory={() => window.pywebview?.api?.open_apache_directory()}
                    onUninstallClick={() => setIsUninstallServerOpen(true)}
                    onInstallClick={handleOpenInstallModal}
                    t={t}
                />

                <hr className="border-slate-200 dark:border-slate-800 mb-6" />

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t('apache.virtual_hosts_title')}</h3>
                    <button type="button" onClick={() => setIsNewProjectModalOpen(true)} disabled={!isApacheInstalled} className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">add</span> <span className="hidden sm:inline">{t('apache.add_project')}</span>
                    </button>
                </div>

                <ApacheProjectsSection
                    isFetching={isFetchingProjects}
                    projects={projects}
                    onOpenDocumentRoot={handleOpenDocumentRoot}
                    onOpenSettings={(id) => { setSelectedProjectId(id); setIsProjectSettingsOpen(true); }}
                    onSyncHost={handleSyncHost}
                    onDeleteClick={(id) => { setSelectedProjectId(id); setIsDeleteFiles(false); setIsDeleteConfirmOpen(true); }}
                    onOpenBrowser={handleOpenBrowser}
                    t={t}
                />
            </div>

            {/* ---> WIDGETS & MODALS <--- */}
            <BackgroundProgressWidget isOpen={(isCreatingProject && !isNewProjectModalOpen) || (isInstalling && !isInstallServerOpen)} progress={progress} progressText={progressText} title={isInstalling ? t('apache.installing_apache') : t('apache.installing_project')} onRestore={() => { if (isInstalling) { setIsInstallServerOpen(true); } if (isCreatingProject) { setIsNewProjectModalOpen(true); } }} />

            <Modal isOpen={isInstallServerOpen} keepMounted={isInstalling} onClose={() => setIsInstallServerOpen(false)} title={t('apache.install_apache_server')} icon="download" onApply={handleInstallApache} applyText={isInstalling ? t('apache.installing_start') : t('apache.download_install')} isApplyDisabled={isFetchingVersions || isInstalling || availableVersions.length === 0}>
                <ApacheInstallWizard versions={availableVersions} version={installVersion} setVersion={setInstallVersion} setUrl={setInstallUrl} httpPort={httpPort} setHttpPort={setHttpPort} httpsPort={httpsPort} setHttpsPort={setHttpsPort} isInstalling={isInstalling} isFetchingVersions={isFetchingVersions} progress={progress} progressText={progressText} />
            </Modal>

            <Modal isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} title={t('apache.global_apache_config')} icon="tune" onApply={() => setIsOptionsOpen(false)}><ApacheSettings /></Modal>
            <Modal isOpen={isNewProjectModalOpen} keepMounted={isCreatingProject} onClose={() => setIsNewProjectModalOpen(false)} title={t('apache.create_new_project')} icon="add_box" onApply={handleCreateSubmit} applyText={isCreatingProject ? t('apache.installing_start') : t('apache.create_project')} isApplyDisabled={isCreatingProject}><NewApacheProject ref={projectFormRef} isCreatingExternal={isCreatingProject} /></Modal>
            <Modal isOpen={isProjectSettingsOpen} onClose={() => !isUpdatingProject && setIsProjectSettingsOpen(false)} title={`${t('apache.vhost_settings_modal')}: ${selectedProject?.name}`} icon="settings" onApply={handleUpdateProjectSubmit} applyText={isUpdatingProject ? t('apache.saving') : t('apache.save_changes')} isApplyDisabled={isUpdatingProject} isLoading={isUpdatingProject}>{selectedProject && <ProjectSettings project={selectedProject as any} ref={projectSettingsRef} />}</Modal>

            <Modal isOpen={isUninstallServerOpen} onClose={() => !isUninstalling && setIsUninstallServerOpen(false)} title={t('apache.uninstall_apache')} icon="warning" onApply={handleUninstall} applyText={isUninstalling ? t('apache.deleting') : t('apache.yes_uninstall')} isApplyDisabled={isUninstalling} isDestructive={true} isLoading={isUninstalling}>
                <p className="text-slate-700 dark:text-slate-300">{t('apache.confirm_uninstall')} <strong className="text-slate-900 dark:text-white">Apache Web Server</strong>?</p>
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => !isDeletingProject && setIsDeleteConfirmOpen(false)} title={t('apache.delete_virtual_host')} icon="delete" onApply={handleDeleteProjectSubmit} applyText={isDeletingProject ? t('apache.deleting') : t('apache.delete_project')} isApplyDisabled={isDeletingProject} isDestructive={true} isLoading={isDeletingProject}>
                <p className="text-slate-700 dark:text-slate-300 mb-2">{t('apache.delete_project')} <strong className="text-slate-900 dark:text-white">{selectedProject?.domain}</strong>?</p>
                <label className="flex items-start gap-2 cursor-pointer bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                    <input type="checkbox" checked={isDeleteFiles} onChange={(e) => setIsDeleteFiles(e.target.checked)} aria-label={t('apache.delete_all_files')} className="mt-0.5" />
                    <div className="flex flex-col"><span className="text-sm font-semibold text-red-800 dark:text-red-400">{t('apache.delete_all_files')}</span><span className="text-xs text-red-600/80 dark:text-red-400/80">{t('apache.permanent_action')}</span></div>
                </label>
            </Modal>
        </>
    );
}