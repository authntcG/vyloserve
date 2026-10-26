import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import { type RuntimeVersionItem, type RuntimeEngine } from '../../context/RuntimesContext';

export interface RuntimeTableProps {
    readonly engine: RuntimeEngine;
    readonly versions: readonly RuntimeVersionItem[];
    readonly isProcessing: boolean;
    readonly updateAvailable?: string;
    readonly hasExternal?: boolean;
    readonly isPathActive?: boolean;
    readonly onSetActive: (version: string) => void;
    readonly onDeactivate?: (version: string) => void;
    readonly onUpdate?: (newVersion: string, oldVersion: string) => void;
    readonly onOpenFolder: (version: string) => void;
    readonly onOpenTerminal: (version: string) => void;
    readonly onUninstall: (version: string) => void;
}

export default function RuntimeTable({
    engine,
    versions,
    isProcessing,
    updateAvailable,
    hasExternal = false,
    isPathActive = false,
    onSetActive,
    onDeactivate,
    onUpdate,
    onOpenFolder,
    onOpenTerminal,
    onUninstall,
}: RuntimeTableProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredVersions = useMemo(() => {
        if (!searchQuery.trim()) return versions;
        const q = searchQuery.toLowerCase();
        return versions.filter((v) =>
            v.version.toLowerCase().includes(q) ||
            (v.subtool || '').toLowerCase().includes(q) ||
            v.path.toLowerCase().includes(q)
        );
    }, [versions, searchQuery]);

    const columns: ColumnDef<RuntimeVersionItem>[] = [
        {
            id: 'status',
            header: t('runtimes.th_status'),
            width: '150px',
            render: (item) => {
                if (item.is_active) {
                    if (hasExternal) {
                        return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-primary/10 text-primary border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-primary" />
                                {t('runtimes.active_vyloserve')}
                            </span>
                        );
                    }
                    if (isPathActive || item.in_path) {
                        return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500" />
                                {t('runtimes.active_in_path')}
                            </span>
                        );
                    }
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-primary/10 text-primary border-primary/20">
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-primary" />
                            {t('runtimes.active_isolated')}
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400" />
                        {t('runtimes.isolated_version')}
                    </span>
                );
            },
        },
        {
            id: 'version',
            header: t('runtimes.th_version'),
            render: (item) => {
                return (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {engine.toUpperCase()} {item.version}
                        </span>
                        {item.is_active && updateAvailable && (
                            <button
                                type="button"
                                onClick={() => onUpdate?.(updateAvailable, item.version)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                title={t('ui.update.update_to_target', { version: updateAvailable })}
                                aria-label={t('ui.update.update_to_target', { version: updateAvailable })}
                            >
                                <span className="material-symbols-outlined text-[12px]">upgrade</span>
                                <span>{updateAvailable}</span>
                            </button>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'subtool',
            header: t('runtimes.th_subtool'),
            render: (item) => (
                <span className="font-mono text-xs font-semibold text-primary">
                    {item.subtool || '-'}
                </span>
            ),
        },
        {
            id: 'path',
            header: t('runtimes.th_path'),
            render: (item) => (
                <div className="flex items-center gap-1.5 max-w-[260px]">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate" title={item.path}>
                        {item.path}
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenFolder(item.version)}
                        title={t('runtimes.open_folder')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    </button>
                </div>
            ),
        },
        {
            id: 'actions',
            header: t('runtimes.th_actions'),
            align: 'right',
            render: (item) => (
                <div className="flex items-center justify-end gap-1.5">
                    {item.is_active ? (
                        <button
                            type="button"
                            onClick={() => onDeactivate?.(item.version)}
                            disabled={isProcessing}
                            title={t('runtimes.deactivate_active_version_tooltip')}
                            aria-label={t('runtimes.deactivate_active_version')}
                            className="p-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[16px] text-emerald-500">task_alt</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onSetActive(item.version)}
                            disabled={isProcessing}
                            title={hasExternal ? t('runtimes.set_as_active_vyloserve_tooltip') : t('runtimes.set_as_active_tooltip')}
                            aria-label={t('runtimes.set_as_active')}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[16px] text-slate-400 hover:text-emerald-500">radio_button_unchecked</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onOpenTerminal(item.version)}
                        title={t('runtimes.open_in_terminal')}
                        aria-label={t('runtimes.open_in_terminal')}
                        className="p-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[16px]">terminal</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onUninstall(item.version)}
                        disabled={isProcessing}
                        title={t('runtimes.uninstall_version_title')}
                        aria-label={t('runtimes.uninstall_version_title')}
                        className="p-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            ),
        },
    ];

    return (
        <DataTable
            data={filteredVersions}
            columns={columns}
            keyExtractor={(item) => item.version}
            search={{
                value: searchQuery,
                onChange: setSearchQuery,
                placeholder: t('common.search_placeholder', 'Search...'),
            }}
            emptyState={
                <div className="py-8 text-center text-xs text-slate-500">
                    {t('runtimes.no_versions_installed')}
                </div>
            }
        />
    );
}
