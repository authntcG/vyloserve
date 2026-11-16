export interface EmailSummary {
  readonly id: string;
  readonly subject: string;
  readonly sender: string;
  readonly recipients: readonly string[];
  readonly timestamp: number;
  readonly size_bytes: number;
  readonly attachments_count: number;
  readonly is_read: boolean;
  readonly snippet: string;
}

export interface EmailAttachment {
  readonly filename: string;
  readonly content_type: string;
  readonly size_bytes: number;
}

export interface EmailDetail extends EmailSummary {
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
  readonly headers: Record<string, string>;
  readonly text_body: string;
  readonly html_body: string;
  readonly raw_source: string;
  readonly attachments: readonly EmailAttachment[];
}

export interface MailSandboxStatus {
  readonly running: boolean;
  readonly host: string;
  readonly port: number;
  readonly total_messages: number;
  readonly unread_count: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
}
