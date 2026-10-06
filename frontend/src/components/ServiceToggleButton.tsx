export interface ServiceToggleButtonLabels {
    readonly start: string;
    readonly stop: string;
    readonly starting: string;
    readonly stopping: string;
}

export interface ServiceToggleButtonProps {
    readonly isRunning: boolean;
    readonly isToggling: boolean;
    readonly onClick: () => void;
    /** String sudah di-translate oleh caller -- tiap modul (apache/php/database/dashboard) punya i18n key sendiri. */
    readonly labels: ServiceToggleButtonLabels;
    /** Escape hatch layout saja (mis. `flex-1`), bukan untuk override warna. */
    readonly className?: string;
}

/**
 * Tombol Start/Stop sebuah service. SENGAJA terpisah dari `Button` -- warnanya
 * fungsi dari state runtime (bukan intent statis per lokasi) dan selalu berpasangan
 * dengan swap ikon+label, jadi menyatukannya sebagai varian `Button` ("success"/
 * "warning") hanya memindahkan ternary yang sama ke tiap call site, bukan
 * menghilangkan duplikasinya. Lihat docs/ui_consistency_guide.md.
 */
export default function ServiceToggleButton({ isRunning, isToggling, onClick, labels, className = '' }: ServiceToggleButtonProps) {
    const colorClass = isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isToggling}
            className={`text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:scale-100 ${colorClass} ${className}`}
        >
            {isToggling ? (
                <>
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    {isRunning ? labels.stopping : labels.starting}
                </>
            ) : (
                <>
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{isRunning ? 'stop' : 'play_arrow'}</span>
                    {isRunning ? labels.stop : labels.start}
                </>
            )}
        </button>
    );
}
