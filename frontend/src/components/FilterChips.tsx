import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type ReactNode,
    type MouseEvent as ReactMouseEvent,
    type WheelEvent as ReactWheelEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

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
 * and icons, keyboard accessible with ARIA semantics.
 *
 * Mendukung indikator visual overflow (fade edge mask + tombol chevron) dan wheel-to-horizontal
 * scrolling untuk usability optimal pada kursor desktop.
 */
export default function FilterChips<T extends string = string>({
    items,
    selectedId,
    onChange,
    className = '',
    ariaLabel = 'Filter options',
}: FilterChipsProps<T>) {
    const { t } = useTranslation();
    const scrollContainerRef = useRef<HTMLFieldSetElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        // Toleransi 2px untuk subpixel rounding
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }, []);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        updateScrollState();

        const handleResize = () => updateScrollState();
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(handleResize)
            : null;

        resizeObserver?.observe(el);
        window.addEventListener('resize', handleResize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [items, updateScrollState]);

    const scrollByAmount = (offset: number) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (typeof el.scrollBy === 'function') {
            el.scrollBy({ left: offset, behavior: 'smooth' });
        } else {
            el.scrollLeft += offset;
        }
        updateScrollState();
    };

    const handleWheel = (e: ReactWheelEvent<HTMLFieldSetElement>) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        // Terjemahkan wheel vertikal ke scroll horizontal jika konten meluber
        if (canScrollLeft || canScrollRight) {
            if (e.deltaY !== 0) {
                el.scrollLeft += e.deltaY;
                updateScrollState();
            }
        }
    };

    const handleChipClick = (id: T, e: ReactMouseEvent<HTMLButtonElement>) => {
        onChange(id);
        if (typeof e.currentTarget.scrollIntoView === 'function') {
            e.currentTarget.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest',
            });
        }
    };

    return (
        <div className={`relative flex items-center min-w-0 ${className}`}>
            {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-2 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-slate-900 dark:via-slate-900/90 pointer-events-none">
                    <button
                        type="button"
                        aria-label={t('common.scroll_left', 'Scroll left')}
                        title={t('common.scroll_left', 'Scroll left')}
                        onClick={() => scrollByAmount(-120)}
                        className="pointer-events-auto h-6 w-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">chevron_left</span>
                    </button>
                </div>
            )}

            <fieldset
                ref={scrollContainerRef}
                onScroll={updateScrollState}
                onWheel={handleWheel}
                aria-label={ariaLabel}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full scroll-smooth m-0 p-0 border-0 min-w-0"
            >
                {items.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={(e) => handleChipClick(item.id, e)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                                isSelected
                                    ? 'bg-primary text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            {item.icon && (
                                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
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
            </fieldset>

            {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-2 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-slate-900 dark:via-slate-900/90 pointer-events-none">
                    <button
                        type="button"
                        aria-label={t('common.scroll_right', 'Scroll right')}
                        title={t('common.scroll_right', 'Scroll right')}
                        onClick={() => scrollByAmount(120)}
                        className="pointer-events-auto h-6 w-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                </div>
            )}
        </div>
    );
}
