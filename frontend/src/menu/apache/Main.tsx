import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';

import ApacheSettings from './Settings';
import NewApacheProject, { type NewProjectRef } from './NewProject';
import ProjectSettings from './ProjectSettings';
import ApacheInstallWizard, { type ApacheVersionData } from './InstallWizard';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';

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

export default function ApacheMain() {
    const { showToast } = useToast();

    // State untuk Global Apache Control
    const [isApacheInstalled, setIsApacheInstalled] = useState(false);
    const [installedApacheVersion, setInstalledApacheVersion] = useState<string | null>(null);
    const [apachePath, setApachePath] = useState<string>('Not Installed');
    const [isApacheRunning, setIsApacheRunning] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [isTogglingServer, setIsTogglingServer] = useState(false);

    // State Modals Server & Wizard Instalasi
    const [isInstallServerOpen, setIsInstallServerOpen] = useState(false);
    const [availableVersions, setAvailableVersions] = useState<ApacheVersionData[]>([]);
    const [isFetchingVersions, setIsFetchingVersions] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installUrl, setInstallUrl] = useState('');
    const [httpPort, setHttpPort] = useState(80);
    const [httpsPort, setHttpsPort] = useState(443);
    const [isInstalling, setIsInstalling] = useState(false);

    // Progress Lintas Komponen
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    // State Project Management
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(true);

    // State Project Modal lainnya
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isUninstallServerOpen, setIsUninstallServerOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [isDeleteFiles, setIsDeleteFiles] = useState(false); // Checkbox Hapus File
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isUpdatingProject, setIsUpdatingProject] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const projectFormRef = useRef<NewProjectRef>(null);
    const projectSettingsRef = useRef<any>(null);

    const handleOpenBrowser = async (domain: string) => {
        const url = `https://${domain}`;
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.open_browser === 'function') {
                api.open_browser(url);
            } else {
                window.open(url, '_blank'); // Fallback aman
            }
        } catch (error) {
            console.error("Gagal membuka browser", error);
        }
    };

    const fetchProjects = async () => {
        setIsFetchingProjects(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') {
                    setProjects(res.data || []);
                } else {
                    showToast(res.message, 'error');
                }
            }
        } catch (error) {
            showToast("Gagal memuat daftar proyek dari backend.", "error");
        } finally {
            setIsFetchingProjects(false);
        }
    };

    useEffect(() => {
        fetchProjects();
        const handleProjectUpdate = () => fetchProjects();
        window.addEventListener('project_list_updated', handleProjectUpdate);
        return () => window.removeEventListener('project_list_updated', handleProjectUpdate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateSubmit = async () => {
        if (!projectFormRef.current) return;

        setIsCreatingProject(true); // Tandai proses sedang berjalan

        const isSuccess = await projectFormRef.current.submit();

        setIsCreatingProject(false); // Proses selesai
        if (isSuccess) {
            setIsNewProjectModalOpen(false); // Tutup modal secara permanen
        }
    };

    const handleUpdateProjectSubmit = async () => {
        if (!projectSettingsRef.current) return;
        setIsUpdatingProject(true);
        const isSuccess = await projectSettingsRef.current.submit();
        setIsUpdatingProject(false);
        if (isSuccess) {
            setIsProjectSettingsOpen(false); // Tutup modal jika sukses
        }
    };

    const handleDeleteProjectSubmit = async () => {
        if (!selectedProjectId) return;
        setIsDeletingProject(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.delete_project === 'function') {
                const res = await api.delete_project(selectedProjectId, isDeleteFiles);
                if (res.status === 'success') {
                    showToast(res.message || "Proyek berhasil dihapus", "success");
                    fetchProjects();
                    setIsDeleteConfirmOpen(false);
                } else {
                    showToast(res.message, "error");
                }
            }
        } catch (error) {
            showToast("Terjadi kesalahan saat menghapus proyek.", "error");
        } finally {
            setIsDeletingProject(false);
            setIsDeleteFiles(false); // Reset checkbox
        }
    };

    const handleSyncHost = async (projectId: string) => {
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.retry_sync_host === 'function') {
                const res = await api.retry_sync_host(projectId);
                if (res.status === 'success') {
                    showToast(res.message, "success");
                    fetchProjects();
                } else {
                    showToast(res.message, "error");
                }
            }
        } catch (error) {
            showToast("Gagal menghubungi backend.", "error");
        }
    };

    const handleOpenDocumentRoot = async (path: string) => {
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.open_in_explorer === 'function') {
                api.open_in_explorer(path);
            }
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        const handleStatusChange = (e: any) => {
            if (e.detail.service === 'apache') setIsApacheRunning(e.detail.running);
        };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    }, []);

    useEffect(() => {
        const handleProgress = (e: any) => {
            if (e.detail && e.detail.percent !== undefined) {
                setProgress(e.detail.percent);
                setProgressText(e.detail.text || '');

                // Mencegah widget tertahan jika error 0% atau selesai 100%
                if (e.detail.percent >= 100 || e.detail.percent === 0) {
                    setTimeout(() => {
                        setProgress(0);
                        setIsCreatingProject(false);
                    }, 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    const fetchApacheStatus = async () => {
        if (window.pywebview && window.pywebview.api) {
            try {
                const res = await window.pywebview.api.get_apache_status();
                if (res.status === 'success') {
                    setIsApacheInstalled(res.installed);
                    setApachePath(res.path || 'Not Installed');
                    setIsApacheRunning(res.running || false);
                }

                // Fetch active version yang benar (Mengatasi bug list versi lama)
                const versionRes = await window.pywebview.api.get_apache_installed_versions();
                if (versionRes.status === 'success') {
                    setInstalledApacheVersion(versionRes.active || versionRes.data[0]);
                }
            } catch (error) {
                console.error("Gagal mengambil status Apache", error);
            }
        }
    };

    useEffect(() => {
        fetchApacheStatus();
        window.addEventListener('apache_version_changed', fetchApacheStatus);
        return () => window.removeEventListener('apache_version_changed', fetchApacheStatus);
    }, []);

    const handleToggleServer = async () => {
        setIsTogglingServer(true);
        try {
            if (isApacheRunning) {
                const res = await window.pywebview.api.stop_apache_server();
                if (res.status === 'success') {
                    showToast(res.message, 'success');
                    setIsApacheRunning(false);
                } else showToast(res.message, 'error');
            } else {
                const res = await window.pywebview.api.start_apache_server();
                if (res.status === 'success') {
                    showToast(res.message, 'success');
                    setIsApacheRunning(true);
                } else showToast(res.message, 'error');
            }
        } catch (error) {
            showToast("Gagal menghubungi server lokal", "error");
        } finally {
            setIsTogglingServer(false);
        }
    };

    const fetchAvailableVersions = async () => {
        setIsFetchingVersions(true);
        try {
            if (window.pywebview && window.pywebview.api) {
                const response = await window.pywebview.api.get_available_apache();
                if (response.status === 'success') {
                    const filteredVersions = response.data.filter(
                        (v: ApacheVersionData) => v.version !== installedApacheVersion
                    );
                    setAvailableVersions(filteredVersions);
                    if (filteredVersions.length > 0) {
                        setInstallVersion(filteredVersions[0].version);
                        setInstallUrl(filteredVersions[0].url);
                    } else {
                        setInstallVersion('');
                        setInstallUrl('');
                    }
                } else showToast(response.message, 'error');
            }
        } catch (error) {
            showToast("Gagal mengambil data versi dari server.", "error");
        } finally {
            setIsFetchingVersions(false);
        }
    };

    const handleOpenInstallModal = () => {
        setIsInstallServerOpen(true);
        if (availableVersions.length === 0) fetchAvailableVersions();
    };

    const handleInstallApache = async () => {
        if (!installVersion || !installUrl) return;
        setIsInstalling(true);
        setProgress(0);
        setProgressText("Memulai instalasi...");
        try {
            const response = await window.pywebview.api.install_apache(installVersion, installUrl, httpPort, httpsPort);
            if (response.status === 'success') {
                showToast(response.message, 'success');
                setIsInstallServerOpen(false);
                fetchApacheStatus();
            } else showToast(response.message, 'error');
        } catch (error) {
            showToast("Terjadi kesalahan tak terduga saat instalasi.", "error");
        } finally {
            setIsInstalling(false);
        }
    };

    const handleUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview.api.uninstall_apache();
            if (res.status === 'success') {
                showToast(res.message, 'success');
                setIsUninstallServerOpen(false);
                fetchApacheStatus();
            } else showToast(res.message, 'error');
        } catch (error) {
            showToast("Gagal melakukan proses uninstall", 'error');
        } finally {
            setIsUninstalling(false);
        }
    };

    const handleOpenDirectory = async () => {
        const res = await window.pywebview.api.open_apache_directory();
        if (res.status === 'error') showToast(res.message, 'error');
    };

    const handleOpenConfig = async () => {
        const res = await window.pywebview.api.open_apache_config();
        if (res.status === 'error') showToast(res.message, 'error');
    };

    const handleOpenProjectSettings = (id: string) => {
        setSelectedProjectId(id);
        setIsProjectSettingsOpen(true);
    };

    const handleOpenDeleteConfirm = (id: string) => {
        setSelectedProjectId(id);
        setIsDeleteFiles(false); // Pastikan defaultnya unchecked
        setIsDeleteConfirmOpen(true);
    };

    return (
        <>
            <div className="flex flex-col w-full">
                {/* --- HEADER --- */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]" style={{ fontVariationSettings: "'FILL' 0" }}>dns</span>
                            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Apache Web Server</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                {isApacheInstalled ? '1 Server Instance Installed' : 'Not Installed'} • {projects.length} Virtual Hosts
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleOpenInstallModal}
                        className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Install / Update Server
                    </button>
                </div>

                {/* --- APACHE ENGINE CARD --- */}
                {isApacheInstalled ? (
                    <div className="mb-8">
                        <Card
                            title={`Apache ${installedApacheVersion || 'Unknown'} (Win64)`}
                            status={isApacheRunning ? 'running' : 'stopped'}
                            gridCols="grid-cols-2 md:grid-cols-3"
                            dropdownActions={
                                <>
                                    <button onClick={handleOpenConfig} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open httpd.conf</button>
                                    <button onClick={handleOpenDirectory} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Directory</button>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                    <button
                                        onClick={() => setIsUninstallServerOpen(true)}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        Uninstall Server
                                    </button>
                                </>
                            }
                            footerActions={
                                <>
                                    <button
                                        onClick={handleToggleServer}
                                        disabled={isTogglingServer}
                                        className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:scale-100 ${isApacheRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                    >
                                        {isTogglingServer ? (
                                            <>
                                                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                                {isApacheRunning ? 'Stopping...' : 'Starting...'}
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isApacheRunning ? 'stop' : 'play_arrow'}
                                                </span>
                                                {isApacheRunning ? 'Stop Server' : 'Start Server'}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setIsOptionsOpen(true)}
                                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                    >
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
                                <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={apachePath}>
                                    {apachePath}
                                </span>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 mb-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4">dns</span>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Apache is not installed</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Install Apache Web Server to start serving your projects.</p>
                        <button onClick={handleOpenInstallModal} className="mt-4 text-sm font-medium text-primary hover:underline">
                            Install now
                        </button>
                    </div>
                )}

                <hr className="border-slate-200 dark:border-slate-800 mb-6" />

                {/* --- Project List Header --- */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Virtual Hosts (Projects)</h3>
                    <button
                        onClick={() => setIsNewProjectModalOpen(true)}
                        disabled={!isApacheInstalled}
                        className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span className="hidden sm:inline">Add Project</span>
                    </button>
                </div>

                {/* --- Render Card Virtual Hosts --- */}
                {isFetchingProjects ? (
                    <div className="flex justify-center py-10">
                        <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                        <p>No projects found. Click "Add Project" to create one.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {projects.map(project => (
                            <Card
                                key={project.id}
                                title={project.name || 'Untitled Project'}
                                gridCols="grid-cols-1"
                                dropdownActions={
                                    <>
                                        <button onClick={() => handleOpenDocumentRoot(project.path)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Document Root</button>
                                        <button onClick={() => handleOpenProjectSettings(project.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Vhost Settings</button>

                                        {project.host_synced === false && (
                                            <button
                                                onClick={() => handleSyncHost(project.id)}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                            >
                                                Retry Host Sync
                                            </button>
                                        )}

                                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                        <button onClick={() => handleOpenDeleteConfirm(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Project</button>
                                    </>
                                }
                                footerActions={
                                    <>
                                        <button
                                            onClick={() => handleOpenBrowser(project.domain)}
                                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm outline-none"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">open_in_browser</span> Open in Browser
                                        </button>
                                        <button onClick={() => handleOpenProjectSettings(project.id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                            <span className="material-symbols-outlined text-[18px]">settings</span> Setup
                                        </button>
                                    </>
                                }
                            >
                                <div className="flex flex-col w-full gap-4">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-3 w-full">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Framework</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-200 capitalize">
                                                {project.framework || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">PHP Engine</span>
                                            <span className="text-sm font-medium text-primary dark:text-blue-400 font-mono">
                                                {project.php_version || 'Unknown'} <span className="text-slate-400 text-xs">(Port {project.php_port || 'N/A'})</span>
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Local Domain</span>
                                            <button
                                                onClick={() => handleOpenBrowser(project.domain)}
                                                className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit truncate outline-none"
                                            >
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
                                                    <span className="text-xs text-red-700 dark:text-red-400/80 leading-relaxed">
                                                        VyloServe needs Administrator privileges to write this domain to the Windows Hosts file. The site might not be accessible yet.
                                                    </span>
                                                    <button
                                                        onClick={() => handleSyncHost(project.id)}
                                                        className="mt-1 self-start text-xs font-medium text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/50 hover:bg-red-300 dark:hover:bg-red-700/60 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">sync</span>
                                                        Retry Sync
                                                    </button>
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

            {/* --- MEMAKAI REUSABLE BACKGROUND PROGRESS WIDGET UNTUK MULTI-PROSES --- */}
            <BackgroundProgressWidget
                isOpen={(isCreatingProject && !isNewProjectModalOpen) || (isInstalling && !isInstallServerOpen)}
                progress={progress}
                progressText={progressText}
                title={isInstalling ? "Installing Apache Server..." : "Installing Project..."}
                onRestore={() => {
                    if (isInstalling) setIsInstallServerOpen(true);
                    if (isCreatingProject) setIsNewProjectModalOpen(true);
                }}
            />

            {/* --- KUMPULAN MODALS SERVER --- */}
            <Modal
                isOpen={isInstallServerOpen}
                onClose={() => setIsInstallServerOpen(false)}
                title="Install Apache Server"
                icon="download"
                onApply={handleInstallApache}
                applyText={isInstalling ? "Installing in background..." : "Download & Install"}
                isApplyDisabled={isFetchingVersions || isInstalling || availableVersions.length === 0}
            >
                <ApacheInstallWizard
                    versions={availableVersions}
                    version={installVersion}
                    setVersion={setInstallVersion}
                    setUrl={setInstallUrl}
                    httpPort={httpPort}
                    setHttpPort={setHttpPort}
                    httpsPort={httpsPort}
                    setHttpsPort={setHttpsPort}
                    isInstalling={isInstalling}
                    isFetchingVersions={isFetchingVersions}
                    progress={progress}
                    progressText={progressText}
                />
            </Modal>

            <Modal isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} title="Global Apache Config" icon="tune" onApply={() => setIsOptionsOpen(false)}>
                <ApacheSettings />
            </Modal>

            <Modal
                isOpen={isUninstallServerOpen}
                onClose={() => !isUninstalling && setIsUninstallServerOpen(false)}
                title="Uninstall Apache"
                icon="warning"
                onApply={handleUninstall}
                applyText={isUninstalling ? "Uninstalling..." : "Yes, Uninstall"}
                isApplyDisabled={isUninstalling}
                isDestructive={true}
                isLoading={isUninstalling}
            >
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to uninstall <strong className="text-slate-900 dark:text-white">Apache Web Server ({installedApacheVersion})</strong>?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        All global configurations and virtual host mappings will be deleted. Your project files in the document root will remain safe.
                    </p>
                </div>
            </Modal>

            {/* --- KUMPULAN MODALS PROJECT --- */}
            <Modal
                isOpen={isNewProjectModalOpen}
                onClose={() => setIsNewProjectModalOpen(false)}
                title="Create New Project"
                icon="add_box"
                onApply={handleCreateSubmit}
                applyText={isCreatingProject ? "Installing in background..." : "Create Project"}
                isApplyDisabled={isCreatingProject} // Disable tombol Apply selama proses jalan
            >
                <NewApacheProject ref={projectFormRef} isCreatingExternal={isCreatingProject} />
            </Modal>

            <Modal
                isOpen={isProjectSettingsOpen}
                onClose={() => !isUpdatingProject && setIsProjectSettingsOpen(false)}
                title={`Vhost Settings: ${selectedProject?.name}`}
                icon="settings"
                onApply={handleUpdateProjectSubmit}
                applyText={isUpdatingProject ? "Saving..." : "Save Changes"}
                isApplyDisabled={isUpdatingProject}
                isLoading={isUpdatingProject}
            >
                {selectedProject && <ProjectSettings project={selectedProject as any} ref={projectSettingsRef} />}
            </Modal>

            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => !isDeletingProject && setIsDeleteConfirmOpen(false)}
                title="Delete Virtual Host"
                icon="delete"
                onApply={handleDeleteProjectSubmit}
                applyText={isDeletingProject ? "Deleting..." : "Delete Project"}
                isApplyDisabled={isDeletingProject}
                isDestructive={true}
                isLoading={isDeletingProject}
            >
                <div className="flex flex-col gap-3">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{selectedProject?.domain}</strong>?
                    </p>
                    <label className="flex items-start gap-2 mt-2 cursor-pointer bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                        <input
                            type="checkbox"
                            checked={isDeleteFiles}
                            onChange={(e) => setIsDeleteFiles(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 bg-white dark:bg-slate-900"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-red-800 dark:text-red-400">Delete all project files from disk</span>
                            <span className="text-xs text-red-600/80 dark:text-red-400/80">This action is permanent and cannot be undone.</span>
                        </div>
                    </label>
                </div>
            </Modal>
        </>
    );
}