import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithToast } from '../test-utils';
import { useToast } from '../../src/components/ToastContext';
import NotificationBell from '../../src/components/NotificationBell';

function ToastTrigger({ messages }: { readonly messages: ReadonlyArray<{ message: string; type: 'success' | 'error' | 'warning' | 'info' }> }) {
    const { showToast } = useToast();
    useEffect(() => {
        messages.forEach(({ message, type }) => showToast(message, type));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

// Toast in-app (fixed bottom-6 right-6) dan panel histori bisa tampil BERSAMAAN
// dengan pesan yang sama persis (keduanya belum tentu dismiss sebelum assertion
// jalan) -- scoping query ke region role="list" ini menghindari ambiguitas
// "multiple elements found" karena dua render berbeda menampilkan teks yang sama.
function getHistoryList() {
    return screen.getByRole('list', { name: 'Notifications' });
}

describe('NotificationBell', () => {
    it('shows no badge when there is no unread notification', () => {
        renderWithToast(<NotificationBell />);

        expect(screen.getByRole('button', { name: /Notifications \(0 unread\)/ })).toBeInTheDocument();
    });

    it('shows an unread badge with the count after toasts are triggered', () => {
        renderWithToast(
            <>
                <NotificationBell />
                <ToastTrigger messages={[{ message: 'first', type: 'success' }, { message: 'second', type: 'error' }]} />
            </>
        );

        expect(screen.getByRole('button', { name: /Notifications \(2 unread\)/ })).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('caps the badge label at "9+" beyond the threshold', () => {
        const messages = Array.from({ length: 11 }, (_, i) => ({ message: `toast ${i}`, type: 'info' as const }));
        renderWithToast(
            <>
                <NotificationBell />
                <ToastTrigger messages={messages} />
            </>
        );

        expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('opens the panel on click, lists history entries, and resets the unread badge', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <>
                <NotificationBell />
                <ToastTrigger messages={[{ message: 'hello there', type: 'success' }]} />
            </>
        );

        await user.click(screen.getByRole('button', { name: /Notifications/ }));

        expect(within(getHistoryList()).getByText('hello there')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Notifications \(0 unread\)/ })).toBeInTheDocument();
    });

    it('shows the empty state when there is no history yet', async () => {
        const user = userEvent.setup();
        renderWithToast(<NotificationBell />);

        await user.click(screen.getByRole('button', { name: /Notifications/ }));

        expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    });

    it('clears the history when the Clear button is clicked', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <>
                <NotificationBell />
                <ToastTrigger messages={[{ message: 'to be cleared', type: 'warning' }]} />
            </>
        );

        await user.click(screen.getByRole('button', { name: /Notifications/ }));
        expect(within(getHistoryList()).getByText('to be cleared')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Clear/ }));

        expect(within(getHistoryList()).queryByText('to be cleared')).not.toBeInTheDocument();
        expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    });

    it('renders the panel through a portal attached to document.body', async () => {
        const user = userEvent.setup();
        const { container } = renderWithToast(
            <>
                <NotificationBell />
                <ToastTrigger messages={[{ message: 'portal check', type: 'info' }]} />
            </>
        );

        await user.click(screen.getByRole('button', { name: /Notifications/ }));

        const entry = within(getHistoryList()).getByText('portal check');
        expect(container.contains(entry)).toBe(false);
        expect(document.body.contains(entry)).toBe(true);
    });

    it('closes the panel when clicking outside', async () => {
        const user = userEvent.setup();
        renderWithToast(
            <div>
                <NotificationBell />
                <ToastTrigger messages={[{ message: 'outside-click test', type: 'info' }]} />
                <button type="button">outside</button>
            </div>
        );

        await user.click(screen.getByRole('button', { name: /Notifications/ }));
        expect(getHistoryList()).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'outside' }));

        await waitFor(() => {
            expect(screen.queryByRole('list', { name: 'Notifications' })).not.toBeInTheDocument();
        });
    });
});
