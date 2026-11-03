import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import AppSkeletonLayout from '../../../src/components/skeleton/AppSkeletonLayout';

describe('AppSkeletonLayout', () => {
    it('renders app shell skeleton with accessible connecting engine indicator', () => {
        render(<AppSkeletonLayout />);

        const connectingStatus = screen.getByText('common.connecting_engine').closest('[role="status"]');
        expect(connectingStatus).toBeInTheDocument();
        expect(connectingStatus).toHaveAttribute('aria-busy', 'true');
        expect(connectingStatus).toHaveAttribute('aria-live', 'polite');
    });

    it('renders sidebar and main content wireframe elements', () => {
        const { container } = render(<AppSkeletonLayout />);

        expect(container.querySelector('aside')).toBeInTheDocument();
        expect(container.querySelector('main')).toBeInTheDocument();
    });
});
