interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionText, onAction }: EmptyStateProps) {
    return (
        <div className="block w-full py-12 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-center">
            
            <div className="mb-4">
                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 inline-block">
                    {icon}
                </span>
            </div>
            
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 whitespace-nowrap">
                {title}
            </h3>
            
            <p className="min-w-[250px] max-w-md mx-auto text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
            </p>
            
            {actionText && onAction && (
                <div className="mt-5 block">
                    <button 
                        onClick={onAction} 
                        className="inline-block text-sm font-medium text-primary hover:text-blue-600 hover:underline outline-none transition-colors"
                    >
                        {actionText}
                    </button>
                </div>
            )}
            
        </div>
    );
}