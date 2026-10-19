import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import SkeletonForm from '../../../src/components/skeleton/SkeletonForm';

describe('SkeletonForm', () => {
    it('renders with status role and default loading text', () => {
        render(<SkeletonForm />);

        const statusEl = screen.getByRole('status');
        expect(statusEl).toBeInTheDocument();
        expect(statusEl).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('uses custom loadingText when provided', () => {
        render(<SkeletonForm loadingText="Reading php.ini..." />);

        expect(screen.getByText('Reading php.ini...')).toBeInTheDocument();
    });

    it('renders tab headers when hasTabs is true', () => {
        const { container: withTabs } = render(<SkeletonForm hasTabs={true} />);
        expect(withTabs.querySelector('.border-b')).not.toBeNull();

        const { container: withoutTabs } = render(<SkeletonForm hasTabs={false} />);
        expect(withoutTabs.querySelector('.border-b')).toBeNull();
    });

    it('renders specified number of fields', () => {
        const { container } = render(<SkeletonForm fieldsCount={6} />);
        const fields = container.querySelectorAll('.grid > div');
        expect(fields).toHaveLength(6);
    });
});
