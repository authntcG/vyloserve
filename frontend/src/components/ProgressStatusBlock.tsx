import { useTranslation } from 'react-i18next';
import ProgressBar from './ProgressBar';

export interface ProgressStatusBlockProps {
    readonly title?: string;
    readonly progressText?: string;
    readonly progress: number;
    readonly className?: string;
    readonly onCancel?: () => void;
    readonly isCancelling?: boolean;
}

export default function ProgressStatusBlock({
    title,
    progressText,
    progress,
    className = '',
    onCancel,
    isCancelling = false
}: ProgressStatusBlockProps) {
    const { t } = useTranslation();

    return (
        <div className={`p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 ${className}`}>
            {title && (
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</span>
                </div>
            )}
            <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate w-3/5">
                    {progressText ? (t(progressText) as string) : t('common.preparing')}
                </span>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            disabled={isCancelling}
                            onClick={onCancel}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
                        >
                            <span className={`material-symbols-outlined text-[14px] ${isCancelling ? 'animate-spin' : ''}`}>
                                {isCancelling ? 'progress_activity' : 'cancel'}
                            </span>
                            <span>{isCancelling ? t('common.cancelling') : t('common.cancel_install')}</span>
                        </button>
                    )}
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
            </div>
            <ProgressBar percent={progress} />
        </div>
    );
}
