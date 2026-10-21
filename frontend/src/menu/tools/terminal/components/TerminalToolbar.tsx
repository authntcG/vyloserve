import { useTranslation } from "react-i18next";
import type { TerminalSession } from "../types";

interface TerminalToolbarProps {
    readonly activeSession?: TerminalSession;
    readonly onRestartSession?: (sessionId: string) => void;
    readonly onOpenEnvModal?: () => void;
    readonly onClear?: () => void;
    readonly envProfileSummary?: string;
}

export default function TerminalToolbar({
    activeSession,
    onRestartSession,
    onOpenEnvModal,
    onClear,
    envProfileSummary = "VyloServe Stack"
}: TerminalToolbarProps) {
    const { t } = useTranslation();

    if (!activeSession) return null;

    return (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#090d16] border-b border-slate-800 text-xs text-slate-400 select-none">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono text-[11px] shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeSession.isClosed ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    {activeSession.shell_id.toUpperCase()}
                </span>

                <span
                    className="truncate text-slate-500 hover:text-slate-300 transition-colors font-mono text-[11px]"
                    title={activeSession.cwd}
                >
                    📁 {activeSession.cwd}
                </span>

                {onOpenEnvModal && (
                    <button
                        type="button"
                        onClick={onOpenEnvModal}
                        className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-mono shrink-0"
                        title={t("tools.terminal.env_title")}
                    >
                        <span className="material-symbols-outlined text-[13px]">bolt</span>
                        <span className="truncate max-w-[140px]">{envProfileSummary}</span>
                        <span className="material-symbols-outlined text-[12px]">expand_more</span>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {/* Paste Hint */}
                <span className="hidden lg:inline-block text-[11px] text-slate-500 italic">
                    {t("tools.terminal.paste_hint")}
                </span>

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center"
                        title={t("tools.terminal.clear")}
                    >
                        <span className="material-symbols-outlined text-[15px]">clear_all</span>
                    </button>
                )}

                {activeSession.isClosed && onRestartSession && (
                    <button
                        type="button"
                        onClick={() => onRestartSession(activeSession.id)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1 text-[11px]"
                    >
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        {t('tools.terminal.reconnect')}
                    </button>
                )}

                <span className="hidden sm:inline-block text-[11px] text-slate-600 dark:text-slate-500 font-mono bg-slate-800/40 px-2 py-0.5 rounded">
                    Ctrl + `
                </span>
            </div>
        </div>
    );
}
