import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import RuntimeVersionSelect from '../../../src/menu/runtimes/RuntimeVersionSelect';

describe('RuntimeVersionSelect', () => {
    it('shows a disabled loading select while isLoading is true', () => {
        render(<RuntimeVersionSelect isLoading={true} versionsList={[]} version="" setVersion={vi.fn()} />);

        expect(screen.getByRole('combobox')).toBeDisabled();
        expect(screen.getByText('runtimes.retrieving_version')).toBeInTheDocument();
    });

    it('shows a disabled error select when the version list is empty and not loading', () => {
        render(<RuntimeVersionSelect isLoading={false} versionsList={[]} version="" setVersion={vi.fn()} />);

        expect(screen.getByRole('combobox')).toBeDisabled();
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

        const select = screen.getByRole('combobox');
        expect(select).toBeEnabled();
        expect(screen.getByRole('option', { name: 'v20.11.0 (LTS)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'v21.5.0' })).toBeInTheDocument();

        await user.selectOptions(select, '21.5.0');

        expect(setVersion).toHaveBeenCalledWith('21.5.0');
    });
});
