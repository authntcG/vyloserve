import { describe, it, expect } from 'vitest';
import { render } from '../test-utils';
import SkeletonCard from '../../src/components/SkeletonCard';

describe('SkeletonCard', () => {
    it('renders a steady placeholder card containing pulsing skeleton elements', () => {
        const { container } = render(<SkeletonCard />);

        const root = container.firstElementChild;
        expect(root).not.toBeNull();
        expect(root).toHaveClass('rounded-xl');
        expect(root?.querySelector('.animate-pulse')).not.toBeNull();
    });
});
