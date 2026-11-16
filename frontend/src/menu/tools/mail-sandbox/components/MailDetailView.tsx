import { useTranslation } from 'react-i18next';
import Tabs, { type TabItem } from '../../../../components/Tabs';
import Button from '../../../../components/Button';
import EmptyState from '../../../../components/EmptyState';
import SkeletonDocument from '../../../../components/skeleton/SkeletonDocument';
import { type EmailDetail, formatBytes, formatDate } from '../types';

export type MailDetailTab = 'html' | 'text' | 'headers' | 'raw';

export interface MailDetailViewProps {
  readonly selectedEmail: EmailDetail | null;
  readonly isLoadingDetail: boolean;
  readonly activeTab: MailDetailTab;
  readonly onTabChange: (tab: MailDetailTab) => void;
  readonly onExportEml: () => void;
  readonly onDelete: (e: React.MouseEvent, id: string) => void;
  readonly onCopy: (text: string) => void;
}

export default function MailDetailView({
  selectedEmail,
  isLoadingDetail,
  activeTab,
  onTabChange,
  onExportEml,
  onDelete,
  onCopy,
}: MailDetailViewProps) {
  const { t } = useTranslation();

  const detailTabs: ReadonlyArray<TabItem<'html' | 'text' | 'headers' | 'raw'>> = [
    { value: 'html', label: t('tools.mail_sandbox.tab_html', 'HTML Preview') },
    { value: 'text', label: t('tools.mail_sandbox.tab_text', 'Plain Text') },
    { value: 'headers', label: t('tools.mail_sandbox.tab_headers', 'Headers & Attachments') },
    { value: 'raw', label: t('tools.mail_sandbox.tab_raw', 'Raw MIME') },
  ];

  if (!selectedEmail && !isLoadingDetail) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-12 text-center">
        <EmptyState
          icon="mail"
          title={t(
            'tools.mail_sandbox.select_message_prompt',
            'Select an email from the left list to inspect its content and headers.'
          )}
        />
      </div>
    );
  }

  if (isLoadingDetail) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm">
        <SkeletonDocument />
      </div>
    );
  }

  if (!selectedEmail) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 flex flex-col gap-5 shadow-sm">
      {/* Header Meta */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white break-words">
            {selectedEmail.subject || t('tools.mail_sandbox.no_subject', '(No Subject)')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.mail_sandbox.from', 'From')}:
              </span>{' '}
              {selectedEmail.sender}
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.mail_sandbox.to', 'To')}:
              </span>{' '}
              {selectedEmail.to?.join(', ') || selectedEmail.recipients?.join(', ') || '-'}
            </div>
            {selectedEmail.cc && selectedEmail.cc.length > 0 && (
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('tools.mail_sandbox.cc', 'CC')}:
                </span>{' '}
                {selectedEmail.cc.join(', ')}
              </div>
            )}
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.mail_sandbox.date', 'Date')}:
              </span>{' '}
              {formatDate(selectedEmail.timestamp)}
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('tools.mail_sandbox.size', 'Size')}:
              </span>{' '}
              {formatBytes(selectedEmail.size_bytes)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={onExportEml}
          >
            {t('tools.mail_sandbox.download_eml', 'Export .eml')}
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            icon="delete"
            onClick={(e) => onDelete(e, selectedEmail.id)}
          >
            {t('tools.mail_sandbox.delete', 'Delete Email')}
          </Button>
        </div>
      </div>

      {/* Detail Tabs */}
      <Tabs
        tabs={detailTabs}
        value={activeTab}
        onChange={onTabChange}
        className="mb-2"
      />

      {/* Tab Contents */}
      {activeTab === 'html' && (
        <div className="flex flex-col gap-2">
          {selectedEmail.html_body && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                icon="content_copy"
                onClick={() => onCopy(selectedEmail.html_body)}
              >
                {t('tools.mail_sandbox.copy_html', 'Copy HTML')}
              </Button>
            </div>
          )}
          <iframe
            title="HTML Preview"
            sandbox="allow-same-origin"
            srcDoc={
              selectedEmail.html_body ||
              `<p style="color:#64748b;font-family:sans-serif;padding:24px;text-align:center;">${t(
                'tools.mail_sandbox.no_html_content',
                '(No HTML content)'
              )}</p>`
            }
            className="w-full h-[520px] border border-slate-200 dark:border-slate-700 rounded-lg bg-white"
          />
        </div>
      )}

      {activeTab === 'text' && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon="content_copy"
              onClick={() => onCopy(selectedEmail.text_body)}
            >
              {t('tools.mail_sandbox.copy_content', 'Copy Content')}
            </Button>
          </div>
          <pre className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg whitespace-pre-wrap font-mono text-xs max-h-[500px] overflow-auto select-text text-slate-800 dark:text-slate-200">
            {selectedEmail.text_body || t('tools.mail_sandbox.no_text_content', '(No plain text content)')}
          </pre>
        </div>
      )}

      {activeTab === 'headers' && (
        <div className="flex flex-col gap-6">
          {/* Attachments Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">attachment</span>
              <span>
                {t('tools.mail_sandbox.attachments', 'Attachments')} ({selectedEmail.attachments?.length || 0})
              </span>
            </h4>
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedEmail.attachments.map((att) => (
                  <div
                    key={att.filename}
                    className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {att.filename}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {att.content_type} • {formatBytes(att.size_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                {t('tools.mail_sandbox.no_attachments', 'No attachments')}
              </p>
            )}
          </div>

          {/* Headers Table */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>{t('tools.mail_sandbox.headers_section_title', 'Headers')}</span>
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700 w-1/3">
                      {t('tools.mail_sandbox.header_key', 'Header Key')}
                    </th>
                    <th className="py-2 px-3 font-semibold border-b border-slate-200 dark:border-slate-700">
                      {t('tools.mail_sandbox.header_value', 'Value')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {Object.entries(selectedEmail.headers || {}).map(([k, v]) => (
                    <tr key={k} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-1.5 px-3 font-medium text-primary break-all">{k}</td>
                      <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300 break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'raw' && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon="content_copy"
              onClick={() => onCopy(selectedEmail.raw_source)}
            >
              {t('tools.mail_sandbox.copy_content', 'Copy Content')}
            </Button>
          </div>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg whitespace-pre-wrap font-mono text-xs max-h-[500px] overflow-auto select-text">
            {selectedEmail.raw_source}
          </pre>
        </div>
      )}
    </div>
  );
}
