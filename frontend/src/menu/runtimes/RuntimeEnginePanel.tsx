import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import ToggleSwitch from '../../components/ToggleSwitch';
import EmptyState from '../../components/EmptyState';
import InfoBox from '../../components/InfoBox';
import SkeletonCard from '../../components/skeleton/SkeletonCard';
import { type EngineData, type RuntimeEngine } from '../../context/RuntimesContext';

interface ExternalRuntimeCardProps {
    readonly data: EngineData;
    readonly engineTitle: string;
}

export function ExternalRuntimeCard({ data, engineTitle }: ExternalRuntimeCardProps) {
    const { t } = useTranslation();
    const ext = data.external;
    if (!ext?.exists || data.installed) return null;

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
        <InfoBox tone="warning" icon="warning" className="col-span-1 md:col-span-2 mb-3 w-full min-w-0">
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
        <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
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
    readonly data: EngineData;
    readonly isLoading?: boolean;
    readonly isProcessing: boolean;
    readonly emptyIcon: string;
    readonly emptyTitle: string;
    readonly emptyDesc: string;
    readonly emptyActionText: string;
    readonly onOpenModal: () => void;
    readonly onUpdateClick?: () => void;
    readonly cardTitle: string;
    readonly engineTitle: string;
    readonly onUninstallClick: () => void;
    readonly uninstallLabel: string;
    readonly field2Label: string;
    readonly field2Value: string;
    readonly pathDescKey: string;
    readonly toggleMarginClass?: string;
    readonly onTogglePath: (checked: boolean) => void;
}

export function RuntimeEnginePanel({
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
    toggleMarginClass,
    onTogglePath
}: RuntimeEnginePanelProps) {
    const { t } = useTranslation();
    const ext = data.external;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                <SkeletonCard gridCols="grid-cols-1 md:grid-cols-2" />
            </div>
        );
    }

    if (!data.installed && !ext?.exists) {
        return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} actionText={emptyActionText} onAction={onOpenModal} />;
    }

    const getRuntimeStatus = () => {
        if (data.updateAvailable) return null;
        return data.in_path ? t('runtimes.path_active') : t('runtimes.isolated');
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
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
                                <button type="button" onClick={onUpdateClick} className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                    {t('ui.update.update_to_target', { version: data.updateAvailable })}
                                </button>
                            )}
                            <button type="button" onClick={onUninstallClick} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                {uninstallLabel}
                            </button>
                        </>
                    }
                >
                    {ext?.exists && <ExternalWarningBanner version={ext.version} />}
                    <div className="flex flex-col gap-1 min-w-0 w-full">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span>
                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{data.version}</span>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 w-full">
                        <span className="text-xs font-medium text-slate-500 uppercase">{field2Label}</span>
                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{field2Value}</span>
                    </div>

                    <RegisterPathToggle
                        checked={data.in_path}
                        onChange={onTogglePath}
                        externalLocked={!!ext?.exists}
                        processing={isProcessing}
                        descriptionKey={pathDescKey}
                        marginClass={toggleMarginClass}
                    />
                </Card>
            )}
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
