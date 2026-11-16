import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Select from '../../../../components/Select';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';
import Tabs, { type TabItem } from '../../../../components/Tabs';
import EmptyState from '../../../../components/EmptyState';
import { type HttpResponseData, type HeaderRow, formatBytes } from '../types';

const getStatusCodeBadgeClass = (code: number): string => {
  if (code >= 200 && code < 300) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  if (code >= 400) return 'bg-red-500/20 text-red-600 dark:text-red-400';
  return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
};

export interface ApiClientWorkspaceProps {
  readonly httpMethod: string;
  readonly onMethodChange: (method: string) => void;
  readonly httpUrl: string;
  readonly onUrlChange: (url: string) => void;
  readonly httpHeaders: readonly HeaderRow[];
  readonly onAddHeader: () => void;
  readonly onRemoveHeader: (id: string) => void;
  readonly onHeaderChange: (id: string, field: 'key' | 'value', val: string) => void;
  readonly httpBody: string;
  readonly onBodyChange: (body: string) => void;
  readonly onPrettifyJson: () => void;
  readonly isSendingHttp: boolean;
  readonly onSendRequest: () => void;
  readonly httpResponse: HttpResponseData | null;
  readonly onCopy: (text: string) => void;
}

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

export default function ApiClientWorkspace({
  httpMethod,
  onMethodChange,
  httpUrl,
  onUrlChange,
  httpHeaders,
  onAddHeader,
  onRemoveHeader,
  onHeaderChange,
  httpBody,
  onBodyChange,
  onPrettifyJson,
  isSendingHttp,
  onSendRequest,
  httpResponse,
  onCopy,
}: ApiClientWorkspaceProps) {
  const { t } = useTranslation();
  const [requestTab, setRequestTab] = useState<'headers' | 'body'>('headers');
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');

  const requestTabs: ReadonlyArray<TabItem<'headers' | 'body'>> = [
    {
      value: 'headers',
      label: t('tools.webhook_inspector.tab_req_headers', 'Headers ({{count}})', {
        count: httpHeaders.length,
      }),
    },
    {
      value: 'body',
      label: t('tools.webhook_inspector.tab_req_body', 'Body (JSON / Raw)'),
    },
  ];

  const responseTabs: ReadonlyArray<TabItem<'body' | 'headers'>> = [
    {
      value: 'body',
      label: t('tools.webhook_inspector.tab_res_body', 'Response Body'),
    },
    {
      value: 'headers',
      label: t('tools.webhook_inspector.tab_res_headers', 'Response Headers ({{count}})', {
        count: Object.keys(httpResponse?.headers || {}).length,
      }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Full-Width Request Bar Card */}
      <Card
        title={t('tools.webhook_inspector.http_request_title', 'HTTP Request')}
        gridCols="grid-cols-1"
      >
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Method Select */}
          <div className="w-full sm:w-36 shrink-0">
            <FieldLabel htmlFor="http-method-select" visuallyHidden>
              {t('tools.webhook_inspector.api_client_method', 'Method')}
            </FieldLabel>
            <Select
              id="http-method-select"
              value={httpMethod}
              onChange={onMethodChange}
              options={HTTP_METHODS}
              searchable={false}
            />
          </div>

          {/* URL Input */}
          <div className="flex-1 min-w-0 w-full">
            <FieldLabel htmlFor="http-url-input" visuallyHidden>
              {t('tools.webhook_inspector.url_label', 'Request URL')}
            </FieldLabel>
            <Input
              id="http-url-input"
              type="text"
              mono
              placeholder={t(
                'tools.webhook_inspector.api_client_url_placeholder',
                'https://api.example.com/v1/resource or http://127.0.0.1:8000/...'
              )}
              value={httpUrl}
              onChange={(e) => onUrlChange(e.target.value)}
            />
          </div>

          {/* Send Request Button */}
          <Button
            variant="primary"
            icon="send"
            loading={isSendingHttp}
            onClick={onSendRequest}
            className="w-full sm:w-auto shrink-0 justify-center"
          >
            {isSendingHttp
              ? t('tools.webhook_inspector.sending', 'Sending...')
              : t('tools.webhook_inspector.send_request', 'Send Request')}
          </Button>
        </div>
      </Card>

      {/* 2. Split Workspace: Request Builder (Left) vs Response Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Request Details (Headers & Body) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <Card
            title={t('tools.webhook_inspector.headers_label', 'Request Headers & Body')}
            gridCols="grid-cols-1"
          >
            <div className="flex flex-col gap-4">
              <Tabs
                tabs={requestTabs}
                value={requestTab}
                onChange={setRequestTab}
                className="mb-1"
              />

              {/* Request Headers Tab */}
              {requestTab === 'headers' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      {t('tools.webhook_inspector.headers_label', 'Request Headers')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="add"
                      onClick={onAddHeader}
                    >
                      {t('tools.webhook_inspector.add_header', 'Add Header')}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {httpHeaders.map((h) => (
                      <div key={h.id} className="flex gap-2 items-center">
                        <Input
                          size="sm"
                          mono
                          aria-label={t('tools.webhook_inspector.headers_key', 'Header Key')}
                          placeholder={t('tools.webhook_inspector.headers_key', 'Header Key')}
                          value={h.key}
                          onChange={(e) => onHeaderChange(h.id, 'key', e.target.value)}
                          containerClassName="flex-1"
                        />
                        <Input
                          size="sm"
                          mono
                          aria-label={t('tools.webhook_inspector.headers_value', 'Value')}
                          placeholder={t('tools.webhook_inspector.headers_value', 'Value')}
                          value={h.value}
                          onChange={(e) => onHeaderChange(h.id, 'value', e.target.value)}
                          containerClassName="flex-1"
                        />
                        <Button
                          variant="danger-ghost"
                          size="icon"
                          icon="close"
                          aria-label={t('tools.webhook_inspector.remove_header', 'Remove')}
                          onClick={() => onRemoveHeader(h.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body Tab */}
              {requestTab === 'body' && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <FieldLabel htmlFor="http-body-textarea" size="xs" tone="muted">
                      {t('tools.webhook_inspector.request_body_label', 'Request Body (JSON / Text)')}
                    </FieldLabel>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="auto_fix_high"
                      onClick={onPrettifyJson}
                    >
                      {t('tools.webhook_inspector.format_json', 'Prettify JSON')}
                    </Button>
                  </div>
                  <textarea
                    id="http-body-textarea"
                    rows={12}
                    placeholder='{"key": "value"}'
                    value={httpBody}
                    onChange={(e) => onBodyChange(e.target.value)}
                    className="w-full p-3 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Response Inspector */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <Card
            title={t('tools.webhook_inspector.response_title', 'Response')}
            gridCols="grid-cols-1"
          >
            {!httpResponse ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon="http"
                  title={t('tools.webhook_inspector.response_title', 'Response')}
                  description={t(
                    'tools.webhook_inspector.no_response_yet',
                    'Send a request to see the response status, latency, headers, and body here.'
                  )}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Status Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded ${getStatusCodeBadgeClass(httpResponse.status_code)}`}
                    >
                      {httpResponse.status_code} {httpResponse.reason}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('tools.webhook_inspector.latency', 'Latency')}:
                      </span>{' '}
                      {httpResponse.elapsed_ms} ms
                    </div>
                    <div>•</div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('tools.webhook_inspector.size', 'Size')}:
                      </span>{' '}
                      {formatBytes(httpResponse.size_bytes)}
                    </div>
                  </div>
                </div>

                {/* Tabs for Body & Headers */}
                <Tabs
                  tabs={responseTabs}
                  value={responseTab}
                  onChange={setResponseTab}
                  className="mb-1"
                />

                {/* Body View */}
                {responseTab === 'body' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="content_copy"
                        onClick={() => onCopy(httpResponse.body)}
                      >
                        {t('tools.webhook_inspector.copy_body', 'Copy Body')}
                      </Button>
                    </div>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg whitespace-pre-wrap font-mono text-xs max-h-[460px] overflow-auto select-text">
                      {httpResponse.body || t('tools.webhook_inspector.empty_response_body', '(Empty response body)')}
                    </pre>
                  </div>
                )}

                {/* Headers View */}
                {responseTab === 'headers' && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-[460px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700 w-1/3">
                            {t('tools.webhook_inspector.header_key', 'Header Key')}
                          </th>
                          <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700">
                            {t('tools.webhook_inspector.header_value', 'Value')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        {Object.entries(httpResponse.headers || {}).map(([k, v]) => (
                          <tr key={k} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-1.5 px-3 font-medium text-primary break-all">{k}</td>
                            <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 break-all">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
