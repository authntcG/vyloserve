import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import InstalledBadge from '../../src/components/InstalledBadge';
import { renderWithToast } from '../test-utils';

describe('InstalledBadge', () => {
    it('renders with default translation text', () => {
        renderWithToast(<InstalledBadge />);
        const badge = screen.getByRole('button', { name: /installed/i });
        expect(badge).toBeInTheDocument();
        expect(badge).toBeDisabled();
    });

    it('renders with custom label if provided', () => {
        renderWithToast(<InstalledBadge label="Active Engine" />);
        const badge = screen.getByRole('button', { name: /active engine/i });
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('Active Engine');
        expect(badge).toBeDisabled();
    });
});
