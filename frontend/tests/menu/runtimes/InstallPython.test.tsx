import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import InstallPython, { type InstallPythonRef } from '../../../src/menu/runtimes/InstallPython';
import { describeRuntimeInstallSuite } from './installRuntimeTestKit';

describeRuntimeInstallSuite({
    label: 'InstallPython',
    Component: InstallPython,
    fetchMethod: 'get_available_python_versions',
    installMethod: 'install_python',
    versionLabel: 'runtimes.python_version',
    successKey: 'runtimes.python_install_success',
    errorKey: 'runtimes.python_install_error',
});

describe('InstallPython (unique behavior)', () => {
    it('defaults pip to enabled and forwards it when unchecked before installing', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_available_python_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '3.12', label: 'v3.12' }] }),
            install_python: install,
        });
        const ref = createRef<InstallPythonRef>();
        renderWithToast(<InstallPython ref={ref} />);
        await screen.findByText('v3.12');

        await user.click(screen.getByText('runtimes.advanced_settings'));
        const pipCheckbox = screen.getByRole('checkbox', { name: 'runtimes.install_pip' });
        expect(pipCheckbox).toBeChecked();
        await user.click(pipCheckbox);

        await act(async () => ref.current!.submit());

        expect(install).toHaveBeenCalledWith('3.12', false);
    });

    it('does not attempt to install and resolves false when the version list is empty', async () => {
        const install = vi.fn();
        mockPywebviewApi({
            get_available_python_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            install_python: install,
        });
        const ref = createRef<InstallPythonRef>();
        renderWithToast(<InstallPython ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(install).not.toHaveBeenCalled();
    });
});
