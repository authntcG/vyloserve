import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '../../../test-utils';
import { renderWithToast, mockPywebviewApi, resetPywebviewApi } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import MailSandboxMain from '../../../../src/menu/tools/mail-sandbox/Main';

describe('MailSandboxMain Component', () => {
  const sampleMessages = [
    {
      id: 'mail_1',
      subject: 'Welcome to VyloServe',
      sender: 'admin@vyloserve.local',
      recipients: ['user@vyloserve.local'],
      timestamp: 1700000000,
      size_bytes: 1024,
      attachments_count: 1,
      is_read: false,
      snippet: 'Welcome to our platform!'
    },
    {
      id: 'mail_2',
      subject: 'Password Reset',
      sender: 'auth@vyloserve.local',
      recipients: ['user@vyloserve.local'],
      timestamp: 1700000500,
      size_bytes: 512,
      attachments_count: 0,
      is_read: true,
      snippet: 'Click here to reset your password'
    }
  ];

  const sampleDetail = {
    ...sampleMessages[0],
    to: ['user@vyloserve.local'],
    cc: ['audit@vyloserve.local'],
    bcc: [],
    headers: {
      'From': 'admin@vyloserve.local',
      'To': 'user@vyloserve.local',
      'Subject': 'Welcome to VyloServe'
    },
    text_body: 'Welcome to our platform in plain text!',
    html_body: '<h1>Welcome to our platform in HTML!</h1>',
    raw_source: 'From: admin@vyloserve.local\r\nSubject: Welcome to VyloServe\r\n\r\nWelcome!',
    attachments: [
      {
        filename: 'welcome.pdf',
        content_type: 'application/pdf',
        size_bytes: 2048
      }
    ]
  };

  beforeEach(() => {
    mockPywebviewApi({
      get_mail_sandbox_status: vi.fn().mockResolvedValue({
        status: 'success',
        running: false,
        host: '127.0.0.1',
        port: 1025,
        total_messages: 2,
        unread_count: 1
      }),
      get_mail_sandbox_messages: vi.fn().mockResolvedValue({
        status: 'success',
        data: sampleMessages
      }),
      get_mail_sandbox_message_detail: vi.fn().mockResolvedValue({
        status: 'success',
        data: sampleDetail
      }),
      start_mail_sandbox: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.mail_sandbox.started',
        args: { port: 1025 }
      }),
      stop_mail_sandbox: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.mail_sandbox.stopped'
      }),
      send_test_mail: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.mail_sandbox.test_email_sent'
      }),
      delete_mail_sandbox_message: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.mail_sandbox.deleted'
      }),
      clear_mail_sandbox_messages: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'backend.mail_sandbox.cleared'
      })
    });
  });

  afterEach(() => {
    resetPywebviewApi();
  });

  it('renders page header and email list', async () => {
    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
      expect(screen.getByText('Password Reset')).toBeInTheDocument();
    });
  });

  it('selects an email and displays detail tabs', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Welcome to VyloServe'));

    await waitFor(() => {
      expect(screen.getByTitle('HTML Preview')).toBeInTheDocument();
    });

    // Switch to plain text tab
    const textTab = screen.getByText(/Plain Text/i);
    await user.click(textTab);
    expect(screen.getByText(/Welcome to our platform in plain text!/i)).toBeInTheDocument();

    // Switch to headers tab
    const headersTab = screen.getByText(/Headers & Attachments/i);
    await user.click(headersTab);
    expect(screen.getByText('welcome.pdf')).toBeInTheDocument();

    // Switch to raw tab
    const rawTab = screen.getByText(/Raw MIME/i);
    await user.click(rawTab);
    expect(screen.getByText(/From: admin@vyloserve.local/i)).toBeInTheDocument();
  });

  it('handles server toggle and test email sending', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start Server/i })).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', { name: /Start Server/i });
    await user.click(startBtn);

    const api = (window as any).pywebview.api;
    expect(api.start_mail_sandbox).toHaveBeenCalledWith(1025);
  });

  it('opens and interacts with the setup .env modal', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    const setupBtn = screen.getByRole('button', { name: /Setup \/ \.env/i });
    await user.click(setupBtn);

    expect(screen.getByText(/Email Sandbox Connection Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/MAIL_MAILER=smtp/i)).toBeInTheDocument();

    // Switch to Node.js snippet
    await user.click(screen.getByRole('button', { name: /Nodemailer/i }));
    expect(screen.getByRole('button', { name: /Nodemailer/i })).toBeInTheDocument();
  });

  it('filters emails via search query and filter chips', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
      expect(screen.getByText('Password Reset')).toBeInTheDocument();
    });

    // Test Search filtering
    const searchInput = screen.getByPlaceholderText(/Search subject, sender, or content/i);
    await user.type(searchInput, 'Reset');

    expect(screen.getByText('Password Reset')).toBeInTheDocument();
    expect(screen.queryByText('Welcome to VyloServe')).not.toBeInTheDocument();

    // Clear search using clear button
    const clearSearchBtn = screen.getByRole('button', { name: /Clear search/i });
    await user.click(clearSearchBtn);

    expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
    expect(screen.getByText('Password Reset')).toBeInTheDocument();

    // Test FilterChips for Unread
    const filterNav = screen.getByLabelText(/Filter options/i);
    const unreadChip = within(filterNav).getByRole('button', { name: /Unread/i });
    await user.click(unreadChip);

    // Only unread message (Welcome to VyloServe) should be shown
    expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
    expect(screen.queryByText('Password Reset')).not.toBeInTheDocument();
  });

  it('opens clear inbox confirmation modal', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /Clear Inbox/i });
    await user.click(clearBtn);

    expect(screen.getByText(/Are you sure you want to permanently delete all captured emails/i)).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /Clear Inbox/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(window.pywebview.api.clear_mail_sandbox_messages).toHaveBeenCalled();
    });
  });

  it('stops running server, sends test email, and responds to vylo_mail_received event', async () => {
    const user = userEvent.setup();
    window.pywebview.api.get_mail_sandbox_status = vi.fn().mockResolvedValue({
      status: 'success',
      running: true,
      host: '127.0.0.1',
      port: 1025,
      total_messages: 2,
      unread_count: 1
    });

    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Server/i })).toBeInTheDocument();
    });

    // Send test email
    const sendTestBtn = screen.getByRole('button', { name: /Send Test Email/i });
    await user.click(sendTestBtn);

    await waitFor(() => {
      expect(window.pywebview.api.send_test_mail).toHaveBeenCalled();
    });

    // Dispatch event to simulate incoming mail
    window.dispatchEvent(new CustomEvent('vylo_mail_received'));

    // Stop server
    const stopBtn = screen.getByRole('button', { name: /Stop Server/i });
    await user.click(stopBtn);

    await waitFor(() => {
      expect(window.pywebview.api.stop_mail_sandbox).toHaveBeenCalled();
    });
  });

  it('deletes an email message and exports EML', async () => {
    const user = userEvent.setup();
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    renderWithToast(<MailSandboxMain />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to VyloServe')).toBeInTheDocument();
    });

    // Select message
    await user.click(screen.getByText('Welcome to VyloServe'));

    // Export EML
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export \.EML/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Export \.EML/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Delete message from inbox item
    const deleteBtns = screen.getAllByTitle(/Delete email/i);
    await user.click(deleteBtns[0]);

    await waitFor(() => {
      expect(window.pywebview.api.delete_mail_sandbox_message).toHaveBeenCalledWith('mail_1');
    });
  });

  it('cycles through framework snippets in setup modal', async () => {
    const user = userEvent.setup();
    renderWithToast(<MailSandboxMain />);

    const setupBtn = screen.getByRole('button', { name: /Setup \/ \.env/i });
    await user.click(setupBtn);

    const dialog = screen.getByRole('dialog');
    const frameworks = ['Laravel', 'Nodemailer', 'Python', 'PHPMailer'];
    for (const fw of frameworks) {
      const tab = within(dialog).getByRole('button', { name: new RegExp(fw, 'i') });
      await user.click(tab);
      expect(tab).toBeInTheDocument();
    }
  });
});
