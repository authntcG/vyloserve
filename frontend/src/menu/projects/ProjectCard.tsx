import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import InfoBox from '../../components/InfoBox';
import type { ProjectData, RunningServerInfo } from '../../context/ProjectContext';

export interface ProjectCardProps {
    readonly project: ProjectData;
    readonly serverInfo?: RunningServerInfo;
    readonly onStartServer?: (id: string) => void;
    readonly onStopServer?: (id: string) => void;
    readonly onViewLogs?: (id: string) => void;
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
}

export default function ProjectCard({
    project,
    serverInfo,
    onStartServer,
    onStopServer,
    onViewLogs,
    onOpenDocumentRoot,
    onOpenSettings,
    onSyncHost,
    onDeleteClick,
    onOpenBrowser,
}: ProjectCardProps) {
    const { t } = useTranslation();

    const getRuntimeBadge = () => {
        if (project.project_type && project.project_type !== 'php') {
            return (
                <span className="text-sm font-medium text-primary font-mono uppercase">
                    {project.project_type} <span className="text-slate-400 text-xs lowercase">(127.0.0.1:{project.proxy_port || 3000})</span>
                </span>
            );
        }
        return (
            <span className="text-sm font-medium text-primary font-mono">
                {project.php_version || t('common.unknown')} <span className="text-slate-400 text-xs">(Port {project.php_port || t('common.not_available')})</span>
            </span>
        );
    };

    return (
        <Card
            title={project.name || t('apache.untitled_project')}
            gridCols="grid-cols-1"
            dropdownActions={
                <>
                    <button
                        type="button"
                        onClick={() => onOpenDocumentRoot(project.path)}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder_open</span>
                        <span className="truncate">{t('apache.open_document_root')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('vylo_open_terminal_project', {
                                detail: {
                                    cwd: project.path,
                                    title: project.domain || project.name
                                }
                            }));
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">terminal</span>
                        <span className="truncate">{t('apache.open_in_terminal')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenSettings(project.id)}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">tune</span>
                        <span className="truncate">{t('apache.vhost_settings')}</span>
                    </button>
                    {project.project_type && project.project_type !== 'php' && (
                        <button
                            type="button"
                            onClick={() => onViewLogs?.(project.id)}
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">terminal</span>
                            <span className="truncate">{t('projects.view_server_logs')}</span>
                        </button>
                    )}
                    {project.host_synced === false && (
                        <button
                            type="button"
                            onClick={() => onSyncHost(project.id)}
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0">sync</span>
                            <span className="truncate">{t('apache.retry_host_sync')}</span>
                        </button>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                    <button
                        type="button"
                        onClick={() => onDeleteClick(project.id)}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                        <span className="truncate">{t('apache.delete_project')}</span>
                    </button>
                </>
            }
            footerActions={
                project.project_type && project.project_type !== 'php' ? (
                    <>
                        {serverInfo?.running ? (
                            <button
                                type="button"
                                onClick={() => onStopServer?.(project.id)}
                                className="flex-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-sm font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px] text-rose-600 dark:text-rose-400">stop_circle</span>
                                <span className="truncate">{t('projects.stop_server')}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={serverInfo?.starting}
                                onClick={() => onStartServer?.(project.id)}
                                className="flex-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-60 text-sm font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                <span className={`material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400 ${serverInfo?.starting ? 'animate-spin' : ''}`}>
                                    {serverInfo?.starting ? 'progress_activity' : 'play_circle'}
                                </span>
                                <span className="truncate">{serverInfo?.starting ? t('projects.server_starting') : t('projects.start_server')}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onOpenBrowser(project.domain)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">open_in_browser</span>
                            <span className="truncate">{t('apache.open_in_browser')}</span>
                        </button>
                    </>
                ) : (
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
                )
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
                        {getRuntimeBadge()}
                    </div>
                    {project.project_type && project.project_type !== 'php' && (
                        <div className="flex flex-col gap-1 col-span-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {t('projects.dev_server_status')}
                            </span>
                            {serverInfo?.starting ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                    {t('projects.server_starting')}
                                </span>
                            ) : serverInfo?.running ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {t('projects.server_running')} <span className="text-slate-400 font-mono text-[11px]">(PID: {serverInfo.pid})</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                                    {t('projects.server_stopped')}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apache.local_domain')}</span>
                        <button
                            type="button"
                            onClick={() => onOpenBrowser(project.domain)}
                            className="font-mono text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:text-primary transition-colors w-fit truncate outline-none"
                        >
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
