import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ToastProvider } from '../src/components/ToastContext';

/**
 * Helper bersama dipakai di SELURUH file test frontend. Sengaja disentralkan
 * di sini (bukan diduplikasi per file) karena SonarQube new-code duplication
 * threshold proyek ini sangat ketat (lihat docs/development_testing.md §3) --
 * pola mock window.pywebview.api yang identik kalau ditulis ulang di setiap
 * file test akan langsung memicu temuan baru.
 */

export type MockApi = Record<string, ReturnType<typeof vi.fn>>;

/**
 * Membuat & memasang window.pywebview.api tiruan. Default resolve
 * {status:'success'} untuk fungsi-fungsi yang paling umum dipanggil saat
 * mount (get_*_status/get_installed_*), supaya komponen yang memanggilnya di
 * useEffect tidak throw karena property tidak terdefinisi. Override lewat
 * parameter kedua untuk kasus spesifik per test.
 */
export function mockPywebviewApi(overrides: MockApi = {}): MockApi {
    const api: MockApi = {
        test_connection: vi.fn().mockResolvedValue({ status: 'success' }),
        get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { language: 'en' } }),
        get_all_services_status: vi.fn().mockResolvedValue({ apache: false, php: false, database: false, cpu_load: 0 }),
        open_browser: vi.fn(),
        open_in_explorer: vi.fn(),
        browse_directory: vi.fn().mockResolvedValue(''),
        ...overrides,
    };
    (window as unknown as { pywebview: { api: MockApi } }).pywebview = { api };
    return api;
}

/** Lepas window.pywebview.api tiruan -- panggil di afterEach setiap file test yang memakai mockPywebviewApi(). */
export function resetPywebviewApi() {
    delete (window as unknown as { pywebview?: unknown }).pywebview;
}

/** Dispatch salah satu custom event global aplikasi (vylo_log, vylo_progress, service_status_changed, dst). */
export function dispatchAppEvent(name: string, detail: Record<string, unknown> = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Render dibungkus ToastProvider, untuk komponen yang memanggil useToast(). */
export function renderWithToast(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: ToastProvider, ...options });
}

export * from '@testing-library/react';
