import { useState } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';

import NewDbInstance from './NewInstance';
import DbSettings from './Settings';

// Data Instance DB Dummy
const DUMMY_DB_INSTANCES = [
    { id: 'mariadb10', name: 'MariaDB 10.11', port: 3306, status: 'running' as const, dataDir: 'C:/VyloServe/data/mariadb10', version: '10.11.7' },
    { id: 'mysql8', name: 'MySQL 8.0', port: 3307, status: 'stopped' as const, dataDir: 'C:/VyloServe/data/mysql8', version: '8.0.36' },
];

export default function MariadbMain() {
    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);
    const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const selectedDb = DUMMY_DB_INSTANCES.find(p => p.id === selectedDbId);

    const handleOpenSettings = (id: string) => {
        setSelectedDbId(id);
        setIsSettingsOpen(true);
    };

    const handleOpenDeleteConfirm = (id: string) => {
        setSelectedDbId(id);
        setIsDeleteConfirmOpen(true);
    };

    return (
        <>
            <div className="flex flex-col w-full">
                {/* --- Header DB dengan Status --- */}
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
                            2 Instances installed
                        </span>
                    </div>
                </div>

                {/* Section Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Database Instances</h3>
                    <div className="flex gap-3">
                        <button className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">open_in_browser</span>
                            <span className="hidden sm:inline">Open phpMyAdmin</span>
                        </button>
                        <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">Add Engine</span>
                        </button>
                    </div>
                </div>

                {/* Grid Menggunakan Komponen Card Generik */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                    {DUMMY_DB_INSTANCES.map(db => {
                        const isRunning = db.status === 'running';
                        return (
                            <Card
                                key={db.id}
                                title={db.name}
                                status={db.status}
                                gridCols="grid-cols-2 md:grid-cols-3"

                                dropdownActions={
                                    <>
                                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open my.ini</button>
                                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Data Folder</button>
                                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                        <button onClick={() => handleOpenDeleteConfirm(db.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Drop Engine</button>
                                    </>
                                }

                                footerActions={
                                    <>
                                        <button className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                            <span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span>
                                            {isRunning ? 'Stop DB' : 'Start DB'}
                                        </button>
                                        <button onClick={() => handleOpenSettings(db.id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                            <span className="material-symbols-outlined text-[18px]">tune</span> Config
                                        </button>
                                    </>
                                }
                            >
                                {/* Children Data Grid Khusus Database */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Version</span>
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{db.version}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</span>
                                    <span className="font-mono text-sm text-primary dark:text-blue-400">{db.port}</span>
                                </div>
                                <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Directory</span>
                                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={db.dataDir}>{db.dataDir}</span>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* --- MODALS --- */}
            <Modal isOpen={isNewInstanceOpen} onClose={() => setIsNewInstanceOpen(false)} title="Install Database Engine" icon="download" onApply={() => setIsNewInstanceOpen(false)} applyText="Install">
                <NewDbInstance />
            </Modal>
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title={`${selectedDb?.name} Configuration`} icon="tune" onApply={() => setIsSettingsOpen(false)}>
                {selectedDb && <DbSettings instance={selectedDb} />}
            </Modal>
            <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Drop Database Engine" icon="warning" onApply={() => setIsDeleteConfirmOpen(false)} applyText="Yes, Drop" isDanger={true}>
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to completely remove <strong className="text-slate-900 dark:text-white">{selectedDb?.name}</strong>?
                    </p>
                    <p className="text-sm text-red-500 font-medium mt-2">
                        Warning: This action will NOT delete your raw databases in the data directory, but the engine binary will be removed.
                    </p>
                </div>
            </Modal>
        </>
    );
}