import { useState } from "react";

export default function LogsPanel() {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] w-full">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Logs</h3>
                <div className="flex items-center">
                    <a href="#" className="text-xs font-medium text-primary dark:text-blue-400 hover:underline">View All</a>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors ml-2"
                    >
                        <span className="material-symbols-outlined text-slate-500 text-[18px]">
                            {isExpanded ? 'expand_more' : 'expand_less'}
                        </span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="bg-slate-950 rounded-md p-3 font-mono text-xs leading-relaxed overflow-x-auto border border-slate-800 shadow-inner h-32 overflow-y-auto">
                    <div className="text-emerald-400">[Tue Oct 24 10:45:12] [notice] Apache/2.4.54 configured</div>
                    <div className="text-slate-400">[Tue Oct 24 10:45:13] [info] Server built: Oct 19 2023</div>
                    <div className="text-blue-400">[Tue Oct 24 10:48:02] [client 127.0.0.1] GET /shop HTTP/1.1 200</div>
                    <div className="text-amber-400">[Tue Oct 24 10:51:14] [warn] module rewrite_module is already loaded</div>
                    <div className="text-slate-400">[Tue Oct 24 10:52:01] [info] Server configured, listening on: port 80, 443</div>
                </div>
            )}
        </div>
    );
}