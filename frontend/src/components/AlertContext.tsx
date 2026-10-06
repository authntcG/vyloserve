import { createContext, useContext, useState, type ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';

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
                        <Button variant="secondary" onClick={alertState.onCancel}>
                            {alertState.cancelText ?? t('common.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant={alertState.type === 'danger' ? 'danger' : 'primary'}
                            onClick={alertState.onConfirm}
                        >
                            {alertState.confirmText ?? t('common.ok', 'OK')}
                        </Button>
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
