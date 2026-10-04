/**
 * Menerapkan preset tema ke dokumen: mengatur atribut `data-theme` (dipakai oleh
 * override CSS variable per tema di index.css) dan kelas `dark` pada <html> (dipakai
 * Tailwind `@custom-variant dark`). Dipanggil dari dua tempat -- bootstrap awal di
 * App.tsx dan saat user mengganti tema di SettingsModals.tsx -- lewat helper bersama
 * ini supaya keduanya tidak pernah diam-diam berbeda perilaku.
 */
export function applyTheme(theme: string): void {
    document.documentElement.dataset.theme = theme;
    if (theme.includes('-light')) {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
}
