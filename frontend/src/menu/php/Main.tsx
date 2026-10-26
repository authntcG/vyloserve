import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import ViewModeToggle, { type ViewMode } from '../../components/ViewModeToggle';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { compareVersions } from '../../utils/version';

import { PhpProvider, usePhp } from '../../context/PhpContext';
import PhpNewInstanceModal from './PhpNewInstanceModal';
import PhpSettingsModal from './PhpSettingsModal';
import PhpTable from './PhpTable';

export type { PhpInstance } from '../../context/PhpContext';

function PhpMainView() {
    const { t } = useTranslation();
    const {
        instances,
        isLoading,
        togglingInstanceId,
        availableVersions,
        openNewInstanceModal,
        openPhpIni,
        openPhpDir,
        handleUpdatePhp,
        handleConfirmUninstall,
        handleToggleStatus,
        handleOpenSettings,
        isInstalling,
        isNewInstanceOpen,
        progress,
        progressText,
    } = usePhp();

    const [viewMode, setViewMode] = useState<ViewMode>('card');

    const updateMap = useMemo(() => {
        const map: Record<string, { version: string; filename: string } | null> = {};
        for (const php of instances) {
            const majorMinor = php.version.split('.').slice(0, 2).join('.');
            const updateVer = availableVersions.find(v => v.version.split('.').slice(0, 2).join('.') === majorMinor && compareVersions(v.version, php.version) > 0);
            map[php.id] = updateVer ? { version: updateVer.version, filename: updateVer.filename } : null;
        }
        return map;
    }, [instances, availableVersions]);

    return (
        <>
            <div className="flex flex-col w-full">
                <PageHeader
                    icon="php"
                    title={t('php.php_engines')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {instances.length}{t('php.instances_installed')}
                        </>
                    }
                    actions={
                        <div className="flex items-center gap-2">
                            {instances.length > 0 && (
                                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                            )}
                            <Button variant="primary" icon="add" onClick={openNewInstanceModal} className="shadow-sm">
                                {t('php.add_version')}
                            </Button>
                        </div>
                    }
                />

                <div className="mt-6">
                    {(() => {
                        if (isLoading) {
                            return (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                                    {[1, 2].map((item) => <SkeletonCard key={item} />)}
                                </div>
                            );
                        }
                        if (instances.length === 0) {
                            return (
                                <EmptyState
                                    icon="terminal"
                                    title={t('php.no_php_versions_installed')}
                                    description={t('php.no_php_versions_desc')}
                                    actionText={t('php.download_now')}
                                    onAction={openNewInstanceModal}
                                />
                            );
                        }
                        if (viewMode === 'table') {
                            return (
                                <PhpTable
                                    phpInstances={instances}
                                    togglingInstanceId={togglingInstanceId}
                                    updateMap={updateMap}
                                    onToggleStatus={handleToggleStatus}
                                    onOpenSettings={handleOpenSettings}
                                    onOpenPhpIni={openPhpIni}
                                    onOpenPhpDir={openPhpDir}
                                    onUpdatePhp={handleUpdatePhp}
                                    onUninstallPhp={handleConfirmUninstall}
                                />
                            );
                        }
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                                {instances.map(php => {
                                    const isRunning = php.status === 'running';
                                    const updateVer = updateMap[php.id];
                                    return (
                                        <Card
                                            key={php.id}
                                            title={php.name}
                                            status={php.status}
                                            updateVersion={updateVer?.version || null}
                                            gridCols="grid-cols-2 md:grid-cols-3"
                                            dropdownActions={
                                                <>
                                                    <button type="button" onClick={() => openPhpIni(php.version)} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">description</span>
                                                        <span className="truncate">{t('php.open_php_ini')}</span>
                                                    </button>
                                                    <button type="button" onClick={() => openPhpDir(php.version)} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                                                        <span className="truncate">{t('php.open_directory')}</span>
                                                    </button>
                                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                                    {updateVer && (
                                                        <button type="button" onClick={() => handleUpdatePhp(php, updateVer.version, updateVer.filename)} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/70 font-medium transition-colors">
                                                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                                            <span className="truncate">{t('php.update_to', { version: updateVer.version })}</span>
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => handleConfirmUninstall(php)} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                        <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                                        <span className="truncate">{t('php.uninstall')}</span>
                                                    </button>
                                                </>
                                            }
                                            footerActions={
                                                <>
                                                    <ServiceToggleButton
                                                        isRunning={isRunning}
                                                        isToggling={togglingInstanceId === php.id}
                                                        onClick={() => handleToggleStatus(php)}
                                                        className="flex-1"
                                                        labels={{
                                                            start: t('php.start_cgi'),
                                                            stop: t('php.stop_cgi'),
                                                            starting: t('php.starting'),
                                                            stopping: t('php.stopping'),
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => handleOpenSettings(php)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                                                        <span className="material-symbols-outlined text-[18px]">tune</span> {t('php.config')}
                                                    </button>
                                                </>
                                            }
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-500 uppercase">{t('php.fastcgi_port')}</span>
                                                <span className="font-mono text-sm text-primary">{php.port}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-500 uppercase">{t('php.memory_limit')}</span>
                                                <span className="font-mono text-sm text-slate-900 dark:text-slate-200">{php.memory_limit}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                                                <span className="text-xs font-medium text-slate-500 uppercase">{t('php.path')}</span>
                                                <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={php.dir}>{php.dir}</span>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* WIDGET & MODALS */}
            <BackgroundProgressWidget
                isOpen={isInstalling && !isNewInstanceOpen}
                progress={progress}
                progressText={progressText}
                title={t('php.processing')}
                onRestore={openNewInstanceModal}
            />

            <PhpNewInstanceModal />
            <PhpSettingsModal />
        </>
    );
}

export default function PhpMain() {
    return (
        <PhpProvider>
            <PhpMainView />
        </PhpProvider>
    );
}