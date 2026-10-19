import { useTranslation } from 'react-i18next';
import { useDashboard, type ServiceStatus, type ProjectData } from '../../../context/DashboardContext';

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
    const { status, projects, isLoadingProjects } = useDashboard();
    const suggestions = getDashboardSuggestions(status, projects, isLoadingProjects, t);

    return (
        <div className="flex flex-col gap-3">
            {suggestions.map((sugg) => (
                <div key={sugg.text} className={`flex items-center gap-3 p-4 rounded-xl border ${sugg.border} ${sugg.bg}`}>
                    <span className={`material-symbols-outlined ${sugg.color} text-[24px]`}>{sugg.icon}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sugg.text}</span>
                </div>
            ))}
        </div>
    );
}
