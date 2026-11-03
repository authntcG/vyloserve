import { useTranslation } from "react-i18next";
import ProgressBar from "./ProgressBar";

interface BackgroundProgressWidgetProps {
    readonly isOpen: boolean;            // Apakah proses sedang berjalan
    readonly progress: number;           // Nilai persen (0 - 100)
    readonly progressText: string;       // Teks deskripsi saat ini
    readonly title?: string;             // Judul widget (default: "Installing...")
    readonly onRestore: () => void;      // Fungsi saat widget diklik untuk membuka kembali modal
    readonly onCancel?: () => void;      // Fungsi pembatalan proses instalasi
    readonly isCancelling?: boolean;     // Status apakah sedang dalam proses pembatalan
}

export default function BackgroundProgressWidget({
    isOpen,
    progress,
    progressText,
    title,
    onRestore,
    onCancel,
    isCancelling = false
}: BackgroundProgressWidgetProps) {
    const { t } = useTranslation();
    
    // Jika tidak aktif atau progress sudah selesai total, sembunyikan widget
    if (!isOpen || progress <= 0 || progress >= 100) return null;

    const displayTitle = title || t('components.progress.installing');

    return (
        <div // NOSONAR typescript:S6819
            role="button"
            tabIndex={0}
            onClick={onRestore}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRestore();
                }
            }}
            aria-label={displayTitle}
            className="fixed bottom-6 right-6 w-80 text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl p-4 z-50 flex flex-col gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:border-primary/50 transition-colors group"
        >
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-primary animate-spin">sync</span>
                    {displayTitle}
                </span>
                <div className="flex items-center gap-1">
                    {onCancel && (
                        <button
                            type="button"
                            disabled={isCancelling}
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancel();
                            }}
                            title={t('common.cancel_install')}
                            aria-label={t('common.cancel_install')}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
                        >
                            <span className={`material-symbols-outlined text-[16px] leading-none ${isCancelling ? 'animate-spin' : ''}`}>
                                {isCancelling ? 'progress_activity' : 'cancel'}
                            </span>
                        </button>
                    )}
                    <span className="w-6 h-6 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px] leading-none">open_in_full</span>
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate w-3/4">{progressText || t('components.progress.processing')}</span>
                <span className="text-xs font-bold text-primary">{progress}%</span>
            </div>

            <ProgressBar percent={progress} />
        </div>
    );
}
