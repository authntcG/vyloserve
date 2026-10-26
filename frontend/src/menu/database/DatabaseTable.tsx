import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import type { DbInstance, AvailableUpdate } from '../../context/DatabaseContext';

export interface DatabaseTableProps {
    readonly dbInstances: readonly DbInstance[];
    readonly togglingDbId: string | null;
    readonly availableUpdates: Record<string, AvailableUpdate | null>;
    readonly filters?: ReactNode;
    readonly emptyState?: ReactNode;
    readonly onToggleStatus: (db: DbInstance) => void;
    readonly onOpenSettings: (db: DbInstance) => void;
    readonly onOpenPasswordModal: (db: DbInstance) => void;
    readonly onOpenConfigFile: (db: DbInstance) => void;
    readonly onOpenDataDir: (db: DbInstance) => void;
    readonly onOpenLogs: (db: DbInstance, type: 'startup' | 'native') => void;
    readonly onUpdateDatabase: (db: DbInstance) => void;
    readonly onUninstallDatabase: (db: DbInstance) => void;
}

export default function DatabaseTable({
    dbInstances,
    togglingDbId,
    availableUpdates,
    filters,
    emptyState,
    onToggleStatus,
    onOpenSettings,
    onOpenPasswordModal,
    onOpenConfigFile,
    onOpenDataDir,
    onOpenLogs,
    onUpdateDatabase,
    onUninstallDatabase,
}: DatabaseTableProps) {
    const { t } = useTranslation();

    const columns: ColumnDef<DbInstance>[] = [
        {
            id: 'status',
            header: t('database.th_status', 'Status'),
            width: '130px',
            render: (db) => {
                const isRunning = db.status === 'running';
                return isRunning ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500" />
                        {t('database.running', 'Running')}
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400" />
                        {t('database.stopped', 'Stopped')}
                    </span>
                );
            },
        },
        {
            id: 'engine_version',
            header: t('database.th_engine_version', 'Engine & Version'),
            render: (db) => {
                const update = availableUpdates[db.id];
                return (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white">
                                {db.name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {db.engine}
                            </span>
                            {update && (
                                <button
                                    type="button"
                                    onClick={() => onUpdateDatabase(db)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                    title={t('ui.update.update_to_target', { version: update.version })}
                                >
                                    <span className="material-symbols-outlined text-[12px]">upgrade</span>
                                    <span>{update.version}</span>
                                </button>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'port',
            header: t('database.th_port', 'Port'),
            render: (db) => (
                <span className="font-mono text-xs font-semibold text-primary">
                    {db.port}
                </span>
            ),
        },
        {
            id: 'dataDir',
            header: t('database.th_data_dir', 'Data Directory'),
            render: (db) => (
                <div className="flex items-center gap-1.5 max-w-[240px]">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate" title={db.dataDir}>
                        {db.dataDir}
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenDataDir(db)}
                        title={t('database.open_data_folder')}
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
            render: (db) => {
                const isRunning = db.status === 'running';
                const isToggling = togglingDbId === db.id;

                return (
                    <div className="flex items-center justify-end gap-1.5">
                        <ServiceToggleButton
                            isRunning={isRunning}
                            isToggling={isToggling}
                            onClick={() => onToggleStatus(db)}
                            iconOnly
                            labels={{
                                start: t('database.start_db'),
                                stop: t('database.stop_db'),
                                starting: t('database.starting'),
                                stopping: t('database.stopping'),
                            }}
                        />

                        <button
                            type="button"
                            onClick={() => onOpenSettings(db)}
                            title={t('database.config')}
                            aria-label={t('database.config')}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">tune</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpenPasswordModal(db)}
                            title={t('database.change_password')}
                            aria-label={t('database.change_password')}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">key</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpenConfigFile(db)}
                            title={db.engine === 'postgres' ? t('database.open_postgres_conf') : t('database.open_my_ini')}
                            aria-label={db.engine === 'postgres' ? t('database.open_postgres_conf') : t('database.open_my_ini')}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">description</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpenLogs(db, 'startup')}
                            title={t('settings.log_file_startup')}
                            aria-label={t('settings.log_file_startup')}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">history</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUninstallDatabase(db)}
                            title={t('database.uninstall')}
                            aria-label={t('database.uninstall')}
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
            data={dbInstances}
            columns={columns}
            keyExtractor={(db) => db.id}
            filters={filters}
            emptyState={emptyState}
        />
    );
}
