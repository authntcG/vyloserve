import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import { compareVersions } from '../../utils/version';

import { PhpProvider, usePhp } from '../../context/PhpContext';
import PhpNewInstanceModal from './PhpNewInstanceModal';
import PhpSettingsModal from './PhpSettingsModal';

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
                        <Button variant="primary" icon="add" onClick={openNewInstanceModal} className="shadow-sm">
                            {t('php.add_version')}
                        </Button>
                    }
                />

                <div className="mt-6">
                    {(() => {
                        if (isLoading) {
                            return (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
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
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                                {instances.map(php => {
                                    const isRunning = php.status === 'running';
                                    const majorMinor = php.version.split('.').slice(0, 2).join('.');
                                    const updateVer = availableVersions.find(v => v.version.split('.').slice(0, 2).join('.') === majorMinor && compareVersions(v.version, php.version) > 0);
                                    return (
                                        <Card
                                            key={php.id}
                                            title={php.name}
                                            status={php.status}
                                            updateVersion={updateVer?.version || null}
                                            gridCols="grid-cols-2 md:grid-cols-3"
                                            dropdownActions={
                                                <>
                                                    <button type="button" onClick={() => openPhpIni(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                        {t('php.open_php_ini')}
                                                    </button>
                                                    <button type="button" onClick={() => openPhpDir(php.version)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                        {t('php.open_directory')}
                                                    </button>
                                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                                                    {updateVer && (
                                                        <button type="button" onClick={() => handleUpdatePhp(php, updateVer.version, updateVer.filename)} className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-slate-100 dark:hover:bg-slate-700 font-medium">
                                                            <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">upgrade</span>
                                                            {t('php.update_to', { version: updateVer.version })}
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => handleConfirmUninstall(php)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                        {t('php.uninstall')}
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