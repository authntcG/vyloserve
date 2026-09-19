import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'success';
    source?: string;
}

// Jumlah maksimum entri log yang disimpan di memori -- tanpa batas ini array bisa tumbuh
// terus tanpa henti selama aplikasi berjalan lama (lihat docs/known_bugs.md #25).
const MAX_LOG_ENTRIES = 500;

export default function LogsPanel() {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [logs, setLogs] = useState<LogEntry[]>([
        { id: 'log-init', timestamp: new Date().toLocaleTimeString(), message: t('components.logs.backend_initialized'), level: 'info' }
    ]);

    // Filter level/source dipersist di backend (data/settings.json) lewat modal pengaturan
    // System Logs (gear icon di sidebar). null = belum dikustomisasi user -> tampilkan semua
    // (juga nilai awal sebelum settings selesai di-fetch). Array (TERMASUK array kosong) =
    // daftar eksplisit yang tersimpan -- array kosong berarti user sengaja uncheck semua,
    // BUKAN "tampilkan semua". Membedakan null vs [] penting: kalau disamakan, uncheck-semua-
    // lalu-Save akan terlihat seolah tidak tersimpan (lihat docs/known_bugs.md).
    const [shownLevels, setShownLevels] = useState<string[] | null>(null);
    const [shownSources, setShownSources] = useState<string[] | null>(null);

    const [isCopied, setIsCopied] = useState(false);
    const [panelHeight, setPanelHeight] = useState(128);

    const scrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startHeight = useRef(0);
    const logCounter = useRef(1); // Counter deterministik pengganti random

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startY.current = e.clientY;
        startHeight.current = panelHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const deltaY = startY.current - e.clientY;
            setPanelHeight(Math.min(Math.max(startHeight.current + deltaY, 100), window.innerHeight * 0.8));
        };

        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        const handleLogEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            logCounter.current += 1;

            // i18next will translate if it's a valid key, otherwise it returns the original string (safe fallback)
            const rawMsg = customEvent.detail.message;
            const args = customEvent.detail.args || {};
            const translatedMsg = t(rawMsg, args) as string;

            const newLog: LogEntry = {
                id: `log-${logCounter.current}`,
                timestamp: new Date().toLocaleTimeString(),
                message: translatedMsg,
                level: customEvent.detail.level || 'info',
                source: customEvent.detail.source
            };
            setLogs((prev) => [...prev, newLog].slice(-MAX_LOG_ENTRIES));
        };

        window.addEventListener('vylo_log', handleLogEvent);
        return () => window.removeEventListener('vylo_log', handleLogEvent);
    }, [t]);

    useEffect(() => {
        const loadLogFilterSettings = () => {
            const api = (window as any).pywebview?.api;
            if (!api || typeof api.get_app_settings !== 'function') return;
            api.get_app_settings().then((res: any) => {
                if (res?.status !== 'success') return;
                setShownLevels(res.data?.system_log_levels ?? null);
                setShownSources(res.data?.system_log_sources ?? null);
            }).catch((err: any) => console.error(err));
        };

        loadLogFilterSettings();
        // Modal pengaturan System Logs mem-broadcast event ini setelah "Save" ditekan,
        // sehingga panel ini langsung ikut menyaring tanpa perlu remount komponen.
        window.addEventListener('vylo_log_settings_changed', loadLogFilterSettings);
        return () => window.removeEventListener('vylo_log_settings_changed', loadLogFilterSettings);
    }, []);

    // null (belum dikustomisasi / belum selesai fetch) = tampilkan semua level/source.
    // Array (termasuk array kosong) = daftar eksplisit tersimpan -- lihat core/services/settings.py
    const filteredLogs = useMemo(() => logs.filter((log) => {
        const levelMatches = shownLevels === null || shownLevels.includes(log.level);
        const sourceMatches = shownSources === null || !log.source || shownSources.includes(log.source);
        return levelMatches && sourceMatches;
    }), [logs, shownLevels, shownSources]);

    useEffect(() => {
        if (scrollRef.current && isExpanded && isAutoScroll) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredLogs, isExpanded, isAutoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
        if (isAtBottom && !isAutoScroll) {
            setIsAutoScroll(true);
        } else if (!isAtBottom && isAutoScroll) {
            setIsAutoScroll(false);
        }
    };

    const copyLogsToClipboard = () => {
        const logText = filteredLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(logText);
            } else {
                // execCommand('copy') sudah deprecated, tapi ini satu-satunya fallback clipboard yang
                // berfungsi di non-secure context (mis. window pywebview tanpa HTTPS). Tidak ada
                // pengganti aman; dipertahankan dengan sengaja (lihat docs/known_bugs.md).
                const textArea = document.createElement("textarea");
                textArea.value = logText;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy'); // NOSONAR typescript:S1874
                textArea.remove();
            }
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err){ console.error(err);
            console.error("Gagal menyalin log:", err);
        }
    };


    const getBadgeColor = (level: string) => {
        switch (level) {
            case 'success': return 'text-emerald-400';
            case 'warn': return 'text-amber-400';
            case 'error': return 'text-red-400';
            default: return 'text-blue-400';
        }
    };

    const getMessageColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-amber-400';
            default: return 'text-slate-300';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] w-full relative z-10">
            {isExpanded && (
                <button
                    type="button"
                    onMouseDown={handleMouseDown}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') setPanelHeight(h => Math.min(Math.max(h + 20, 100), window.innerHeight * 0.8));
                        if (e.key === 'ArrowDown') setPanelHeight(h => Math.min(Math.max(h - 20, 100), window.innerHeight * 0.8));
                    }}
                    aria-label={t('components.logs.resize_panel', 'Drag or use arrow keys to resize panel')}
                    className="absolute top-0 left-0 w-full h-4 cursor-ns-resize flex justify-center items-start group z-20 outline-none"
                    title={t('components.logs.resize_panel', 'Drag or use arrow keys to resize panel')}
                >
                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
            )}

            <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">terminal</span>
                    {t('components.logs.title')}
                </h3>

                <div className="flex items-center gap-3">
                    <button type="button" onClick={copyLogsToClipboard} className={`text-xs font-medium transition-colors flex items-center gap-1 ${isCopied ? 'text-emerald-500' : 'text-slate-500 hover:text-primary'}`}>
                        <span className="material-symbols-outlined text-[14px]">{isCopied ? 'check' : 'content_copy'}</span>
                        {isCopied ? t('components.logs.copied') : t('components.logs.copy')}
                    </button>
                    <button type="button" onClick={() => setIsAutoScroll(!isAutoScroll)} className={`text-xs font-medium transition-colors flex items-center gap-1 ${isAutoScroll ? 'text-slate-500 hover:text-amber-500' : 'text-amber-500'}`}>
                        <span className="material-symbols-outlined text-[14px]">{isAutoScroll ? 'pause_circle' : 'play_circle'}</span>
                        {isAutoScroll ? t('components.logs.auto') : t('components.logs.paused')}
                    </button>
                    <button type="button" onClick={() => setLogs([])} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">delete</span>{t('components.logs.clear')}
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                    <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <span className="material-symbols-outlined text-slate-500 text-[18px]">{isExpanded ? 'expand_more' : 'expand_less'}</span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    style={{ height: `${panelHeight}px` }}
                    className={`bg-slate-950 rounded-md p-3 font-mono text-xs leading-relaxed border shadow-inner overflow-y-auto transition-colors select-text cursor-text ${!isAutoScroll ? 'border-amber-500/50' : 'border-slate-800'}`}
                >
                    {filteredLogs.map((log) => (
                        <div key={log.id} className="vylo-log-area flex gap-2 mb-1 font-medium hover:bg-slate-900/50 px-1 py-0.5 rounded transition-colors">
                            <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                            {log.source && <span className="text-purple-400 shrink-0 select-none">[{log.source.toUpperCase()}]</span>}
                            <span className={`shrink-0 select-none font-bold ${getBadgeColor(log.level)}`}>[{log.level.toUpperCase()}]</span>
                            <span className={`${getMessageColor(log.level)} break-all selection:bg-primary/50 selection:text-white`}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="text-slate-500 italic select-none mt-1">
                            {logs.length > 0 
                                ? t('components.logs.hidden_by_filter', { count: logs.length, defaultValue: `${logs.length} log(s) hidden by filter...` }) 
                                : t('components.logs.empty')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}