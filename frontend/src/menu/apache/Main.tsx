// src/menu/apache/Main.tsx
import { useState } from 'react';
import ProjectCard from '../../components/ProjectCard';
import type { ProjectProps } from '../../components/ProjectCard';
import LogsPanel from '../../components/LogsPanel';
import Modal from '../../components/Modal';

import ApacheSettings from './Settings';
import NewApacheProject from './NewProject';
import ProjectSettings from './ProjectSettings';

const DUMMY_PROJECTS: ProjectProps[] = [
    { id: '1', name: 'E-Commerce App', version: '2.4.54', size: '124 MB', domain: 'shop.local' },
    { id: '2', name: 'Portfolio Website', version: '1.0.2', size: '45 MB', domain: 'portfolio.local' },
    { id: '3', name: 'Internal CRM', version: '3.2.0', size: '210 MB', domain: 'crm.local' },
];

interface ApacheMainProps {
    isDesktopCollapsed: boolean;
}

export default function ApacheMain({ isDesktopCollapsed }: ApacheMainProps) {
    // States untuk kontrol modal
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

    // States untuk spesifik project
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Ambil data project yang sedang dipilih
    const selectedProject = DUMMY_PROJECTS.find(p => p.id === selectedProjectId);

    const mainContentMargin = isDesktopCollapsed ? 'md:ml-20' : 'md:ml-sidebar-width';

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
            <main className={`flex-1 px-4 py-6 md:px-8 md:py-8 w-full transition-all duration-300 ${mainContentMargin}`}>
                {/* Header Server */}
                <div className="flex flex-col gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]" style={{ fontVariationSettings: "'FILL' 0" }}>dns</span>
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Apache Server</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                            Running
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">settings_ethernet</span>
                            Port: 80, 443
                        </span>
                    </div>
                </div>

                {/* Project List Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Projects</h3>
                    <div className="flex gap-3">
                        <button onClick={() => setIsOptionsOpen(true)} className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">tune</span>
                            <span className="hidden sm:inline">Options</span>
                        </button>
                        <button onClick={() => setIsNewProjectOpen(true)} className="bg-primary hover:bg-blue-600 border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">Add Project</span>
                        </button>
                    </div>
                </div>

                {/* Project List */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-4 col-span-full">
                        {DUMMY_PROJECTS.map(project => (
                            <ProjectCard
                                key={project.id}
                                {...project}
                                onSettingsClick={handleOpenProjectSettings}
                                onDeleteClick={handleOpenDeleteConfirm}
                            />
                        ))}
                    </div>
                </div>

                <LogsPanel />
            </main>

            {/* --- KUMPULAN MODALS --- */}
            <Modal isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} title="Apache Settings" icon="tune" onApply={() => setIsOptionsOpen(false)}>
                <ApacheSettings />
            </Modal>

            <Modal isOpen={isNewProjectOpen} onClose={() => setIsNewProjectOpen(false)} title="New Apache Project" icon="create_new_folder" onApply={() => setIsNewProjectOpen(false)} applyText="Create Project">
                <NewApacheProject />
            </Modal>

            <Modal isOpen={isProjectSettingsOpen} onClose={() => setIsProjectSettingsOpen(false)} title={`Settings: ${selectedProject?.name}`} icon="settings" onApply={() => setIsProjectSettingsOpen(false)}>
                {selectedProject && <ProjectSettings project={selectedProject} />}
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Delete Project" icon="warning" onApply={() => setIsDeleteConfirmOpen(false)} applyText="Yes, Delete" isDanger={true}>
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{selectedProject?.name}</strong>?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        This will remove the local domain routing and virtual host configuration. Your actual project files in the document root will <strong>not</strong> be deleted.
                    </p>
                </div>
            </Modal>
        </>
    );
}