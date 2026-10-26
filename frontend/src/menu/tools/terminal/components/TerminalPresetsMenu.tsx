import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TerminalPreset, TerminalWorkspace, TerminalSession } from "../types";

interface TerminalPresetsMenuProps {
    readonly presets: TerminalPreset[];
    readonly workspaces: TerminalWorkspace[];
    readonly activeSession?: TerminalSession;
    readonly totalSessions: number;
    readonly onLaunchPreset: (preset: TerminalPreset) => void;
    readonly onDeletePreset: (presetId: string) => void;
    readonly onLaunchWorkspace: (workspace: TerminalWorkspace) => void;
    readonly onDeleteWorkspace: (workspaceId: string) => void;
    readonly onOpenSavePresetModal: () => void;
    readonly onOpenSaveWorkspaceModal: () => void;
}

const COLOR_MAP: Record<string, string> = {
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400"
};

export default function TerminalPresetsMenu({
    presets,
    workspaces,
    activeSession,
    totalSessions,
    onLaunchPreset,
    onDeletePreset,
    onLaunchWorkspace,
    onDeleteWorkspace,
    onOpenSavePresetModal,
    onOpenSaveWorkspaceModal
}: TerminalPresetsMenuProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<{ top: number; right: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            const rect = menuRef.current?.getBoundingClientRect();
            if (rect) {
                const right = Math.max(8, window.innerWidth - rect.right);
                const top = rect.bottom + 6;
                setPanelPosition({ top, right });
            }
        };
        updatePosition();
        const handleScroll = (event: Event) => {
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            setIsOpen(false);
        };
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", handleScroll, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="relative shrink-0" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1.5 rounded-md transition-colors flex items-center justify-center text-xs font-medium gap-1 cursor-pointer ${
                    isOpen
                        ? "bg-primary text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800"
                }`}
                title={t("tools.terminal.saved_sessions_btn")}
                aria-label={t("tools.terminal.saved_sessions_btn")}
            >
                <span className="material-symbols-outlined text-[17px]">bookmarks</span>
            </button>

            {isOpen && panelPosition && createPortal(
                <div
                    ref={panelRef}
                    style={{
                        position: "fixed",
                        top: panelPosition.top,
                        right: panelPosition.right,
                        zIndex: 9999
                    }}
                    className="w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 select-none animate-in fade-in zoom-in-95 max-h-[460px] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="px-3 pb-2 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            {t("tools.terminal.saved_sessions_btn")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {presets.length} P · {workspaces.length} W
                        </span>
                    </div>

                    {/* Section 1: Saved Tabs */}
                    <div className="py-1">
                        <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">terminal</span>
                            {t("tools.terminal.saved_tabs_title")}
                        </div>

                        {presets.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                                {t("tools.terminal.no_saved_tabs")}
                            </div>
                        ) : (
                            <div className="space-y-0.5 px-1">
                                {presets.map((preset) => (
                                    <div
                                        key={preset.id}
                                        className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-xs"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsOpen(false);
                                                onLaunchPreset(preset);
                                            }}
                                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                            title={`${t("tools.terminal.launch_tab")}: ${preset.name}`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full shrink-0 ${
                                                    COLOR_MAP[preset.color || "emerald"] || "bg-emerald-400"
                                                }`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {preset.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                                    {preset.lastCwd || preset.cwd || "~"}
                                                </div>
                                            </div>
                                        </button>

                                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    onLaunchPreset(preset);
                                                }}
                                                className="p-1 rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                title={t("tools.terminal.launch_tab")}
                                            >
                                                <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeletePreset(preset.id);
                                                }}
                                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                title={t("tools.terminal.delete_tab")}
                                            >
                                                <span className="material-symbols-outlined text-[15px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Tab Groups */}
                    <div className="py-1 border-t border-slate-200 dark:border-slate-700/80">
                        <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">view_quilt</span>
                            {t("tools.terminal.tab_groups_title")}
                        </div>

                        {workspaces.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                                {t("tools.terminal.no_tab_groups")}
                            </div>
                        ) : (
                            <div className="space-y-0.5 px-1">
                                {workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-xs"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsOpen(false);
                                                onLaunchWorkspace(ws);
                                            }}
                                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                            title={`${t("tools.terminal.launch_group")}: ${ws.name}`}
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-sky-500 shrink-0">
                                                layers
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {ws.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {ws.tabs.length} tabs
                                                </div>
                                            </div>
                                        </button>

                                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    onLaunchWorkspace(ws);
                                                }}
                                                className="p-1 rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                title={t("tools.terminal.launch_group")}
                                            >
                                                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteWorkspace(ws.id);
                                                }}
                                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                title={t("tools.terminal.delete_group")}
                                            >
                                                <span className="material-symbols-outlined text-[15px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section 3: Save Actions */}
                    <div className="pt-2 px-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                        <button
                            type="button"
                            disabled={!activeSession}
                            onClick={() => {
                                setIsOpen(false);
                                onOpenSavePresetModal();
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                                activeSession
                                    ? "text-primary hover:bg-primary/10 cursor-pointer"
                                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                            <span className="truncate">{t("tools.terminal.save_tab_action")}</span>
                        </button>

                        <button
                            type="button"
                            disabled={totalSessions === 0}
                            onClick={() => {
                                setIsOpen(false);
                                onOpenSaveWorkspaceModal();
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                                totalSessions > 0
                                    ? "text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
                                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">save</span>
                            <span className="truncate">{t("tools.terminal.save_group_action")}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}