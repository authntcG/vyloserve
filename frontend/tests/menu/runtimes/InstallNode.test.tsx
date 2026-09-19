import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import InstallNode, { type InstallNodeRef } from '../../../src/menu/runtimes/InstallNode';
import { describeRuntimeInstallSuite } from './installRuntimeTestKit';

describeRuntimeInstallSuite({
    label: 'InstallNode',
    Component: InstallNode,
    fetchMethod: 'get_available_node_versions',
    installMethod: 'install_node',
    versionLabel: 'runtimes.node_version',
    successKey: 'runtimes.node_install_success',
    errorKey: 'runtimes.node_install_error',
});

describe('InstallNode (unique behavior)', () => {
    it('defaults corepack to enabled and forwards it when unchecked before installing', async () => {
        const user = userEvent.setup();
        const install = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_available_node_versions: vi.fn().mockResolvedValue({ status: 'success', data: [{ value: '20', label: 'v20' }] }),
            install_node: install,
        });
        const ref = createRef<InstallNodeRef>();
        renderWithToast(<InstallNode ref={ref} />);
        await screen.findByText('v20');

        await user.click(screen.getByText('runtimes.advanced_settings'));
        const corepackCheckbox = screen.getByRole('checkbox', { name: 'runtimes.enable_corepack' });
        expect(corepackCheckbox).toBeChecked();
        await user.click(corepackCheckbox);

        await act(async () => ref.current!.submit());

        expect(install).toHaveBeenCalledWith('20', false);
    });
});
