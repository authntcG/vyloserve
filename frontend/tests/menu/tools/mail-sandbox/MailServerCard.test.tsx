import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import MailServerCard from '../../../../src/menu/tools/mail-sandbox/components/MailServerCard';
import type { MailSandboxStatus } from '../../../../src/menu/tools/mail-sandbox/types';

describe('MailServerCard', () => {
  const stoppedStatus: MailSandboxStatus = {
    running: false,
    host: '127.0.0.1',
    port: 1025,
    total_messages: 0,
    unread_count: 0,
  };

  const runningStatus: MailSandboxStatus = {
    running: true,
    host: '127.0.0.1',
    port: 2525,
    total_messages: 8,
    unread_count: 3,
  };

  it('renders stopped state and triggers port input change, toggle server, and endpoint copy', async () => {
    const user = userEvent.setup();
    const handlePortChange = vi.fn();
    const handleToggleServer = vi.fn();
    const handleSendTest = vi.fn();
    const handleCopy = vi.fn();

    renderWithToast(
      <MailServerCard
        status={stoppedStatus}
        portInput={1025}
        onPortChange={handlePortChange}
        isStarting={false}
        onToggleServer={handleToggleServer}
        isSendingTest={false}
        onSendTest={handleSendTest}
        onCopy={handleCopy}
      />
    );

    expect(screen.getByText(/stopped|tools\.mail_sandbox\.status_stopped/i)).toBeInTheDocument();

    // Port input change
    const portInput = screen.getByLabelText(/port/i);
    fireEvent.change(portInput, { target: { value: '2525' } });
    expect(handlePortChange).toHaveBeenCalledWith(2525);

    // Toggle server button
    const toggleBtn = screen.getByRole('button', { name: /start server|tools\.mail_sandbox\.start/i });
    await user.click(toggleBtn);
    expect(handleToggleServer).toHaveBeenCalledTimes(1);

    // Endpoint copy button
    const copyBtn = screen.getByRole('button', { name: /copy endpoint|tools\.mail_sandbox\.copy_endpoint/i });
    await user.click(copyBtn);
    expect(handleCopy).toHaveBeenCalledWith('127.0.0.1:1025');

    // Send test email button is disabled when stopped
    const sendBtn = screen.getByRole('button', { name: /send test|tools\.mail_sandbox\.send_test/i });
    expect(sendBtn).toBeDisabled();
  });

  it('renders running state with unread badge and triggers send test email', async () => {
    const user = userEvent.setup();
    const handlePortChange = vi.fn();
    const handleToggleServer = vi.fn();
    const handleSendTest = vi.fn();
    const handleCopy = vi.fn();

    renderWithToast(
      <MailServerCard
        status={runningStatus}
        portInput={2525}
        onPortChange={handlePortChange}
        isStarting={false}
        onToggleServer={handleToggleServer}
        isSendingTest={false}
        onSendTest={handleSendTest}
        onCopy={handleCopy}
      />
    );

    expect(screen.getByText(/listening|tools\.mail_sandbox\.status_running/i)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();

    // Send test email button is enabled and triggers callback
    const sendBtn = screen.getByRole('button', { name: /send test|tools\.mail_sandbox\.send_test/i });
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);
    expect(handleSendTest).toHaveBeenCalledTimes(1);
  });
});
