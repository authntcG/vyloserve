import { useTranslation } from 'react-i18next';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import type { PhpInstance } from '../../context/PhpContext';

export interface PhpTableProps {
    readonly phpInstances: readonly PhpInstance[];
    readonly togglingInstanceId: string | null;
    readonly updateMap: Record<string, { version: string; filename: string } | null>;
    readonly onToggleStatus: (php: PhpInstance) => void;
    readonly onOpenSettings: (php: PhpInstance) => void;
    readonly onOpenPhpIni: (version: string) => void;
    readonly onOpenPhpDir: (version: string) => void;
    readonly onUpdatePhp: (php: PhpInstance, version: string, filename: string) => void;
    readonly onUninstallPhp: (php: PhpInstance) => void;
}

export default function PhpTable({
    phpInstances,
    togglingInstanceId,
    updateMap,
    onToggleStatus,
    onOpenSettings,
    onOpenPhpIni,
    onOpenPhpDir,
    onUpdatePhp,
    onUninstallPhp,
}: PhpTableProps) {
    const { t } = useTranslation();

    const columns: ColumnDef<PhpInstance>[] = [
        {
            id: 'status',
            header: t('php.th_status', 'Status'),
            width: '130px',
            render: (php) => {
                const isRunning = php.status === 'running';
                return isRunning ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500" />
                        {t('php.running', 'Running')}
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400" />
                        {t('php.stopped', 'Stopped')}
                    </span>
                );
            },
        },
        {
            id: 'version',
            header: t('php.th_version', 'Version'),
            render: (php) => {
                const updateVer = updateMap[php.id];
                return (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">
                            PHP {php.version}
                        </span>
                        {updateVer && (
                            <button
                                type="button"
                                onClick={() => onUpdatePhp(php, updateVer.version, updateVer.filename)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                title={t('php.update_to', { version: updateVer.version })}
                            >
                                <span className="material-symbols-outlined text-[12px]">upgrade</span>
                                <span>{updateVer.version}</span>
                            </button>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'port',
            header: t('php.th_port', 'FastCGI Port'),
            render: (php) => (
                <span className="font-mono text-xs font-semibold text-primary">
                    {php.port}
                </span>
            ),
        },
        {
            id: 'memory',
            header: t('php.th_memory', 'Memory Limit'),
            render: (php) => (
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {php.memory_limit}
                </span>
            ),
        },
        {
            id: 'path',
            header: t('php.th_path', 'Path'),
            render: (php) => (
                <div className="flex items-center gap-1.5 max-w-[240px]">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate" title={php.dir}>
                        {php.dir}
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenPhpDir(php.version)}
                        title={t('php.open_directory')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    </button>
                </div>
            ),
        },
        {
            id: 'actions',
            header: t('common.actions', 'Actions'),
            align: 'right',
            render: (php) => {
                const isRunning = php.status === 'running';
                const isToggling = togglingInstanceId === php.id;

                return (
                    <div className="flex items-center justify-end gap-1.5">
                        <ServiceToggleButton
                            isRunning={isRunning}
                            isToggling={isToggling}
                            onClick={() => onToggleStatus(php)}
                            iconOnly
                            labels={{
                                start: t('php.start_cgi'),
                                stop: t('php.stop_cgi'),
                                starting: t('php.starting'),
                                stopping: t('php.stopping'),
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => onOpenSettings(php)}
                            title={t('php.config')}
                            aria-label={t('php.config')}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">tune</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenPhpIni(php.version)}
                            title={t('php.open_php_ini')}
                            aria-label={t('php.open_php_ini')}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">description</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onUninstallPhp(php)}
                            title={t('php.uninstall')}
                            aria-label={t('php.uninstall')}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                );
            },
        },
    ];

    return (
        <DataTable
            data={phpInstances}
            columns={columns}
            keyExtractor={(php) => php.id}
        />
    );
}
