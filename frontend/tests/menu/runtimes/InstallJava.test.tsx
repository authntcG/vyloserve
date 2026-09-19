import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import InstallJava, { type InstallJavaRef } from '../../../src/menu/runtimes/InstallJava';
import { describeRuntimeInstallSuite } from './installRuntimeTestKit';

describeRuntimeInstallSuite({
    label: 'InstallJava',
    Component: InstallJava,
    fetchMethod: 'get_available_java_versions',
    installMethod: 'install_java',
    versionLabel: 'runtimes.java_version',
    successKey: 'runtimes.java_install_success',
    errorKey: 'runtimes.java_install_error',
});

describe('InstallJava (unique behavior)', () => {
    it('expands the JAVA_HOME advanced note when the advanced-settings toggle is clicked', async () => {
        const user = userEvent.setup();
        renderWithToast(<InstallJava ref={createRef<InstallJavaRef>()} />);

        const noteContainer = screen.getByText('JAVA_HOME').closest('p')!.parentElement!;
        expect(noteContainer.className).toContain('max-h-0');

        await user.click(screen.getByText('runtimes.advanced_settings'));

        expect(noteContainer.className).toContain('max-h-[100px]');
    });

    it('does not attempt to install and resolves false when no version could be selected', async () => {
        const install = vi.fn();
        mockPywebviewApi({
            get_available_java_versions: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            install_java: install,
        });
        const ref = createRef<InstallJavaRef>();
        renderWithToast(<InstallJava ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(install).not.toHaveBeenCalled();
    });
});
