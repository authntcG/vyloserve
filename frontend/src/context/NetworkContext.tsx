import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface NetworkContextType {
    isOnline: boolean;
    isChecking: boolean;
    checkConnectivity: () => Promise<boolean>;
    reportOffline: () => void;
    reportOnline: () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

function getBrowserOnlineState(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        return navigator.onLine;
    }
    return true;
}

export function isOfflineResponse(res: any): boolean {
    if (!res) {
        return !getBrowserOnlineState();
    }
    if (res.is_offline === true || res.message === 'backend.error.no_internet') {
        return true;
    }
    return false;
}

function useStandaloneNetworkState(): NetworkContextType {
    const [isOnline, setIsOnline] = useState<boolean>(() => getBrowserOnlineState());
    const [isChecking, setIsChecking] = useState<boolean>(false);

    const checkConnectivity = useCallback(async (): Promise<boolean> => {
        setIsChecking(true);
        try {
            const browserOnline = getBrowserOnlineState();
            const apiCheck = (window as any).pywebview?.api?.check_internet_connection;
            if (typeof apiCheck === 'function') {
                const res = await apiCheck();
                if (typeof res?.online === 'boolean') {
                    setIsOnline(res.online);
                    return res.online;
                }
            }
            setIsOnline(browserOnline);
            return browserOnline;
        } catch {
            const fallback = getBrowserOnlineState();
            setIsOnline(fallback);
            return fallback;
        } finally {
            setIsChecking(false);
        }
    }, []);

    const reportOffline = useCallback(() => {
        setIsOnline(false);
    }, []);

    const reportOnline = useCallback(() => {
        setIsOnline(true);
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            checkConnectivity();
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkConnectivity]);

    return useMemo(
        () => ({
            isOnline,
            isChecking,
            checkConnectivity,
            reportOffline,
            reportOnline,
        }),
        [isOnline, isChecking, checkConnectivity, reportOffline, reportOnline]
    );
}

export function NetworkProvider({ children }: { readonly children: React.ReactNode }) {
    const state = useStandaloneNetworkState();

    useEffect(() => {
        if ((window as any).pywebview?.api?.check_internet_connection) {
            state.checkConnectivity();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkContextType {
    const context = useContext(NetworkContext);
    const fallbackState = useStandaloneNetworkState();
    return context ?? fallbackState;
}
