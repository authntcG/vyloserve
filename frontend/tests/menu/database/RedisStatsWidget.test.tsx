import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '../../test-utils';
import { renderWithToast } from '../../test-utils';
import RedisStatsWidget from '../../../src/menu/database/RedisStatsWidget';

const mockRedisStats = {
  status: 'success',
  stats: {
    version: '7.0.8',
    uptime_days: 3,
    clients: 4,
    used_memory_human: '2.10M',
    total_keys: 42,
    ops_per_sec: 15,
  },
};

describe('RedisStatsWidget Component', () => {
  beforeEach(() => {
    (window as any).pywebview = {
      api: {
        get_redis_stats: vi.fn().mockResolvedValue(mockRedisStats),
      },
    };
  });

  afterEach(() => {
    delete (window as any).pywebview;
  });

  it('renders memory, clients, and total keys when running', async () => {
    renderWithToast(<RedisStatsWidget dbId="redis_1" isRunning={true} />);

    await waitFor(() => {
      expect(screen.getByText(/2\.10M/)).toBeInTheDocument();
      expect(screen.getByText(/Clients:\s*4/)).toBeInTheDocument();
      expect(screen.getByText(/Keys:\s*42/)).toBeInTheDocument();
    });
  });

  it('renders nothing when isRunning is false', () => {
    const { container } = renderWithToast(<RedisStatsWidget dbId="redis_1" isRunning={false} />);
    expect(container.querySelector('.col-span-2')).toBeNull();
    expect((window as any).pywebview.api.get_redis_stats).not.toHaveBeenCalled();
  });
});
