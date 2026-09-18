import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import { useToast } from '../../components/ToastContext';

import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { clampPercent } from '../../utils/progress';

import NewPhpInstance from './NewInstance';
import PhpSettings from './Settings';

interface PhpInstance {
    id: string; name: string; version: string; port: number;
    status: 'running' | 'stopped'; dir: string; memory_limit: string;
}

const getStatusBtnClass = (isRunning: boolean) => isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600';

const getStatusBtnContent = (isToggling: boolean, isRunning: boolean, t: any) => {
    if (isToggling) {
        return <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {isRunning ? t('php.stopping') : t('php.starting')}</>;
    }
    return <><span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span> {isRunning ? t('php.stop_cgi') : t('php.start_cgi')}</>;
};

export default function PhpMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

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

    // PROGRESS WIDGET
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    const usedPorts = instances.map(inst => inst.port);

    // --- FETCH DATA ---
    const fetchInstalledInstances = async () => {
        setIsLoading(true);
        try {
            const data = await window.pywebview?.api?.get_installed_php();
            setInstances(data || []);
            if (data?.length > 0) setInstallPort(Math.max(...data.map((i: any) => i.port)) + 1);
        } catch (e){ console.error(e); showToast(t('php.fetch_php_data_error'), "error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchInstalledInstances();
        const handleStatusChange = (e: any) => { if (e.detail.service === 'php') fetchInstalledInstances(); };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleProgress = (e: any) => {
            // Abaikan progress milik modul lain (mis. Apache/Database) yang kebetulan
            // berjalan bersamaan — lihat docs/known_bugs.md #7.
            if (e.detail?.source && e.detail.source !== 'PhpManager') return;
            if (e.detail) {
                const pct = clampPercent(e.detail.percent);
                setProgress(pct); setProgressText(t(e.detail.text || '', e.detail.args || {}) as string);

                // Batalkan timer auto-hide sebelumnya setiap ada event baru -- mencegah timer basi
                // dari event 100%/0% yang TERNYATA bukan akhir proses (mis. instalasi PHP sempat
                // melaporkan progress mid-flow sebelum fase composer) menyembunyikan widget saat
                // proses sebenarnya masih berjalan. Lihat docs/known_bugs.md.
                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }
                if (pct >= 100 || pct === 0) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => setProgress(0), 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => {
            window.removeEventListener('vylo_progress', handleProgress);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    }, []);

    // --- PHP HANDLERS ---
    const handleInstallPhp = async () => {
        if (!installVersion) return showToast(t('php.select_php_version_warning'), "warning");
        if (usedPorts.includes(installPort)) return showToast(t('php.port_in_use_error'), "error");
        setIsInstalling(true);
        try {
            const res = await window.pywebview?.api?.install_php(installVersion, installFilename, installPort);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsNewInstanceOpen(false); fetchInstalledInstances(); }
        } catch (e){ console.error(e); showToast(t('php.system_error'), "error"); }
        finally { setIsInstalling(false); }
    };

    const handleOpenSettings = async (php: PhpInstance) => {
        setSelectedInstance(php); setIsSettingsOpen(true); setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_php_config(php.version);
            if (res?.status === 'success') { setSettingsConfig(res.config); setSettingsExtensions(res.extensions); }
        } catch (e){ console.error(e); showToast(t('php.fetch_config_error'), "error"); }
        finally { setIsLoadingSettings(false); }
    };

    const handleSaveSettings = async () => {
        if (!selectedInstance) return;
        if (usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port))) return showToast(t('php.port_used_by_other_error'), "error");
        setIsSavingSettings(true);
        try {
            const activeExts = settingsExtensions.filter(e => e.active).map(e => e.name);
            const res = await window.pywebview?.api?.save_php_config(selectedInstance.version, settingsConfig, activeExts);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsSettingsOpen(false); fetchInstalledInstances(); }
        } catch (e){ console.error(e); showToast(t('php.save_error'), "error"); }
        finally { setIsSavingSettings(false); }
    };

    const handleConfirmUninstall = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await window.pywebview?.api?.uninstall_php(deleteTarget.version);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setDeleteTarget(null); fetchInstalledInstances(); }
        } catch (e){ console.error(e); showToast(t('php.delete_error'), "error"); }
        finally { setIsDeleting(false); }
    };

    const handleToggleStatus = async (php: PhpInstance) => {
        setTogglingInstanceId(php.id);
        try {
            const isRunning = php.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_php(php.version) : await window.pywebview?.api?.start_php(php.version);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                setInstances(prev => prev.map(i => i.id === php.id ? { ...i, status: isRunning ? 'stopped' : 'running' } : i));
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'php', running: !isRunning } }));
            }
        } catch (e){ console.error(e); showToast(t('php.toggle_status_error'), "error"); }
        finally { setTogglingInstanceId(null); }
    };

    return (
        <>
            <div className="flex flex-col w-full">
                <PageHeader
                    icon="php"
                    title={t('php.php_engines')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {instances.length}{t('php.instances_installed')}
                        </>
                    }
                    actions={
                        <button type="button" onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">add</span> {t('php.add_version')}
                        </button>
                    }
                />

                <div className="mt-6">
                    {(() => {
                        if (isLoading) return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                            {[1, 2].map((item) => <SkeletonCard key={item} />)}
                        </div>
                        );
                        if (instances.length === 0) return (
                        <EmptyState
                            icon="terminal"
                            title={t('php.no_php_versions_installed')}
                            description={t('php.no_php_versions_desc')}
                            actionText={t('php.download_now')}
                            onAction={() => setIsNewInstanceOpen(true)}
                        />
                        );
                        return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                            {instances.map(php => {
                                const isRunning = php.status === 'running';
                                return (
                                    <Card
                                        key={php.id} title={php.name} status={php.status} gridCols="grid-cols-2 md:grid-cols-3"
                                        dropdownActions={
                                            <>
                                                <button type="button" onClick={() => window.pywebview?.api?.open_php_ini(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('php.open_php_ini')}</button>
                                                <button type="button" onClick={() => window.pywebview?.api?.open_php_dir(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{t('php.open_directory')}</button>
                                                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                                <button type="button" onClick={() => setDeleteTarget(php)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">{t('php.uninstall')}</button>
                                            </>
                                        }
                                        footerActions={
                                            <>
                                                <button type="button" onClick={() => handleToggleStatus(php)} disabled={togglingInstanceId === php.id} className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 ${getStatusBtnClass(isRunning)}`}>
                                                    {getStatusBtnContent(togglingInstanceId === php.id, isRunning, t)}
                                                </button>
                                                <button type="button" onClick={() => handleOpenSettings(php)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                    <span className="material-symbols-outlined text-[18px]">tune</span> {t('php.config')}
                                                </button>
                                            </>
                                        }
                                    >
                                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">{t('php.fastcgi_port')}</span><span className="font-mono text-sm text-primary">{php.port}</span></div>
                                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">{t('php.memory_limit')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200">{php.memory_limit}</span></div>
                                        <div className="flex flex-col gap-1 col-span-2 md:col-span-3"><span className="text-xs font-medium text-slate-500 uppercase">{t('php.path')}</span><span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={php.dir}>{php.dir}</span></div>
                                    </Card>
                                )
                            })}
                        </div>
                        );
                    })()}
                </div>
            </div>

            {/* WIDGET & MODALS */}
            <BackgroundProgressWidget isOpen={isInstalling && !isNewInstanceOpen} progress={progress} progressText={progressText} title={t('php.processing')} onRestore={() => setIsNewInstanceOpen(true)} />

            {/* PHP MODALS */}
            <Modal isOpen={isNewInstanceOpen} keepMounted={isInstalling} onClose={() => setIsNewInstanceOpen(false)} title={t('php.install_php_version')} icon="download" onApply={handleInstallPhp} applyText={isInstalling ? t('php.installing') : t('php.install_and_configure')} isApplyDisabled={isFetchingVersions || isInstalling || !installVersion || usedPorts.includes(installPort)}>
                <NewPhpInstance version={installVersion} setVersion={setInstallVersion} setFilename={setInstallFilename} port={installPort} setPort={setInstallPort} isInstalling={isInstalling} isFetchingVersions={isFetchingVersions} setIsFetchingVersions={setIsFetchingVersions} usedPorts={usedPorts} />
            </Modal>
            <Modal isOpen={isSettingsOpen} onClose={() => !isSavingSettings && setIsSettingsOpen(false)} title={`${selectedInstance?.name || 'PHP'} ${t('php.configuration')}`} icon="tune" onApply={handleSaveSettings} applyText={isSavingSettings ? t('php.saving') : t('php.save_changes')} isApplyDisabled={isLoadingSettings || isSavingSettings || (selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port)) : false)} isLoading={isSavingSettings}>
                <PhpSettings config={settingsConfig} setConfig={setSettingsConfig} extensions={settingsExtensions} setExtensions={setSettingsExtensions} isLoading={isLoadingSettings} usedPorts={selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port) : []} />
            </Modal>
            <Modal isOpen={deleteTarget !== null} onClose={() => !isDeleting && setDeleteTarget(null)} title={t('php.confirm_uninstall')} icon="delete_forever" onApply={handleConfirmUninstall} applyText={isDeleting ? t('php.uninstalling') : t('php.yes_uninstall')} isApplyDisabled={isDeleting} isDestructive={true} isLoading={isDeleting}>
                <p className="text-slate-700 dark:text-slate-300">{t('php.delete_prefix')}<strong className="text-slate-900 dark:text-white">{deleteTarget?.name}</strong>{t('php.delete_suffix')}</p>
            </Modal>
        </>
    );
}