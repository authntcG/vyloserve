import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../../../components/ToggleSwitch';
import Select from '../../../components/Select';
import Skeleton from '../../../components/skeleton/Skeleton';
import { useDashboard } from '../../../context/DashboardContext';

export const PhpChips = ({ phpInstances, selectedPhp, togglePhpSelection, t }: any) => {
    if (phpInstances.length === 0) {
        return <span className="text-xs text-slate-400 italic mt-1">{t('dashboard.no_php_installed')}</span>;
    }
    return (
        <>
            {phpInstances.map((php: any) => {
                const isSelected = selectedPhp.includes(php.version);
                return (
                    <button
                        type="button"
                        key={php.id}
                        onClick={() => togglePhpSelection(php.version)}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors border ${
                            isSelected
                                ? 'bg-primary/10 dark:bg-primary/20 border-primary/50 text-primary shadow-sm'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'
                        }`}
                    >
                        {t('common.php_version', { version: php.version })}
                    </button>
                );
            })}
        </>
    );
};

export const DbChips = ({ dbInstances, selectedDb, toggleDbSelection, t }: any) => {
    if (dbInstances.length === 0) {
        return <span className="text-xs text-slate-400 italic mt-1">{t('dashboard.no_db_installed')}</span>;
    }
    return (
        <>
            {dbInstances.map((db: any) => {
                const isSelected = selectedDb.includes(db.id);
                const shortName = db.name.replaceAll('MariaDB', 'MDB').replaceAll('PostgreSQL', 'PG');
                return (
                    <button
                        type="button"
                        key={db.id}
                        onClick={() => toggleDbSelection(db.id)}
                        title={db.name}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors border ${
                            isSelected
                                ? 'bg-primary/10 dark:bg-primary/20 border-primary/50 text-primary shadow-sm'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'
                        }`}
                    >
                        {shortName}
                    </button>
                );
            })}
        </>
    );
};

interface ApacheServiceCardProps {
    readonly included: boolean;
    readonly onToggleIncluded: (checked: boolean) => void;
    readonly isRunning: boolean;
    readonly selectedApache: string;
    readonly onSelectApache: (v: string) => void;
    readonly apacheVersions: string[];
    readonly t: any;
}

export function ApacheServiceCard({
    included,
    onToggleIncluded,
    isRunning,
    selectedApache,
    onSelectApache,
    apacheVersions,
    t
}: ApacheServiceCardProps) {
    return (
        <div
            className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${
                included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'
            } rounded-lg transition-all`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>
                        dns
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {t('sidebar.menu_apache')}
                    </span>
                </div>
                <div className="shrink-0">
                    <ToggleSwitch
                        checked={included}
                        onChange={onToggleIncluded}
                        label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_apache') })}
                    />
                </div>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t('dashboard.default_version')}
                    </span>
                    <span
                        className={`w-2 h-2 shrink-0 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}
                    ></span>
                </div>
                <Select
                    searchable={false}
                    options={apacheVersions.map(v => ({ value: v, label: t('common.apache_version', 'Apache {{version}}', { version: v }) }))}
                    value={selectedApache || null}
                    onChange={onSelectApache}
                    placeholder={t('dashboard.no_version_installed')}
                    disabled={apacheVersions.length === 0}
                />
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

export function PhpServiceCard({
    included,
    onToggleIncluded,
    phpInstances,
    selectedPhp,
    togglePhpSelection,
    t
}: PhpServiceCardProps) {
    return (
        <div
            className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${
                included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'
            } rounded-lg transition-all`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>
                        php
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {t('sidebar.menu_php')}
                    </span>
                </div>
                <div className="shrink-0">
                    <ToggleSwitch
                        checked={included}
                        onChange={onToggleIncluded}
                        label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_php') })}
                    />
                </div>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t('dashboard.select_versions')}
                    </span>
                    <span
                        className={`w-2 h-2 shrink-0 rounded-full ${
                            phpInstances.some(p => p.status === 'running') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    ></span>
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

export function DatabaseServiceCard({
    included,
    onToggleIncluded,
    dbInstances,
    selectedDb,
    toggleDbSelection,
    t
}: DatabaseServiceCardProps) {
    return (
        <div
            className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${
                included ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'
            } rounded-lg transition-all`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined shrink-0 transition-colors ${included ? 'text-primary' : 'text-slate-400'}`}>
                        database
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {t('sidebar.menu_database')}
                    </span>
                </div>
                <div className="shrink-0">
                    <ToggleSwitch
                        checked={included}
                        onChange={onToggleIncluded}
                        label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t('sidebar.menu_database') })}
                    />
                </div>
            </div>

            <div className={`flex flex-col gap-1 mt-1 transition-all ${included ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t('dashboard.select_engines')}
                    </span>
                    <span
                        className={`w-2 h-2 shrink-0 rounded-full ${
                            dbInstances.some(p => p.status === 'running') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    ></span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto custom-scrollbar pr-1 mt-0.5">
                    <DbChips dbInstances={dbInstances} selectedDb={selectedDb} toggleDbSelection={toggleDbSelection} t={t} />
                </div>
            </div>
        </div>
    );
}

export default function GlobalControlPanel() {
    const { t } = useTranslation();
    const {
        includedServices,
        setIncludedServices,
        status,
        selectedApache,
        setSelectedApache,
        apacheVersions,
        phpInstances,
        selectedPhp,
        togglePhpSelection,
        handleTogglePhpIncluded,
        dbInstances,
        selectedDb,
        toggleDbSelection,
        handleToggleDbIncluded,
        isGlobalLoading,
        isTogglingAll,
        canStart,
        canStop,
        handleToggleAll
    } = useDashboard();

    return (
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
                    <button
                        type="button"
                        onClick={() => handleToggleAll('start')}
                        disabled={isGlobalLoading || isTogglingAll !== null || !canStart}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                    >
                        {isTogglingAll === 'start' ? (
                            <>
                                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {t('dashboard.starting')}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">play_arrow</span> {t('dashboard.start_selected')}
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleToggleAll('stop')}
                        disabled={isGlobalLoading || isTogglingAll !== null || !canStop}
                        className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                    >
                        {isTogglingAll === 'stop' ? (
                            <>
                                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span> {t('dashboard.stopping')}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">stop</span> {t('dashboard.stop_selected')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2 content-start">
                {isGlobalLoading ? (
                    [1, 2, 3].map((item) => (
                        <div
                            key={item}
                            role="status"
                            aria-busy="true"
                            aria-live="polite"
                            className="flex flex-col gap-3 p-4 border border-slate-100 dark:border-slate-800/60 rounded-lg bg-slate-50 dark:bg-slate-950/50"
                        >
                            <span className="sr-only">{t('common.loading')}</span>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="w-5 h-5 rounded-md shrink-0" />
                                    <Skeleton className="h-4 w-24 rounded" />
                                </div>
                                <Skeleton className="w-9 h-5 rounded-full shrink-0" />
                            </div>
                            <div className="flex flex-col gap-2 mt-1">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-2.5 w-20 rounded" />
                                    <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                                </div>
                                <Skeleton className="h-8 w-full rounded-md mt-1" />
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
    );
}
