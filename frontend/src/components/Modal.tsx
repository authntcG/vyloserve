import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
    isLoading?: boolean;
    keepMounted?: boolean;
    maxWidthClass?: string;
    customFooter?: ReactNode;
    customHeader?: ReactNode;
    bodyPaddingClass?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    icon = 'tune',
    children,
    onApply,
    applyText,
    isDanger = false,
    isApplyDisabled = false,
    isDestructive = false,
    isLoading = false,
    keepMounted = false,
    maxWidthClass = 'sm:w-[500px]',
    customFooter,
    customHeader,
    bodyPaddingClass = 'p-6'
}: ModalProps) {
    const { t } = useTranslation();
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isDestructive && !isLoading && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, isDestructive, isLoading]);

    const applyButtonClass = isDestructive
        ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400 dark:disabled:bg-red-900/40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        : "bg-primary hover:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2";

    if (!isOpen && !keepMounted) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`} role="dialog" aria-modal="true">

            {/* OVERLAY DENGAN ANIMASI OPACITY */}
            <div
                className={`absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isLoading && isOpen) onClose();
                }}
            />

            {/* KOTAK MODAL DENGAN ANIMASI SCALE & SLIDE */}
            <div className={`relative w-full ${maxWidthClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'} overflow-hidden`}>
                
                {customHeader ? customHeader : (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${isDanger || isDestructive ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{icon}</span>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                        </div>
                        <button type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Close"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}

                <div className={`${bodyPaddingClass} flex flex-col gap-6 max-h-[70vh] overflow-y-auto`}>
                    {children}
                </div>

                {customFooter ? customFooter : (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                        <button type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('common.close', 'Close')}
                        </button>
                        {onApply && (
                            <button type="button"
                                onClick={onApply}
                                disabled={isApplyDisabled || isLoading}
                                className={applyButtonClass}
                            >
                                {isLoading && (
                                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                )}
                                {applyText || t('common.apply', 'Apply Changes')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}