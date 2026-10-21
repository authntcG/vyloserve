import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Tabs from '../../components/Tabs';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import LogFileViewerModal from '../../components/LogFileViewerModal';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import {
    DatabaseProvider,
    useDatabase,
} from '../../context/DatabaseContext';
import DatabaseNewInstanceModal from './DatabaseNewInstanceModal';
import DatabasePasswordModal from './DatabasePasswordModal';
import DatabaseSettingsModal from './DatabaseSettingsModal';

export type { DbInstance, DbEngineType, AvailableUpdate } from '../../context/DatabaseContext';

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
        isNewInstanceOpen,
        progress,
        progressText,
        logViewer,
        setLogViewer,
        fetchDbLogContent,
        openNewInstanceModal,
        openSettingsModal,
        openPasswordModal,
        handleToggleDB,
        handleUpdateDatabase,
        handleConfirmUninstall,
    } = useDatabase();

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
                        <Button variant="primary" icon="add" onClick={openNewInstanceModal} className="shadow-sm">
                            {t('database.add_engine')}
                        </Button>
                    }
                />

                <Tabs
                    tabs={[
                        { value: 'all', label: t('database.all_instances') },
                        { value: 'mysql', label: t('database.mysql_mariadb') },
                        { value: 'postgres', label: t('database.postgres') },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                />

                {(() => {
                    if (isLoading) {
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                                {[1, 2].map((item) => <SkeletonCard key={item} />)}
                            </div>
                        );
                    }
                    if (filteredInstances.length === 0) {
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
                    return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
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
                                                <button
                                                    type="button"
                                                    onClick={() => window.pywebview?.api?.open_db_config_file(db.id)}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">description</span>
                                                    <span className="truncate">{db.engine === 'postgres' ? t('database.open_postgres_conf') : t('database.open_my_ini')}</span>
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

                                                <button
                                                    type="button"
                                                    onClick={() => openPasswordModal(db)}
                                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">key</span>
                                                    <span className="truncate">{t('database.change_password')}</span>
                                                </button>

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
                                                <button
                                                    type="button"
                                                    onClick={() => openSettingsModal(db)}
                                                    className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">tune</span> {t('database.config')}
                                                </button>
                                            </>
                                        }
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{t('database.engine')}</span>
                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">
                                                    {db.engine === 'postgres' ? 'storage' : 'database'}
                                                </span>
                                                {db.engine === 'postgres' ? t('database.postgres') : t('database.mysql_mariadb')}
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
            />

            <DatabaseNewInstanceModal />
            <DatabasePasswordModal />
            <DatabaseSettingsModal />
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