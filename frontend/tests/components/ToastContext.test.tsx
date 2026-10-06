import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor, mockPywebviewApi, resetPywebviewApi } from '../test-utils';
import { useToast, ToastProvider } from '../../src/components/ToastContext';

function ToastTrigger({ message, type }: { readonly message: string; readonly type: 'success' | 'error' | 'warning' | 'info' }) {
    const { showToast } = useToast();
    useEffect(() => {
        showToast(message, type);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

describe('ToastContext', () => {
    it('throws when useToast is called outside a ToastProvider', () => {
        function Lonely() {
            useToast();
            return null;
        }
        expect(() => render(<Lonely />)).toThrow('useToast must be used within a ToastProvider');
    });

    it.each([
        ['success', 'check_circle'],
        ['error', 'error'],
        ['warning', 'warning'],
        ['info', 'info'],
    ] as const)('renders a %s toast with the matching icon', (type, expectedIcon) => {
        render(
            <ToastProvider>
                <ToastTrigger message={`hello ${type}`} type={type} />
            </ToastProvider>
        );

        expect(screen.getByText(`hello ${type}`)).toBeInTheDocument();
        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
    });

    it('removes the toast automatically after the display timeout elapses', () => {
        vi.useFakeTimers();
        try {
            render(
                <ToastProvider>
                    <ToastTrigger message="auto-dismiss me" type="info" />
                </ToastProvider>
            );
            expect(screen.getByText('auto-dismiss me')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(4300);
            });

            expect(screen.queryByText('auto-dismiss me')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('removes the toast immediately when its close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <ToastTrigger message="dismiss me" type="info" />
            </ToastProvider>
        );

        await user.click(screen.getByText('close'));

        await waitFor(() => {
            expect(screen.queryByText('dismiss me')).not.toBeInTheDocument();
        });
    });

    it('renders multiple simultaneous toasts independently', () => {
        function TwoToasts() {
            const { showToast } = useToast();
            useEffect(() => {
                showToast('first toast', 'success');
                showToast('second toast', 'error');
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return null;
        }
        render(
            <ToastProvider>
                <TwoToasts />
            </ToastProvider>
        );

        expect(screen.getByText('first toast')).toBeInTheDocument();
        expect(screen.getByText('second toast')).toBeInTheDocument();
    });

    it('records a history entry and increments unreadCount each time showToast is called', () => {
        function Probe() {
            const { showToast, history, unreadCount } = useToast();
            useEffect(() => {
                showToast('first', 'success');
                showToast('second', 'error');
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return (
                <div>
                    <span data-testid="unread">{unreadCount}</span>
                    <span data-testid="history-count">{history.length}</span>
                </div>
            );
        }
        render(
            <ToastProvider>
                <Probe />
            </ToastProvider>
        );

        expect(screen.getByTestId('unread')).toHaveTextContent('2');
        expect(screen.getByTestId('history-count')).toHaveTextContent('2');
    });

    it('keeps the history entry after the toast auto-dismisses', () => {
        vi.useFakeTimers();
        try {
            function Probe() {
                const { showToast, history } = useToast();
                useEffect(() => {
                    showToast('stays in history', 'info');
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                }, []);
                return <span data-testid="history-count">{history.length}</span>;
            }
            render(
                <ToastProvider>
                    <Probe />
                </ToastProvider>
            );

            act(() => {
                vi.advanceTimersByTime(4300);
            });

            expect(screen.queryByText('stays in history')).not.toBeInTheDocument();
            expect(screen.getByTestId('history-count')).toHaveTextContent('1');
        } finally {
            vi.useRealTimers();
        }
    });

    it('resets unreadCount to 0 when markHistoryRead is called, without clearing history', () => {
        function Probe() {
            const { showToast, history, unreadCount, markHistoryRead } = useToast();
            useEffect(() => {
                showToast('a toast', 'success');
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return (
                <div>
                    <span data-testid="unread">{unreadCount}</span>
                    <span data-testid="history-count">{history.length}</span>
                    <button type="button" onClick={markHistoryRead}>mark read</button>
                </div>
            );
        }
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <Probe />
            </ToastProvider>
        );

        expect(screen.getByTestId('unread')).toHaveTextContent('1');

        user.click(screen.getByText('mark read'));

        return waitFor(() => {
            expect(screen.getByTestId('unread')).toHaveTextContent('0');
            expect(screen.getByTestId('history-count')).toHaveTextContent('1');
        });
    });

    it('clearHistory empties the history array without a confirmation dialog', async () => {
        function Probe() {
            const { showToast, history, clearHistory } = useToast();
            useEffect(() => {
                showToast('to be cleared', 'warning');
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return (
                <div>
                    <span data-testid="history-count">{history.length}</span>
                    <button type="button" onClick={clearHistory}>clear</button>
                </div>
            );
        }
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <Probe />
            </ToastProvider>
        );

        expect(screen.getByTestId('history-count')).toHaveTextContent('1');

        await user.click(screen.getByText('clear'));

        expect(screen.getByTestId('history-count')).toHaveTextContent('0');
    });

    it('caps history at MAX_TOAST_HISTORY (100) entries, dropping the oldest first', () => {
        function Probe() {
            const { showToast, history } = useToast();
            useEffect(() => {
                for (let i = 0; i < 105; i++) {
                    showToast(`toast ${i}`, 'info');
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <span data-testid="history-count">{history.length}</span>;
        }
        render(
            <ToastProvider>
                <Probe />
            </ToastProvider>
        );

        expect(screen.getByTestId('history-count')).toHaveTextContent('100');
    });
});

describe('ToastContext native notification integration', () => {
    // Dipakai untuk mensimulasikan "window di-minimize" lewat jalur vylo_window_state
    // (push dari backend, lihat useWindowPresence.ts) -- BUKAN lewat window 'blur', karena
    // userEvent.click() di jsdom bisa memicu 'blur' level-window-nya sendiri sebagai bagian
    // dari focus-target-adjustment spec UI Events saat belum ada elemen yang fokus
    // sebelumnya (lihat fix di useWindowPresence.ts: handleBlur cross-check ke
    // document.hasFocus()) -- jalur minimized/hidden tidak terpengaruh nuansa itu sama
    // sekali, jadi jauh lebih deterministik untuk test "backgrounded via bukan fokus".
    function simulateMinimized(minimized: boolean) {
        window.dispatchEvent(new CustomEvent('vylo_window_state', { detail: { minimized } }));
    }

    // jsdom's document.hasFocus() defaults to false -- mock ke true supaya baseline "window
    // fokus, tidak minimized/hidden" di sini deterministik (lihat tests/hooks/useWindowPresence.test.ts
    // untuk pengujian hasFocus/blur itu sendiri secara terisolasi). Aman dipakai statis di sini
    // karena tidak ada test di describe ini yang mendispatch window 'blur'.
    beforeEach(() => {
        vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    });

    afterEach(() => {
        resetPywebviewApi();
        vi.restoreAllMocks();
    });

    function TriggerButton() {
        const { showToast } = useToast();
        return <button type="button" onClick={() => showToast('bg toast', 'error')}>trigger</button>;
    }

    it('does not call show_native_notification while the window has focus and is not minimized/hidden', async () => {
        const showNative = vi.fn();
        mockPywebviewApi({ show_native_notification: showNative });

        const user = userEvent.setup();
        render(
            <ToastProvider>
                <TriggerButton />
            </ToastProvider>
        );

        await user.click(screen.getByText('trigger'));

        expect(showNative).not.toHaveBeenCalled();
    });

    it('calls show_native_notification with the message and type when minimized (setting enabled by default)', async () => {
        const showNative = vi.fn();
        mockPywebviewApi({ show_native_notification: showNative });

        const user = userEvent.setup();
        render(
            <ToastProvider>
                <TriggerButton />
            </ToastProvider>
        );

        act(() => {
            simulateMinimized(true);
        });
        await user.click(screen.getByText('trigger'));

        await waitFor(() => {
            expect(showNative).toHaveBeenCalledWith('bg toast', 'error');
        });
    });

    it('does not call show_native_notification when minimized but the setting is disabled', async () => {
        const showNative = vi.fn();
        mockPywebviewApi({ show_native_notification: showNative });

        const user = userEvent.setup();
        render(
            <ToastProvider>
                <TriggerButton />
            </ToastProvider>
        );

        // Simulasikan App.tsx mem-broadcast nilai enable_desktop_notifications=false
        // yang sudah dimuat dari get_app_settings() saat boot (lihat App.tsx) -- ToastContext
        // SENGAJA tidak fetch sendiri, lihat komentar di ToastContext.tsx.
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_desktop_notifications_changed', { detail: { enabled: false } }));
            simulateMinimized(true);
        });
        await user.click(screen.getByText('trigger'));

        expect(showNative).not.toHaveBeenCalled();
    });

    it('picks up a live setting change pushed via vylo_desktop_notifications_changed without needing a remount', async () => {
        const showNative = vi.fn();
        mockPywebviewApi({ show_native_notification: showNative });

        const user = userEvent.setup();
        render(
            <ToastProvider>
                <TriggerButton />
            </ToastProvider>
        );

        act(() => {
            simulateMinimized(true);
            window.dispatchEvent(new CustomEvent('vylo_desktop_notifications_changed', { detail: { enabled: false } }));
        });
        await user.click(screen.getByText('trigger'));
        expect(showNative).not.toHaveBeenCalled();

        // User membuka Settings dan mengaktifkan kembali toggle-nya di sesi yang sama --
        // harus langsung berlaku tanpa remount ToastProvider.
        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_desktop_notifications_changed', { detail: { enabled: true } }));
        });
        await user.click(screen.getByText('trigger'));

        await waitFor(() => {
            expect(showNative).toHaveBeenCalledWith('bg toast', 'error');
        });
    });
});
