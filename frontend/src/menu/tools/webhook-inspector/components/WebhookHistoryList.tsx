import { useTranslation } from 'react-i18next';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';
import FilterChips, { type FilterChipItem } from '../../../../components/FilterChips';
import Button from '../../../../components/Button';
import EmptyState from '../../../../components/EmptyState';
import {
  type WebhookSummary,
  formatBytes,
  formatDate,
  getMethodBadgeClass,
} from '../types';

export interface WebhookHistoryListProps {
  readonly history: readonly WebhookSummary[];
  readonly filteredHistory: readonly WebhookSummary[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClearClick: () => void;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly methodFilter: string;
  readonly onMethodFilterChange: (method: string) => void;
  readonly currentPort: number;
}

export default function WebhookHistoryList({
  history,
  filteredHistory,
  selectedId,
  onSelect,
  onClearClick,
  searchQuery,
  onSearchChange,
  methodFilter,
  onMethodFilterChange,
  currentPort,
}: WebhookHistoryListProps) {
  const { t } = useTranslation();

  const methodCounts = history.reduce<Record<string, number>>((acc, item) => {
    const m = item.method.toUpperCase();
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const filterItems: ReadonlyArray<FilterChipItem<string>> = [
    {
      id: 'ALL',
      label: t('tools.webhook_inspector.filter_all', 'All'),
      count: history.length,
    },
    {
      id: 'POST',
      label: 'POST',
      count: methodCounts['POST'] || 0,
    },
    {
      id: 'GET',
      label: 'GET',
      count: methodCounts['GET'] || 0,
    },
    {
      id: 'PUT',
      label: 'PUT',
      count: (methodCounts['PUT'] || 0) + (methodCounts['PATCH'] || 0),
    },
    {
      id: 'DELETE',
      label: 'DELETE',
      count: methodCounts['DELETE'] || 0,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <FieldLabel htmlFor="wh-search-input" visuallyHidden>
        {t('tools.webhook_inspector.search_placeholder', 'Search path, IP, or payload...')}
      </FieldLabel>
      <Input
        id="wh-search-input"
        type="text"
        size="sm"
        leftIcon="search"
        placeholder={t('tools.webhook_inspector.search_placeholder', 'Search path, IP, or payload...')}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange('')}
        clearLabel={t('tools.webhook_inspector.clear_search', 'Clear search')}
      />

      {/* Filter Chips & Clear Action Header */}
      <div className="flex items-center justify-between gap-2">
        <FilterChips
          items={filterItems}
          selectedId={methodFilter}
          onChange={onMethodFilterChange}
          ariaLabel={t('tools.webhook_inspector.filter_all', 'Filter options')}
          className="min-w-0 flex-1"
        />
        {history.length > 0 && (
          <Button
            variant="danger-ghost"
            size="sm"
            icon="delete_sweep"
            onClick={onClearClick}
            className="shrink-0"
          >
            {t('tools.webhook_inspector.clear_history', 'Clear History')}
          </Button>
        )}
      </div>

      {/* History Scroll Box */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[620px] overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon="webhook"
              title={t('tools.webhook_inspector.history_empty_title', 'No Webhooks Captured Yet')}
              description={t(
                'tools.webhook_inspector.history_empty_desc',
                'Send HTTP requests to http://127.0.0.1:{{port}} or use the public tunnel to receive webhooks from Stripe, GitHub, etc.',
                { port: currentPort }
              )}
            />
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full text-left p-3.5 flex flex-col gap-1.5 cursor-pointer transition-colors focus:outline-none ${
                  isSelected
                    ? 'bg-primary/10 border-l-4 border-primary'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded border ${getMethodBadgeClass(
                      item.method
                    )}`}
                  >
                    {item.method}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(item.timestamp)}
                  </span>
                </div>

                <div className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100 truncate w-full">
                  {item.path}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 w-full">
                  <span>{item.client_ip}</span>
                  <span>{formatBytes(item.size_bytes)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
