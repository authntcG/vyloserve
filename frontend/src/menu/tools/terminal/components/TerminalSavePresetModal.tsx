import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../../components/Modal";
import Button from "../../../../components/Button";
import type { TerminalSession, ShellInfo, RuntimeProfile, TerminalWorkspaceTab } from "../types";

interface TerminalSavePresetModalProps {
    readonly isOpen: boolean;
    readonly mode: "preset" | "workspace";
    readonly onClose: () => void;
    readonly activeSession?: TerminalSession;
    readonly detectedCwd?: string;
    readonly activeHistoryBuffer?: string;
    readonly allTabsHistory?: Record<string, string>;
    readonly sessions: TerminalSession[];
    readonly availableShells: ShellInfo[];
    readonly onSavePreset: (preset: {
        name: string;
        shell_id: string;
        cwd: string;
        lastCwd?: string;
        historyBuffer?: string;
        envProfile: RuntimeProfile;
        color: string;
        icon: string;
    }) => Promise<void>;
    readonly onSaveWorkspace: (workspace: {
        name: string;
        tabs: TerminalWorkspaceTab[];
    }) => Promise<void>;
}

const COLOR_OPTIONS = [
    { id: "emerald", label: "Emerald", bgClass: "bg-emerald-500", ringClass: "ring-emerald-400" },
    { id: "sky", label: "Sky", bgClass: "bg-sky-500", ringClass: "ring-sky-400" },
    { id: "violet", label: "Violet", bgClass: "bg-violet-500", ringClass: "ring-violet-400" },
    { id: "amber", label: "Amber", bgClass: "bg-amber-500", ringClass: "ring-amber-400" },
    { id: "rose", label: "Rose", bgClass: "bg-rose-500", ringClass: "ring-rose-400" }
];

export default function TerminalSavePresetModal({
    isOpen,
    mode,
    onClose,
    activeSession,
    detectedCwd,
    activeHistoryBuffer,
    allTabsHistory,
    sessions,
    availableShells,
    onSavePreset,
    onSaveWorkspace
}: TerminalSavePresetModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [shellId, setShellId] = useState("powershell");
    const [cwd, setCwd] = useState("");
    const [color, setColor] = useState("emerald");
    const [isHistoryPreviewOpen, setIsHistoryPreviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (mode === "preset") {
            setName(activeSession?.title ? `${activeSession.title} Preset` : "");
            setShellId(activeSession?.shell_id || "powershell");
            const initialCwd = detectedCwd || activeSession?.lastCwd || activeSession?.cwd || "";
            setCwd(initialCwd);
            setColor(activeSession?.color || "emerald");
        } else {
            setName("");
        }
        setIsHistoryPreviewOpen(false);
        setIsSubmitting(false);
    }, [isOpen, mode, activeSession, detectedCwd]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || isSubmitting) return;

        setIsSubmitting(true);
        const effectiveCwd = detectedCwd || cwd.trim() || activeSession?.lastCwd || activeSession?.cwd || "";
        try {
            if (mode === "preset") {
                await onSavePreset({
                    name: trimmedName,
                    shell_id: shellId,
                    cwd: effectiveCwd,
                    lastCwd: effectiveCwd,
                    historyBuffer: activeHistoryBuffer || "",
                    envProfile: activeSession?.envProfile || {},
                    color,
                    icon: "terminal"
                });
            } else {
                const tabs: TerminalWorkspaceTab[] = sessions.map((s) => ({
                    title: s.title,
                    shell_id: s.shell_id,
                    cwd: s.lastCwd || s.cwd,
                    lastCwd: s.lastCwd || s.cwd,
                    historyBuffer: (allTabsHistory && allTabsHistory[s.id]) || s.historyBuffer || "",
                    envProfile: s.envProfile,
                    color: s.color,
                    icon: s.icon
                }));
                await onSaveWorkspace({
                    name: trimmedName,
                    tabs
                });
            }
            onClose();
        } catch (err) {
            console.error("Failed to save terminal preset/workspace:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const historyLinesCount = activeHistoryBuffer ? activeHistoryBuffer.split("\n").filter((l) => l.trim().length > 0).length : 0;
    const effectiveDetectedCwd = detectedCwd || cwd.trim() || activeSession?.lastCwd || activeSession?.cwd || "~";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                mode === "preset"
                    ? t("tools.terminal.save_tab_title")
                    : t("tools.terminal.save_group_title")
            }
            icon={mode === "preset" ? "bookmark_add" : "save"}
            maxWidthClass="sm:w-[540px] max-w-[calc(100vw-2rem)]"
            bodyPaddingClass="p-6"
            customFooter={
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl w-full">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        icon="check"
                        onClick={() => handleSubmit()}
                        disabled={!name.trim() || isSubmitting || (mode === "workspace" && sessions.length === 0)}
                    >
                        {mode === "preset"
                            ? t("tools.terminal.save_tab_btn")
                            : t("tools.terminal.save_group_btn")}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
                {mode === "preset" ? (
                    <>
                        {/* 1. Tab Name */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="term-save-preset-name"
                                className="font-semibold text-slate-800 dark:text-slate-200 text-sm"
                            >
                                {t("tools.terminal.tab_name_label")}
                            </label>
                            <input
                                id="term-save-preset-name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("tools.terminal.tab_name_placeholder")}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary text-sm shadow-xs"
                            />
                        </div>

                        {/* 2. Detected Working Directory (Read-only, no manual typing needed) */}
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.detected_path_label")}
                            </span>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary shrink-0">folder_open</span>
                                    <span className="truncate" title={effectiveDetectedCwd}>
                                        {effectiveDetectedCwd}
                                    </span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-sans font-semibold shrink-0 flex items-center gap-1">
                                    <span aria-hidden="true" className="material-symbols-outlined text-[12px]">my_location</span>
                                    {t("tools.terminal.detected_path_badge")}
                                </span>
                            </div>
                        </div>

                        {/* 3. Captured Log History Card */}
                        {historyLinesCount > 0 && (
                            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-[17px] text-primary">history</span>
                                        <span className="font-semibold text-xs">
                                            {t("tools.terminal.history_log_count", "{{count}} baris riwayat log tersimpan", { count: historyLinesCount })}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryPreviewOpen(!isHistoryPreviewOpen)}
                                        className="text-xs text-primary hover:underline cursor-pointer font-medium"
                                    >
                                        {isHistoryPreviewOpen ? t("tools.terminal.hide_preview", "Sembunyikan") : t("tools.terminal.show_preview", "Pratinjau")}
                                    </button>
                                </div>
                                {isHistoryPreviewOpen && (
                                    <pre className="max-h-36 overflow-y-auto p-2.5 rounded-lg bg-black/85 text-emerald-400 font-mono text-[11px] whitespace-pre-wrap select-all leading-relaxed border border-slate-800">
                                        {activeHistoryBuffer}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* 4. Shell Selection */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="term-save-preset-shell"
                                className="font-semibold text-slate-800 dark:text-slate-200 text-sm"
                            >
                                {t("tools.terminal.shell_label")}
                            </label>
                            <select
                                id="term-save-preset-shell"
                                value={shellId}
                                onChange={(e) => setShellId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary text-sm cursor-pointer shadow-xs"
                            >
                                {availableShells
                                    .filter((s) => s.available)
                                    .map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* 5. Color Tag */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="term-save-preset-color"
                                className="font-semibold text-slate-800 dark:text-slate-200 text-sm"
                            >
                                {t("tools.terminal.color_tag_label")}
                            </label>
                            <div id="term-save-preset-color" className="flex items-center gap-2.5 pt-1">
                                {COLOR_OPTIONS.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setColor(c.id)}
                                        className={`w-6 h-6 rounded-full ${c.bgClass} transition-transform cursor-pointer ${
                                            color === c.id
                                                ? `ring-2 ring-offset-2 dark:ring-offset-slate-900 ${c.ringClass} scale-110`
                                                : "opacity-70 hover:opacity-100"
                                        }`}
                                        title={c.label}
                                        aria-label={c.label}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Group Name */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="term-save-ws-name"
                                className="font-semibold text-slate-800 dark:text-slate-200 text-sm"
                            >
                                {t("tools.terminal.group_name_label")}
                            </label>
                            <input
                                id="term-save-ws-name"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("tools.terminal.group_name_placeholder")}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary text-sm shadow-xs"
                            />
                        </div>

                        {/* Included Tabs Summary with history status */}
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.included_tabs_label")} ({sessions.length})
                            </span>
                            <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                                {sessions.map((tab, idx) => (
                                    <div
                                        key={tab.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs shadow-2xs"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="material-symbols-outlined text-[16px] text-primary">
                                                terminal
                                            </span>
                                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {idx + 1}. {tab.title}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono uppercase font-semibold">
                                                {tab.shell_id}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {allTabsHistory && allTabsHistory[tab.id] ? (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                                                    log OK
                                                </span>
                                            ) : null}
                                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                                                {tab.lastCwd || tab.cwd || "~"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </form>
        </Modal>
    );
}