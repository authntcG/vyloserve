import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';

export interface SkeletonCardProps {
    readonly count?: number;
    readonly gridCols?: string;
    readonly cardGridCols?: string;
    readonly hasActionButtons?: boolean;
    readonly hasActions?: boolean;
    readonly className?: string;
}

export default function SkeletonCard({
    count = 1,
    gridCols = 'grid-cols-2 md:grid-cols-3',
    cardGridCols,
    hasActionButtons = true,
    hasActions,
    className = ''
}: Readonly<SkeletonCardProps>) {
    const { t } = useTranslation();
    const showActions = hasActions ?? hasActionButtons;

    const renderCard = (key?: number) => {
        const innerGrid = cardGridCols || (count > 1 ? 'grid-cols-2' : gridCols);
        return (
            <div
                key={key}
                role="status"
                aria-busy="true"
                aria-live="polite"
                className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex flex-col gap-4 motion-reduce:animate-none animate-pulse ${className}`}
            >
                <span className="sr-only">{t('common.loading')}</span>
                <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="w-16 h-6 rounded-full" />
                </div>
                <div className={`grid ${innerGrid} gap-y-4 gap-x-3 w-full`}>
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="flex flex-col gap-2 col-span-2 md:col-span-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
                {showActions && (
                    <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Skeleton className="h-9 rounded-lg flex-1" />
                        <Skeleton className="h-9 rounded-lg flex-1" />
                    </div>
                )}
            </div>
        );
    };

    if (count > 1) {
        return (
            <div className={`grid ${gridCols} gap-4 w-full`}>
                {Array.from({ length: count }).map((_, idx) => renderCard(idx))}
            </div>
        );
    }

    return renderCard();
}
