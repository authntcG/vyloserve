import { describe, it, expect } from 'vitest';
import { render } from '../../test-utils';
import Skeleton from '../../../src/components/skeleton/Skeleton';

describe('Skeleton', () => {
    it('renders with pulse animation and aria-hidden="true"', () => {
        const { container } = render(<Skeleton className="h-4 w-20" />);
        const el = container.firstElementChild;

        expect(el).not.toBeNull();
        expect(el).toHaveAttribute('aria-hidden', 'true');
        expect(el).toHaveClass('animate-pulse');
        expect(el).toHaveClass('motion-reduce:animate-none');
        expect(el).toHaveClass('h-4');
        expect(el).toHaveClass('w-20');
    });

    it('merges default classes and custom className', () => {
        const { container } = render(<Skeleton className="rounded-full bg-red-500" />);
        const el = container.firstElementChild;

        expect(el).toHaveClass('rounded-full');
        expect(el).toHaveClass('bg-red-500');
    });
});
