import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterChips, { type FilterChipItem } from '../../src/components/FilterChips';

const testItems: FilterChipItem<string>[] = [
    { id: 'all', label: 'All', count: 10 },
    { id: 'php', label: 'PHP', count: 4, icon: 'code' },
    { id: 'node', label: 'Node.js', count: 6 },
    { id: 'empty', label: 'Empty' }, // no count
];

describe('FilterChips', () => {
    it('renders all chips with labels and count badges', () => {
        render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('PHP')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('Node.js')).toBeInTheDocument();
        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    it('sets aria-pressed true on the selected chip and false on others', () => {
        render(
            <FilterChips
                items={testItems}
                selectedId="php"
                onChange={vi.fn()}
            />
        );

        const allChip = screen.getByRole('button', { name: /all/i });
        const phpChip = screen.getByRole('button', { name: /php/i });

        expect(phpChip).toHaveAttribute('aria-pressed', 'true');
        expect(allChip).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onChange with the chip id when clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={onChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /node\.js/i }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('node');
    });

    it('renders chip icons when provided', () => {
        render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('code')).toBeInTheDocument();
    });
});
