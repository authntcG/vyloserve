import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent } from '../../test-utils';
import ApacheInstallWizard from '../../../src/menu/apache/InstallWizard';

const versions = [
    { version: '2.4.62', filename: 'httpd-2.4.62.zip', url: 'https://example.com/2.4.62.zip' },
    { version: '2.4.58', filename: 'httpd-2.4.58.zip', url: 'https://example.com/2.4.58.zip' },
];

function setup(overrides: Partial<React.ComponentProps<typeof ApacheInstallWizard>> = {}) {
    const setVersion = vi.fn();
    const setUrl = vi.fn();
    const utils = render(
        <ApacheInstallWizard
            versions={versions}
            version="2.4.62"
            setVersion={setVersion}
            setUrl={setUrl}
            httpPort={80}
            setHttpPort={vi.fn()}
            httpsPort={443}
            setHttpsPort={vi.fn()}
            isInstalling={false}
            isFetchingVersions={false}
            progress={0}
            progressText=""
            {...overrides}
        />
    );
    return { ...utils, setVersion, setUrl };
}

describe('ApacheInstallWizard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows a loading select while fetching versions', () => {
        setup({ isFetchingVersions: true });
        expect(screen.getByText('apache.retrieving_releases')).toBeInTheDocument();
    });

    it('shows "server up to date" when there are no available versions', () => {
        setup({ versions: [] });
        expect(screen.getByText('apache.server_up_to_date')).toBeInTheDocument();
    });

    it('lists available versions and marks the first one as latest stable', () => {
        setup();
        expect(screen.getByRole('option', { name: 'Apache 2.4.62 apache.latest_stable' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Apache 2.4.58' })).toBeInTheDocument();
    });

    it('calls setVersion and setUrl with the matching version data when a new version is selected', async () => {
        const user = userEvent.setup();
        const { setVersion, setUrl } = setup();

        await user.selectOptions(screen.getByRole('combobox'), '2.4.58');

        expect(setVersion).toHaveBeenCalledWith('2.4.58');
        expect(setUrl).toHaveBeenCalledWith('https://example.com/2.4.58.zip');
    });

    it('disables the version select and port inputs while installing', () => {
        setup({ isInstalling: true });
        expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('shows the progress bar with percentage and text while installing', () => {
        setup({ isInstalling: true, progress: 55, progressText: 'Extracting...' });
        expect(screen.getByText('55%')).toBeInTheDocument();
        expect(screen.getByText('Extracting...')).toBeInTheDocument();
    });

    it('does not show the progress bar when not installing', () => {
        setup({ isInstalling: false, progress: 55, progressText: 'Extracting...' });
        expect(screen.queryByText('55%')).not.toBeInTheDocument();
    });

    it('calls setHttpPort/setHttpsPort with parsed numeric values when the port fields change', () => {
        const setHttpPort = vi.fn();
        const setHttpsPort = vi.fn();
        setup({ setHttpPort, setHttpsPort });

        fireEvent.change(screen.getByLabelText('apache.http_port'), { target: { value: '8080' } });
        fireEvent.change(screen.getByLabelText('apache.https_port'), { target: { value: '8443' } });

        expect(setHttpPort).toHaveBeenLastCalledWith(8080);
        expect(setHttpsPort).toHaveBeenLastCalledWith(8443);
    });

    it('falls back to the default port when the field is cleared to a non-numeric value', () => {
        const setHttpPort = vi.fn();
        setup({ setHttpPort });

        fireEvent.change(screen.getByLabelText('apache.http_port'), { target: { value: '' } });

        expect(setHttpPort).toHaveBeenLastCalledWith(80);
    });

    it.each([
        ['win32', 'Windows'],
        ['macintosh', 'macOS'],
        ['linux', 'Linux'],
    ])('detects the OS from the user agent (%s -> %s)', (uaFragment, expectedName) => {
        vi.stubGlobal('navigator', { ...navigator, userAgent: `Mozilla/5.0 (${uaFragment})` });
        setup();
        expect(screen.getByText(new RegExp(expectedName))).toBeInTheDocument();
    });
});
