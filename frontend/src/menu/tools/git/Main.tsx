import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Modal from '../../../components/Modal';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../components/ToastContext';

// --- SUB-KOMPONEN: FORM INSTALASI GIT ---
interface InstallGitRef { submit: () => Promise<boolean>; }
const InstallGitForm = forwardRef<InstallGitRef, any>((_, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_git_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    setVersionsList(res.data);
                    setSelectedIndex('0');
                } else {
                    setVersionsList([]);
                }
            } catch (error) {
                setVersionsList([]);
                showToast(t('tools.git.fetch_error'), "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, []);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (versionsList.length === 0) return false;
            try {
                const selected = versionsList[parseInt(selectedIndex)];
                const res = await window.pywebview?.api?.install_git(selected.value, selected.filename, selected.version_text);
                if (res?.status === 'success') return true;
                throw new Error(res?.message || t('tools.git.install_error'));
            } catch (error: any) {
                showToast(error.message || t('tools.git.sys_install_error'), "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.git.select_release')}</label>

                {isLoading ? (
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="material-symbols-outlined text-[18px] animate-spin text-primary">refresh</span>
                        </div>
                        <select disabled className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-wait">
                            <option>{t('tools.git.retrieving')}</option>
                        </select>
                    </div>

                ) : versionsList.length === 0 ? (
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="material-symbols-outlined text-[18px] text-red-500">wifi_off</span>
                    </div>
                    <select disabled className="w-full bg-red-50 dark:bg-red-900/10 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-not-allowed">
                        <option>{t('tools.git.error_fetching')}</option>
                    </select>
                </div>

                ) : (
                <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none cursor-pointer"
                >
                    {versionsList.map((v, idx) => (
                        <option key={idx} value={idx}>{v.label}</option>
                    ))}
                </select>
                )}

                <span className="text-xs text-slate-500 mt-1">
                    {t('tools.git.binary_desc_1')} <strong>PortableGit 64-bit (SFX)</strong> {t('tools.git.binary_desc_2')} <code>git-for-windows</code>.
                </span>
            </div>
        </div>
    );
});


// --- KOMPONEN UTAMA: GIT MAIN ---
const INITIAL_DATA = { installed: false, version: '', in_path: false, external: { exists: false, path: '', version: '' } };

export default function GitMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [gitData, setGitData] = useState(INITIAL_DATA);
    const [configData, setConfigData] = useState({ userName: '', userEmail: '' });
    const [isLoading, setIsLoading] = useState(true);

    // States Logika Instalasi & UI Progress
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    const gitRef = useRef<InstallGitRef>(null);

    useEffect(() => {
        const handleProgress = (event: any) => {
            const { percent, text } = event.detail;
            setProgress(percent < 0 ? 0 : percent);
            setProgressText(text);
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const api = window.pywebview?.api;
            if (api) {
                const status = await api.get_git_status();
                setGitData(status);

                // Fetch konfigurasi Git Global (user.name & user.email)
                const conf = await api.get_git_config();
                if (conf?.status === 'success') {
                    setConfigData({ userName: conf.data.name || '', userEmail: conf.data.email || '' });
                }
            }
        } catch (error) {
            console.error(t('tools.git.load_error'), error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, []);

    const handleTogglePath = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const enable = e.target.checked;
        if (gitData.external?.exists) {
            showToast(t('tools.git.lock_warning'), "error");
            return;
        }

        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.toggle_git_path(enable);
            if (res?.status === 'success') {
                setGitData(prev => ({ ...prev, in_path: enable }));
                showToast(enable ? t('tools.git.path_added') : t('tools.git.path_removed'), "success");
            } else {
                showToast(res?.message || t('tools.git.path_error'), "error");
            }
        } catch (error) {
            showToast(t('tools.git.sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveConfig = async () => {
        setIsProcessing(true);
        try {
            const res = await window.pywebview?.api?.set_git_config(configData.userName, configData.userEmail);
            if (res?.status === 'success') {
                showToast(t('tools.git.config_saved'), "success");
            } else {
                showToast(res?.message || t('tools.git.config_error'), "error");
            }
        } catch (error) {
            showToast(t('tools.git.sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInstallSubmit = async () => {
        if (!gitRef.current) return;
        setIsProcessing(true);
        setProgress(0);
        setProgressText(t('tools.git.starting_install'));

        const success = await gitRef.current.submit();
        if (success) {
            setIsInstallModalOpen(false);
            fetchStatus();
        }
        setIsProcessing(false);
        setIsMinimized(false);
    };

    const executeUninstall = async () => {
        setIsProcessing(true);
        setProgress(100);
        setProgressText(t('tools.git.uninstalling'));
        try {
            const res = await window.pywebview?.api?.uninstall_git();
            if (res?.status === 'success') {
                showToast(t('tools.git.uninstall_success'), "success");
                setIsUninstallModalOpen(false);
                fetchStatus();
            } else {
                showToast(res?.message || t('tools.git.uninstall_error'), "error");
            }
        } catch (error) {
            showToast(t('tools.git.sys_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- RENDER HELPERS ---
    const renderProgressBar = () => {
        if (!isProcessing || isUninstallModalOpen) return null; // Sembunyikan untuk task yang cepat seperti config
        return (
            <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || t('tools.git.preparing')}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    const renderFloatingWidget = () => {
        if (!isMinimized || !isProcessing) return null;
        return (
            <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-[18px]">system_update_alt</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-bold text-slate-900 dark:text-white leading-none truncate">{t('tools.git.installing')}</span>
                            <span className="text-[10px] text-slate-500 mt-1">{t('tools.git.running_background')}</span>
                        </div>
                    </div>
                    <button onClick={() => setIsMinimized(false)} className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none">
                        <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                    </button>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5 px-0.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || t('tools.git.processing')}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    const renderExternalCard = () => {
        if (!gitData.external?.exists || gitData.installed) return null;
        return (
            <div className="mt-6">
                <Card title="Git (Native OS)" status={t('tools.git.native_os')} gridCols="grid-cols-1">
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.installed_version')}</span>
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{gitData.external.version}</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-3 w-full min-w-0">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.system_path_binary')}</span>
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all bg-slate-100 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                            {gitData.external.path}
                        </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                        <div className="flex items-start gap-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">lock</span>
                            <span className="leading-relaxed break-words">{t('tools.git.external_locked')}</span>
                        </div>
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="merge"
                title={t('tools.git.title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {isLoading ? t('tools.git.loading_data') : t('tools.git.subtitle')}</>}
                actions={
                    !gitData.installed && (
                        <button onClick={() => setIsInstallModalOpen(true)} disabled={isLoading || gitData.external?.exists} className="bg-primary hover:bg-blue-600 disabled:bg-slate-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm shrink-0 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            {t('tools.git.install_git')}
                        </button>
                    )
                }
            />

            {renderExternalCard()}

            {!gitData.installed && !gitData.external?.exists ? (
                <div className="mt-6">
                    <EmptyState
                        icon="merge" title={t('tools.git.not_installed_title')}
                        description={t('tools.git.not_installed_desc')}
                        actionText={t('tools.git.download_git_now')} onAction={() => setIsInstallModalOpen(true)}
                    />
                </div>
            ) : gitData.installed ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 w-full min-w-0">

                    {/* Card 1: Core System */}
                    <Card title={t('tools.git.core_system_title')} status={gitData.in_path ? t('tools.git.path_active') : t('tools.git.isolated')} dropdownActions={
                        <button onClick={() => setIsUninstallModalOpen(true)} disabled={isProcessing} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                            {t('tools.git.uninstall_git')}
                        </button>
                    }>
                        {gitData.external?.exists && (
                            <div className="col-span-1 md:col-span-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 w-full min-w-0">
                                <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
                                <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed break-words flex-1 min-w-0">{t('tools.git.external_warning')}</span>
                            </div>
                        )}
                        <div className="flex flex-col gap-1 w-full min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.version')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{gitData.version}</span></div>
                        <div className="flex flex-col gap-1 w-full min-w-0"><span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.architecture')}</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{t('tools.git.arch_portable')}</span></div>

                        <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <span className={`text-sm font-semibold truncate ${gitData.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t('tools.git.register_path')}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">{t('tools.git.register_path_desc')}</span>
                            </div>
                            <label className={`relative inline-flex items-center shrink-0 ml-4 ${gitData.external?.exists ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input type="checkbox" checked={gitData.in_path} onChange={handleTogglePath} disabled={gitData.external?.exists || isProcessing} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 peer-disabled:opacity-40 peer-disabled:grayscale"></div>
                            </label>
                        </div>
                    </Card>

                    {/* Card 2: Global Configuration */}
                    <Card title={t('tools.git.global_config')} status={t('tools.git.active')}>
                        <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
                            <div className="flex flex-col gap-1 min-w-0">
                                <label className="text-xs font-medium text-slate-500">{t('tools.git.global_user_name')} (<code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.name</code>)</label>
                                <input type="text" value={configData.userName} onChange={(e) => setConfigData({ ...configData, userName: e.target.value })} disabled={isProcessing} placeholder={t('tools.git.eg_name')} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-50" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                                <label className="text-xs font-medium text-slate-500">{t('tools.git.global_email')} (<code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.email</code>)</label>
                                <input type="email" value={configData.userEmail} onChange={(e) => setConfigData({ ...configData, userEmail: e.target.value })} disabled={isProcessing} placeholder={t('tools.git.eg_email')} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-50" />
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button onClick={handleSaveConfig} disabled={isProcessing} className="bg-slate-900 dark:bg-white hover:bg-slate-800 disabled:opacity-50 text-white dark:text-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all">
                                    {isProcessing ? t('tools.git.saving') : t('tools.git.save_config')}
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            ) : null}

            {renderFloatingWidget()}

            {/* MODAL INSTALL */}
            <Modal
                isOpen={isInstallModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => isProcessing ? setIsMinimized(true) : setIsInstallModalOpen(false)}
                title={t('tools.git.install_git')}
                icon="merge"
                onApply={handleInstallSubmit}
                applyText={isProcessing ? t('tools.git.installing_btn') : t('tools.git.install_engine')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <InstallGitForm ref={gitRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            {/* MODAL UNINSTALL */}
            <Modal
                isOpen={isUninstallModalOpen}
                keepMounted={isProcessing}
                onClose={() => !isProcessing && setIsUninstallModalOpen(false)}
                title={t('tools.git.uninstall_title')}
                icon="delete"
                onApply={executeUninstall}
                applyText={isProcessing ? t('tools.git.uninstalling_btn') : t('tools.git.yes_uninstall')}
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                    <p className="text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{__html: t('tools.git.uninstall_confirm')}}></p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">{t('tools.git.uninstall_warning')}</p>
                </div>
            </Modal>
        </div>
    );
}