import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import WebhookResponseConfigModal from '../../../../src/menu/tools/webhook-inspector/components/WebhookResponseConfigModal';
import WebhookListenerCard from '../../../../src/menu/tools/webhook-inspector/components/WebhookListenerCard';
import type { WebhookInspectorStatus } from '../../../../src/menu/tools/webhook-inspector/types';

describe('WebhookResponseConfigModal', () => {
  it('renders modal controls and handles save, close, and input changes', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    const handleStatusCodeChange = vi.fn();
    const handleContentTypeChange = vi.fn();
    const handleResponseBodyChange = vi.fn();

    const { rerender } = renderWithToast(
      <WebhookResponseConfigModal
        isOpen={false}
        onClose={handleClose}
        statusCode={200}
        onStatusCodeChange={handleStatusCodeChange}
        contentType="application/json"
        onContentTypeChange={handleContentTypeChange}
        responseBody='{"ok":true}'
        onResponseBodyChange={handleResponseBodyChange}
        onSave={handleSave}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <WebhookResponseConfigModal
        isOpen={true}
        onClose={handleClose}
        statusCode={200}
        onStatusCodeChange={handleStatusCodeChange}
        contentType="application/json"
        onContentTypeChange={handleContentTypeChange}
        responseBody='{"ok":true}'
        onResponseBodyChange={handleResponseBodyChange}
        onSave={handleSave}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Status code input change
    const statusInput = screen.getByLabelText(/tools\.webhook_inspector\.status_code|Status Code/i);
    fireEvent.change(statusInput, { target: { value: '201' } });
    expect(handleStatusCodeChange).toHaveBeenCalledWith(201);

    // Content type input change
    const ctInput = screen.getByLabelText(/tools\.webhook_inspector\.content_type|Content-Type/i);
    fireEvent.change(ctInput, { target: { value: 'text/plain' } });
    expect(handleContentTypeChange).toHaveBeenCalledWith('text/plain');

    // Response body textarea change
    const bodyInput = screen.getByLabelText(/tools\.webhook_inspector\.response_body|Response Body/i);
    fireEvent.change(bodyInput, { target: { value: 'Hello Webhook' } });
    expect(handleResponseBodyChange).toHaveBeenCalledWith('Hello Webhook');

    // Save button click
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);

    // Close button click
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('WebhookListenerCard', () => {
  const stoppedStatus: WebhookInspectorStatus = {
    running: false,
    host: '127.0.0.1',
    port: 8787,
    tunnel_active: false,
    tunnel_url: '',
    total_captured: 0,
    response_config: {
      status_code: 200,
      content_type: 'application/json',
      body: '{"ok":true}',
    },
  };

  const runningStatus: WebhookInspectorStatus = {
    running: true,
    host: '127.0.0.1',
    port: 8888,
    tunnel_active: true,
    tunnel_url: 'https://demo-webhook.trycloudflare.com',
    total_captured: 5,
    response_config: {
      status_code: 200,
      content_type: 'application/json',
      body: '{"status":"ok"}',
    },
  };

  it('renders stopped state and triggers port change, start listener, and config modal', async () => {
    const user = userEvent.setup();
    const handlePortChange = vi.fn();
    const handleToggleListener = vi.fn();
    const handleToggleTunnel = vi.fn();
    const handleSendSample = vi.fn();
    const handleOpenConfigModal = vi.fn();
    const handleCopy = vi.fn();

    renderWithToast(
      <WebhookListenerCard
        status={stoppedStatus}
        portInput={8787}
        onPortChange={handlePortChange}
        isTogglingListener={false}
        onToggleListener={handleToggleListener}
        isTogglingTunnel={false}
        onToggleTunnel={handleToggleTunnel}
        isSendingSample={false}
        onSendSample={handleSendSample}
        onOpenConfigModal={handleOpenConfigModal}
        onCopy={handleCopy}
      />
    );

    // Change port input
    const portInput = screen.getByLabelText(/port/i);
    fireEvent.change(portInput, { target: { value: '9000' } });
    expect(handlePortChange).toHaveBeenCalledWith(9000);

    // Open Response Setup modal
    const configBtn = screen.getByRole('button', { name: /response setup|tools\.webhook_inspector\.config_response/i });
    await user.click(configBtn);
    expect(handleOpenConfigModal).toHaveBeenCalledTimes(1);

    // Start listener toggle
    const toggleBtn = screen.getByRole('button', { name: /start listener|tools\.webhook_inspector\.start_listener/i });
    await user.click(toggleBtn);
    expect(handleToggleListener).toHaveBeenCalledTimes(1);

    // Copy local URL button
    const copyLocalBtn = screen.getByRole('button', { name: /copy webhook url|tools\.webhook_inspector\.copy_local_url/i });
    await user.click(copyLocalBtn);
    expect(handleCopy).toHaveBeenCalledWith('http://127.0.0.1:8787/webhook');
  });

  it('renders running state with active tunnel banner and handles tunnel toggle and sample send', async () => {
    const user = userEvent.setup();
    const handlePortChange = vi.fn();
    const handleToggleListener = vi.fn();
    const handleToggleTunnel = vi.fn();
    const handleSendSample = vi.fn();
    const handleOpenConfigModal = vi.fn();
    const handleCopy = vi.fn();

    renderWithToast(
      <WebhookListenerCard
        status={runningStatus}
        portInput={8888}
        onPortChange={handlePortChange}
        isTogglingListener={false}
        onToggleListener={handleToggleListener}
        isTogglingTunnel={false}
        onToggleTunnel={handleToggleTunnel}
        isSendingSample={false}
        onSendSample={handleSendSample}
        onOpenConfigModal={handleOpenConfigModal}
        onCopy={handleCopy}
      />
    );

    // Send sample webhook
    const sendSampleBtn = screen.getByRole('button', { name: /send sample|tools\.webhook_inspector\.send_sample/i });
    await user.click(sendSampleBtn);
    expect(handleSendSample).toHaveBeenCalledTimes(1);

    // Stop tunnel button
    const tunnelBtn = screen.getByRole('button', { name: /close tunnel|tools\.webhook_inspector\.stop_tunnel/i });
    await user.click(tunnelBtn);
    expect(handleToggleTunnel).toHaveBeenCalledTimes(1);

    // Copy public tunnel URL button
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    await user.click(copyButtons[copyButtons.length - 1]);
    expect(handleCopy).toHaveBeenCalledWith('https://demo-webhook.trycloudflare.com');
  });
});
