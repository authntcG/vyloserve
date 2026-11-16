import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import TableActionMenu, {
    tableActionItemClass,
    tableActionItemDangerClass,
    tableActionDividerClass,
} from '../../components/TableActionMenu';
import type { DbInstance, AvailableUpdate } from '../../context/DatabaseContext';

export interface DatabaseTableProps {
    readonly dbInstances: readonly DbInstance[];
    readonly togglingDbId: string | null;
    readonly availableUpdates: Record<string, AvailableUpdate | null>;
    readonly isInstalling?: boolean;
    readonly filters?: ReactNode;
    readonly emptyState?: ReactNode;
    readonly onToggleStatus: (db: DbInstance) => void;
    readonly onOpenSettings: (db: DbInstance) => void;
    readonly onOpenPasswordModal: (db: DbInstance) => void;
    readonly onOpenSchemas?: (db: DbInstance) => void;
    readonly onFlushRedis?: (db: DbInstance) => void;
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
    isInstalling,
    filters,
    emptyState,
    onToggleStatus,
    onOpenSettings,
    onOpenPasswordModal,
    onOpenSchemas,
    onFlushRedis,
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
                        aria-label={t('database.open_data_folder')}
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
                const update = availableUpdates[db.id];
                let configTitle = t('database.open_my_ini');
                if (db.engine === 'postgres') {
                    configTitle = t('database.open_postgres_conf');
                } else if (db.engine === 'redis') {
                    configTitle = 'redis.conf';
                }

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

                        {db.engine !== 'redis' ? (
                            <button
                                type="button"
                                disabled={!isRunning}
                                onClick={() => onOpenSchemas?.(db)}
                                title={t('database.manage_schemas')}
                                aria-label={t('database.manage_schemas')}
                                className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[18px]">database</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={!isRunning}
                                onClick={() => onFlushRedis?.(db)}
                                title={t('database.flush_redis', 'Flush Keys')}
                                aria-label={t('database.flush_redis', 'Flush Keys')}
                                className="p-2 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => onOpenSettings(db)}
                            title={t('database.config')}
                            aria-label={t('database.config')}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">tune</span>
                        </button>

                        <TableActionMenu estimatedHeight={db.engine === 'mysql' ? 320 : 280}>
                            {db.engine !== 'redis' ? (
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={!isRunning}
                                    onClick={() => onOpenSchemas?.(db)}
                                    className={tableActionItemClass}
                                >
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">database</span>
                                    <span className="truncate">{t('database.manage_schemas')}</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={!isRunning}
                                    onClick={() => onFlushRedis?.(db)}
                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-rose-500 shrink-0">cleaning_services</span>
                                    <span className="truncate">{t('database.flush_redis')}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onOpenConfigFile(db)}
                                className={tableActionItemClass}
                            >
                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">description</span>
                                <span className="truncate">{configTitle}</span>
                            </button>

                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onOpenDataDir(db)}
                                className={tableActionItemClass}
                            >
                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                                <span className="truncate">{t('database.open_data_folder')}</span>
                            </button>

                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onOpenLogs(db, 'startup')}
                                className={tableActionItemClass}
                            >
                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">history</span>
                                <span className="truncate">{t('settings.log_file_startup')}</span>
                            </button>

                            {db.engine === 'mysql' && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => onOpenLogs(db, 'native')}
                                    className={tableActionItemClass}
                                >
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">article</span>
                                    <span className="truncate">{t('settings.log_file_native')}</span>
                                </button>
                            )}

                            {db.engine !== 'redis' && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => onOpenPasswordModal(db)}
                                    className={tableActionItemClass}
                                >
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">key</span>
                                    <span className="truncate">{t('database.change_password')}</span>
                                </button>
                            )}

                            <div className={tableActionDividerClass} />

                            {update && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    disabled={isInstalling}
                                    onClick={() => onUpdateDatabase(db)}
                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/70 font-medium disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                    <span className="truncate">{t('database.update_to', { version: update.version })}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => onUninstallDatabase(db)}
                                className={tableActionItemDangerClass}
                            >
                                <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                <span className="truncate">{t('database.drop_engine')}</span>
                            </button>
                        </TableActionMenu>
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
