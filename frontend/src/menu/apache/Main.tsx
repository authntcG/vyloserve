import { useState } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';

import ApacheSettings from './Settings';
import NewApacheProject from './NewProject';
import ProjectSettings from './ProjectSettings';

// Dummy data diperbarui dengan field framework
const DUMMY_PROJECTS = [
    { id: '1', name: 'E-Commerce App', version: '2.4.54', size: '124 MB', domain: 'shop.local', framework: 'Laravel', frameworkVer: '10.x' },
    { id: '2', name: 'Portfolio Website', version: '1.0.2', size: '45 MB', domain: 'portfolio.local', framework: 'Wordpress', frameworkVer: '6.4' },
    { id: '3', name: 'Internal CRM', version: '3.2.0', size: '210 MB', domain: 'crm.local', framework: 'CodeIgniter', frameworkVer: '4.x' },
];

export default function ApacheMain() {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const selectedProject = DUMMY_PROJECTS.find(p => p.id === selectedProjectId);

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
            <div className="flex flex-col w-full">
                {/* --- Header Server dengan Status --- */}
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

                {/* --- Render Card Menggunakan Komponen Generik --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                    {DUMMY_PROJECTS.map(project => (
                        <Card
                            key={project.id}
                            title={project.name}

                            dropdownActions={
                                <>
                                    <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Config File</button>
                                    <button onClick={() => handleOpenProjectSettings(project.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Settings</button>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                    <button onClick={() => handleOpenDeleteConfirm(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                                </>
                            }

                            footerActions={
                                <>
                                    <button className="flex-1 bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">restart_alt</span> Restart
                                    </button>
                                    <button onClick={() => handleOpenProjectSettings(project.id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">settings</span> Settings
                                    </button>
                                </>
                            }
                        >
                            {/* Children Data Grid Khusus Apache Project */}
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Framework</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                    {project.framework} <span className="text-xs text-slate-500 ml-1">({project.frameworkVer})</span>
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Size</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{project.size}</span>
                            </div>
                            <div className="flex flex-col gap-1 col-span-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Local Domain</span>
                                <a href={`http://${project.domain}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-primary dark:text-blue-400 flex items-center gap-1.5 hover:underline w-fit">
                                    {project.domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* --- KUMPULAN MODALS --- */}
            <Modal isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} title="Apache Settings" icon="tune" onApply={() => setIsOptionsOpen(false)}>
                <ApacheSettings />
            </Modal>

            <Modal isOpen={isNewProjectOpen} onClose={() => setIsNewProjectOpen(false)} title="New Apache Project" icon="create_new_folder" onApply={() => setIsNewProjectOpen(false)} applyText="Create Project">
                <NewApacheProject />
            </Modal>

            <Modal isOpen={isProjectSettingsOpen} onClose={() => setIsProjectSettingsOpen(false)} title={`Settings: ${selectedProject?.name}`} icon="settings" onApply={() => setIsProjectSettingsOpen(false)}>
                {selectedProject && <ProjectSettings project={selectedProject as any} />}
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