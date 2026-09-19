import { describe, it, expect, vi } from 'vitest';

// This file exercises the REAL i18next/react-i18next initialization in src/i18n.ts,
// so it must bypass the react-i18next mock that tests/setup.ts applies globally
// (that mock has no `initReactI18next` export, which src/i18n.ts requires).
vi.unmock('react-i18next');

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
