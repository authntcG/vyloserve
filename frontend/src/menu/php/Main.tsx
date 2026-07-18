import { useState } from 'react';
import PhpCard from '../../components/PhpCard';
import type { PhpInstanceProps } from '../../components/PhpCard';
import Modal from '../../components/Modal';

import NewPhpInstance from './NewInstance';
import PhpSettings from './Settings';

// Dummy data untuk multiple versi PHP yang terinstal
const DUMMY_PHP_INSTANCES: PhpInstanceProps[] = [
    { id: 'php83', version: '8.3.4', port: 9000, status: 'running', memoryLimit: '512M' },
    { id: 'php81', version: '8.1.27', port: 9001, status: 'stopped', memoryLimit: '256M' },
];

export default function PhpMain() {
    const [isNewInstanceOpen, setIsNewInstanceOpen] = useState(false);

    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const selectedInstance = DUMMY_PHP_INSTANCES.find(p => p.id === selectedInstanceId);

    const handleOpenSettings = (id: string) => {
        setSelectedInstanceId(id);
        setIsSettingsOpen(true);
    };

    const handleOpenDeleteConfirm = (id: string) => {
        setSelectedInstanceId(id);
        setIsDeleteConfirmOpen(true);
    };

    return (
        <>
            <div className="flex flex-col w-full">

                {/* Header Layanan */}
                <div className="flex flex-col gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]" style={{ fontVariationSettings: "'FILL' 0" }}>code</span>
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">PHP Engine</h2>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Manage PHP FastCGI instances. Apache automatically routes project traffic to these CGI ports based on project settings.
                    </p>
                </div>

                {/* Section Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Installed Versions</h3>
                    <div className="flex gap-3">
                        <button onClick={() => setIsNewInstanceOpen(true)} className="bg-primary hover:bg-blue-600 border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95">
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            <span className="hidden sm:inline">Add PHP Version</span>
                        </button>
                    </div>
                </div>

                {/* Instances Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {DUMMY_PHP_INSTANCES.map(instance => (
                        <PhpCard
                            key={instance.id}
                            {...instance}
                            onSettingsClick={handleOpenSettings}
                            onDeleteClick={handleOpenDeleteConfirm}
                        />
                    ))}
                </div>

            </div>

            {/* --- MODALS --- */}
            <Modal isOpen={isNewInstanceOpen} onClose={() => setIsNewInstanceOpen(false)} title="Install PHP Version" icon="download" onApply={() => setIsNewInstanceOpen(false)} applyText="Install & Configure">
                <NewPhpInstance />
            </Modal>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title={`PHP ${selectedInstance?.version} Settings`} icon="tune" onApply={() => setIsSettingsOpen(false)}>
                {selectedInstance && <PhpSettings instance={selectedInstance} />}
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Remove PHP Version" icon="warning" onApply={() => setIsDeleteConfirmOpen(false)} applyText="Yes, Remove" isDanger={true}>
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to remove <strong className="text-slate-900 dark:text-white">PHP {selectedInstance?.version}</strong> from your system?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Projects currently assigned to this PHP version will fall back to the default version.
                    </p>
                </div>
            </Modal>
        </>
    );
}