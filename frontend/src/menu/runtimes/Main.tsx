import { useState, useRef, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
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
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'node' | 'python' | 'java' | 'go'>('node');

    const [runtimeData, setRuntimeData] = useState(INITIAL_DATA);
    const [isLoading, setIsLoading] = useState(true);

    // States untuk Logika Instalasi & Progress Widget
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

    // --- LISTENER PROGRESS BAR BACKEND ---
    useEffect(() => {
        const handleProgress = (event: any) => {
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
        } catch (error) {
            console.error("Gagal memuat status runtimes:", error);
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
            showToast(`Opsi dikunci karena terdeteksi instalasi ${engine} eksternal resmi.`, "error");
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
                if (enable) showToast(`Sistem PATH untuk ${engine} ditambahkan. Harap restart terminal Anda.`, "success");
                else showToast(`Sistem PATH untuk ${engine} berhasil dihapus.`, "success");
            } else {
                showToast(res?.message || "Gagal mengubah PATH", "error");
            }
        } catch (error) {
            showToast("Terjadi kesalahan sistem saat mengubah PATH.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const executeUninstall = async () => {
        if (!engineToUninstall) return;

        setIsProcessing(true);
        setProgress(100);
        setProgressText(`Menghapus modul ${engineToUninstall.toUpperCase()} beserta konfigurasi PATH...`);

        try {
            let res;
            if (engineToUninstall === 'node') res = await window.pywebview?.api?.uninstall_node();
            else if (engineToUninstall === 'python') res = await window.pywebview?.api?.uninstall_python();
            else if (engineToUninstall === 'java') res = await window.pywebview?.api?.uninstall_java();
            else if (engineToUninstall === 'go') res = await window.pywebview?.api?.uninstall_go();

            if (res?.status === 'success') {
                showToast(`Modul ${engineToUninstall.toUpperCase()} berhasil dihapus secara bersih.`, "success");
                setEngineToUninstall(null);
                fetchStatuses();
            } else {
                showToast(res?.message || `Gagal menghapus modul ${engineToUninstall}`, "error");
            }
        } catch (error) {
            showToast("Terjadi kesalahan sistem saat menghapus modul.", "error");
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
        setProgressText('Memulai instalasi...');

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
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Proses Berjalan</span>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || 'Menyiapkan...'}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    const renderFloatingWidget = () => {
        if (!isMinimized || !isProcessing || !installingEngine) return null;

        return (
            <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-[18px]">system_update_alt</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-slate-900 dark:text-white leading-none truncate">Installing {installingEngine}</span>
                            <span className="text-[10px] text-slate-500 mt-1">Berjalan di latar belakang</span>
                        </div>
                    </div>
                    <button onClick={() => setIsMinimized(false)} className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none">
                        <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                    </button>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5 px-0.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || 'Memproses...'}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    const renderExternalCard = (engineId: 'node' | 'python' | 'java' | 'go', engineTitle: string) => {
        const ext = runtimeData[engineId].external;
        if (!ext?.exists || runtimeData[engineId].installed) return null;

        return (
            <Card title={`${engineTitle} (Native)`} status="Native OS" gridCols="grid-cols-1">
                <div className="flex flex-col gap-1 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">Installed Version</span>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{ext.version}</span>
                </div>
                <div className="flex flex-col gap-1 mt-3 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">System Path Binary</span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all bg-slate-100 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                        {ext.path}
                    </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                    <div className="flex items-start gap-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">lock</span>
                        <span className="leading-relaxed break-words">Terinstal di luar VyloServe. Aksi modifikasi lingkungan dinonaktifkan.</span>
                    </div>
                </div>
            </Card>
        );
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="terminal"
                title="Runtimes & Engines"
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span>{isLoading ? 'Memuat data...' : `${activeEnginesCount} Engines detected`}</>}
                actions={
                    <button
                        onClick={handleOpenInstall}
                        disabled={runtimeData[activeTab].installed || isLoading}
                        className="bg-primary hover:bg-blue-600 disabled:bg-slate-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px]">{runtimeData[activeTab].installed ? 'check_circle' : 'add'}</span>
                        {runtimeData[activeTab].installed ? 'Installed' : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                    </button>
                }
            />

            {/* FIX 1: Membungkus TABS untuk mencegah Horizontal Blowout secara absolut */}
            <div className="w-full max-w-full overflow-hidden mb-6">
                <div className="flex w-full gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('node')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'node' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Node.js {(runtimeData.node.installed || runtimeData.node.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.node.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button onClick={() => setActiveTab('python')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'python' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Python {(runtimeData.python.installed || runtimeData.python.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.python.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button onClick={() => setActiveTab('java')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'java' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Java JDK {(runtimeData.java.installed || runtimeData.java.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.java.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                    <button onClick={() => setActiveTab('go')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'go' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        Go Compiler {(runtimeData.go.installed || runtimeData.go.external?.exists) && <span className={`w-2 h-2 rounded-full shrink-0 ${runtimeData.go.installed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>}
                    </button>
                </div>
            </div>

            <div className={activeTab === 'node' ? 'block' : 'hidden'}>
                {!runtimeData.node.installed && !runtimeData.node.external?.exists ? (
                    <EmptyState icon="javascript" title="Node.js is not installed" description="Install Node.js to run JavaScript frameworks, Vite, Next.js, dan npm." actionText="Install Node.js now" onAction={() => setIsNodeModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('node', 'Node.js')}
                        {runtimeData.node.installed && (
                            <Card
                                title="Node.js (VyloServe)"
                                status={runtimeData.node.in_path ? "PATH Active" : "Isolated"}
                                gridCols="grid-cols-1 md:grid-cols-2"
                                dropdownActions={
                                    <button onClick={() => setEngineToUninstall('node')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                        Uninstall Node.js
                                    </button>
                                }
                            >
                                {runtimeData.node.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">Instalasi eksternal native ({runtimeData.node.external.version}) terdeteksi. Opsi Global PATH dikunci.</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Version</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.node.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Package Manager</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">npm (Corepack enabled)</span></div>

                                {/* FIX 2: Layout Toggle PATH dikunci dengan flex-1 min-w-0 dan shrink-0 */}
                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.node.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>Register to Windows PATH</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">Make `node` and `npm` accessible globally.</span>
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
                    <EmptyState icon="data_object" title="Python is not installed" description="Install an isolated Python environment for backend APIs, data science, or scripting." actionText="Install Python now" onAction={() => setIsPythonModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('python', 'Python')}
                        {runtimeData.python.installed && (
                            <Card title="Python (VyloServe)" status={runtimeData.python.in_path ? "PATH Active" : "Isolated"} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button onClick={() => setEngineToUninstall('python')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    Uninstall Python
                                </button>
                            }>
                                {runtimeData.python.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">Instalasi eksternal native ({runtimeData.python.external.version}) terdeteksi. Opsi Global PATH dikunci.</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Version</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.python.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Package Manager</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">pip (Available)</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.python.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>Register to Windows PATH</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">Make `python` and `pip` accessible globally.</span>
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
                    <EmptyState icon="coffee" title="Java JDK is not installed" description="Install Java Virtual Machine (JVM) untuk mengeksekusi script PySpark atau HetuEngine." actionText="Install JDK now" onAction={() => setIsJavaModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('java', 'Java JDK')}
                        {runtimeData.java.installed && (
                            <Card title="Java JDK (VyloServe)" status={runtimeData.java.in_path ? "PATH Active" : "Isolated"} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button onClick={() => setEngineToUninstall('java')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    Uninstall Java
                                </button>
                            }>
                                {runtimeData.java.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">Instalasi eksternal native ({runtimeData.java.external.version}) terdeteksi. Opsi Global PATH dikunci.</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Version</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.java.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Environment</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">JAVA_HOME (Set)</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.java.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>Register to Windows PATH</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">Make `java` and `javac` accessible globally.</span>
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
                    <EmptyState icon="rocket_launch" title="Go Compiler is not installed" description="Install Go to build fast, reliable, and efficient microservices locally." actionText="Install Go now" onAction={() => setIsGoModalOpen(true)} />
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                        {renderExternalCard('go', 'Go Compiler')}
                        {runtimeData.go.installed && (
                            <Card title="Go Compiler (VyloServe)" status={runtimeData.go.in_path ? "PATH Active" : "Isolated"} gridCols="grid-cols-1 md:grid-cols-2" dropdownActions={
                                <button onClick={() => setEngineToUninstall('go')} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                                    Uninstall Go
                                </button>
                            }>
                                {runtimeData.go.external?.exists && (
                                    <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                        <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">Instalasi eksternal native ({runtimeData.go.external.version}) terdeteksi. Opsi Global PATH dikunci.</span>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Version</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{runtimeData.go.version}</span></div>
                                <div className="flex flex-col gap-1 min-w-0 w-full"><span className="text-xs font-medium text-slate-500 uppercase">Architecture</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">amd64</span></div>

                                <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate ${runtimeData.go.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>Register to Windows PATH</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">Make `go` accessible globally via terminal command.</span>
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

            {/* WIDGET FLOATING: MUNCUL KETIKA DI-MINIMIZE */}
            {renderFloatingWidget()}

            {/* MODALS */}
            <Modal
                isOpen={!!engineToUninstall && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => !isProcessing && setEngineToUninstall(null)}
                title={`Uninstall ${engineToUninstall?.toUpperCase()}`}
                icon="delete"
                onApply={executeUninstall}
                applyText={isProcessing ? "Menghapus..." : "Ya, Uninstall"}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        Apakah Anda yakin ingin menghapus <strong>{engineToUninstall?.toUpperCase()}</strong> dari VyloServe?
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                        Aksi ini akan menghapus seluruh file biner pada direktori instalasi dan <strong>secara otomatis membersihkan</strong> variabel lingkungan (PATH) dari sistem Windows Anda.
                    </p>
                </div>
                {isProcessing && renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isNodeModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsNodeModalOpen(false)}
                title="Install Node.js"
                icon="javascript"
                onApply={handleInstallNodeSubmit}
                applyText={isProcessing ? "Installing..." : "Install Engine"}
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
                title="Install Python"
                icon="data_object"
                onApply={handleInstallPythonSubmit}
                applyText={isProcessing ? "Installing..." : "Install Engine"}
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
                title="Install Java (JDK)"
                icon="coffee"
                onApply={handleInstallJavaSubmit}
                applyText={isProcessing ? "Installing..." : "Install Engine"}
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
                title="Install Go Compiler"
                icon="rocket_launch"
                onApply={handleInstallGoSubmit}
                applyText={isProcessing ? "Installing..." : "Install Engine"}
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