// src/components/ToastContext.tsx
import { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback, useMemo } from 'react';
import { useWindowPresence } from '../hooks/useWindowPresence';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
    isClosing?: boolean;
}

export interface ToastHistoryEntry {
    id: number;
    message: string;
    type: ToastType;
    timestamp: number;
}

// Preseden: LogsPanel.tsx's MAX_LOG_ENTRIES=500 -- angka di sini lebih kecil
// karena toast jauh lebih jarang muncul dibanding entri log debug.
const MAX_TOAST_HISTORY = 100;

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
    history: ToastHistoryEntry[];
    unreadCount: number;
    clearHistory: () => void;
    markHistoryRead: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [history, setHistory] = useState<ToastHistoryEntry[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isBackgrounded } = useWindowPresence();
    const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true);

    // showToast's identity HARUS tetap stabil (sama persis perilaku sebelum fitur ini) --
    // 120+ call site di codebase sudah ada yang menaruh showToast di dependency array
    // useEffect-nya sendiri (pola "fetch sekali + tampilkan toast error", lihat
    // src/menu/apache/Settings.tsx). Kalau showToast dibuat berubah identity setiap
    // isBackgrounded/desktopNotificationsEnabled berganti (mis. gara-gara window blur
    // sesaat), SEMUA efek itu ikut re-run tak terduga -- regresi nyata yang ditemukan
    // lewat tests/menu/apache/Settings.test.tsx (re-fetch di tengah interaksi dropdown
    // membuatnya tertutup). Baca lewat ref, BUKAN dependency array.
    const isBackgroundedRef = useRef(isBackgrounded);
    isBackgroundedRef.current = isBackgrounded;
    const desktopNotificationsEnabledRef = useRef(desktopNotificationsEnabled);
    desktopNotificationsEnabledRef.current = desktopNotificationsEnabled;

    useEffect(() => {
        // SENGAJA TIDAK memanggil api.get_app_settings() sendiri di sini -- App.tsx sudah
        // memanggilnya sekali saat boot (untuk theme/language/dsb) dan mem-broadcast nilai
        // enable_desktop_notifications lewat event yang sama di bawah ini begitu selesai.
        // Memanggil ulang di sini akan jadi fetch duplikat (lihat docs/known_bugs.md) DAN
        // "mencuri" satu slot mockResolvedValueOnce() di banyak test lain yang mem-mock
        // get_app_settings dengan urutan response spesifik untuk komponennya sendiri.
        //
        // Dipancarkan App.tsx (initial load) MAUPUN SettingsModals.tsx (saat toggle "Desktop
        // Notifications" disimpan) -- pola sama dengan 'vylo_log_settings_changed'
        // (LogsPanel.tsx), supaya perubahan langsung berlaku tanpa remount provider ini.
        const handleSettingChanged = (e: Event) => {
            const detail = (e as CustomEvent<{ enabled?: boolean }>).detail;
            if (typeof detail?.enabled === 'boolean') setDesktopNotificationsEnabled(detail.enabled);
        };
        window.addEventListener('vylo_desktop_notifications_changed', handleSettingChanged);
        return () => window.removeEventListener('vylo_desktop_notifications_changed', handleSettingChanged);
    }, []);

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

        // Entri histori direkam saat alert TERJADI, bukan saat toast in-app
        // auto-dismiss atau ditutup manual -- lihat docs plan fitur histori toast.
        setHistory((prev) => [...prev, { id, message, type, timestamp: Date.now() }].slice(-MAX_TOAST_HISTORY));
        setUnreadCount((prev) => prev + 1);

        // Notifikasi native Windows HANYA saat window backgrounded (tidak fokus/minimized/
        // hidden ke tray) DAN setting diaktifkan -- mencegah double-interruption saat user
        // memang sedang melihat aplikasi (lihat Analisa HCI di docs plan fitur histori toast).
        if (isBackgroundedRef.current && desktopNotificationsEnabledRef.current) {
            const api = (window as any).pywebview?.api;
            if (api && typeof api.show_native_notification === 'function') {
                api.show_native_notification(message, type);
            }
        }

        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }, []);

    const removeToast = (id: number) => {
        setToasts((prev) => prev.map(t => t.id === id ? { ...t, isClosing: true } : t));
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 300);
    };

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    const markHistoryRead = useCallback(() => {
        setUnreadCount(0);
    }, []);

    const contextValue = useMemo(
        () => ({ showToast, history, unreadCount, clearHistory, markHistoryRead }),
        [showToast, history, unreadCount, clearHistory, markHistoryRead]
    );

    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            {/* Kontainer Render Toast */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => {

                    // Penyesuaian warna dan ikon berdasarkan tipe -- bg/border pakai opacity dari
                    // shade yang theme-aware (primary/emerald-500/amber-500), BUKAN shade stok
                    // Tailwind seperti blue-200/emerald-800/amber-800 yang tidak punya --theme-*
                    // sama sekali. Error tetap merah statis sengaja (lihat docs/ui_consistency_guide.md §1).
                    let bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-primary/20 dark:border-primary/30 text-primary';
                    let icon = 'info';
                    let iconColor = 'text-primary';

                    if (toast.type === 'success') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-emerald-500/20 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
                        icon = 'check_circle';
                        iconColor = 'text-emerald-500 dark:text-emerald-400';
                    } else if (toast.type === 'error') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-red-200/50 dark:border-red-800/50 text-red-800 dark:text-red-300';
                        icon = 'error';
                        iconColor = 'text-red-500 dark:text-red-400';
                    } else if (toast.type === 'warning') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-500';
                        icon = 'warning';
                        iconColor = 'text-amber-500';
                    }

                    return (
                        <div
                            key={toast.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg pointer-events-auto w-80 max-w-full ${bgColor} ${toast.isClosing ? 'animate-toast-out' : 'animate-toast-in'}`}
                        >
                            <span className={`material-symbols-outlined shrink-0 ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                {icon}
                            </span>
                            <div className="flex-1 w-full min-w-0">
                                <p className="text-sm font-medium break-words whitespace-pre-wrap">
                                    {toast.message}
                                </p>
                            </div>
                            <button type="button"
                                onClick={() => removeToast(toast.id)}
                                className="shrink-0 p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}