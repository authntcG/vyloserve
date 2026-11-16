import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '../../test-utils';
import { renderWithToast } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import ProjectSslHostsModal from '../../../src/menu/projects/ProjectSslHostsModal';

const mockOverviewData = {
  status: 'success',
  ca: {
    installed: true,
    cert_exists: true,
    cert_path: 'C:/vyloserve/data/ssl/VyloServeRootCA.crt',
    name: 'VyloServe Local Root CA',
  },
  hosts: {
    path: 'C:\\Windows\\System32\\drivers\\etc\\hosts',
    exists: true,
    is_writable: false,
    entries: [
      {
        id: 'proj_1',
        name: 'Laravel Blog',
        domain: 'laravel.test',
        target_ip: '127.0.0.1',
        is_mapped: true,
      },
      {
        id: 'proj_2',
        name: 'React App',
        domain: 'react.test',
        target_ip: '127.0.0.1',
        is_mapped: false,
      },
    ],
  },
};

describe('ProjectSslHostsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).pywebview = {
      api: {
        get_ssl_hosts_overview: vi.fn().mockResolvedValue(mockOverviewData),
        reinstall_root_ca: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.ssl.ca_trusted_success',
        }),
        sync_all_hosts: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.project.hosts_all_synced',
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).pywebview;
  });

  it('renders modal with trusted CA status and project host domains', async () => {
    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('VyloServe Local Root CA')).toBeInTheDocument();
      expect(screen.getByText('Trusted by OS')).toBeInTheDocument();
      expect(screen.getByText('laravel.test')).toBeInTheDocument();
      expect(screen.getByText('react.test')).toBeInTheDocument();
      expect(screen.getByText('Mapped')).toBeInTheDocument();
      expect(screen.getByText('Not Mapped')).toBeInTheDocument();
      // Verifies the overview status summary badge
      expect(screen.getByText(/needs_sync|Needs Sync/i)).toBeInTheDocument();
    });

    // Verifies single close button in modal footer alongside refresh (not duplicate close)
    const modalFooter = document.querySelector('.rounded-b-xl');
    expect(modalFooter).not.toBeNull();
    const footerButtons = modalFooter?.querySelectorAll('button');
    expect(footerButtons?.length).toBe(2); // Refresh and Close
    const closeButtons = Array.from(footerButtons || []).filter((b) => b.textContent?.includes('Close'));
    expect(closeButtons).toHaveLength(1);
  });

  it('copies certificate path to clipboard when clicking copy path button', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('VyloServe Local Root CA')).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle(/Copy Path/i);
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith('C:/vyloserve/data/ssl/VyloServeRootCA.crt');
  });

  it('displays untrusted badge when Root CA is not installed', async () => {
    (window as any).pywebview.api.get_ssl_hosts_overview.mockResolvedValueOnce({
      ...mockOverviewData,
      ca: { ...mockOverviewData.ca, installed: false },
    });

    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Not Trusted')).toBeInTheDocument();
    });
  });

  it('triggers reinstall_root_ca on clicking Trust CA button', async () => {
    const user = userEvent.setup();
    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Trust / Re-install CA')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Trust / Re-install CA'));

    expect((window as any).pywebview.api.reinstall_root_ca).toHaveBeenCalledTimes(1);
  });

  it('triggers sync_all_hosts on clicking Sync Hosts button', async () => {
    const user = userEvent.setup();
    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Sync All Domains to Hosts')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync All Domains to Hosts'));

    expect((window as any).pywebview.api.sync_all_hosts).toHaveBeenCalledTimes(1);
  });

  it('calls fetchOverview when clicking Refresh button', async () => {
    const user = userEvent.setup();
    renderWithToast(<ProjectSslHostsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Refresh'));

    expect((window as any).pywebview.api.get_ssl_hosts_overview).toHaveBeenCalledTimes(2);
  });
});
