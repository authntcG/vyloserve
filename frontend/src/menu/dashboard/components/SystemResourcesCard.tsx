import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import Skeleton from '../../../components/skeleton/Skeleton';

export function renderSparkline(data: number[], id: string) {
    const maxPoints = 20;
    const width = 100;
    const height = 35;
    const xStep = width / (maxPoints - 1);

    const points = data.map((val, idx) => ({
        x: idx * xStep,
        y: height - (val / 100) * height
    }));

    if (points.length === 0) return null;

    let linePath = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midX = (p1.x + p2.x) / 2;
        linePath += ` C ${midX},${p1.y} ${midX},${p2.y} ${p2.x},${p2.y}`;
    }

    const fillPath = `${linePath} L ${width},${height} L 0,${height} Z`;

    return (
        <div className="w-full h-12 mt-2 relative rounded overflow-hidden">
            <svg viewBox={`0 -2 ${width} ${height + 4}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                    {/* amber/emerald pakai var(--theme-*) supaya ikut tema aktif; red TETAP hex statis
                        (sengaja, lihat docs/ui_consistency_guide.md §1) -- lihat docs/known_bugs.md #42. */}
                    <linearGradient id={`grad-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="var(--theme-amber-500, #f59e0b)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--theme-emerald-500, #10b981)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id={`grad-stroke-${id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="var(--theme-amber-500, #f59e0b)" />
                        <stop offset="100%" stopColor="var(--theme-emerald-500, #10b981)" />
                    </linearGradient>
                </defs>
                <path d={fillPath} fill={`url(#grad-fill-${id})`} stroke="none" />
                <path d={linePath} stroke={`url(#grad-stroke-${id})`} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

export default function SystemResourcesCard() {
    const { t } = useTranslation();
    const { isGlobalLoading, status, cpuHistory, ramHistory } = useDashboard();

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5 h-full shrink-0">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">memory</span>
                    {t('dashboard.system_resources')}
                </h3>
                <span className="text-xs text-slate-500">{t('dashboard.system_resources_desc')}</span>
            </div>

            {isGlobalLoading ? (
                <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-4 mt-2">
                    <span className="sr-only">{t('common.loading')}</span>
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
            ) : (
                <div className="flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">speed</span> {t('dashboard.cpu_load')}
                            </span>
                            <span className="text-slate-900 dark:text-white font-mono">{status.cpu_load}%</span>
                        </div>
                        {renderSparkline(cpuHistory, 'cpu')}
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">memory_alt</span> {t('dashboard.memory_usage')}
                            </span>
                            <span className="text-slate-900 dark:text-white font-mono">{status.ram_usage}%</span>
                        </div>
                        {renderSparkline(ramHistory, 'ram')}
                    </div>
                </div>
            )}
        </div>
    );
}
