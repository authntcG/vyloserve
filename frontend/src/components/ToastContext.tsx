// src/components/ToastContext.tsx
import { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto hapus toast setelah 4 detik
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Kontainer Render Toast */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => {

                    // Penyesuaian warna dan ikon berdasarkan tipe
                    let bgColor = 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
                    let icon = 'info';
                    let iconColor = 'text-blue-500 dark:text-blue-400';

                    if (toast.type === 'success') {
                        bgColor = 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300';
                        icon = 'check_circle';
                        iconColor = 'text-emerald-500 dark:text-emerald-400';
                    } else if (toast.type === 'error') {
                        bgColor = 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
                        icon = 'error';
                        iconColor = 'text-red-500 dark:text-red-400';
                    } else if (toast.type === 'warning') {
                        bgColor = 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';
                        icon = 'warning';
                        iconColor = 'text-amber-500 dark:text-amber-400';
                    }

                    return (
                        <div
                            key={toast.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg pointer-events-auto transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 w-80 max-w-full ${bgColor}`}
                        >
                            <span className={`material-symbols-outlined shrink-0 ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                {icon}
                            </span>
                            <div className="flex-1 w-full min-w-0">
                                <p className="text-sm font-medium break-words whitespace-pre-wrap">
                                    {toast.message}
                                </p>
                            </div>
                            <button
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