import { useTranslation } from 'react-i18next';
import { useDashboard, type ServiceStatus, type ProjectData } from '../../../context/DashboardContext';
import Skeleton from '../../../components/skeleton/Skeleton';

export function getDashboardSuggestions(status: ServiceStatus, projects: ProjectData[], isLoadingProjects: boolean, t: any) {
    const suggestions = [];
    if (!status.apache && !status.php && !status.database) {
        suggestions.push({
            icon: 'power_settings_new',
            color: 'text-amber-600 dark:text-amber-500',
            bg: 'bg-amber-500/10 dark:bg-amber-500/20',
            border: 'border-amber-500/20 dark:border-amber-500/30',
            text: t('dashboard.suggestion_stopped')
        });
    }
    if (projects.length === 0 && !isLoadingProjects) {
        suggestions.push({
            icon: 'add_box',
            color: 'text-primary',
            bg: 'bg-primary/10 dark:bg-primary/20',
            border: 'border-primary/20 dark:border-primary/30',
            text: t('dashboard.suggestion_no_project')
        });
    }
    if (suggestions.length === 0) {
        suggestions.push({
            icon: 'check_circle',
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
            border: 'border-emerald-500/20 dark:border-emerald-500/30',
            text: t('dashboard.suggestion_optimal')
        });
    }
    return suggestions;
}

export default function DashboardSuggestions() {
    const { t } = useTranslation();
    const { status, projects, isLoadingProjects, isGlobalLoading } = useDashboard();

    if (isGlobalLoading || isLoadingProjects) {
        return (
            <div
                role="status"
                aria-busy="true"
                aria-live="polite"
                className="h-[58px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3"
            >
                <span className="sr-only">{t('common.loading')}</span>
                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                <Skeleton className="h-4 w-72 rounded" />
            </div>
        );
    }

    const suggestions = getDashboardSuggestions(status, projects, isLoadingProjects, t);

    return (
        <div className="flex flex-col gap-3 vylo-fade-in">
            {suggestions.map((sugg) => (
                <div key={sugg.text} className={`flex items-center gap-3 p-4 rounded-xl border ${sugg.border} ${sugg.bg}`}>
                    <span className={`material-symbols-outlined ${sugg.color} text-[24px]`}>{sugg.icon}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sugg.text}</span>
                </div>
            ))}
        </div>
    );
}
