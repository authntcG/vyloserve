import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';

export interface SkeletonDocumentProps {
    readonly className?: string;
}

export default function SkeletonDocument({ className = '' }: Readonly<SkeletonDocumentProps>) {
    const { t } = useTranslation();

    return (
        <div role="status" aria-busy="true" aria-live="polite" className={`flex flex-col gap-5 p-6 max-w-4xl mx-auto w-full ${className}`}>
            <span className="sr-only">{t('common.loading')}</span>
            {/* Document Title */}
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <div className="flex gap-3 mb-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
            </div>
            {/* Paragraph 1 */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-11/12 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
            </div>
            {/* Code Block Placeholder */}
            <Skeleton className="h-32 w-full rounded-xl bg-slate-100 dark:bg-slate-800/80 my-2" />
            {/* Paragraph 2 */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
            </div>
        </div>
    );
}
