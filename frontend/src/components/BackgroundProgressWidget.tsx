interface BackgroundProgressWidgetProps {
    isOpen: boolean;            // Apakah proses sedang berjalan
    progress: number;           // Nilai persen (0 - 100)
    progressText: string;       // Teks deskripsi saat ini
    title?: string;             // Judul widget (default: "Installing...")
    onRestore: () => void;      // Fungsi saat widget diklik untuk membuka kembali modal
}

export default function BackgroundProgressWidget({
    isOpen,
    progress,
    progressText,
    title = "Installing...",
    onRestore
}: BackgroundProgressWidgetProps) {
    // Jika tidak aktif atau progress sudah selesai total, sembunyikan widget
    if (!isOpen || progress <= 0 || progress >= 100) return null;

    return (
        <div
            onClick={onRestore}
            className="fixed bottom-6 right-6 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl p-4 z-50 flex flex-col gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 cursor-pointer hover:border-primary/50 transition-colors group"
        >
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-primary animate-spin">sync</span>
                    {title}
                </span>
                <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">open_in_full</span>
            </div>

            <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate w-3/4">{progressText || 'Memproses...'}</span>
                <span className="text-xs font-bold text-primary dark:text-blue-400">{progress}%</span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
}