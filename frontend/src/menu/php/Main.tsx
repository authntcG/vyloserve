// src/menu/php/Main.tsx
import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import NewPhpInstance from './NewInstance';
import PhpSettings from './Settings'; // IMPORT KOMPONEN SETTINGS
import { useToast } from '../../components/ToastContext';

interface PhpInstance {
    id: string;
    name: string;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dir: string;
    memory_limit: string;
}

export default function PhpMain() {
    const [instances, setInstances] = useState<PhpInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // STATE UNTUK MODAL INSTALASI
    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [installVersion, setInstallVersion] = useState('');
    const [installFilename, setInstallFilename] = useState('');
    const [installPort, setInstallPort] = useState(9002);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isFetchingVersions, setIsFetchingVersions] = useState(true);

    // ---> STATE UNTUK MODAL SETTINGS & DATA <---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<PhpInstance | null>(null);

    const [settingsConfig, setSettingsConfig] = useState<any>({});
    const [settingsExtensions, setSettingsExtensions] = useState<any[]>([]);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // STATE UNTUK MODAL UNINSTALL
    const [deleteTarget, setDeleteTarget] = useState<PhpInstance | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { showToast } = useToast();

    const fetchInstalledInstances = async () => {
        setIsLoading(true);
        // Tidak perlu cek if (window.pywebview) lagi, karena sudah dijamin oleh App.tsx
        try {
            const data = await window.pywebview.api.get_installed_php();
            setInstances(data);
        } catch (error) {
            console.error("Gagal memuat instance:", error);
            showToast("Gagal memuat data PHP.", "error");
        }
        setIsLoading(false);
    };

    // KODE YANG SANGAT BERSIH SEKARANG
    useEffect(() => {
        fetchInstalledInstances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInstallPhp = async () => {
        if (!installVersion || !installFilename) return showToast("Pilih versi PHP terlebih dahulu.", "warning");

        setIsInstalling(true);
        try {
            const response = await window.pywebview.api.install_php(installVersion, installFilename, installPort);

            if (response.status === 'success') {
                showToast(response.message, 'success');
                setIsNewInstanceOpen(false);
                fetchInstalledInstances();
            } else {
                showToast(`Gagal: ${response.message}`, 'error');
            }
        } catch (error) {
            showToast("Terjadi kesalahan sistem.", "error");
            console.error(error);
        } finally {
            setIsInstalling(false);
        }
    };

    // ---> HANDLER BARU UNTUK MEMBUKA SETTINGS <---
    const handleOpenSettings = async (php: PhpInstance) => {
        setSelectedInstance(php);
        setIsSettingsOpen(true);
        setIsLoadingSettings(true);

        if (window.pywebview && window.pywebview.api) {
            try {
                const response = await window.pywebview.api.get_php_config(php.version);
                if (response.status === 'success') {
                    setSettingsConfig(response.config);
                    setSettingsExtensions(response.extensions);
                }
            } catch (error) {
                showToast("Gagal memuat konfigurasi dari php.ini", "error");
            }
        }
        setIsLoadingSettings(false);
    };

    const handleSaveSettings = async () => {
        if (!selectedInstance) return;

        setIsSavingSettings(true);
        try {
            // Filter hanya extension yang active
            const activeExts = settingsExtensions.filter(e => e.active).map(e => e.name);

            const response = await window.pywebview.api.save_php_config(selectedInstance.version, settingsConfig, activeExts);

            if (response.status === 'success') {
                showToast(response.message, 'success');
                setIsSettingsOpen(false);
                fetchInstalledInstances(); // Refresh halaman agar data Card berubah
            } else {
                showToast(response.message, 'error');
            }
        } catch (error) {
            showToast("Kesalahan sistem saat menyimpan konfigurasi.", "error");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleOpenIni = async (version: string) => {
        try {
            const response = await window.pywebview.api.open_php_ini(version);
            if (response.status === 'error') showToast(response.message, 'error');
        } catch (error) {
            showToast("Gagal menghubungi sistem.", "error");
        }
    };

    const handleOpenDir = async (version: string) => {
        try {
            const response = await window.pywebview.api.open_php_dir(version);
            if (response.status === 'error') showToast(response.message, 'error');
        } catch (error) {
            showToast("Gagal menghubungi sistem.", "error");
        }
    };

    const handleConfirmUninstall = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        try {
            const response = await window.pywebview.api.uninstall_php(deleteTarget.version);
            if (response.status === 'success') {
                showToast(response.message, 'success');
                setDeleteTarget(null); // Tutup modal dengan mengosongkan state
                fetchInstalledInstances();
            } else {
                showToast(response.message, 'error');
            }
        } catch (error) {
            showToast("Gagal menghapus instalasi PHP.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleStatus = async (php: PhpInstance) => {
        try {
            if (php.status === 'running') {
                // Jika sedang jalan, Hentikan
                const response = await window.pywebview.api.stop_php(php.version);
                if (response.status === 'success') {
                    showToast(response.message, 'info');
                } else {
                    showToast(response.message, 'error');
                }
            } else {
                // Jika sedang mati, Jalankan
                const response = await window.pywebview.api.start_php(php.version);
                if (response.status === 'success') {
                    showToast(response.message, 'success');
                } else {
                    showToast(response.message, 'error');
                }
            }
            // Refresh status semua instance agar UI berkedip ke status terbaru
            fetchInstalledInstances();
        } catch (error) {
            showToast("Gagal menghubungi server VyloServe.", "error");
        }
    };

    return (
        <>
            <div className="flex flex-col w-full">
                {/* --- Header & Statistik --- */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]">php</span>
                            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">PHP Versions</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                {instances.length} Instances installed
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsNewInstanceOpen(true)}
                        className="bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Version
                    </button>
                </div>

                {/* --- Render Data --- */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <span className="material-symbols-outlined animate-spin text-4xl text-slate-300">sync</span>
                    </div>
                ) : instances.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4">terminal</span>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No PHP Versions Installed</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Install multiple PHP versions to easily switch your environments.</p>
                        <button onClick={() => setIsNewInstanceOpen(true)} className="mt-4 text-sm font-medium text-primary hover:underline">
                            Download now
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {instances.map(php => {
                            const isRunning = php.status === 'running';

                            return (
                                <Card
                                    key={php.id}
                                    title={php.name}
                                    status={php.status}
                                    gridCols="grid-cols-2 md:grid-cols-3"

                                    dropdownActions={
                                        <>
                                            <button
                                                onClick={() => handleOpenIni(php.version)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            >
                                                Open php.ini
                                            </button>
                                            <button
                                                onClick={() => handleOpenDir(php.version)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            >
                                                Open Directory
                                            </button>
                                            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                            <button
                                                onClick={() => setDeleteTarget(php)} // Buka Modal Konfirmasi
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                Uninstall
                                            </button>
                                        </>
                                    }

                                    footerActions={
                                        <>
                                            {/* ---> PASANG onClick PADA TOMBOL START/STOP DI SINI <--- */}
                                            <button
                                                onClick={() => handleToggleStatus(php)}
                                                className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isRunning ? 'stop' : 'play_arrow'}
                                                </span>
                                                {isRunning ? 'Stop CGI' : 'Start CGI'}
                                            </button>

                                            <button
                                                onClick={() => handleOpenSettings(php)}
                                                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                            </button>
                                        </>
                                    }
                                >
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">FastCGI Port</span>
                                        <span className="font-mono text-sm text-primary dark:text-blue-400">{php.port}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Memory Limit</span>
                                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200">{php.memory_limit}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Path</span>
                                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={php.dir}>{php.dir}</span>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* --- MODAL INSTALASI --- */}
            <Modal
                isOpen={isNewInstanceOpen}
                onClose={() => !isInstalling && setIsNewInstanceOpen(false)}
                title="Install PHP Version"
                icon="download"
                onApply={handleInstallPhp}
                applyText={isInstalling ? "Downloading..." : "Install & Configure"}
                isApplyDisabled={isFetchingVersions || isInstalling || !installVersion}
            >
                <NewPhpInstance
                    version={installVersion}
                    setVersion={setInstallVersion}
                    setFilename={setInstallFilename}
                    port={installPort}
                    setPort={setInstallPort}
                    isInstalling={isInstalling}
                    isFetchingVersions={isFetchingVersions}
                    setIsFetchingVersions={setIsFetchingVersions}
                />
            </Modal>

            {/* ---> MODAL SETTINGS BARU <--- */}
            <Modal
                isOpen={isSettingsOpen}
                onClose={() => !isSavingSettings && setIsSettingsOpen(false)}
                title={`${selectedInstance?.name || 'PHP'} Configuration`}
                icon="tune"
                onApply={handleSaveSettings}
                applyText={isSavingSettings ? "Saving..." : "Save Changes"}
                isApplyDisabled={isLoadingSettings || isSavingSettings}
            >
                <PhpSettings
                    config={settingsConfig}
                    setConfig={setSettingsConfig}
                    extensions={settingsExtensions}
                    setExtensions={setSettingsExtensions}
                    isLoading={isLoadingSettings}
                />
            </Modal>

            {/* ---> MODAL KONFIRMASI HAPUS <--- */}
            <Modal
                isOpen={deleteTarget !== null}
                onClose={() => !isDeleting && setDeleteTarget(null)}
                title="Confirm Uninstall"
                icon="delete_forever"
                onApply={handleConfirmUninstall}
                applyText={isDeleting ? "Uninstalling..." : "Yes, Uninstall"}
                isApplyDisabled={isDeleting}
                isDestructive={true} // Membuat tombol apply berwarna merah
            >
                <div className="flex flex-col gap-3">
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">
                            You are about to delete {deleteTarget?.name}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-300">
                            This action will permanently remove all binary files and the <code>php.ini</code> configuration for this version. This action cannot be undone.
                        </p>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 px-1 mt-2">
                        Are you sure you want to proceed?
                    </p>
                </div>
            </Modal>
        </>
    );
}