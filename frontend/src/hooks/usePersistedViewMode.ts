import { useState, useCallback } from 'react';
import type { ViewMode } from '../components/ViewModeToggle';

/**
 * Custom hook to persist view mode (table vs card) per module across navigation and restarts.
 * Strictly whitelists values to 'card' | 'table' to prevent storage corruption.
 */
export function usePersistedViewMode(moduleKey: string, defaultMode: ViewMode = 'card'): [ViewMode, (mode: ViewMode) => void] {
    const storageKey = `vylo_view_mode_${moduleKey}`;

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = window.localStorage.getItem(storageKey);
                if (saved === 'card' || saved === 'table') {
                    return saved;
                }
            }
        } catch {
            // Fallback gracefully on storage access errors
        }
        return defaultMode;
    });

    const updateViewMode = useCallback((newMode: ViewMode) => {
        if (newMode !== 'card' && newMode !== 'table') return;
        setViewMode(newMode);
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(storageKey, newMode);
            }
        } catch {
            // Ignore quota or disabled storage errors
        }
    }, [storageKey]);

    return [viewMode, updateViewMode];
}
