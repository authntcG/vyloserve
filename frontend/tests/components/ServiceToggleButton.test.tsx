import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceToggleButton from '../../src/components/ServiceToggleButton';

const labels = { start: 'Start Apache', stop: 'Stop Apache', starting: 'Starting...', stopping: 'Stopping...' };

describe('ServiceToggleButton', () => {
    it('shows the start label/icon and emerald color when not running', () => {
        render(<ServiceToggleButton isRunning={false} isToggling={false} onClick={vi.fn()} labels={labels} />);

        const btn = screen.getByRole('button', { name: 'Start Apache' });
        expect(btn).toHaveClass('bg-emerald-500');
        expect(btn.querySelector('.material-symbols-outlined')).toHaveTextContent('play_arrow');
    });

    it('shows the stop label/icon and amber color when running', () => {
        render(<ServiceToggleButton isRunning isToggling={false} onClick={vi.fn()} labels={labels} />);

        const btn = screen.getByRole('button', { name: 'Stop Apache' });
        expect(btn).toHaveClass('bg-amber-500');
        expect(btn.querySelector('.material-symbols-outlined')).toHaveTextContent('stop');
    });

    it('shows the starting label + spinner and is disabled while toggling from stopped', () => {
        render(<ServiceToggleButton isRunning={false} isToggling onClick={vi.fn()} labels={labels} />);

        const btn = screen.getByRole('button', { name: 'Starting...' });
        expect(btn).toBeDisabled();
        expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows the stopping label + spinner and is disabled while toggling from running', () => {
        render(<ServiceToggleButton isRunning isToggling onClick={vi.fn()} labels={labels} />);

        const btn = screen.getByRole('button', { name: 'Stopping...' });
        expect(btn).toBeDisabled();
        expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('calls onClick when clicked and not toggling', async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<ServiceToggleButton isRunning={false} isToggling={false} onClick={onClick} labels={labels} />);

        await user.click(screen.getByRole('button', { name: 'Start Apache' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
