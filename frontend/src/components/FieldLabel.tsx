import type { ReactNode } from 'react';

export type FieldLabelSize = 'sm' | 'xs';
export type FieldLabelTone = 'default' | 'muted' | 'subtle' | 'eyebrow' | 'primary';

export interface FieldLabelProps {
    readonly htmlFor?: string;
    /** @default 'sm' */
    readonly size?: FieldLabelSize;
    /** @default 'default' */
    readonly tone?: FieldLabelTone;
    /** Sembunyikan visual, tetap terbaca screen reader (mis. field yang labelnya sudah tersirat dari context sekitar). */
    readonly visuallyHidden?: boolean;
    /** Escape hatch layout (mis. `flex justify-between` untuk baris label+nilai slider) -- JANGAN dipakai untuk override warna/ukuran. */
    readonly className?: string;
    readonly children: ReactNode;
}

const SIZE_CLASSES: Record<FieldLabelSize, string> = {
    sm: 'text-sm',
    xs: 'text-xs',
};

const TONE_CLASSES: Record<FieldLabelTone, string> = {
    default: 'text-slate-700 dark:text-slate-300',
    muted: 'text-slate-600 dark:text-slate-400',
    subtle: 'text-slate-500',
    eyebrow: 'text-slate-500 uppercase',
    primary: 'text-primary',
};

/**
 * Label field standar aplikasi -- sebelumnya 9 varian className nyaris identik
 * disalin manual di ~20 file (beda cuma ukuran/shade warna, bukan perbedaan
 * desain yang disengaja). Lihat docs/ui_consistency_guide.md.
 *
 * TIDAK dipakai untuk heading section (mis. label ikon+teks besar `text-slate-900`
 * di atas sekelompok field, atau heading `text-lg font-semibold`) atau label yang
 * membungkus checkbox/radio/toggle card -- keduanya pola berbeda secara sengaja.
 */
export default function FieldLabel({ htmlFor, size = 'sm', tone = 'default', visuallyHidden = false, className = '', children }: FieldLabelProps) {
    if (visuallyHidden) {
        return <label htmlFor={htmlFor} className="sr-only">{children}</label>;
    }

    return (
        <label htmlFor={htmlFor} className={`font-medium ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}>
            {children}
        </label>
    );
}
