// src/components/Card.tsx
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusTheme } from './StatusBadge';

export interface CardProps {
    readonly title: string | ReactNode;
    readonly status?: string | null;
    readonly updateVersion?: string | null;
    readonly gridCols?: string;
    readonly dropdownActions?: ReactNode;
    readonly footerActions?: ReactNode;
    readonly children: ReactNode;
}

export default function Card({
    title,
    status = null,
    updateVersion = null,
    gridCols = 'grid-cols-2 md:grid-cols-4',
    dropdownActions,
    footerActions,
    children
}: CardProps) {
    const { t } = useTranslation();

    // Ekstrak tema hanya jika properti status tersedia
    const theme = status ? getStatusTheme(status) : null;
    const hasStatusOrUpdate = status || updateVersion;

    // Tema fallback untuk update murni (tanpa status teks)
    const fallbackUpdateBadge = 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border-amber-500/20 dark:border-amber-500/30';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">

            {/* Header & Status dalam file Card.tsx */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                        <div className="flex items-center gap-2">
                            <span>{title}</span>
                        </div>
                    </h3>
                    {/* Badge Status */}
                    {hasStatusOrUpdate && (
                        <span data-testid="status-badge" className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${theme ? theme.badge : fallbackUpdateBadge}`}>
                            {status && theme && (
                                <>
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${theme.dot}`}></span>
                                    {status}
                                </>
                            )}
                            {status && updateVersion && (
                                <span className="mx-1.5 opacity-50 font-normal">|</span>
                            )}
                            {updateVersion && (
                                <span className={`flex items-center gap-1 ${!status ? 'uppercase font-bold text-[10px]' : ''}`} title={t('ui.update.update_to_target', { version: updateVersion }) as string}>
                                    <span className={`material-symbols-outlined ${status ? 'text-[14px]' : 'text-[12px]'}`}>upgrade</span>
                                    {t('ui.update.update_text', 'Update')}
                                </span>
                            )}
                        </span>
                    )}
                </div>

                {/* Dropdown Menu Burger (Kanan Atas) */}
                {dropdownActions && (
                    <div className="relative group/menu">
                        <button type="button" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 outline-none">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 overflow-hidden">
                            {dropdownActions}
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Grid Body */}
            <div className={`grid gap-6 ${gridCols}`}>
                {children}
            </div>

            {/* Action Footer (Opsional, tombol-tombol utama) */}
            {footerActions && (
                <div className="flex gap-3 mt-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                    {footerActions}
                </div>
            )}
        </div>
    );
}