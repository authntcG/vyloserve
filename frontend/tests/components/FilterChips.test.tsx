import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

    it('does not render scroll buttons when container has no overflow', () => {
        render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /scroll left/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /scroll right/i })).not.toBeInTheDocument();
    });

    it('shows scroll indicators when overflow occurs and allows clicking to scroll', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        const scrollContainer = container.querySelector('fieldset') as HTMLFieldSetElement;
        expect(scrollContainer).toBeInTheDocument();

        // Simulate overflow on right: clientWidth 200, scrollWidth 500, scrollLeft 0
        Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 200 });
        Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 500 });
        Object.defineProperty(scrollContainer, 'scrollLeft', { configurable: true, writable: true, value: 0 });

        const scrollByMock = vi.fn();
        scrollContainer.scrollBy = scrollByMock;

        // Trigger scroll event to recalculate state
        act(() => {
            scrollContainer.dispatchEvent(new Event('scroll'));
        });

        // Right button should appear
        const rightBtn = await screen.findByRole('button', { name: /scroll right/i });
        expect(rightBtn).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /scroll left/i })).not.toBeInTheDocument();

        // Click right button
        await user.click(rightBtn);
        expect(scrollByMock).toHaveBeenCalledWith({ left: 120, behavior: 'smooth' });

        // Simulate scrolled state: scrollLeft 100
        act(() => {
            scrollContainer.scrollLeft = 100;
            scrollContainer.dispatchEvent(new Event('scroll'));
        });

        const leftBtn = await screen.findByRole('button', { name: /scroll left/i });
        expect(leftBtn).toBeInTheDocument();

        await user.click(leftBtn);
        expect(scrollByMock).toHaveBeenCalledWith({ left: -120, behavior: 'smooth' });
    });

    it('translates vertical wheel delta to horizontal scrollLeft when overflow is active', () => {
        const { container } = render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        const scrollContainer = container.querySelector('fieldset') as HTMLFieldSetElement;

        // Set overflow
        Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 200 });
        Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 500 });
        Object.defineProperty(scrollContainer, 'scrollLeft', { configurable: true, writable: true, value: 0 });

        act(() => {
            scrollContainer.dispatchEvent(new Event('scroll'));
        });

        // Fire wheel event
        act(() => {
            scrollContainer.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, bubbles: true }));
        });

        expect(scrollContainer.scrollLeft).toBe(50);
    });

    it('calls scrollIntoView when a chip is clicked', async () => {
        const scrollIntoViewMock = vi.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        const user = userEvent.setup();
        render(
            <FilterChips
                items={testItems}
                selectedId="all"
                onChange={vi.fn()}
            />
        );

        await user.click(screen.getByRole('button', { name: /php/i }));
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    });
});
