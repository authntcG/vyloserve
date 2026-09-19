import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * jsdom tidak mengimplementasikan Element.prototype.scrollIntoView (lihat
 * https://github.com/jsdom/jsdom/issues/1695). Beberapa komponen (mis. semua
 * form "NewInstance" Apache/PHP/Database) memanggilnya lewat setTimeout saat
 * isInstalling=true untuk auto-scroll ke progress bar; tanpa stub ini,
 * timer tsb bisa throw "is not a function" SETELAH test yang memicunya sudah
 * selesai, muncul sebagai unhandled exception yang membingungkan pada test
 * lain. Di-stub sebagai no-op secara global di sini, bukan per test file.
 */
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}

/**
 * Mock global react-i18next.useTranslation() untuk semua test.
 *
 * Kenapa di-mock, bukan pakai instance i18next asli:
 * - Komponen di proyek ini konsisten memanggil t(key, fallback) atau
 *   t(key, fallback, { ...interpolasi }) -- fallback string SELALU disediakan
 *   di call site untuk key yang butuh ditampilkan ke user (lihat AGENTS.md
 *   aturan i18n). Mock ini meniru semantik itu tanpa perlu memuat
 *   locales/*.json sungguhan, jadi test komponen tidak ikut gagal kalau ada
 *   typo/perubahan teks terjemahan -- itu tanggung jawab
 *   tests/test_i18n_keys.py (backend) & review manual (frontend), bukan test
 *   komponen ini.
 * - Kalau sebuah test BENAR-BENAR perlu memverifikasi teks terjemahan asli
 *   (jarang), override mock ini per-file dengan vi.mock('react-i18next', ...)
 *   di file test yang bersangkutan (mock di file test meng-override mock global
 *   ini untuk file tersebut).
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValueOrOptions?: unknown, maybeOptions?: Record<string, unknown>) => {
            const hasDefaultValue = typeof defaultValueOrOptions === 'string';
            const options = (hasDefaultValue ? maybeOptions : (defaultValueOrOptions as Record<string, unknown> | undefined)) ?? {};
            let result = hasDefaultValue ? (defaultValueOrOptions as string) : key;
            for (const [k, v] of Object.entries(options)) {
                result = result.replaceAll(`{{${k}}}`, String(v));
            }
            return result;
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));
