import type { ReactNode } from 'react';

export interface FilterChipItem<T extends string = string> {
    readonly id: T;
    readonly label: ReactNode;
    readonly count?: number;
    readonly icon?: string;
}

export interface FilterChipsProps<T extends string = string> {
    readonly items: readonly FilterChipItem<T>[];
    readonly selectedId: T;
    readonly onChange: (id: T) => void;
    readonly className?: string;
    readonly ariaLabel?: string;
}

/**
 * Reusable Capsule Filter Chips for VyloServe.
 *
 * Provides a clean row of pill/capsule filter buttons with optional item counts
 * and icons, keyboard accessible with ARIA tablist semantics.
 */
export default function FilterChips<T extends string = string>({
    items,
    selectedId,
    onChange,
    className = '',
    ariaLabel = 'Filter options',
}: FilterChipsProps<T>) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 ${className}`}
        >
            {items.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChange(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                            isSelected
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {item.icon && (
                            <span className="material-symbols-outlined text-[14px]">
                                {item.icon}
                            </span>
                        )}
                        <span>{item.label}</span>
                        {typeof item.count === 'number' && (
                            <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                    isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                {item.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
