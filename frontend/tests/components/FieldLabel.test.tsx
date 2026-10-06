import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FieldLabel from '../../src/components/FieldLabel';

describe('FieldLabel', () => {
    it('renders with the default size/tone classes', () => {
        render(<FieldLabel>Field Name</FieldLabel>);
        const label = screen.getByText('Field Name');
        expect(label).toHaveClass('text-sm', 'text-slate-700', 'dark:text-slate-300');
    });

    it('applies the xs size class', () => {
        render(<FieldLabel size="xs">Field Name</FieldLabel>);
        expect(screen.getByText('Field Name')).toHaveClass('text-xs');
    });

    it.each([
        ['muted', ['text-slate-600', 'dark:text-slate-400']],
        ['subtle', ['text-slate-500']],
        ['eyebrow', ['text-slate-500', 'uppercase']],
        ['primary', ['text-primary']],
    ] as const)('applies the %s tone classes', (tone, expectedClasses) => {
        render(<FieldLabel tone={tone}>Field Name</FieldLabel>);
        expect(screen.getByText('Field Name')).toHaveClass(...expectedClasses);
    });

    it('associates with a form control via htmlFor', () => {
        render(
            <>
                <FieldLabel htmlFor="my-input">Field Name</FieldLabel>
                <input id="my-input" />
            </>
        );
        expect(screen.getByLabelText('Field Name')).toBeInTheDocument();
    });

    it('renders visually-hidden labels as sr-only while remaining accessible', () => {
        render(
            <>
                <FieldLabel htmlFor="my-input" visuallyHidden>Field Name</FieldLabel>
                <input id="my-input" />
            </>
        );
        const label = screen.getByText('Field Name');
        expect(label).toHaveClass('sr-only');
        expect(screen.getByLabelText('Field Name')).toBeInTheDocument();
    });

    it('accepts a layout-only className escape hatch (e.g. for a label+value row)', () => {
        render(
            <FieldLabel className="flex justify-between">
                <span>Resolution</span>
                <span>240px</span>
            </FieldLabel>
        );
        expect(screen.getByText('Resolution').closest('label')).toHaveClass('flex', 'justify-between');
    });
});
