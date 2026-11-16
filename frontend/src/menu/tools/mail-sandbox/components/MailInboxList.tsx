import { useTranslation } from 'react-i18next';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';
import FilterChips, { type FilterChipItem } from '../../../../components/FilterChips';
import Button from '../../../../components/Button';
import EmptyState from '../../../../components/EmptyState';
import { type EmailSummary, formatBytes, formatDate } from '../types';

export interface MailInboxListProps {
  readonly messages: readonly EmailSummary[];
  readonly filteredMessages: readonly EmailSummary[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (e: React.MouseEvent, id: string) => void;
  readonly onClearAllClick: () => void;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly filterMode: 'all' | 'unread';
  readonly onFilterChange: (mode: 'all' | 'unread') => void;
  readonly currentPort: number;
}

export default function MailInboxList({
  messages,
  filteredMessages,
  selectedId,
  onSelect,
  onDelete,
  onClearAllClick,
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterChange,
  currentPort,
}: MailInboxListProps) {
  const { t } = useTranslation();

  const filterItems: ReadonlyArray<FilterChipItem<'all' | 'unread'>> = [
    {
      id: 'all',
      label: t('tools.mail_sandbox.filter_all', 'All'),
      count: messages.length,
      icon: 'inbox',
    },
    {
      id: 'unread',
      label: t('tools.mail_sandbox.filter_unread', 'Unread'),
      count: messages.filter((m) => !m.is_read).length,
      icon: 'mark_email_unread',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Search Bar with clear button */}
      <FieldLabel htmlFor="mail-search-input" visuallyHidden>
        {t('tools.mail_sandbox.search_placeholder', 'Search subject, sender, or content...')}
      </FieldLabel>
      <Input
        id="mail-search-input"
        type="text"
        size="sm"
        leftIcon="search"
        placeholder={t('tools.mail_sandbox.search_placeholder', 'Search subject, sender, or content...')}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange('')}
        clearLabel={t('tools.mail_sandbox.clear_search', 'Clear search')}
      />

      {/* Filter Chips & Clear Action Header */}
      <div className="flex items-center justify-between gap-2">
        <FilterChips
          items={filterItems}
          selectedId={filterMode}
          onChange={onFilterChange}
          ariaLabel={t('tools.mail_sandbox.filter_all', 'Filter options')}
          className="min-w-0 flex-1"
        />
        {messages.length > 0 && (
          <Button
            variant="danger-ghost"
            size="sm"
            icon="delete_sweep"
            onClick={onClearAllClick}
            className="shrink-0"
          >
            {t('tools.mail_sandbox.clear_all', 'Clear Inbox')}
          </Button>
        )}
      </div>

      {/* Messages Scroll Box */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[620px] overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon="inbox"
              title={t('tools.mail_sandbox.inbox_empty_title', 'Inbox is Empty')}
              description={t(
                'tools.mail_sandbox.inbox_empty_desc',
                'Configure your local app to connect to 127.0.0.1:{{port}} and sent emails will appear here.',
                { port: currentPort }
              )}
            />
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSelected = msg.id === selectedId;
            return (
              <div
                key={msg.id}
                className={`flex items-stretch transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border-l-4 border-primary'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {/* Main clickable area for selection */}
                <button
                  type="button"
                  onClick={() => onSelect(msg.id)}
                  className="flex-1 min-w-0 p-3.5 text-left flex flex-col gap-1.5 focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!msg.is_read && (
                        <span
                          className="w-2 h-2 rounded-full bg-primary shrink-0"
                          title={t('tools.mail_sandbox.badge_unread', 'UNREAD')}
                        />
                      )}
                      <span
                        className={`text-xs truncate ${
                          !msg.is_read
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {msg.sender || 'unknown'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {formatDate(msg.timestamp)}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate w-full">
                    {msg.subject || t('tools.mail_sandbox.no_subject', '(No Subject)')}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 w-full">
                    {msg.snippet || '...'}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <span>{formatBytes(msg.size_bytes)}</span>
                    {msg.attachments_count > 0 && (
                      <span className="flex items-center gap-0.5 text-slate-500 font-medium">
                        <span className="material-symbols-outlined text-[13px]">attach_file</span>
                        {msg.attachments_count}
                      </span>
                    )}
                  </div>
                </button>

                {/* Sibling Delete button (no nested buttons!) */}
                <button
                  type="button"
                  onClick={(e) => onDelete(e, msg.id)}
                  className="px-3 text-slate-400 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center shrink-0"
                  title={t('tools.mail_sandbox.delete', 'Delete Email')}
                  aria-label={t('tools.mail_sandbox.delete', 'Delete Email')}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
