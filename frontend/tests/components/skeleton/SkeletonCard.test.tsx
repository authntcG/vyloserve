import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import SkeletonCard from '../../../src/components/skeleton/SkeletonCard';

describe('SkeletonCard', () => {
    it('renders single card with accessibility attributes', () => {
        render(<SkeletonCard />);

        const statusEl = screen.getByRole('status');
        expect(statusEl).toBeInTheDocument();
        expect(statusEl).toHaveAttribute('aria-busy', 'true');
        expect(statusEl).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('renders action buttons by default and hides them when hasActionButtons is false', () => {
        const { container: withActions } = render(<SkeletonCard hasActionButtons={true} />);
        expect(withActions.querySelector('.mt-auto')).not.toBeNull();

        const { container: withoutActions } = render(<SkeletonCard hasActionButtons={false} />);
        expect(withoutActions.querySelector('.mt-auto')).toBeNull();
    });

    it('supports hasActions alias to hide action buttons', () => {
        const { container } = render(<SkeletonCard hasActions={false} />);
        expect(container.querySelector('.mt-auto')).toBeNull();
    });

    it('renders multiple cards in a grid when count > 1', () => {
        render(<SkeletonCard count={3} gridCols="grid-cols-3" />);

        const statusCards = screen.getAllByRole('status');
        expect(statusCards).toHaveLength(3);
    });
});
