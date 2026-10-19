import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { DashboardProvider } from '../../context/DashboardContext';
import DashboardSuggestions from './components/DashboardSuggestions';
import GlobalControlPanel from './components/GlobalControlPanel';
import SystemResourcesCard from './components/SystemResourcesCard';
import RecentProjectsSection from './components/RecentProjectsSection';

export function DashboardMainView() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col w-full gap-6 pb-10 animate-in fade-in duration-300">
            <PageHeader
                icon="space_dashboard"
                title={t('dashboard.title')}
                subtitle={t('dashboard.subtitle')}
            />

            <DashboardSuggestions />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[300px]">
                <GlobalControlPanel />
                <SystemResourcesCard />
            </div>

            <div className="flex flex-col gap-4 mt-2">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            {t('dashboard.recent_projects')}
                        </h3>
                        <span className="text-xs text-slate-500">{t('dashboard.recent_projects_desc')}</span>
                    </div>
                </div>

                <RecentProjectsSection />
            </div>
        </div>
    );
}

export default function DashboardMain() {
    return (
        <DashboardProvider>
            <DashboardMainView />
        </DashboardProvider>
    );
}
