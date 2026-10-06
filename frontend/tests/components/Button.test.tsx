import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../src/components/Button';

describe('Button', () => {
    it.each([
        ['primary', 'bg-primary'],
        ['secondary', 'hover:bg-slate-100'],
        ['ghost', 'text-slate-500'],
        ['danger', 'bg-red-600'],
        ['danger-ghost', 'text-red-600'],
    ] as const)('renders the %s variant with its canonical class', (variant, expectedClass) => {
        render(<Button variant={variant}>Click me</Button>);
        expect(screen.getByRole('button', { name: 'Click me' })).toHaveClass(expectedClass);
    });

    it('defaults to variant="primary" and size="md"', () => {
        render(<Button>Save</Button>);
        const btn = screen.getByRole('button', { name: 'Save' });
        expect(btn).toHaveClass('bg-primary', 'py-2', 'px-4', 'rounded-lg');
    });

    it('uses hover:bg-primary/90 for primary (theme-aware hover, not a hardcoded color)', () => {
        render(<Button variant="primary">Install</Button>);
        expect(screen.getByRole('button', { name: 'Install' })).toHaveClass('hover:bg-primary/90');
    });

    it('defaults type="button" so it never accidentally submits a form', () => {
        render(<Button>Click</Button>);
        expect(screen.getByRole('button', { name: 'Click' })).toHaveAttribute('type', 'button');
    });

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<Button onClick={onClick}>Go</Button>);

        await user.click(screen.getByRole('button', { name: 'Go' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<Button onClick={onClick} disabled>Go</Button>);

        await user.click(screen.getByRole('button', { name: 'Go' }));

        expect(onClick).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    });

    it('forces disabled and shows a spinner when loading, even without an explicit disabled prop', async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<Button onClick={onClick} loading>Save</Button>);

        const btn = screen.getByRole('button', { name: 'Save' });
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute('aria-busy', 'true');
        expect(btn.querySelector('.animate-spin')).toHaveTextContent('sync');

        await user.click(btn);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps children visible while loading (does not swap text away)', () => {
        render(<Button loading>Save</Button>);
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('renders the icon instead of a spinner when not loading', () => {
        render(<Button icon="download">Download</Button>);
        const btn = screen.getByRole('button', { name: 'Download' });
        expect(btn.querySelector('.material-symbols-outlined')).toHaveTextContent('download');
        expect(btn.querySelector('.animate-spin')).not.toBeInTheDocument();
    });

    it('applies the icon-only size without forcing a specific icon text size', () => {
        render(<Button size="icon" icon="close" aria-label="Close" />);
        const btn = screen.getByRole('button', { name: 'Close' });
        expect(btn).toHaveClass('p-2', 'rounded-md');
    });

    it('applies fullWidth as w-full', () => {
        render(<Button fullWidth>Save</Button>);
        expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('w-full');
    });

    it('merges a caller-provided className for layout without losing variant classes', () => {
        render(<Button className="flex-1">Save</Button>);
        const btn = screen.getByRole('button', { name: 'Save' });
        expect(btn).toHaveClass('flex-1', 'bg-primary');
    });
});
