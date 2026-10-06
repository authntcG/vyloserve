import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from '../../src/components/Tabs';

const TABS = [
    { value: 'all', label: 'All Instances' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgres', label: 'PostgreSQL' },
];

describe('Tabs', () => {
    it('renders every tab label', () => {
        render(<Tabs tabs={TABS} value="all" onChange={vi.fn()} />);
        expect(screen.getByText('All Instances')).toBeInTheDocument();
        expect(screen.getByText('MySQL')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });

    it('marks the active tab with the primary border/text classes', () => {
        render(<Tabs tabs={TABS} value="mysql" onChange={vi.fn()} />);
        expect(screen.getByText('MySQL')).toHaveClass('border-primary', 'text-primary');
        expect(screen.getByText('All Instances')).toHaveClass('border-transparent', 'text-slate-500');
    });

    it('calls onChange with the clicked tab value', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<Tabs tabs={TABS} value="all" onChange={onChange} />);

        await user.click(screen.getByText('PostgreSQL'));

        expect(onChange).toHaveBeenCalledWith('postgres');
    });

    it('renders an optional badge dot when badgeColorClass is provided', () => {
        const tabsWithBadge = [
            { value: 'node', label: 'Node.js', badgeColorClass: 'bg-emerald-500' },
            { value: 'python', label: 'Python' },
        ];
        const { container } = render(<Tabs tabs={tabsWithBadge} value="node" onChange={vi.fn()} />);

        expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
    });
});
