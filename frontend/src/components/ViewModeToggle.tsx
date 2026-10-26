import { useTranslation } from 'react-i18next';

export type ViewMode = 'card' | 'table';

export interface ViewModeToggleLabels {
    readonly table?: string;
    readonly card?: string;
}

export interface ViewModeToggleProps {
    readonly mode: ViewMode;
    readonly onChange: (mode: ViewMode) => void;
    readonly labels?: ViewModeToggleLabels;
    readonly className?: string;
}

/**
 * Reusable segmented view mode toggle switch (Card vs Table View).
 * Used across data-driven modules such as Projects Hub, PHP, Database, and Runtimes.
 */
export default function ViewModeToggle({
    mode,
    onChange,
    labels,
    className = '',
}: ViewModeToggleProps) {
    const { t } = useTranslation();

    const tableLabel = labels?.table || t('common.view_table', 'Table View');
    const cardLabel = labels?.card || t('common.view_cards', 'Card View');

    return (
        <div
            role="group"
            aria-label={t('common.view_mode') || 'View Mode'}
            className={`flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shrink-0 ${className}`}
        >
            <button
                type="button"
                onClick={() => onChange('table')}
                title={tableLabel}
                aria-label={tableLabel}
                aria-pressed={mode === 'table'}
                className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center ${
                    mode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
                <span className="material-symbols-outlined text-[18px]">table_rows</span>
            </button>
            <button
                type="button"
                onClick={() => onChange('card')}
                title={cardLabel}
                aria-label={cardLabel}
                aria-pressed={mode === 'card'}
                className={`p-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center ${
                    mode === 'card'
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
        </div>
    );
}
