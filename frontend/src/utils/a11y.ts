import type { KeyboardEvent } from 'react';

/**
 * Membungkus handler klik agar elemen non-native (mis. <div> yang berperan sebagai
 * tombol) juga bisa diaktifkan lewat keyboard (Enter/Space), sesuai WCAG 2.1.1.
 * Selalu pasangkan dengan `role="button"` dan `tabIndex={0}` pada elemen yang sama.
 */
export function onEnterOrSpace<T = Element>(handler: (e: KeyboardEvent<T>) => void) {
    return (e: KeyboardEvent<T>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler(e);
        }
    };
}
