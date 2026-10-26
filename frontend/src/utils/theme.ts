declare global {
    interface Window {
        __VYLO_INITIAL_THEME__?: string;
    }
}

export const THEME_STORAGE_KEY = 'vylo_theme';

/**
 * Mengambil tema yang tersimpan di window state atau localStorage sebagai fallback instan
 * sebelum IPC backend merespons, untuk mencegah Flash of Incorrect Theme (FOIT).
 */
export function getCachedTheme(): string {
    if (typeof window !== 'undefined' && window.__VYLO_INITIAL_THEME__) {
        return window.__VYLO_INITIAL_THEME__;
    }
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'vyloserve-dark';
    } catch {
        return 'vyloserve-dark';
    }
}

/**
 * Menerapkan preset tema ke dokumen: mengatur atribut `data-theme` (dipakai oleh
 * override CSS variable per tema di index.css) dan kelas `dark` pada <html> (dipakai
 * Tailwind `@custom-variant dark`). Menyimpan juga ke localStorage dan window state
 * agar pada render berikutnya tema dapat langsung aktif secara sinkron tanpa menunggu
 * IPC backend. Dipanggil dari bootstrap awal di App.tsx/main.tsx dan saat user mengganti
 * tema di SettingsModals.tsx -- lewat helper bersama ini supaya keduanya tidak pernah
 * diam-diam berbeda perilaku.
 */
export function applyTheme(theme: string): void {
    document.documentElement.dataset.theme = theme;
    if (theme.includes('-light')) {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
    if (typeof window !== 'undefined') {
        window.__VYLO_INITIAL_THEME__ = theme;
    }
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Abaikan error kuota atau restriksi akses localStorage
    }
}
