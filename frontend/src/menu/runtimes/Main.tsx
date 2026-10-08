import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import ToggleSwitch from '../../components/ToggleSwitch';
import ProgressBar from '../../components/ProgressBar';
import Tabs from '../../components/Tabs';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import EmptyState from '../../components/EmptyState';
import InfoBox from '../../components/InfoBox';
import { useToast } from '../../components/ToastContext';
import { useAlert } from '../../components/AlertContext';
import { clampPercent } from '../../utils/progress';

import InstallNode, { type InstallNodeRef } from './InstallNode';
import InstallPython, { type InstallPythonRef } from './InstallPython';
import InstallJava, { type InstallJavaRef } from './InstallJava';
import InstallGo, { type InstallGoRef } from './InstallGo';

type RuntimeEngine = 'node' | 'python' | 'java' | 'go';

interface EngineExternalInfo {
    exists: boolean;
    path: string;
    version: string;
}

interface EngineData {
    installed: boolean;
    version: string;
    updateAvailable?: string;
    in_path: boolean;
    external: EngineExternalInfo;
}

type RuntimeDataMap = Record<RuntimeEngine, EngineData>;

const INITIAL_DATA: RuntimeDataMap = {
    node: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    python: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    java: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    go: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } }
};

interface ExternalRuntimeCardProps {
    readonly data: EngineData;
    readonly engineTitle: string;
}

function ExternalRuntimeCard({ data, engineTitle }: ExternalRuntimeCardProps) {
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

function ExternalWarningBanner({ version }: ExternalWarningBannerProps) {
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

function RegisterPathToggle({ checked, onChange, externalLocked, processing, descriptionKey, marginClass = '' }: RegisterPathToggleProps) {
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

interface RuntimeEnginePanelProps {
    readonly data: EngineData;
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

function RuntimeEnginePanel({ data, isProcessing, emptyIcon, emptyTitle, emptyDesc, emptyActionText, onOpenModal, onUpdateClick, cardTitle, engineTitle, onUninstallClick, uninstallLabel, field2Label, field2Value, pathDescKey, toggleMarginClass, onTogglePath }: RuntimeEnginePanelProps) {
    const { t } = useTranslation();
    const ext = data.external;

    if (!data.installed && !ext?.exists) {
        return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} actionText={emptyActionText} onAction={onOpenModal} />;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
            <ExternalRuntimeCard data={data} engineTitle={engineTitle} />
            {data.installed && (
                <Card
                    title={cardTitle}
                    status={data.updateAvailable ? null : data.in_path ? t('runtimes.path_active') : t('runtimes.isolated')}
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
                    <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{data.version}</span></div>
                    <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{field2Label}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{field2Value}</span></div>

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
function engineTabBadgeClass(engine: { readonly installed: boolean; readonly external?: { readonly exists: boolean } }): string | undefined {
    if (engine.installed) return 'bg-emerald-500';
    if (engine.external?.exists) return 'bg-amber-500';
    return undefined;
}

interface RuntimesSubtitleProps {
    readonly isLoading: boolean;
    readonly activeEnginesCount: number;
    readonly t: any;
}

function RuntimesSubtitle({ isLoading, activeEnginesCount, t }: RuntimesSubtitleProps) {
    return (
        <>
            <span className="material-symbols-outlined text-[14px]">info</span>
            {isLoading ? t('runtimes.loading_data') : `${activeEnginesCount}${t('runtimes.engines_detected')}`}
        </>
    );
}

interface RuntimesHeaderActionsProps {
    readonly activeEngine: EngineData;
    readonly activeTab: RuntimeEngine;
    readonly isLoading: boolean;
    readonly onOpenInstall: () => void;
    readonly t: any;
}

function RuntimesHeaderActions({ activeEngine, activeTab, isLoading, onOpenInstall, t }: RuntimesHeaderActionsProps) {
    if (activeEngine.installed) {
        return (
            <button type="button" disabled className="text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm bg-emerald-500 opacity-80 cursor-default whitespace-nowrap shrink-0">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t('common.installed') || 'Installed'}
            </button>
        );
    }
    return (
        <button type="button"
            onClick={onOpenInstall}
            disabled={isLoading}
            className="text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap shrink-0 bg-primary hover:bg-primary/90 border border-transparent"
        >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {`${t('runtimes.add')} ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </button>
    );
}

function tabVisibilityClass(activeTab: RuntimeEngine, tabId: RuntimeEngine): string {
    return activeTab === tabId ? 'block' : 'hidden';
}

export default function RuntimesMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();
    const [activeTab, setActiveTab] = useState<RuntimeEngine>('node');

    const [runtimeData, setRuntimeData] = useState(INITIAL_DATA);
    const [isLoading, setIsLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [installingEngine, setInstallingEngine] = useState<string | null>(null);
    const [updatingVersion, setUpdatingVersion] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
    const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
    const [isJavaModalOpen, setIsJavaModalOpen] = useState(false);
    const [isGoModalOpen, setIsGoModalOpen] = useState(false);

    const nodeRef = useRef<InstallNodeRef>(null);
    const pythonRef = useRef<InstallPythonRef>(null);
    const javaRef = useRef<InstallJavaRef>(null);
    const goRef = useRef<InstallGoRef>(null);

    const activeEnginesCount = Object.values(runtimeData).filter(data => data.installed || data.external?.exists).length;

    useEffect(() => {
        const handleProgress = (event: any) => {
            // Abaikan progress milik modul lain â€” lihat docs/known_bugs.md #7.
            if (event.detail?.source && event.detail.source !== 'RuntimesManager') return;
            const { percent, text } = event.detail;
            setProgress(clampPercent(percent));
            setProgressText(t(text, event.detail.args || {}) as string);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    const checkForUpdates = async (api: any, nodeStatus: any, pythonStatus: any, javaStatus: any, goStatus: any) => {
        let nodeUpdate: string | undefined, pythonUpdate: string | undefined, javaUpdate: string | undefined, goUpdate: string | undefined;
        
        const compareVersions = (v1: string, v2: string) => {
            const p1 = v1.replace(/^v/i, '').replace(/^go/i, '').split(/[.-]/).map(Number);
            const p2 = v2.replace(/^v/i, '').replace(/^go/i, '').split(/[.-]/).map(Number);
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                if ((p1[i] || 0) > (p2[i] || 0)) return 1;
                if ((p1[i] || 0) < (p2[i] || 0)) return -1;
            }
            return 0;
        };

        await Promise.all([
            (async () => {
                if (nodeStatus?.installed && nodeStatus.version) {
                    try {
                        const res = await api.get_available_node_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const localNorm = nodeStatus.version.replace(/^v/i, '');
                            const remoteNorm = res.data[0].value.replace(/^v/i, '');
                            if (compareVersions(remoteNorm, localNorm) > 0) nodeUpdate = res.data[0].value;
                        }
                    } catch (e) { console.error(e); }
                }
            })(),
            (async () => {
                if (goStatus?.installed && goStatus.version) {
                    try {
                        const res = await api.get_available_go_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const localNorm = goStatus.version.replace(/^go/i, '');
                            const remoteNorm = res.data[0].value.replace(/^go/i, '');
                            if (compareVersions(remoteNorm, localNorm) > 0) goUpdate = res.data[0].value;
                        }
                    } catch (e) { console.error(e); }
                }
            })(),
            (async () => {
                if (pythonStatus?.installed && pythonStatus.version) {
                    try {
                        const res = await api.get_available_python_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const minM = pythonStatus.version.split('.').slice(0, 2).join('.');
                            if (res.data.some((v: any) => v.value.startsWith(minM + '.') && v.value !== pythonStatus.version)) {
                                pythonUpdate = res.data.find((v: any) => v.value.startsWith(minM + '.') && v.value !== pythonStatus.version)?.value;
                            }
                        }
                    } catch (e) { console.error(e); }
                }
            })(),
            (async () => {
                if (javaStatus?.installed && javaStatus.version) {
                    try {
                        const res = await api.get_available_java_versions();
                        if (res?.status === 'success' && res.data?.length > 0) {
                            const minM = javaStatus.version.split('.').slice(0, 2).join('.');
                            if (res.data.some((v: any) => v.value.startsWith(minM + '.') && v.value !== javaStatus.version)) {
                                javaUpdate = res.data.find((v: any) => v.value.startsWith(minM + '.') && v.value !== javaStatus.version)?.value;
                            }
                        }
                    } catch (e) { console.error(e); }
                }
            })()
        ]);

        setRuntimeData(prev => ({
            ...prev,
            node: { ...prev.node, updateAvailable: nodeUpdate },
            python: { ...prev.python, updateAvailable: pythonUpdate },
            java: { ...prev.java, updateAvailable: javaUpdate },
            go: { ...prev.go, updateAvailable: goUpdate }
        }));
    };

    const fetchStatuses = async () => {
        setIsLoading(true);
        try {
            const api = window.pywebview?.api;
            if (api) {
                const [nodeStatus, pythonStatus, javaStatus, goStatus] = await Promise.all([
                    api.get_node_status(),
                    api.get_python_status(),
                    api.get_java_status(),
                    api.get_go_status()
                ]);

                setRuntimeData(prev => ({
                    ...prev,
                    node: { ...prev.node, ...nodeStatus },
                    python: { ...prev.python, ...pythonStatus },
                    java: { ...prev.java, ...javaStatus },
                    go: { ...prev.go, ...goStatus }
                }));

                // Fire and forget
                checkForUpdates(api, nodeStatus, pythonStatus, javaStatus, goStatus);
            }
        } catch (error){ console.error(error);
            console.error(t('runtimes.load_status_error'), error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    const handleUpdateClick = async (engine: RuntimeEngine, version: string) => {
        if (!await confirm({
            title: t('runtimes.update_title') + engine.toUpperCase(),
            message: t('runtimes.confirm_update_msg', { version }),
            type: 'warning'
        })) {
            return;
        }

        if (engine === 'node') setIsNodeModalOpen(true);
        else if (engine === 'python') setIsPythonModalOpen(true);
        else if (engine === 'java') setIsJavaModalOpen(true);
        else if (engine === 'go') setIsGoModalOpen(true);

        setIsMinimized(true);

        setInstallingEngine(engine);
        setUpdatingVersion(version);
        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('common.preparing'));

        try {
            let res;
            if (engine === 'node') res = await window.pywebview?.api?.install_node(version, true);
            else if (engine === 'python') res = await window.pywebview?.api?.install_python(version, true);
            else if (engine === 'java') res = await window.pywebview?.api?.install_java(version);
            else if (engine === 'go') res = await window.pywebview?.api?.install_go(version);

            if (res?.status === 'success') {
                showToast(res.message ? t(res.message, res.args || {}) as string : t('runtimes.update_success', { engine: engine.toUpperCase() }), 'success');
            } else {
                showToast(res?.message ? t(res.message, res.args || {}) as string : t('backend.error.unexpected'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast(t('runtimes.sys_error'), "error");
        } finally {
            setIsProcessing(false);
            setInstallingEngine(null);
            setUpdatingVersion(null);
            setIsMinimized(false);
            if (engine === 'node') setIsNodeModalOpen(false);
            else if (engine === 'python') setIsPythonModalOpen(false);
            else if (engine === 'java') setIsJavaModalOpen(false);
            else if (engine === 'go') setIsGoModalOpen(false);
            fetchStatuses();
        }
    };

    const handleTogglePath = async (engine: 'node' | 'python' | 'java' | 'go', enable: boolean) => {
        const isExternalExists = runtimeData[engine].external?.exists;
        if (isExternalExists) {
            showToast(t('runtimes.external_lock_warning', { engine }), "error");
            return;
        }

        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.toggle_global_path(engine, enable);
            if (res?.status === 'success') {
                setRuntimeData(prev => ({
                    ...prev,
                    [engine]: { ...prev[engine], in_path: enable }
                }));
                if (enable) showToast(t('runtimes.path_added_success', { engine }), "success");
                else showToast(t('runtimes.path_removed_success', { engine }), "success");
            } else {
                showToast((res?.message ? t(res.message, res.args || {}) : t('runtimes.path_change_error')) as string, "error");
            }
        } catch (error){ console.error(error);
            showToast(t('runtimes.path_change_sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const executeUninstall = async (engine: RuntimeEngine) => {
        if (!await confirm({
            title: `${t('runtimes.uninstall_title')}${engine.toUpperCase()}`,
            message: (
                <>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        {t('runtimes.uninstall_confirm_1')}<strong>{engine.toUpperCase()}</strong>{t('runtimes.uninstall_confirm_2')}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                        {t('runtimes.uninstall_warning_1')}<strong>{t('runtimes.uninstall_warning_2')}</strong>{t('runtimes.uninstall_warning_3')}
                    </p>
                </>
            ),
            type: 'danger',
            confirmText: t('runtimes.yes_uninstall')
        })) return;

        setIsProcessing(true);

        try {
            let res;
            if (engine === 'node') res = await window.pywebview?.api?.uninstall_node();
            else if (engine === 'python') res = await window.pywebview?.api?.uninstall_python();
            else if (engine === 'java') res = await window.pywebview?.api?.uninstall_java();
            else if (engine === 'go') res = await window.pywebview?.api?.uninstall_go();

            if (res?.status === 'success') {
                showToast(t('runtimes.uninstall_success', { engine: engine.toUpperCase() }), "success");
                fetchStatuses();
            } else {
                showToast((res?.message ? t(res.message, res.args || {}) : t('runtimes.uninstall_error', { engine })) as string, "error");
            }
        } catch (error){ console.error(error);
            showToast(t('runtimes.uninstall_sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenInstall = () => {
        if (activeTab === 'node') setIsNodeModalOpen(true);
        else if (activeTab === 'python') setIsPythonModalOpen(true);
        else if (activeTab === 'java') setIsJavaModalOpen(true);
        else if (activeTab === 'go') setIsGoModalOpen(true);
    };

    const executeInstallation = async (engineName: string, refTrigger: any, closeStateSetter: Function) => {
        if (!refTrigger.current) return;

        setIsProcessing(true);
        setInstallingEngine(engineName);
        setProgress(0);
        setProgressText(t('runtimes.starting_install'));

        const success = await refTrigger.current.submit();

        if (success) {
            closeStateSetter(false);
            fetchStatuses();
        }

        setIsProcessing(false);
        setIsMinimized(false);
        setInstallingEngine(null);
    };

    const handleInstallNodeSubmit = () => executeInstallation('Node.js', nodeRef, setIsNodeModalOpen);
    const handleInstallPythonSubmit = () => executeInstallation('Python', pythonRef, setIsPythonModalOpen);
    const handleInstallJavaSubmit = () => executeInstallation('Java (JDK)', javaRef, setIsJavaModalOpen);
    const handleInstallGoSubmit = () => executeInstallation('Go Compiler', goRef, setIsGoModalOpen);

    const renderProgressBar = () => {
        if (!isProcessing) return null;
        return (
            <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('runtimes.process_running')}</span>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || t('runtimes.preparing')}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <ProgressBar percent={progress} />
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="terminal"
                title={t('runtimes.runtimes_engines')}
                subtitle={<RuntimesSubtitle isLoading={isLoading} activeEnginesCount={activeEnginesCount} t={t} />}
                actions={
                    <RuntimesHeaderActions
                        activeEngine={runtimeData[activeTab]}
                        
                        activeTab={activeTab}
                        isLoading={isLoading}
                        onOpenInstall={handleOpenInstall}
                        t={t}
                    />
                }
            />

            <div className="w-full max-w-full overflow-hidden">
                <Tabs
                    className="w-full"
                    tabs={[
                        { value: 'node', label: 'Node.js', badgeColorClass: engineTabBadgeClass(runtimeData.node) },
                        { value: 'python', label: 'Python', badgeColorClass: engineTabBadgeClass(runtimeData.python) },
                        { value: 'java', label: 'Java JDK', badgeColorClass: engineTabBadgeClass(runtimeData.java) },
                        { value: 'go', label: 'Go Compiler', badgeColorClass: engineTabBadgeClass(runtimeData.go) },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'node')}>
                <RuntimeEnginePanel
                    data={runtimeData.node}
                    isProcessing={isProcessing}
                    emptyIcon="javascript"
                    emptyTitle={t('runtimes.node_not_installed')}
                    emptyDesc={t('runtimes.node_desc')}
                    emptyActionText={t('runtimes.install_node_now')}
                    onOpenModal={() => setIsNodeModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('node', runtimeData.node.updateAvailable!)}
                    cardTitle="Node.js (VyloServe)"
                    engineTitle="Node.js"
                    onUninstallClick={() => executeUninstall('node')}
                    uninstallLabel={t('runtimes.uninstall_node')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.npm_corepack')}
                    pathDescKey="runtimes.node_path_desc"
                    onTogglePath={(checked) => handleTogglePath('node', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'python')}>
                <RuntimeEnginePanel
                    data={runtimeData.python}
                    isProcessing={isProcessing}
                    emptyIcon="data_object"
                    emptyTitle={t('runtimes.python_not_installed')}
                    emptyDesc={t('runtimes.python_desc')}
                    emptyActionText={t('runtimes.install_python_now')}
                    onOpenModal={() => setIsPythonModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('python', runtimeData.python.updateAvailable!)}
                    cardTitle="Python (VyloServe)"
                    engineTitle="Python"
                    onUninstallClick={() => executeUninstall('python')}
                    uninstallLabel={t('runtimes.uninstall_python')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.pip_available')}
                    pathDescKey="runtimes.python_path_desc"
                    onTogglePath={(checked) => handleTogglePath('python', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'java')}>
                <RuntimeEnginePanel
                    data={runtimeData.java}
                    isProcessing={isProcessing}
                    emptyIcon="coffee"
                    emptyTitle={t('runtimes.java_not_installed')}
                    emptyDesc={t('runtimes.java_desc')}
                    emptyActionText={t('runtimes.install_java_now')}
                    onOpenModal={() => setIsJavaModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('java', runtimeData.java.updateAvailable!)}
                    cardTitle="Java JDK (VyloServe)"
                    engineTitle="Java JDK"
                    onUninstallClick={() => executeUninstall('java')}
                    uninstallLabel={t('runtimes.uninstall_java')}
                    field2Label={t('runtimes.environment')}
                    field2Value={t('runtimes.java_home_set')}
                    pathDescKey="runtimes.java_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('java', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'go')}>
                <RuntimeEnginePanel
                    data={runtimeData.go}
                    isProcessing={isProcessing}
                    emptyIcon="rocket_launch"
                    emptyTitle={t('runtimes.go_not_installed')}
                    emptyDesc={t('runtimes.go_desc')}
                    emptyActionText={t('runtimes.install_go_now')}
                    onOpenModal={() => setIsGoModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('go', runtimeData.go.updateAvailable!)}
                    cardTitle="Go Compiler (VyloServe)"
                    engineTitle="Go Compiler"
                    onUninstallClick={() => executeUninstall('go')}
                    uninstallLabel={t('runtimes.uninstall_go')}
                    field2Label={t('runtimes.architecture')}
                    field2Value="amd64"
                    pathDescKey="runtimes.go_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('go', checked)}
                />
            </div>

            <BackgroundProgressWidget
                isOpen={isMinimized && isProcessing && !!installingEngine}
                progress={progress}
                progressText={progressText}
                title={updatingVersion ? `${t('runtimes.update_title')}${installingEngine?.toUpperCase()}` : `${t('runtimes.install_title')}${installingEngine?.toUpperCase()}`}
                onRestore={() => setIsMinimized(false)}
            />



            <Modal
                isOpen={isNodeModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsNodeModalOpen(false)}
                title={`${runtimeData.node.installed ? t('runtimes.update_title') : t('runtimes.install_title')}Node.js`}
                icon="javascript"
                onApply={updatingVersion ? undefined : handleInstallNodeSubmit}
                applyText={isProcessing ? (runtimeData.node.installed ? t('runtimes.updating_btn') : t('runtimes.installing_btn')) : (runtimeData.node.installed ? t('runtimes.update_engine_btn') : t('runtimes.install_engine_btn'))}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallNode targetVersion={updatingVersion} ref={nodeRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isPythonModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsPythonModalOpen(false)}
                title={`${runtimeData.python.installed ? t('runtimes.update_title') : t('runtimes.install_title')}Python`}
                icon="data_object"
                onApply={updatingVersion ? undefined : handleInstallPythonSubmit}
                applyText={isProcessing ? (runtimeData.python.installed ? t('runtimes.updating_btn') : t('runtimes.installing_btn')) : (runtimeData.python.installed ? t('runtimes.update_engine_btn') : t('runtimes.install_engine_btn'))}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallPython targetVersion={updatingVersion} ref={pythonRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isJavaModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsJavaModalOpen(false)}
                title={`${runtimeData.java.installed ? t('runtimes.update_title') : t('runtimes.install_title')}Java (JDK)`}
                icon="coffee"
                onApply={updatingVersion ? undefined : handleInstallJavaSubmit}
                applyText={isProcessing ? (runtimeData.java.installed ? t('runtimes.updating_btn') : t('runtimes.installing_btn')) : (runtimeData.java.installed ? t('runtimes.update_engine_btn') : t('runtimes.install_engine_btn'))}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallJava targetVersion={updatingVersion} ref={javaRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isGoModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsGoModalOpen(false)}
                title={`${runtimeData.go.installed ? t('runtimes.update_title') : t('runtimes.install_title')}Go Compiler`}
                icon="rocket_launch"
                onApply={updatingVersion ? undefined : handleInstallGoSubmit}
                applyText={isProcessing ? (runtimeData.go.installed ? t('runtimes.updating_btn') : t('runtimes.installing_btn')) : (runtimeData.go.installed ? t('runtimes.update_engine_btn') : t('runtimes.install_engine_btn'))}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallGo targetVersion={updatingVersion} ref={goRef} />
                </div>
                {renderProgressBar()}
            </Modal>
        </div>
    );
}





