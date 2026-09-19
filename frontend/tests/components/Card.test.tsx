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
        ['Running', 'bg-emerald-100'],
        ['Active', 'bg-emerald-100'],
        ['Error', 'bg-red-100'],
        ['Failed', 'bg-red-100'],
        ['Offline', 'bg-red-100'],
        ['Native OS', 'bg-blue-100'],
        ['System', 'bg-blue-100'],
        ['Stopped', 'bg-slate-100'],
        ['Isolated', 'bg-slate-100'],
    ])('applies the correct theme class for status "%s"', (status, expectedClass) => {
        render(<Card title="X" status={status}>content</Card>);
        expect(screen.getByText(status)).toHaveClass(expectedClass);
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
