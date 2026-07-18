// src/components/Card.tsx
import { ReactNode } from 'react';

export interface CardProps {
    title: string;
    status?: 'running' | 'stopped' | null; // Opsional: Untuk layanan yang butuh indikator on/off (seperti PHP/MariaDB)
    gridCols?: string; // Opsional: Menyesuaikan jumlah kolom (default: 4)
    dropdownActions?: ReactNode; // Aksi pada menu titik tiga
    footerActions?: ReactNode; // Tombol di bagian bawah
    children: ReactNode; // Konten detail di bagian tengah
}

export default function Card({
    title,
    status = null,
    gridCols = 'grid-cols-2 md:grid-cols-4',
    dropdownActions,
    footerActions,
    children
}: CardProps) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">

            {/* Header & Status */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>

                    {/* Tampilkan Badge Status HANYA jika prop status dikirimkan */}
                    {status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status === 'running'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'running' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                    )}
                </div>

                {/* Dropdown Menu Titik Tiga */}
                {dropdownActions && (
                    <div className="relative group/menu">
                        <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
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