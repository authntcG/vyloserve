import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { onEnterOrSpace } from '../utils/a11y';
import FieldLabel from './FieldLabel';

export interface SelectOption<T extends string = string> {
    readonly value: T;
    readonly label: string;
    /** Ditampilkan setelah label dalam tanda kurung (mis. domain project di samping namanya). */
    readonly sublabel?: string;
    /** Opsi terlihat tapi tidak bisa dipilih (mis. "Node.js -- segera hadir"). */
    readonly disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
    readonly options: ReadonlyArray<SelectOption<T>>;
    readonly value: T | null;
    readonly onChange: (value: T) => void;
    readonly placeholder: string;
    /** @default true */
    readonly searchable?: boolean;
    readonly searchPlaceholder?: string;
    /** @default pencocokan substring pada `label` saja (case-insensitive). */
    readonly filterFn?: (option: SelectOption<T>, query: string) => boolean;
    readonly disabled?: boolean;
    readonly loading?: boolean;
    readonly loadingText?: string;
    readonly emptyText?: string;
    /** Set kalau daftar option GAGAL dimuat (beda dari sekadar hasil pencarian kosong) -- trigger jadi disabled + tampilkan pesan ini. */
    readonly errorText?: string;
    /** Batasi jumlah option ditampilkan saat tidak sedang mencari (mis. "top 15 rilis terbaru"). */
    readonly displayLimit?: number;
    /** Teks catatan saat daftar dipotong oleh `displayLimit` (caller yang format, i18n-nya spesifik per domain). */
    readonly truncatedText?: string;
    readonly label?: string;
    /** Id eksplisit untuk trigger -- dipakai saat caller sudah punya `<label htmlFor>` sendiri (mis. heading section) dan tidak memakai prop `label` di atas. */
    readonly id?: string;
}

function defaultFilterFn<T extends string>(option: SelectOption<T>, query: string): boolean {
    return option.label.toLowerCase().includes(query.toLowerCase());
}

function useFilteredOptions<T extends string>(
    options: ReadonlyArray<SelectOption<T>>,
    query: string,
    filterFn: (option: SelectOption<T>, query: string) => boolean,
    displayLimit?: number
) {
    return useMemo(() => {
        const matched = query ? options.filter((o) => filterFn(o, query)) : options;
        const isTruncated = !query && !!displayLimit && options.length > displayLimit;
        const visible = !query && displayLimit ? matched.slice(0, displayLimit) : matched;
        return { visible, isTruncated };
    }, [options, query, filterFn, displayLimit]);
}

interface SelectTriggerProps {
    readonly id?: string;
    readonly buttonRef: RefObject<HTMLButtonElement | null>;
    readonly isOpen: boolean;
    readonly disabled: boolean;
    readonly loading: boolean;
    readonly loadingText?: string;
    readonly errorText?: string;
    readonly displayLabel: string;
    readonly onClick: () => void;
}

function SelectTrigger({ id, buttonRef, isOpen, disabled, loading, loadingText, errorText, displayLabel, onClick }: SelectTriggerProps) {
    if (loading) {
        return (
            <div className="h-[42px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                <span aria-hidden="true" className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                <span className="text-sm text-slate-500">{loadingText}</span>
            </div>
        );
    }

    const isError = !!errorText;
    const isDisabled = disabled || isError;

    return (
        <button
            id={id}
            ref={buttonRef}
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={`w-full h-[42px] px-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm rounded-lg outline-none transition-colors border flex justify-between items-center ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-slate-300 dark:border-slate-700'} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'cursor-pointer'}`}
        >
            <span className="truncate pr-2">{isError ? errorText : displayLabel}</span>
            <span aria-hidden="true" className={`material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
                expand_more
            </span>
        </button>
    );
}

interface SelectOptionRowProps<T extends string> {
    readonly option: SelectOption<T>;
    readonly isSelected: boolean;
    readonly isHighlighted: boolean;
    readonly onSelect: () => void;
}

function SelectOptionRow<T extends string>({ option, isSelected, isHighlighted, onSelect }: SelectOptionRowProps<T>) {
    const isDisabled = !!option.disabled;
    const handleSelect = () => { if (!isDisabled) onSelect(); };

    const interactiveClass = isSelected
        ? 'bg-primary/10 dark:bg-primary/20 text-primary font-medium'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

    return (
        <div // NOSONAR typescript:S6819 -- combobox custom, butuh render checkmark per item (tidak bisa di dalam <option> native)
            onClick={handleSelect}
            onKeyDown={(e) => {
                // stopPropagation supaya Enter/Space di baris option tidak ikut diproses lagi
                // oleh handler keyboard-nav di container (Select.tsx) -- tanpa ini, onSelect()
                // bisa terpanggil DUA KALI (sekali di sini, sekali lagi di container yang salah
                // baca activeElement karena fokus sudah berpindah ke trigger duluan oleh onSelect
                // yang pertama), memilih option yang salah.
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                onEnterOrSpace(handleSelect)(e);
            }}
            role="option"
            aria-selected={isSelected}
            aria-disabled={isDisabled}
            tabIndex={0}
            className={`px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between group ${
                isDisabled
                    ? 'cursor-not-allowed opacity-50 text-slate-500 dark:text-slate-500'
                    : `cursor-pointer ${interactiveClass}`
            } ${isHighlighted ? 'ring-1 ring-primary/50' : ''}`}
        >
            <span className="truncate">
                {option.label}
                {option.sublabel && <span className="text-slate-400 dark:text-slate-500"> ({option.sublabel})</span>}
            </span>
            {isSelected && <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-primary shrink-0">check</span>}
        </div>
    );
}

interface SelectPanelProps<T extends string> {
    readonly options: ReadonlyArray<SelectOption<T>>;
    readonly value: T | null;
    readonly onSelect: (value: T) => void;
    readonly searchable: boolean;
    readonly searchPlaceholder: string;
    readonly searchQuery: string;
    readonly onSearchChange: (q: string) => void;
    readonly highlightedIndex: number;
    readonly emptyText: string;
    readonly isTruncated: boolean;
    readonly truncatedText?: string;
    readonly searchInputRef: RefObject<HTMLInputElement | null>;
}

function SelectPanel<T extends string>({
    options, value, onSelect, searchable, searchPlaceholder, searchQuery, onSearchChange,
    highlightedIndex, emptyText, isTruncated, truncatedText, searchInputRef,
}: SelectPanelProps<T>) {
    return (
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {searchable && (
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="relative">
                        <span aria-hidden="true" className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300"
                        />
                    </div>
                </div>
            )}
            <div role="listbox" // NOSONAR typescript:S6819
            className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                {options.length > 0 ? (
                    options.map((option, index) => (
                        <SelectOptionRow
                            key={option.value}
                            option={option}
                            isSelected={value === option.value}
                            isHighlighted={index === highlightedIndex}
                            onSelect={() => onSelect(option.value)}
                        />
                    ))
                ) : (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">{emptyText}</div>
                )}
            </div>
            {isTruncated && truncatedText && (
                <div className="px-3 py-1.5 text-[10px] font-medium text-center text-slate-400 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
                    {truncatedText}
                </div>
            )}
        </div>
    );
}

/**
 * Dropdown value-picker standar aplikasi -- generik untuk native `<select>` (searchable=false)
 * maupun combobox dengan pencarian (searchable=true, default). Lihat docs/ui_consistency_guide.md.
 */
export default function Select<T extends string = string>({
    options,
    value,
    onChange,
    placeholder,
    searchable = true,
    searchPlaceholder,
    filterFn = defaultFilterFn,
    disabled = false,
    loading = false,
    loadingText,
    emptyText,
    errorText,
    displayLimit,
    truncatedText,
    label,
    id,
}: SelectProps<T>) {
    const { t } = useTranslation();
    const generatedId = useId();
    const triggerId = id ?? (label ? generatedId : undefined);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const { visible, isTruncated } = useFilteredOptions(options, searchQuery, filterFn, displayLimit);

    const closePanel = () => {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(0);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            closePanel();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Panel di-render lewat portal ke document.body (lihat render di bawah) supaya tidak
    // ikut terpotong oleh ancestor `overflow-hidden`/`overflow-y-auto` manapun (mis. body
    // modal yang scrollable -- lihat docs/ui_consistency_guide.md). Posisi dihitung manual
    // dari posisi trigger di viewport; scroll pada ancestor manapun menutup panel alih-alih
    // mencoba reposisi berkelanjutan (tidak ada dependency positioning library di proyek ini).
    useLayoutEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) setPanelPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        };
        updatePosition();
        const handleScroll = (event: Event) => {
            // Listener capture-phase di window menjangkau scroll event APAPUN di descendant manapun
            // (termasuk listbox opsi di dalam panel sendiri, meski `scroll` tidak bubble) -- abaikan
            // kalau scroll-nya berasal dari dalam panel, supaya scroll daftar opsi tidak ikut menutup
            // panelnya sendiri. Hanya scroll pada ancestor DI LUAR panel (mis. body modal) yang menutup.
            // event.target bisa berupa `window`/`document` (bukan Node) saat scroll halaman penuh --
            // `instanceof Node` menjaga .contains() tidak throw untuk kasus itu.
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            closePanel();
        };
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && searchable) {
            const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, searchable]);

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setHighlightedIndex(0);
    };

    const handleSelect = (val: T) => {
        onChange(val);
        closePanel();
        triggerRef.current?.focus();
    };

    const handleKeyDown = (e: ReactKeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, visible.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
            triggerRef.current?.focus();
        } else if (e.key === 'Enter' && visible[highlightedIndex]) {
            // Baris option sudah menangani Enter/Space sendiri lewat onEnterOrSpace DAN
            // menghentikan propagasinya (lihat SelectOptionRow) -- cabang ini cuma kebagian
            // Enter yang berasal dari search input / trigger (hasil navigasi Arrow Up/Down).
            e.preventDefault();
            if (!visible[highlightedIndex].disabled) handleSelect(visible[highlightedIndex].value);
        }
    };

    const selectedOption = options.find((o) => o.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    return (
        <div className="flex flex-col gap-2 relative" ref={containerRef} onKeyDown={handleKeyDown} // NOSONAR typescript:S6848
        >
            {label && <FieldLabel htmlFor={generatedId}>{label}</FieldLabel>}
            <SelectTrigger
                id={triggerId}
                buttonRef={triggerRef}
                isOpen={isOpen}
                disabled={disabled}
                loading={loading}
                loadingText={loadingText}
                errorText={errorText}
                displayLabel={displayLabel}
                onClick={() => setIsOpen((o) => !o)}
            />
            {isOpen && !disabled && !loading && panelPosition && createPortal(
                <div // NOSONAR typescript:S6848
                    ref={panelRef}
                    onKeyDown={handleKeyDown}
                    style={{ position: 'fixed', top: panelPosition.top, left: panelPosition.left, width: panelPosition.width, zIndex: 1000 }}
                >
                    <SelectPanel
                        options={visible}
                        value={value}
                        onSelect={handleSelect}
                        searchable={searchable}
                        searchPlaceholder={searchPlaceholder ?? t('common.search_placeholder', 'Search...')}
                        searchQuery={searchQuery}
                        onSearchChange={handleSearchChange}
                        highlightedIndex={highlightedIndex}
                        emptyText={emptyText ?? t('common.no_results', 'No results found.')}
                        isTruncated={isTruncated}
                        truncatedText={truncatedText}
                        searchInputRef={searchInputRef}
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
