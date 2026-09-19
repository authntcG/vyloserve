import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import PageHeader from '../../src/components/PageHeader';

describe('PageHeader', () => {
    it('renders the icon and title', () => {
        render(<PageHeader icon="dns" title="Apache Web Server" />);

        expect(screen.getByText('Apache Web Server')).toBeInTheDocument();
        expect(screen.getByText('dns')).toBeInTheDocument();
    });

    it('does not render subtitle/actions containers when they are not provided', () => {
        render(<PageHeader icon="dns" title="Apache Web Server" />);

        expect(screen.queryByText('subtitle-content')).not.toBeInTheDocument();
        expect(screen.queryByText('action-content')).not.toBeInTheDocument();
    });

    it('renders subtitle and actions when provided', () => {
        render(
            <PageHeader
                icon="dns"
                title="Apache Web Server"
                subtitle={<span>subtitle-content</span>}
                actions={<button type="button">action-content</button>}
            />
        );

        expect(screen.getByText('subtitle-content')).toBeInTheDocument();
        expect(screen.getByText('action-content')).toBeInTheDocument();
    });
});
