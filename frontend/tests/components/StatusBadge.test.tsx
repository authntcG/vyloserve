import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge, { getStatusTheme } from '../../src/components/StatusBadge';

describe('StatusBadge', () => {
    it('returns null when status is empty', () => {
        const { container } = render(<StatusBadge status={null as any} />);
        expect(container.firstChild).toBeNull();
    });

    it.each([
        { status: 'running', expectedClass: 'text-emerald-600' },
        { status: 'error', expectedClass: 'text-red-800' },
        { status: 'native', expectedClass: 'text-primary' },
        { status: 'stopped', expectedClass: 'text-slate-800' },
    ])('renders $status status with $expectedClass theme', ({ status, expectedClass }) => {
        render(<StatusBadge status={status} />);
        const badge = screen.getByTestId('status-badge');
        expect(badge).toHaveTextContent(status);
        expect(badge).toHaveClass(expectedClass);
    });

    it('helper getStatusTheme matches variants correctly', () => {
        expect(getStatusTheme('ACTIVE').dot).toBe('bg-emerald-500');
        expect(getStatusTheme('FAILED').dot).toBe('bg-red-500');
        expect(getStatusTheme('SYSTEM').dot).toBe('bg-primary');
        expect(getStatusTheme('OTHER').dot).toBe('bg-slate-400');
    });
});
