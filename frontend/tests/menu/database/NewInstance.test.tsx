import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, fireEvent } from '../../test-utils';
import { mockPywebviewApi } from '../../test-utils';
import NewDbInstance, { type NewDbInstanceRef } from '../../../src/menu/database/NewInstance';

const mysqlVersions = [
    { name: 'MySQL 8.0', version: '8.0', url: 'https://example.com/mysql-8.0.zip' },
    { name: 'MySQL 5.7', version: '5.7', url: 'https://example.com/mysql-5.7.zip' },
];

function setup(overrides: Partial<React.ComponentProps<typeof NewDbInstance>> = {}, ref = createRef<NewDbInstanceRef>()) {
    const utils = render(
        <NewDbInstance
            ref={ref}
            activeTab="all"
            usedPorts={[]}
            isInstalling={false}
            progress={0}
            progressText=""
            {...overrides}
        />
    );
    return { ...utils, ref };
}

describe('NewDbInstance', () => {
    it('defaults to mysql on port 3306 and fetches its online versions', async () => {
        const getAvailable = vi.fn().mockResolvedValue({ status: 'success', data: mysqlVersions });
        mockPywebviewApi({ get_available_databases: getAvailable });
        setup();

        await screen.findByText('MySQL 8.0');
        expect(getAvailable).toHaveBeenCalledWith('mysql');
    });

    it('defaults to postgres on port 5432 when activeTab is postgres', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        setup({ activeTab: 'postgres' });

        expect(screen.getByDisplayValue('database.postgres')).toBeInTheDocument();
    });

    it('exposes null form data via the ref until a version is selected', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        const { ref } = setup();

        expect(ref.current?.getFormData()).toBeNull();
    });

    it('exposes the selected version, port and password via the ref once a version loads', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: mysqlVersions }) });
        const { ref } = setup();

        await screen.findByText('MySQL 8.0');

        expect(ref.current?.getFormData()).toEqual({
            engine: 'mysql', version: '8.0', url: 'https://example.com/mysql-8.0.zip', port: 3306, rootPass: '',
        });
    });

    it('opens the version dropdown, filters by search, and selects a different version', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: mysqlVersions }) });
        const { ref } = setup();
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('MySQL 8.0'));
        await user.type(screen.getByPlaceholderText('database.find_version'), '5.7');

        expect(screen.queryByRole('option', { name: 'MySQL 8.0' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('option', { name: 'MySQL 5.7' }));

        expect(ref.current?.getFormData()).toMatchObject({ version: '5.7' });
    });

    it('shows "no versions found" when the search matches nothing', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: mysqlVersions }) });
        setup();
        await screen.findByText('MySQL 8.0');

        await user.click(screen.getByText('MySQL 8.0'));
        await user.type(screen.getByPlaceholderText('database.find_version'), 'zzz-nomatch');

        expect(screen.getByText('database.no_versions_found')).toBeInTheDocument();
    });

    it('switches engine family, resets the port, and refetches versions', async () => {
        const user = userEvent.setup();
        const getAvailable = vi.fn()
            .mockResolvedValueOnce({ status: 'success', data: mysqlVersions })
            .mockResolvedValueOnce({ status: 'success', data: [] });
        mockPywebviewApi({ get_available_databases: getAvailable });
        setup();
        await screen.findByText('MySQL 8.0');

        await user.selectOptions(screen.getByDisplayValue('database.mysql_mariadb'), 'postgres');

        expect(getAvailable).toHaveBeenCalledWith('postgres');
        expect(screen.getByText('database.postgres_password_req')).toBeInTheDocument();
    });

    it('re-syncs engine and port when activeTab changes away from "all"', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        const ref = createRef<NewDbInstanceRef>();
        const { rerender } = setup({ activeTab: 'all' }, ref);
        expect(screen.getByDisplayValue('database.mysql_mariadb')).toBeInTheDocument();

        rerender(
            <NewDbInstance ref={ref} activeTab="postgres" usedPorts={[]} isInstalling={false} progress={0} progressText="" />
        );

        expect(screen.getByDisplayValue('database.postgres')).toBeInTheDocument();
    });

    it('shows a port-in-use warning when the chosen port collides with an existing instance', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        setup({ usedPorts: [3306] });

        await waitFor(() =>
            expect(screen.getByText((_, el) => el?.textContent === 'database.port_in_use3306database.in_use')).toBeInTheDocument()
        );
    });

    it('shows the progress bar with percent/text while installing', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        setup({ isInstalling: true, progress: 42, progressText: 'database.downloading' });

        expect(screen.getByText('database.downloading')).toBeInTheDocument();
        expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('disables the engine select and port field while installing', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        setup({ isInstalling: true });

        expect(screen.getByDisplayValue('database.mysql_mariadb')).toBeDisabled();
    });

    it('updates the port and superuser password fields when edited', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
        setup();

        fireEvent.change(screen.getByDisplayValue('3306'), { target: { value: '3307' } });
        fireEvent.change(screen.getByPlaceholderText('database.empty_password_placeholder'), { target: { value: 'secret' } });

        expect(screen.getByDisplayValue('3307')).toBeInTheDocument();
        expect(screen.getByDisplayValue('secret')).toBeInTheDocument();
    });

    it('selects a version via the keyboard (Enter) on the dropdown option', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: mysqlVersions }) });
        const { ref } = setup();
        await screen.findByText('MySQL 8.0');
        await user.click(screen.getByText('MySQL 8.0'));

        fireEvent.keyDown(screen.getByRole('option', { name: 'MySQL 5.7' }), { key: 'Enter' });

        expect(ref.current?.getFormData()).toMatchObject({ version: '5.7' });
    });

    it('shows an empty version list when fetching online versions reports failure', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'error' }) });
        const { ref } = setup();

        await waitFor(() => expect(ref.current?.getFormData()).toBeNull());
    });

    it('does not crash and leaves the form data null when fetching online versions throws', async () => {
        mockPywebviewApi({ get_available_databases: vi.fn().mockRejectedValue(new Error('boom')) });
        const { ref } = setup();

        await waitFor(() => expect(ref.current?.getFormData()).toBeNull());
    });

    it.each([
        ['macintosh', 'macOS'],
        ['linux', 'Linux'],
    ])('detects the OS from the user agent (%s -> %s)', async (uaFragment, expectedName) => {
        vi.stubGlobal('navigator', { ...navigator, userAgent: `Mozilla/5.0 (${uaFragment})` });
        try {
            mockPywebviewApi({ get_available_databases: vi.fn().mockResolvedValue({ status: 'success', data: [] }) });
            setup();

            expect(await screen.findByText('database.detected_system')).toBeInTheDocument();
            expect(screen.getByText(expectedName)).toBeInTheDocument();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
