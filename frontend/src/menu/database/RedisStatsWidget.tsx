import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface RedisStatsWidgetProps {
    readonly dbId: string;
    readonly isRunning: boolean;
    readonly refreshTrigger?: number;
}

export default function RedisStatsWidget({ dbId, isRunning, refreshTrigger }: RedisStatsWidgetProps) {
    const { t } = useTranslation();
    const [stats, setStats] = useState<{
        used_memory_human?: string;
        clients?: number;
        total_keys?: number;
    } | null>(null);

    const loadStats = useCallback(async () => {
        if (!isRunning) {
            setStats(null);
            return;
        }
        try {
            const api = (window as any).pywebview?.api;
            if (!api?.get_redis_stats) return;
            const res = await api.get_redis_stats(dbId);
            if (res?.status === 'success' && res.stats) {
                setStats(res.stats);
            }
        } catch {
            // best effort
        }
    }, [dbId, isRunning]);

    useEffect(() => {
        loadStats();
    }, [loadStats, refreshTrigger]);

    if (!isRunning || !stats) return null;

    return (
        <div className="col-span-2 md:col-span-3 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[13px] text-primary">memory</span>
                {t('database.redis_memory', 'Memory')}: {stats.used_memory_human || '—'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[13px] text-emerald-500">group</span>
                {t('database.redis_clients', 'Clients')}: {stats.clients ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[13px] text-amber-500">key</span>
                {t('database.redis_keys', 'Keys')}: {stats.total_keys ?? '—'}
            </span>
        </div>
    );
}
