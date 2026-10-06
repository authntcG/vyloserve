import type { MouseEvent, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'icon';

export interface ButtonProps {
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
    readonly type?: 'button' | 'submit';
    readonly disabled?: boolean;
    /** Memaksa disabled, menampilkan spinner menggantikan `icon`, dan set `aria-busy`. */
    readonly loading?: boolean;
    /** Nama ikon Material Symbols, dirender sebelum `children`. */
    readonly icon?: string;
    readonly fullWidth?: boolean;
    readonly onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    readonly children?: ReactNode;
    /** Escape hatch untuk layout (mis. `flex-1`, `mt-4`) -- JANGAN dipakai untuk override warna/ukuran. */
    readonly className?: string;
    readonly title?: string;
    readonly 'aria-label'?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary hover:bg-primary/90 disabled:bg-slate-400 dark:disabled:bg-slate-800 text-white',
    secondary: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50',
    ghost: 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40',
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 dark:disabled:bg-red-900/40 text-white',
    'danger-ghost': 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'text-xs py-1.5 px-3 rounded-lg',
    md: 'text-sm py-2 px-4 rounded-lg',
    icon: 'p-2 rounded-md',
};

const ICON_TEXT_SIZE_CLASS: Record<ButtonSize, string> = {
    sm: 'text-[16px]',
    md: 'text-[18px]',
    icon: '',
};

/**
 * Button standar aplikasi -- satu-satunya sumber kebenaran untuk warna/ukuran/radius
 * tombol, theme-aware di semua 10 tema (lihat docs/ui_consistency_guide.md).
 *
 * `size="icon"` untuk tombol ikon-saja WAJIB disertai `title` atau `aria-label`
 * (tidak ada `children` teks untuk menamai tombolnya secara aksesibel).
 */
export default function Button({
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    icon,
    fullWidth = false,
    onClick,
    children,
    className = '',
    title,
    'aria-label': ariaLabel,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const iconSizeClass = ICON_TEXT_SIZE_CLASS[size];

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            title={title}
            aria-label={ariaLabel}
            aria-busy={loading || undefined}
            className={`font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {loading ? (
                <span aria-hidden="true" className={`material-symbols-outlined animate-spin ${iconSizeClass}`}>sync</span>
            ) : (
                icon && <span aria-hidden="true" className={`material-symbols-outlined ${iconSizeClass}`}>{icon}</span>
            )}
            {children}
        </button>
    );
}
