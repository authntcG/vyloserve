import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import ToggleSwitch from '../../components/ToggleSwitch';
import EmptyState from '../../components/EmptyState';
import InfoBox from '../../components/InfoBox';
import SkeletonCard from '../../components/skeleton/SkeletonCard';
import { type EngineData, type RuntimeEngine } from '../../context/RuntimesContext';
import RuntimeTable from './RuntimeTable';
import RuntimePathHub from './RuntimePathHub';

interface ExternalRuntimeCardProps {
    readonly data: EngineData;
    readonly engineTitle: string;
}

export function ExternalRuntimeCard({ data, engineTitle }: ExternalRuntimeCardProps) {
    const { t } = useTranslation();
    const ext = data.external;
    const hasInstalledVersions = Boolean(data.installed_versions && data.installed_versions.length > 0);
    if (!ext?.exists || data.installed || hasInstalledVersions) return null;

    return (
        <Card title={`${engineTitle} (${t('runtimes.native')})`} status={t('runtimes.native_os')} gridCols="grid-cols-1">
            <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.installed_version')}</span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{ext.version}</span>
            </div>
            <div className="flex flex-col gap-1 mt-3 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.system_path_binary')}</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all bg-slate-100 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                    {ext.path}
                </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                <div className="flex items-start gap-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">lock</span>
                    <span className="leading-relaxed break-words">{t('runtimes.external_install_locked')}</span>
                </div>
            </div>
        </Card>
    );
}

interface ExternalWarningBannerProps {
    readonly version: string;
}

export function ExternalWarningBanner({ version }: ExternalWarningBannerProps) {
    const { t } = useTranslation();
    return (
        <InfoBox tone="warning" icon="warning" className="w-full min-w-0">
            {t('runtimes.external_native_detected_1')}{version}{t('runtimes.external_native_detected_2')}
        </InfoBox>
    );
}

interface RegisterPathToggleProps {
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly externalLocked: boolean;
    readonly processing: boolean;
    readonly descriptionKey: string;
    readonly marginClass?: string;
}

export function RegisterPathToggle({ checked, onChange, externalLocked, processing, descriptionKey, marginClass = '' }: RegisterPathToggleProps) {
    const { t } = useTranslation();
    const disabled = externalLocked || processing;
    return (
        <div className="flex items-center justify-between gap-4 w-full min-w-0">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className={`text-sm font-semibold truncate ${externalLocked ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('runtimes.register_path')}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t(descriptionKey)}</span>
            </div>
            <div className={`${marginClass} shrink-0`}>
                <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} label={t('runtimes.register_path')} />
            </div>
        </div>
    );
}

export interface RuntimeEnginePanelProps {
    readonly engine?: RuntimeEngine;
    readonly data: EngineData;
    readonly isLoading?: boolean;
    readonly isProcessing: boolean;
    readonly emptyIcon: string;
    readonly emptyTitle: string;
    readonly emptyDesc: string;
    readonly emptyActionText: string;
    readonly onOpenModal: () => void;
    readonly onUpdateClick?: (newVersion?: string, oldVersion?: string) => void;
    readonly cardTitle: string;
    readonly engineTitle: string;
    readonly onUninstallClick: () => void;
    readonly uninstallLabel: string;
    readonly field2Label: string;
    readonly field2Value: string;
    readonly pathDescKey: string;
    readonly toggleMarginClass?: string;
    readonly onTogglePath: (checked: boolean) => void;
    readonly onOpenFolder?: () => void;
    readonly onOpenTerminal?: () => void;
    readonly viewMode?: 'table' | 'card';
    readonly onSetActiveVersion?: (version: string) => void;
    readonly onDeactivateVersion?: () => void;
    readonly onUninstallVersion?: (version: string) => void;
    readonly onOpenFolderForVersion?: (version: string) => void;
    readonly onOpenTerminalForVersion?: (version: string) => void;
}

export function RuntimeEnginePanel({
    engine,
    data,
    isLoading,
    isProcessing,
    emptyIcon,
    emptyTitle,
    emptyDesc,
    emptyActionText,
    onOpenModal,
    onUpdateClick,
    cardTitle,
    engineTitle,
    onUninstallClick,
    uninstallLabel,
    field2Label,
    field2Value,
    pathDescKey,
    onTogglePath,
    onOpenFolder,
    onOpenTerminal,
    viewMode = 'card',
    onSetActiveVersion,
    onDeactivateVersion,
    onUninstallVersion,
    onOpenFolderForVersion,
    onOpenTerminalForVersion,
}: RuntimeEnginePanelProps) {
    const { t } = useTranslation();
    const ext = data.external;
    const hasInstalledVersions = Boolean(data.installed_versions && data.installed_versions.length > 0);
    const isInstalledAny = Boolean(hasInstalledVersions || data.installed);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-4.5 w-full min-w-0">
                <SkeletonCard gridCols="grid-cols-1 md:grid-cols-2" />
            </div>
        );
    }

    if (!isInstalledAny && !ext?.exists) {
        return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} actionText={emptyActionText} onAction={onOpenModal} />;
    }

    if (viewMode === 'table' && hasInstalledVersions) {
        return (
            <div className="flex flex-col w-full min-w-0">
                <RuntimePathHub
                    engine={engine || 'node'}
                    engineTitle={engineTitle}
                    data={data}
                    isProcessing={isProcessing}
                    pathDescKey={pathDescKey}
                    onTogglePath={onTogglePath}
                    onSetActiveVersion={onSetActiveVersion}
                />
                <RuntimeTable
                    engine={engine || 'node'}
                    versions={data.installed_versions || []}
                    isProcessing={isProcessing}
                    updateAvailable={data.updateAvailable}
                    hasExternal={Boolean(ext?.exists)}
                    isPathActive={data.in_path}
                    onSetActive={onSetActiveVersion || (() => {})}
                    onDeactivate={onDeactivateVersion}
                    onUpdate={onUpdateClick}
                    onOpenFolder={onOpenFolderForVersion || onOpenFolder || (() => {})}
                    onOpenTerminal={onOpenTerminalForVersion || onOpenTerminal || (() => {})}
                    onUninstall={onUninstallVersion || (() => {})}
                />
            </div>
        );
    }

    if (hasInstalledVersions) {
        return (
            <div className="flex flex-col w-full min-w-0">
                <RuntimePathHub
                    engine={engine || 'node'}
                    engineTitle={engineTitle}
                    data={data}
                    isProcessing={isProcessing}
                    pathDescKey={pathDescKey}
                    onTogglePath={onTogglePath}
                    onSetActiveVersion={onSetActiveVersion}
                />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-4.5 w-full min-w-0">
                    {data.installed_versions?.map((ver) => {
                        const isVerActive = ver.is_active;

                        const getCardStatus = () => {
                            if (isVerActive) {
                                if (data.updateAvailable) return null;
                                if (ext?.exists) return t('runtimes.active_vyloserve');
                                if (data.in_path) return t('runtimes.path_active');
                                return t('runtimes.active_isolated');
                            }
                            return t('runtimes.isolated_version');
                        };

                        return (
                            <Card
                                key={ver.version}
                                title={`${engineTitle} ${ver.version}`}
                                status={getCardStatus()}
                                updateVersion={isVerActive ? (data.updateAvailable || null) : null}
                                gridCols="grid-cols-1 md:grid-cols-2"
                                dropdownActions={
                                    <>
                                        {!isVerActive && onSetActiveVersion && (
                                            <button
                                                type="button"
                                                onClick={() => onSetActiveVersion(ver.version)}
                                                disabled={isProcessing}
                                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">task_alt</span>
                                                <span className="truncate">{t('runtimes.set_as_active')}</span>
                                            </button>
                                        )}
                                        {isVerActive && onDeactivateVersion && (
                                            <button
                                                type="button"
                                                onClick={onDeactivateVersion}
                                                disabled={isProcessing}
                                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0">radio_button_unchecked</span>
                                                <span className="truncate">{t('runtimes.deactivate_version')}</span>
                                            </button>
                                        )}
                                        {isVerActive && data.updateAvailable && onUpdateClick && (
                                            <button
                                                type="button"
                                                onClick={() => onUpdateClick(data.updateAvailable!, ver.version)}
                                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                                <span className="truncate">{t('ui.update.update_to_target', { version: data.updateAvailable })}</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => (onUninstallVersion ? onUninstallVersion(ver.version) : onUninstallClick())}
                                            disabled={isProcessing}
                                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                            <span className="truncate">{uninstallLabel}</span>
                                        </button>
                                    </>
                                }
                                footerActions={
                                    (onOpenFolderForVersion || onOpenTerminalForVersion || onOpenFolder || onOpenTerminal) ? (
                                        <>
                                            {(onOpenFolderForVersion || onOpenFolder) && (
                                                <button
                                                    type="button"
                                                    onClick={() => (onOpenFolderForVersion ? onOpenFolderForVersion(ver.version) : onOpenFolder?.())}
                                                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                                    <span>{t('runtimes.open_folder')}</span>
                                                </button>
                                            )}
                                            {(onOpenTerminalForVersion || onOpenTerminal) && (
                                                <button
                                                    type="button"
                                                    onClick={() => (onOpenTerminalForVersion ? onOpenTerminalForVersion(ver.version) : onOpenTerminal?.())}
                                                    className="flex-1 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">terminal</span>
                                                    <span>{t('runtimes.open_in_terminal')}</span>
                                                </button>
                                            )}
                                        </>
                                    ) : undefined
                                }
                            >
                                <div className="flex flex-col gap-1 min-w-0 w-full">
                                    <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span>
                                    <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{ver.version}</span>
                                </div>
                                <div className="flex flex-col gap-1 min-w-0 w-full">
                                    <span className="text-xs font-medium text-slate-500 uppercase">{field2Label}</span>
                                    <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{field2Value}</span>
                                </div>
                                {ver.subtool && (
                                    <div className="flex flex-col gap-1 min-w-0 w-full col-span-1 md:col-span-2">
                                        <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.subtools_ecosystem')}</span>
                                        <span className="font-mono text-xs font-semibold text-primary truncate">{ver.subtool}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full col-span-1 md:col-span-2">
                                    <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.th_path')}</span>
                                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate" title={ver.path}>{ver.path}</span>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    const getRuntimeStatus = () => {
        if (data.updateAvailable) return null;
        if (ext?.exists) return t('runtimes.active_vyloserve');
        return data.in_path ? t('runtimes.path_active') : t('runtimes.active_isolated');
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            {data.installed && (
                <RuntimePathHub
                    engine={engine || 'node'}
                    engineTitle={engineTitle}
                    data={data}
                    isProcessing={isProcessing}
                    pathDescKey={pathDescKey}
                    onTogglePath={onTogglePath}
                    onSetActiveVersion={onSetActiveVersion}
                />
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-4.5 w-full min-w-0">
                <ExternalRuntimeCard data={data} engineTitle={engineTitle} />
                {data.installed && (
                    <Card
                        title={cardTitle}
                        status={getRuntimeStatus()}
                        updateVersion={data.updateAvailable || null}
                        gridCols="grid-cols-1 md:grid-cols-2"
                        dropdownActions={
                            <>
                                {data.updateAvailable && (
                                    <button type="button" onClick={() => onUpdateClick?.(data.updateAvailable!, data.version)} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors">
                                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                        <span className="truncate">{t('ui.update.update_to_target', { version: data.updateAvailable })}</span>
                                    </button>
                                )}
                                <button type="button" onClick={onUninstallClick} disabled={isProcessing} className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                    <span className="truncate">{uninstallLabel}</span>
                                </button>
                            </>
                        }
                        footerActions={
                            (onOpenFolder || onOpenTerminal) ? (
                                <>
                                    {onOpenFolder && (
                                        <button
                                            type="button"
                                            onClick={onOpenFolder}
                                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                            <span>{t('runtimes.open_folder')}</span>
                                        </button>
                                    )}
                                    {onOpenTerminal && (
                                        <button
                                            type="button"
                                            onClick={onOpenTerminal}
                                            className="flex-1 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">terminal</span>
                                            <span>{t('runtimes.open_in_terminal')}</span>
                                        </button>
                                    )}
                                </>
                            ) : undefined
                        }
                    >
                        <div className="flex flex-col gap-1 min-w-0 w-full">
                            <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span>
                            <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{data.version}</span>
                        </div>
                        <div className="flex flex-col gap-1 min-w-0 w-full">
                            <span className="text-xs font-medium text-slate-500 uppercase">{field2Label}</span>
                            <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{field2Value}</span>
                        </div>
                        {data.subtool && (
                            <div className="flex flex-col gap-1 min-w-0 w-full col-span-1 md:col-span-2">
                                <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.subtools_ecosystem')}</span>
                                <span className="font-mono text-xs font-semibold text-primary truncate">{data.subtool}</span>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}

/** Dot badge "terdeteksi" di tab engine -- emerald kalau terinstal VyloServe, amber kalau cuma terdeteksi eksternal, tidak ada kalau belum ada sama sekali. */
export function engineTabBadgeClass(engine: { readonly installed: boolean; readonly external?: { readonly exists: boolean } }): string | undefined {
    if (engine.installed) return 'bg-emerald-500';
    if (engine.external?.exists) return 'bg-amber-500';
    return undefined;
}

export function tabVisibilityClass(activeTab: RuntimeEngine, tabId: RuntimeEngine): string {
    return activeTab === tabId ? 'block' : 'hidden';
}
