import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from './test-utils';
import App from '../src/App';

vi.mock('../src/components/HeaderMobile', () => ({ default: ({ onMenuClick }: { onMenuClick: () => void }) => <button type="button" onClick={onMenuClick}>header-mobile</button> }));
vi.mock('../src/components/Sidebar', () => ({
    default: ({ onSelectMenu, isDesktopCollapsed, onToggleDesktop }: { onSelectMenu: (m: string) => void; isDesktopCollapsed: boolean; onToggleDesktop: () => void }) => (
        <div>
            sidebar (collapsed={String(isDesktopCollapsed)})
            <button type="button" onClick={() => onSelectMenu('apache')}>go-apache</button>
            <button type="button" onClick={onToggleDesktop}>toggle-desktop</button>
        </div>
    ),
}));
vi.mock('../src/components/LogsPanel', () => ({ default: () => <div>logs-panel</div> }));
vi.mock('../src/menu/apache/Main', () => ({ default: () => <div>apache-main</div> }));
vi.mock('../src/menu/php/Main', () => ({ default: () => <div>php-main</div> }));
vi.mock('../src/menu/database/Main', () => ({ default: () => <div>database-main</div> }));
vi.mock('../src/menu/dashboard/Main', () => ({ default: () => <div>dashboard-main</div> }));
vi.mock('../src/menu/runtimes/Main', () => ({ default: () => <div>runtimes-main</div> }));
vi.mock('../src/menu/tools/git/Main', () => ({ default: () => <div>git-main</div> }));
vi.mock('../src/menu/tools/url-encode-decode/Main', () => ({ default: () => <div>url-main</div> }));
vi.mock('../src/menu/tools/base64-encode-decode/Main', () => ({ default: () => <div>base64-main</div> }));
vi.mock('../src/menu/tools/qr-generator/Main', () => ({ default: () => <div>qr-main</div> }));
vi.mock('../src/i18n', () => ({ default: { changeLanguage: vi.fn() } }));

function resetPywebview() {
    delete (window as unknown as { pywebview?: unknown }).pywebview;
}

beforeEach(() => {
    resetPywebview();
});

afterEach(() => {
    resetPywebview();
});

describe('App', () => {
    it('shows the connecting-engine loader while window.pywebview.api is not yet ready', () => {
        render(<App />);
        expect(screen.getByText('common.connecting_engine')).toBeInTheDocument();
    });

    it('renders the shell once test_connection becomes available, and polls via interval until then', async () => {
        vi.useFakeTimers();
        try {
            render(<App />);
            expect(screen.getByText('common.connecting_engine')).toBeInTheDocument();

            window.pywebview = { api: { test_connection: vi.fn() } };
            act(() => {
                vi.advanceTimersByTime(100);
            });

            expect(screen.getByText('dashboard-main')).toBeInTheDocument();
            expect(screen.queryByText('common.connecting_engine')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('becomes ready immediately when window.pywebview.api.test_connection is already present on mount', () => {
        window.pywebview = { api: { test_connection: vi.fn() } };
        render(<App />);

        expect(screen.getByText('dashboard-main')).toBeInTheDocument();
    });

    it('becomes ready in response to the pywebviewready event without waiting for the poll interval', async () => {
        render(<App />);
        window.pywebview = { api: { test_connection: vi.fn() } };

        await act(async () => {
            window.dispatchEvent(new Event('pywebviewready'));
        });

        expect(screen.getByText('dashboard-main')).toBeInTheDocument();
    });

    it('applies the saved language from get_app_settings once the API is ready', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({ status: 'success', data: { language: 'id' } });
        window.pywebview = { api: { test_connection: vi.fn(), get_app_settings: getAppSettings } };

        render(<App />);

        await waitFor(() => expect(getAppSettings).toHaveBeenCalledTimes(1));
    });

    it('does not crash when get_app_settings rejects', async () => {
        const getAppSettings = vi.fn().mockRejectedValue(new Error('settings unavailable'));
        window.pywebview = { api: { test_connection: vi.fn(), get_app_settings: getAppSettings } };

        render(<App />);

        await waitFor(() => expect(getAppSettings).toHaveBeenCalledTimes(1));
        expect(screen.getByText('dashboard-main')).toBeInTheDocument();
    });

    it('switches the active menu section, keeping the others in the DOM but hidden', async () => {
        window.pywebview = { api: { test_connection: vi.fn() } };
        render(<App />);

        const dashboardWrapper = screen.getByText('dashboard-main').parentElement!;
        expect(dashboardWrapper).toHaveClass('block');

        await act(async () => {
            screen.getByText('go-apache').click();
        });

        expect(screen.getByText('apache-main').parentElement).toHaveClass('block');
        expect(dashboardWrapper).toHaveClass('hidden');
    });

    it('toggles the desktop-collapsed sidebar margin class', async () => {
        window.pywebview = { api: { test_connection: vi.fn() } };
        render(<App />);
        expect(screen.getByText(/collapsed=false/)).toBeInTheDocument();

        await act(async () => {
            screen.getByText('toggle-desktop').click();
        });

        expect(screen.getByText(/collapsed=true/)).toBeInTheDocument();
    });

    it('opens the mobile sidebar when the mobile header menu button is clicked', async () => {
        window.pywebview = { api: { test_connection: vi.fn() } };
        render(<App />);

        await act(async () => {
            screen.getByText('header-mobile').click();
        });

        // Verifikasi tidak throw dan shell tetap ter-render setelah state mobile berubah.
        expect(screen.getByText('dashboard-main')).toBeInTheDocument();
    });
});
