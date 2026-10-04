import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../../test-utils';
import { mockPywebviewApi } from '../../../test-utils';
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
});
