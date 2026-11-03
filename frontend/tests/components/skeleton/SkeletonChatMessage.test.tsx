import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test-utils';
import SkeletonChatMessage from '../../../src/components/skeleton/SkeletonChatMessage';

describe('SkeletonChatMessage', () => {
    it('renders with status role and thinking announcement', () => {
        render(<SkeletonChatMessage />);

        const statusEl = screen.getByRole('status');
        expect(statusEl).toBeInTheDocument();
        expect(statusEl).toHaveAttribute('aria-busy', 'true');
        expect(statusEl).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByText('Vylo Assistant')).toBeInTheDocument();
        expect(screen.getAllByText('ai.thinking')).toHaveLength(2); // sr-only and visible badge
    });

    it('merges custom className', () => {
        const { container } = render(<SkeletonChatMessage className="my-custom-chat" />);
        expect(container.firstElementChild).toHaveClass('my-custom-chat');
    });
});
