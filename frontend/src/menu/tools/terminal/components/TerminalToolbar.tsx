import { useTranslation } from "react-i18next";
import type { TerminalSession } from "../types";

interface TerminalToolbarProps {
    readonly activeSession?: TerminalSession;
    readonly onRestartSession?: (sessionId: string) => void;
    readonly onOpenConfigModal?: (tab?: "env" | "appearance" | "behavior") => void;
    readonly onOpenEnvModal?: () => void;
    readonly onOpenSettingsModal?: () => void;
    readonly onClear?: () => void;
    readonly envProfileSummary?: string;
}

export default function TerminalToolbar({
    activeSession,
    onRestartSession,
    onOpenConfigModal,
    onOpenEnvModal,
    onOpenSettingsModal,
    onClear,
    envProfileSummary = "VyloServe Stack"
}: TerminalToolbarProps) {
    const { t } = useTranslation();

    if (!activeSession) return null;

    const handleConfigClick = () => {
        if (onOpenConfigModal) {
            onOpenConfigModal("env");
        } else if (onOpenEnvModal) {
            onOpenEnvModal();
        }
    };

    return (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-[#090d16] border-b border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 select-none">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800/80 text-slate-800 dark:text-slate-300 font-mono text-[11px] shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeSession.isClosed ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    {activeSession.shell_id.toUpperCase()}
                </span>

                <span
                    className="truncate text-slate-700 dark:text-slate-300 hover:text-primary transition-colors font-mono text-[11px]"
                    title={activeSession.cwd}
                >
                    📁 {activeSession.cwd}
                </span>

                {(onOpenConfigModal || onOpenEnvModal) && (
                    <button
                        type="button"
                        onClick={handleConfigClick}
                        className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md transition-colors text-[11px] font-mono shrink-0 cursor-pointer border ${
                            activeSession.isCustomEnv
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                : "bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700"
                        }`}
                        title={t("tools.terminal.config_title")}
                        aria-label={t("tools.terminal.config_title")}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[13px]">
                            {activeSession.isCustomEnv ? "offline_bolt" : "settings"}
                        </span>
                        <span className="truncate max-w-[140px]">{envProfileSummary}</span>
                        {activeSession.isCustomEnv && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-sans uppercase font-bold">
                                {t("tools.terminal.custom_env_badge")}
                            </span>
                        )}
                        <span aria-hidden="true" className="material-symbols-outlined text-[12px] opacity-70">expand_more</span>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {/* Paste Hint */}
                <span className="hidden lg:inline-block text-[11px] text-slate-500 dark:text-slate-400 italic">
                    {t("tools.terminal.paste_hint")}
                </span>

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center cursor-pointer"
                        title={t("tools.terminal.clear")}
                        aria-label={t("tools.terminal.clear")}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">clear_all</span>
                    </button>
                )}

                {!onOpenConfigModal && onOpenSettingsModal && (
                    <button
                        type="button"
                        onClick={onOpenSettingsModal}
                        className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center cursor-pointer"
                        title={t("tools.terminal.settings_title")}
                        aria-label={t("tools.terminal.settings_title")}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">settings</span>
                    </button>
                )}

                {activeSession.isClosed && onRestartSession && (
                    <button
                        type="button"
                        onClick={() => onRestartSession(activeSession.id)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[13px]">refresh</span>
                        {t('tools.terminal.reconnect')}
                    </button>
                )}

                <span className="hidden sm:inline-block text-[11px] text-slate-600 dark:text-slate-400 font-mono bg-slate-200/80 dark:bg-slate-800/50 px-2 py-0.5 rounded">
                    Ctrl + `
                </span>
            </div>
        </div>
    );
}
