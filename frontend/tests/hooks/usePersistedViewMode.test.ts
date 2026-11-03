import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedViewMode } from '../../src/hooks/usePersistedViewMode';

describe('usePersistedViewMode', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('returns defaultMode when localStorage is empty', () => {
        const { result } = renderHook(() => usePersistedViewMode('projects', 'table'));
        expect(result.current[0]).toBe('table');
    });

    it('reads saved valid view mode from localStorage', () => {
        localStorage.setItem('vylo_view_mode_database', 'table');
        const { result } = renderHook(() => usePersistedViewMode('database', 'card'));
        expect(result.current[0]).toBe('table');
    });

    it('falls back to defaultMode when localStorage contains an invalid value', () => {
        localStorage.setItem('vylo_view_mode_php', 'invalid_mode');
        const { result } = renderHook(() => usePersistedViewMode('php', 'card'));
        expect(result.current[0]).toBe('card');
    });

    it('updates viewMode state and persists valid value to localStorage', () => {
        const { result } = renderHook(() => usePersistedViewMode('runtimes', 'card'));
        expect(result.current[0]).toBe('card');

        act(() => { // NOSONAR typescript:S8980 Required to flush React 18 hook state
            result.current[1]('table');
        });

        expect(result.current[0]).toBe('table');
        expect(localStorage.getItem('vylo_view_mode_runtimes')).toBe('table');
    });

    it('ignores invalid values passed to the setter', () => {
        const { result } = renderHook(() => usePersistedViewMode('projects', 'card'));

        act(() => { // NOSONAR typescript:S8980 Required to flush React 18 hook state
            // @ts-expect-error Testing invalid runtime input
            result.current[1]('grid');
        });

        expect(result.current[0]).toBe('card');
        expect(localStorage.getItem('vylo_view_mode_projects')).toBeNull();
    });

    it('handles localStorage throw gracefully on read and write', () => {
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('Storage access denied');
        });

        const { result } = renderHook(() => usePersistedViewMode('database', 'card'));
        expect(result.current[0]).toBe('card');

        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('Quota exceeded');
        });

        act(() => { // NOSONAR typescript:S8980 Required to flush React 18 hook state
            result.current[1]('table');
        });

        expect(result.current[0]).toBe('table');

        getItemSpy.mockRestore();
        setItemSpy.mockRestore();
    });
});
