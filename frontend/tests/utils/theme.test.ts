import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from '../../src/utils/theme';

beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
});

describe('applyTheme', () => {
    it('sets data-theme and adds the dark class for a dark-suffixed theme', () => {
        applyTheme('vyloserve-dark');

        expect(document.documentElement.dataset.theme).toBe('vyloserve-dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('sets data-theme and removes the dark class for a "-light" suffixed theme', () => {
        document.documentElement.classList.add('dark');

        applyTheme('solarized-light');

        expect(document.documentElement.dataset.theme).toBe('solarized-light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('treats a theme without a "-light" suffix as dark (e.g. nord-dark)', () => {
        applyTheme('nord-dark');

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
