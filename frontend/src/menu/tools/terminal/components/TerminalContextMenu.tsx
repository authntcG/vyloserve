import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface TerminalContextMenuProps {
    readonly x: number;
    readonly y: number;
    readonly hasSelection: boolean;
    readonly onClose: () => void;
    readonly onCopy: () => void;
    readonly onPaste: () => void;
    readonly onSelectAll: () => void;
    readonly onClear: () => void;
    readonly onRestart?: () => void;
}

export default function TerminalContextMenu({
    x,
    y,
    hasSelection,
    onClose,
    onCopy,
    onPaste,
    onSelectAll,
    onClear,
    onRestart
}: TerminalContextMenuProps) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    // Adjust position so it doesn't overflow window edges
    const adjustedX = Math.min(x, window.innerWidth - 220);
    const adjustedY = Math.min(y, window.innerHeight - 240);

    return (
        <div
            ref={menuRef}
            style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
            className="fixed z-50 w-52 bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-1 text-xs select-none animate-in fade-in zoom-in-95 backdrop-blur-md"
        >
            <button
                type="button"
                disabled={!hasSelection}
                onClick={() => {
                    onCopy();
                    onClose();
                }}
                className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors ${
                    hasSelection
                        ? "text-slate-200 hover:bg-slate-800"
                        : "text-slate-500 cursor-not-allowed opacity-50"
                }`}
            >
                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">content_copy</span>
                <span className="flex-1 truncate">{t("tools.terminal.context_copy")}</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+C</span>
            </button>

            <button
                type="button"
                onClick={() => {
                    onPaste();
                    onClose();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors"
            >
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">content_paste</span>
                <span className="flex-1 truncate">{t("tools.terminal.context_paste")}</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+V</span>
            </button>

            <div className="border-t border-slate-800 my-1"></div>

            <button
                type="button"
                onClick={() => {
                    onSelectAll();
                    onClose();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors"
            >
                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">select_all</span>
                <span className="flex-1 truncate">{t("tools.terminal.context_select_all")}</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+A</span>
            </button>

            <button
                type="button"
                onClick={() => {
                    onClear();
                    onClose();
                }}
                className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 transition-colors"
            >
                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">clear_all</span>
                <span className="flex-1 truncate">{t("tools.terminal.context_clear")}</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+L</span>
            </button>

            {onRestart && (
                <>
                    <div className="border-t border-slate-800 my-1"></div>
                    <button
                        type="button"
                        onClick={() => {
                            onRestart();
                            onClose();
                        }}
                        className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-amber-400 hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0">refresh</span>
                        <span className="flex-1 truncate">{t("tools.terminal.context_restart")}</span>
                    </button>
                </>
            )}
        </div>
    );
}
