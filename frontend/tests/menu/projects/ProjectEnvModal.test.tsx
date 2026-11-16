import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '../../test-utils';
import { renderWithToast } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import ProjectEnvModal from '../../../src/menu/projects/ProjectEnvModal';

const mockProject = {
  id: 'proj_laravel_1',
  name: 'Laravel Pro',
  domain: 'laravel.local',
  path: 'C:/www/laravel-pro',
};

const mockEnvDetails = {
  status: 'success',
  has_env: true,
  has_example: true,
  env_content: 'APP_NAME=Laravel\nAPP_ENV=local\nDB_PASSWORD=secret123\n',
  parsed_env: [
    { key: 'APP_NAME', value: 'Laravel', is_sensitive: false, line_no: 1 },
    { key: 'APP_ENV', value: 'local', is_sensitive: false, line_no: 2 },
    { key: 'DB_PASSWORD', value: 'secret123', is_sensitive: true, line_no: 3 },
  ],
  missing_keys: [
    { key: 'MAIL_HOST', example_value: 'smtp.mailtrap.io', is_sensitive: false },
  ],
};

const mockSnapshots = {
  status: 'success',
  snapshots: [
    {
      id: '20261114_120000.env.bak',
      created_at: '2026-11-14 12:00:00',
      timestamp_ms: 1700000000000,
      size_bytes: 64,
    },
  ],
};

describe('ProjectEnvModal Component', () => {
  beforeEach(() => {
    (window as any).pywebview = {
      api: {
        get_project_env_details: vi.fn().mockResolvedValue(mockEnvDetails),
        list_project_env_snapshots: vi.fn().mockResolvedValue(mockSnapshots),
        save_project_env: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.project.env_saved',
        }),
        sync_project_env_example_keys: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.project.env_saved',
        }),
        restore_project_env_snapshot: vi.fn().mockResolvedValue({
          status: 'success',
          message: 'backend.project.env_restored',
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).pywebview;
  });

  it('does not render when isOpen is false', () => {
    renderWithToast(
      <ProjectEnvModal isOpen={false} onClose={vi.fn()} project={mockProject} />
    );

    expect(screen.queryByText(/Environment \(\.env\) Manager/i)).not.toBeInTheDocument();
  });

  it('renders modal and loads env details when open', async () => {
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Environment \(\.env\) Manager — Laravel Pro/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
      expect(screen.getByDisplayValue('local')).toBeInTheDocument();
    });

    // Sensitive DB_PASSWORD should have type="password"
    const dbPasswordInput = screen.getByLabelText('Value for DB_PASSWORD');
    expect(dbPasswordInput).toHaveAttribute('type', 'password');
  });

  it('toggles password reveal for sensitive variable', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Value for DB_PASSWORD')).toHaveAttribute('type', 'password');
    });

    const showButton = screen.getByTitle('Show sensitive value');
    await user.click(showButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Value for DB_PASSWORD')).toHaveAttribute('type', 'text');
    });
  });

  it('filters variables with search query', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search environment keys...');
    await user.type(searchInput, 'DB_');

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Laravel')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Value for DB_PASSWORD')).toBeInTheDocument();
    });
  });

  it('switches to Raw Editor tab and displays content in textarea', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
    });

    const rawTab = screen.getByRole('button', { name: 'Raw Editor' });
    await user.click(rawTab);

    await waitFor(() => {
      const textarea = screen.getByLabelText('Raw .env Content');
      expect(textarea).toHaveValue('APP_NAME=Laravel\nAPP_ENV=local\nDB_PASSWORD=secret123\n');
    });
  });

  it('switches to Diff tab and syncs missing keys', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
    });

    const diffTab = screen.getByRole('button', { name: /\.env\.example Diff/i });
    await user.click(diffTab);

    await waitFor(() => {
      expect(screen.getByText('MAIL_HOST')).toBeInTheDocument();
      expect(screen.getByText('smtp.mailtrap.io')).toBeInTheDocument();
    });

    const syncBtn = screen.getByRole('button', { name: /sync missing keys to \.env/i });
    await user.click(syncBtn);

    await waitFor(() => {
      expect(
        (window as any).pywebview.api.sync_project_env_example_keys
      ).toHaveBeenCalledWith('proj_laravel_1', null);
    });
  });

  it('switches to Vault Snapshots tab and displays backups', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
    });

    const vaultTab = screen.getByRole('button', { name: 'Vault Snapshots' });
    await user.click(vaultTab);

    await waitFor(() => {
      expect(screen.getByText('2026-11-14 12:00:00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    });

    const restoreBtn = screen.getByRole('button', { name: 'Restore' });
    await user.click(restoreBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.restore_project_env_snapshot).toHaveBeenCalledWith(
        'proj_laravel_1',
        '20261114_120000.env.bak'
      );
    });
  });

  it('adds a new variable, updates an inline value, deletes a variable, and saves', async () => {
    const user = userEvent.setup();
    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Laravel')).toBeInTheDocument();
    });

    // Add new variable
    const keyInput = screen.getByPlaceholderText('NEW_KEY_NAME');
    const valInput = screen.getByPlaceholderText('value...');
    await user.type(keyInput, 'CUSTOM_TOKEN');
    await user.type(valInput, 'tok_12345');

    const addBtn = screen.getByRole('button', { name: 'add' });
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('CUSTOM_TOKEN')).toBeInTheDocument();
    });

    // Change value inline
    const appNameInput = screen.getByLabelText('Value for APP_NAME');
    await user.clear(appNameInput);
    await user.type(appNameInput, 'VyloApp');

    // Delete variable
    const deleteBtns = screen.getAllByTitle('Delete variable');
    await user.click(deleteBtns[0]); // Delete APP_ENV or DB_PASSWORD

    // Save changes
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.save_project_env).toHaveBeenCalled();
    });
  });

  it('handles empty env file state and initializes .env', async () => {
    const user = userEvent.setup();
    (window as any).pywebview.api.get_project_env_details = vi.fn().mockResolvedValue({
      status: 'success',
      has_env: false,
      has_example: false,
      env_content: '',
      parsed_env: [],
      missing_keys: [],
    });

    renderWithToast(
      <ProjectEnvModal isOpen={true} onClose={vi.fn()} project={mockProject} />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create \.env File/i })).toBeInTheDocument();
    });

    const initBtn = screen.getByRole('button', { name: /Create \.env File/i });
    await user.click(initBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.save_project_env).toHaveBeenCalled();
    });
  });
});
