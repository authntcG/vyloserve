import ProgressBar from './ProgressBar';

export interface ProgressStatusBlockProps {
    readonly title?: string;
    readonly progressText?: string;
    readonly progress: number;
    readonly className?: string;
}

export default function ProgressStatusBlock({
    title,
    progressText,
    progress,
    className = ''
}: ProgressStatusBlockProps) {
    return (
        <div className={`mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 ${className}`}>
            {title && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</span>
                </div>
            )}
            <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-500 truncate w-3/4">{progressText}</span>
                <span className="font-bold text-primary">{progress}%</span>
            </div>
            <ProgressBar percent={progress} />
        </div>
    );
}
