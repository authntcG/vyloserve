import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiAssistant } from '../../../../context/AiContext';
import Button from '../../../../components/Button';

export interface AiUsageBadgeProps {
    readonly compact?: boolean;
    readonly className?: string;
}

export function formatTokens(num?: number): string {
    if (!num || num < 0) return '0';
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}k`;
    }
    return String(num);
}

export default function AiUsageBadge({ compact = false, className = '' }: AiUsageBadgeProps) {
    const { t } = useTranslation();
    const { usageStats, refreshUsageStats, resetUsageStats, activeProvider } = useAiAssistant();
    const [isOpen, setIsOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const todayTokens = usageStats?.today?.total_tokens || 0;
    const todayRequests = usageStats?.today?.requests || 0;
    const weekTokens = usageStats?.week?.total_tokens || 0;
    const weekRequests = usageStats?.week?.requests || 0;
    const rateLimits = usageStats?.rate_limits;

    // Handle outside click to close popover
    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshUsageStats();
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleReset = async () => {
        setIsOpen(false);
        await resetUsageStats();
    };

    return (
        <div ref={popoverRef} className={`relative inline-flex items-center ${className}`}>
            {compact ? (
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    title={t('ai.usage_today', { tokens: formatTokens(todayTokens) })}
                    aria-label={t('ai.token_usage', 'Token Usage')}
                    aria-expanded={isOpen}
                    className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-center cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[18px]">data_usage</span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    title={t('ai.token_usage', 'Token Usage')}
                    aria-label={t('ai.token_usage', 'Token Usage')}
                    aria-expanded={isOpen}
                    className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                    <span className="material-symbols-outlined text-[16px] text-primary">data_usage</span>
                    <span>{formatTokens(todayTokens)} {t('ai.tokens', 'Tokens')}</span>
                </button>
            )}

            {/* POPOVER DIALOG */}
            {isOpen && (
                <div
                    role="dialog"
                    aria-label={t('ai.token_usage', 'Token Usage')}
                    className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 m-0 block"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-primary">data_usage</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {t('ai.token_usage', 'Token Usage')}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {activeProvider}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                title={t('common.refresh', 'Refresh')}
                                aria-label={t('common.refresh', 'Refresh')}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                            >
                                <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                                    sync
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                title={t('ai.close', 'Close')}
                                aria-label={t('ai.close', 'Close')}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats List */}
                    <div className="py-3 space-y-2.5 text-xs">
                        {/* Today */}
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-1 border border-slate-100 dark:border-slate-800/80">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {t('common.today', 'Today')}
                                </span>
                                <span className="font-mono font-bold text-primary">
                                    {todayTokens.toLocaleString()} {t('ai.tokens', 'Tokens')}
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{t('ai.requests_count', { count: todayRequests })}</span>
                                <span>
                                    {usageStats?.today?.prompt_tokens?.toLocaleString() || 0} in / {usageStats?.today?.completion_tokens?.toLocaleString() || 0} out
                                </span>
                            </div>
                        </div>

                        {/* This Week */}
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-1 border border-slate-100 dark:border-slate-800/80">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {t('common.this_week', 'This Week')}
                                </span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {weekTokens.toLocaleString()} {t('ai.tokens', 'Tokens')}
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{t('ai.requests_count', { count: weekRequests })}</span>
                                <span>
                                    {usageStats?.week?.prompt_tokens?.toLocaleString() || 0} in / {usageStats?.week?.completion_tokens?.toLocaleString() || 0} out
                                </span>
                            </div>
                        </div>

                        {/* Provider Rate Limits (if present) */}
                        {rateLimits && Object.keys(rateLimits).length > 0 && (
                            <div className="p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/70 text-[10px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                                <div className="font-sans font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-1">
                                    Provider Quota / Rate Limits
                                </div>
                                {Object.entries(rateLimits).slice(0, 3).map(([key, val]) => (
                                    <div key={key} className="flex justify-between truncate">
                                        <span className="truncate">{key.replace(/^x-ratelimit-/, '')}:</span>
                                        <span className="font-bold shrink-0">{String(val)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer / Reset Button */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <Button
                            variant="danger-ghost"
                            size="sm"
                            icon="delete_sweep"
                            onClick={handleReset}
                            className="text-xs w-full justify-center"
                        >
                            {t('ai.reset_usage', 'Reset Usage')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
