import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi } from '../../test-utils';
import NewPhpInstance from '../../../src/menu/php/NewInstance';

const versions = [
    { version: '8.3', filename: 'php-8.3.zip' },
    { version: '8.2', filename: 'php-8.2.zip' },
];

function setup(overrides: Partial<React.ComponentProps<typeof NewPhpInstance>> = {}) {
    const setVersion = vi.fn();
    const setFilename = vi.fn();
    const setPort = vi.fn();
    const setIsFetchingVersions = vi.fn();
    const utils = render(
        <NewPhpInstance
            version=""
            setVersion={setVersion}
            setFilename={setFilename}
            port={9000}
            setPort={setPort}
            isFetchingVersions={false}
            setIsFetchingVersions={setIsFetchingVersions}
            usedPorts={[]}
            {...overrides}
        />
    );
    return { ...utils, setVersion, setFilename, setPort, setIsFetchingVersions };
}

describe('NewPhpInstance', () => {
    it('fetches versions on mount and defaults to the first one', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        const { setVersion, setFilename } = setup();

        await waitFor(() => expect(setVersion).toHaveBeenCalledWith('8.3'));
        expect(setFilename).toHaveBeenCalledWith('php-8.3.zip');
        expect(await screen.findByText(/PHP 8.3/)).toBeInTheDocument();
    });

    it('clears version/filename and shows "all versions installed" when the list is empty', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        const { setVersion, setFilename } = setup();

        await waitFor(() => expect(setVersion).toHaveBeenCalledWith(''));
        expect(setFilename).toHaveBeenCalledWith('');
        expect(await screen.findByText('php.all_versions_installed')).toBeInTheDocument();
    });

    it('shows the API-provided error message and disables the select when the fetch reports failure', async () => {
        mockPywebviewApi({
            get_php_versions: vi.fn().mockResolvedValue({ status: 'error', message: 'php.fetch_denied', args: {} }),
        });
        setup();

        expect(await screen.findByText(/php.fetch_denied/)).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('shows the generic backend-connection error when the fetch call throws', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockRejectedValue(new Error('boom')) });
        setup();

        expect(await screen.findByText(/php.backend_connection_error/)).toBeInTheDocument();
    });

    it('calls setVersion and setFilename with the matching data when a different version is selected', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        const { setVersion, setFilename } = setup();
        await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());

        fireEvent.change(screen.getByRole('combobox'), { target: { value: '8.2' } });

        expect(setVersion).toHaveBeenCalledWith('8.2');
        expect(setFilename).toHaveBeenCalledWith('php-8.2.zip');
    });

    it('shows a port-conflict warning with the next recommended port when the port is already used', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        setup({ port: 9001, usedPorts: [9000, 9001] });

        expect(await screen.findByText('php.port_conflict')).toBeInTheDocument();
        expect(screen.getByText('9002')).toBeInTheDocument();
    });

    it('shows the port-9000 tip when the port is 9000 and not conflicting', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        setup({ port: 9000, usedPorts: [] });

        expect(await screen.findByText('php.port_9000_tip')).toBeInTheDocument();
    });

    it('shows neither hint for a free, non-9000 port', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        setup({ port: 9050, usedPorts: [] });

        await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
        expect(screen.queryByText('php.port_conflict')).not.toBeInTheDocument();
        expect(screen.queryByText('php.port_9000_tip')).not.toBeInTheDocument();
    });

    it('calls setPort with the numeric field value when the port input changes', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        const { setPort } = setup();
        await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());

        fireEvent.change(screen.getByLabelText('php.listening_port'), { target: { value: '9050' } });

        expect(setPort).toHaveBeenCalledWith(9050);
    });

    it('shows the progress bar with percent/text while installing, listening only to PhpManager-sourced events', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        setup({ isInstalling: true });

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 90, text: 'wrong module' } }));
        });
        expect(screen.getByText('php.starting_process')).toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'PhpManager', percent: 55, text: 'Extracting...' } }));
        });

        expect(screen.getByText('Extracting...')).toBeInTheDocument();
        expect(screen.getByText('55%')).toBeInTheDocument();
    });

    it('does not show the progress bar when not installing', async () => {
        mockPywebviewApi({ get_php_versions: vi.fn().mockResolvedValue({ status: 'success', data: versions }) });
        setup({ isInstalling: false });

        expect(screen.queryByText('php.starting_process')).not.toBeInTheDocument();
    });
});
