import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';
import SkeletonCard from './SkeletonCard';

export default function AppSkeletonLayout() {
    const { t } = useTranslation();

    return (
        <div
            className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-900"
        >

            {/* Sidebar Wireframe */}
            <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 gap-6 shrink-0">
                <div className="flex items-center gap-3 px-2">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="h-5 w-28 rounded" />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-2 py-2">
                            <Skeleton className="w-5 h-5 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Area Wireframe */}
            <main className="flex-1 flex flex-col min-w-0 h-full p-4 md:p-8 overflow-y-auto">
                {/* Header wireframe */}
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-7 w-48 rounded" />
                        <Skeleton className="h-4 w-72 rounded" />
                    </div>
                    <div role="status" aria-busy="true" aria-live="polite" className="flex items-center gap-2">
                        <span aria-hidden="true" className="material-symbols-outlined animate-spin text-primary text-xl">sync</span>
                        <span className="text-xs text-slate-500 font-medium">{t('common.connecting_engine')}</span>
                    </div>
                </div>

                {/* Content Cards wireframe */}
                <div className="flex flex-col gap-6">
                    <SkeletonCard count={3} gridCols="grid-cols-1 md:grid-cols-3" />
                    <SkeletonCard count={2} gridCols="grid-cols-1 md:grid-cols-2" />
                </div>
            </main>
        </div>
    );
}
