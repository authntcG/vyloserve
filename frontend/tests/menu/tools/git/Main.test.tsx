import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../../test-utils';
import GitMain from '../../../../src/menu/tools/git/Main';

const notInstalled = { status: 'success', data: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } } };
const installedNotInPath = { status: 'success', data: { installed: true, version: '2.44.0', in_path: false, external: { exists: false, path: '', version: '' } } };
const externalLocked = { status: 'success', data: { installed: false, version: '', in_path: false, external: { exists: true, path: 'C:/Git/bin/git.exe', version: '2.40.0' } } };

function mockGitStatus(status: typeof notInstalled) {
    return {
        get_git_status: vi.fn().mockResolvedValue(status.data),
        get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: { name: '', email: '' } }),
    };
}

describe('GitMain', () => {
    it('shows the empty state and an enabled install button when git is not installed', async () => {
        mockPywebviewApi(mockGitStatus(notInstalled));
        renderWithToast(<GitMain />);

        expect(await screen.findByText('tools.git.not_installed_title')).toBeInTheDocument();
        expect(screen.getByText('tools.git.install_git')).not.toBeDisabled();
    });

    it('shows the locked external-install card and disables the install button when an external git is detected', async () => {
        mockPywebviewApi(mockGitStatus(externalLocked));
        renderWithToast(<GitMain />);

        expect(await screen.findByText('tools.git.native_os_card_title')).toBeInTheDocument();
        expect(screen.getByText('C:/Git/bin/git.exe')).toBeInTheDocument();
        expect(screen.queryByText('tools.git.not_installed_title')).not.toBeInTheDocument();
        expect(screen.getByText('tools.git.install_git')).toBeDisabled();
    });

    it('shows the core system and global config cards when git is installed', async () => {
        mockPywebviewApi(mockGitStatus(installedNotInPath));
        renderWithToast(<GitMain />);

        expect(await screen.findByText('tools.git.core_system_title')).toBeInTheDocument();
        expect(screen.getByText('2.44.0')).toBeInTheDocument();
        expect(screen.getByText('tools.git.global_config')).toBeInTheDocument();
    });

    it('adds git to PATH and shows a success toast when the toggle is switched on', async () => {
        const user = userEvent.setup();
        const togglePath = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), toggle_git_path: togglePath });
        renderWithToast(<GitMain />);
        await screen.findByLabelText('tools.git.register_path');

        await user.click(screen.getByLabelText('tools.git.register_path'));

        expect(togglePath).toHaveBeenCalledWith(true);
        expect(await screen.findByText('tools.git.path_added')).toBeInTheDocument();
    });

    it('disables the register-PATH toggle (preventing any change) while an external git exists', async () => {
        const installedWithExternal = {
            status: 'success',
            data: { installed: true, version: '2.44.0', in_path: false, external: { exists: true, path: 'C:/Git/bin/git.exe', version: '2.40.0' } },
        };
        mockPywebviewApi(mockGitStatus(installedWithExternal as typeof notInstalled));
        renderWithToast(<GitMain />);

        expect(await screen.findByLabelText('tools.git.register_path')).toBeDisabled();
    });

    it('saves the global git config and shows a success toast', async () => {
        const user = userEvent.setup();
        const setConfig = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), set_git_config: setConfig });
        renderWithToast(<GitMain />);
        await screen.findByPlaceholderText('tools.git.eg_name');

        await user.type(screen.getByPlaceholderText('tools.git.eg_name'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('tools.git.eg_email'), 'jane@example.com');
        await user.click(screen.getByText('tools.git.save_config'));

        expect(setConfig).toHaveBeenCalledWith('Jane Doe', 'jane@example.com');
        expect(await screen.findByText('tools.git.config_saved')).toBeInTheDocument();
    });

    it('shows a system-error toast when saving the config throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), set_git_config: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.save_config');

        await user.click(screen.getByText('tools.git.save_config'));

        expect(await screen.findByText('tools.git.sys_error')).toBeInTheDocument();
    });

    it('installs the selected git version, closes the modal, and refreshes the status on success', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        const getStatus = vi.fn().mockResolvedValueOnce(notInstalled.data).mockResolvedValue(installedNotInPath.data);
        mockPywebviewApi({
            get_git_status: getStatus,
            get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '2.44.0', filename: 'Git-2.44.0.exe', version_text: '2.44.0', label: 'Git 2.44.0' }] }),
            install_git: install,
        });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.install_git');
        await user.click(screen.getByText('tools.git.install_git'));
        await screen.findByText('Git 2.44.0');

        await user.click(screen.getByText('tools.git.install_engine'));

        expect(install).toHaveBeenCalledWith('2.44.0', 'Git-2.44.0.exe', '2.44.0');
        await screen.findByText('tools.git.core_system_title');
    });

    it('shows the API-provided error and keeps the modal open when installation fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            ...mockGitStatus(notInstalled),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '2.44.0', filename: 'Git-2.44.0.exe', version_text: '2.44.0', label: 'Git 2.44.0' }] }),
            install_git: vi.fn().mockResolvedValue({ status: 'error', message: 'tools.git.custom_install_error' }),
        });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.install_git');
        await user.click(screen.getByText('tools.git.install_git'));
        await screen.findByText('Git 2.44.0');

        await user.click(screen.getByText('tools.git.install_engine'));

        expect(await screen.findByText('tools.git.custom_install_error')).toBeInTheDocument();
        expect(screen.getByText('tools.git.install_engine')).toBeInTheDocument();
    });

    it('minimizes the install modal into a floating widget while processing, and can be restored', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            ...mockGitStatus(notInstalled),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '2.44.0', filename: 'Git-2.44.0.exe', version_text: '2.44.0', label: 'Git 2.44.0' }] }),
            install_git: vi.fn().mockReturnValue(new Promise(() => {})),
        });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.install_git');
        await user.click(screen.getByText('tools.git.install_git'));
        await screen.findByText('Git 2.44.0');
        await user.click(screen.getByText('tools.git.install_engine'));

        await user.click(screen.getAllByLabelText('Close')[0]);

        expect(await screen.findByText('tools.git.running_background')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'open_in_full' }));

        expect(screen.queryByText('tools.git.running_background')).not.toBeInTheDocument();
        expect(screen.getByText('tools.git.installing_btn')).toBeInTheDocument();
    });

    it('confirms uninstall, calls the API, and refreshes the status on success', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn().mockResolvedValue({ status: 'success' });
        const getStatus = vi.fn().mockResolvedValueOnce(installedNotInPath.data).mockResolvedValue(notInstalled.data);
        mockPywebviewApi({
            get_git_status: getStatus,
            get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
            uninstall_git: uninstall,
        });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.uninstall_git');
        await user.click(screen.getByText('tools.git.uninstall_git'));
        expect(await screen.findByText('tools.git.uninstall_title')).toBeInTheDocument();

        await user.click(screen.getByText('tools.git.yes_uninstall'));

        expect(uninstall).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('tools.git.uninstall_success')).toBeInTheDocument();
    });

    it('shows the API-provided error when uninstall fails', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), uninstall_git: vi.fn().mockResolvedValue({ status: 'error', message: 'tools.git.custom_uninstall_error' }) });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.uninstall_git');
        await user.click(screen.getByText('tools.git.uninstall_git'));
        await screen.findByText('tools.git.yes_uninstall');

        await user.click(screen.getByText('tools.git.yes_uninstall'));

        expect(await screen.findByText('tools.git.custom_uninstall_error')).toBeInTheDocument();
    });

    it('updates the progress bar only for GitManager-sourced progress events while installing', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            ...mockGitStatus(notInstalled),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '2.44.0', filename: 'Git-2.44.0.exe', version_text: '2.44.0', label: 'Git 2.44.0' }] }),
            install_git: vi.fn().mockReturnValue(new Promise(() => {})),
        });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.install_git');
        await user.click(screen.getByText('tools.git.install_git'));
        await screen.findByText('Git 2.44.0');
        await user.click(screen.getByText('tools.git.install_engine'));

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'ApacheManager', percent: 99, text: 'wrong module' } }));
        });
        expect(screen.queryByText('wrong module')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('vylo_progress', { detail: { source: 'GitManager', percent: 60, text: 'Extracting Git...' } }));
        });
        expect(await screen.findByText('Extracting Git...')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('opens the install modal via the empty-state action button, and cannot submit when no versions are available', async () => {
        const user = userEvent.setup();
        const install = vi.fn();
        mockPywebviewApi({
            ...mockGitStatus(notInstalled),
            get_available_git_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            install_git: install,
        });
        renderWithToast(<GitMain />);
        expect(await screen.findByText('tools.git.not_installed_title')).toBeInTheDocument();

        await user.click(screen.getByText('tools.git.download_git_now'));
        await screen.findByText('tools.git.error_fetching');
        await user.click(screen.getByText('tools.git.install_engine'));

        expect(install).not.toHaveBeenCalled();
    });

    it('selects a different git release from the version dropdown before installing', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            ...mockGitStatus(notInstalled),
            get_available_git_versions: vi.fn().mockResolvedValue({
                status: 'success',
                data: [
                    { value: '2.44.0', filename: 'Git-2.44.0.exe', version_text: '2.44.0', label: 'Git 2.44.0' },
                    { value: '2.43.0', filename: 'Git-2.43.0.exe', version_text: '2.43.0', label: 'Git 2.43.0' },
                ],
            }),
            install_git: install,
        });
        renderWithToast(<GitMain />);
        await user.click(screen.getByText('tools.git.install_git'));
        await screen.findByText('Git 2.44.0');

        await user.selectOptions(screen.getByDisplayValue('Git 2.44.0'), '1');
        await user.click(screen.getByText('tools.git.install_engine'));

        expect(install).toHaveBeenCalledWith('2.43.0', 'Git-2.43.0.exe', '2.43.0');
    });

    it('shows an empty version list when fetching available git versions reports failure', async () => {
        mockPywebviewApi({ ...mockGitStatus(notInstalled), get_available_git_versions: vi.fn().mockResolvedValue({ status: 'error' }) });
        const user = userEvent.setup();
        renderWithToast(<GitMain />);
        await user.click(screen.getByText('tools.git.install_git'));

        expect(await screen.findByText('tools.git.error_fetching')).toBeInTheDocument();
    });

    it('shows the API-provided error message when toggling PATH registration reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), toggle_git_path: vi.fn().mockResolvedValue({ status: 'error', message: 'tools.git.custom_path_error' }) });
        renderWithToast(<GitMain />);
        await screen.findByLabelText('tools.git.register_path');

        await user.click(screen.getByLabelText('tools.git.register_path'));

        expect(await screen.findByText('tools.git.custom_path_error')).toBeInTheDocument();
    });

    it('shows the API-provided error message when saving the config reports failure', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), set_git_config: vi.fn().mockResolvedValue({ status: 'error', message: 'tools.git.custom_config_error' }) });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.save_config');

        await user.click(screen.getByText('tools.git.save_config'));

        expect(await screen.findByText('tools.git.custom_config_error')).toBeInTheDocument();
    });

    it('shows a generic system-error toast when uninstalling throws', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), uninstall_git: vi.fn().mockRejectedValue(new Error('boom')) });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.uninstall_git');
        await user.click(screen.getByText('tools.git.uninstall_git'));
        await screen.findByText('tools.git.yes_uninstall');

        await user.click(screen.getByText('tools.git.yes_uninstall'));

        expect(await screen.findByText('tools.git.sys_error')).toBeInTheDocument();
    });

    it('does not crash and stops loading when fetching git status throws', async () => {
        mockPywebviewApi({
            get_git_status: vi.fn().mockRejectedValue(new Error('boom')),
            get_git_config: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
        });
        renderWithToast(<GitMain />);

        expect(await screen.findByText('tools.git.not_installed_title')).toBeInTheDocument();
    });

    it('closes the uninstall modal via its own close control without uninstalling', async () => {
        const user = userEvent.setup();
        const uninstall = vi.fn();
        mockPywebviewApi({ ...mockGitStatus(installedNotInPath), uninstall_git: uninstall });
        renderWithToast(<GitMain />);
        await screen.findByText('tools.git.uninstall_git');
        await user.click(screen.getByText('tools.git.uninstall_git'));
        await screen.findByText('tools.git.uninstall_title');

        await user.click(screen.getAllByLabelText('Close')[0]);

        expect(uninstall).not.toHaveBeenCalled();
        expect(screen.queryByText('tools.git.uninstall_title')).not.toBeInTheDocument();
    });
});
