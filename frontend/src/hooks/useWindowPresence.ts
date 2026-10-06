// src/hooks/useWindowPresence.ts
import { useEffect, useState } from 'react';

export interface WindowPresence {
    hasFocus: boolean;
    isMinimized: boolean;
    isHidden: boolean;
    isBackgrounded: boolean;
}

interface VyloWindowStateDetail {
    minimized?: boolean;
    hidden?: boolean;
}

/**
 * Melacak apakah window aplikasi sedang "backgrounded" -- tidak fokus,
 * di-minimize, atau disembunyikan ke system tray. "Tidak fokus" dideteksi
 * murni di frontend (document.hasFocus() + focus/blur). "Minimized"/"hidden"
 * tidak bisa diketahui dari DOM -- backend mem-push-nya lewat
 * evaluate_js(window.dispatchEvent(new CustomEvent('vylo_window_state', ...)))
 * (pola sama dengan vylo_log/vylo_progress yang sudah ada), lihat main.py.
 */
export function useWindowPresence(): WindowPresence {
    const [hasFocus, setHasFocus] = useState(() => (typeof document !== 'undefined' ? document.hasFocus() : true));
    const [isMinimized, setIsMinimized] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        const handleFocus = () => setHasFocus(true);
        // TIDAK sekadar setHasFocus(false) -- window 'blur' juga bisa ter-fire untuk
        // perpindahan fokus ANTAR ELEMEN DI DALAM HALAMAN YANG SAMA (bukan window asli
        // kehilangan fokus OS-level), lewat "focus target adjustment" milik spec UI Events
        // saat sebelumnya belum ada elemen yang fokus (activeElement masih <body>) --
        // jsdom mengimplementasikan ini dengan benar, dan kondisi yang sama bisa terjadi di
        // Chromium/WebView2 asli juga (klik pertama kali setelah window dibuka). Cross-check
        // ke document.hasFocus() sebagai sumber kebenaran, bukan percaya mentah-mentah event
        // 'blur' itu sendiri -- ini menghindari false-positive "backgrounded" sesaat.
        const handleBlur = () => setHasFocus(document.hasFocus());
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        const handleWindowState = (e: Event) => {
            const detail = (e as CustomEvent<VyloWindowStateDetail>).detail ?? {};
            if (typeof detail.minimized === 'boolean') setIsMinimized(detail.minimized);
            if (typeof detail.hidden === 'boolean') setIsHidden(detail.hidden);
        };
        window.addEventListener('vylo_window_state', handleWindowState);
        return () => window.removeEventListener('vylo_window_state', handleWindowState);
    }, []);

    return { hasFocus, isMinimized, isHidden, isBackgrounded: !hasFocus || isMinimized || isHidden };
}
