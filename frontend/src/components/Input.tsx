import { forwardRef, type InputHTMLAttributes } from 'react';

export type InputSize = 'sm' | 'md';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    /** Ukuran kontrol input. @default 'md' */
    readonly size?: InputSize;
    /** Menggunakan font-mono (cocok untuk angka, port, IP, path, JSON). @default false */
    readonly mono?: boolean;
    /** Apakah input harus mengambil lebar 100% dari kontainer induknya. @default true */
    readonly fullWidth?: boolean;
    /** Nama ikon Material Symbols yang ditampilkan di sisi kiri input (mis. 'search'). */
    readonly leftIcon?: string;
    /** Nama ikon Material Symbols yang ditampilkan di sisi kanan input. */
    readonly rightIcon?: string;
    /** Callback saat tombol clear (tanda silang) ditekan. Jika diberikan, tombol clear akan muncul saat input memiliki nilai. */
    readonly onClear?: () => void;
    /** Label aksesibel untuk tombol clear (dibaca screen reader & title tooltip). @default 'Clear input' */
    readonly clearLabel?: string;
    /** Menandai input dalam status error validasi (border merah). @default false */
    readonly error?: boolean;
    /** Class tambahan untuk elemen pembungkus (wrapper `<div>`). */
    readonly containerClassName?: string;
}

const SIZE_STYLES: Record<InputSize, { input: string; icon: string; leftPadding: string; rightPadding: string; leftIconPos: string; rightIconPos: string }> = {
    sm: {
        input: 'text-xs py-1.5',
        icon: 'text-[16px]',
        leftPadding: 'pl-8',
        rightPadding: 'pr-8',
        leftIconPos: 'left-2.5',
        rightIconPos: 'right-2',
    },
    md: {
        input: 'text-sm py-2',
        icon: 'text-[18px]',
        leftPadding: 'pl-9',
        rightPadding: 'pr-9',
        leftIconPos: 'left-3',
        rightIconPos: 'right-2.5',
    },
};

/**
 * Komponen Input terpadu & theme-aware untuk VyloServe.
 *
 * Mengikuti standar UI/UX konsisten di seluruh 15 tema bawaan aplikasi:
 * - Warna teks eksplisit `text-slate-900 dark:text-slate-100` (mencegah bug teks hitam bawaan browser di tema gelap).
 * - Cincin fokus theme-aware `focus:ring-primary focus:border-primary`.
 * - Dukungan ikon kiri, ikon kanan, tombol clear, font monospace, dan aksesibilitas screen reader.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    {
        size = 'md',
        mono = false,
        fullWidth = true,
        leftIcon,
        rightIcon,
        onClear,
        clearLabel = 'Clear input',
        error = false,
        containerClassName = '',
        className = '',
        type = 'text',
        disabled = false,
        readOnly = false,
        value,
        ...restProps
    },
    ref
) {
    const sizeConfig = SIZE_STYLES[size];

    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const showClearButton = Boolean(onClear && !disabled && !readOnly && hasValue);
    const showRightIcon = Boolean(rightIcon && !showClearButton);

    const defaultPadding = size === 'sm' ? 'px-2.5' : 'px-3';
    const paddingLeftClass = leftIcon ? sizeConfig.leftPadding : defaultPadding;
    const paddingRightClass = (showClearButton || showRightIcon) ? sizeConfig.rightPadding : defaultPadding;

    const borderFocusClass = error
        ? 'border-red-500 dark:border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500'
        : 'border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary focus:border-primary';

    const fontClass = mono ? 'font-mono' : 'font-sans';

    return (
        <div
            className={`relative flex items-center ${fullWidth ? 'w-full' : 'inline-flex'} ${containerClassName} ${className}`}
        >
            {leftIcon && (
                <span
                    aria-hidden="true"
                    className={`material-symbols-outlined absolute ${sizeConfig.leftIconPos} text-slate-400 pointer-events-none select-none ${sizeConfig.icon}`}
                >
                    {leftIcon}
                </span>
            )}

            <input
                ref={ref}
                type={type}
                disabled={disabled}
                readOnly={readOnly}
                value={value}
                className={`w-full rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${fontClass} ${sizeConfig.input} ${paddingLeftClass} ${paddingRightClass} ${borderFocusClass}`}
                {...restProps}
            />

            {showClearButton && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={clearLabel}
                    title={clearLabel}
                    tabIndex={0}
                    className={`absolute ${sizeConfig.rightIconPos} text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-primary`}
                >
                    <span aria-hidden="true" className={`material-symbols-outlined ${sizeConfig.icon}`}>
                        close
                    </span>
                </button>
            )}

            {showRightIcon && (
                <span
                    aria-hidden="true"
                    className={`material-symbols-outlined absolute ${sizeConfig.rightIconPos} text-slate-400 pointer-events-none select-none ${sizeConfig.icon}`}
                >
                    {rightIcon}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
