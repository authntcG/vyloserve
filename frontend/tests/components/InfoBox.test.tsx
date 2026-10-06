import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InfoBox from '../../src/components/InfoBox';

describe('InfoBox', () => {
    it('renders flat-text mode (no title) with the icon and children', () => {
        render(<InfoBox icon="info">Plain notice text</InfoBox>);
        expect(screen.getByText('Plain notice text')).toBeInTheDocument();
        expect(screen.getByText('info')).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders title+description mode when a title is provided', () => {
        render(<InfoBox icon="warning" title="Heads up">Description text</InfoBox>);
        expect(screen.getByText('Heads up')).toBeInTheDocument();
        expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('renders arbitrary JSX children, including nested interactive elements, in title+description mode', () => {
        render(
            <InfoBox icon="folder_special" title="Workspace required">
                <p>Pick a folder</p>
                <button type="button">Browse</button>
            </InfoBox>
        );
        expect(screen.getByText('Pick a folder')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
    });

    it.each([
        ['info', 'bg-primary/10'],
        ['warning', 'bg-amber-500/10'],
        ['danger', 'bg-red-50'],
    ] as const)('applies the %s tone box class', (tone, expectedClass) => {
        const { container } = render(<InfoBox tone={tone} icon="info">Text</InfoBox>);
        expect(container.firstChild).toHaveClass(expectedClass);
    });

    it('defaults to the info tone when no tone is given', () => {
        const { container } = render(<InfoBox icon="info">Text</InfoBox>);
        expect(container.firstChild).toHaveClass('bg-primary/10');
    });

    it('does not use a hardcoded blue class for the info tone', () => {
        const { container } = render(<InfoBox tone="info" icon="info" title="Title">Body</InfoBox>);
        expect(container.innerHTML).not.toMatch(/\bbg-blue-|\btext-blue-|\bborder-blue-/);
    });

    it('accepts a layout-only className escape hatch', () => {
        const { container } = render(<InfoBox icon="info" className="mt-4">Text</InfoBox>);
        expect(container.firstChild).toHaveClass('mt-4');
    });
});
