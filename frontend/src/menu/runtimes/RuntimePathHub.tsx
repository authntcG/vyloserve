import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../../components/ToggleSwitch';
import Select from '../../components/Select';
import { type EngineData, type RuntimeEngine } from '../../context/RuntimesContext';

export interface RuntimePathHubProps {
    readonly engine: RuntimeEngine;
    readonly engineTitle: string;
    readonly data: EngineData;
    readonly isProcessing: boolean;
    readonly pathDescKey: string;
    readonly onTogglePath: (checked: boolean) => void;
    readonly onSetActiveVersion?: (version: string) => void;
}

export default function RuntimePathHub({
    engine,
    engineTitle,
    data,
    isProcessing,
    pathDescKey,
    onTogglePath,
    onSetActiveVersion,
}: RuntimePathHubProps) {
    const { t } = useTranslation();
    const ext = data.external;
    const externalLocked = Boolean(ext?.exists);
    const installedVersions = data.installed_versions || [];

    const activeVersion = useMemo(() => {
        if (data.active_version) return data.active_version;
        const activeItem = installedVersions.find((v) => v.is_active);
        if (activeItem) return activeItem.version;
        if (data.installed && data.version) return data.version;
        if (installedVersions.length > 0) return installedVersions[0].version;
        return '';
    }, [data.active_version, data.installed, data.version, installedVersions]);

    const versionOptions = useMemo(() => {
        if (installedVersions.length > 0) {
            return installedVersions.map((v) => ({
                value: v.version,
                label: `${engineTitle} ${v.version}`,
                sublabel: v.subtool || undefined,
            }));
        }
        if (data.installed && data.version) {
            return [{
                value: data.version,
                label: `${engineTitle} ${data.version}`,
                sublabel: data.subtool || undefined,
            }];
        }
        return [];
    }, [installedVersions, data.installed, data.version, data.subtool, engineTitle]);

    const renderStatusBadge = () => {
        if (externalLocked) {
            return (
                <span
                    data-testid="path-hub-status-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20"
                >
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    {t('runtimes.native_os')}
                </span>
            );
        }
        if (data.in_path) {
            return (
                <span
                    data-testid="path-hub-status-badge"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {t('runtimes.active_in_path')}
                </span>
            );
        }
        return (
            <span
                data-testid="path-hub-status-badge"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {t('runtimes.isolated_version')}
            </span>
        );
    };

    const renderHintText = () => {
        if (externalLocked) {
            return t('runtimes.external_install_locked');
        }
        if (data.in_path) {
            return t('runtimes.active_path_hint', { engine: engineTitle, version: activeVersion });
        }
        return t('runtimes.isolated_path_hint');
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm mb-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[22px]">tune</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                                {t('runtimes.path_orchestration_title')}
                            </h4>
                            {renderStatusBadge()}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                            {renderHintText()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <ToggleSwitch
                        checked={Boolean(data.in_path && !externalLocked)}
                        onChange={onTogglePath}
                        disabled={externalLocked || isProcessing || versionOptions.length === 0}
                        label={t('runtimes.register_path')}
                    />
                </div>
            </div>

            {externalLocked && ext && (
                <div
                    data-testid="path-hub-external-alert"
                    className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs"
                >
                    <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        warning
                    </span>
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-amber-900 dark:text-amber-300">
                            {t('runtimes.external_overview_title')} (v{ext.version})
                        </span>
                        {ext.path && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                    className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-950/50 px-2 py-0.5 rounded border border-amber-500/20 truncate"
                                    title={ext.path}
                                >
                                    {ext.path}
                                </span>
                            </div>
                        )}
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('runtimes.external_overview_desc', { version: ext.version, path: ext.path })}
                        </p>
                    </div>
                </div>
            )}

            {versionOptions.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <label
                            htmlFor={`path-hub-select-${engine}`}
                            className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider"
                        >
                            {t('runtimes.active_system_version')}
                        </label>
                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 break-words">
                            {t(pathDescKey)}
                        </span>
                    </div>
                    <div className="w-full sm:w-64 shrink-0">
                        <Select
                            id={`path-hub-select-${engine}`}
                            options={versionOptions}
                            value={activeVersion || null}
                            onChange={(val) => onSetActiveVersion?.(val)}
                            disabled={externalLocked || isProcessing || versionOptions.length <= 1}
                            size="sm"
                            searchable={versionOptions.length > 5}
                            placeholder={t('runtimes.select_version_placeholder')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
