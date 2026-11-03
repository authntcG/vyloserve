import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import SkeletonDocument from '../../../src/components/skeleton/SkeletonDocument';

describe('SkeletonDocument', () => {
    it('renders with status role and accessible loading announcement', () => {
        render(<SkeletonDocument />);

        const statusEl = screen.getByRole('status');
        expect(statusEl).toBeInTheDocument();
        expect(statusEl).toHaveAttribute('aria-busy', 'true');
        expect(statusEl).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('renders document wireframe with custom className', () => {
        const { container } = render(<SkeletonDocument className="custom-doc-class" />);
        expect(container.firstElementChild).toHaveClass('custom-doc-class');
    });
});
