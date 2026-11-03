import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NetworkProvider, useNetworkStatus, isOfflineResponse } from '../../src/context/NetworkContext';
import OfflineBanner from '../../src/components/OfflineBanner';

function TestConsumer() {
    const { isOnline, isChecking, checkConnectivity } = useNetworkStatus();
    return (
        <div>
            <span data-testid="online-state">{isOnline ? 'online' : 'offline'}</span>
            <span data-testid="checking-state">{isChecking ? 'checking' : 'idle'}</span>
            <button type="button" onClick={() => void checkConnectivity()}>
                Probe
            </button>
        </div>
    );
}

describe('NetworkContext & OfflineBanner', () => {
    const originalOnLine = navigator.onLine;

    beforeEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true,
        });
        (window as any).pywebview = {
            api: {
                check_internet_connection: vi.fn().mockResolvedValue({
                    status: 'success',
                    online: true,
                }),
            },
        };
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: originalOnLine,
        });
        vi.restoreAllMocks();
    });

    it('detects initial online state and probes backend check_internet_connection', async () => {
        render(
            <NetworkProvider>
                <TestConsumer />
            </NetworkProvider>
        );

        expect(screen.getByTestId('online-state').textContent).toBe('online');
        await waitFor(() => {
            expect((window as any).pywebview.api.check_internet_connection).toHaveBeenCalled();
        });
    });

    it('switches to offline when backend probe returns online: false or window fires offline event', async () => {
        (window as any).pywebview.api.check_internet_connection.mockResolvedValue({
            status: 'success',
            online: false,
        });

        render(
            <NetworkProvider>
                <TestConsumer />
            </NetworkProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('online-state').textContent).toBe('offline');
        });

        // Simulate recovery via online event + backend probe returning true
        (window as any).pywebview.api.check_internet_connection.mockResolvedValue({
            status: 'success',
            online: true,
        });

        await act(async () => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('online-state').textContent).toBe('online');
        });

        // Simulate instant disconnect via offline event
        await act(async () => {
            window.dispatchEvent(new Event('offline'));
        });

        expect(screen.getByTestId('online-state').textContent).toBe('offline');
    });

    it('works standalone via useNetworkStatus fallback when rendered outside NetworkProvider', async () => {
        render(<TestConsumer />);
        expect(screen.getByTestId('online-state').textContent).toBe('online');

        (window as any).pywebview.api.check_internet_connection.mockResolvedValue({
            status: 'success',
            online: false,
        });

        fireEvent.click(screen.getByText('Probe'));
        await waitFor(() => {
            expect(screen.getByTestId('online-state').textContent).toBe('offline');
        });
    });

    it('renders OfflineBanner with retry and custom action buttons', async () => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: false,
        });
        (window as any).pywebview.api.check_internet_connection.mockResolvedValue({
            status: 'success',
            online: false,
        });
        const onRetry = vi.fn();
        render(
            <NetworkProvider>
                <OfflineBanner
                    title="Custom Offline Title"
                    description="Custom Offline Description"
                    onRetry={onRetry}
                    actionButton={<button type="button">Switch to Local</button>}
                />
            </NetworkProvider>
        );

        expect(screen.getByText('Custom Offline Title')).toBeInTheDocument();
        expect(screen.getByText('Custom Offline Description')).toBeInTheDocument();
        expect(screen.getByText('Switch to Local')).toBeInTheDocument();

        const retryBtn = await screen.findByRole('button', { name: /retry|coba lagi/i });
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(onRetry).toHaveBeenCalledTimes(1);
        });
    });

    it('correctly identifies offline backend responses via isOfflineResponse', () => {
        expect(isOfflineResponse(null)).toBe(false);
        expect(isOfflineResponse({ status: 'error', message: 'backend.apache.some_error' })).toBe(false);
        expect(isOfflineResponse({ status: 'error', is_offline: true })).toBe(true);
        expect(isOfflineResponse({ status: 'error', message: 'backend.error.no_internet' })).toBe(true);
    });
});
