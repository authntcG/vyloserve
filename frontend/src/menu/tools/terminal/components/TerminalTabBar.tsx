import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TerminalSession, ShellInfo } from "../types";

interface TerminalTabBarProps {
    readonly sessions: TerminalSession[];
    readonly activeSessionId: string | null;
    readonly availableShells: ShellInfo[];
    readonly onSelectTab: (sessionId: string) => void;
    readonly onCloseTab: (sessionId: string) => void;
    readonly onNewTab: (shellId?: string) => void;
}

export default function TerminalTabBar({
    sessions,
    activeSessionId,
    availableShells,
    onSelectTab,
    onCloseTab,
    onNewTab
}: TerminalTabBarProps) {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    return (
        <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-2 pt-2 rounded-t-xl select-none min-h-[44px]">
            {/* Tab items list */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[calc(100%-120px)]">
                {sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                        <div
                            key={session.id}
                            onClick={() => onSelectTab(session.id)}
                            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-colors max-w-[180px] border-t border-x ${
                                isActive
                                    ? "bg-[#090d16] text-white border-slate-700 shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
                                terminal
                            </span>

                            <span className="truncate flex-1" title={session.title}>
                                {session.title}
                            </span>

                            {session.isClosed && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title={t('tools.terminal.session_closed_msg', { code: session.exitCode ?? 0 })} />
                            )}

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(session.id);
                                }}
                                className="p-0.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity"
                                title={t('tools.terminal.close_tab')}
                            >
                                <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Actions: Add new tab dropdown */}
            <div className="flex items-center gap-1.5 relative shrink-0" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => onNewTab()}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-xs font-medium gap-1"
                    title={t('tools.terminal.new_tab')}
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                </button>

                <button
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
                    title={t('tools.terminal.shell_selector')}
                >
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {t('tools.terminal.shell_selector')}
                        </div>
                        {availableShells.map((shell) => (
                            <button
                                key={shell.id}
                                type="button"
                                disabled={!shell.available}
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onNewTab(shell.id);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                                    shell.available
                                        ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70"
                                        : "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50"
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px] text-primary">
                                    {shell.icon || "terminal"}
                                </span>
                                <span className="flex-1 font-medium">{shell.name}</span>
                                {shell.is_default && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                                        default
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
