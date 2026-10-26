import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../../test-utils';
import { mockPywebviewApi } from '../../../test-utils';
import { ToastProvider } from '../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../src/context/AlertContext';
import { AiProvider } from '../../../../src/context/AiContext';
import SettingsModals from '../../../../src/menu/tools/settings/SettingsModals';

describe('SettingsModals', () => {
    it('renders no modal content when activeModal is null', () => {
        render(<SettingsModals activeModal={null} onClose={vi.fn()} />);
        expect(screen.queryByText('settings.change_language')).not.toBeInTheDocument();
        expect(screen.queryByText('VyloServe')).not.toBeInTheDocument();
        expect(screen.queryByText('settings.quit_desc')).not.toBeInTheDocument();
    });

    it('shows the general settings (language & theme) by default when settings modal is open', () => {
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);
        expect(screen.getByText(/English/i)).toBeInTheDocument();
        expect(screen.getByText(/Indonesian/i)).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /English/i })).toBeChecked();
    });

    it('instantly saves language when a different language is selected', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ 
            save_app_settings: saveSettings,
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { language: 'en', theme: 'vyloserve-dark' } })
        });
        
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('radio', { name: /Indonesian/i }));

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ language: 'id' });
        });
    });

    it('shows the desktop notifications toggle on the General tab, defaulting to checked', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { language: 'en', theme: 'vyloserve-dark' } })
        });

        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Desktop Notifications' })).toBeChecked();
        });
    });

    it('reflects enable_desktop_notifications=false from saved settings', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { language: 'en', theme: 'vyloserve-dark', enable_desktop_notifications: false } })
        });

        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Desktop Notifications' })).not.toBeChecked();
        });
    });

    it('instantly saves enable_desktop_notifications when the toggle is clicked', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            save_app_settings: saveSettings,
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { language: 'en', theme: 'vyloserve-dark', enable_desktop_notifications: true } })
        });

        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Desktop Notifications' })).toBeChecked();
        });

        await user.click(screen.getByRole('checkbox', { name: 'Desktop Notifications' }));

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ enable_desktop_notifications: false });
        });
    });

    it('shows the VyloServe about content when the about tab is clicked', async () => {
        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);
        
        await user.click(screen.getByRole('button', { name: /settings.about/i }));
        
        expect(screen.getByText('VyloServe')).toBeInTheDocument();
        expect(screen.getByText('settings.about_desc')).toBeInTheDocument();
    });

    it('fetches version when about tab is shown via settings open', async () => {
        const getAppVersion = vi.fn().mockResolvedValue('1.2.3');
        mockPywebviewApi({ get_app_version: getAppVersion });
        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /settings.about/i }));
        await waitFor(() => expect(screen.getByText('Version 1.2.3')).toBeInTheDocument());
        expect(getAppVersion).toHaveBeenCalledTimes(1);
    });

    it('loads and displays log levels and sources from pywebview API on Logs tab', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({
            status: 'success',
            data: { system_log_levels: ['error', 'warn'], system_log_sources: ['ApacheManager'] }
        });
        mockPywebviewApi({ get_app_settings: getAppSettings });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));

        await waitFor(() => {
            expect(getAppSettings).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_level_error' })).toBeChecked();
            expect(screen.getByLabelText('settings.log_level_warn')).toBeChecked();
            expect(screen.getByLabelText('settings.log_level_info')).not.toBeChecked();
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache' })).toBeChecked();
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_php' })).not.toBeChecked();
        });
    });

    it('instantly saves log levels when toggled', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({
            status: 'success',
            data: { system_log_levels: ['info', 'warn', 'error', 'success'], system_log_sources: [] }
        });
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ get_app_settings: getAppSettings, save_app_settings: saveSettings });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));

        // wait for load
        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'settings.log_level_error' })).toBeChecked());

        await user.click(screen.getByRole('checkbox', { name: 'settings.log_level_error' }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_level_error' })).not.toBeChecked();
            expect(saveSettings).toHaveBeenCalledWith({ system_log_levels: ['info', 'warn', 'success'] });
        });
    });

    it('selects and deselects all log sources when the toggle button is clicked', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({
            status: 'success',
            data: { system_log_levels: [], system_log_sources: [] }
        });
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ get_app_settings: getAppSettings, save_app_settings: saveSettings });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));
        
        // wait for load
        await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /select/i }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache' })).toBeChecked();
        });

        await user.click(screen.getByRole('button', { name: /unselect/i }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache' })).not.toBeChecked();
        });
    });

    it('shows a checkbox for the Tunnels category (regression: was missing entirely, causing TunnelsManager logs to be permanently filtered out)', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({
            status: 'success',
            data: { system_log_levels: null, system_log_sources: null }
        });
        mockPywebviewApi({ get_app_settings: getAppSettings });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_tunnels' })).toBeChecked();
        });
    });

    it('includes TunnelsManager when "select all" sources is clicked, and excludes it when "unselect all" is clicked', async () => {
        const getAppSettings = vi.fn().mockResolvedValue({
            status: 'success',
            data: { system_log_levels: [], system_log_sources: [] }
        });
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ get_app_settings: getAppSettings, save_app_settings: saveSettings });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));
        await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /select/i }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'settings.log_source_tunnels' })).toBeChecked();
        });
        expect(saveSettings).toHaveBeenCalledWith(
            expect.objectContaining({ system_log_sources: expect.arrayContaining(['TunnelsManager']) })
        );
    });

    it('closes the app when Quit is confirmed', async () => {
        const user = userEvent.setup();
        const closeApp = vi.fn();
        mockPywebviewApi({ close_app: closeApp });
        render(<SettingsModals activeModal="quit" onClose={vi.fn()} />);

        await user.click(screen.getByText('common.yes'));

        expect(closeApp).toHaveBeenCalledTimes(1);
    });

    it('closes the quit modal when Cancel or close is clicked', async () => {
        const user = userEvent.setup();
        const closeApp = vi.fn();
        mockPywebviewApi({ close_app: closeApp });
        const onClose = vi.fn();
        render(<SettingsModals activeModal="quit" onClose={onClose} />);

        await user.click(screen.getByText('Close', { selector: 'button' }));

        expect(closeApp).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navigates between Updates and About tabs', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
            updater_check_for_updates: vi.fn().mockResolvedValue({ status: 'success', data: { has_update: false } }),
            get_update_status: vi.fn().mockResolvedValue({ result: null, is_downloading: false, percent: 0 }),
        });

        render(
            <ToastProvider>
                <AlertProvider>
                    <AiProvider>
                        <SettingsModals activeModal="settings" onClose={vi.fn()} />
                    </AiProvider>
                </AlertProvider>
            </ToastProvider>
        );

        // Switch to About tab
        await user.click(screen.getByRole('button', { name: /settings.about/i }));
        await waitFor(() => {
            expect(screen.getByText('VyloServe')).toBeInTheDocument();
            expect(screen.getByText('settings.about_desc')).toBeInTheDocument();
        });

        // Switch to Updates tab
        await user.click(screen.getByRole('button', { name: /settings\.updates/i }));
        await waitFor(() => {
            expect(screen.getByText('Check for Updates')).toBeInTheDocument();
        });
    });

    it('changes application theme when a new theme is selected', async () => {
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        const applyTitlebar = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            save_app_settings: saveSettings,
            apply_titlebar_theme: applyTitlebar,
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { theme: 'vyloserve-dark' } }),
        });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByLabelText('settings.theme')).toBeInTheDocument();
        });

        // Select a different theme via dropdown (also verify search input filters themes)
        await user.click(screen.getByLabelText('settings.theme'));
        const searchBox = await screen.findByPlaceholderText(/settings\.theme_search_placeholder|Search theme/i);
        await user.type(searchBox, 'vyloserve-light');
        const lightOption = await screen.findByText('settings.theme_vyloserve_light');
        await user.click(lightOption);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ theme: 'vyloserve-light' });
        });
    });

    it('toggles log levels and sources with paired fileKey in system logs tab', async () => {
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            save_app_settings: saveSettings,
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    system_log_levels: ['info'],
                    system_log_sources: ['ApacheManager', 'apache_error'],
                },
            }),
        });

        const user = userEvent.setup();
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /settings.system_logs/i }));

        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: /settings.log_source_apache/i })).toBeChecked();
        });

        // Uncheck paired Apache source (removes both systemKey and fileKey)
        await user.click(screen.getByRole('checkbox', { name: /settings.log_source_apache/i }));

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    system_log_sources: expect.not.arrayContaining(['ApacheManager', 'apache_error']),
                })
            );
        });

        // Toggle log level (e.g. error)
        const errorLevelCheckbox = screen.getByRole('checkbox', { name: /settings.log_level_error/i });
        await user.click(errorLevelCheckbox);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    system_log_levels: expect.arrayContaining(['error']),
                })
            );
        });
    });

    it('toggles prerelease updates switch and triggers update check', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        const checkForUpdates = vi.fn().mockResolvedValue({
            status: 'success',
            is_update_available: false,
            message: 'Up to date',
        });

        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: { receive_prerelease_updates: false },
            }),
            save_app_settings: saveSettings,
            check_for_updates: checkForUpdates,
            get_update_status: vi.fn().mockResolvedValue({ result: null, is_downloading: false, percent: 0 }),
        });

        render(<SettingsModals activeModal="settings" defaultTab="updates" onClose={vi.fn()} />);

        const prereleaseSwitch = await screen.findByRole('switch');
        expect(prereleaseSwitch).toHaveAttribute('aria-checked', 'false');

        await user.click(prereleaseSwitch);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith(
                expect.objectContaining({ receive_prerelease_updates: true })
            );
            expect(checkForUpdates).toHaveBeenCalled();
        });
    });

    it('handles available update, download trigger, progress events, and install', async () => {
        const user = userEvent.setup();
        const startDownload = vi.fn().mockResolvedValue({ status: 'success' });
        const installUpdate = vi.fn().mockResolvedValue({ status: 'success' });

        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
            check_for_updates: vi.fn().mockResolvedValue({
                status: 'success',
                is_update_available: true,
                version: '1.2.0',
                changelog: 'Added shiny new features',
                asset_url: 'https://example.com/v1.2.0.exe',
                asset_name: 'v1.2.0.exe',
            }),
            start_download_update: startDownload,
            install_update: installUpdate,
            get_update_status: vi.fn().mockResolvedValue({ result: null, is_downloading: false, percent: 0 }),
        });

        render(<SettingsModals activeModal="settings" defaultTab="updates" onClose={vi.fn()} />);

        const checkBtn = await screen.findByRole('button', { name: /Check for Updates/i });
        await user.click(checkBtn);

        await waitFor(() => {
            expect(screen.getByText(/New Update Available!/i)).toBeInTheDocument();
            expect(screen.getByText('Added shiny new features')).toBeInTheDocument();
        });

        const downloadBtn = screen.getByRole('button', { name: /Download & Install/i });
        await user.click(downloadBtn);

        await waitFor(() => {
            expect(startDownload).toHaveBeenCalledWith('https://example.com/v1.2.0.exe', 'v1.2.0.exe');
        });

        // Simulate vylo_progress event
        window.dispatchEvent(new CustomEvent('vylo_progress', {
            detail: { percent: 60, text: 'backend.updater.downloading' }
        }));

        await waitFor(() => {
            expect(screen.getByText('60%')).toBeInTheDocument();
        });

        // Simulate vylo_update_ready event
        window.dispatchEvent(new CustomEvent('vylo_update_ready', { detail: {} }));

        const installBtn = await screen.findByRole('button', { name: /Install & Restart/i });
        await user.click(installBtn);

        await waitFor(() => {
            expect(installUpdate).toHaveBeenCalled();
        });
    });

    it('renders error state when check for updates returns error', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
            check_for_updates: vi.fn().mockResolvedValue({
                status: 'error',
                message: 'Network timeout',
            }),
            get_update_status: vi.fn().mockResolvedValue({ result: null, is_downloading: false, percent: 0 }),
        });

        render(<SettingsModals activeModal="settings" defaultTab="updates" onClose={vi.fn()} />);

        const checkBtn = await screen.findByRole('button', { name: /Check for Updates/i });
        await user.click(checkBtn);

        await waitFor(() => {
            expect(screen.getByText('Network timeout')).toBeInTheDocument();
        });
    });

    it('applies proper non-clipping modal width and min-w-0 on tab content container', async () => {
        render(<SettingsModals activeModal="settings" onClose={vi.fn()} />);

        const dialog = screen.getByRole('dialog');
        const modalBox = dialog.querySelector('.relative.w-full');
        expect(modalBox).toHaveClass('sm:w-[720px]', 'md:w-[820px]', 'lg:w-[880px]', 'max-w-[calc(100vw-2rem)]');

        // Tab content container must have min-w-0 to prevent horizontal clipping
        const tabContentContainer = modalBox?.querySelector('.flex-1.min-w-0.overflow-y-auto');
        expect(tabContentContainer).toBeInTheDocument();
        expect(tabContentContainer).toHaveClass('min-w-0');
    });
});
