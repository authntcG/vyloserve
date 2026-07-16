export interface ProjectProps {
    id: string;
    name: string;
    version: string;
    size: string;
    domain: string;
    onSettingsClick?: (id: string) => void;
    onDeleteClick?: (id: string) => void;
}

export default function ProjectCard({ id, name, version, size, domain, onSettingsClick, onDeleteClick }: ProjectProps) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{name}</h3>

                {/* Dropdown Menu */}
                <div className="relative group/menu">
                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200">
                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open Config File</button>
                        <button onClick={() => onSettingsClick?.(id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Project Settings</button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        {/* Tombol Delete Baru */}
                        <button onClick={() => onDeleteClick?.(id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Project</button>
                    </div>
                </div>
            </div>

            {/* ... (grid info version, size, domain dibiarkan sama seperti sebelumnya) ... */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Version</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{version}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Size</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{size}</span>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Local Domain</span>
                    <a href={`http://${domain}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-primary dark:text-blue-400 flex items-center gap-1.5 hover:underline w-fit">
                        {domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                </div>
            </div>

            {/* Tombol Action Bawah */}
            <div className="flex gap-3 mt-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button className="flex-1 bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span> Restart
                </button>
                <button onClick={() => onSettingsClick?.(id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">settings</span> Settings
                </button>
            </div>
        </div>
    );
}