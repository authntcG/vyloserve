import { useTranslation } from 'react-i18next';
import { useDashboard, type ProjectData } from '../../../context/DashboardContext';
import SkeletonCard from '../../../components/skeleton/SkeletonCard';
import EmptyState from '../../../components/EmptyState';

export interface RecentProjectsSectionProps {
    readonly isLoading?: boolean;
    readonly projects?: ProjectData[];
    readonly onOpenBrowser?: (domain: string) => void;
    readonly onOpenDir?: (path: string) => void;
    readonly t?: any;
}

export default function RecentProjectsSection(props: RecentProjectsSectionProps) {
    const { t: hookT } = useTranslation();
    const dashboard = useDashboard();

    const t = props.t || hookT;
    const isLoading = props.isLoading ?? dashboard.isLoadingProjects;
    const projects = props.projects ?? dashboard.projects;
    const onOpenBrowser = props.onOpenBrowser || dashboard.handleOpenBrowser;
    const onOpenDir = props.onOpenDir || dashboard.handleOpenDir;

    if (isLoading) {
        return (
            <SkeletonCard
                count={4}
                gridCols="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                hasActions={true}
            />
        );
    }

    if (projects.length === 0) {
        return (
            <EmptyState
                icon="folder_open"
                title={t('dashboard.no_projects_found')}
            />
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {projects.map(proj => (
                <div
                    key={proj.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-4 hover:border-primary/50 transition-colors group"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col overflow-hidden">
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">{proj.name}</h4>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{proj.domain}</span>
                        </div>
                        {proj.framework && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded ml-2 shrink-0">
                                {proj.framework}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => onOpenBrowser(proj.domain)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-1.5 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm outline-none"
                        >
                            <span className="material-symbols-outlined text-[16px]">public</span> {t('dashboard.open')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenDir(proj.path)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-1.5 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm outline-none"
                        >
                            <span className="material-symbols-outlined text-[16px]">folder</span> {t('dashboard.folder')}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
