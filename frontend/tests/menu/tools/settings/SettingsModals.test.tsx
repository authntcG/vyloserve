import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../../test-utils';
import { mockPywebviewApi } from '../../../test-utils';
import SettingsModals from '../../../../src/menu/tools/settings/SettingsModals';

describe('SettingsModals', () => {
    it('renders no modal content when activeModal is null', () => {
        render(<SettingsModals activeModal={null} onClose={vi.fn()} />);
        expect(screen.queryByText('settings.change_language')).not.toBeInTheDocument();
        expect(screen.queryByText('VyloServe')).not.toBeInTheDocument();
        expect(screen.queryByText('settings.quit_desc')).not.toBeInTheDocument();
    });

    it('shows the language options when the language modal is open', () => {
        render(<SettingsModals activeModal="language" onClose={vi.fn()} />);
        expect(screen.getByText('settings.lang_option_english')).toBeInTheDocument();
        expect(screen.getByText('settings.lang_option_indonesian')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'settings.lang_option_english' })).toBeChecked();
    });

    it('closes without changing language when Apply is clicked without selecting a different language', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn();
        mockPywebviewApi({ save_app_settings: saveSettings });
        const onClose = vi.fn();
        render(<SettingsModals activeModal="language" onClose={onClose} />);

        await user.click(screen.getByText('common.save'));

        expect(saveSettings).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('changes and persists the language, then closes, when a different language is selected and applied', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ save_app_settings: saveSettings });
        const onClose = vi.fn();
        render(<SettingsModals activeModal="language" onClose={onClose} />);

        await user.click(screen.getByRole('radio', { name: 'settings.lang_option_indonesian' }));
        await user.click(screen.getByText('common.save'));

        expect(saveSettings).toHaveBeenCalledWith({ language: 'id' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows the VyloServe about content with working GitHub and documentation links', () => {
        render(<SettingsModals activeModal="about" onClose={vi.fn()} />);

        const githubLink = screen.getByText('settings.view_on_github').closest('a')!;
        expect(githubLink).toHaveAttribute('href', 'https://github.com/authntcG/vyloserve/');

        const docsLink = screen.getByText('settings.documentation').closest('a')!;
        expect(docsLink).toHaveAttribute('href', 'https://github.com/authntcG/vyloserve/blob/main/docs/index.md');
    });

    it('closes the about modal via its custom footer close button', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<SettingsModals activeModal="about" onClose={onClose} />);

        await user.click(screen.getAllByText('common.close')[0]);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows the destructive quit confirmation and calls close_app when confirmed', async () => {
        const user = userEvent.setup();
        const closeApp = vi.fn();
        mockPywebviewApi({ close_app: closeApp });
        render(<SettingsModals activeModal="quit" onClose={vi.fn()} />);
        expect(screen.getByText('settings.quit_desc')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'settings.quit' }));

        expect(closeApp).toHaveBeenCalledTimes(1);
    });

    it('falls back to window.close() when close_app is not available', async () => {
        const user = userEvent.setup();
        mockPywebviewApi();
        const windowClose = vi.spyOn(window, 'close').mockImplementation(() => {});
        render(<SettingsModals activeModal="quit" onClose={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'settings.quit' }));

        expect(windowClose).toHaveBeenCalledTimes(1);
    });

    it('shows every level/source checked by default in the System Logs modal when nothing is persisted yet', async () => {
        mockPywebviewApi();
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);

        expect(await screen.findByRole('checkbox', { name: 'settings.log_level_info' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_level_error' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_system' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_file' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_database settings.log_group_system' })).toBeChecked();
    });

    it('does not render a "File Logs" toggle for modules with no file log (e.g. PHP), only "System Logs"', async () => {
        mockPywebviewApi();
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);
        await screen.findByRole('checkbox', { name: 'settings.log_source_php settings.log_group_system' });

        expect(screen.queryByRole('checkbox', { name: 'settings.log_source_php settings.log_group_file' })).not.toBeInTheDocument();
    });

    it('toggles the Apache "System Logs" and "File Logs" categories independently of each other', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ save_app_settings: saveSettings });
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);
        await screen.findByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_system' });

        // Matikan HANYA log file Apache, sistemnya tetap aktif
        await user.click(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_file' }));

        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_system' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_file' })).not.toBeChecked();

        await user.click(screen.getByText('common.save'));

        const savedSources: string[] = saveSettings.mock.calls[0][0].system_log_sources;
        expect(savedSources).toContain('ApacheManager');
        expect(savedSources).not.toContain('ApacheFileLog');
    });

    it('restores a previously-saved partial filter from backend settings when the System Logs modal opens', async () => {
        mockPywebviewApi({ get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { system_log_levels: ['error'], system_log_sources: ['ApacheManager'] } }) });
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);

        expect(await screen.findByRole('checkbox', { name: 'settings.log_level_error' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_level_info' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_system' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_apache settings.log_group_file' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'settings.log_source_php settings.log_group_system' })).not.toBeChecked();
    });

    const ALL_SOURCE_KEYS = [
        'ApacheManager', 'ApacheFileLog', 'PhpManager', 'DatabaseManager', 'DatabaseFileLog',
        'ProjectManager', 'RuntimesManager', 'GitManager', 'SslManager', 'DashboardManager', 'SettingsManager',
    ];

    it('saves an explicit list when a level checkbox is unchecked, and notifies LogsPanel to re-filter', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ save_app_settings: saveSettings });
        const onClose = vi.fn();
        const listener = vi.fn();
        window.addEventListener('vylo_log_settings_changed', listener);
        render(<SettingsModals activeModal="logs" onClose={onClose} />);
        await screen.findByRole('checkbox', { name: 'settings.log_level_info' });

        await user.click(screen.getByRole('checkbox', { name: 'settings.log_level_info' }));
        await user.click(screen.getByText('common.save'));

        expect(saveSettings).toHaveBeenCalledWith({
            system_log_levels: ['warn', 'error', 'success'],
            system_log_sources: ALL_SOURCE_KEYS,
        });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        window.removeEventListener('vylo_log_settings_changed', listener);
    });

    it('saves the full list literally (not collapsed to an empty-array sentinel) when every level/source remains checked', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ save_app_settings: saveSettings });
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);
        await screen.findByRole('checkbox', { name: 'settings.log_level_info' });

        await user.click(screen.getByText('common.save'));

        expect(saveSettings).toHaveBeenCalledWith({
            system_log_levels: ['info', 'warn', 'error', 'success'],
            system_log_sources: ALL_SOURCE_KEYS,
        });
    });

    it('saves a genuinely empty array when every checkbox in a category is unchecked (regression: must NOT round-trip back to "show all")', async () => {
        const user = userEvent.setup();
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ save_app_settings: saveSettings });
        render(<SettingsModals activeModal="logs" onClose={vi.fn()} />);
        await screen.findByRole('checkbox', { name: 'settings.log_level_info' });

        for (const levelKey of ['info', 'warn', 'error', 'success']) {
            await user.click(screen.getByRole('checkbox', { name: `settings.log_level_${levelKey}` }));
        }
        await user.click(screen.getByText('common.save'));

        expect(saveSettings).toHaveBeenCalledWith({
            system_log_levels: [],
            system_log_sources: ALL_SOURCE_KEYS,
        });
    });
});
