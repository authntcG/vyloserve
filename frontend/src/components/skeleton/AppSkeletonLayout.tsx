import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';

export default function AppSkeletonLayout() {
    const { t } = useTranslation();
    return (
        <div
            className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-900 relative"
        >
            {/* Sidebar Wireframe */}
            <aside className="hidden md:flex flex-col w-sidebar-width border-r border-slate-200 dark:border-slate-800 bg-surface dark:bg-slate-900 shrink-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 h-[72px] shrink-0 px-4 py-4">
                    <Skeleton className="h-7 w-28 rounded" />
                    <Skeleton className="w-8 h-8 rounded-lg" />
                </div>

                {/* Search Bar */}
                <div className="px-4 py-4 border-b border-slate-200/50 dark:border-slate-800/50">
                    <Skeleton className="h-10 w-full rounded-xl" />
                </div>

                {/* Nav items wireframe */}
                <div className="flex-1 flex flex-col gap-5 p-4 overflow-hidden">
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-9 w-full rounded-xl" />
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <Skeleton className="h-3 w-16 rounded ml-2" />
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-5 h-5 rounded" />
                                    <Skeleton className="h-4 w-20 rounded" />
                                </div>
                                <Skeleton className="w-8 h-4 rounded-full" />
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <Skeleton className="h-3 w-14 rounded ml-2" />
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 px-3 py-2">
                                <Skeleton className="w-5 h-5 rounded" />
                                <Skeleton className="h-4 w-24 rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-800 p-3 mt-auto shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-lg" />
                        <Skeleton className="h-3.5 w-16 rounded" />
                    </div>
                    <Skeleton className="w-7 h-7 rounded-lg" />
                </div>
            </aside>

            {/* Main Area Wireframe */}
            <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
                <main className="flex-1 min-h-0 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">
                    <div className="flex flex-col w-full gap-6 pb-10">
                        {/* PageHeader wireframe */}
                        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-[24px]">space_dashboard</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-6 w-36 rounded" />
                                    <Skeleton className="h-3.5 w-64 rounded" />
                                </div>
                            </div>
                            <div role="status" aria-busy="true" aria-live="polite" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                                <span aria-hidden="true" className="material-symbols-outlined animate-spin text-primary text-[18px]">sync</span>
                                <span className="text-xs text-slate-500 font-medium">{t('common.connecting_engine')}</span>
                            </div>
                        </div>

                        {/* Suggestions banner wireframe */}
                        <div className="h-[58px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3">
                            <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                            <Skeleton className="h-4 w-72 rounded" />
                        </div>

                        {/* Grid 2:1 for GlobalControlPanel & SystemResourcesCard (lg:h-[300px]) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[300px]">
                            {/* GlobalControlPanel Wireframe */}
                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col gap-6 relative overflow-hidden h-full">
                                <div className="flex justify-between items-start gap-4 shrink-0">
                                    <div className="flex flex-col gap-1.5">
                                        <Skeleton className="h-5 w-48 rounded" />
                                        <Skeleton className="h-3 w-64 rounded" />
                                    </div>
                                    <div className="flex gap-2">
                                        <Skeleton className="h-9 w-28 rounded-lg" />
                                        <Skeleton className="h-9 w-28 rounded-lg" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 flex-1">
                                    {[1, 2, 3].map((item) => (
                                        <div key={item} className="flex flex-col gap-3 p-4 border border-slate-100 dark:border-slate-800/60 rounded-lg bg-slate-50 dark:bg-slate-950/50">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Skeleton className="w-5 h-5 rounded-md" />
                                                    <Skeleton className="h-4 w-20 rounded" />
                                                </div>
                                                <Skeleton className="w-8 h-4 rounded-full" />
                                            </div>
                                            <div className="flex flex-col gap-2 mt-1">
                                                <Skeleton className="h-2.5 w-16 rounded" />
                                                <Skeleton className="h-8 w-full rounded-md mt-1" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SystemResourcesCard Wireframe */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col gap-5 h-full shrink-0">
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-5 w-36 rounded" />
                                    <Skeleton className="h-3 w-48 rounded" />
                                </div>
                                <div className="flex flex-col gap-4 mt-2">
                                    {[1, 2].map((item) => (
                                        <div key={item} className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <Skeleton className="h-3 w-24 rounded" />
                                                <Skeleton className="h-3 w-8 rounded" />
                                            </div>
                                            <Skeleton className="w-full h-12 rounded-lg mt-1" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RecentProjectsSection Wireframe */}
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-5 w-40 rounded" />
                                <Skeleton className="h-3 w-56 rounded" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((item) => (
                                    <div key={item} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col gap-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-col gap-1.5 w-3/4">
                                                <Skeleton className="h-4 w-3/4 rounded" />
                                                <Skeleton className="h-3 w-1/2 rounded" />
                                            </div>
                                            <Skeleton className="w-12 h-4 rounded" />
                                        </div>
                                        <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <Skeleton className="h-8 flex-1 rounded-lg" />
                                            <Skeleton className="h-8 flex-1 rounded-lg" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Bottom LogsPanel Wireframe */}
                <div className="flex-none min-h-0 relative border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <div className="h-9 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Skeleton className="w-4 h-4 rounded" />
                            <Skeleton className="h-3.5 w-24 rounded" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="w-6 h-6 rounded" />
                            <Skeleton className="w-6 h-6 rounded" />
                            <Skeleton className="w-6 h-6 rounded" />
                        </div>
                    </div>
                    <div className="h-24 p-3 flex flex-col gap-2 font-mono">
                        <Skeleton className="h-3 w-3/4 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                        <Skeleton className="h-3 w-1/2 rounded bg-slate-200/60 dark:bg-slate-800/60" />
                    </div>
                </div>
            </div>
        </div>
    );
}
