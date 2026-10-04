// src/components/ToastContext.tsx
import { createContext, useContext, useState, type ReactNode, useCallback, useMemo } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
    isClosing?: boolean;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
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

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

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

    const contextValue = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            {/* Kontainer Render Toast */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => {

                    // Penyesuaian warna dan ikon berdasarkan tipe
                    let bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-blue-200/50 dark:border-blue-800/50 text-blue-800 dark:text-blue-300';
                    let icon = 'info';
                    let iconColor = 'text-blue-500 dark:text-blue-400';

                    if (toast.type === 'success') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-emerald-200/50 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300';
                        icon = 'check_circle';
                        iconColor = 'text-emerald-500 dark:text-emerald-400';
                    } else if (toast.type === 'error') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-red-200/50 dark:border-red-800/50 text-red-800 dark:text-red-300';
                        icon = 'error';
                        iconColor = 'text-red-500 dark:text-red-400';
                    } else if (toast.type === 'warning') {
                        bgColor = 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-amber-200/50 dark:border-amber-800/50 text-amber-800 dark:text-amber-300';
                        icon = 'warning';
                        iconColor = 'text-amber-500 dark:text-amber-400';
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