import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ToastContext';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';

import NewDbInstance, { type NewDbInstanceRef } from './NewInstance';
import DbSettings from './Settings';

type DbEngineType = 'mysql' | 'postgres';

interface DbInstance {
    id: string;
    name: string;
    engine: DbEngineType;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dataDir: string;
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

    // STATE BACKGROUND INSTALLATION
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);

    const newDbRef = useRef<NewDbInstanceRef>(null);

    const usedPorts = dbInstances.map(db => db.port);
    const selectedDb = dbInstances.find(p => p.id === selectedDbId);

    const filteredInstances = dbInstances.filter(db => {
        if (activeTab === 'all') return true;
        return db.engine === activeTab;
    });

    const fetchDatabases = async () => {
        setIsLoading(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.get_installed_databases === 'function') {
                const res = await api.get_installed_databases();
                if (res.status === 'success') setDbInstances(res.data);
            }
        } catch (error) {
            showToast("Gagal memuat instalasi database.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDatabases();

        // ---> LISTENER: Refresh Data Jika Tombol Master Sidebar Ditekan <---
        const handleStatusChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            // Jika ada servis database yang dipicu, atau semua servis dimatikan
            if (customEvent.detail.service === 'database' || customEvent.detail.service === 'all') {
                fetchDatabases();
            }
        };
        window.addEventListener('service_status_changed', handleStatusChange);
        return () => window.removeEventListener('service_status_changed', handleStatusChange);
    }, []);

    useEffect(() => {
        const handleProgress = (e: any) => {
            if (e.detail && e.detail.percent !== undefined) {
                const p = e.detail.percent;
                const text = e.detail.text || '';

                if (p < 0) {
                    setIsInstalling(false);
                    setProgress(0);
                    setProgressText('');
                    return;
                }

                if (p > 0 && p < 100 && !isInstalling) {
                    setIsInstalling(true);
                }

                setProgress(p);
                setProgressText(text);

                if (p >= 100) {
                    setTimeout(() => {
                        setProgress(0);
                        setIsInstalling(false);
                        setIsNewInstanceOpen(false);
                        fetchDatabases();
                    }, 3000);
                }
            }
        };
        window.addEventListener('vylo_progress', handleProgress);

        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [isInstalling]);

    const handleToggleDB = async (db: DbInstance) => {
        setTogglingDbId(db.id);
        try {
            const api = window.pywebview?.api || window.api;
            if (api) {
                const isRunning = db.status === 'running';
                const response = isRunning ? await api.stop_database(db.id) : await api.start_database(db.id);

                if (response.status === 'success') {
                    showToast(response.message, 'success');
                    
                    // ---> EMIT EVENT: Agar Switch Database di Sidebar ikut berubah statusnya <---
                    window.dispatchEvent(new CustomEvent('service_status_changed', { 
                        detail: { service: 'database', running: !isRunning } 
                    }));
                    
                    fetchDatabases();
                } else {
                    showToast(response.message, 'error');
                }
            }
        } catch (error) {
            showToast("Kesalahan sistem saat mengubah status DB.", "error");
        } finally {
            setTogglingDbId(null);
        }
    };

    const handleInstallDatabase = async () => {
        if (!newDbRef.current) return;
        const formData = newDbRef.current.getFormData();

        if (!formData) return showToast("Gagal membaca data form instalasi.", "error");
        if (formData.engine === 'postgres' && !formData.rootPass) return showToast("PostgreSQL mewajibkan pengisian password superuser!", "warning");

        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.check_port_in_use === 'function') {
                const isUsed = await api.check_port_in_use(formData.port);
                if (isUsed || usedPorts.includes(formData.port)) {
                    return showToast(`Port ${formData.port} sudah digunakan!`, "error");
                }
            }

            if (api) {
                setIsInstalling(true);
                setProgress(0);
                setProgressText(`Menyiapkan unduhan ${formData.engine}...`);

                const response = await api.install_database(
                    formData.engine, formData.version, formData.url, formData.port, formData.rootPass
                );

                if (response && response.status === 'error') {
                    showToast(response.message, "error");
                    setIsInstalling(false);
                    setProgress(0);
                    setProgressText('');
                }
            }
        } catch (e) {
            showToast("Terjadi kesalahan sistem saat instalasi.", "error");
            setIsInstalling(false);
            setProgress(0);
        }
    };

    // ========================================================
    // LOGIKA UNINSTALL / DROP ENGINE
    // ========================================================
    const handleConfirmUninstall = async () => {
        if (!selectedDbId) return;
        
        setIsDeleting(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.uninstall_database === 'function') {
                // ---> KIRIM STATE DELETEDATA KE BACKEND <---
                const response = await api.uninstall_database(selectedDbId, deleteData);
                
                if (response.status === 'success') {
                    showToast(response.message, 'success');
                    setIsDeleteConfirmOpen(false);
                    setSelectedDbId(null);
                    setDeleteData(false); // Reset Checkbox
                    fetchDatabases(); 
                } else {
                    showToast(response.message, 'error'); 
                }
            }
        } catch (error) {
            showToast("Gagal menghubungi server saat menghapus DB.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenSettings = async (db: DbInstance) => {
        setSelectedDbId(db.id);
        setIsSettingsOpen(true);
        setIsLoadingSettings(true);
        
        try {
            const api = window.pywebview?.api || window.api;
            if (api) {
                const response = await api.get_db_config(db.id);
                if (response.status === 'success') {
                    setSettingsConfig(response.config);
                } else {
                    showToast(response.message, "error");
                }
            }
        } catch (error) {
            showToast("Gagal memuat konfigurasi.", "error");
        } finally {
            setIsLoadingSettings(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!selectedDb) return;
        
        // Cek bentrok Port
        const otherPorts = usedPorts.filter(p => p !== selectedDb.port);
        if (otherPorts.includes(Number(settingsConfig.port))) {
            return showToast("Port tersebut sudah digunakan oleh instance lain!", "error");
        }

        setIsSavingSettings(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api) {
                const response = await api.save_db_config(selectedDb.id, settingsConfig);
                if (response.status === 'success') {
                    showToast(response.message, 'success');
                    setIsSettingsOpen(false);
                    fetchDatabases(); // Refresh tabel
                } else {
                    showToast(response.message, 'error');
                }
            }
        } catch (error) {
            showToast("Kesalahan sistem saat menyimpan konfigurasi.", "error");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleConfigChange = (key: string, value: string | number) => {
        setSettingsConfig((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleOpenIni = async (id: string) => {
        try { await window.pywebview?.api?.open_db_config_file(id); } catch (e) { }
    };

    const handleOpenDir = async (id: string) => {
        try { await window.pywebview?.api?.open_db_dir(id); } catch (e) { }
    };

    return (
        <>
            <div className="flex flex-col w-full">

                <div className="flex flex-col gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]" style={{ fontVariationSettings: "'FILL' 0" }}>database</span>
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Database Engine</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                            Active
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {dbInstances.length} Instances installed
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        <button onClick={() => setActiveTab('all')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'all' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>All Instances</button>
                        <button onClick={() => setActiveTab('mysql')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'mysql' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>MySQL & MariaDB</button>
                        <button onClick={() => setActiveTab('postgres')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'postgres' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>PostgreSQL</button>
                    </div>

                    {/* ---> PERBAIKAN UX: TOMBOL PGMYADMIN YANG TIDAK DIPAKAI TELAH DIHAPUS <--- */}
                    <div className="flex gap-3 pb-2">
                        <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-95">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">Add Engine</span>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {[1, 2].map((item) => (
                            <div key={item} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-pulse">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700/50 rounded w-1/3"></div>
                                    <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700/50 rounded-full"></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3 w-full">
                                    <div className="flex flex-col gap-2">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-16"></div>
                                        <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-12"></div>
                                        <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-16"></div>
                                    </div>
                                    <div className="flex flex-col gap-2 col-span-2 md:col-span-3">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                        <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-48"></div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="h-9 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                                    <div className="h-9 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredInstances.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4">dns</span>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Instances Found</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You haven't installed any {activeTab === 'postgres' ? 'PostgreSQL' : 'MySQL/MariaDB'} engines yet.</p>
                        <button onClick={() => setIsNewInstanceOpen(true)} className="mt-4 text-sm font-medium text-primary hover:underline">
                            Install one now
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {filteredInstances.map(db => {
                            const isRunning = db.status === 'running';
                            const isToggling = togglingDbId === db.id;
                            const engineIcon = db.engine === 'postgres' ? 'storage' : 'database';

                            return (
                                <Card
                                    key={db.id}
                                    title={db.name}
                                    status={db.status}
                                    gridCols="grid-cols-2 md:grid-cols-3"
                                    dropdownActions={
                                        <>
                                            <button onClick={() => handleOpenIni(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                {db.engine === 'postgres' ? 'Open postgresql.conf' : 'Open my.ini'}
                                            </button>
                                            <button onClick={() => handleOpenDir(db.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Data Folder</button>
                                            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                            <button onClick={() => { setSelectedDbId(db.id); setDeleteData(false); setIsDeleteConfirmOpen(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Drop Engine</button>
                                        </>
                                    }
                                    footerActions={
                                        <>
                                            <button
                                                onClick={() => handleToggleDB(db)}
                                                disabled={isToggling}
                                                className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                            >
                                                {isToggling ? (
                                                    <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span>{isRunning ? 'Stopping...' : 'Starting...'}</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span>{isRunning ? 'Stop DB' : 'Start DB'}</>
                                                )}
                                            </button>
                                            <button onClick={() => handleOpenSettings(db)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                            </button>
                                        </>
                                    }
                                >
                                    {/* ---> PERBAIKAN TUMPANG TINDIH: min-w-0 dan class truncate <--- */}
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Engine</span>
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">{engineIcon}</span>
                                            <span className="truncate">{db.engine === 'postgres' ? 'PostgreSQL' : 'MySQL/MariaDB'}</span>
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</span>
                                        <span className="font-mono text-sm text-primary dark:text-blue-400 truncate">{db.port}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 col-span-2 md:col-span-3 min-w-0">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Directory</span>
                                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={db.dataDir}>{db.dataDir}</span>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            <BackgroundProgressWidget
                isOpen={isInstalling && !isNewInstanceOpen}
                progress={progress}
                progressText={progressText}
                title="Installing Database Engine..."
                onRestore={() => setIsNewInstanceOpen(true)}
            />

            <Modal
                isOpen={isNewInstanceOpen}
                onClose={() => setIsNewInstanceOpen(false)}
                title="Install Database Engine"
                icon="download"
                onApply={handleInstallDatabase}
                applyText={isInstalling ? "Processing..." : "Install Engine"}
                isApplyDisabled={isInstalling}
            >
                <NewDbInstance
                    ref={newDbRef}
                    activeTab={activeTab}
                    usedPorts={usedPorts}
                    isInstalling={isInstalling}
                    progress={progress}
                    progressText={progressText}
                />
            </Modal>

            <Modal 
                isOpen={isSettingsOpen} 
                onClose={() => !isSavingSettings && setIsSettingsOpen(false)} 
                title={`${selectedDb?.name} Configuration`} 
                icon="tune" 
                onApply={handleSaveSettings}
                applyText={isSavingSettings ? "Saving..." : "Save Changes"}
                isApplyDisabled={isLoadingSettings || isSavingSettings}
                isLoading={isSavingSettings}
            >
                {selectedDb && (
                    <DbSettings 
                        instance={selectedDb} 
                        config={settingsConfig} 
                        onChange={handleConfigChange} 
                        isLoading={isLoadingSettings} 
                    />
                )}
            </Modal>

            <Modal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => !isDeleting && setIsDeleteConfirmOpen(false)} 
                title="Drop Database Engine" 
                icon="warning" 
                onApply={handleConfirmUninstall} 
                applyText={isDeleting ? "Dropping Engine..." : "Yes, Drop"} 
                isApplyDisabled={isDeleting} 
                isDanger={true}
                isLoading={isDeleting} // <--- INI ADALAH KUNCI UNTUK MENGELUARKAN ANIMASI SPINNER!
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <p className="text-slate-700 dark:text-slate-300">
                            Are you sure you want to completely remove <strong className="text-slate-900 dark:text-white">{selectedDb?.name}</strong>?
                        </p>
                        <p className="text-sm text-red-500 font-medium mt-2">
                            Warning: This action will remove the engine binary. By default, your raw databases in the data directory are kept safe.
                        </p>
                    </div>

                    {/* ---> KOTAK CHECKBOX HAPUS DATA <--- */}
                    <div className="p-3 border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 rounded-lg flex items-start gap-3 mt-2 transition-colors">
                        <div className="flex items-center h-5 mt-0.5">
                            <input
                                id="delete-data-checkbox"
                                type="checkbox"
                                checked={deleteData}
                                onChange={(e) => setDeleteData(e.target.checked)}
                                disabled={isDeleting}
                                className="w-4 h-4 text-red-600 bg-white border-red-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-slate-900 focus:ring-2 dark:bg-slate-800 dark:border-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="delete-data-checkbox" className={`text-sm font-medium ${deleteData ? 'text-red-800 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'} cursor-pointer transition-colors`}>
                                Permanently delete raw data directory
                            </label>
                            <p className="text-xs text-red-600/80 dark:text-red-500/80 mt-1 leading-relaxed">
                                Checking this will erase all your databases, tables, and configurations stored inside this engine's data folder. <strong>This action cannot be undone.</strong>
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}