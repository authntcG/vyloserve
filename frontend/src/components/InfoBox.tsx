import type { ReactNode } from 'react';

export type InfoBoxTone = 'info' | 'warning' | 'danger';

interface ToneClasses {
    readonly box: string;
    readonly accent: string;
    readonly mutedBody: string;
}

const TONE_CLASSES: Record<InfoBoxTone, ToneClasses> = {
    info: {
        box: 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30',
        accent: 'text-primary',
        mutedBody: 'text-slate-600 dark:text-slate-400',
    },
    warning: {
        box: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 dark:border-amber-500/30',
        accent: 'text-amber-600 dark:text-amber-500',
        mutedBody: 'text-slate-600 dark:text-slate-400',
    },
    danger: {
        box: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30',
        accent: 'text-red-800 dark:text-red-500',
        // Sengaja TETAP dua-shade merah (bukan slate netral seperti info/warning) -- red
        // tidak punya kendala tema (statis sengaja, lihat docs/ui_consistency_guide.md §1),
        // jadi aman dipertahankan lebih tegas untuk kesan "bahaya".
        mutedBody: 'text-red-700 dark:text-red-400',
    },
};

export interface InfoBoxProps {
    /** @default 'info' */
    readonly tone?: InfoBoxTone;
    /** Nama ikon Material Symbols. */
    readonly icon: string;
    /** Ada title -> mode "title+description" (title bold+accent, body netral/mutedBody).
     *  Tidak ada -> mode "flat text" (children langsung ikut warna accent tone). */
    readonly title?: string;
    /** Body teks (boleh JSX bebas, termasuk elemen interaktif tambahan di mode title+description). */
    readonly children: ReactNode;
    /** Escape hatch layout-only. */
    readonly className?: string;
}

/**
 * Kotak info/warning/danger standar aplikasi -- sebelumnya markup ini (padding+border+rounded+
 * ikon+teks) disalin manual nyaris identik di 9+ file, termasuk hardcoded `bg-blue-*` untuk tone
 * "info" (bukan theme-aware). Lihat docs/ui_consistency_guide.md dan docs/known_bugs.md #42.
 */
export default function InfoBox({ tone = 'info', icon, title, children, className = '' }: InfoBoxProps) {
    const t = TONE_CLASSES[tone];

    return (
        <div className={`p-3 border rounded-lg flex gap-3 items-start ${t.box} ${className}`}>
            <span aria-hidden="true" className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${t.accent}`}>{icon}</span>
            {title ? (
                // Warna/ukuran body diwariskan lewat CSS inheritance ke `children` (bukan div
                // pembungkus terpisah) -- supaya elemen interaktif tambahan (input/button) yang
                // sudah punya class warna/ukuran sendiri (mis. NewProject.tsx workspace box,
                // apache/Main.tsx retry button) TIDAK ikut terpaksa jadi warna/ukuran mutedBody.
                <div className={`flex flex-col gap-2 min-w-0 text-xs leading-relaxed ${t.mutedBody}`}>
                    <span className={`text-sm font-semibold ${t.accent}`}>{title}</span>
                    {children}
                </div>
            ) : (
                <div className={`text-xs leading-relaxed min-w-0 ${t.accent}`}>{children}</div>
            )}
        </div>
    );
}
