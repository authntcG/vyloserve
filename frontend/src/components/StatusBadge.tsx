import { type ReactNode } from 'react';

export interface StatusBadgeProps {
    readonly status: string | ReactNode;
    readonly className?: string;
}

export function getStatusTheme(statusText: string) {
    const lowerText = statusText.toLowerCase();

    // 1. Tema Sukses/Aktif (Hijau) -- bg/border pakai opacity dari shade emerald-500 yang
    // theme-aware (BUKAN emerald-100/900 stok Tailwind, yang tidak punya --theme-* sama
    // sekali -- lihat docs/ui_consistency_guide.md § 1 & docs/known_bugs.md #42).
    if (lowerText.includes('running') || lowerText.includes('active') || lowerText.includes('install')) {
        return {
            badge: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30',
            dot: 'bg-emerald-500'
        };
    }

    // 2. Tema Peringatan/Error (Merah) -- sengaja statis, red tidak punya --theme-red-*
    // (sinyal bahaya universal lintas tema, lihat docs/ui_consistency_guide.md § 1).
    if (lowerText.includes('error') || lowerText.includes('fail') || lowerText.includes('offline')) {
        return {
            badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
            dot: 'bg-red-500'
        };
    }

    // 3. Tema Sistem/OS (dulu biru statis -- sekarang token primary, ikut tema aktif)
    if (lowerText.includes('native') || lowerText.includes('os') || lowerText.includes('system')) {
        return {
            badge: 'bg-primary/10 text-primary dark:bg-primary/20 border-primary/20 dark:border-primary/30',
            dot: 'bg-primary'
        };
    }

    // 4. Tema Default/Terisolasi (Abu-abu)
    // Berlaku untuk 'Stopped', 'Isolated', atau status yang tidak dikenali
    return {
        badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400'
    };
}

export default function StatusBadge({ status, className = '' }: Readonly<StatusBadgeProps>) {
    if (!status) return null;

    const statusString = typeof status === 'string' ? status : '';
    const theme = getStatusTheme(statusString);

    return (
        <span
            data-testid="status-badge"
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${theme.badge} ${className}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${theme.dot}`}></span>
            {status}
        </span>
    );
}
