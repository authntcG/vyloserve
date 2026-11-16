import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import PortManagerMain from '../../../../src/menu/tools/port-manager/Main';

describe('PortManagerMain Component', () => {
  const mockPorts = [
    {
      port: 8080,
      protocol: 'TCP',
      local_address: '127.0.0.1',
      pid: 4321,
      process_name: 'node.exe',
      exe_path: 'C:\\Node\\node.exe',
      cmdline: 'node server.js',
      memory_mb: 45.2,
      is_protected: false,
      is_vylo_managed: false,
    },
    {
      port: 135,
      protocol: 'TCP',
      local_address: '0.0.0.0',
      pid: 4,
      process_name: 'System',
      exe_path: '',
      cmdline: '',
      memory_mb: 0.0,
      is_protected: true,
      is_vylo_managed: false,
    },
    {
      port: 3306,
      protocol: 'TCP',
      local_address: '127.0.0.1',
      pid: 9988,
      process_name: 'mariadbd.exe',
      exe_path: 'D:\\vyloserve\\bin\\mariadbd.exe',
      cmdline: 'mariadbd',
      memory_mb: 78.5,
      is_protected: false,
      is_vylo_managed: true,
    },
  ];

  beforeEach(() => {
    (window as any).pywebview = {
      api: {
        get_listening_ports: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockPorts,
        }),
        kill_process_by_pid: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.port_manager.killed_success',
        }),
      },
    };
  });

  it('renders listening ports and displays process details', async () => {
    renderWithToast(<PortManagerMain />);

    await waitFor(() => {
      expect(screen.getByText(':8080')).toBeInTheDocument();
      expect(screen.getByText(':135')).toBeInTheDocument();
      expect(screen.getByText(':3306')).toBeInTheDocument();
    });

    expect(screen.getByText('node.exe')).toBeInTheDocument();
    expect(screen.getAllByText('System').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('mariadbd.exe')).toBeInTheDocument();
  });

  it('opens confirmation modal and terminates non-protected process', async () => {
    const user = userEvent.setup();
    renderWithToast(<PortManagerMain />);

    await waitFor(() => {
      expect(screen.getByText(':8080')).toBeInTheDocument();
    });

    // Find and click the Kill button for node.exe
    const killButtons = screen.getAllByRole('button', { name: /kill/i });
    expect(killButtons.length).toBeGreaterThan(0);
    await user.click(killButtons[0]);

    // Modal should appear with Terminate Process
    await waitFor(() => {
      expect(screen.getByText('Terminate Process')).toBeInTheDocument();
    });

    // Confirm kill
    const confirmButton = screen.getByRole('button', { name: 'Kill Process' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect((window as any).pywebview.api.kill_process_by_pid).toHaveBeenCalledWith(4321, false);
    });
  });

  it('filters ports using search input', async () => {
    const user = userEvent.setup();
    renderWithToast(<PortManagerMain />);

    await waitFor(() => {
      expect(screen.getByText(':8080')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search port/i);
    await user.type(searchInput, 'mariadb');

    await waitFor(() => {
      expect(screen.getByText(':3306')).toBeInTheDocument();
      expect(screen.queryByText(':8080')).not.toBeInTheDocument();
    });
  });
});
