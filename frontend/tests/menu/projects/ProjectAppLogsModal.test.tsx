import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '../../test-utils';
import { renderWithToast } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import ProjectAppLogsModal from '../../../src/menu/projects/ProjectAppLogsModal';

const mockProject = {
  id: 'proj_laravel_1',
  name: 'Laravel Blog',
  domain: 'laravel.local',
  path: 'C:/www/laravel-blog',
};

const mockLogFiles = {
  status: 'success',
  log_files: [
    {
      path: 'storage/logs/laravel.log',
      name: 'laravel.log',
      size_bytes: 2048,
      mtime: 1700000000000,
    },
    {
      path: 'storage/logs/worker.log',
      name: 'worker.log',
      size_bytes: 1024,
      mtime: 1699999000000,
    },
  ],
};

const mockLogLines = {
  status: 'success',
  lines: [
    '[2026-11-14 10:00:00] local.INFO: Application booted successfully.',
    '[2026-11-14 10:05:00] local.ERROR: Database connection timeout.',
    '[2026-11-14 10:08:00] local.WARNING: Disk space low.',
  ],
  offset: 512,
  size_bytes: 512,
};

describe('ProjectAppLogsModal Component', () => {
  beforeEach(() => {
    (window as any).pywebview = {
      api: {
        list_project_log_files: vi.fn().mockResolvedValue(mockLogFiles),
        get_project_app_logs: vi.fn().mockResolvedValue(mockLogLines),
        clear_project_app_log: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.project.log_cleared',
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).pywebview;
  });

  it('does not render when isOpen is false', () => {
    renderWithToast(
      <ProjectAppLogsModal isOpen={false} onClose={vi.fn()} project={mockProject} />
    );

    expect(screen.queryByText(/Application Logs/i)).not.toBeInTheDocument();
  });

  it('renders modal, loads file list and tail logs when open', async () => {
    renderWithToast(
      <ProjectAppLogsModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Application Logs — Laravel Blog/i)).toBeInTheDocument();
      expect(screen.getByText(/Application booted successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
      expect(screen.getByText(/Disk space low/i)).toBeInTheDocument();
    });
  });

  it('filters log lines by severity chip', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectAppLogsModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
    });

    // Click ERROR filter chip
    const errorChip = screen.getByRole('button', { name: 'ERROR' });
    await user.click(errorChip);

    await waitFor(() => {
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
      expect(screen.queryByText(/Application booted successfully/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Disk space low/i)).not.toBeInTheDocument();
    });
  });

  it('filters log lines by search text', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectAppLogsModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search log output...');
    await user.type(searchInput, 'Disk');

    await waitFor(() => {
      expect(screen.getByText(/Disk space low/i)).toBeInTheDocument();
      expect(screen.queryByText(/Database connection timeout/i)).not.toBeInTheDocument();
    });
  });

  it('toggles pause and resume stream', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectAppLogsModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    });

    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    await user.click(pauseBtn);

    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('clears log file after confirmation', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectAppLogsModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear log/i })).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /clear log/i });
    await user.click(clearBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Clear' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.clear_project_app_log).toHaveBeenCalledWith(
        'proj_laravel_1',
        'storage/logs/laravel.log'
      );
    });
  });
});
