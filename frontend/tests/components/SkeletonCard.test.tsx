import { describe, it, expect } from 'vitest';
import { render } from '../test-utils';
import SkeletonCard from '../../src/components/SkeletonCard';

describe('SkeletonCard', () => {
    it('renders a pulsing placeholder card without crashing', () => {
        const { container } = render(<SkeletonCard />);

        const root = container.firstElementChild;
        expect(root).not.toBeNull();
        expect(root).toHaveClass('animate-pulse');
    });
});
