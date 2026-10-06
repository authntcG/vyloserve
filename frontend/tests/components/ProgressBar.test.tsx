import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressBar from '../../src/components/ProgressBar';

describe('ProgressBar', () => {
    it('sets the fill width to match percent', () => {
        const { container } = render(<ProgressBar percent={42} />);
        const fill = container.querySelector('.bg-primary');
        expect(fill).toHaveStyle({ width: '42%' });
    });

    it('uses the canonical theme-aware primary color and h-2 height for the track and fill', () => {
        const { container } = render(<ProgressBar percent={50} />);
        const track = container.firstChild as HTMLElement;
        const fill = container.querySelector('.bg-primary');
        expect(track).toHaveClass('bg-slate-200', 'dark:bg-slate-700', 'h-2', 'rounded-full');
        expect(fill).toHaveClass('bg-primary', 'h-2', 'rounded-full');
    });

    it('merges a caller-provided className onto the track without losing its base classes', () => {
        const { container } = render(<ProgressBar percent={10} className="mt-2" />);
        const track = container.firstChild as HTMLElement;
        expect(track).toHaveClass('mt-2', 'bg-slate-200');
    });

    it('renders 0% and 100% without error', () => {
        const { container: c0 } = render(<ProgressBar percent={0} />);
        expect(c0.querySelector('.bg-primary')).toHaveStyle({ width: '0%' });

        const { container: c100 } = render(<ProgressBar percent={100} />);
        expect(c100.querySelector('.bg-primary')).toHaveStyle({ width: '100%' });
    });
});
