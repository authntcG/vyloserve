export interface TabItem<T extends string = string> {
    readonly value: T;
    readonly label: string;
    /** Opsional: tampilkan dot indikator kecil setelah label (mis. status "ada versi terinstal" di Runtimes). */
    readonly badgeColorClass?: string;
}

export interface TabsProps<T extends string = string> {
    readonly tabs: ReadonlyArray<TabItem<T>>;
    readonly value: T;
    readonly onChange: (value: T) => void;
    /** Escape hatch layout saja (mis. `mb-4`) untuk container pembungkus. */
    readonly className?: string;
}

/**
 * Tab bar underline standar aplikasi -- sebelumnya markup ini disalin manual di
 * Database/Runtimes/URL-Encode-Decode/Base64 (4 tempat), termasuk satu drift kecil
 * (Database tidak punya hover state di tab non-aktif). Lihat docs/ui_consistency_guide.md.
 *
 * TIDAK dipakai untuk "Segmented Control" (pill track, mis. `ShareModeButton` di
 * Tunnels) atau toggle mode chip individual (mis. Text/File di Base64) -- keduanya
 * pola berbeda secara sengaja, bukan tab navigasi. Lihat docs/frontend_ui.md §14.1.
 */
export default function Tabs<T extends string = string>({ tabs, value, onChange, className = '' }: TabsProps<T>) {
    return (
        <div className={`flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200 dark:border-slate-800 ${className}`}>
            {tabs.map((tab) => {
                const isActive = tab.value === value;
                return (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onChange(tab.value)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                            isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                        {tab.badgeColorClass && <span className={`w-2 h-2 rounded-full shrink-0 ${tab.badgeColorClass}`} />}
                    </button>
                );
            })}
        </div>
    );
}
