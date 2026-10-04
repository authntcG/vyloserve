import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertProvider, useAlert } from '../../src/components/AlertContext';

// Mock Modal component to simply render its content since it relies on i18next and complex DOM
vi.mock('../../src/components/Modal', () => {
    return {
        default: ({ isOpen, title, children, onApply, onClose, applyText, customFooter }: any) => {
            if (!isOpen) return null;
            return (
                <div data-testid="mock-modal">
                    <h2>{title}</h2>
                    <div data-testid="modal-content">{children}</div>
                    {customFooter}
                </div>
            );
        }
    };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue || key,
    }),
}));

const TestComponent = () => {
    const { alert, confirm } = useAlert();

    return (
        <div>
            <button onClick={() => alert({ title: 'Test Alert', message: 'Alert Message' })}>Show Alert</button>
            <button onClick={async () => {
                const res = await confirm({ title: 'Test Confirm', message: 'Confirm Message', type: 'danger' });
                if (res) document.body.classList.add('confirmed');
            }}>Show Confirm</button>
        </div>
    );
};

describe('AlertContext', () => {
    beforeEach(() => {
        document.body.className = ''; // Reset class
    });

    it('throws error if used outside provider', () => {
        // Prevent console.error from polluting test output
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<TestComponent />)).toThrow('useAlert must be used within an AlertProvider');
        consoleSpy.mockRestore();
    });

    it('shows alert and can be closed', async () => {
        render(
            <AlertProvider>
                <TestComponent />
            </AlertProvider>
        );

        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();

        // Open Alert
        await userEvent.click(screen.getByText('Show Alert'));
        expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
        expect(screen.getByText('Test Alert')).toBeInTheDocument();
        expect(screen.getByText('Alert Message')).toBeInTheDocument();

        // Close Alert
        await userEvent.click(screen.getByText('OK'));
        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });

    it('shows confirm and returns true on confirm', async () => {
        render(
            <AlertProvider>
                <TestComponent />
            </AlertProvider>
        );

        // Open Confirm
        await userEvent.click(screen.getByText('Show Confirm'));
        expect(screen.getByText('Test Confirm')).toBeInTheDocument();
        expect(screen.getByText('Confirm Message')).toBeInTheDocument();

        // Confirm
        await userEvent.click(screen.getByText('OK'));
        expect(document.body.classList.contains('confirmed')).toBe(true);
        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });

    it('shows confirm and returns false on cancel', async () => {
        render(
            <AlertProvider>
                <TestComponent />
            </AlertProvider>
        );

        // Open Confirm
        await userEvent.click(screen.getByText('Show Confirm'));

        // Cancel
        await userEvent.click(screen.getByText('Cancel'));
        expect(document.body.classList.contains('confirmed')).toBe(false);
        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });
});
