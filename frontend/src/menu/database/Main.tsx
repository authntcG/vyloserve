import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import ViewModeToggle from '../../components/ViewModeToggle';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import FilterChips from '../../components/FilterChips';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import LogFileViewerModal from '../../components/LogFileViewerModal';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import {
    DatabaseProvider,
    useDatabase,
    type DbEngineType,
} from '../../context/DatabaseContext';
import DatabaseNewInstanceModal from './DatabaseNewInstanceModal';
import DatabasePasswordModal from './DatabasePasswordModal';
import DatabaseSettingsModal from './DatabaseSettingsModal';
import DatabaseSchemaModal from './DatabaseSchemaModal';
import DatabaseTable from './DatabaseTable';

export type { DbInstance, DbEngineType, AvailableUpdate } from '../../context/DatabaseContext';

const getConfigFileLabel = (engine: string | undefined, t: TFunction) => {
    if (engine === 'postgres') return t('database.open_postgres_conf');
    if (engine === 'redis') return 'redis.conf';
    return t('database.open_my_ini');
};

const getEngineIcon = (engine: string | undefined) => {
    if (engine === 'postgres') return 'storage';
    if (engine === 'redis') return 'memory';
    return 'database';
};

const getEngineLabel = (engine: string | undefined, t: TFunction) => {
    if (engine === 'postgres') return t('database.postgres');
    if (engine === 'redis') return t('database.redis');
    return t('database.mysql_mariadb');
};

function DatabaseMainView() {
    const { t } = useTranslation();
    const {
        dbInstances,
        isLoading,
        togglingDbId,
        activeTab,
        setActiveTab,
        filteredInstances,
        availableUpdates,
        isInstalling,
        isCancelling,
        handleCancelInstall,
        isNewInstanceOpen,
        progress,
        progressText,
        logViewer,
        setLogViewer,
        fetchDbLogContent,
        openNewInstanceModal,
        openSettingsModal,
        openPasswordModal,
        openSchemaModal,
        handleToggleDB,
        handleUpdateDatabase,
        handleConfirmUninstall,
    } = useDatabase();

    const [viewMode, setViewMode] = usePersistedViewMode('database', 'card');

    const engineCounts = useMemo(() => ({
        all: dbInstances.length,
        mysql: dbInstances.filter((db) => db.engine === 'mysql').length,
        postgres: dbInstances.filter((db) => db.engine === 'postgres').length,
        redis: dbInstances.filter((db) => db.engine === 'redis').length,
    }), [dbInstances]);

    const filterItems = [
        { id: 'all' as const, label: t('database.all_instances'), count: engineCounts.all },
        { id: 'mysql' as const, label: t('database.mysql_mariadb'), count: engineCounts.mysql },
        { id: 'postgres' as const, label: t('database.postgres'), count: engineCounts.postgres },
        { id: 'redis' as const, label: t('database.redis', 'Redis'), count: engineCounts.redis },
    ];

    return (
        <>
            <div className="flex flex-col w-full">
                <PageHeader
                    icon="database"
                    title={t('database.db_engine')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {dbInstances.length}{t('database.instances_installed')}
                        </>
                    }
                    actions={
                        <div className="flex items-center gap-2">
                            {dbInstances.length > 0 && (
                                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                            )}
                            <Button variant="primary" icon="add" onClick={openNewInstanceModal} className="shadow-sm">
                                {t('database.add_engine')}
                            </Button>
                        </div>
                    }
                />

                {(() => {
                    if (isLoading) {
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                                {[1, 2].map((item) => <SkeletonCard key={item} />)}
                            </div>
                        );
                    }
                    if (dbInstances.length === 0) {
                        return (
                            <EmptyState
                                icon="database"
                                title={t('database.no_instances_found')}
                                description={t('database.no_instances_desc')}
                                actionText={t('database.download_db_now')}
                                onAction={openNewInstanceModal}
                            />
                        );
                    }

                    const filterChipsElement = (
                        <FilterChips
                            items={filterItems}
                            selectedId={activeTab}
                            onChange={(val) => setActiveTab(val as DbEngineType | 'all')}
                            ariaLabel={t('database.all_instances')}
                        />
                    );

                    const noMatchingEmptyState = (
                        <EmptyState
                            icon="database"
                            title={t('database.no_instances_found')}
                            description={t('database.no_instances_desc')}
                            actionText={activeTab !== 'all' ? t('projects.clear_filters', 'Clear Filters') : t('database.download_db_now')}
                            onAction={activeTab !== 'all' ? () => setActiveTab('all') : openNewInstanceModal}
                        />
                    );

                    if (viewMode === 'table') {
                        return (
                            <DatabaseTable
                                dbInstances={filteredInstances}
                                togglingDbId={togglingDbId}
                                availableUpdates={availableUpdates}
                                filters={filterChipsElement}
                                emptyState={noMatchingEmptyState}
                                onToggleStatus={handleToggleDB}
                                onOpenSettings={openSettingsModal}
                                onOpenPasswordModal={openPasswordModal}
                                onOpenSchemas={openSchemaModal}
                                onOpenConfigFile={(db) => window.pywebview?.api?.open_db_config_file(db.id)}
                                onOpenDataDir={(db) => window.pywebview?.api?.open_db_dir(db.id)}
                                onOpenLogs={(db, type) => setLogViewer({ dbId: db.id, type })}
                                onUpdateDatabase={handleUpdateDatabase}
                                onUninstallDatabase={handleConfirmUninstall}
                            />
                        );
                    }
                    return (
                        <>
                            <div className="mb-4">
                                {filterChipsElement}
                            </div>
                            {filteredInstances.length === 0 ? (
                                noMatchingEmptyState
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                                    {filteredInstances.map(db => {
                                        const isRunning = db.status === 'running';
                                        const update = availableUpdates[db.id];
                                        return (
                                            <Card
                                                key={db.id}
                                        title={db.name}
                                        status={db.status}
                                        updateVersion={update?.version || null}
                                        gridCols="grid-cols-2 md:grid-cols-3"
                                        dropdownActions={
                                            <>
                                                {db.engine !== 'redis' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openSchemaModal(db)}
                                                        disabled={!isRunning}
                                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">database</span>
                                                        <span className="truncate">{t('database.manage_schemas')}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => window.pywebview?.api?.open_db_config_file(db.id)}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">description</span>
                                                    <span className="truncate">{getConfigFileLabel(db.engine, t)}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => window.pywebview?.api?.open_db_dir(db.id)}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                                                    <span className="truncate">{t('database.open_data_folder')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLogViewer({ dbId: db.id, type: 'startup' })}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">history</span>
                                                    <span className="truncate">{t('settings.log_file_startup')}</span>
                                                </button>

                                                {db.engine === 'mysql' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setLogViewer({ dbId: db.id, type: 'native' })}
                                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">article</span>
                                                        <span className="truncate">{t('settings.log_file_native')}</span>
                                                    </button>
                                                )}

                                                {db.engine !== 'redis' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openPasswordModal(db)}
                                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">key</span>
                                                        <span className="truncate">{t('database.change_password')}</span>
                                                    </button>
                                                )}

                                                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                                {update && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateDatabase(db)}
                                                        disabled={isInstalling}
                                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/70 font-medium disabled:opacity-50 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                                        <span className="truncate">{t('database.update_to', { version: update.version })}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleConfirmUninstall(db)}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                                    <span className="truncate">{t('database.drop_engine')}</span>
                                                </button>
                                            </>
                                        }
                                        footerActions={
                                            <>
                                                <ServiceToggleButton
                                                    isRunning={isRunning}
                                                    isToggling={togglingDbId === db.id}
                                                    onClick={() => handleToggleDB(db)}
                                                    className="flex-1"
                                                    labels={{
                                                        start: t('database.start_db'),
                                                        stop: t('database.stop_db'),
                                                        starting: t('database.start_db'),
                                                        stopping: t('database.stop_db'),
                                                    }}
                                                />
                                                {isRunning && db.engine !== 'redis' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openSchemaModal(db)}
                                                        title={t('database.manage_schemas')}
                                                        aria-label={t('database.manage_schemas')}
                                                        className="flex-1 min-w-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 text-sm font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px] shrink-0">database</span>
                                                        <span className="truncate">{t('database.manage_schemas')}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openSettingsModal(db)}
                                                    title={t('database.config')}
                                                    aria-label={t('database.config')}
                                                    className="flex-1 min-w-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 text-sm font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-[18px] shrink-0">tune</span>
                                                    <span className="truncate">{t('database.config')}</span>
                                                </button>
                                            </>
                                        }
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{t('database.engine')}</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">
                                                    {getEngineIcon(db.engine)}
                                                </span>
                                                {getEngineLabel(db.engine, t)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{t('database.port')}</span>
                                            <span className="font-mono text-sm text-primary truncate">{db.port}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2 md:col-span-3 min-w-0">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{t('database.data_directory')}</span>
                                            <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={db.dataDir}>{db.dataDir}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            );
        })()}
            </div>

            <LogFileViewerModal
                isOpen={logViewer !== null}
                onClose={() => setLogViewer(null)}
                title={logViewer?.type === 'native' ? t('settings.log_file_native') : t('settings.log_file_startup')}
                fetchContent={fetchDbLogContent}
            />

            <BackgroundProgressWidget
                isOpen={isInstalling && !isNewInstanceOpen}
                progress={progress}
                progressText={progressText}
                title={t('database.processing')}
                onRestore={openNewInstanceModal}
                onCancel={handleCancelInstall}
                isCancelling={isCancelling}
            />

            <DatabaseNewInstanceModal />
            <DatabasePasswordModal />
            <DatabaseSettingsModal />
            <DatabaseSchemaModal />
        </>
    );
}

export default function DatabaseMain() {
    return (
        <DatabaseProvider>
            <DatabaseMainView />
        </DatabaseProvider>
    );
}