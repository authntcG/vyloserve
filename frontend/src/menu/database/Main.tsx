import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Tabs from '../../components/Tabs';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import { useToast } from '../../components/ToastContext';
import { useAlert } from '../../components/AlertContext';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import LogFileViewerModal from '../../components/LogFileViewerModal';

import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { clampPercent } from '../../utils/progress';
import { compareVersions } from '../../utils/version';

import NewDbInstance, { type NewDbInstanceRef } from './NewInstance';
import DbSettings from './Settings';
import ChangePassword, { type ChangePasswordRef } from './ChangePassword';

type DbEngineType = 'mysql' | 'postgres';


interface DbInstance {
    id: string; name: string; engine: DbEngineType; version: string;
    port: number; status: 'running' | 'stopped'; dataDir: string;
}

interface AvailableUpdate { version: string; url: string; }

export default function DatabaseMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [dbInstances, setDbInstances] = useState<DbInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingDbId, setTogglingDbId] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'all' | 'mysql' | 'postgres'>('all');

    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
    const [logViewer, setLogViewer] = useState<{ dbId: string; type: 'startup' | 'native' } | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    
    // ---> STATE BARU UNTUK PASSWORD MODAL <---
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);
    const hideProgressTimeoutRef = useRef<number | null>(null);

    // ---> STATE UNTUK CEK & EKSEKUSI UPDATE VERSI ENGINE PER-INSTANCE <---
    // Keyed by db.id -- hanya berisi entri untuk instance yang punya versi lebih baru
    // tersedia (dibandingkan terhadap data[0] hasil get_available_databases, yang
    // sudah terurut terbaru-duluan -- lihat core/services/database.py). Progress saat
    // update BERBAGI state isInstalling/progress/progressText dengan alur install biasa
    // (pola yang sama dengan php/Main.tsx's handleUpdatePhp -- bukan state terpisah).
    const [availableUpdates, setAvailableUpdates] = useState<Record<string, AvailableUpdate>>({});

    const newDbRef = useRef<NewDbInstanceRef>(null);
    const passwordRef = useRef<ChangePasswordRef>(null);

    const usedPorts = dbInstances.map(db => db.port);
    const selectedDb = dbInstances.find(p => p.id === selectedDbId);

    const filteredInstances = dbInstances.filter(db => activeTab === 'all' || db.engine === activeTab);

    // Cek update yang tersedia untuk tiap ENGINE unik yang terinstal (bukan per-instance --
    // kalau ada 2 instance MySQL, cukup 1x panggilan get_available_databases('mysql')),
    // lalu bandingkan versi terbaru hasilnya terhadap versi masing-masing instance lewat
    // compareVersions() (perbandingan numerik per-segmen, bukan string inequality --
    // konsisten dengan pola hasUpdate/updateVer di php/Main.tsx).
    const checkForUpdates = useCallback(async (instances: DbInstance[]) => {
        const api = window.pywebview?.api;
        if (!api || typeof api.get_available_databases !== 'function' || instances.length === 0) {
            setAvailableUpdates({});
            return;
        }
        const engines = Array.from(new Set(instances.map(db => db.engine)));
        const updates: Record<string, AvailableUpdate> = {};
        await Promise.all(engines.map(async (engine) => {
            try {
                const res = await api.get_available_databases(engine);
                if (res?.status !== 'success' || !res.data?.length) return;
                const latest = res.data[0];
                instances
                    .filter(db => db.engine === engine && compareVersions(latest.version, db.version) > 0)
                    .forEach(db => { updates[db.id] = { version: latest.version, url: latest.url }; });
            } catch (e) { console.error(e); }
        }));
        setAvailableUpdates(updates);
    }, []);

    const fetchDatabases = async () => {
        setIsLoading(true);
        try {
            const res = await window.pywebview?.api?.get_installed_databases();
            if (res?.status === 'success') {
                const instances = res.data || [];
                setDbInstances(instances);
                checkForUpdates(instances);
            } else if (res?.status === 'error') {
                showToast(t(res.message || 'database.fetch_db_error', res.args || {}) as string, "error");
            }
        } catch (e){ console.error(e); showToast(t('database.fetch_db_error'), "error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchDatabases();
        const handleStatus = (e: any) => { if (['database', 'all'].includes(e.detail?.service)) fetchDatabases(); };
        window.addEventListener('service_status_changed', handleStatus);
        return () => window.removeEventListener('service_status_changed', handleStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleProg = (e: any) => {
            // Abaikan progress milik modul lain (mis. Apache/PHP) yang kebetulan
            // berjalan bersamaan — lihat docs/known_bugs.md #7.
            if (e.detail?.source && e.detail.source !== 'DatabaseManager') return;
            if (e.detail) {
                const p = e.detail.percent;

                // Batalkan timer auto-hide sebelumnya setiap ada event baru -- mencegah timer basi
                // dari event 100%/negatif mid-flow (bukan akhir proses sebenarnya) menyembunyikan
                // widget saat instalasi masih berjalan. Lihat docs/known_bugs.md.
                if (hideProgressTimeoutRef.current) {
                    window.clearTimeout(hideProgressTimeoutRef.current);
                    hideProgressTimeoutRef.current = null;
                }

                if (p < 0) { setIsInstalling(false); setProgress(0); return; }
                if (p > 0 && p < 100) setIsInstalling(true);
                setProgress(clampPercent(p)); setProgressText(t(e.detail.text || '', e.detail.args || {}) as string);
                if (p >= 100) {
                    hideProgressTimeoutRef.current = window.setTimeout(() => { setProgress(0); }, 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProg);
        return () => {
            window.removeEventListener('vylo_progress', handleProg);
            if (hideProgressTimeoutRef.current) window.clearTimeout(hideProgressTimeoutRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInstalling]);

    const handleToggleDB = async (db: DbInstance) => {
        setTogglingDbId(db.id);
        try {
            const isRunning = db.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_database(db.id) : await window.pywebview?.api?.start_database(db.id);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchDatabases();
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'database' } }));
            }
        } catch (e){ console.error(e); showToast(t('database.toggle_status_error'), "error"); }
        finally { setTogglingDbId(null); }
    };



    const handleInstallDatabase = async () => {
        const formData = newDbRef.current?.getFormData();
        if (!formData) return showToast(t('database.read_install_data_error'), "error");
        if (formData.engine === 'postgres' && !formData.rootPass) return showToast(t('database.pg_password_required'), "warning");

        try {
            const isUsed = await window.pywebview?.api?.check_port_in_use(formData.port);
            if (isUsed || usedPorts.includes(formData.port)) return showToast(t('database.port_used'), "error");

            setIsInstalling(true); setProgressText(t('database.preparing_engine'));
            const res = await window.pywebview?.api?.install_database(formData.engine, formData.version, formData.url, formData.port, formData.rootPass);
            if (res?.status === 'error') {
                showToast(t(res.message || '', res.args || {}) as string, "error");
            } else if (res?.status === 'success') {
                showToast(t(res.message || '', res.args || {}) as string, "success");
                setIsNewInstanceOpen(false);
                fetchDatabases();
            }
        } catch (e){ console.error(e); showToast(t('database.install_error'), "error"); }
        finally { setIsInstalling(false); setProgress(0); }
    };

    const handleConfirmUninstall = async (db: DbInstance) => {
        if (!await confirm({
            title: t('database.drop_db_title'),
            message: (
                <div className="flex flex-col gap-4">
                    <p className="text-slate-700 dark:text-slate-300">
                        {t('database.completely_remove')}<strong className="text-slate-900 dark:text-white">{db.name}</strong>?
                    </p>
                    <label className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30 cursor-pointer">
                        <input type="checkbox" id={`database-delete-data-${db.id}`} aria-label={t('database.delete_raw_data')} className="mt-0.5" />
                        <div className="flex flex-col"><span className="text-sm font-semibold text-red-800 dark:text-red-400">{t('database.delete_raw_data')}</span></div>
                    </label>
                </div>
            ),
            type: 'danger',
            confirmText: t('database.yes_drop')
        })) return;

        const shouldDeleteData = (document.getElementById(`database-delete-data-${db.id}`) as HTMLInputElement)?.checked || false;
        try {
            const res = await window.pywebview?.api?.uninstall_database(db.id, shouldDeleteData);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { fetchDatabases(); }
        } catch (e){ console.error(e); showToast(t('database.delete_error'), "error"); }
    };

    const handleUpdateDatabase = async (db: DbInstance) => {
        const update = availableUpdates[db.id];
        if (!update) return;

        // Langkah 1: konfirmasi update (Yes/Cancel) -- batal di sini membatalkan seluruhnya.
        const confirmedUpdate = await confirm({
            title: t('database.confirm_update'),
            message: (
                <p className="text-slate-700 dark:text-slate-300">
                    {t('database.update_prefix')}<strong className="text-slate-900 dark:text-white">{db.name}</strong>
                    {t('database.update_middle')}<strong className="text-slate-900 dark:text-white">{update.version}</strong>{t('database.update_suffix')}
                </p>
            ),
            type: 'warning',
            confirmText: t('database.yes_update'),
            cancelText: t('database.cancel_update'),
        });
        if (!confirmedUpdate) return;

        // Langkah 2: pilihan backup -- KEDUA tombol tetap melanjutkan update, cuma beda
        // nilai backup_data yang dikirim ke backend (lihat update_database() di
        // core/services/database.py, yang menangani backup+rollback otomatis kalau gagal).
        // Ini BUKAN "lanjut vs batal" seperti langkah 1 -- tidak ada opsi batal di sini
        // karena user sudah commit untuk update di langkah 1.
        const shouldBackup = await confirm({
            title: t('database.backup_data_title'),
            message: <p className="text-slate-700 dark:text-slate-300">{t('database.backup_data_desc')}</p>,
            type: 'warning',
            confirmText: t('database.yes_backup'),
            cancelText: t('database.no_backup'),
        });

        setIsInstalling(true);
        setProgressText(t('database.updating_engine'));
        try {
            const res = await window.pywebview?.api?.update_database(db.id, update.version, update.url, shouldBackup);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') fetchDatabases();
        } catch (e) { console.error(e); showToast(t('database.install_error'), "error"); }
        finally { setIsInstalling(false); setProgress(0); }
    };

    const fetchDbLogContent = useCallback(() => {
        if (!logViewer) return Promise.resolve(undefined);
        return window.pywebview?.api?.get_database_log_content(logViewer.dbId, logViewer.type);
    }, [logViewer]);

    const handleOpenSettings = async (db: DbInstance) => {
        setSelectedDbId(db.id); setIsSettingsOpen(true); setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_db_config(db.id);
            if (res?.status === 'success') setSettingsConfig(res.config);
            else showToast(t(res?.message || '', res?.args || {}) as string, "error");
        } catch (e){ console.error(e); showToast(t('database.fetch_config_error'), "error"); }
        finally { setIsLoadingSettings(false); }
    };

    const handleSaveSettings = async () => {
        if (!selectedDb) return;
        if (usedPorts.filter(p => p !== selectedDb.port).includes(Number(settingsConfig.port))) return showToast(t('database.port_used_other'), "error");
        setIsSavingSettings(true);
        try {
            const res = await window.pywebview?.api?.save_db_config(selectedDb.id, settingsConfig);
            showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsSettingsOpen(false); fetchDatabases(); }
        } catch (e){ console.error(e); showToast(t('database.save_error'), "error"); }
        finally { setIsSavingSettings(false); }
    };

    const handleConfigChange = (key: string, value: string | number) => {
        setSettingsConfig((prev: any) => ({ ...prev, [key]: value }));
    };

    // ---> FUNGSI SUMBIT UNTUK PASSWORD MODAL BARU <---
    const handlePasswordSubmit = async () => {
        if (!passwordRef.current) return;
        setIsUpdatingPassword(true);
        const isSuccess = await passwordRef.current.submit();
        setIsUpdatingPassword(false);
        if (isSuccess) {
            setIsPasswordModalOpen(false);
        }
    };

    return (
        <>
            <div className="flex flex-col w-full">

                <PageHeader
                    icon="database"
                    title={t('database.db_engine')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {dbInstances.length}{t('database.instances_installed')}
                        </>
                    }
                    actions={
                        <Button variant="primary" icon="add" onClick={() => setIsNewInstanceOpen(true)} className="shadow-sm">
                            {t('database.add_engine')}
                        </Button>
                    }
                />

                <Tabs
                    tabs={[
                        { value: 'all', label: t('database.all_instances') },
                        { value: 'mysql', label: t('database.mysql_mariadb') },
                        { value: 'postgres', label: t('database.postgres') },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                />

                {(() => {
                    if (isLoading) return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {[1, 2].map((item) => <SkeletonCard key={item} />)}
                    </div>
                    );
                    if (filteredInstances.length === 0) return (
                    <EmptyState
                        icon="dns"
                        title={t('database.no_instances_found')}
                        description={activeTab === 'postgres' ? t('database.no_postgres_desc') : t('database.no_mysql_desc')}
                        actionText={t('database.install_now')}
                        onAction={() => setIsNewInstanceOpen(true)}
                    />
                    );
                    return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {filteredInstances.map(db => {
                            const isRunning = db.status === 'running';
                            const update = availableUpdates[db.id];
                            return (
                                <Card
                                    key={db.id}
                                    title={
                                        <div className="flex items-center gap-2">
                                            <span>{db.name}</span>
                                            {/* ---> IKON/BADGE "UPDATE" -- mengikuti pola persis php/Main.tsx's updateVer
                                                 badge, bukan notice box terpisah. Aksi update sendiri ada di menu
                                                 dropdown (titik tiga) di bawah, bukan tombol langsung di badge ini. <--- */}
                                            {update && (
                                                <span
                                                    className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                                                    title={t('database.update_to', { version: update.version }) as string}
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">upgrade</span> {t('database.update')}
                                                </span>
                                            )}
                                        </div>
                                    }
                                    status={db.status} gridCols="grid-cols-2 md:grid-cols-3"
                                    dropdownActions={
                                        <>
                                            {/* ---> TEKS "Open Config" DIKEMBALIKAN KE OPEN MY.INI/POSTGRESQL.CONF <--- */}
                                            <button type="button" onClick={() => window.pywebview?.api?.open_db_config_file(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                                                {db.engine === 'postgres' ? t('database.open_postgres_conf') : t('database.open_my_ini')}
                                            </button>
                                            <button type="button" onClick={() => window.pywebview?.api?.open_db_dir(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">{t('database.open_data_folder')}</button>
                                            <button type="button" onClick={() => setLogViewer({ dbId: db.id, type: 'startup' })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">{t('settings.log_file_startup')}</button>
                                            {db.engine === 'mysql' && (
                                                <button type="button" onClick={() => setLogViewer({ dbId: db.id, type: 'native' })} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">{t('settings.log_file_native')}</button>
                                            )}

                                            {/* ---> MENU BARU: CHANGE PASSWORD <--- */}
                                            <button type="button" onClick={() => { setSelectedDbId(db.id); setIsPasswordModalOpen(true); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                                                {t('database.change_password')}
                                            </button>

                                            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                            {update && (
                                                <button type="button" onClick={() => handleUpdateDatabase(db)} disabled={isInstalling} className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-slate-100 dark:hover:bg-slate-700 font-medium disabled:opacity-50">
                                                    <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">upgrade</span>
                                                    {t('database.update_to', { version: update.version })}
                                                </button>
                                            )}
                                            <button type="button" onClick={() => handleConfirmUninstall(db)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">{t('database.drop_engine')}</button>
                                        </>
                                    }
                                    footerActions={
                                        <>
                                            <ServiceToggleButton
                                                isRunning={isRunning}
                                                isToggling={togglingDbId === db.id}
                                                onClick={() => handleToggleDB(db)}
                                                className="flex-1"
                                                labels={{
                                                    start: t('database.start_db'),
                                                    stop: t('database.stop_db'),
                                                    // Database tidak punya label transisi "Starting.../Stopping..." terpisah
                                                    // seperti Apache/PHP -- pertahankan perilaku asli (spinner + label statis).
                                                    starting: t('database.start_db'),
                                                    stopping: t('database.stop_db'),
                                                }}
                                            />
                                            <button type="button" onClick={() => handleOpenSettings(db)} className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">tune</span> {t('database.config')}
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">{t('database.engine')}</span><span className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5 truncate"><span className="material-symbols-outlined text-[16px] text-slate-400">{db.engine === 'postgres' ? 'storage' : 'database'}</span>{db.engine === 'postgres' ? t('database.postgres') : t('database.mysql_mariadb')}</span></div>
                                    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">{t('database.port')}</span><span className="font-mono text-sm text-primary truncate">{db.port}</span></div>
                                    <div className="flex flex-col gap-1 col-span-2 md:col-span-3 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">{t('database.data_directory')}</span><span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={db.dataDir}>{db.dataDir}</span></div>
                                </Card>
                            )
                        })}
                    </div>
                    );
                })()}
            </div>

            <LogFileViewerModal
                isOpen={logViewer !== null}
                onClose={() => setLogViewer(null)}
                title={logViewer?.type === 'native' ? t('settings.log_file_native') : t('settings.log_file_startup')}
                fetchContent={fetchDbLogContent}
            />

            <BackgroundProgressWidget isOpen={isInstalling && !isNewInstanceOpen} progress={progress} progressText={progressText} title={t('database.processing')} onRestore={() => setIsNewInstanceOpen(true)} />

            <Modal keepMounted={isInstalling} isOpen={isNewInstanceOpen} onClose={() => setIsNewInstanceOpen(false)} title={t('database.install_db_title')} icon="download" onApply={handleInstallDatabase} applyText={isInstalling ? t('database.processing') : t('database.install_btn')} isApplyDisabled={isInstalling}>
                <NewDbInstance ref={newDbRef} activeTab={activeTab} usedPorts={usedPorts} isInstalling={isInstalling} progress={progress} progressText={progressText} />
            </Modal>

            {/* ---> MODAL CHANGE PASSWORD BARU <--- */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => !isUpdatingPassword && setIsPasswordModalOpen(false)}
                title={t('database.change_db_password')}
                icon="key"
                onApply={handlePasswordSubmit}
                applyText={isUpdatingPassword ? t('database.updating') : t('database.update_password')}
                isApplyDisabled={isUpdatingPassword}
                isLoading={isUpdatingPassword}
            >
                {selectedDb && <ChangePassword instance={selectedDb} ref={passwordRef} />}
            </Modal>

            <Modal isOpen={isSettingsOpen} onClose={() => !isSavingSettings && setIsSettingsOpen(false)} title={`${selectedDb?.name}${t('database.configuration')}`} icon="tune" onApply={handleSaveSettings} applyText={isSavingSettings ? t('database.saving') : t('database.save_changes')} isApplyDisabled={isLoadingSettings || isSavingSettings} isLoading={isSavingSettings}>
                {selectedDb && <DbSettings instance={selectedDb} config={settingsConfig} onChange={handleConfigChange} isLoading={isLoadingSettings} />}
            </Modal>


        </>
    );
}