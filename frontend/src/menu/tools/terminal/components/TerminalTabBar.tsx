import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TerminalSession, ShellInfo } from "../types";

interface TerminalTabBarProps {
    readonly sessions: TerminalSession[];
    readonly activeSessionId: string | null;
    readonly availableShells: ShellInfo[];
    readonly onSelectTab: (sessionId: string) => void;
    readonly onCloseTab: (sessionId: string) => void;
    readonly onNewTab: (shellId?: string) => void;
    readonly actionsSlot?: React.ReactNode;
}

const TAB_COLOR_MAP: Record<string, string> = {
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400"
};

export default function TerminalTabBar({
    sessions,
    activeSessionId,
    availableShells,
    onSelectTab,
    onCloseTab,
    onNewTab,
    actionsSlot
}: TerminalTabBarProps) {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!isMenuOpen) return;
        const updatePosition = () => {
            const rect = menuRef.current?.getBoundingClientRect();
            if (rect) {
                const maxLeft = Math.max(8, window.innerWidth - 210);
                const left = Math.min(rect.left, maxLeft);
                const top = rect.bottom + 4;
                setPanelPosition({ top, left: Math.max(8, left) });
            }
        };
        updatePosition();
        const handleScroll = (event: Event) => {
            if (event.target instanceof Node && dropdownRef.current?.contains(event.target)) return;
            setIsMenuOpen(false);
        };
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", handleScroll, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (dropdownRef.current?.contains(target)) return;
            setIsMenuOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMenuOpen]);

    return (
        <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-2 pt-2 rounded-t-xl select-none min-h-[44px] gap-2">
            {/* Tab items list + Integrated New Tab Button */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
                {/* Scrollable Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                    {sessions.map((session) => {
                        const isActive = session.id === activeSessionId;
                        return (
                            <div
                                key={session.id}
                                onClick={() => onSelectTab(session.id)}
                                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-colors max-w-[180px] border-t border-x shrink-0 ${
                                    isActive
                                        ? "bg-[#090d16] text-white border-slate-700 shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                            >
                                {session.color ? (
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            TAB_COLOR_MAP[session.color] || "bg-emerald-400"
                                        }`}
                                    />
                                ) : (
                                    <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
                                        {session.icon || "terminal"}
                                    </span>
                                )}

                                <span className="truncate flex-1" title={session.title}>
                                    {session.title}
                                </span>

                                {session.isCustomEnv && (
                                    <span
                                        className="material-symbols-outlined text-[13px] text-amber-500 shrink-0"
                                        title={t("tools.terminal.custom_env_badge")}
                                    >
                                        bolt
                                    </span>
                                )}

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

                {/* Integrated New Tab + Shell Dropdown Split-Button (outside overflow-x-auto) */}
                <div
                    ref={menuRef}
                    className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700/80 transition-colors shrink-0 relative ml-0.5 mb-1"
                >
                    <button
                        type="button"
                        onClick={() => onNewTab()}
                        className="p-1 px-1.5 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                        title={t('tools.terminal.new_tab')}
                        aria-label={t('tools.terminal.new_tab')}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[17px]">add</span>
                    </button>
                    <span className="w-px h-3.5 bg-slate-300 dark:bg-slate-700" />
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-1 px-1 transition-colors flex items-center justify-center cursor-pointer ${
                            isMenuOpen
                                ? "text-primary dark:text-primary"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                        title={t('tools.terminal.shell_selector')}
                        aria-label={t('tools.terminal.shell_selector')}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">expand_more</span>
                    </button>
                </div>
            </div>

            {/* Actions: Presets / Saved sessions menu */}
            <div className="flex items-center gap-1.5 relative shrink-0">
                {actionsSlot}
            </div>

            {/* Portal-rendered Popup list of Shell options */}
            {isMenuOpen && panelPosition && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: "fixed",
                        top: panelPosition.top,
                        left: panelPosition.left,
                        zIndex: 9999
                    }}
                    className="w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-1 select-none animate-in fade-in zoom-in-95"
                >
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
                                    ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 cursor-pointer"
                                    : "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50"
                            }`}
                        >
                            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary">
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
                </div>,
                document.body
            )}
        </div>
    );
}
