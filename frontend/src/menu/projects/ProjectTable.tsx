import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable, { type ColumnDef, type TableSearchConfig } from '../../components/DataTable';
import type { ProjectData, RunningServerInfo } from '../../context/ProjectContext';

export interface ProjectTableProps {
    readonly projects: ProjectData[];
    readonly serverInfoMap?: Record<string, RunningServerInfo>;
    readonly filters?: ReactNode;
    readonly search?: TableSearchConfig;
    readonly emptyState?: ReactNode;
    readonly onStartServer?: (id: string) => void;
    readonly onStopServer?: (id: string) => void;
    readonly onViewLogs?: (id: string) => void;
    readonly onOpenDocumentRoot: (path: string) => void;
    readonly onOpenSettings: (id: string) => void;
    readonly onSyncHost: (id: string) => void;
    readonly onDeleteClick: (id: string) => void;
    readonly onOpenBrowser: (domain: string) => void;
}

export default function ProjectTable({
    projects,
    serverInfoMap = {},
    filters,
    search,
    emptyState,
    onStartServer,
    onStopServer,
    onViewLogs,
    onOpenDocumentRoot,
    onOpenSettings,
    onSyncHost,
    onDeleteClick,
    onOpenBrowser,
}: ProjectTableProps) {
    const { t } = useTranslation();

    const columns: ColumnDef<ProjectData>[] = [
        {
            id: 'domain',
            header: t('projects.th_domain', t('apache.local_domain', 'Domain & Project')),
            render: (project) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={project.name}>
                        {project.name || t('apache.untitled_project')}
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenBrowser(project.domain)}
                        className="font-mono text-xs text-primary hover:underline flex items-center gap-1 w-fit mt-0.5"
                    >
                        <span>{project.domain}</span>
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </button>
                </div>
            ),
        },
        {
            id: 'runtime',
            header: t('projects.th_runtime', t('apache.routing_target', 'Type / Target')),
            render: (project) => {
                const isNonPhp = project.project_type && project.project_type !== 'php';
                const serverInfo = serverInfoMap[project.id];

                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {project.framework && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded w-fit">
                                    {project.framework}
                                </span>
                            )}
                            {isNonPhp && (
                                <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {project.project_type}
                                </span>
                            )}
                        </div>

                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                            {isNonPhp ? (
                                <span className="text-slate-500 text-[11px]">
                                    127.0.0.1:{project.proxy_port || 3000}
                                </span>
                            ) : (
                                <>
                                    <span>PHP {project.php_version || t('common.unknown')}</span>{' '}
                                    <span className="text-slate-400 text-[11px]">(Port {project.php_port || t('common.not_available')})</span>
                                </>
                            )}
                        </span>

                        {isNonPhp && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                                {serverInfo?.starting ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                        <span>{t('projects.server_starting')}</span>
                                    </span>
                                ) : serverInfo?.running ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>{t('projects.server_running')}</span>
                                        <span className="text-slate-400 font-mono text-[10px]">({serverInfo.pid})</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                                        <span>{t('projects.server_stopped')}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'docRoot',
            header: t('projects.th_doc_root', t('apache.document_root', 'Document Root')),
            render: (project) => (
                <div className="flex items-center gap-1.5 max-w-[260px]">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate" title={project.path}>
                        {project.path}
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenDocumentRoot(project.path)}
                        title={t('apache.open_document_root')}
                        aria-label={t('apache.open_document_root')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">folder</span>
                    </button>
                </div>
            ),
        },
        {
            id: 'hostStatus',
            header: t('projects.th_host_status', t('apache.host_status', 'Host Status')),
            render: (project) => (
                project.host_synced === false ? (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                {t('apache.hosts_not_synced')}
                            </span>
                            <button
                                type="button"
                                onClick={() => onSyncHost(project.id)}
                                className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/50 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[13px]">sync</span>
                                <span>{t('apache.retry_sync')}</span>
                            </button>
                        </div>
                        <span className="text-[11px] text-red-500 dark:text-red-400 leading-tight">
                            {t('apache.domain_not_routed')}
                        </span>
                    </div>
                ) : (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {t('apache.hosts_synced')}
                    </span>
                )
            ),
        },
        {
            id: 'actions',
            header: t('projects.th_actions', t('common.actions', 'Actions')),
            align: 'right',
            render: (project) => {
                const isNonPhp = project.project_type && project.project_type !== 'php';
                const serverInfo = serverInfoMap[project.id];

                return (
                    <div className="flex items-center justify-end gap-1.5">
                        {isNonPhp && (
                            serverInfo?.running ? (
                                <button
                                    type="button"
                                    onClick={() => onStopServer?.(project.id)}
                                    title={t('projects.stop_server')}
                                    aria-label={t('projects.stop_server')}
                                    className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-rose-600 dark:text-rose-400">stop_circle</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={serverInfo?.starting}
                                    onClick={() => onStartServer?.(project.id)}
                                    title={serverInfo?.starting ? t('projects.server_starting') : t('projects.start_server')}
                                    aria-label={serverInfo?.starting ? t('projects.server_starting') : t('projects.start_server')}
                                    className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors flex items-center justify-center disabled:opacity-60"
                                >
                                    <span className={`material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400 ${serverInfo?.starting ? 'animate-spin' : ''}`}>
                                        {serverInfo?.starting ? 'progress_activity' : 'play_circle'}
                                    </span>
                                </button>
                            )
                        )}

                        <button
                            type="button"
                            onClick={() => onOpenBrowser(project.domain)}
                            title={t('apache.open_in_browser')}
                            aria-label={t('apache.open_in_browser')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">open_in_browser</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpenSettings(project.id)}
                            title={t('apache.setup')}
                            aria-label={t('apache.setup')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                        </button>

                        {/* Action Dropdown Menu */}
                        <div className="relative group/menu inline-block text-left">
                            <button
                                type="button"
                                title={t('common.actions', 'Actions')}
                                aria-label={t('common.actions', 'Actions')}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-150">
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
                                            detail: { cwd: project.path, title: project.domain || project.name }
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
                                {isNonPhp && (
                                    <button
                                        type="button"
                                        onClick={() => onViewLogs?.(project.id)}
                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">receipt_long</span>
                                        <span className="truncate">{t('projects.view_server_logs')}</span>
                                    </button>
                                )}
                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                <button
                                    type="button"
                                    onClick={() => onDeleteClick(project.id)}
                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                    <span className="truncate">{t('apache.delete_project')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            },
        },
    ];

    return (
        <DataTable
            data={projects}
            columns={columns}
            keyExtractor={(project) => project.id}
            filters={filters}
            search={search}
            emptyState={emptyState}
        />
    );
}
