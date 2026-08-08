import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import NewPhpInstance from './NewInstance';
import PhpSettings from './Settings';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import { useToast } from '../../components/ToastContext';

// ---> IMPORT UI KIT COMPONENTS <---
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

interface PhpInstance {
    id: string; name: string; version: string; port: number;
    status: 'running' | 'stopped'; dir: string; memory_limit: string;
}

export default function PhpMain() {
    const [instances, setInstances] = useState<PhpInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingInstanceId, setTogglingInstanceId] = useState<string | null>(null);

    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installFilename, setInstallFilename] = useState('');
    const [installPort, setInstallPort] = useState(9000);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isFetchingVersions, setIsFetchingVersions] = useState(true);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<PhpInstance | null>(null);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [settingsExtensions, setSettingsExtensions] = useState<any[]>([]);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<PhpInstance | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { showToast } = useToast();
    const usedPorts = instances.map(inst => inst.port);

    const fetchInstalledInstances = async () => {
        setIsLoading(true);
        try {
            const data = await window.pywebview?.api?.get_installed_php();
            setInstances(data || []);
            if (data?.length > 0) setInstallPort(Math.max(...data.map((i: any) => i.port)) + 1);
        } catch (e) { showToast("Gagal memuat data PHP.", "error"); }
        finally { setIsLoading(false); }
    };

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

    useEffect(() => {
        fetchInstalledInstances();
        const handleStatusChange = (e: any) => { if (e.detail.service === 'php') fetchInstalledInstances(); };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    }, []);

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
            if (res?.status === 'success') { setDeleteTarget(null); fetchInstalledInstances(); }
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

    return (
        <>
            <div className="flex flex-col w-full">
                {/* ---> PENGGUNAAN KOMPONEN PAGE HEADER <--- */}
                <PageHeader
                    icon="php"
                    title="PHP Versions"
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {instances.length} Instances installed
                        </>
                    }
                    actions={
                        <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">add</span> Add Version
                        </button>
                    }
                />

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

            <BackgroundProgressWidget isOpen={isInstalling && !isNewInstanceOpen} progress={progress} progressText={progressText} title={`Installing PHP...`} onRestore={() => setIsNewInstanceOpen(true)} />

            <Modal isOpen={isNewInstanceOpen} onClose={() => setIsNewInstanceOpen(false)} title="Install PHP Version" icon="download" onApply={handleInstallPhp} applyText={isInstalling ? "Installing..." : "Install & Configure"} isApplyDisabled={isFetchingVersions || isInstalling || !installVersion || usedPorts.includes(installPort)}>
                <NewPhpInstance version={installVersion} setVersion={setInstallVersion} setFilename={setInstallFilename} port={installPort} setPort={setInstallPort} isInstalling={isInstalling} isFetchingVersions={isFetchingVersions} setIsFetchingVersions={setIsFetchingVersions} usedPorts={usedPorts} />
            </Modal>

            <Modal isOpen={isSettingsOpen} onClose={() => !isSavingSettings && setIsSettingsOpen(false)} title={`${selectedInstance?.name || 'PHP'} Configuration`} icon="tune" onApply={handleSaveSettings} applyText={isSavingSettings ? "Saving..." : "Save Changes"} isApplyDisabled={isLoadingSettings || isSavingSettings || (selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port)) : false)} isLoading={isSavingSettings}>
                <PhpSettings config={settingsConfig} setConfig={setSettingsConfig} extensions={settingsExtensions} setExtensions={setSettingsExtensions} isLoading={isLoadingSettings} usedPorts={selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port) : []} />
            </Modal>

            <Modal isOpen={deleteTarget !== null} onClose={() => !isDeleting && setDeleteTarget(null)} title="Confirm Uninstall" icon="delete_forever" onApply={handleConfirmUninstall} applyText={isDeleting ? "Uninstalling..." : "Yes, Uninstall"} isApplyDisabled={isDeleting} isDestructive={true} isLoading={isDeleting}>
                <p className="text-slate-700 dark:text-slate-300">Delete <strong className="text-slate-900 dark:text-white">{deleteTarget?.name}</strong>? This removes binary files and configs permanently.</p>
            </Modal>
        </>
    );
}