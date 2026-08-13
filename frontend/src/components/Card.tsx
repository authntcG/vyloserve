// src/components/Card.tsx
import { type ReactNode } from 'react';

export interface CardProps {
    title: string;
    status?: string | null; // Diubah menjadi string universal agar bisa menerima teks apapun
    gridCols?: string;
    dropdownActions?: ReactNode;
    footerActions?: ReactNode;
    children: ReactNode;
}

export default function Card({
    title,
    status = null,
    gridCols = 'grid-cols-2 md:grid-cols-4',
    dropdownActions,
    footerActions,
    children
}: CardProps) {

    // --- HELPER: PENENTUAN TEMA STATUS DINAMIS ---
    const getStatusTheme = (statusText: string) => {
        const lowerText = statusText.toLowerCase();

        // 1. Tema Sukses/Aktif (Hijau)
        if (lowerText.includes('running') || lowerText.includes('active')) {
            return {
                badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
                dot: 'bg-emerald-500'
            };
        }

        // 2. Tema Peringatan/Error (Merah)
        if (lowerText.includes('error') || lowerText.includes('fail') || lowerText.includes('offline')) {
            return {
                badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
                dot: 'bg-red-500'
            };
        }

        // 3. Tema Sistem/OS (Biru)
        if (lowerText.includes('native') || lowerText.includes('os') || lowerText.includes('system')) {
            return {
                badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
                dot: 'bg-blue-500'
            };
        }

        // 4. Tema Default/Terisolasi (Abu-abu)
        // Berlaku untuk 'Stopped', 'Isolated', atau status yang tidak dikenali
        return {
            badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            dot: 'bg-slate-400'
        };
    };

    // Ekstrak tema hanya jika properti status tersedia
    const theme = status ? getStatusTheme(status) : null;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">

            {/* Header & Status dalam file Card.tsx */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">{title}</h3>
                    {/* Badge Status */}
                    {status && theme && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${theme.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${theme.dot}`}></span>
                            {/* Mencetak teks status aslinya, bukan lagi teks hardcode */}
                            {status}
                        </span>
                    )}
                </div>

                {/* Dropdown Menu Titik Tiga */}
                {dropdownActions && (
                    <div className="relative group/menu">
                        <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 outline-none">
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 overflow-hidden">
                            {dropdownActions}
                        </div>
                    </div>
                )}
            </div>

            {/* Konten Utama (Grid Information) */}
            <div className={`grid gap-6 ${gridCols}`}>
                {children}
            </div>

            {/* Footer / Action Buttons */}
            {footerActions && (
                <div className="flex gap-3 mt-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                    {footerActions}
                </div>
            )}

        </div>
    );
}