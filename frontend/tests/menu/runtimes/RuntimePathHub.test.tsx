import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import RuntimePathHub from '../../../src/menu/runtimes/RuntimePathHub';
import { type EngineData } from '../../../src/context/RuntimesContext';

describe('RuntimePathHub', () => {
    const mockData: EngineData = {
        installed: true,
        version: '20.18.0',
        in_path: true,
        active_version: '20.18.0',
        external: { exists: false, path: '', version: '' },
        installed_versions: [
            { version: '20.18.0', path: 'C:/bin/node/20.18.0', subtool: 'npm v10', is_active: true, in_path: true },
            { version: '18.17.0', path: 'C:/bin/node/18.17.0', subtool: 'npm v9', is_active: false, in_path: false },
        ],
    };

    it('renders orchestration title, active in path badge, and toggle switch', () => {
        render(
            <RuntimePathHub
                engine="node"
                engineTitle="Node.js"
                data={mockData}
                isProcessing={false}
                pathDescKey="runtimes.node_path_desc"
                onTogglePath={vi.fn()}
                onSetActiveVersion={vi.fn()}
            />
        );

        expect(screen.getByText('runtimes.path_orchestration_title')).toBeInTheDocument();
        expect(screen.getByTestId('path-hub-status-badge')).toHaveTextContent('runtimes.active_in_path');
        const toggle = screen.getByLabelText('runtimes.register_path');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toBeChecked();
    });

    it('calls onTogglePath when switch is toggled', async () => {
        const user = userEvent.setup();
        const togglePath = vi.fn();
        render(
            <RuntimePathHub
                engine="node"
                engineTitle="Node.js"
                data={mockData}
                isProcessing={false}
                pathDescKey="runtimes.node_path_desc"
                onTogglePath={togglePath}
                onSetActiveVersion={vi.fn()}
            />
        );

        const toggle = screen.getByLabelText('runtimes.register_path');
        await user.click(toggle);
        expect(togglePath).toHaveBeenCalledWith(false);
    });

    it('selects active version and triggers onSetActiveVersion when another version is chosen', async () => {
        const user = userEvent.setup();
        const setActive = vi.fn();
        render(
            <RuntimePathHub
                engine="node"
                engineTitle="Node.js"
                data={mockData}
                isProcessing={false}
                pathDescKey="runtimes.node_path_desc"
                onTogglePath={vi.fn()}
                onSetActiveVersion={setActive}
            />
        );

        // Click the select dropdown via its accessible label
        const selectTrigger = screen.getByLabelText('runtimes.active_system_version');
        expect(selectTrigger).toHaveTextContent('Node.js 20.18.0');
        await user.click(selectTrigger);

        // Click the option for 18.17.0
        const option18 = await screen.findByRole('option', { name: /Node\.js 18\.17\.0/i });
        await user.click(option18);

        expect(setActive).toHaveBeenCalledWith('18.17.0');
    });

    it('locks toggle and select when external installation is detected', () => {
        const externalData: EngineData = {
            ...mockData,
            external: { exists: true, path: 'C:/Program Files/nodejs/node.exe', version: '22.0.0' },
        };

        render(
            <RuntimePathHub
                engine="node"
                engineTitle="Node.js"
                data={externalData}
                isProcessing={false}
                pathDescKey="runtimes.node_path_desc"
                onTogglePath={vi.fn()}
                onSetActiveVersion={vi.fn()}
            />
        );

        expect(screen.getByTestId('path-hub-status-badge')).toHaveTextContent('runtimes.native_os');
        const toggle = screen.getByLabelText('runtimes.register_path');
        expect(toggle).toBeDisabled();

        const selectTrigger = screen.getByLabelText('runtimes.active_system_version');
        expect(selectTrigger).toBeDisabled();

        // Integrated external alert box
        const alertBox = screen.getByTestId('path-hub-external-alert');
        expect(alertBox).toBeInTheDocument();
        expect(alertBox).toHaveTextContent('C:/Program Files/nodejs/node.exe');
        expect(alertBox).toHaveTextContent('22.0.0');
        expect(alertBox).toHaveTextContent('runtimes.external_overview_title');
    });

    it('renders isolated status when in_path is false', () => {
        const isolatedData: EngineData = {
            ...mockData,
            in_path: false,
        };

        render(
            <RuntimePathHub
                engine="node"
                engineTitle="Node.js"
                data={isolatedData}
                isProcessing={false}
                pathDescKey="runtimes.node_path_desc"
                onTogglePath={vi.fn()}
                onSetActiveVersion={vi.fn()}
            />
        );

        expect(screen.getByTestId('path-hub-status-badge')).toHaveTextContent('runtimes.isolated_version');
        const toggle = screen.getByLabelText('runtimes.register_path');
        expect(toggle).not.toBeChecked();
    });
});
