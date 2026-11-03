import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';

export interface SkeletonFormProps {
    readonly fieldsCount?: number;
    readonly hasTabs?: boolean;
    readonly className?: string;
    readonly loadingText?: string;
}

export default function SkeletonForm({ fieldsCount = 4, hasTabs = false, className = '', loadingText }: Readonly<SkeletonFormProps>) {
    const { t } = useTranslation();

    return (
        <div role="status" aria-busy="true" aria-live="polite" className={`flex flex-col gap-6 ${className}`}>
            <span className="sr-only">{loadingText || t('common.loading')}</span>
            {hasTabs && (
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <Skeleton className="h-8 w-24 rounded-lg" />
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: fieldsCount }, (_, i) => ({ id: `field-slot-${i + 1}` })).map((slot) => (
                    <div key={slot.id} className="flex flex-col gap-2">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}
