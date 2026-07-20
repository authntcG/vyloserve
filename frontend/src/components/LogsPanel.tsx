import { useState, useEffect, useRef } from "react";

interface LogEntry {
    id: number;
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'success';
}

export default function LogsPanel() {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAutoScroll, setIsAutoScroll] = useState(true); // State baru untuk Pause/Resume
    const [logs, setLogs] = useState<LogEntry[]>([
        { id: 1, timestamp: new Date().toLocaleTimeString(), message: 'VyloServe Backend Initialized', level: 'info' }
    ]);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Dengarkan Event 'vylo_log' dari Python
    useEffect(() => {
        const handleLogEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            const newLog: LogEntry = {
                id: Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                message: customEvent.detail.message,
                level: customEvent.detail.level || 'info'
            };

            setLogs((prev) => [...prev, newLog]);
        };

        window.addEventListener('vylo_log', handleLogEvent);
        return () => window.removeEventListener('vylo_log', handleLogEvent);
    }, []);

    // Auto-scroll HANYA berjalan jika isAutoScroll aktif
    useEffect(() => {
        if (scrollRef.current && isExpanded && isAutoScroll) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isExpanded, isAutoScroll]);

    // Fitur Praktis: Salin seluruh log ke Clipboard
    const copyLogsToClipboard = () => {
        const logText = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(logText);
    };

    const getColorClass = (level: string) => {
        switch (level) {
            case 'success': return 'text-emerald-400';
            case 'warn': return 'text-amber-400';
            case 'error': return 'text-red-400';
            default: return 'text-slate-300';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] w-full relative z-10">
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">terminal</span>
                    System Logs
                </h3>

                <div className="flex items-center gap-3">
                    {/* Tombol Copy Logs */}
                    <button
                        onClick={copyLogsToClipboard}
                        title="Copy All Logs"
                        className="text-xs font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        Copy
                    </button>

                    {/* Tombol Pause/Resume Scroll */}
                    <button
                        onClick={() => setIsAutoScroll(!isAutoScroll)}
                        title={isAutoScroll ? "Pause Auto-scroll" : "Resume Auto-scroll"}
                        className={`text-xs font-medium transition-colors flex items-center gap-1 ${isAutoScroll ? 'text-slate-500 hover:text-amber-500' : 'text-amber-500 hover:text-amber-600'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[14px]">
                            {isAutoScroll ? 'pause_circle' : 'play_circle'}
                        </span>
                        {isAutoScroll ? 'Auto' : 'Paused'}
                    </button>

                    {/* Tombol Clear */}
                    <button
                        onClick={() => setLogs([])}
                        title="Clear Logs"
                        className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Clear
                    </button>

                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                    {/* Tombol Expand/Collapse */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-500 text-[18px]">
                            {isExpanded ? 'expand_more' : 'expand_less'}
                        </span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div
                    ref={scrollRef}
                    // Jika user melakukan scroll manual (pakai mouse wheel), matikan auto-scroll
                    onWheel={() => setIsAutoScroll(false)}
                    className={`bg-slate-950 rounded-md p-3 font-mono text-xs leading-relaxed border shadow-inner h-32 overflow-y-auto transition-colors ${!isAutoScroll ? 'border-amber-500/50' : 'border-slate-800'
                        }`}
                >
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-3 mb-1 font-medium hover:bg-slate-900/50 px-1 rounded">
                            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                            <span className={`${getColorClass(log.level)} break-all selection:bg-primary/30`}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-slate-600 italic">No logs available...</div>}
                </div>
            )}
        </div>
    );
}