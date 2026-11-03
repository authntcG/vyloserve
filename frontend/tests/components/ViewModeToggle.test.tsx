import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ViewModeToggle from '../../src/components/ViewModeToggle';

describe('ViewModeToggle', () => {
    it('renders with table mode active', () => {
        const onChange = vi.fn();
        render(<ViewModeToggle mode="table" onChange={onChange} />);

        const tableBtn = screen.getByRole('button', { name: /table/i });
        const cardBtn = screen.getByRole('button', { name: /card/i });

        expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
        expect(cardBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders with card mode active', () => {
        const onChange = vi.fn();
        render(<ViewModeToggle mode="card" onChange={onChange} />);

        const tableBtn = screen.getByRole('button', { name: /table/i });
        const cardBtn = screen.getByRole('button', { name: /card/i });

        expect(tableBtn).toHaveAttribute('aria-pressed', 'false');
        expect(cardBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onChange when clicking buttons', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<ViewModeToggle mode="card" onChange={onChange} />);

        const tableBtn = screen.getByRole('button', { name: /table/i });
        await user.click(tableBtn);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('table');
    });

    it('supports custom labels', () => {
        const onChange = vi.fn();
        render(
            <ViewModeToggle
                mode="table"
                onChange={onChange}
                labels={{ table: 'Custom Table', card: 'Custom Card' }}
            />
        );

        expect(screen.getByRole('button', { name: 'Custom Table' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Custom Card' })).toBeInTheDocument();
    });
});
