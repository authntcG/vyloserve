import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import InstalledBadge from '../../components/InstalledBadge';

import { ApacheProvider, useApache, type PortsStatusData } from '../../context/ApacheContext';
import ApacheInstallModal from './ApacheInstallModal';
import ApacheOptionsModal from './ApacheOptionsModal';

interface ApacheStatusSectionProps {
    readonly isFetching: boolean;
    readonly isInstalled: boolean;
    readonly installedVersion: string | null;
    readonly updateAvailable: string | null;
    readonly isRunning: boolean;
    readonly isToggling: boolean;
    readonly apachePath: string;
    readonly portsStatus: PortsStatusData | null;
    readonly onToggleServer: () => void;
    readonly onOpenOptions: () => void;
    readonly onOpenConfig: () => void;
    readonly onOpenVhostsConf: () => void;
    readonly onOpenLocalhost: () => void;
    readonly onOpenHtdocs: () => void;
    readonly onOpenConfDir: () => void;
    readonly onOpenLogsDir: () => void;
    readonly onOpenDirectory: () => void;
    readonly onUninstallClick: () => void;
    readonly onInstallClick: () => void;
    readonly onUpdateClick: () => void;
    readonly t: any;
}

function ApacheStatusSection({
    isFetching,
    isInstalled,
    installedVersion,
    updateAvailable,
    isRunning,
    isToggling,
    apachePath,
    portsStatus,
    onToggleServer,
    onOpenOptions,
    onOpenConfig,
    onOpenVhostsConf,
    onOpenLocalhost,
    onOpenHtdocs,
    onOpenConfDir,
    onOpenLogsDir,
    onOpenDirectory,
    onUninstallClick,
    onInstallClick,
    onUpdateClick,
    t,
}: ApacheStatusSectionProps) {
    if (isFetching) {
        return <div className="mb-8"><SkeletonCard /></div>;
    }
    if (!isInstalled) {
        return (
            <div className="mb-8">
                <EmptyState
                    icon="dns"
                    title={t('apache.not_installed_title')}
                    description={t('apache.not_installed_desc')}
                    actionText={t('apache.install_now')}
                    onAction={onInstallClick}
                />
            </div>
        );
    }

    const renderPortBadge = (port: number, status: 'listening' | 'ready' | 'conflict' = 'ready') => {
        let badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        if (status === 'listening') {
            badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
        } else if (status === 'conflict') {
            badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
        }
        return (
            <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{port}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-semibold tracking-wider ${badgeColor}`}>
                    {t(`apache.port_status_${status}`)}
                </span>
            </span>
        );
    };

    return (
        <div className="mb-6">
            <Card
                title={`Apache ${installedVersion || t('common.unknown')} (Win64)`}
                status={isRunning ? 'running' : 'stopped'}
                updateVersion={updateAvailable || null}
                gridCols="grid-cols-2 md:grid-cols-3"
                dropdownActions={
                    <>
                        <button type="button" onClick={onOpenLocalhost} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">language</span>
                            <span className="truncate">{t('apache.quick_open_localhost')}</span>
                        </button>
                        <button type="button" onClick={onOpenHtdocs} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder</span>
                            <span className="truncate">{t('apache.quick_open_htdocs')}</span>
                        </button>
                        <button type="button" onClick={onOpenConfig} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">description</span>
                            <span className="truncate">{t('apache.open_httpd_conf')}</span>
                        </button>
                        <button type="button" onClick={onOpenVhostsConf} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">settings_ethernet</span>
                            <span className="truncate">{t('apache.quick_open_vhosts_conf')}</span>
                        </button>
                        <button type="button" onClick={onOpenConfDir} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                            <span className="truncate">{t('apache.quick_open_conf_dir')}</span>
                        </button>
                        <button type="button" onClick={onOpenLogsDir} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">receipt_long</span>
                            <span className="truncate">{t('apache.quick_open_logs_dir')}</span>
                        </button>
                        <button type="button" onClick={onOpenDirectory} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                            <span className="truncate">{t('apache.open_directory')}</span>
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        {updateAvailable && (
                            <button
                                type="button"
                                onClick={onUpdateClick}
                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-slate-100 dark:hover:bg-slate-700/70 font-medium transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                <span className="truncate">{t('ui.update.update_to_target', { version: updateAvailable })}</span>
                            </button>
                        )}
                        <button type="button" onClick={onUninstallClick} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                            <span className="truncate">{t('apache.uninstall_server')}</span>
                        </button>
                    </>
                }
                footerActions={
                    <>
                        <ServiceToggleButton
                            isRunning={isRunning}
                            isToggling={isToggling}
                            onClick={onToggleServer}
                            className="flex-1"
                            labels={{
                                start: t('apache.start_server'),
                                stop: t('apache.stop_server'),
                                starting: t('apache.starting'),
                                stopping: t('apache.stopping'),
                            }}
                        />
                        {isRunning && (
                            <button
                                type="button"
                                onClick={onOpenLocalhost}
                                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs sm:text-sm font-medium py-2 px-3.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                                title={t('apache.quick_open_localhost')}
                            >
                                <span className="material-symbols-outlined text-[18px] text-primary">open_in_browser</span>
                                <span className="truncate">{t('apache.open_in_browser', 'Open Browser')}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onOpenOptions}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">tune</span> {t('apache.config')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.listening_port')}</span>
                    <div className="flex items-center gap-2.5 flex-wrap font-mono text-xs">
                        {renderPortBadge(portsStatus?.http?.port ?? 80, portsStatus?.http?.status)}
                        <span className="text-slate-300 dark:text-slate-700 font-bold">•</span>
                        {renderPortBadge(portsStatus?.https?.port ?? 443, portsStatus?.https?.status)}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.architecture')}</span>
                    <span className="font-mono text-sm text-slate-900 dark:text-slate-200">x64 (VS17/VS18)</span>
                </div>
                <div className="flex flex-col gap-1 col-span-2 md:col-span-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.server_path')}</span>
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={apachePath}>{apachePath}</span>
                </div>
            </Card>
        </div>
    );
}

function ApacheMainView() {
    const { t } = useTranslation();
    const {
        isFetchingApacheStatus,
        isApacheInstalled,
        installedApacheVersion,
        updateAvailable,
        isApacheRunning,
        isTogglingServer,
        apachePath,
        portsStatus,
        handleToggleServer,
        openOptionsModal,
        openConfigFile,
        openDirectory,
        openLocalhost,
        openHtdocs,
        openConfDir,
        openLogsDir,
        openVhostsConf,
        handleUninstall,
        openInstallModal,
        handleUpdateApacheClick,
        isInstalling,
        isInstallServerOpen,
        progress,
        progressText,
        restoreProgressWidget,
    } = useApache();

    const getProgressTitle = () => {
        if (isApacheInstalled) return t('apache.updating_apache');
        return t('apache.installing_apache');
    };

    return (
        <>
            <div className="flex flex-col w-full">
                <PageHeader
                    icon="dns"
                    title={t('apache.title')}
                    subtitle={
                        <>
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            {isApacheInstalled ? t('apache.installed_instance') : t('apache.not_installed')}
                        </>
                    }
                    actions={
                        isApacheInstalled ? (
                            <InstalledBadge />
                        ) : (
                            <Button variant="primary" icon="download" onClick={openInstallModal} className="shadow-sm">
                                {t('apache.install_now')}
                            </Button>
                        )
                    }
                />

                <ApacheStatusSection
                    isFetching={isFetchingApacheStatus}
                    isInstalled={isApacheInstalled}
                    installedVersion={installedApacheVersion}
                    updateAvailable={updateAvailable}
                    isRunning={isApacheRunning}
                    isToggling={isTogglingServer}
                    apachePath={apachePath}
                    portsStatus={portsStatus}
                    onToggleServer={handleToggleServer}
                    onOpenOptions={openOptionsModal}
                    onOpenConfig={openConfigFile}
                    onOpenVhostsConf={openVhostsConf}
                    onOpenLocalhost={openLocalhost}
                    onOpenHtdocs={openHtdocs}
                    onOpenConfDir={openConfDir}
                    onOpenLogsDir={openLogsDir}
                    onOpenDirectory={openDirectory}
                    onUninstallClick={handleUninstall}
                    onInstallClick={openInstallModal}
                    onUpdateClick={handleUpdateApacheClick}
                    t={t}
                />
            </div>

            {/* WIDGETS & MODALS */}
            <BackgroundProgressWidget
                isOpen={isInstalling && !isInstallServerOpen}
                progress={progress}
                progressText={progressText}
                title={getProgressTitle()}
                onRestore={restoreProgressWidget}
            />

            <ApacheInstallModal />
            <ApacheOptionsModal />
        </>
    );
}

export default function ApacheMain() {
    return (
        <ApacheProvider>
            <ApacheMainView />
        </ApacheProvider>
    );
}
