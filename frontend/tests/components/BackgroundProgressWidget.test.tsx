import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../test-utils';
import BackgroundProgressWidget from '../../src/components/BackgroundProgressWidget';

describe('BackgroundProgressWidget', () => {
    it.each([
        ['isOpen is false', { isOpen: false, progress: 50 }],
        ['progress is 0', { isOpen: true, progress: 0 }],
        ['progress is negative', { isOpen: true, progress: -1 }],
        ['progress is 100', { isOpen: true, progress: 100 }],
        ['progress is above 100', { isOpen: true, progress: 150 }],
    ])('renders nothing when %s', (_label, { isOpen, progress }) => {
        const { container } = render(
            <BackgroundProgressWidget isOpen={isOpen} progress={progress} progressText="Installing..." onRestore={vi.fn()} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders progress text, percentage, and a custom title when open with an in-progress value', () => {
        render(
            <BackgroundProgressWidget isOpen={true} progress={42} progressText="Downloading binary..." title="Installing PHP 8.3" onRestore={vi.fn()} />
        );

        expect(screen.getByText('Installing PHP 8.3')).toBeInTheDocument();
        expect(screen.getByText('Downloading binary...')).toBeInTheDocument();
        expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('falls back to the translated default title when no title prop is given', () => {
        // BackgroundProgressWidget.tsx: t('components.progress.installing') tanpa fallback.
        render(<BackgroundProgressWidget isOpen={true} progress={10} progressText="" onRestore={vi.fn()} />);

        expect(screen.getByText('components.progress.installing')).toBeInTheDocument();
    });

    it('calls onRestore when clicked', async () => {
        const user = userEvent.setup();
        const onRestore = vi.fn();
        render(<BackgroundProgressWidget isOpen={true} progress={10} progressText="Working..." onRestore={onRestore} />);

        await user.click(screen.getByRole('button'));

        expect(onRestore).toHaveBeenCalledTimes(1);
    });
});
