import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, fireEvent } from '../../test-utils';
import PhpSettings from '../../../src/menu/php/Settings';

const baseConfig = { port: 9000, memory_limit: '256M', max_execution_time: '30', upload_max_filesize: '64M', post_max_size: '64M' };
const extensions = [
    { name: 'curl', active: true },
    { name: 'gd', active: false },
];

function setup(overrides: Partial<React.ComponentProps<typeof PhpSettings>> = {}) {
    const setConfig = vi.fn();
    const setExtensions = vi.fn();
    const utils = render(
        <PhpSettings
            config={baseConfig}
            setConfig={setConfig}
            extensions={extensions}
            setExtensions={setExtensions}
            isLoading={false}
            usedPorts={[]}
            {...overrides}
        />
    );
    return { ...utils, setConfig, setExtensions };
}

describe('PhpSettings', () => {
    it('shows a loading indicator and no form fields while isLoading is true', () => {
        setup({ isLoading: true });
        expect(screen.getByText('php.reading_php_ini')).toBeInTheDocument();
        expect(screen.queryByLabelText('memory_limit')).not.toBeInTheDocument();
    });

    it('does not show a port conflict warning when the port is free', () => {
        setup({ usedPorts: [9001, 9002] });
        expect(screen.queryByText('php.port_already_in_use')).not.toBeInTheDocument();
    });

    it('shows a port conflict warning when the configured port is already used elsewhere', () => {
        setup({ usedPorts: [9000, 9001] });
        expect(screen.getByText('php.port_already_in_use')).toBeInTheDocument();
    });

    it('lists all extensions with their active state', () => {
        setup();
        expect(screen.getByText('curl')).toBeInTheDocument();
        expect(screen.getByText('gd')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'curl' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'gd' })).not.toBeChecked();
    });

    it('toggles an extension active state when clicked', async () => {
        const user = userEvent.setup();
        const { setExtensions } = setup();

        await user.click(screen.getByText('gd'));

        expect(setExtensions).toHaveBeenCalledTimes(1);
        const updater = setExtensions.mock.calls[0][0] as (prev: typeof extensions) => typeof extensions;
        expect(updater(extensions)).toEqual([
            { name: 'curl', active: true },
            { name: 'gd', active: true },
        ]);
    });

    it('filters extensions by the search query', async () => {
        const user = userEvent.setup();
        setup();

        await user.type(screen.getByPlaceholderText('php.search_extension'), 'cu');

        expect(screen.getByText('curl')).toBeInTheDocument();
        expect(screen.queryByText('gd')).not.toBeInTheDocument();
    });

    it('shows "no extensions match" when the search query matches nothing, and "no extensions found" when the list itself is empty', async () => {
        const user = userEvent.setup();
        const { rerender } = setup();

        await user.type(screen.getByPlaceholderText('php.search_extension'), 'zzz-no-match');
        expect(screen.getByText('php.no_extensions_match')).toBeInTheDocument();

        rerender(
            <PhpSettings config={baseConfig} setConfig={vi.fn()} extensions={[]} setExtensions={vi.fn()} isLoading={false} usedPorts={[]} />
        );
        expect(screen.getByText('php.no_extensions_found')).toBeInTheDocument();
    });

    it('calls setConfig when a config field is edited', () => {
        const { setConfig } = setup();

        fireEvent.change(screen.getByLabelText('memory_limit'), { target: { value: '512M' } });

        expect(setConfig).toHaveBeenCalledTimes(1);
        expect(setConfig).toHaveBeenCalledWith(expect.any(Function));
    });

    it('reflects the typed value in the rendered input once state actually updates', () => {
        function StatefulHarness() {
            const [config, setConfig] = useState(baseConfig);
            return (
                <PhpSettings
                    config={config}
                    setConfig={setConfig}
                    extensions={extensions}
                    setExtensions={vi.fn()}
                    isLoading={false}
                    usedPorts={[]}
                />
            );
        }
        render(<StatefulHarness />);

        fireEvent.change(screen.getByLabelText('memory_limit'), { target: { value: '512M' } });

        expect(screen.getByLabelText('memory_limit')).toHaveValue('512M');
    });

    it.each([
        ['php.fastcgi_port', '9001'],
        ['max_execution_time (sec)', '60'],
        ['upload_max_filesize', '128M'],
    ])('calls setConfig when the "%s" field is edited', (label, value) => {
        const { setConfig } = setup();

        fireEvent.change(screen.getByLabelText(label), { target: { value } });

        expect(setConfig).toHaveBeenCalledTimes(1);
        expect(setConfig).toHaveBeenCalledWith(expect.any(Function));
    });

    it('shows the port-conflict warning styling when the configured port collides', () => {
        setup({ usedPorts: [9000] });
        expect(screen.getByText('php.port_already_in_use')).toBeInTheDocument();
    });
});
