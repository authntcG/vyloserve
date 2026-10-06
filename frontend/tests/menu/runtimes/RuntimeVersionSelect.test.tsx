import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import RuntimeVersionSelect from '../../../src/menu/runtimes/RuntimeVersionSelect';

describe('RuntimeVersionSelect', () => {
    it('shows a loading indicator with no interactive control while isLoading is true', () => {
        render(<RuntimeVersionSelect isLoading={true} versionsList={[]} version="" setVersion={vi.fn()} />);

        expect(screen.getByText('runtimes.retrieving_version')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a disabled error trigger when the version list is empty and not loading', () => {
        render(<RuntimeVersionSelect isLoading={false} versionsList={[]} version="" setVersion={vi.fn()} />);

        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByText('runtimes.error_fetching_result')).toBeInTheDocument();
    });

    it('renders an enabled select with all versions and calls setVersion on change', async () => {
        const user = userEvent.setup();
        const setVersion = vi.fn();
        const versionsList = [
            { value: '20.11.0', label: 'v20.11.0 (LTS)' },
            { value: '21.5.0', label: 'v21.5.0' },
        ];
        render(<RuntimeVersionSelect isLoading={false} versionsList={versionsList} version="20.11.0" setVersion={setVersion} />);

        const trigger = screen.getByRole('button', { name: 'v20.11.0 (LTS)' });
        expect(trigger).toBeEnabled();

        await user.click(trigger);
        expect(screen.getByRole('option', { name: 'v20.11.0 (LTS)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'v21.5.0' })).toBeInTheDocument();

        await user.click(screen.getByRole('option', { name: 'v21.5.0' }));

        expect(setVersion).toHaveBeenCalledWith('21.5.0');
    });
});
