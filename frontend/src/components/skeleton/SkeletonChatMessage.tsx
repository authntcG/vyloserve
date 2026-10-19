import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';

export interface SkeletonChatMessageProps {
    readonly className?: string;
}

export default function SkeletonChatMessage({ className = '' }: Readonly<SkeletonChatMessageProps>) {
    const { t } = useTranslation();

    return (
        <div role="status" aria-busy="true" aria-live="polite" className={`flex items-start gap-3 w-full max-w-2xl ${className}`}>
            <span className="sr-only">{t('ai.thinking')}</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary animate-spin">sync</span>
            </div>
            <div className="flex flex-col gap-2 p-4 rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 w-full shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vylo Assistant</span>
                    <span className="text-[11px] text-primary font-medium animate-pulse">{t('ai.thinking')}</span>
                </div>
                <Skeleton className="h-3.5 w-full rounded" />
                <Skeleton className="h-3.5 w-4/5 rounded" />
                <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
        </div>
    );
}
