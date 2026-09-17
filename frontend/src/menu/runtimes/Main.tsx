import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/ToastContext';

import InstallNode, { type InstallNodeRef } from './InstallNode';
import InstallPython, { type InstallPythonRef } from './InstallPython';
import InstallJava, { type InstallJavaRef } from './InstallJava';
import InstallGo, { type InstallGoRef } from './InstallGo';

const INITIAL_DATA = {
    node: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    python: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    java: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } },
    go: { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } }
};

export default function RuntimesMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'node' | 'python' | 'java' | 'go'>('node');

    const [runtimeData, setRuntimeData] = useState(INITIAL_DATA);
    const [isLoading, setIsLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [installingEngine, setInstallingEngine] = useState<string | null>(null);
    const [engineToUninstall, setEngineToUninstall] = useState<'node' | 'python' | 'java' | 'go' | null>(null);
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
            // Abaikan progress milik modul lain — lihat docs/known_bugs.md #7.
            if (event.detail?.source && event.detail.source !== 'RuntimesManager') return;
            const { percent, text } = event.detail;
            setProgress(percent < 0 ? 0 : percent);
            setProgressText(text);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

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
                showToast(res?.message || t('runtimes.path_change_error'), "error");
            }
        } catch (error){ console.error(error);
            showToast(t('runtimes.path_change_sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const executeUninstall = async () => {
        if (!engineToUninstall) return;

        setIsProcessing(true);
        setProgress(100);
        setProgressText(t('runtimes.uninstalling_module', { engine: engineToUninstall.toUpperCase() }));

        try {
            let res;
            if (engineToUninstall === 'node') res = await window.pywebview?.api?.uninstall_node();
            else if (engineToUninstall === 'python') res = await window.pywebview?.api?.uninstall_python();
            else if (engineToUninstall === 'java') res = await window.pywebview?.api?.uninstall_java();
            else if (engineToUninstall === 'go') res = await window.pywebview?.api?.uninstall_go();

            if (res?.status === 'success') {
                showToast(t('runtimes.uninstall_success', { engine: engineToUninstall.toUpperCase() }), "success");
                setEngineToUninstall(null);
                fetchStatuses();
            } else {
                showToast(res?.message || t('runtimes.uninstall_error', { engine: engineToUninstall }), "error");
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
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    // Floating widget now uses standard BackgroundProgressWidget component below

    const renderExternalCard = (engineId: 'node' | 'python' | 'java' | 'go', engineTitle: string) => {
        const ext = runtimeData[engineId].external;
        if (!ext?.exists || runtimeData[engineId].installed) return null;

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
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="terminal"
                title={t('runtimes.runtimes_engines')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span>{isLoading ? t('runtimes.loading_data') : `${activeEnginesCount}${t('runtimes.engines_detected')}`}</>}
                actions={
                    <button type="button"
                        onClick={handleOpenInstall}
                        disabled={runtimeData[activeTab].installed || isLoading}
                        className="bg-primary hover:bg-blue-600 disabled:bg-slate-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px]">{runtimeData[activeTab].installed ? 'check_circle' : 'add'}</span>
                        {runtimeData[activeTab].installed ? t('runtimes.installed') : `${t('runtimes.add')}${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                    </button>
                }
            />

            <div className="w-full max-w-full overflow-hidden mb-6">
                <div className="flex w-full gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800">
                    <button type="button" onClick={() => setActiveTab('node')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'node' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Node.js {(runtimeData.node.installed || runtimeData.node.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.node.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button type="button" onClick={() => setActiveTab('python')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'python' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Python {(runtimeData.python.installed || runtimeData.python.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.python.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button type="button" onClick={() => setActiveTab('java')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'java' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Java JDK {(runtimeData.java.installed || runtimeData.java.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.java.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button type="button" onClick={() => setActiveTab('go')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'go' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Go Compiler {(runtimeData.go.installed || runtimeData.go.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.go.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                </div>
            </div>

            <div className={activeTab === 'node' ? 'block' : 'hidden'}>
                {!runtimeData.node.installed && !runtimeData.node.external?.exists ? (
                    <EmptyState icon="javascript" title={t('runtimes.node_not_installed')} description={t('runtimes.node_desc')} actionText={t('runtimes.install_node_now')} onAction={() => setIsNodeModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('node', 'Node.js')}
                        {runtimeData.node.installed && (
                            <Card
                                title="Node.js (VyloServe)"
                                status={runtimeData.node.in_path ? t('runtimes.path_active') : t('runtimes.isolated')}
                                gridCols="grid-cols-1 md:grid-cols-2"
                                dropdownActions={
                                    <button type="button" onClick={() => setEngineToUninstall('node')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                        {t('runtimes.uninstall_node')}
                                    </button>
                                }
                            >
                                {runtimeData.node.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">{t('runtimes.external_native_detected_1')}{runtimeData.node.external.version}{t('runtimes.external_native_detected_2')}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.node.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.package_manager')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{t('runtimes.npm_corepack')}</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.node.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('runtimes.register_path')}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t('runtimes.node_path_desc')}</span>
                                    </div>
                                    <label className={`relative inline-flex items-center shrink-0 ${runtimeData.node.external?.exists ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <input type="checkbox" checked={runtimeData.node.in_path} onChange={(e) => handleTogglePath('node', e.target.checked)} disabled={runtimeData.node.external?.exists || isProcessing} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-40 peer-disabled:grayscale"></div>
                                    </label>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            <div className={activeTab === 'python' ? 'block' : 'hidden'}>
                {!runtimeData.python.installed && !runtimeData.python.external?.exists ? (
                    <EmptyState icon="data_object" title={t('runtimes.python_not_installed')} description={t('runtimes.python_desc')} actionText={t('runtimes.install_python_now')} onAction={() => setIsPythonModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('python', 'Python')}
                        {runtimeData.python.installed && (
                            <Card title="Python (VyloServe)" status={runtimeData.python.in_path ? t('runtimes.path_active') : t('runtimes.isolated')} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button type="button" onClick={() => setEngineToUninstall('python')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    {t('runtimes.uninstall_python')}
                                </button>
                            }>
                                {runtimeData.python.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">{t('runtimes.external_native_detected_1')}{runtimeData.python.external.version}{t('runtimes.external_native_detected_2')}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.python.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.package_manager')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{t('runtimes.pip_available')}</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.python.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('runtimes.register_path')}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t('runtimes.python_path_desc')}</span>
                                    </div>
                                    <label className={`relative inline-flex items-center shrink-0 ${runtimeData.python.external?.exists ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <input type="checkbox" checked={runtimeData.python.in_path} onChange={(e) => handleTogglePath('python', e.target.checked)} disabled={runtimeData.python.external?.exists || isProcessing} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-40 peer-disabled:grayscale"></div>
                                    </label>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            <div className={activeTab === 'java' ? 'block' : 'hidden'}>
                {!runtimeData.java.installed && !runtimeData.java.external?.exists ? (
                    <EmptyState icon="coffee" title={t('runtimes.java_not_installed')} description={t('runtimes.java_desc')} actionText={t('runtimes.install_java_now')} onAction={() => setIsJavaModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('java', 'Java JDK')}
                        {runtimeData.java.installed && (
                            <Card title="Java JDK (VyloServe)" status={runtimeData.java.in_path ? t('runtimes.path_active') : t('runtimes.isolated')} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button type="button" onClick={() => setEngineToUninstall('java')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    {t('runtimes.uninstall_java')}
                                </button>
                            }>
                                {runtimeData.java.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">{t('runtimes.external_native_detected_1')}{runtimeData.java.external.version}{t('runtimes.external_native_detected_2')}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.java.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.environment')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{t('runtimes.java_home_set')}</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.java.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('runtimes.register_path')}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t('runtimes.java_path_desc')}</span>
                                    </div>
                                    <label className={`relative inline-flex items-center ml-4 shrink-0 ${runtimeData.java.external?.exists ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <input type="checkbox" checked={runtimeData.java.in_path} onChange={(e) => handleTogglePath('java', e.target.checked)} disabled={runtimeData.java.external?.exists || isProcessing} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-40 peer-disabled:grayscale"></div>
                                    </label>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            <div className={activeTab === 'go' ? 'block' : 'hidden'}>
                {!runtimeData.go.installed && !runtimeData.go.external?.exists ? (
                    <EmptyState icon="rocket_launch" title={t('runtimes.go_not_installed')} description={t('runtimes.go_desc')} actionText={t('runtimes.install_go_now')} onAction={() => setIsGoModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('go', 'Go Compiler')}
                        {runtimeData.go.installed && (
                            <Card title="Go Compiler (VyloServe)" status={runtimeData.go.in_path ? t('runtimes.path_active') : t('runtimes.isolated')} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button type="button" onClick={() => setEngineToUninstall('go')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    {t('runtimes.uninstall_go')}
                                </button>
                            }>
                                {runtimeData.go.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">{t('runtimes.external_native_detected_1')}{runtimeData.go.external.version}{t('runtimes.external_native_detected_2')}</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.go.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.architecture')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">amd64</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.go.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('runtimes.register_path')}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t('runtimes.go_path_desc')}</span>
                                    </div>
                                    <label className={`relative inline-flex items-center ml-4 shrink-0 ${runtimeData.go.external?.exists ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <input type="checkbox" checked={runtimeData.go.in_path} onChange={(e) => handleTogglePath('go', e.target.checked)} disabled={runtimeData.go.external?.exists || isProcessing} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-40 peer-disabled:grayscale"></div>
                                    </label>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            <BackgroundProgressWidget
                isOpen={isMinimized && isProcessing && !!installingEngine}
                progress={progress}
                progressText={progressText}
                title={`${t('runtimes.install_title')}${installingEngine}`}
                onRestore={() => setIsMinimized(false)}
            />

            <Modal
                isOpen={!!engineToUninstall && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => !isProcessing && setEngineToUninstall(null)}
                title={`${t('runtimes.uninstall_title')}${engineToUninstall?.toUpperCase()}`}
                icon="delete"
                onApply={executeUninstall}
                applyText={isProcessing ? t('runtimes.uninstalling_btn') : t('runtimes.yes_uninstall')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        {t('runtimes.uninstall_confirm_1')}<strong>{engineToUninstall?.toUpperCase()}</strong>{t('runtimes.uninstall_confirm_2')}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                        {t('runtimes.uninstall_warning_1')}<strong>{t('runtimes.uninstall_warning_2')}</strong>{t('runtimes.uninstall_warning_3')}
                    </p>
                </div>
                {isProcessing && renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isNodeModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsNodeModalOpen(false)}
                title={`${t('runtimes.install_title')}Node.js`}
                icon="javascript"
                onApply={handleInstallNodeSubmit}
                applyText={isProcessing ? t('runtimes.installing_btn') : t('runtimes.install_engine_btn')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallNode ref={nodeRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isPythonModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsPythonModalOpen(false)}
                title={`${t('runtimes.install_title')}Python`}
                icon="data_object"
                onApply={handleInstallPythonSubmit}
                applyText={isProcessing ? t('runtimes.installing_btn') : t('runtimes.install_engine_btn')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallPython ref={pythonRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isJavaModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsJavaModalOpen(false)}
                title={`${t('runtimes.install_title')}Java (JDK)`}
                icon="coffee"
                onApply={handleInstallJavaSubmit}
                applyText={isProcessing ? t('runtimes.installing_btn') : t('runtimes.install_engine_btn')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallJava ref={javaRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isGoModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsGoModalOpen(false)}
                title={`${t('runtimes.install_title')}Go Compiler`}
                icon="rocket_launch"
                onApply={handleInstallGoSubmit}
                applyText={isProcessing ? t('runtimes.installing_btn') : t('runtimes.install_engine_btn')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallGo ref={goRef} />
                </div>
                {renderProgressBar()}
            </Modal>
        </div>
    );
}