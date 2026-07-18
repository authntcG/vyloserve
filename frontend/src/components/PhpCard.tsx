// src/menu/php/PhpCard.tsx

export interface PhpInstanceProps {
    id: string;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    memoryLimit: string;
    onSettingsClick?: (id: string) => void;
    onDeleteClick?: (id: string) => void;
}

export default function PhpCard({ id, version, port, status, memoryLimit, onSettingsClick, onDeleteClick }: PhpInstanceProps) {
    const isRunning = status === 'running';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">PHP {version}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${isRunning
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isRunning ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {isRunning ? 'Running' : 'Stopped'}
                    </span>
                </div>

                {/* Dropdown Menu */}
                <div className="relative group/menu">
                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200">
                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Open php.ini</button>
                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Manage Extensions</button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        <button onClick={() => onDeleteClick?.(id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Remove Version</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">FastCGI Port</span>
                    <span className="font-mono text-sm text-primary dark:text-blue-400">{port}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Memory Limit</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{memoryLimit}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-200">Thread Safe (TS)</span>
                </div>
            </div>

            <div className="flex gap-3 mt-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button className={`flex-1 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm ${isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                    <span className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span>
                    {isRunning ? 'Stop CGI' : 'Start CGI'}
                </button>
                <button onClick={() => onSettingsClick?.(id)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">tune</span> Configure
                </button>
            </div>
        </div>
    );
}