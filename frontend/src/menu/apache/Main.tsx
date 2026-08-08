import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';

// ---> IMPORT UI KIT COMPONENTS <---
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import ApacheSettings from './Settings';
import NewApacheProject, { type NewProjectRef } from './NewProject';
import ProjectSettings from './ProjectSettings';
import ApacheInstallWizard, { type ApacheVersionData } from './InstallWizard';

export interface ProjectData {
    id: string; name: string; domain: string; path: string;
    php_version: string; php_port: number; framework?: string; host_synced?: boolean;
}

export default function ApacheMain() {
    const { showToast } = useToast();

    // State Global & Instalasi
    const [isFetchingApacheStatus, setIsFetchingApacheStatus] = useState(true);
    const [isApacheInstalled, setIsApacheInstalled] = useState(false);
    const [installedApacheVersion, setInstalledApacheVersion] = useState<string | null>(null);
    const [apachePath, setApachePath] = useState<string>('Not Installed');
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
                else showToast(res.message, 'error');
            }
        } catch (e) { showToast("Gagal memuat daftar proyek.", "error"); }
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
                showToast(res.message || "Proyek dihapus", "success");
                fetchProjects(); setIsDeleteConfirmOpen(false);
            } else showToast(res?.message, "error");
        } catch (e) { showToast("Terjadi kesalahan saat menghapus.", "error"); }
        finally { setIsDeletingProject(false); setIsDeleteFiles(false); }
    };

    const handleSyncHost = async (projectId: string) => {
        try {
            const res = await window.pywebview?.api?.retry_sync_host(projectId);
            showToast(res?.message, res?.status === 'success' ? "success" : "error");
            if (res?.status === 'success') fetchProjects();
        } catch (e) { showToast("Gagal sinkronisasi.", "error"); }
    };

    const handleOpenDocumentRoot = async (path: string) => {
        try { window.pywebview?.api?.open_in_explorer(path); } catch (e) { }
    };

    useEffect(() => {
        const handleStatus = (e: any) => { if (e.detail.service === 'apache') setIsApacheRunning(e.detail.running); };
        const handleProg = (e: any) => {
            if (e.detail) {
                setProgress(e.detail.percent); setProgressText(e.detail.text || '');
                if (e.detail.percent >= 100 || e.detail.percent === 0) setTimeout(() => { setProgress(0); setIsCreatingProject(false); }, 3000);
            }
        };
        window.addEventListener('service_status_changed', handleStatus);
        window.addEventListener('vylo_progress', handleProg);
        return () => {
            window.removeEventListener('service_status_changed', handleStatus);
            window.removeEventListener('vylo_progress', handleProg);
        };
    }, []);

    const fetchApacheStatus = async () => {
        setIsFetchingApacheStatus(true);
        try {
            const res = await window.pywebview?.api?.get_apache_status();
            if (res?.status === 'success') {
                setIsApacheInstalled(res.installed);
                setApachePath(res.path || 'Not Installed');
                setIsApacheRunning(res.running || false);
            }
            const ver = await window.pywebview?.api?.get_apache_installed_versions();
            if (ver?.status === 'success') setInstalledApacheVersion(ver.active || ver.data[0]);
        } catch (e) { }
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
                showToast(res.message, 'success'); setIsApacheRunning(!isApacheRunning);
            } else showToast(res?.message, 'error');
        } catch (e) { showToast("Gagal merubah status", "error"); }
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
            } else showToast(res?.message, 'error');
        } catch (e) { showToast("Gagal mengambil versi online.", "error"); }
        finally { setIsFetchingVersions(false); }
    };

    const handleOpenInstallModal = () => {
        setIsInstallServerOpen(true);
        if (availableVersions.length === 0) fetchAvailableVersions();
    };

    const handleInstallApache = async () => {
        if (!installVersion || !installUrl) return;
        setIsInstalling(true); setProgress(0); setProgressText("Memulai instalasi...");
        try {
            const res = await window.pywebview?.api?.install_apache(installVersion, installUrl, httpPort, httpsPort);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsInstallServerOpen(false); fetchApacheStatus(); }
        } catch (e) { showToast("Kesalahan sistem", "error"); }
        finally { setIsInstalling(false); }
    };

    const handleUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview?.api?.uninstall_apache();
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsUninstallServerOpen(false); fetchApacheStatus(); }
        } catch (e) { showToast("Gagal uninstall", "error"); }
        finally { setIsUninstalling(false); }
    };

    return (
        <>
            <div className="flex flex-col w-full">
                {/* ---> PENGGUNAAN KOMPONEN PAGE HEADER <--- */}
                <PageHeader
                    icon="dns"
                    title="Apache Web Server"
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {isApacheInstalled ? '1 Server Instance Installed' : 'Not Installed'} • {projects.length} Virtual Hosts
                        </>
                    }
                    actions={
                        <button onClick={handleOpenInstallModal} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">download</span> Install / Update Server
                        </button>
                    }
                />

                {isFetchingApacheStatus ? (
                    <div className="mb-8"><SkeletonCard /></div>
                ) : isApacheInstalled ? (
                    <div className="mb-8">
                        <Card
                            title={`Apache ${installedApacheVersion || 'Unknown'} (Win64)`}
                            status={isApacheRunning ? 'running' : 'stopped'}
                            gridCols="grid-cols-2 md:grid-cols-3"
                            dropdownActions={
                                <>
                                    <button onClick={() => window.pywebview?.api?.open_apache_config()} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open httpd.conf</button>
                                    <button onClick={() => window.pywebview?.api?.open_apache_directory()} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Directory</button>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                    <button onClick={() => setIsUninstallServerOpen(true)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Uninstall Server</button>
                                </>
                            }
                            footerActions={
                                <>
                                    <button onClick={handleToggleServer} disabled={isTogglingServer} className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:scale-100 ${isApacheRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                        {isTogglingServer ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {isApacheRunning ? 'Stopping...' : 'Starting...'}</> : <><span className="material-symbols-outlined text-[18px]">{isApacheRunning ? 'stop' : 'play_arrow'}</span> {isApacheRunning ? 'Stop Server' : 'Start Server'}</>}
                                    </button>
                                    <button onClick={() => setIsOptionsOpen(true)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                    </button>
                                </>
                            }
                        >
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Listening Port</span>
                                <span className="font-mono text-sm text-primary dark:text-blue-400">80, 443</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Architecture</span>
                                <span className="font-mono text-sm text-slate-900 dark:text-slate-200">x64 (VS17/VS18)</span>
                            </div>
                            <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Server Path</span>
                                <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={apachePath}>{apachePath}</span>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <div className="mb-8"><EmptyState icon="dns" title="Apache is not installed" description="Install Apache Web Server to start serving your projects." actionText="Install now" onAction={handleOpenInstallModal} /></div>
                )}

                <hr className="border-slate-200 dark:border-slate-800 mb-6" />

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Virtual Hosts (Projects)</h3>
                    <button onClick={() => setIsNewProjectModalOpen(true)} disabled={!isApacheInstalled} className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">add</span> <span className="hidden sm:inline">Add Project</span>
                    </button>
                </div>

                {isFetchingProjects ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {[1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)}
                    </div>
                ) : projects.length === 0 ? (
                    <EmptyState icon="folder_open" title="No projects found" description="Click 'Add Project' to create your first virtual host." />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {projects.map(project => (
                            <Card key={project.id} title={project.name || 'Untitled Project'} gridCols="grid-cols-1"
                                dropdownActions={
                                    <>
                                        <button onClick={() => handleOpenDocumentRoot(project.path)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Document Root</button>
                                        <button onClick={() => { setSelectedProjectId(project.id); setIsProjectSettingsOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Vhost Settings</button>
                                        {project.host_synced === false && (
                                            <button onClick={() => handleSyncHost(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Retry Host Sync</button>
                                        )}
                                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                        <button onClick={() => { setSelectedProjectId(project.id); setIsDeleteFiles(false); setIsDeleteConfirmOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Project</button>
                                    </>
                                }
                                footerActions={
                                    <>
                                        <button onClick={() => handleOpenBrowser(project.domain)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                            <span className="material-symbols-outlined text-[18px]">open_in_browser</span> Open in Browser
                                        </button>
                                        <button onClick={() => { setSelectedProjectId(project.id); setIsProjectSettingsOpen(true); }} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                            <span className="material-symbols-outlined text-[18px]">settings</span> Setup
                                        </button>
                                    </>
                                }
                            >
                                <div className="flex flex-col w-full gap-4">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-3 w-full">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Framework</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-200 capitalize">{project.framework || 'Unknown'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">PHP Engine</span>
                                            <span className="text-sm font-medium text-primary dark:text-blue-400 font-mono">{project.php_version || 'Unknown'} <span className="text-slate-400 text-xs">(Port {project.php_port || 'N/A'})</span></span>
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Local Domain</span>
                                            <button onClick={() => handleOpenBrowser(project.domain)} className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit truncate outline-none">
                                                {project.domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                            </button>
                                        </div>
                                    </div>
                                    {project.host_synced === false && (
                                        <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-1">
                                            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg flex gap-3 items-start animate-in fade-in">
                                                <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-[20px] shrink-0">admin_panel_settings</span>
                                                <div className="flex flex-col gap-1.5 w-full">
                                                    <span className="text-sm font-semibold text-red-800 dark:text-red-500">Local Domain Not Routed</span>
                                                    <span className="text-xs text-red-700 dark:text-red-400/80 leading-relaxed">VyloServe needs Administrator privileges to write this domain to the Windows Hosts file.</span>
                                                    <button onClick={() => handleSyncHost(project.id)} className="mt-1 self-start text-xs font-medium text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/50 hover:bg-red-300 dark:hover:bg-red-700/60 px-3 py-1.5 rounded-md flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">sync</span> Retry Sync</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ---> WIDGETS & MODALS <--- */}
            <BackgroundProgressWidget isOpen={(isCreatingProject && !isNewProjectModalOpen) || (isInstalling && !isInstallServerOpen)} progress={progress} progressText={progressText} title={isInstalling ? "Installing Apache..." : "Installing Project..."} onRestore={() => { if (isInstalling) setIsInstallServerOpen(true); if (isCreatingProject) setIsNewProjectModalOpen(true); }} />

            <Modal isOpen={isInstallServerOpen} onClose={() => setIsInstallServerOpen(false)} title="Install Apache Server" icon="download" onApply={handleInstallApache} applyText={isInstalling ? "Installing..." : "Download & Install"} isApplyDisabled={isFetchingVersions || isInstalling || availableVersions.length === 0}>
                <ApacheInstallWizard versions={availableVersions} version={installVersion} setVersion={setInstallVersion} setUrl={setInstallUrl} httpPort={httpPort} setHttpPort={setHttpPort} httpsPort={httpsPort} setHttpsPort={setHttpsPort} isInstalling={isInstalling} isFetchingVersions={isFetchingVersions} progress={progress} progressText={progressText} />
            </Modal>

            <Modal isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} title="Global Apache Config" icon="tune" onApply={() => setIsOptionsOpen(false)}><ApacheSettings /></Modal>
            <Modal isOpen={isNewProjectModalOpen} onClose={() => setIsNewProjectModalOpen(false)} title="Create New Project" icon="add_box" onApply={handleCreateSubmit} applyText={isCreatingProject ? "Installing..." : "Create Project"} isApplyDisabled={isCreatingProject}><NewApacheProject ref={projectFormRef} isCreatingExternal={isCreatingProject} /></Modal>
            <Modal isOpen={isProjectSettingsOpen} onClose={() => !isUpdatingProject && setIsProjectSettingsOpen(false)} title={`Vhost Settings: ${selectedProject?.name}`} icon="settings" onApply={handleUpdateProjectSubmit} applyText={isUpdatingProject ? "Saving..." : "Save Changes"} isApplyDisabled={isUpdatingProject} isLoading={isUpdatingProject}>{selectedProject && <ProjectSettings project={selectedProject as any} ref={projectSettingsRef} />}</Modal>

            <Modal isOpen={isUninstallServerOpen} onClose={() => !isUninstalling && setIsUninstallServerOpen(false)} title="Uninstall Apache" icon="warning" onApply={handleUninstall} applyText={isUninstalling ? "Uninstalling..." : "Yes, Uninstall"} isApplyDisabled={isUninstalling} isDestructive={true} isLoading={isUninstalling}>
                <p className="text-slate-700 dark:text-slate-300">Are you sure you want to uninstall <strong className="text-slate-900 dark:text-white">Apache Web Server</strong>?</p>
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => !isDeletingProject && setIsDeleteConfirmOpen(false)} title="Delete Virtual Host" icon="delete" onApply={handleDeleteProjectSubmit} applyText={isDeletingProject ? "Deleting..." : "Delete Project"} isApplyDisabled={isDeletingProject} isDestructive={true} isLoading={isDeletingProject}>
                <p className="text-slate-700 dark:text-slate-300 mb-2">Delete <strong className="text-slate-900 dark:text-white">{selectedProject?.domain}</strong>?</p>
                <label className="flex items-start gap-2 cursor-pointer bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                    <input type="checkbox" checked={isDeleteFiles} onChange={(e) => setIsDeleteFiles(e.target.checked)} className="mt-0.5" />
                    <div className="flex flex-col"><span className="text-sm font-semibold text-red-800 dark:text-red-400">Delete all project files</span><span className="text-xs text-red-600/80 dark:text-red-400/80">Permanent action.</span></div>
                </label>
            </Modal>
        </>
    );
}