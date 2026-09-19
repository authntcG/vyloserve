import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';
import PageHeader from '../../components/PageHeader';
interface ProjectData {
    id: string;
    name: string;
    domain: string;
    path: string;
    framework?: string;
}

interface ServiceStatus {
    apache: boolean;
    php: boolean;
    database: boolean;
    cpu_load: number;
    ram_usage?: number;
}


const PhpChips = ({ phpInstances, selectedPhp, togglePhpSelection, t }: any) => {
    if (phpInstances.length === 0) return <span className="text-xs text-slate-400 italic mt-1">{t('dashboard.no_php_installed')}</span>;
    return (
        <>
            {phpInstances.map((php: any) => {
                const isSelected = selectedPhp.includes(php.version);
                return (
                    <button type="button"
                        key={php.id}
                        onClick={() => togglePhpSelection(php.version)}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-primary/50 text-primary dark:text-blue-400 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'}`}
                    >
                        {t('common.php_version', { version: php.version })}
                    </button>
                )
            })}
        </>
    );
};

const DbChips = ({ dbInstances, selectedDb, toggleDbSelection, t }: any) => {
    if (dbInstances.length === 0) return <span className="text-xs text-slate-400 italic mt-1">{t('dashboard.no_db_installed')}</span>;
    return (
        <>
            {dbInstances.map((db: any) => {
                const isSelected = selectedDb.includes(db.id);
                const shortName = db.name.replaceAll('MariaDB', 'MDB').replaceAll('PostgreSQL', 'PG');
                return (
                    <button type="button"
                        key={db.id}
                        onClick={() => toggleDbSelection(db.id)}
                        title={db.name}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-primary/50 text-primary dark:text-blue-400 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'}`}
                    >
                        {shortName}
                    </button>
                )
            })}
        </>
    );
};

function resolveInitialPhpSelection(prev: string[], instances: any[]): string[] {
    if (prev.length !== 0 || instances.length === 0) return prev;
    const running = instances.filter((p: any) => p.status === 'running').map((p: any) => p.version);
    return running.length > 0 ? running : [instances[0].version];
}

function resolveInitialDbSelection(prev: string[], instances: any[]): string[] {
    if (prev.length !== 0 || instances.length === 0) return prev;
    const running = instances.filter((p: any) => p.status === 'running').map((p: any) => p.id);
    return running.length > 0 ? running : [instances[0].id];
}

async function refreshOverallStatus(api: any, setStatus: (s: ServiceStatus) => void, appendCpuHistory: (v: number) => void, appendRamHistory: (v: number) => void) {
    if (typeof api.get_all_services_status !== 'function') return;
    const resStatus = await api.get_all_services_status();
    setStatus({
        apache: resStatus.apache,
        php: resStatus.php,
        database: resStatus.database,
        cpu_load: resStatus.cpu_load || 0,
        ram_usage: resStatus.ram_usage || 0
    });
    appendCpuHistory(resStatus.cpu_load || 0);
    appendRamHistory(resStatus.ram_usage || 0);
}

async function refreshApacheStatus(api: any, isApacheInitializedRef: { current: boolean }, setApacheVersions: (v: string[]) => void, setSelectedApache: (updater: (prev: string) => string) => void) {
    if (typeof api.get_apache_installed_versions !== 'function') return;
    const resAp = await api.get_apache_installed_versions();
    if (resAp.status !== 'success') return;
    setApacheVersions(resAp.data);
    setSelectedApache(prev => {
        if (isApacheInitializedRef.current) return prev;
        isApacheInitializedRef.current = true;
        return resAp.active || resAp.data[0] || '';
    });
}

async function refreshPhpStatus(api: any, isPhpInitializedRef: { current: boolean }, setPhpInstances: (v: any[]) => void, setSelectedPhp: (updater: (prev: string[]) => string[]) => void) {
    if (typeof api.get_installed_php !== 'function') return;
    const resPhp = await api.get_installed_php();
    setPhpInstances(resPhp);
    setSelectedPhp(prev => {
        if (isPhpInitializedRef.current) return prev;
        isPhpInitializedRef.current = true;
        return resolveInitialPhpSelection(prev, resPhp);
    });
}

async function refreshDatabaseStatus(api: any, isDbInitializedRef: { current: boolean }, setDbInstances: (v: any[]) => void, setSelectedDb: (updater: (prev: string[]) => string[]) => void) {
    if (typeof api.get_installed_databases !== 'function') return;
    const resDb = await api.get_installed_databases();
    if (resDb.status !== 'success') return;
    setDbInstances(resDb.data);
    setSelectedDb(prev => {
        if (isDbInitializedRef.current) return prev;
        isDbInitializedRef.current = true;
        return resolveInitialDbSelection(prev, resDb.data);
    });
}

async function startApacheIfIncluded(api: any, included: boolean, selectedApache: string) {
    if (included && selectedApache) await api.set_apache_active_version(selectedApache);
}

async function startSelectedPhpInstances(api: any, included: boolean, selectedPhp: string[], phpInstances: any[]) {
    if (!included) return;
    for (const v of selectedPhp) {
        if (phpInstances.find(p => p.version === v)?.status !== 'running') await api.start_php(v);
    }
}

async function startSelectedDbInstances(api: any, included: boolean, selectedDb: string[], dbInstances: any[]) {
    if (!included) return;
    for (const id of selectedDb) {
        if (dbInstances.find(p => p.id === id)?.status !== 'running') await api.start_database(id);
    }
}

async function stopSelectedPhpInstances(api: any, included: boolean, selectedPhp: string[], phpInstances: any[]) {
    if (!included) return;
    for (const v of selectedPhp) {
        if (phpInstances.find(p => p.version === v)?.status === 'running') await api.stop_php(v);
    }
}

async function stopSelectedDbInstances(api: any, included: boolean, selectedDb: string[], dbInstances: any[]) {
    if (!included) return;
    for (const id of selectedDb) {
        if (dbInstances.find(p => p.id === id)?.status === 'running') await api.stop_database(id);
    }
}

function anyCanStart(ids: string[], instances: any[], matchKey: string): boolean {
    return ids.some(id => {
        const inst = instances.find((item: any) => item[matchKey] === id);
        return !!inst && inst.status !== 'running';
    });
}

function anyCanStop(ids: string[], instances: any[], matchKey: string): boolean {
    return ids.some(id => {
        const inst = instances.find((item: any) => item[matchKey] === id);
        return !!inst && inst.status === 'running';
    });
}

function computeCanStartStop(includedServices: { apache: boolean; php: boolean; database: boolean }, selectedApache: string, status: ServiceStatus, selectedPhp: string[], phpInstances: any[], selectedDb: string[], dbInstances: any[]) {
    const apacheCanStart = includedServices.apache && !!selectedApache && !status.apache;
    const apacheCanStop = includedServices.apache && !!selectedApache && status.apache;
    const phpCanStart = includedServices.php && selectedPhp.length > 0 && anyCanStart(selectedPhp, phpInstances, 'version');
    const phpCanStop = includedServices.php && selectedPhp.length > 0 && anyCanStop(selectedPhp, phpInstances, 'version');
    const dbCanStart = includedServices.database && selectedDb.length > 0 && anyCanStart(selectedDb, dbInstances, 'id');
    const dbCanStop = includedServices.database && selectedDb.length > 0 && anyCanStop(selectedDb, dbInstances, 'id');

    return {
        canStart: apacheCanStart || phpCanStart || dbCanStart,
        canStop: apacheCanStop || phpCanStop || dbCanStop
    };
}

function getDashboardSuggestions(status: ServiceStatus, projects: ProjectData[], isLoadingProjects: boolean, t: any) {
    const suggestions = [];
    if (!status.apache && !status.php && !status.database) {
        suggestions.push({
            icon: 'power_settings_new', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50',
            text: t('dashboard.suggestion_stopped')
        });
    }
    if (projects.length === 0 && !isLoadingProjects) {
        suggestions.push({
            icon: 'add_box', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/50',
            text: t('dashboard.suggestion_no_project')
        });
    }
    if (suggestions.length === 0) {
        suggestions.push({
            icon: 'check_circle', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50',
            text: t('dashboard.suggestion_optimal')
        });
    }
    return suggestions;
}

function renderSparkline(data: number[], id: string) {
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
                    <linearGradient id={`grad-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id={`grad-stroke-${id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>
                <path d={fillPath} fill={`url(#grad-fill-${id})`} stroke="none" />
                <path d={linePath} stroke={`url(#grad-stroke-${id})`} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

interface ApacheServiceCardProps {
    readonly included: boolean;
    readonly onToggleIncluded: (checked: boolean) => void;
    readonly isRunning: boolean;
    readonly selectedApache: string;
    readonly onSelectApache: (v: string) => void;
    readonly apacheVersions: string[];
    readonly t: any;
}

function ApacheServiceCard({ included, onToggleIncluded, isRunning, selectedApache, onSelectApache, apacheVersions, t }: ApacheServiceCardProps) {
    return (
        <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'} rounded-lg transition-all`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>dns</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{t('sidebar.menu_apache')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => onToggleIncluded(e.target.checked)}
                        aria-label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_apache') })}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('dashboard.default_version')}</span>
                    <span className={`w-2 h-2 shrink-0 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                </div>
                <select
                    value={selectedApache}
                    onChange={(e) => onSelectApache(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-md p-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
                >
                    {apacheVersions.length > 0 ? apacheVersions.map(v => (
                        <option key={v} value={v}>{t('common.apache_version', { version: v })}</option>
                    )) : <option>{t('dashboard.no_version_installed')}</option>}
                </select>
            </div>
        </div>
    );
}

interface PhpServiceCardProps {
    readonly included: boolean;
    readonly onToggleIncluded: (checked: boolean) => void;
    readonly phpInstances: any[];
    readonly selectedPhp: string[];
    readonly togglePhpSelection: (version: string) => void;
    readonly t: any;
}

function PhpServiceCard({ included, onToggleIncluded, phpInstances, selectedPhp, togglePhpSelection, t }: PhpServiceCardProps) {
    return (
        <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'} rounded-lg transition-all`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>php</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{t('sidebar.menu_php')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => onToggleIncluded(e.target.checked)}
                        aria-label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_php') })}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('dashboard.select_versions')}</span>
                    <span className={`w-2 h-2 shrink-0 rounded-full ${phpInstances.some(p => p.status === 'running') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto custom-scrollbar pr-1 mt-0.5">
                    <PhpChips phpInstances={phpInstances} selectedPhp={selectedPhp} togglePhpSelection={togglePhpSelection} t={t} />
                </div>
            </div>
        </div>
    );
}

interface DatabaseServiceCardProps {
    readonly included: boolean;
    readonly onToggleIncluded: (checked: boolean) => void;
    readonly dbInstances: any[];
    readonly selectedDb: string[];
    readonly toggleDbSelection: (id: string) => void;
    readonly t: any;
}

function DatabaseServiceCard({ included, onToggleIncluded, dbInstances, selectedDb, toggleDbSelection, t }: DatabaseServiceCardProps) {
    return (
        <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'} rounded-lg transition-all`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>database</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{t('sidebar.menu_database')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => onToggleIncluded(e.target.checked)}
                        aria-label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_database') })}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('dashboard.select_engines')}</span>
                    <span className={`w-2 h-2 shrink-0 rounded-full ${dbInstances.some(p => p.status === 'running') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto custom-scrollbar pr-1 mt-0.5">
                    <DbChips dbInstances={dbInstances} selectedDb={selectedDb} toggleDbSelection={toggleDbSelection} t={t} />
                </div>
            </div>
        </div>
    );
}

interface RecentProjectsSectionProps {
    readonly isLoading: boolean;
    readonly projects: ProjectData[];
    readonly onOpenBrowser: (domain: string) => void;
    readonly onOpenDir: (path: string) => void;
    readonly t: any;
}

function RecentProjectsSection({ isLoading, projects, onOpenBrowser, onOpenDir, t }: RecentProjectsSectionProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl p-4 shadow-sm flex flex-col gap-4 animate-pulse">
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-2 w-full">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800/80 rounded w-1/2"></div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="h-7 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                            <div className="h-7 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 dark:bg-slate-900/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">folder_open</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('dashboard.no_projects_found')}</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {projects.map(proj => (
                <div key={proj.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-4 hover:border-primary/50 transition-colors group">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col overflow-hidden">
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">{proj.name}</h4>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{proj.domain}</span>
                        </div>
                        {proj.framework && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded ml-2 shrink-0">
                                {proj.framework}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button type="button"
                            onClick={() => onOpenBrowser(proj.domain)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-1.5 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm outline-none"
                        >
                            <span className="material-symbols-outlined text-[16px]">public</span> {t('dashboard.open')}
                        </button>
                        <button type="button"
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

export default function DashboardMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [status, setStatus] = useState<ServiceStatus>({ apache: false, php: false, database: false, cpu_load: 0, ram_usage: 0 });

    const [cpuHistory, setCpuHistory] = useState<number[]>(new Array(20).fill(0));
    const [ramHistory, setRamHistory] = useState<number[]>(new Array(20).fill(0));

    const [apacheVersions, setApacheVersions] = useState<string[]>([]);
    const [selectedApache, setSelectedApache] = useState<string>('');
    const [phpInstances, setPhpInstances] = useState<any[]>([]);
    const [selectedPhp, setSelectedPhp] = useState<string[]>([]);

    // ---> STATE DATABASE BARU <---
    const [dbInstances, setDbInstances] = useState<any[]>([]);
    const [selectedDb, setSelectedDb] = useState<string[]>([]);

    const [includedServices, setIncludedServices] = useState({ apache: true, php: true, database: false });

    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isTogglingAll, setIsTogglingAll] = useState<'start' | 'stop' | null>(null);

    const isPhpInitialized = useRef(false);
    const isApacheInitialized = useRef(false);
    const isDbInitialized = useRef(false); // Ref deteksi inisialisasi DB
    const isConfigLoaded = useRef(false);

    const loadDashboardConfig = async () => {
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_dashboard_config === 'function') {
                const res = await api.get_dashboard_config();
                if (res.status === 'success' && res.data) {
                    setIncludedServices({
                        apache: res.data.apache ?? true,
                        php: res.data.php ?? true,
                        database: res.data.database ?? false
                    });

                    if (res.data.selected_php && Array.isArray(res.data.selected_php) && res.data.selected_php.length > 0) {
                        setSelectedPhp(res.data.selected_php);
                        isPhpInitialized.current = true;
                    }

                    if (res.data.selected_database && Array.isArray(res.data.selected_database) && res.data.selected_database.length > 0) {
                        setSelectedDb(res.data.selected_database);
                        isDbInitialized.current = true;
                    }
                }
            }
        } catch (error){ console.error(error); console.error("Gagal memuat config dashboard:", error); }
        finally { isConfigLoaded.current = true; }
    };

    useEffect(() => {
        if (!isConfigLoaded.current) return;

        const saveConfig = async () => {
            try {
                const api = window.pywebview?.api;
                if (api && typeof api.save_dashboard_config === 'function') {
                    const payload = {
                        ...includedServices,
                        selected_php: selectedPhp,
                        selected_database: selectedDb // Sertakan database ke payload
                    };
                    await api.save_dashboard_config(payload);
                }
            } catch (e){ console.error(e); console.error("Gagal menyimpan config:", e); }
        };
        saveConfig();
    }, [includedServices, selectedPhp, selectedDb]);

    const fetchRecentProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const api = window.pywebview?.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') {
                    const reversed = [...(res.data || [])].reverse();
                    setProjects(reversed.slice(0, 4));
                }
            }
        } catch (error){ console.error(error); }
        finally { setIsLoadingProjects(false); }
    };

    const fetchServicesStatus = async () => {
        try {
            const api = window.pywebview?.api;
            if (!api) return;

            await refreshOverallStatus(
                api,
                setStatus,
                (v) => setCpuHistory(prev => [...prev, v].slice(-20)),
                (v) => setRamHistory(prev => [...prev, v].slice(-20))
            );
            await refreshApacheStatus(api, isApacheInitialized, setApacheVersions, setSelectedApache);
            await refreshPhpStatus(api, isPhpInitialized, setPhpInstances, setSelectedPhp);
            await refreshDatabaseStatus(api, isDbInitialized, setDbInstances, setSelectedDb);
        } catch (error){ console.error(error);
        } finally {
            setIsGlobalLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardConfig();
        fetchRecentProjects();
        fetchServicesStatus();
        const interval = setInterval(fetchServicesStatus, 3000);

        // ---> PENYELESAIAN BUG: Listener Sinkronisasi Sidebar & Dashboard <---
        const handleStatusSync = () => {
            fetchServicesStatus();
        };
        window.addEventListener('service_status_changed', handleStatusSync);
        window.addEventListener('project_list_updated', fetchRecentProjects);

        return () => {
            clearInterval(interval);
            window.removeEventListener('service_status_changed', handleStatusSync);
            window.removeEventListener('project_list_updated', fetchRecentProjects);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleAll = async (action: 'start' | 'stop') => {
        setIsTogglingAll(action);
        try {
            const api = window.pywebview?.api;
            if (!api) return;

            if (action === 'start') {
                await startApacheIfIncluded(api, includedServices.apache, selectedApache);
                await startSelectedPhpInstances(api, includedServices.php, selectedPhp, phpInstances);
                await startSelectedDbInstances(api, includedServices.database, selectedDb, dbInstances);
                if (includedServices.apache) await api.start_apache_server();
                showToast(t('dashboard.start_success'), "success");
            } else {
                if (includedServices.apache) await api.stop_apache_server();
                await stopSelectedPhpInstances(api, includedServices.php, selectedPhp, phpInstances);
                await stopSelectedDbInstances(api, includedServices.database, selectedDb, dbInstances);
                showToast(t('dashboard.stop_success'), "success");
            }

            fetchServicesStatus();
            window.dispatchEvent(new CustomEvent('service_status_changed', { detail: { service: 'all' } }));
        } catch (error){ console.error(error);
            console.error("Dashboard Toggle Error:", error);
            showToast(t('dashboard.toggle_error'), "error");
        } finally {
            setIsTogglingAll(null);
        }
    };

    const togglePhpSelection = (version: string) => {
        setSelectedPhp(prev => {
            const newSelection = prev.includes(version)
                ? prev.filter(v => v !== version)
                : [...prev, version];

            if (newSelection.length === 0) setIncludedServices(p => ({ ...p, php: false }));
            else if (newSelection.length > 0 && !includedServices.php) setIncludedServices(p => ({ ...p, php: true }));

            return newSelection;
        });
    };

    // ---> FUNGSI SELEKSI KARTU DATABASE BARU <---
    const toggleDbSelection = (id: string) => {
        setSelectedDb(prev => {
            const newSelection = prev.includes(id)
                ? prev.filter(v => v !== id)
                : [...prev, id];

            if (newSelection.length === 0) setIncludedServices(p => ({ ...p, database: false }));
            else if (newSelection.length > 0 && !includedServices.database) setIncludedServices(p => ({ ...p, database: true }));

            return newSelection;
        });
    };

    const handleTogglePhpIncluded = (checked: boolean) => {
        if (checked && selectedPhp.length === 0 && phpInstances.length > 0) {
            setSelectedPhp([phpInstances[0].version]);
        }
        setIncludedServices(p => ({ ...p, php: checked }));
    };

    const handleToggleDbIncluded = (checked: boolean) => {
        if (checked && selectedDb.length === 0 && dbInstances.length > 0) {
            setSelectedDb([dbInstances[0].id]);
        }
        setIncludedServices(p => ({ ...p, database: checked }));
    };

    const handleOpenBrowser = (domain: string) => {
        const url = `https://${domain}`;
        try {
            if (window.pywebview?.api?.open_browser) window.pywebview.api.open_browser(url);
            else window.open(url, '_blank');
        } catch (e){ console.error(e); }
    };

    const handleOpenDir = (path: string) => {
        try {
            if (window.pywebview?.api?.open_in_explorer) window.pywebview.api.open_in_explorer(path);
        } catch (e){ console.error(e); }
    };

    const { canStart, canStop } = computeCanStartStop(includedServices, selectedApache, status, selectedPhp, phpInstances, selectedDb, dbInstances);

    return (
        <div className="flex flex-col w-full gap-6 pb-10 animate-in fade-in duration-300">

            <PageHeader
                icon="space_dashboard"
                title={t('dashboard.title')}
                subtitle={t('dashboard.subtitle')}
            />

            <div className="flex flex-col gap-3">
                {getDashboardSuggestions(status, projects, isLoadingProjects, t).map((sugg) => (
                    <div key={sugg.text} className={`flex items-center gap-3 p-4 rounded-xl border ${sugg.border} ${sugg.bg}`}>
                        <span className={`material-symbols-outlined ${sugg.color} text-[24px]`}>{sugg.icon}</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sugg.text}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[300px]">

                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden h-full">

                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex flex-wrap justify-between items-start gap-4 z-10 shrink-0">
                        <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">dashboard_customize</span>
                                {t('dashboard.global_control_panel')}
                            </h3>
                            <span className="text-xs text-slate-500">{t('dashboard.global_control_panel_desc')}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button type="button"
                                onClick={() => handleToggleAll('start')}
                                disabled={isGlobalLoading || isTogglingAll !== null || !canStart}
                                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                            >
                                {isTogglingAll === 'start' ? (
                                    <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {t('dashboard.starting')}</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">play_arrow</span> {t('dashboard.start_selected')}</>
                                )}
                            </button>

                            <button type="button"
                                onClick={() => handleToggleAll('stop')}
                                disabled={isGlobalLoading || isTogglingAll !== null || !canStop}
                                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                            >
                                {isTogglingAll === 'stop' ? (
                                    <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {t('dashboard.stopping')}</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">stop</span> {t('dashboard.stop_selected')}</>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2 content-start">
                        {isGlobalLoading ? (
                            [1, 2, 3].map((item) => (
                                <div key={item} className="flex flex-col gap-3 p-4 border border-slate-100 dark:border-slate-800/60 rounded-lg animate-pulse bg-slate-50 dark:bg-slate-950/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700/50 rounded-md shrink-0"></div>
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                        </div>
                                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700/50 rounded-full shrink-0"></div>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-1">
                                        <div className="flex justify-between items-center">
                                            <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-20"></div>
                                            <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700/50 shrink-0"></div>
                                        </div>
                                        <div className="h-8 bg-slate-200 dark:bg-slate-700/50 rounded-md w-full mt-1"></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                <ApacheServiceCard
                                    included={includedServices.apache}
                                    onToggleIncluded={(checked) => setIncludedServices(p => ({ ...p, apache: checked }))}
                                    isRunning={status.apache}
                                    selectedApache={selectedApache}
                                    onSelectApache={setSelectedApache}
                                    apacheVersions={apacheVersions}
                                    t={t}
                                />
                                <PhpServiceCard
                                    included={includedServices.php}
                                    onToggleIncluded={handleTogglePhpIncluded}
                                    phpInstances={phpInstances}
                                    selectedPhp={selectedPhp}
                                    togglePhpSelection={togglePhpSelection}
                                    t={t}
                                />
                                <DatabaseServiceCard
                                    included={includedServices.database}
                                    onToggleIncluded={handleToggleDbIncluded}
                                    dbInstances={dbInstances}
                                    selectedDb={selectedDb}
                                    toggleDbSelection={toggleDbSelection}
                                    t={t}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* 2. RESOURCE MONITOR WIDGET */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5 h-full shrink-0">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">memory</span>
                            {t('dashboard.system_resources')}
                        </h3>
                        <span className="text-xs text-slate-500">{t('dashboard.system_resources_desc')}</span>
                    </div>

                    {isGlobalLoading ? (
                        <div className="flex flex-col gap-4 mt-2">
                            {[1, 2].map((item) => (
                                <div key={item} className="flex flex-col gap-2 animate-pulse">
                                    <div className="flex justify-between items-center">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-8"></div>
                                    </div>
                                    <div className="w-full h-12 bg-slate-100 dark:bg-slate-800/60 rounded-lg mt-1"></div>
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

                <RecentProjectsSection
                    isLoading={isLoadingProjects}
                    projects={projects}
                    onOpenBrowser={handleOpenBrowser}
                    onOpenDir={handleOpenDir}
                    t={t}
                />
            </div>

        </div>
    );
}
