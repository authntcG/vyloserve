import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type TableDensity = 'compact' | 'normal' | 'relaxed';

export interface TableSearchConfig {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly placeholder?: string;
    readonly ariaLabel?: string;
    readonly className?: string;
}

export interface ColumnDef<T> {
    readonly id: string;
    readonly header: ReactNode;
    readonly width?: string;
    readonly align?: 'left' | 'center' | 'right';
    readonly className?: string;
    readonly render: (item: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
    readonly data: readonly T[];
    readonly columns: readonly ColumnDef<T>[];
    readonly keyExtractor: (item: T, index: number) => string;
    readonly density?: TableDensity;
    readonly onDensityChange?: (density: TableDensity) => void;
    readonly showDensityControl?: boolean;
    readonly title?: ReactNode;
    readonly subtitle?: ReactNode;
    readonly filters?: ReactNode;
    readonly search?: TableSearchConfig;
    readonly headerActions?: ReactNode;
    readonly emptyState?: ReactNode;
    readonly isLoading?: boolean;
    readonly className?: string;
}

const STORAGE_KEY = 'vyloserve_table_density';

const DENSITY_CLASSES: Record<TableDensity, { header: string; cell: string }> = {
    compact: {
        header: 'py-2 px-3 text-[11px]',
        cell: 'py-1.5 px-3 text-xs',
    },
    normal: {
        header: 'py-3 px-4 text-xs',
        cell: 'py-3 px-4 text-sm',
    },
    relaxed: {
        header: 'py-3.5 px-5 text-xs',
        cell: 'py-4 px-5 text-sm',
    },
};

const ALIGN_CLASSES: Record<'left' | 'center' | 'right', string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

function getSavedDensity(): TableDensity {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'compact' || saved === 'normal' || saved === 'relaxed') {
            return saved;
        }
    } catch {
        // Fallback silently if localStorage is restricted
    }
    return 'normal';
}

/**
 * Standard Desktop Data Table for VyloServe.
 *
 * Rules:
 * - NO vertical scrollbar on the table container (natural scrolling via main page container).
 * - Horizontal overflow is enabled via `overflow-x-auto` with `overflow-y-hidden`.
 * - Density configuration (`compact` | `normal` | `relaxed`) with user-toggleable control.
 * - Dynamic columns with custom renderers and alignments.
 */
export default function DataTable<T>({
    data,
    columns,
    keyExtractor,
    density: controlledDensity,
    onDensityChange,
    showDensityControl = true,
    title,
    subtitle,
    filters,
    search,
    headerActions,
    emptyState,
    isLoading = false,
    className = '',
}: DataTableProps<T>) {
    const { t } = useTranslation();
    const [internalDensity, setInternalDensity] = useState<TableDensity>(() => getSavedDensity());

    const activeDensity = controlledDensity ?? internalDensity;

    const handleDensityChange = (newDensity: TableDensity) => {
        setInternalDensity(newDensity);
        try {
            localStorage.setItem(STORAGE_KEY, newDensity);
        } catch {
            // Ignore storage write errors
        }
        onDensityChange?.(newDensity);
    };

    const densityStyle = DENSITY_CLASSES[activeDensity];
    const hasToolbar = Boolean(title || subtitle || filters || search || headerActions || showDensityControl);

    return (
        <div className={`w-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden ${className}`}>
            {/* Optional Header Toolbar */}
            {hasToolbar && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    {/* Left side: Title/Subtitle and/or Filters */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {(title || subtitle) && (
                            <div className="flex flex-col gap-0.5 shrink-0">
                                {title && <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">{title}</div>}
                                {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>}
                            </div>
                        )}
                        {filters && <div className="flex-1 min-w-0">{filters}</div>}
                    </div>

                    {/* Right side: Search, Header Actions & Density Control */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                        {search && (
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
                                    search
                                </span>
                                <input
                                    type="text"
                                    value={search.value}
                                    onChange={(e) => search.onChange(e.target.value)}
                                    placeholder={search.placeholder || t('common.search_placeholder', 'Search...')}
                                    aria-label={search.ariaLabel || search.placeholder || t('common.search', 'Search')}
                                    className={`h-8 w-52 sm:w-64 md:w-72 pl-9 pr-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all ${
                                        search.className || ''
                                    }`}
                                />
                                {search.value && (
                                    <button
                                        type="button"
                                        onClick={() => search.onChange('')}
                                        title={t('common.clear', 'Clear')}
                                        aria-label={t('common.clear', 'Clear')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[15px] block">close</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {headerActions}
                        {showDensityControl && (
                            <div
                                role="group"
                                aria-label={t('common.density')}
                                className="h-8 inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/60 shrink-0"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleDensityChange('compact')}
                                    aria-pressed={activeDensity === 'compact'}
                                    title={t('common.density_compact')}
                                    aria-label={t('common.density_compact')}
                                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                                        activeDensity === 'compact'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs font-bold'
                                             : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] block">density_small</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDensityChange('normal')}
                                    aria-pressed={activeDensity === 'normal'}
                                    title={t('common.density_normal')}
                                    aria-label={t('common.density_normal')}
                                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                                        activeDensity === 'normal'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs font-bold'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] block">density_medium</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDensityChange('relaxed')}
                                    aria-pressed={activeDensity === 'relaxed'}
                                    title={t('common.density_relaxed')}
                                    aria-label={t('common.density_relaxed')}
                                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                                        activeDensity === 'relaxed'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs font-bold'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] block">density_large</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Horizontal-Only Scrollable Table Wrapper */}
            <div className="w-full overflow-x-auto overflow-y-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                            {columns.map((col) => {
                                const alignClass = ALIGN_CLASSES[col.align || 'left'];
                                return (
                                    <th
                                        key={col.id}
                                        scope="col"
                                        style={col.width ? { width: col.width } : undefined}
                                        className={`${densityStyle.header} ${alignClass} ${col.className || ''}`}
                                    >
                                        {col.header}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined animate-spin text-[20px] text-primary">sync</span>
                                        <span className="text-xs">Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                                    {emptyState || <span className="text-xs">No records found</span>}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, index) => (
                                <tr
                                    key={keyExtractor(item, index)}
                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    {columns.map((col) => {
                                        const alignClass = ALIGN_CLASSES[col.align || 'left'];
                                        return (
                                            <td
                                                key={col.id}
                                                className={`${densityStyle.cell} ${alignClass} align-middle ${col.className || ''}`}
                                            >
                                                {col.render(item, index)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
