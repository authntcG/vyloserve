import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleSwitch from '../../src/components/ToggleSwitch';

describe('ToggleSwitch', () => {
    it('renders as a checkbox with the given accessible label', () => {
        render(<ToggleSwitch checked={false} onChange={vi.fn()} label="Enable prerelease" />);

        const toggle = screen.getByRole('checkbox', { name: 'Enable prerelease' });
        expect(toggle).not.toBeChecked();
    });

    it('reflects the checked prop', () => {
        render(<ToggleSwitch checked onChange={vi.fn()} label="Enable prerelease" />);

        expect(screen.getByRole('checkbox', { name: 'Enable prerelease' })).toBeChecked();
    });

    it('calls onChange with the new checked value when clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ToggleSwitch checked={false} onChange={onChange} label="Enable prerelease" />);

        await user.click(screen.getByRole('checkbox', { name: 'Enable prerelease' }));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('does not call onChange when disabled', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ToggleSwitch checked={false} onChange={onChange} disabled label="Enable prerelease" />);

        await user.click(screen.getByRole('checkbox', { name: 'Enable prerelease' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('defaults tone to primary (peer-checked:bg-primary on the track)', () => {
        const { container } = render(<ToggleSwitch checked onChange={vi.fn()} label="Register to PATH" />);

        const track = container.querySelector('label > div');
        expect(track).toHaveClass('peer-checked:bg-primary');
        expect(track).not.toHaveClass('peer-checked:bg-emerald-500');
    });

    it('renders tone="status" as emerald (for live service-running indicators, not preferences)', () => {
        const { container } = render(<ToggleSwitch checked onChange={vi.fn()} label="Toggle Apache" tone="status" />);

        const track = container.querySelector('label > div');
        expect(track).toHaveClass('peer-checked:bg-emerald-500');
    });

    it('calls the optional onClick (in addition to onChange) for callers that need preventDefault/stopPropagation (e.g. a status toggle driven by external polling)', async () => {
        const onChange = vi.fn();
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<ToggleSwitch checked={false} onChange={onChange} onClick={onClick} label="Toggle Apache" tone="status" />);

        await user.click(screen.getByRole('checkbox', { name: 'Toggle Apache' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('defaults to the md size (w-9 track)', () => {
        const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} label="Enable prerelease" />);

        expect(container.querySelector('label > div')).toHaveClass('w-9', 'h-5');
    });

    it('renders the sm size for dense contexts (mis. grid chip ekstensi PHP)', () => {
        const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} label="gd" size="sm" />);

        expect(container.querySelector('label > div')).toHaveClass('w-7', 'h-4');
    });

    it('adds pointer-events-none to the label when interactive=false, for a purely decorative toggle whose click is handled by an outer wrapper', () => {
        const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} label="gd" interactive={false} />);

        expect(container.querySelector('label')).toHaveClass('pointer-events-none');
    });

    it('does not add pointer-events-none by default (interactive=true)', () => {
        const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} label="Enable prerelease" />);

        expect(container.querySelector('label')).not.toHaveClass('pointer-events-none');
    });
});
