import { type ReactNode, useEffect } from 'react';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: string;
    children: ReactNode;
    onApply?: () => void;
    applyText?: string;
    isDanger?: boolean;
    isApplyDisabled?: boolean;
    isDestructive?: boolean;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    icon = 'tune',
    children,
    onApply,
    applyText = 'Apply Changes',
    isDanger = false,
    isApplyDisabled = false,
    isDestructive = false
}: ModalProps) {
    if (!isOpen) return null;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Abaikan tombol Escape JIKA modal bersifat destructive (hapus)
            if (e.key === 'Escape' && !isDestructive) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, isDestructive]);

    const applyButtonClass = isDestructive
        ? "bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        : "bg-primary hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors";

    const handleBackdropClick = () => {
        // Abaikan klik di luar modal JIKA modal bersifat destructive
        if (!isDestructive) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={(e) => e.stopPropagation()} />

            <div className="relative w-full sm:w-[500px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined ${isDanger ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{icon}</span>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Close
                    </button>
                    {onApply && (
                        <button
                            onClick={onApply}
                            disabled={isApplyDisabled}
                            className={applyButtonClass}
                        >
                            {applyText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}