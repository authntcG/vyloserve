interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionText, onAction }: EmptyStateProps) {
    return (
        <div className="w-full col-span-full py-12 px-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
            <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4">
                {icon}
            </span>
            <h3 className="w-full text-center text-lg font-medium text-slate-900 dark:text-slate-100">
                {title}
            </h3>
            {/* Penambahan w-full di sini adalah kunci perbaikannya */}
            <p className="w-full max-w-md text-center text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {description}
            </p>
            {actionText && onAction && (
                <button 
                    onClick={onAction} 
                    className="mt-5 text-sm font-medium text-primary hover:text-blue-600 hover:underline outline-none transition-colors"
                >
                    {actionText}
                </button>
            )}
        </div>
    );
}