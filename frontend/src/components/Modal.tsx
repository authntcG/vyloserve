import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';

export interface ModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly title: string;
    readonly icon?: string;
    readonly children: ReactNode;
    readonly onApply?: () => void;
    readonly applyText?: string;
    readonly isDanger?: boolean;
    readonly isApplyDisabled?: boolean;
    readonly isDestructive?: boolean;
    readonly isLoading?: boolean;
    readonly keepMounted?: boolean;
    readonly maxWidthClass?: string;
    readonly customFooter?: ReactNode;
    readonly customHeader?: ReactNode;
    readonly bodyPaddingClass?: string;
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
    const [isRendered, setIsRendered] = useState(isOpen);
    const [isVisible, setIsVisible] = useState(isOpen);

    useEffect(() => {
        let timer: number;
        if (isOpen) {
            setIsRendered(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });
        } else {
            setIsVisible(false);
            timer = setTimeout(() => setIsRendered(false), 300);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isOpen]);

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

    if (!isRendered && !keepMounted) return null;

    // native <dialog> mengubah semantik focus-trap/backdrop-close/ESC (showModal()/close(),
    // ::backdrop) yang berbeda dari implementasi keepMounted+animasi opacity di komponen ini.
    // Migrasi ditunda (butuh smoke-test manual menyeluruh); lihat docs/known_bugs.md.
    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`} role="dialog" aria-modal="true"> {/* NOSONAR typescript:S6819 */}

            {/* OVERLAY DENGAN ANIMASI OPACITY */}
            <button
                type="button"
                className={`absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 outline-none ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isLoading && isVisible) onClose();
                }}
                aria-label={t('common.close', 'Close')}
            />

            {/* KOTAK MODAL DENGAN ANIMASI SCALE & SLIDE */}
            <div className={`relative w-full ${maxWidthClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'} overflow-hidden`}>
                
                {customHeader || (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${isDanger || isDestructive ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{icon}</span>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                        </div>
                        <button type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('common.close', 'Close')}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}

                <div className={`${bodyPaddingClass} flex flex-col gap-6 max-h-[70vh] overflow-y-auto`}>
                    {children}
                </div>

                {customFooter || (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                            {t('common.close', 'Close')}
                        </Button>
                        {onApply && (
                            <Button
                                variant={isDestructive ? 'danger' : 'primary'}
                                onClick={onApply}
                                disabled={isApplyDisabled}
                                loading={isLoading}
                            >
                                {applyText || t('common.apply', 'Apply Changes')}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}