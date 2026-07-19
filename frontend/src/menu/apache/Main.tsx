import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';

import ApacheSettings from './Settings';
import NewApacheProject from './NewProject';
import ProjectSettings from './ProjectSettings';
import ApacheInstallWizard, { type ApacheVersionData } from './InstallWizard';

// Dummy data Projects
const DUMMY_PROJECTS = [
    { id: '1', name: 'E-Commerce App', domain: 'shop.local', framework: 'Laravel', frameworkVer: '10.x', phpVersion: 'PHP 8.2.20' },
    { id: '2', name: 'Portfolio Website', domain: 'portfolio.local', framework: 'Wordpress', frameworkVer: '6.4', phpVersion: 'PHP 7.4.33' },
    { id: '3', name: 'Internal CRM', domain: 'crm.local', framework: 'CodeIgniter', frameworkVer: '4.x', phpVersion: 'PHP 8.1.29' },
];

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
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    // State Project lainnya
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isUninstallServerOpen, setIsUninstallServerOpen] = useState(false);
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const selectedProject = DUMMY_PROJECTS.find(p => p.id === selectedProjectId);

    // --- EVENT LISTENER: Progress Bar dari Python ---
    useEffect(() => {
        const handleProgress = (e: any) => {
            if (e.detail && e.detail.percent !== undefined) {
                setProgress(e.detail.percent);
                setProgressText(e.detail.text || '');
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
                    setInstalledApacheVersion(res.version);
                    setApachePath(res.path || 'Not Installed');
                    
                    // Update state running berdasarkan data real dari Python
                    setIsApacheRunning(res.running || false);
                }
            } catch (error) {
                console.error("Gagal mengambil status Apache", error);
            }
        }
    };

    // --- HANDLER BARU: START / STOP SERVER ---
    const handleToggleServer = async () => {
        setIsTogglingServer(true);
        try {
            if (isApacheRunning) {
                const res = await window.pywebview.api.stop_apache_server();
                if (res.status === 'success') {
                    showToast(res.message, 'success');
                    setIsApacheRunning(false);
                } else {
                    showToast(res.message, 'error');
                }
            } else {
                const res = await window.pywebview.api.start_apache_server();
                if (res.status === 'success') {
                    showToast(res.message, 'success');
                    setIsApacheRunning(true);
                } else {
                    showToast(res.message, 'error');
                }
            }
        } catch (error) {
            showToast("Gagal menghubungi server lokal", "error");
        } finally {
            setIsTogglingServer(false);
        }
    };

    useEffect(() => {
        fetchApacheStatus();
    }, []);

    // --- LOGIKA FETCH VERSI APACHE ---
    const fetchAvailableVersions = async () => {
        // Set loading seketika
        setIsFetchingVersions(true);
        try {
            if (window.pywebview && window.pywebview.api) {
                const response = await window.pywebview.api.get_available_apache();

                if (response.status === 'success') {
                    // LOGIKA FILTER: Singkirkan versi yang sama dengan yang sudah terinstal
                    const filteredVersions = response.data.filter(
                        (v: ApacheVersionData) => v.version !== installedApacheVersion
                    );

                    setAvailableVersions(filteredVersions);

                    if (filteredVersions.length > 0) {
                        setInstallVersion(filteredVersions[0].version);
                        setInstallUrl(filteredVersions[0].url);
                    } else {
                        // Kosongkan state jika semua versi (atau versi terbaru) sudah terinstal
                        setInstallVersion('');
                        setInstallUrl('');
                    }
                } else {
                    showToast(response.message, 'error');
                }
            }
        } catch (error) {
            console.error("Gagal menghubungi backend Python:", error);
            showToast("Gagal mengambil data versi dari server lokal.", "error");
        } finally {
            setIsFetchingVersions(false);
        }
    };

    // --- HANDLER BARU: Mencegah efek FOUC / Berkedip ---
    const handleOpenInstallModal = () => {
        setIsInstallServerOpen(true);
        // Jika data masih kosong, panggil fungsi fetch.
        // React akan mem-batch setIsInstallServerOpen dan setIsFetchingVersions(true) secara bersamaan.
        if (availableVersions.length === 0) {
            fetchAvailableVersions();
        }
    };

    // --- LOGIKA EKSEKUSI INSTALASI ---
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
                // Muat ulang status setelah instalasi sukses
                fetchApacheStatus();
            } else {
                showToast(response.message, 'error');
            }
        } catch (error) {
            showToast("Terjadi kesalahan tak terduga saat instalasi.", "error");
        } finally {
            setIsInstalling(false);
        }
    };

    // --- HANDLER BARU: UNINSTALL ---
    const handleUninstall = async () => {
        setIsUninstalling(true);
        try {
            const res = await window.pywebview.api.uninstall_apache();
            if (res.status === 'success') {
                showToast(res.message, 'success');
                setIsUninstallServerOpen(false);
                fetchApacheStatus(); // Update UI ke state kosong
            } else {
                showToast(res.message, 'error');
            }
        } catch (error) {
            showToast("Gagal melakukan proses uninstall", 'error');
        } finally {
            setIsUninstalling(false);
        }
    };

    // --- HANDLER BARU: BUKA FOLDER & CONFIG ---
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
                                {isApacheInstalled ? '1 Server Instance Installed' : 'Not Installed'} • {DUMMY_PROJECTS.length} Virtual Hosts
                            </span>
                        </div>
                    </div>

                    {/* Tombol Header kini menggunakan Handler baru */}
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

                        {/* Tombol Empty State kini menggunakan Handler baru */}
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
                        onClick={() => setIsNewProjectOpen(true)}
                        disabled={!isApacheInstalled}
                        className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        <span className="hidden sm:inline">Add Project</span>
                    </button>
                </div>

                {/* --- Render Card Virtual Hosts --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                    {DUMMY_PROJECTS.map(project => (
                        <Card
                            key={project.id}
                            title={project.name}
                            dropdownActions={
                                <>
                                    <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Document Root</button>
                                    <button onClick={() => handleOpenProjectSettings(project.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Vhost Settings</button>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                    <button onClick={() => handleOpenDeleteConfirm(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Project</button>
                                </>
                            }
                            footerActions={
                                <>
                                    <button className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">open_in_browser</span> Open in Browser
                                    </button>
                                    <button onClick={() => handleOpenProjectSettings(project.id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">settings</span> Setup
                                    </button>
                                </>
                            }
                        >
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Framework</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    {project.framework} <span className="text-xs text-slate-500 ml-1">({project.frameworkVer})</span>
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">PHP Engine</span>
                                <span className="text-sm font-medium text-primary dark:text-blue-400 font-mono">
                                    {project.phpVersion}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 col-span-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Local Domain</span>
                                <a href={`http://${project.domain}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit">
                                    {project.domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* --- KUMPULAN MODALS SERVER --- */}
            <Modal
                isOpen={isInstallServerOpen}
                onClose={() => !isInstalling && setIsInstallServerOpen(false)}
                title="Install Apache Server"
                icon="download"
                onApply={handleInstallApache}
                applyText={isInstalling ? "Downloading..." : "Download & Install"}
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

            <Modal isOpen={isUninstallServerOpen} onClose={() => setIsUninstallServerOpen(false)} title="Uninstall Apache" icon="warning" onApply={() => setIsUninstallServerOpen(false)} applyText="Yes, Uninstall" isDestructive={true}>
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to uninstall <strong className="text-slate-900 dark:text-white">Apache Web Server</strong>?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        All global configurations and virtual host mappings will be deleted. Your project files in the document root will remain safe.
                    </p>
                </div>
            </Modal>

            {/* --- KUMPULAN MODALS PROJECT --- */}
            <Modal isOpen={isNewProjectOpen} onClose={() => setIsNewProjectOpen(false)} title="New Virtual Host" icon="create_new_folder" onApply={() => setIsNewProjectOpen(false)} applyText="Create Project">
                <NewApacheProject />
            </Modal>

            <Modal isOpen={isProjectSettingsOpen} onClose={() => setIsProjectSettingsOpen(false)} title={`Vhost Settings: ${selectedProject?.name}`} icon="settings" onApply={() => setIsProjectSettingsOpen(false)}>
                {selectedProject && <ProjectSettings project={selectedProject as any} />}
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
        </>
    );
}