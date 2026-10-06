export interface OsCompatibilityCardProps {
    readonly icon: string;
    /** Label kecil di atas nama OS, mis. "Detected System" (sudah di-translate caller). */
    readonly detectedLabel: string;
    readonly osName: string;
    readonly arch: string;
    /** Teks badge kanan, mis. "Compatible" (sudah di-translate caller). */
    readonly compatibleLabel: string;
}

/**
 * Kartu "sistem terdeteksi" yang muncul di wizard install Apache/PHP/Database --
 * sebelumnya ~16 baris JSX disalin verbatim di 3 file. Lihat docs/ui_consistency_guide.md.
 */
export default function OsCompatibilityCard({ icon, detectedLabel, osName, arch, compatibleLabel }: OsCompatibilityCardProps) {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{detectedLabel}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {osName} <span className="text-primary font-mono text-xs ml-1 bg-primary/10 dark:bg-primary/20 px-1 rounded">{arch}</span>
                    </span>
                </div>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                {compatibleLabel}
            </span>
        </div>
    );
}
