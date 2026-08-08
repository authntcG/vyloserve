import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';

import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import NewDbInstance, { type NewDbInstanceRef } from './NewInstance';
import DbSettings from './Settings';
import ChangePassword, { type ChangePasswordRef } from './ChangePassword';

type DbEngineType = 'mysql' | 'postgres';

interface DbInstance {
    id: string; name: string; engine: DbEngineType; version: string;
    port: number; status: 'running' | 'stopped'; dataDir: string;
}

export default function DatabaseMain() {
    const { showToast } = useToast();

    const [dbInstances, setDbInstances] = useState<DbInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingDbId, setTogglingDbId] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'all' | 'mysql' | 'postgres'>('all');

    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteData, setDeleteData] = useState(false);

    // ---> STATE BARU UNTUK PASSWORD MODAL <---
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);

    const newDbRef = useRef<NewDbInstanceRef>(null);
    const passwordRef = useRef<ChangePasswordRef>(null);

    const usedPorts = dbInstances.map(db => db.port);
    const selectedDb = dbInstances.find(p => p.id === selectedDbId);

    const filteredInstances = dbInstances.filter(db => activeTab === 'all' || db.engine === activeTab);

    const fetchDatabases = async () => {
        setIsLoading(true);
        try {
            const res = await window.pywebview?.api?.get_installed_databases();
            if (res?.status === 'success') setDbInstances(res.data || []);
        } catch (e) { showToast("Gagal memuat instalasi database.", "error"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchDatabases();
        const handleStatus = (e: any) => { if (['database', 'all'].includes(e.detail.service)) fetchDatabases(); };
        window.addEventListener('service_status_changed', handleStatus);
        return () => window.removeEventListener('service_status_changed', handleStatus);
    }, []);

    useEffect(() => {
        const handleProg = (e: any) => {
            if (e.detail) {
                const p = e.detail.percent;
                if (p < 0) { setIsInstalling(false); setProgress(0); return; }
                if (p > 0 && p < 100) setIsInstalling(true);
                setProgress(p); setProgressText(e.detail.text || '');
                if (p >= 100) setTimeout(() => { setProgress(0); setIsInstalling(false); setIsNewInstanceOpen(false); fetchDatabases(); }, 3000);
            }
        };
        window.addEventListener('vylo_progress', handleProg);
        return () => window.removeEventListener('vylo_progress', handleProg);
    }, [isInstalling]);

    const handleToggleDB = async (db: DbInstance) => {
        setTogglingDbId(db.id);
        try {
            const isRunning = db.status === 'running';
            const res = isRunning ? await window.pywebview?.api?.stop_database(db.id) : await window.pywebview?.api?.start_database(db.id);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') {
                fetchDatabases();
                window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'database' } }));
            }
        } catch (e) { showToast("Kesalahan saat mengubah status DB.", "error"); }
        finally { setTogglingDbId(null); }
    };

    const handleInstallDatabase = async () => {
        const formData = newDbRef.current?.getFormData();
        if (!formData) return showToast("Gagal membaca data instalasi.", "error");
        if (formData.engine === 'postgres' && !formData.rootPass) return showToast("PostgreSQL mewajibkan password superuser!", "warning");

        try {
            const isUsed = await window.pywebview?.api?.check_port_in_use(formData.port);
            if (isUsed || usedPorts.includes(formData.port)) return showToast(`Port ${formData.port} digunakan!`, "error");

            setIsInstalling(true); setProgressText(`Menyiapkan ${formData.engine}...`);
            const res = await window.pywebview?.api?.install_database(formData.engine, formData.version, formData.url, formData.port, formData.rootPass);
            if (res?.status === 'error') { showToast(res.message, "error"); setIsInstalling(false); setProgress(0); }
        } catch (e) { showToast("Kesalahan instalasi.", "error"); setIsInstalling(false); setProgress(0); }
    };

    const handleConfirmUninstall = async () => {
        if (!selectedDbId) return;
        setIsDeleting(true);
        try {
            const res = await window.pywebview?.api?.uninstall_database(selectedDbId, deleteData);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsDeleteConfirmOpen(false); setSelectedDbId(null); setDeleteData(false); fetchDatabases(); }
        } catch (e) { showToast("Gagal menghapus DB.", "error"); }
        finally { setIsDeleting(false); }
    };

    const handleOpenSettings = async (db: DbInstance) => {
        setSelectedDbId(db.id); setIsSettingsOpen(true); setIsLoadingSettings(true);
        try {
            const res = await window.pywebview?.api?.get_db_config(db.id);
            if (res?.status === 'success') setSettingsConfig(res.config);
            else showToast(res?.message, "error");
        } catch (e) { showToast("Gagal memuat konfigurasi.", "error"); }
        finally { setIsLoadingSettings(false); }
    };

    const handleSaveSettings = async () => {
        if (!selectedDb) return;
        if (usedPorts.filter(p => p !== selectedDb.port).includes(Number(settingsConfig.port))) return showToast("Port digunakan instalasi lain!", "error");
        setIsSavingSettings(true);
        try {
            const res = await window.pywebview?.api?.save_db_config(selectedDb.id, settingsConfig);
            showToast(res?.message, res?.status === 'success' ? 'success' : 'error');
            if (res?.status === 'success') { setIsSettingsOpen(false); fetchDatabases(); }
        } catch (e) { showToast("Kesalahan menyimpan.", "error"); }
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
                    title="Database Engine"
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {dbInstances.length} Instances installed
                        </>
                    }
                    actions={
                        <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">add</span> Add Engine
                        </button>
                    }
                />

                <div className="flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('all')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>All Instances</button>
                    <button onClick={() => setActiveTab('mysql')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'mysql' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>MySQL & MariaDB</button>
                    <button onClick={() => setActiveTab('postgres')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'postgres' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>PostgreSQL</button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {[1, 2].map((item) => <SkeletonCard key={item} />)}
                    </div>
                ) : filteredInstances.length === 0 ? (
                    <EmptyState
                        icon="dns"
                        title="No Instances Found"
                        description={`You haven't installed any ${activeTab === 'postgres' ? 'PostgreSQL' : 'MySQL/MariaDB'} engines yet.`}
                        actionText="Install one now"
                        onAction={() => setIsNewInstanceOpen(true)}
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {filteredInstances.map(db => {
                            const isRunning = db.status === 'running';
                            return (
                                <Card
                                    key={db.id} title={db.name} status={db.status} gridCols="grid-cols-2 md:grid-cols-3"
                                    dropdownActions={
                                        <>
                                            {/* ---> TEKS "Open Config" DIKEMBALIKAN KE OPEN MY.INI/POSTGRESQL.CONF <--- */}
                                            <button onClick={() => window.pywebview?.api?.open_db_config_file(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                                                {db.engine === 'postgres' ? 'Open postgresql.conf' : 'Open my.ini'}
                                            </button>
                                            <button onClick={() => window.pywebview?.api?.open_db_dir(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">Open Data Folder</button>

                                            {/* ---> MENU BARU: CHANGE PASSWORD <--- */}
                                            <button onClick={() => { setSelectedDbId(db.id); setIsPasswordModalOpen(true); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                                                Change Password
                                            </button>

                                            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                            <button onClick={() => { setSelectedDbId(db.id); setDeleteData(false); setIsDeleteConfirmOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">Drop Engine</button>
                                        </>
                                    }
                                    footerActions={
                                        <>
                                            <button onClick={() => handleToggleDB(db)} disabled={togglingDbId === db.id} className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                                {togglingDbId === db.id ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span></> : <span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span>} {isRunning ? 'Stop DB' : 'Start DB'}
                                            </button>
                                            <button onClick={() => handleOpenSettings(db)} className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">Engine</span><span className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5 truncate"><span className="material-symbols-outlined text-[16px] text-slate-400">{db.engine === 'postgres' ? 'storage' : 'database'}</span>{db.engine === 'postgres' ? 'PostgreSQL' : 'MySQL/MariaDB'}</span></div>
                                    <div className="flex flex-col gap-1 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">Port</span><span className="font-mono text-sm text-primary truncate">{db.port}</span></div>
                                    <div className="flex flex-col gap-1 col-span-2 md:col-span-3 min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">Data Directory</span><span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={db.dataDir}>{db.dataDir}</span></div>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            <BackgroundProgressWidget isOpen={isInstalling && !isNewInstanceOpen} progress={progress} progressText={progressText} title="Installing Database Engine..." onRestore={() => setIsNewInstanceOpen(true)} />

            <Modal isOpen={isNewInstanceOpen} onClose={() => setIsNewInstanceOpen(false)} title="Install Database Engine" icon="download" onApply={handleInstallDatabase} applyText={isInstalling ? "Processing..." : "Install Engine"} isApplyDisabled={isInstalling}>
                <NewDbInstance ref={newDbRef} activeTab={activeTab} usedPorts={usedPorts} isInstalling={isInstalling} progress={progress} progressText={progressText} />
            </Modal>

            {/* ---> MODAL CHANGE PASSWORD BARU <--- */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => !isUpdatingPassword && setIsPasswordModalOpen(false)}
                title="Change Database Password"
                icon="key"
                onApply={handlePasswordSubmit}
                applyText={isUpdatingPassword ? "Updating..." : "Update Password"}
                isApplyDisabled={isUpdatingPassword}
                isLoading={isUpdatingPassword}
            >
                {selectedDb && <ChangePassword instance={selectedDb} ref={passwordRef} />}
            </Modal>

            <Modal isOpen={isSettingsOpen} onClose={() => !isSavingSettings && setIsSettingsOpen(false)} title={`${selectedDb?.name} Configuration`} icon="tune" onApply={handleSaveSettings} applyText={isSavingSettings ? "Saving..." : "Save Changes"} isApplyDisabled={isLoadingSettings || isSavingSettings} isLoading={isSavingSettings}>
                {selectedDb && <DbSettings instance={selectedDb} config={settingsConfig} onChange={handleConfigChange} isLoading={isLoadingSettings} />}
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => !isDeleting && setIsDeleteConfirmOpen(false)} title="Drop Database Engine" icon="warning" onApply={handleConfirmUninstall} applyText={isDeleting ? "Dropping..." : "Yes, Drop"} isApplyDisabled={isDeleting} isDestructive={true} isLoading={isDeleting}>
                <p className="text-slate-700 dark:text-slate-300 mb-2">Completely remove <strong className="text-slate-900 dark:text-white">{selectedDb?.name}</strong>?</p>
                <label className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 cursor-pointer">
                    <input type="checkbox" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} disabled={isDeleting} className="mt-0.5" />
                    <div className="flex flex-col"><span className="text-sm font-semibold text-red-800">Permanently delete raw data directory</span></div>
                </label>
            </Modal>
        </>
    );
}