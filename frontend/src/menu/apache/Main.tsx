import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import Button from '../../components/Button';
import ServiceToggleButton from '../../components/ServiceToggleButton';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import InfoBox from '../../components/InfoBox';
import PageHeader from '../../components/PageHeader';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';

import { ApacheProvider, useApache, type ProjectData } from '../../context/ApacheContext';
import ApacheInstallModal from './ApacheInstallModal';
import ApacheOptionsModal from './ApacheOptionsModal';
import ApacheNewProjectModal from './ApacheNewProjectModal';
import ApacheProjectSettingsModal from './ApacheProjectSettingsModal';
import ApacheDeleteProjectModal from './ApacheDeleteProjectModal';
import ApacheCliInstallModal from './ApacheCliInstallModal';

export { type ProjectData };

interface ApacheStatusSectionProps {
    readonly isFetching: boolean;
    readonly isInstalled: boolean;
    readonly installedVersion: string | null;
    readonly updateAvailable: string | null;
    readonly isRunning: boolean;
    readonly isToggling: boolean;
    readonly apachePath: string;
    readonly onToggleServer: () => void;
    readonly onOpenOptions: () => void;
    readonly onOpenConfig: () => void;
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
    onToggleServer,
    onOpenOptions,
    onOpenConfig,
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
    return (
        <div className="mb-8">
            <Card
                title={`Apache ${installedVersion || t('common.unknown')} (Win64)`}
                status={isRunning ? 'running' : 'stopped'}
                updateVersion={updateAvailable || null}
                gridCols="grid-cols-2 md:grid-cols-3"
                dropdownActions={
                    <>
                        {updateAvailable && (
                            <button
                                type="button"
                                onClick={onUpdateClick}
                                className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                                {t('ui.update.update_to_target', { version: updateAvailable })}
                            </button>
                        )}
                        <button type="button" onClick={onOpenConfig} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                            {t('apache.open_httpd_conf')}
                        </button>
                        <button type="button" onClick={onOpenDirectory} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                            {t('apache.open_directory')}
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                        <button type="button" onClick={onUninstallClick} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                            {t('apache.uninstall_server')}
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
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.listening_port')}</span>
                    <span className="font-mono text-sm text-primary">80, 443</span>
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

interface ApacheProjectCardProps {
    readonly project: ProjectData;
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
    readonly t: any;
}

function ApacheProjectCard({
    project,
    onOpenDocumentRoot,
    onOpenSettings,
    onSyncHost,
    onDeleteClick,
    onOpenBrowser,
    t,
}: ApacheProjectCardProps) {
    return (
        <Card
            title={project.name || t('apache.untitled_project')}
            gridCols="grid-cols-1"
            dropdownActions={
                <>
                    <button type="button" onClick={() => onOpenDocumentRoot(project.path)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                        {t('apache.open_document_root')}
                    </button>
                    <button type="button" onClick={() => onOpenSettings(project.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                        {t('apache.vhost_settings')}
                    </button>
                    {project.host_synced === false && (
                        <button type="button" onClick={() => onSyncHost(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                            {t('apache.retry_host_sync')}
                        </button>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                    <button type="button" onClick={() => onDeleteClick(project.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                        {t('apache.delete_project')}
                    </button>
                </>
            }
            footerActions={
                <>
                    <button
                        type="button"
                        onClick={() => onOpenBrowser(project.domain)}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">open_in_browser</span> {t('apache.open_in_browser')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenSettings(project.id)}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">settings</span> {t('apache.setup')}
                    </button>
                </>
            }
        >
            <div className="flex flex-col w-full gap-4">
                <div className="grid grid-cols-2 gap-y-4 gap-x-3 w-full">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.framework')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-200 capitalize">{project.framework || t('common.unknown')}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {project.project_type && project.project_type !== 'php' ? t('apache.runtime_proxy_target') : t('apache.php_engine')}
                        </span>
                        {project.project_type && project.project_type !== 'php' ? (
                            <span className="text-sm font-medium text-primary font-mono uppercase">
                                {project.project_type} <span className="text-slate-400 text-xs lowercase">(127.0.0.1:{project.proxy_port || 3000})</span>
                            </span>
                        ) : (
                            <span className="text-sm font-medium text-primary font-mono">{project.php_version || t('common.unknown')} <span className="text-slate-400 text-xs">(Port {project.php_port || t('common.not_available')})</span></span>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.local_domain')}</span>
                        <button type="button" onClick={() => onOpenBrowser(project.domain)} className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit truncate outline-none">
                            {project.domain} <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </button>
                    </div>
                </div>
                {project.host_synced === false && (
                    <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-1">
                        <InfoBox tone="danger" icon="admin_panel_settings" title={t('apache.domain_not_routed')} className="animate-in fade-in">
                            <span className="leading-relaxed">{t('apache.domain_not_routed_desc')}</span>
                            <button
                                type="button"
                                onClick={() => onSyncHost(project.id)}
                                className="mt-1 self-start text-xs font-medium text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/50 hover:bg-red-300 dark:hover:bg-red-700/60 px-3 py-1.5 rounded-md flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[14px]">sync</span> {t('apache.retry_sync')}
                            </button>
                        </InfoBox>
                    </div>
                )}
            </div>
        </Card>
    );
}

interface ApacheProjectsSectionProps {
    readonly isFetching: boolean;
    readonly projects: ProjectData[];
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
    readonly t: any;
}

function ApacheProjectsSection({
    isFetching,
    projects,
    onOpenDocumentRoot,
    onOpenSettings,
    onSyncHost,
    onDeleteClick,
    onOpenBrowser,
    t,
}: ApacheProjectsSectionProps) {
    if (isFetching) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                {[1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)}
            </div>
        );
    }
    if (projects.length === 0) {
        return <EmptyState icon="folder_open" title={t('apache.no_projects_found')} description={t('apache.no_projects_desc')} />;
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
            {projects.map(project => (
                <ApacheProjectCard
                    key={project.id}
                    project={project}
                    onOpenDocumentRoot={onOpenDocumentRoot}
                    onOpenSettings={onOpenSettings}
                    onSyncHost={onSyncHost}
                    onDeleteClick={onDeleteClick}
                    onOpenBrowser={onOpenBrowser}
                    t={t}
                />
            ))}
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
        handleToggleServer,
        openOptionsModal,
        openConfigFile,
        openDirectory,
        handleUninstall,
        openInstallModal,
        handleUpdateApacheClick,
        projects,
        isFetchingProjects,
        handleOpenDocumentRoot,
        openProjectSettingsModal,
        handleSyncHost,
        openDeleteConfirmModal,
        handleOpenBrowser,
        openNewProjectModal,
        isCreatingProject,
        isNewProjectModalOpen,
        isInstalling,
        isInstallServerOpen,
        progress,
        progressText,
        restoreProgressWidget,
    } = useApache();

    const getProgressTitle = () => {
        if (!isInstalling) return t('apache.installing_project');
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
                            {isApacheInstalled ? t('apache.installed_instance') : t('apache.not_installed')} • {projects.length} {t('apache.virtual_hosts')}
                        </>
                    }
                    actions={
                        isApacheInstalled ? (
                            <button
                                type="button"
                                disabled
                                className="text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm bg-emerald-500 opacity-80 cursor-default whitespace-nowrap shrink-0"
                            >
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                {t('common.installed')}
                            </button>
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
                    onToggleServer={handleToggleServer}
                    onOpenOptions={openOptionsModal}
                    onOpenConfig={openConfigFile}
                    onOpenDirectory={openDirectory}
                    onUninstallClick={handleUninstall}
                    onInstallClick={openInstallModal}
                    onUpdateClick={handleUpdateApacheClick}
                    t={t}
                />

                <hr className="border-slate-200 dark:border-slate-800 mb-6" />

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{t('apache.virtual_hosts_title')}</h3>
                    <button
                        type="button"
                        onClick={openNewProjectModal}
                        disabled={!isApacheInstalled}
                        className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span> <span className="hidden sm:inline">{t('apache.add_project')}</span>
                    </button>
                </div>

                <ApacheProjectsSection
                    isFetching={isFetchingProjects}
                    projects={projects}
                    onOpenDocumentRoot={handleOpenDocumentRoot}
                    onOpenSettings={openProjectSettingsModal}
                    onSyncHost={handleSyncHost}
                    onDeleteClick={openDeleteConfirmModal}
                    onOpenBrowser={handleOpenBrowser}
                    t={t}
                />
            </div>

            {/* WIDGETS & MODALS */}
            <BackgroundProgressWidget
                isOpen={(isCreatingProject && !isNewProjectModalOpen) || (isInstalling && !isInstallServerOpen)}
                progress={progress}
                progressText={progressText}
                title={getProgressTitle()}
                onRestore={restoreProgressWidget}
            />

            <ApacheInstallModal />
            <ApacheOptionsModal />
            <ApacheNewProjectModal />
            <ApacheProjectSettingsModal />
            <ApacheDeleteProjectModal />
            <ApacheCliInstallModal />
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
