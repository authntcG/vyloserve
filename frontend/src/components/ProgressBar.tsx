export interface ProgressBarProps {
    readonly percent: number;
    /** Escape hatch layout saja (mis. `mt-2`) -- JANGAN dipakai untuk override warna/tinggi. */
    readonly className?: string;
}

/**
 * Track + fill progress bar standar aplikasi -- satu-satunya sumber kebenaran untuk
 * visual progress bar (tinggi, warna, radius, transisi). Sebelumnya markup ini
 * di-duplikasi inline di 8+ file, salah satunya bahkan pakai warna emerald alih-alih
 * primary. Lihat docs/ui_consistency_guide.md.
 */
export default function ProgressBar({ percent, className = '' }: ProgressBarProps) {
    return (
        <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden ${className}`}>
            <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}
