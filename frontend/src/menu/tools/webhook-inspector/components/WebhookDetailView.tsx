import { useTranslation } from 'react-i18next';
import Tabs, { type TabItem } from '../../../../components/Tabs';
import Button from '../../../../components/Button';
import EmptyState from '../../../../components/EmptyState';
import {
  type WebhookDetail,
  formatBytes,
  formatDate,
  getMethodBadgeClass,
} from '../types';

export type CatcherDetailTab = 'body' | 'headers' | 'query';

const getFormattedBody = (webhook: WebhookDetail, emptyText: string): string => {
  if (!webhook.body) return emptyText;
  if (webhook.is_json) return JSON.stringify(webhook.json_data, null, 2);
  return webhook.body;
};

export interface WebhookDetailViewProps {
  readonly selectedWebhook: WebhookDetail | null;
  readonly catcherDetailTab: CatcherDetailTab;
  readonly onTabChange: (tab: CatcherDetailTab) => void;
  readonly onReplayInClient: (webhook: WebhookDetail) => void;
  readonly onCopy: (text: string) => void;
}

export default function WebhookDetailView({
  selectedWebhook,
  catcherDetailTab,
  onTabChange,
  onReplayInClient,
  onCopy,
}: WebhookDetailViewProps) {
  const { t } = useTranslation();

  const catcherTabs: ReadonlyArray<TabItem<'body' | 'headers' | 'query'>> = [
    { value: 'body', label: t('tools.webhook_inspector.tab_body', 'Request Body') },
    { value: 'headers', label: t('tools.webhook_inspector.tab_headers', 'Headers') },
    { value: 'query', label: t('tools.webhook_inspector.tab_query', 'Query Params') },
  ];

  if (!selectedWebhook) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-12 text-center">
        <EmptyState
          icon="receipt_long"
          title={t(
            'tools.webhook_inspector.select_webhook_prompt',
            'Select a captured request to view headers, query parameters, and payload.'
          )}
        />
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 flex flex-col gap-5 shadow-sm">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded border ${getMethodBadgeClass(
                selectedWebhook.method
              )}`}
            >
              {selectedWebhook.method}
            </span>
            <h3 className="text-lg font-mono font-semibold text-slate-900 dark:text-white break-all">
              {selectedWebhook.path}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.webhook_inspector.client_ip', 'Client IP')}:
              </span>{' '}
              {selectedWebhook.client_ip}
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.webhook_inspector.timestamp', 'Timestamp')}:
              </span>{' '}
              {formatDate(selectedWebhook.timestamp)}
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.webhook_inspector.size', 'Size')}:
              </span>{' '}
              {formatBytes(selectedWebhook.size_bytes)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon="send"
            onClick={() => onReplayInClient(selectedWebhook)}
          >
            {t('tools.webhook_inspector.replay_in_client', 'Replay in API Client')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={catcherTabs}
        value={catcherDetailTab}
        onChange={onTabChange}
        className="mb-2"
      />

      {/* Tab Contents */}
      {catcherDetailTab === 'body' && (
        <div className="flex flex-col gap-2">
          {selectedWebhook.body && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                icon="content_copy"
                onClick={() => onCopy(selectedWebhook.body)}
              >
                {t('tools.webhook_inspector.copy_body', 'Copy Body')}
              </Button>
            </div>
          )}
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg whitespace-pre-wrap font-mono text-xs max-h-[500px] overflow-auto select-text">
            {getFormattedBody(selectedWebhook, t('tools.webhook_inspector.empty_body', '(Empty body)') as string)}
          </pre>
        </div>
      )}

      {catcherDetailTab === 'headers' && (
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
              {Object.entries(selectedWebhook.headers || {}).map(([k, v]) => (
                <tr key={k} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-1.5 px-3 font-medium text-primary break-all">{k}</td>
                  <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {catcherDetailTab === 'query' && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-[460px] overflow-y-auto">
          {Object.keys(selectedWebhook.query_params || {}).length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500 italic">
              {t('tools.webhook_inspector.no_query_params', 'No query parameters')}
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700 w-1/3">
                    {t('tools.webhook_inspector.param_key', 'Param Key')}
                  </th>
                  <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700">
                    {t('tools.webhook_inspector.param_value', 'Value')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {Object.entries(selectedWebhook.query_params).map(([k, v]) => (
                  <tr key={k} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-1.5 px-3 font-medium text-primary break-all">{k}</td>
                    <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 break-all">
                      {String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
