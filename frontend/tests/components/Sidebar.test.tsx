import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../../src/components/Sidebar';

/**
 * Sidebar.tsx memanggil window.pywebview.api.get_all_services_status() saat
 * mount (lihat fetchServiceStatuses di komponen) -- WAJIB di-mock di setiap
 * test, kalau tidak component tetap render (fetchServiceStatuses no-op saat
 * api undefined) tapi serviceStatus selalu default {apache:false, php:false,
 * database:false}, tidak merepresentasikan skenario nyata.
 */
function mockPywebviewApi(overrides: Partial<Record<string, unknown>> = {}) {
    const api = {
        get_all_services_status: vi.fn().mockResolvedValue({
            apache: true,
            php: false,
            database: false,
            cpu_load: 42,
        }),
        get_app_version: vi.fn().mockResolvedValue('0.0.3-beta'),
        get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { theme: 'vyloserve-dark', language: 'en', log_levels: [], log_sources: [] } }),
        close_app: vi.fn().mockResolvedValue({ status: 'success' }),
        start_service: vi.fn().mockResolvedValue({ status: 'success' }),
        stop_service: vi.fn().mockResolvedValue({ status: 'success' }),
        ...overrides,
    };
    (window as any).pywebview = { api };
    return api;
}

const noop = () => {};

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
    return render(
        <Sidebar
            isMobileOpen={false}
            isDesktopCollapsed={false}
            onCloseMobile={noop}
            onToggleDesktop={noop}
            activeMenu="dashboard"
            onSelectMenu={props.onSelectMenu ?? noop}
            {...props}
        />
    );
}

describe('Sidebar', () => {
    afterEach(() => {
        (window as any).pywebview = undefined;
        vi.restoreAllMocks();
    });

    it('renders the main menu, services, and tools sections', async () => {
        mockPywebviewApi();
        renderSidebar();

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Apache')).toBeInTheDocument();
        expect(screen.getByText('PHP')).toBeInTheDocument();
        expect(screen.getByText('Database')).toBeInTheDocument();
        expect(screen.getByText('Runtimes')).toBeInTheDocument();

        // Tunggu fetchServiceStatuses (async, dipanggil saat mount) selesai
        // supaya toggle checkbox sudah reflect status dari API sebelum test lain jalan.
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Toggle Apache' })).toBeChecked();
        });
    });

    it('calls onSelectMenu with the correct id when a main menu item is clicked', async () => {
        mockPywebviewApi();
        const onSelectMenu = vi.fn();
        const user = userEvent.setup();
        renderSidebar({ onSelectMenu });

        await user.click(screen.getByText('Dashboard').closest('button')!);

        expect(onSelectMenu).toHaveBeenCalledWith('dashboard');
    });

    // Regresi: Runtimes tidak punya endpoint start_service/stop_service('runtimes')
    // di backend (core/api.py), jadi toggle switch di baris itu dulu tidak pernah
    // berfungsi. Sidebar.tsx sekarang menandai { hasToggle: false } untuk Runtimes
    // di array SERVICES -- lihat docs/frontend_ui.md §2.4 & docs/known_bugs.md.
    it('does not render a toggle switch for Runtimes, but does for Apache/PHP/Database', async () => {
        mockPywebviewApi();
        renderSidebar();

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Toggle Apache' })).toBeInTheDocument();
        });
        expect(screen.getByRole('checkbox', { name: 'Toggle PHP' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Toggle Database' })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Toggle Runtimes' })).not.toBeInTheDocument();
    });

    it('calls api.stop_service when toggling an already-running service off', async () => {
        const api = mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();

        const apacheToggle = await screen.findByRole('checkbox', { name: 'Toggle Apache' });
        await waitFor(() => expect(apacheToggle).toBeChecked());

        await user.click(apacheToggle);

        expect(api.stop_service).toHaveBeenCalledWith('apache');
        expect(api.start_service).not.toHaveBeenCalled();
    });

    it('calls api.start_service when toggling a stopped service on', async () => {
        const api = mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();

        const phpToggle = await screen.findByRole('checkbox', { name: 'Toggle PHP' });
        await waitFor(() => expect(phpToggle).not.toBeChecked());

        await user.click(phpToggle);

        expect(api.start_service).toHaveBeenCalledWith('php');
        expect(api.stop_service).not.toHaveBeenCalled();
    });

    it('always shows the Tools section items without needing any toggle interaction (expanded mode)', async () => {
        mockPywebviewApi();
        renderSidebar({ isDesktopCollapsed: false });

        expect(screen.getByText('sidebar.tools')).toBeInTheDocument();
        expect(screen.getByText('Git')).toBeInTheDocument();
        expect(screen.getByText('QR Generator')).toBeInTheDocument();
        expect(screen.getByText('Tunnels')).toBeInTheDocument();
    });

    it('filters main menu, services, and tools by search query', async () => {
        mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();

        await user.type(screen.getByPlaceholderText('sidebar.search'), 'data');

        expect(screen.getByText('Database')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Apache')).not.toBeInTheDocument();
    });

    it('calls onSelectMenu when a tool item in the expanded Tools section is clicked', async () => {
        mockPywebviewApi();
        const onSelectMenu = vi.fn();
        const user = userEvent.setup();
        renderSidebar({ onSelectMenu });

        await user.click(screen.getByText('Git'));

        expect(onSelectMenu).toHaveBeenCalledWith('git');
    });

    it('calls onSelectMenu when a tool item in the collapsed flyout is clicked', async () => {
        mockPywebviewApi();
        const onSelectMenu = vi.fn();
        const user = userEvent.setup();
        renderSidebar({ isDesktopCollapsed: true, onSelectMenu });

        await user.click(screen.getByText('Git'));

        expect(onSelectMenu).toHaveBeenCalledWith('git');
    });

    it('opens the settings dropdown and shows the settings and quit options', async () => {
        mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();

        await user.click(screen.getByText('settings'));

        expect(screen.getByText('settings.settings')).toBeInTheDocument();
        expect(screen.getByText('settings.quit')).toBeInTheDocument();
    });

    it('opens the general settings modal when "settings" is clicked', async () => {
        mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();
        await user.click(screen.getByText('settings'));

        await user.click(screen.getByText('settings.settings'));

        expect(screen.getByText('settings.theme')).toBeInTheDocument();
    });

    

    

    it('opens the quit-confirmation modal when "quit" is clicked', async () => {
        mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();
        await user.click(screen.getByText('settings'));

        await user.click(screen.getByText('settings.quit'));

        expect(screen.getByText('settings.quit_desc')).toBeInTheDocument();
    });

    it.each([
        [95, 'text-red-500'],
        [65, 'text-amber-500'],
        [10, 'text-emerald-500'],
    ])('colors the collapsed-mode system-load indicator based on load %i%%', async (cpuLoad, expectedClass) => {
        mockPywebviewApi({ get_all_services_status: vi.fn().mockResolvedValue({ apache: false, php: false, database: false, cpu_load: cpuLoad }) });
        renderSidebar({ isDesktopCollapsed: true });

        await waitFor(() => expect(screen.getByText(`${cpuLoad}%`)).toHaveClass(expectedClass));
    });

    it('calls onSelectMenu when a service nav item (not its toggle) is clicked', async () => {
        mockPywebviewApi();
        const onSelectMenu = vi.fn();
        const user = userEvent.setup();
        renderSidebar({ onSelectMenu });
        await screen.findByRole('checkbox', { name: 'Toggle Apache' });

        await user.click(screen.getByText('Apache'));

        expect(onSelectMenu).toHaveBeenCalledWith('apache');
    });

    it('closes an open settings modal via its own close control', async () => {
        mockPywebviewApi();
        const user = userEvent.setup();
        renderSidebar();
        await user.click(screen.getByText('settings'));
        await user.click(screen.getByText('settings.settings'));
        expect(screen.getByText('settings.theme')).toBeInTheDocument();

        await user.click(screen.getAllByTitle('Close')[0]);

        await waitFor(() => {
            expect(screen.queryByText('settings.theme')).not.toBeInTheDocument();
        });
    });

    it('does not crash and keeps the previous status when fetching service statuses throws', async () => {
        mockPywebviewApi({ get_all_services_status: vi.fn().mockRejectedValue(new Error('boom')) });
        renderSidebar();

        expect(await screen.findByText('Apache')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Toggle Apache' })).not.toBeChecked();
    });

    it('does not crash when toggling a service throws', async () => {
        const api = mockPywebviewApi({ start_service: vi.fn().mockRejectedValue(new Error('boom')) });
        const user = userEvent.setup();
        renderSidebar();
        const phpToggle = await screen.findByRole('checkbox', { name: 'Toggle PHP' });
        await waitFor(() => expect(phpToggle).not.toBeChecked());

        await user.click(phpToggle);

        expect(api.start_service).toHaveBeenCalledWith('php');
    });
});
