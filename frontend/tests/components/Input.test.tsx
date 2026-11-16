import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import Input from '../../src/components/Input';

describe('Input Component', () => {
    it('renders standard input with theme-aware text and border classes', () => {
        render(<Input id="test-input" placeholder="Enter text..." />);

        const input = screen.getByPlaceholderText('Enter text...');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('id', 'test-input');
        expect(input.className).toContain('text-slate-900');
        expect(input.className).toContain('dark:text-slate-100');
        expect(input.className).toContain('bg-white');
        expect(input.className).toContain('dark:bg-slate-800');
        expect(input.className).toContain('focus:ring-primary');
    });

    it('renders sm and md sizes correctly', () => {
        const { rerender } = render(<Input size="sm" placeholder="Small" />);
        let input = screen.getByPlaceholderText('Small');
        expect(input.className).toContain('text-xs');
        expect(input.className).toContain('py-1.5');

        rerender(<Input size="md" placeholder="Medium" />);
        input = screen.getByPlaceholderText('Medium');
        expect(input.className).toContain('text-sm');
        expect(input.className).toContain('py-2');
    });

    it('applies font-mono when mono prop is true', () => {
        render(<Input mono placeholder="Mono" />);
        const input = screen.getByPlaceholderText('Mono');
        expect(input.className).toContain('font-mono');
    });

    it('renders left icon with appropriate padding and aria-hidden', () => {
        render(<Input leftIcon="search" placeholder="Search..." />);
        const icon = screen.getByText('search');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-hidden', 'true');

        const input = screen.getByPlaceholderText('Search...');
        expect(input.className).toContain('pl-9');
    });

    it('renders right icon when provided and clear button is not active', () => {
        render(<Input rightIcon="lock" placeholder="Protected" />);
        const icon = screen.getByText('lock');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('handles clear button visibility and click callback', async () => {
        const onClear = vi.fn();
        const user = userEvent.setup();

        const { rerender } = render(
            <Input
                value=""
                onChange={vi.fn()}
                onClear={onClear}
                clearLabel="Clear test input"
                placeholder="Type here..."
            />
        );

        // Clear button should not appear when value is empty
        expect(screen.queryByRole('button', { name: 'Clear test input' })).not.toBeInTheDocument();

        // Rerender with value
        rerender(
            <Input
                value="Hello World"
                onChange={vi.fn()}
                onClear={onClear}
                clearLabel="Clear test input"
                placeholder="Type here..."
            />
        );

        const clearBtn = screen.getByRole('button', { name: 'Clear test input' });
        expect(clearBtn).toBeInTheDocument();

        await user.click(clearBtn);
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('does not render clear button when disabled or readOnly even with value', () => {
        const { rerender } = render(
            <Input
                value="Test"
                disabled
                onClear={vi.fn()}
                clearLabel="Clear"
            />
        );
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

        rerender(
            <Input
                value="Test"
                readOnly
                onClear={vi.fn()}
                clearLabel="Clear"
            />
        );
        expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('applies error styling when error is true', () => {
        render(<Input error placeholder="Error state" />);
        const input = screen.getByPlaceholderText('Error state');
        expect(input.className).toContain('border-red-500');
        expect(input.className).toContain('focus:ring-red-500');
    });

    it('forwards ref correctly to the HTMLInputElement', () => {
        const ref = createRef<HTMLInputElement>();
        render(<Input ref={ref} placeholder="Ref test" />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
        expect(ref.current?.placeholder).toBe('Ref test');
    });

    it('supports custom fullWidth=false and containerClassName', () => {
        const { container } = render(
            <Input
                fullWidth={false}
                className="w-24"
                containerClassName="custom-wrapper"
                placeholder="Compact"
            />
        );
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toContain('inline-flex');
        expect(wrapper.className).toContain('custom-wrapper');
        expect(wrapper.className).toContain('w-24');
    });
});
