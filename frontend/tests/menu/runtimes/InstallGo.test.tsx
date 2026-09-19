import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '../../test-utils';
import { renderWithToast } from '../../test-utils';
import InstallGo, { type InstallGoRef } from '../../../src/menu/runtimes/InstallGo';
import { describeRuntimeInstallSuite } from './installRuntimeTestKit';

describeRuntimeInstallSuite({
    label: 'InstallGo',
    Component: InstallGo,
    fetchMethod: 'get_available_go_versions',
    installMethod: 'install_go',
    versionLabel: 'runtimes.go_version',
    successKey: 'runtimes.go_install_success',
    errorKey: 'runtimes.go_install_error',
});

// installRuntimeTestKit's shared suite doesn't cover this component's own JSX (it only
// exercises the fetch/install lifecycle common to all four engines), so this file also
// needs a directly-visible test of its own for the fixed windows/amd64 note below.
describe('InstallGo (unique behavior)', () => {
    it('shows the fixed windows/amd64 architecture note', () => {
        renderWithToast(<InstallGo ref={createRef<InstallGoRef>()} />);

        expect(screen.getByText('windows/amd64')).toBeInTheDocument();
    });
});
