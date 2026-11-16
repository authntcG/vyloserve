export interface WebhookSummary {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly client_ip: string;
  readonly timestamp: number;
  readonly size_bytes: number;
  readonly is_json: boolean;
  readonly query_count: number;
  readonly header_count: number;
  readonly snippet: string;
}

export interface WebhookDetail extends WebhookSummary {
  readonly headers: Record<string, string>;
  readonly query_params: Record<string, string | string[]>;
  readonly body: string;
  readonly json_data: any;
}

export interface WebhookInspectorStatus {
  readonly running: boolean;
  readonly host: string;
  readonly port: number;
  readonly total_captured: number;
  readonly tunnel_active: boolean;
  readonly tunnel_url: string;
  readonly response_config: {
    readonly status_code: number;
    readonly content_type: string;
    readonly body: string;
  };
}

export interface HttpResponseData {
  readonly status_code: number;
  readonly reason: string;
  readonly elapsed_ms: number;
  readonly size_bytes: number;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly is_json: boolean;
}

export interface HeaderRow {
  readonly id: string;
  key: string;
  value: string;
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

export function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30';
    case 'GET':
      return 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/30';
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30';
    case 'DELETE':
      return 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/30';
  }
}
