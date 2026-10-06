import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWindowPresence } from '../../src/hooks/useWindowPresence';

function dispatchWindowState(detail: { minimized?: boolean; hidden?: boolean }) {
    window.dispatchEvent(new CustomEvent('vylo_window_state', { detail }));
}

describe('useWindowPresence', () => {
    // jsdom's document.hasFocus() defaults to false (tidak ada browser nyata yang
    // benar-benar fokus ke window) -- beda dari kondisi real-world saat aplikasi
    // desktop baru dibuka (window SELALU fokus). Mock STATEFUL (bukan nilai statis)
    // supaya simulateBlur()/simulateFocus() di bawah bisa mengubah nilai yang benar-benar
    // dibaca ulang oleh handleBlur()'s cross-check (lihat fix di useWindowPresence.ts).
    let focused = true;

    beforeEach(() => {
        focused = true;
        vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Pastikan test lain tidak ikut terpengaruh oleh blur yang di-dispatch di sini.
        act(() => {
            focused = true;
            window.dispatchEvent(new Event('focus'));
        });
    });

    /** Blur "sungguhan" -- document.hasFocus() juga ikut berubah, persis kondisi alt-tab/OS-level. */
    function simulateBlur() {
        focused = false;
        window.dispatchEvent(new Event('blur'));
    }

    function simulateFocus() {
        focused = true;
        window.dispatchEvent(new Event('focus'));
    }

    it('starts with isBackgrounded=false when the window has focus and nothing was pushed from backend', () => {
        const { result } = renderHook(() => useWindowPresence());

        expect(result.current.hasFocus).toBe(true);
        expect(result.current.isMinimized).toBe(false);
        expect(result.current.isHidden).toBe(false);
        expect(result.current.isBackgrounded).toBe(false);
    });

    it('sets isBackgrounded=true when the window loses focus (blur)', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            simulateBlur();
        });

        expect(result.current.hasFocus).toBe(false);
        expect(result.current.isBackgrounded).toBe(true);
    });

    it('clears isBackgrounded when focus returns', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            simulateBlur();
        });
        expect(result.current.isBackgrounded).toBe(true);

        act(() => {
            simulateFocus();
        });
        expect(result.current.isBackgrounded).toBe(false);
    });

    it('ignores a spurious window blur when document.hasFocus() still reports true (DOM focus-target-adjustment edge case, not a real OS-level blur)', () => {
        // Regresi: userEvent.click()/elemen pertama yang menerima fokus di halaman bisa
        // memicu window 'blur' versi jsdom (dan juga terjadi di Chromium/WebView2 asli) lewat
        // focus-target-adjustment milik spec UI Events, PADAHAL window itu sendiri tetap
        // fokus. Tanpa cross-check ke document.hasFocus(), ini jadi false-positive "backgrounded".
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            // focused TETAP true -- hanya event 'blur' yang ditembakkan, meniru target-adjustment.
            window.dispatchEvent(new Event('blur'));
        });

        expect(result.current.hasFocus).toBe(true);
        expect(result.current.isBackgrounded).toBe(false);
    });

    it('sets isBackgrounded=true when the backend pushes minimized=true via vylo_window_state', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            dispatchWindowState({ minimized: true });
        });

        expect(result.current.isMinimized).toBe(true);
        expect(result.current.isBackgrounded).toBe(true);
    });

    it('sets isBackgrounded=true when the backend pushes hidden=true via vylo_window_state', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            dispatchWindowState({ hidden: true });
        });

        expect(result.current.isHidden).toBe(true);
        expect(result.current.isBackgrounded).toBe(true);
    });

    it('clears isMinimized/isHidden when the backend later pushes false, restoring isBackgrounded to false', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            dispatchWindowState({ minimized: true, hidden: true });
        });
        expect(result.current.isBackgrounded).toBe(true);

        act(() => {
            dispatchWindowState({ minimized: false, hidden: false });
        });

        expect(result.current.isMinimized).toBe(false);
        expect(result.current.isHidden).toBe(false);
        expect(result.current.isBackgrounded).toBe(false);
    });

    it('ignores vylo_window_state events with no detail payload', () => {
        const { result } = renderHook(() => useWindowPresence());

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_window_state'));
        });

        expect(result.current.isMinimized).toBe(false);
        expect(result.current.isHidden).toBe(false);
    });
});
