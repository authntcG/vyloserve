import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, getCachedTheme, THEME_STORAGE_KEY } from '../../src/utils/theme';

beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    delete window.__VYLO_INITIAL_THEME__;
});

describe('applyTheme', () => {
    it('sets data-theme and adds the dark class for a dark-suffixed theme', () => {
        applyTheme('vyloserve-dark');

        expect(document.documentElement.dataset.theme).toBe('vyloserve-dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('vyloserve-dark');
    });

    it('sets data-theme and removes the dark class for a "-light" suffixed theme', () => {
        document.documentElement.classList.add('dark');

        applyTheme('solarized-light');

        expect(document.documentElement.dataset.theme).toBe('solarized-light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('solarized-light');
    });

    it('treats a theme without a "-light" suffix as dark (e.g. nord-dark)', () => {
        applyTheme('nord-dark');

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('nord-dark');
    });

    it('correctly applies classic Windows XP Luna (light) and Zune (dark) themes', () => {
        applyTheme('xp-zune-dark');
        expect(document.documentElement.dataset.theme).toBe('xp-zune-dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('xp-zune-dark');

        applyTheme('xp-luna-light');
        expect(document.documentElement.dataset.theme).toBe('xp-luna-light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('xp-luna-light');
    });

    it('returns default vyloserve-dark when localStorage is empty', () => {
        expect(getCachedTheme()).toBe('vyloserve-dark');
    });

    it('returns window.__VYLO_INITIAL_THEME__ when defined, even if localStorage differs', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'vyloserve-dark');
        window.__VYLO_INITIAL_THEME__ = 'gruvbox-dark';
        expect(getCachedTheme()).toBe('gruvbox-dark');
    });

    it('sets window.__VYLO_INITIAL_THEME__ when applyTheme is called', () => {
        applyTheme('catppuccin-mocha-dark');
        expect(window.__VYLO_INITIAL_THEME__).toBe('catppuccin-mocha-dark');
    });

    it('returns cached theme when localStorage has a valid theme', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'tokyo-night-dark');
        expect(getCachedTheme()).toBe('tokyo-night-dark');
    });

    it('handles localStorage errors gracefully in getCachedTheme and applyTheme', () => {
        const originalGetItem = localStorage.getItem;
        const originalSetItem = localStorage.setItem;

        localStorage.getItem = () => { throw new Error('SecurityError: localStorage blocked'); };
        expect(getCachedTheme()).toBe('vyloserve-dark');

        localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
        expect(() => applyTheme('dracula-dark')).not.toThrow();
        expect(document.documentElement.dataset.theme).toBe('dracula-dark');

        localStorage.getItem = originalGetItem;
        localStorage.setItem = originalSetItem;
    });
});
