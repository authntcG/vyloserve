import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import { useToast } from '../../components/ToastContext';

import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import NewPhpInstance from './NewInstance';
import PhpSettings from './Settings';
import InstallComposer, { type InstallComposerRef } from './InstallComposer';

interface PhpInstance {
    id: string; name: string; version: string; port: number;
    status: 'running' | 'stopped'; dir: string; memory_limit: string;
}

interface ComposerData {
    installed: boolean;
    version: string;
    linked_php: string;
    in_path: boolean;
    path_dir: string;
}

export default function PhpMain() {
    const { showToast } = useToast();

    // TAB STATE
    const [activeTab, setActiveTab] = useState<'php' | 'composer'>('php');

    // PHP STATES
    const [instances, setInstances] = useState<PhpInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingInstanceId, setTogglingInstanceId] = useState<string | null>(null);
    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installFilename, setInstallFilename] = useState('');
    const [installPort, setInstallPort] = useState(9000);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isFetchingVersions, setIsFetchingVersions] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<PhpInstance | null>(null);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [settingsExtensions, setSettingsExtensions] = useState<any[]>([]);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PhpInstance | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // COMPOSER STATES
    const [composerData, setComposerData] = useState<ComposerData | null>(null);
    const [isFetchingComposer, setIsFetchingComposer] = useState(true);
    const [isComposerInstallOpen, setIsComposerInstallOpen] = useState(false);
    const [isComposerInstalling, setIsComposerInstalling] = useState(false);
    const [isComposerUninstallOpen, setIsComposerUninstallOpen] = useState(false);
    const [isTogglingPath, setIsTogglingPath] = useState(false);
    const composerRef = useRef<InstallComposerRef>(null);

    // PROGRESS WIDGET
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const usedPorts = instances.map(inst => inst.port);

    // --- FETCH DATA ---
    const fetchInstalledInstances = async () => {
        setIsLoading(true);
        try {
            const data = await window.pywebview?.api?.get_installed_php();
            setInstances(data || []);
            if (data?.length > 0) setInstallPort(Math.max(...data.map((i: any) => i.port)) + 1);
        } catch (e) { showToast("Gagal memuat data PHP.", "error"); }
        finally { setIsLoading(false); }
    };

    const fetchComposerStatus = async () => {
        setIsFetchingComposer(true);
        try {
            const res = await window.pywebview?.api?.get_composer_status();
            if (res?.status === 'success') {
                setComposerData(res.data);
            }
        } catch (e) { }
        finally { setIsFetchingComposer(false); }
    };

    useEffect(() => {
        fetchInstalledInstances();
        fetchComposerStatus();
        const handleStatusChange = (e: any) => { if (e.detail.service === 'php') fetchInstalledInstances(); };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    }, []);

    useEffect(() => {
        const handleProgress = (e: any) => {
            if (e.detail) {
                setProgress(e.detail.percent); setProgressText(e.detail.text || '');
                if (e.detail.percent >= 100 || e.detail.percent === 0) setTimeout(() => setProgress(0), 3000);
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    // --- PHP HANDLERS ---
    const handleInstallPhp = async () => {
        if (!installVersion) return showToast("Pilih versi PHP terlebih dahulu.", "warning");
        if (usedPorts.includes(installPort)) return showToast("Port sudah digunakan!", "error");
        setIsInstalling(true);
        try {
            const res = await window.pywebview?.api?.install_php(installVersion, installFilename, installPort);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsNewInstanceOpen(false); fetchInstalledInstances(); }
        } catch (e) { showToast("Terjadi kesalahan sistem.", "error"); }
        finally { setIsInstalling(false); }
    };

    const handleOpenSettings = async (php: PhpInstance) => {
        setSelectedInstance(php); setIsSettingsOpen(true); setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_php_config(php.version);
            if (res?.status === 'success') { setSettingsConfig(res.config); setSettingsExtensions(res.extensions); }
        } catch (e) { showToast("Gagal memuat konfigurasi", "error"); }
        finally { setIsLoadingSettings(false); }
    };

    const handleSaveSettings = async () => {
        if (!selectedInstance) return;
        if (usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port))) return showToast("Port digunakan instalasi lain!", "error");
        setIsSavingSettings(true);
        try {
            const activeExts = settingsExtensions.filter(e => e.active).map(e => e.name);
            const res = await window.pywebview?.api?.save_php_config(selectedInstance.version, settingsConfig, activeExts);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsSettingsOpen(false); fetchInstalledInstances(); }
        } catch (e) { showToast("Gagal menyimpan.", "error"); }
        finally { setIsSavingSettings(false); }
    };

    const handleConfirmUninstall = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await window.pywebview?.api?.uninstall_php(deleteTarget.version);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setDeleteTarget(null); fetchInstalledInstances(); fetchComposerStatus(); }
        } catch (e) { showToast("Gagal menghapus.", "error"); }
        finally { setIsDeleting(false); }
    };

    const handleToggleStatus = async (php: PhpInstance) => {
        setTogglingInstanceId(php.id);
        try {
            const isRunning = php.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_php(php.version) : await window.pywebview?.api?.start_php(php.version);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setInstances(prev => prev.map(i => i.id === php.id ? { ...i, status: isRunning ? 'stopped' : 'running' } : i));
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'php', running: !isRunning } }));
            }
        } catch (e) { showToast("Gagal mengubah status.", "error"); }
        finally { setTogglingInstanceId(null); }
    };

    // --- COMPOSER HANDLERS ---
    const handleInstallComposerSubmit = async () => {
        if (!composerRef.current) return;
        setIsComposerInstalling(true);
        const success = await composerRef.current.submit();
        if (success) {
            setIsComposerInstallOpen(false);
            fetchComposerStatus();
        }
        setIsComposerInstalling(false);
    };

    const handleUninstallComposer = async () => {
        setIsDeleting(true);
        try {
            const res = await window.pywebview?.api?.uninstall_composer();
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsComposerUninstallOpen(false); fetchComposerStatus(); }
        } catch (e) { showToast("Gagal menghapus Composer.", "error"); }
        finally { setIsDeleting(false); }
    };

    const handleToggleComposerPath = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const enable = e.target.checked;
        setIsTogglingPath(true);
        try {
            const res = await window.pywebview?.api?.toggle_global_path('composer', enable);
            if (res?.status === 'success') {
                setComposerData(prev => prev ? { ...prev, in_path: enable } : null);
                if (enable) {
                    showToast("Sistem PATH ditambahkan. Harap restart terminal/CMD atau VSCode Anda.", "success");
                } else {
                    showToast("Sistem PATH berhasil dihapus.", "success");
                }
            } else {
                showToast(res?.message || "Gagal mengubah System PATH", "error");
            }
        } catch (error) {
            showToast("Kesalahan sistem saat mengubah PATH", "error");
        } finally {
            setIsTogglingPath(false);
        }
    };

    return (
        <>
            <div className="flex flex-col w-full">

                <PageHeader
                    icon="php"
                    title="PHP & Packages"
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {instances.length} PHP Instances • Composer {composerData?.installed ? 'Ready' : 'Not Installed'}
                        </>
                    }
                    actions={
                        activeTab === 'php' ? (
                            <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                                <span className="material-symbols-outlined text-[18px]">add</span> Add Version
                            </button>
                        ) : (
                            <button onClick={() => setIsComposerInstallOpen(true)} disabled={instances.length === 0} className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                                <span className="material-symbols-outlined text-[18px]">{composerData?.installed ? 'update' : 'download'}</span> {composerData?.installed ? 'Update Composer' : 'Install Composer'}
                            </button>
                        )
                    }
                />

                {/* TAB NAVIGATION */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('php')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'php' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>PHP Engines</button>
                    <button onClick={() => setActiveTab('composer')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'composer' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Composer
                        {composerData?.installed && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                    </button>
                </div>

                {/* PHP ENGINES TAB */}
                <div className={activeTab === 'php' ? 'block' : 'hidden'}>
                    {isLoading ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                            {[1, 2].map((item) => <SkeletonCard key={item} />)}
                        </div>
                    ) : instances.length === 0 ? (
                        <EmptyState
                            icon="terminal"
                            title="No PHP Versions Installed"
                            description="Install multiple PHP versions to easily switch your environments."
                            actionText="Download now"
                            onAction={() => setIsNewInstanceOpen(true)}
                        />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                            {instances.map(php => {
                                const isRunning = php.status === 'running';
                                return (
                                    <Card
                                        key={php.id} title={php.name} status={php.status} gridCols="grid-cols-2 md:grid-cols-3"
                                        dropdownActions={
                                            <>
                                                <button onClick={() => window.pywebview?.api?.open_php_ini(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open php.ini</button>
                                                <button onClick={() => window.pywebview?.api?.open_php_dir(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Directory</button>
                                                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                                <button onClick={() => setDeleteTarget(php)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Uninstall</button>
                                            </>
                                        }
                                        footerActions={
                                            <>
                                                <button onClick={() => handleToggleStatus(php)} disabled={togglingInstanceId === php.id} className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                                    {togglingInstanceId === php.id ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {isRunning ? 'Stopping...' : 'Starting...'}</> : <><span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span> {isRunning ? 'Stop CGI' : 'Start CGI'}</>}
                                                </button>
                                                <button onClick={() => handleOpenSettings(php)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                    <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                                </button>
                                            </>
                                        }
                                    >
                                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">FastCGI Port</span><span className="font-mono text-sm text-primary">{php.port}</span></div>
                                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">Memory Limit</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200">{php.memory_limit}</span></div>
                                        <div className="flex flex-col gap-1 col-span-2 md:col-span-3"><span className="text-xs font-medium text-slate-500 uppercase">Path</span><span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={php.dir}>{php.dir}</span></div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* COMPOSER TAB */}
                <div className={activeTab === 'composer' ? 'block' : 'hidden'}>
                    {isFetchingComposer ? (
                        <SkeletonCard />
                    ) : !composerData?.installed ? (
                        <EmptyState
                            icon="package"
                            title="Composer is not installed"
                            description="Install Composer to manage dependencies for your PHP frameworks globally."
                            actionText={instances.length === 0 ? "Install PHP First" : "Install Composer"}
                            onAction={() => instances.length === 0 ? setActiveTab('php') : setIsComposerInstallOpen(true)}
                        />
                    ) : (
                        <Card
                            title="Composer (Dependency Manager)"
                            status="running"
                            gridCols="grid-cols-1 md:grid-cols-2"
                            dropdownActions={
                                <>
                                    <button onClick={() => setIsComposerUninstallOpen(true)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Uninstall Composer</button>
                                </>
                            }
                        >
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase">Composer Version</span>
                                <span className="font-mono text-sm text-slate-900 dark:text-slate-200">{composerData.version}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase">Linked PHP Engine</span>
                                <span className="font-mono text-sm text-primary">{composerData.linked_php}</span>
                            </div>

                            <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Register to Windows PATH (Global CMD)</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Make `composer` and `php` accessible globally via terminal command.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4">
                                    <input type="checkbox" checked={composerData.in_path} onChange={handleToggleComposerPath} disabled={isTogglingPath} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-50"></div>
                                </label>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* WIDGET & MODALS */}
            <BackgroundProgressWidget isOpen={(isInstalling && !isNewInstanceOpen) || (isComposerInstalling && !isComposerInstallOpen)} progress={progress} progressText={progressText} title={`Processing...`} onRestore={() => { if (isInstalling) setIsNewInstanceOpen(true); if (isComposerInstalling) setIsComposerInstallOpen(true); }} />

            {/* PHP MODALS */}
            <Modal isOpen={isNewInstanceOpen} keepMounted={isInstalling} onClose={() => setIsNewInstanceOpen(false)} title="Install PHP Version" icon="download" onApply={handleInstallPhp} applyText={isInstalling ? "Installing..." : "Install & Configure"} isApplyDisabled={isFetchingVersions || isInstalling || !installVersion || usedPorts.includes(installPort)}>
                <NewPhpInstance version={installVersion} setVersion={setInstallVersion} setFilename={setInstallFilename} port={installPort} setPort={setInstallPort} isInstalling={isInstalling} isFetchingVersions={isFetchingVersions} setIsFetchingVersions={setIsFetchingVersions} usedPorts={usedPorts} />
            </Modal>
            <Modal isOpen={isSettingsOpen} onClose={() => !isSavingSettings && setIsSettingsOpen(false)} title={`${selectedInstance?.name || 'PHP'} Configuration`} icon="tune" onApply={handleSaveSettings} applyText={isSavingSettings ? "Saving..." : "Save Changes"} isApplyDisabled={isLoadingSettings || isSavingSettings || (selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port)) : false)} isLoading={isSavingSettings}>
                <PhpSettings config={settingsConfig} setConfig={setSettingsConfig} extensions={settingsExtensions} setExtensions={setSettingsExtensions} isLoading={isLoadingSettings} usedPorts={selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port) : []} />
            </Modal>
            <Modal isOpen={deleteTarget !== null} onClose={() => !isDeleting && setDeleteTarget(null)} title="Confirm Uninstall" icon="delete_forever" onApply={handleConfirmUninstall} applyText={isDeleting ? "Uninstalling..." : "Yes, Uninstall"} isApplyDisabled={isDeleting} isDestructive={true} isLoading={isDeleting}>
                <p className="text-slate-700 dark:text-slate-300">Delete <strong className="text-slate-900 dark:text-white">{deleteTarget?.name}</strong>? This removes binary files and configs permanently.</p>
            </Modal>

            {/* COMPOSER MODALS */}
            <Modal isOpen={isComposerInstallOpen} keepMounted={isComposerInstalling} onClose={() => setIsComposerInstallOpen(false)} title="Install Composer" icon="package" onApply={handleInstallComposerSubmit} applyText={isComposerInstalling ? "Installing..." : "Install Composer"} isApplyDisabled={isComposerInstalling} isLoading={isComposerInstalling}>
                <InstallComposer phpInstances={instances} ref={composerRef} />
            </Modal>
            <Modal isOpen={isComposerUninstallOpen} onClose={() => !isDeleting && setIsComposerUninstallOpen(false)} title="Uninstall Composer" icon="warning" onApply={handleUninstallComposer} applyText={isDeleting ? "Uninstalling..." : "Yes, Uninstall"} isApplyDisabled={isDeleting} isDestructive={true} isLoading={isDeleting}>
                <p className="text-slate-700 dark:text-slate-300">Are you sure you want to completely remove Composer?</p>
            </Modal>
        </>
    );
}