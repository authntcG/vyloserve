import type { MouseEvent } from 'react';

export interface ToggleSwitchProps {
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly disabled?: boolean;
    /** Wajib diisi -- jadi aria-label, karena toggle tidak punya teks visual sendiri. */
    readonly label: string;
    /**
     * 'primary' (default) untuk toggle preferensi biasa (mis. opt-in pre-release,
     * registrasi PATH). 'status' (hijau emerald) khusus untuk toggle yang merepresentasikan
     * status LIVE sebuah service (mis. toggle running/stopped di Sidebar) -- beda makna
     * (status vs preferensi), bukan sekadar variasi selera warna.
     */
    readonly tone?: 'primary' | 'status';
    /**
     * Escape hatch untuk kasus `tone="status"`: status checkbox dikontrol dari polling
     * eksternal (bukan dari toggle ini sendiri), jadi aksi nyata (start/stop + preventDefault
     * supaya browser tidak ikut mengubah tampilan checkbox sebelum polling berikutnya, +
     * stopPropagation) perlu ditangani di `onClick`, bukan `onChange` -- lihat `Sidebar.tsx`.
     * Kalau diisi, `onChange` WAJIB tetap diisi juga (boleh no-op `() => {}`).
     */
    readonly onClick?: (e: MouseEvent<HTMLInputElement>) => void;
    /** @default 'md' -- 'sm' untuk konteks padat (mis. grid chip ekstensi PHP). */
    readonly size?: 'sm' | 'md';
    /**
     * @default true -- set `false` untuk toggle yang MURNI DEKORATIF, di mana klik
     * sebenarnya ditangani elemen pembungkus di luar (mis. `<button>` yang membungkus
     * seluruh baris). Menambahkan `pointer-events-none` pada label supaya klik tembus
     * ke pembungkus, bukan diserap toggle ini sendiri -- lihat `menu/php/Settings.tsx`.
     */
    readonly interactive?: boolean;
}

const SIZE_CLASSES: Record<'sm' | 'md', { track: string; thumb: string }> = {
    sm: { track: 'w-7 h-4', thumb: 'after:h-3 after:w-3' },
    md: { track: 'w-9 h-5', thumb: 'after:h-4 after:w-4' },
};

/**
 * Toggle switch standar aplikasi -- satu konvensi warna (lihat `tone`) dan dua ukuran
 * (lihat `size`), dipakai ulang di semua tempat yang sebelumnya menyalin markup
 * `sr-only peer` secara manual. Lihat docs/ui_consistency_guide.md.
 */
export default function ToggleSwitch({ checked, onChange, disabled = false, label, tone = 'primary', onClick, size = 'md', interactive = true }: ToggleSwitchProps) {
    const checkedColorClass = tone === 'status' ? 'peer-checked:bg-emerald-500' : 'peer-checked:bg-primary';
    const sizeClasses = SIZE_CLASSES[size];

    return (
        <label className={`relative inline-flex items-center cursor-pointer ${interactive ? '' : 'pointer-events-none'}`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                onClick={onClick}
                aria-label={label}
                className="sr-only peer"
            />
            <div
                className={`${sizeClasses.track} bg-slate-300 dark:bg-slate-700 rounded-full peer
                    peer-checked:after:translate-x-full after:content-[''] after:absolute
                    after:top-[2px] after:start-[2px] after:bg-white after:rounded-full
                    ${sizeClasses.thumb} after:transition-all
                    peer-disabled:opacity-40 peer-disabled:grayscale
                    peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary
                    ${checkedColorClass}`}
            />
        </label>
    );
}
