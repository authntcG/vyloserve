import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '../../../test-utils';
import { renderWithToast, mockPywebviewApi, resetPywebviewApi } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import WebhookInspectorMain from '../../../../src/menu/tools/webhook-inspector/Main';

describe('WebhookInspectorMain Component', () => {
  const sampleHistory = [
    {
      id: 'wh_1',
      method: 'POST',
      path: '/api/v1/orders',
      client_ip: '192.168.1.100',
      timestamp: 1700000000,
      size_bytes: 120,
      is_json: true,
      query_count: 1,
      header_count: 3,
      snippet: '{"order_id": 999}'
    },
    {
      id: 'wh_2',
      method: 'GET',
      path: '/api/v1/health',
      client_ip: '127.0.0.1',
      timestamp: 1700000500,
      size_bytes: 0,
      is_json: false,
      query_count: 0,
      header_count: 2,
      snippet: ''
    }
  ];

  const sampleDetail = {
    ...sampleHistory[0],
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': 'sha256=abcdef'
    },
    query_params: {
      'ref': 'mobile'
    },
    body: '{"order_id": 999, "amount": 250000}',
    json_data: { order_id: 999, amount: 250000 }
  };

  beforeEach(() => {
    mockPywebviewApi({
      get_webhook_inspector_status: vi.fn().mockResolvedValue({
        status: 'success',
        running: false,
        host: '127.0.0.1',
        port: 8787,
        total_captured: 2,
        tunnel_active: false,
        tunnel_url: '',
        response_config: { status_code: 200, content_type: 'application/json', body: '{"status": "ok"}' }
      }),
      get_webhook_history: vi.fn().mockResolvedValue({
        status: 'success',
        data: sampleHistory
      }),
      get_webhook_detail: vi.fn().mockResolvedValue({
        status: 'success',
        data: sampleDetail
      }),
      start_webhook_listener: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.started',
        args: { port: 8787 }
      }),
      stop_webhook_listener: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.stopped'
      }),
      start_webhook_public_tunnel: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.tunnel_started',
        url: 'https://test.trycloudflare.com'
      }),
      stop_webhook_public_tunnel: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.tunnel_stopped'
      }),
      send_sample_webhook: vi.fn().mockResolvedValue({
        status: 'success'
      }),
      set_webhook_response_config: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.config_updated'
      }),
      clear_webhook_history: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.webhook.cleared'
      }),
      send_http_request: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          status_code: 200,
          reason: 'OK',
          elapsed_ms: 45.2,
          size_bytes: 84,
          headers: { 'Content-Type': 'application/json' },
          body: '{"id": 1, "title": "Mock Post"}',
          is_json: true
        }
      })
    });
  });

  afterEach(() => {
    resetPywebviewApi();
  });

  it('renders catcher and history list', async () => {
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
      expect(screen.getByText('/api/v1/health')).toBeInTheDocument();
    });
  });

  it('selects a webhook and displays detail tabs', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    });

    await user.click(screen.getByText('/api/v1/orders'));

    await waitFor(() => {
      expect(screen.getByText(/250000/)).toBeInTheDocument();
    });

    // Check Headers tab
    await user.click(screen.getByText(/^Headers$/i));
    expect(screen.getByText('sha256=abcdef')).toBeInTheDocument();

    // Check Query Params tab
    await user.click(screen.getByText(/Query Params/i));
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('replays webhook in API client tab', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    });

    await user.click(screen.getByText('/api/v1/orders'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Replay in API Client/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Replay in API Client/i }));

    // Should switch to API Client tab with populated URL
    await waitFor(() => {
      const urlInput = screen.getByLabelText(/URL/i) as HTMLInputElement;
      expect(urlInput.value).toContain('/api/v1/orders');
    });
  });

  it('sends HTTP request in API Client tab and displays response', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    // Switch to API Client tab
    await user.click(screen.getByRole('button', { name: /^API Client$/i }));

    const sendBtn = screen.getByRole('button', { name: /Send Request/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('200 OK')).toBeInTheDocument();
      expect(screen.getByText(/Mock Post/i)).toBeInTheDocument();
      expect(screen.getByText(/45.2 ms/i)).toBeInTheDocument();
    });
  });

  it('filters webhooks via search query and method chips', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
      expect(screen.getByText('/api/v1/health')).toBeInTheDocument();
    });

    // Test Search input
    const searchInput = screen.getByPlaceholderText(/Search path, IP, or payload/i);
    await user.type(searchInput, 'health');

    expect(screen.getByText('/api/v1/health')).toBeInTheDocument();
    expect(screen.queryByText('/api/v1/orders')).not.toBeInTheDocument();

    // Clear search using clear button
    const clearSearchBtn = screen.getByRole('button', { name: /Clear search/i });
    await user.click(clearSearchBtn);

    expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/health')).toBeInTheDocument();

    // Test Method Filter Chip for POST
    const filterNav = screen.getByLabelText(/Filter options/i);
    const postChip = within(filterNav).getByRole('button', { name: /POST/i });
    await user.click(postChip);

    expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    expect(screen.queryByText('/api/v1/health')).not.toBeInTheDocument();
  });

  it('opens clear history confirmation modal', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /Clear History/i });
    await user.click(clearBtn);

    expect(screen.getByText(/Are you sure you want to clear all captured webhook requests/i)).toBeInTheDocument();

    // Confirm clearing inside dialog
    const modalDialog = screen.getByRole('dialog');
    const confirmBtn = within(modalDialog).getByRole('button', { name: /Clear History/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(window.pywebview.api.clear_webhook_history).toHaveBeenCalled();
    });
  });

  it('starts and stops the webhook listener and handles tunnel toggle', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText(/Start Listener/i)).toBeInTheDocument();
    });

    // Start listener
    const toggleListenerBtn = screen.getByRole('button', { name: /Start Listener/i });
    await user.click(toggleListenerBtn);

    await waitFor(() => {
      expect(window.pywebview.api.start_webhook_listener).toHaveBeenCalledWith(8787);
    });

    // Update status to running with tunnel active
    window.pywebview.api.get_webhook_inspector_status = vi.fn().mockResolvedValue({
      status: 'success',
      running: true,
      host: '127.0.0.1',
      port: 8787,
      total_captured: 2,
      tunnel_active: false,
      tunnel_url: '',
      response_config: { status_code: 200, content_type: 'application/json', body: '{"status": "ok"}' }
    });

    // Trigger vylo_webhook_received to reload status
    window.dispatchEvent(new CustomEvent('vylo_webhook_received'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Listener/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expose Publicly/i })).toBeInTheDocument();
    });

    // Toggle public tunnel
    const tunnelBtn = screen.getByRole('button', { name: /Expose Publicly/i });
    await user.click(tunnelBtn);

    await waitFor(() => {
      expect(window.pywebview.api.start_webhook_public_tunnel).toHaveBeenCalled();
    });

    // Send sample webhook
    const sampleBtn = screen.getByRole('button', { name: /Send Sample Webhook/i });
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(window.pywebview.api.send_sample_webhook).toHaveBeenCalled();
    });

    // Stop listener
    const stopListenerBtn = screen.getByRole('button', { name: /Stop Listener/i });
    await user.click(stopListenerBtn);

    await waitFor(() => {
      expect(window.pywebview.api.stop_webhook_listener).toHaveBeenCalled();
    });
  });

  it('configures webhook response in modal', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Response Setup/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Response Setup/i }));

    expect(screen.getByText(/Configure Webhook Auto-Response/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Response Config/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(window.pywebview.api.set_webhook_response_config).toHaveBeenCalled();
    });
  });

  it('manages headers and prettifies json in API Client workspace', async () => {
    const user = userEvent.setup();
    renderWithToast(<WebhookInspectorMain />);

    await user.click(screen.getByRole('button', { name: /^API Client$/i }));

    // Validation error when URL is empty
    const urlInput = screen.getByPlaceholderText(/api\.example\.com/i);
    await user.clear(urlInput);
    const sendBtn = screen.getByRole('button', { name: /Send Request/i });
    await user.click(sendBtn);

    // API should not be called with empty URL
    expect(window.pywebview.api.send_http_request).not.toHaveBeenCalled();

    // Add a header
    const addHeaderBtn = screen.getByRole('button', { name: /Add Header/i });
    await user.click(addHeaderBtn);

    const headerKeys = screen.getAllByPlaceholderText(/Header Key/i);
    const lastHeaderKey = headerKeys[headerKeys.length - 1];
    await user.type(lastHeaderKey, 'Authorization');
    expect(lastHeaderKey).toHaveValue('Authorization');

    // Switch to body tab and prettify
    const bodyTab = screen.getByRole('button', { name: /Body \(JSON \/ Raw\)/i });
    await user.click(bodyTab);

    const bodyTextarea = screen.getByPlaceholderText('{"key": "value"}');
    fireEvent.change(bodyTextarea, { target: { value: '{"test":1}' } });

    const prettifyBtn = screen.getByRole('button', { name: /Prettify JSON/i });
    await user.click(prettifyBtn);
    expect((bodyTextarea as HTMLTextAreaElement).value).toBe('{\n  "test": 1\n}');

    // Click remove header
    const headersTab = screen.getByRole('button', { name: /Headers/i });
    await user.click(headersTab);
    const removeBtns = screen.getAllByRole('button', { name: /Remove/i });
    const initialHeaderCount = removeBtns.length;
    await user.click(removeBtns[0]);
    expect(screen.getAllByRole('button', { name: /Remove/i })).toHaveLength(initialHeaderCount - 1);
  });

  it('copies webhook URLs and curls properly', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderWithToast(<WebhookInspectorMain />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/orders')).toBeInTheDocument();
    });

    // Copy local url
    const copyLocalBtn = screen.getByTitle(/Copy Webhook URL/i);
    await user.click(copyLocalBtn);
    expect(writeTextSpy).toHaveBeenCalled();

    // Select webhook to show detail tabs
    await user.click(screen.getByText('/api/v1/orders'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy Body/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Copy Body/i }));
    expect(writeTextSpy).toHaveBeenCalled();
  });
});
