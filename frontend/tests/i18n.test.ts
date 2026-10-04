import { describe, it, expect, vi } from 'vitest';
import enTranslation from '../src/locales/en/translation.json';
import idTranslation from '../src/locales/id/translation.json';

// This file exercises the REAL i18next/react-i18next initialization in src/i18n.ts,
// so it must bypass the react-i18next mock that tests/setup.ts applies globally
// (that mock has no `initReactI18next` export, which src/i18n.ts requires).
vi.unmock('react-i18next');

/**
 * Mengumpulkan semua dot-path menuju leaf value (string) di dalam object translation
 * JSON bersarang, mis. { ui: { update: { check: "..." } } } -> ["ui.update.check"].
 */
function collectLeafKeyPaths(node: unknown, prefix = ''): string[] {
    if (typeof node !== 'object' || node === null) {
        return [prefix];
    }
    return Object.entries(node).flatMap(([key, value]) =>
        collectLeafKeyPaths(value, prefix ? `${prefix}.${key}` : key)
    );
}

describe('i18n', () => {
    it('initializes with English resources and can translate a known key', async () => {
        const { default: i18n } = await import('../src/i18n');
        await new Promise<void>((resolve) => {
            if (i18n.isInitialized) resolve();
            else i18n.on('initialized', () => resolve());
        });

        expect(i18n.language).toBeTruthy();
        expect(i18n.t('common.close')).toBe('Close');
    });

    it('falls back to English when switched to an unsupported language', async () => {
        const { default: i18n } = await import('../src/i18n');
        await i18n.changeLanguage('fr');

        expect(i18n.t('common.close')).toBe('Close');

        await i18n.changeLanguage('en');
    });

    it('translates a known key in Indonesian after switching language', async () => {
        const { default: i18n } = await import('../src/i18n');
        await i18n.changeLanguage('id');

        expect(i18n.t('common.close')).not.toBe('');

        await i18n.changeLanguage('en');
    });
});

describe('translation locale parity', () => {
    // Regresi: id/translation.json pernah punya blok "git" top-level yatim/duplikat
    // (4 key) yang tidak pernah dipakai di kode mana pun -- lihat docs/known_bugs.md.
    // tests/test_i18n_keys.py (backend) hanya mengecek key "backend.*" yang dipakai
    // dari Python; ia tidak akan pernah menangkap drift seperti ini pada key
    // "ui.*"/"tools.*"/dsb yang murni frontend. Test ini menutup celah tersebut dengan
    // membandingkan SELURUH dot-path key set kedua locale, dua arah.
    it('has identical leaf key sets in en and id translation.json', () => {
        const enKeys = new Set(collectLeafKeyPaths(enTranslation));
        const idKeys = new Set(collectLeafKeyPaths(idTranslation));

        const missingInId = [...enKeys].filter((key) => !idKeys.has(key)).sort();
        const missingInEn = [...idKeys].filter((key) => !enKeys.has(key)).sort();

        expect(missingInId, `Key ada di en tapi hilang di id:\n${missingInId.join('\n')}`).toEqual([]);
        expect(missingInEn, `Key ada di id tapi hilang di en (atau yatim):\n${missingInEn.join('\n')}`).toEqual([]);
    });
});
