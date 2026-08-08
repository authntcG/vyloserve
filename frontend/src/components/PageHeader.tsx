import type { ReactNode } from 'react';

interface PageHeaderProps {
    icon: string;
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
}

export default function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <span
                        className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]"
                        style={{ fontVariationSettings: "'FILL' 0" }}
                    >
                        {icon}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h2>
                </div>
                {subtitle && (
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        {subtitle}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex gap-3 pb-1">
                    {actions}
                </div>
            )}
        </div>
    );
}