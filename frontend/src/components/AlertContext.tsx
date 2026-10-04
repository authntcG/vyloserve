import { createContext, useContext, useState, type ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

export type AlertType = 'info' | 'warning' | 'danger';

export interface AlertOptions {
    title: string;
    message: ReactNode;
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
}

interface AlertState extends AlertOptions {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

interface AlertContextType {
    alert: (options: AlertOptions) => Promise<void>;
    confirm: (options: AlertOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}

export function AlertProvider({ children }: Readonly<{ children: ReactNode }>) {
    const { t } = useTranslation();
    
    const [alertState, setAlertState] = useState<AlertState>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        onCancel: () => {},
    });

    const closeAlert = useCallback(() => {
        setAlertState((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const alert = useCallback((options: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            setAlertState({
                ...options,
                isOpen: true,
                type: options.type ?? 'info',
                onConfirm: () => {
                    closeAlert();
                    resolve();
                },
                onCancel: () => {
                    closeAlert();
                    resolve();
                },
            });
        });
    }, [closeAlert]);

    const confirm = useCallback((options: AlertOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setAlertState({
                ...options,
                isOpen: true,
                type: options.type ?? 'warning',
                onConfirm: () => {
                    closeAlert();
                    resolve(true);
                },
                onCancel: () => {
                    closeAlert();
                    resolve(false);
                },
            });
        });
    }, [closeAlert]);

    const contextValue = useMemo(() => ({ alert, confirm }), [alert, confirm]);

    let alertIcon = 'info';
    if (alertState.type === 'danger') alertIcon = 'error';
    else if (alertState.type === 'warning') alertIcon = 'warning';

    return (
        <AlertContext.Provider value={contextValue}>
            {children}
            
            <Modal
                isOpen={alertState.isOpen}
                onClose={alertState.onCancel}
                title={alertState.title}
                icon={alertIcon}
                isDestructive={alertState.type === 'danger'}
                onApply={alertState.onConfirm}
                applyText={alertState.confirmText ?? t('common.ok', 'OK')}
                customFooter={
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
                        <button
                            type="button"
                            onClick={alertState.onCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {alertState.cancelText ?? t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={alertState.onConfirm}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                                alertState.type === 'danger'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-primary hover:bg-blue-600'
                            }`}
                        >
                            {alertState.confirmText ?? t('common.ok', 'OK')}
                        </button>
                    </div>
                }
            >
                <div className={`text-sm text-slate-600 dark:text-slate-400 ${typeof alertState.message === 'string' ? 'whitespace-pre-wrap' : ''}`}>
                    {alertState.message}
                </div>
            </Modal>
        </AlertContext.Provider>
    );
}
