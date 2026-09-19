import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { act, render, screen } from '../test-utils';
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
                vi.advanceTimersByTime(4000);
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

        expect(screen.queryByText('dismiss me')).not.toBeInTheDocument();
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
});
