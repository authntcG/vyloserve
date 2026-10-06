import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import Card from '../../src/components/Card';

describe('Card', () => {
    it('renders the title and children', () => {
        render(<Card title="Apache Web"><span>child-content</span></Card>);

        expect(screen.getByText('Apache Web')).toBeInTheDocument();
        expect(screen.getByText('child-content')).toBeInTheDocument();
    });

    it('renders no status badge when status is not provided', () => {
        render(<Card title="Apache Web">content</Card>);
        // Badge dot/text tidak akan ada elemen dengan role tambahan; pastikan cuma judul yang muncul sekali.
        expect(screen.queryByText('running')).not.toBeInTheDocument();
    });

    it.each([
        ['Running', 'bg-emerald-500/10'],
        ['Active', 'bg-emerald-500/10'],
        ['Installed', 'bg-emerald-500/10'],
        ['Error', 'bg-red-100'],
        ['Failed', 'bg-red-100'],
        ['Offline', 'bg-red-100'],
        ['Native OS', 'bg-primary/10'],
        ['System', 'bg-primary/10'],
        ['Stopped', 'bg-slate-100'],
        ['Isolated', 'bg-slate-100'],
    ])('applies the correct theme class for status "%s"', (status, expectedClass) => {
        render(<Card title="X" status={status}>content</Card>);
        expect(screen.getByText(status)).toHaveClass(expectedClass);
    });

    it('does not use hardcoded blue for the "native/os/system" status theme (uses the primary token instead)', () => {
        render(<Card title="X" status="Native OS">content</Card>);
        expect(screen.getByText('Native OS').className).not.toMatch(/\bbg-blue-|\btext-blue-|\bborder-blue-/);
    });

    it('does not use stock (non-theme-aware) emerald shades for the "running/active/install" status theme', () => {
        render(<Card title="X" status="Running">content</Card>);
        expect(screen.getByText('Running').className).not.toMatch(/\bbg-emerald-100\b|\btext-emerald-800\b|\bdark:bg-emerald-900\b/);
    });

    it('renders dropdownActions inside the dropdown menu when provided', () => {
        render(
            <Card title="X" dropdownActions={<button type="button">Delete</button>}>content</Card>
        );
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('renders footerActions when provided', () => {
        render(
            <Card title="X" footerActions={<button type="button">Save</button>}>content</Card>
        );
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
});
