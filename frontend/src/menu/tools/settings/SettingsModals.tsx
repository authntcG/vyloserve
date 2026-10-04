import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import appIcon from '../../../assets/icons-nobg.png';
import { applyTheme } from '../../../utils/theme';

export type SettingsModalType = 'settings' | 'quit' | null;

const LOG_LEVELS = [
    { key: 'info', labelKey: 'settings.log_level_info', dotClass: 'bg-primary' },
    { key: 'warn', labelKey: 'settings.log_level_warn', dotClass: 'bg-amber-400' },
    { key: 'error', labelKey: 'settings.log_level_error', dotClass: 'bg-red-500' },
    { key: 'success', labelKey: 'settings.log_level_success', dotClass: 'bg-emerald-500' },
];

const LOG_SOURCE_GROUPS = [
    { icon: 'dns', labelKey: 'settings.log_source_apache', systemKey: 'ApacheManager', fileKey: 'ApacheFileLog' },
    { icon: 'code', labelKey: 'settings.log_source_php', systemKey: 'PhpManager' },
    { icon: 'database', labelKey: 'settings.log_source_database', systemKey: 'DatabaseManager', fileKey: 'DatabaseFileLog' },
    { icon: 'folder', labelKey: 'settings.log_source_project', systemKey: 'ProjectManager' },
    { icon: 'terminal', labelKey: 'settings.log_source_runtimes', systemKey: 'RuntimesManager' },
    { icon: 'merge', labelKey: 'settings.log_source_git', systemKey: 'GitManager' },
    { icon: 'lock', labelKey: 'settings.log_source_ssl', systemKey: 'SslManager' },
    { icon: 'grid_view', labelKey: 'settings.log_source_dashboard', systemKey: 'DashboardManager' },
    { icon: 'settings', labelKey: 'settings.log_source_settings', systemKey: 'SettingsManager' },
    { icon: 'router', labelKey: 'settings.log_source_tunnels', systemKey: 'TunnelsManager' },
];

const ALL_LOG_LEVEL_KEYS = LOG_LEVELS.map(l => l.key);
const ALL_LOG_SOURCE_KEYS = LOG_SOURCE_GROUPS.flatMap(g => g.fileKey ? [g.systemKey, g.fileKey] : [g.systemKey]);

interface SettingsModalsProps {
    readonly activeModal: SettingsModalType;
    readonly defaultTab?: 'general' | 'logs' | 'updates' | 'about';
    readonly onClose: () => void;
}

function UpdatesTabContent() {
    const { t } = useTranslation();
    const [receivePrerelease, setReceivePrerelease] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('');
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateResult, setUpdateResult] = useState<any>(null);
    const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
    const [isReadyToInstall, setIsReadyToInstall] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [downloadText, setDownloadText] = useState<string>('');
    const [downloadTextArgs, setDownloadTextArgs] = useState<any>({});

    useEffect(() => {
        const api = (window as any).pywebview?.api;
        if (!api) return;

        api.get_app_version().then((ver: string) => setAppVersion(ver));

        api.get_app_settings().then((res: any) => {
            if (res?.status === 'success') {
                setReceivePrerelease(res.data?.receive_prerelease_updates ?? false);
            }
        });

        api.get_update_status().then((status: any) => {
            setUpdateResult(status.result);
            setIsDownloadingUpdate(status.is_downloading);
            setIsReadyToInstall(status.is_ready);
            if (status.is_downloading) {
                setDownloadProgress(status.progress_percent || 0);
                setDownloadText(status.progress_text || '');
                setDownloadTextArgs(status.progress_args || {});
            }
        });

        const handleProgress = (e: Event) => {
            const ce = e as CustomEvent;
            if (ce.detail?.text?.includes('backend.updater')) {
                setDownloadProgress(ce.detail.percent);
                setDownloadText(ce.detail.text);
                setDownloadTextArgs(ce.detail.args || {});
            }
        };

        const handleUpdateReady = () => {
            setIsDownloadingUpdate(false);
            setIsReadyToInstall(true);
            api.get_update_status().then((status: any) => {
                setUpdateResult(status.result);
            });
        };

        window.addEventListener('vylo_progress', handleProgress);
        window.addEventListener('vylo_update_ready', handleUpdateReady);

        return () => {
            window.removeEventListener('vylo_progress', handleProgress);
            window.removeEventListener('vylo_update_ready', handleUpdateReady);
        };
    }, []);

    const handleTogglePrerelease = async () => {
        const newVal = !receivePrerelease;
        setReceivePrerelease(newVal);
        const api = (window as any).pywebview?.api;
        if (!api) return;
        const res = await api.get_app_settings();
        if (res?.status === 'success') {
            await api.save_app_settings({
                ...res.data,
                receive_prerelease_updates: newVal
            });
            handleCheckUpdate();
        }
    };

    const handleCheckUpdate = async () => {
        const api = (window as any).pywebview?.api;
        if (!api) return;
        setIsCheckingUpdate(true);
        setUpdateResult(null);
        setIsReadyToInstall(false);
        try {
            const res = await api.check_for_updates();
            setUpdateResult(res);
        } catch (e) {
            console.error(e);
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    const handleDownloadUpdate = async () => {
        const api = (window as any).pywebview?.api;
        if (!api || !updateResult?.asset_url) return;
        setIsDownloadingUpdate(true);
        setDownloadProgress(0);
        try {
            await api.start_download_update(updateResult.asset_url, updateResult.asset_name);
        } catch (e) {
            console.error(e);
            setIsDownloadingUpdate(false);
        }
    };

    const handleInstallUpdate = async () => {
        const api = (window as any).pywebview?.api;
        if (!api) return;
        try {
            await api.install_update();
        } catch (e) {
            console.error(e);
        }
    };

    const renderUpdateStatus = () => {
        if (!updateResult) return null;

        if (updateResult.status === 'error') {
            return (
                <div className="text-sm text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined align-middle mr-2 text-[18px]">error</span>
                    {t(updateResult.message, updateResult.args) as string}
                </div>
            );
        }
        
        if (!updateResult.is_update_available) {
            return (
                <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {t(updateResult.message) as string}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span className="material-symbols-outlined text-[20px]">new_releases</span>
                    {t('ui.update.available', 'New Update Available!')} ({updateResult.version})
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs bg-white dark:bg-black/20 p-3 rounded border border-emerald-100 dark:border-emerald-900/50">
                    {updateResult.changelog || t('ui.update.no_changelog', 'No changelog provided.')}
                </div>

                {isDownloadingUpdate && (
                    <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                            <span>{(downloadText ? (t(downloadText, downloadTextArgs) as string) : '') || t('ui.update.downloading_fallback', 'Downloading...')}</span>
                            <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic">* {t('ui.update.close_hint_background', 'You can close this modal, the download will continue in the background.')}</p>
                    </div>
                )}

                {(!isDownloadingUpdate && isReadyToInstall) && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-emerald-200 dark:border-emerald-900/50 pt-3">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            <span className="text-sm font-semibold">{t('ui.update.download_complete', 'Download Complete. Ready to install!')}</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    let resultContainerClass = 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900';
    if (updateResult?.status === 'error') {
        resultContainerClass = 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20';
    } else if (updateResult?.is_update_available) {
        resultContainerClass = 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10';
    }

    return (
        <div className="flex flex-col gap-6 w-full max-w-2xl p-8">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{t('ui.update.current_version', 'Current Version')}</span>
                    <span className="text-lg font-mono text-slate-800 dark:text-slate-200">{appVersion || '...'}</span>
                </div>
                <button
                    type="button"
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate || isDownloadingUpdate || isReadyToInstall}
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm active:scale-95"
                >
                    {isCheckingUpdate ? (
                        <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> {t('ui.update.checking', 'Checking...')}</>
                    ) : (
                        <><span className="material-symbols-outlined text-[18px]">search</span> {t('ui.update.check', 'Check for Updates')}</>
                    )}
                </button>
            </div>
            
            <div className="flex items-center justify-between p-1">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.receive_prerelease', 'Receive Pre-release Updates')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t('settings.receive_prerelease_desc', 'Get early access to alpha and beta versions.')}
                    </span>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={receivePrerelease}
                    onClick={handleTogglePrerelease}
                    disabled={isCheckingUpdate || isDownloadingUpdate || isReadyToInstall}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none transition-colors ${receivePrerelease ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${receivePrerelease ? 'translate-x-2' : '-translate-x-2'}`}
                    />
                </button>
            </div>

            {updateResult && (
                <div className={`p-4 rounded-lg border ${resultContainerClass}`}>
                    {renderUpdateStatus()}
                </div>
            )}

            {/* Updates Action Footer */}
            {((updateResult?.is_update_available && !isDownloadingUpdate && !isReadyToInstall) || isReadyToInstall) && (
                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                {updateResult?.is_update_available && !isDownloadingUpdate && !isReadyToInstall && (
                    <button
                        type="button"
                        onClick={handleDownloadUpdate}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        {t('ui.update.download_restart', 'Download & Install')}
                    </button>
                )}

                {isReadyToInstall && (
                    <button
                        type="button"
                        onClick={handleInstallUpdate}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">system_update_alt</span>
                        <span>{t('ui.update.install_restart', 'Install & Restart')}</span>
                    </button>
                )}
                </div>
            )}
        </div>
    );
}

export default function SettingsModals({ activeModal, defaultTab = 'general', onClose }: SettingsModalsProps) {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'updates' | 'about'>(defaultTab);

    useEffect(() => {
        if (activeModal === 'settings') {
            setActiveTab(defaultTab);
        }
    }, [activeModal, defaultTab]);
    
    // General Settings
    const [selectedLang, setSelectedLang] = useState(i18n.language);
    const [selectedTheme, setSelectedTheme] = useState('vyloserve-dark');
    
    // Logs Settings
    const [logLevels, setLogLevels] = useState<string[]>(ALL_LOG_LEVEL_KEYS);
    const [logSources, setLogSources] = useState<string[]>(ALL_LOG_SOURCE_KEYS);
    
    // About
    const [appVersion, setAppVersion] = useState<string>('');

    // Load initial settings
    useEffect(() => {
        if (activeModal === 'settings') {
            setSelectedLang(i18n.language);
            const api = (window as any).pywebview?.api;
            if (api) {
                api.get_app_version().then((ver: string) => setAppVersion(ver));
                api.get_app_settings().then((res: any) => {
                    if (res?.status === 'success') {
                        setSelectedTheme(res.data?.theme || 'vyloserve-dark');
                        setLogLevels(res.data?.system_log_levels ?? ALL_LOG_LEVEL_KEYS);
                        setLogSources(res.data?.system_log_sources ?? ALL_LOG_SOURCE_KEYS);
                    }
                });
            }
        }
    }, [activeModal, i18n.language]);

    // Helpers to save settings instantly
    const saveSettingsInstantly = async (updates: any) => {
        const api = (window as any).pywebview?.api;
        if (api && typeof api.save_app_settings === 'function') {
            await api.save_app_settings(updates);
        }
    };

    const handleLanguageChange = (lang: string) => {
        setSelectedLang(lang);
        i18n.changeLanguage(lang);
        saveSettingsInstantly({ language: lang });
    };

    const handleThemeChange = (theme: string) => {
        setSelectedTheme(theme);
        applyTheme(theme);
        saveSettingsInstantly({ theme });
    };

    const handleToggleLogLevel = (key: string) => {
        const newLevels = logLevels.includes(key) ? logLevels.filter(k => k !== key) : [...logLevels, key];
        setLogLevels(newLevels);
        saveSettingsInstantly({ system_log_levels: newLevels }).then(() => {
            window.dispatchEvent(new CustomEvent('vylo_log_settings_changed'));
        });
    };

    const handleToggleLogSource = (key: string) => {
        const newSources = logSources.includes(key) ? logSources.filter(k => k !== key) : [...logSources, key];
        setLogSources(newSources);
        saveSettingsInstantly({ system_log_sources: newSources }).then(() => {
            window.dispatchEvent(new CustomEvent('vylo_log_settings_changed'));
        });
    };

    const handleSelectAllSources = (selectAll: boolean) => {
        const newSources = selectAll ? ALL_LOG_SOURCE_KEYS : [];
        setLogSources(newSources);
        saveSettingsInstantly({ system_log_sources: newSources }).then(() => {
            window.dispatchEvent(new CustomEvent('vylo_log_settings_changed'));
        });
    };

    return (
        <>
            <Modal
                isOpen={activeModal === 'settings'}
                onClose={onClose}
                title={t('settings.settings')}
                icon="settings"
                maxWidthClass="md:w-[760px] lg:w-[860px] max-w-full"
                bodyPaddingClass="p-0"
            >
                <div className="flex flex-row h-[70vh] min-h-[450px] max-h-[600px] bg-white dark:bg-slate-900 rounded-b-xl overflow-hidden">
                    {/* VERTICAL SIDEBAR TABS */}
                    <div className="w-56 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
                        <button 
                            type="button" 
                            onClick={() => setActiveTab('general')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">tune</span>
                            {t('settings.general')}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab('logs')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">filter_list</span>
                            {t('settings.system_logs')}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab('updates')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'updates' ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">system_update</span>
                            {t('settings.updates')}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab('about')}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'about' ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">info</span>
                            {t('settings.about')}
                        </button>
                    </div>

                    {/* TAB CONTENT */}
                    <div className="flex-1 overflow-y-auto relative flex flex-col">
                        
                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="flex flex-col gap-8 w-full max-w-2xl p-8">
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{t('settings.change_language')}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('settings.language_desc')}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="lang-en" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedLang === 'en' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <input id="lang-en" type="radio" name="language" value="en" checked={selectedLang === 'en'} onChange={() => handleLanguageChange('en')} className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.lang_option_english', 'English')}</span>
                                        </label>
                                        <label htmlFor="lang-id" className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedLang === 'id' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <input id="lang-id" type="radio" name="language" value="id" checked={selectedLang === 'id'} onChange={() => handleLanguageChange('id')} className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.lang_option_indonesian', 'Indonesian')}</span>
                                        </label>
                                    </div>
                                </div>
                                <hr className="border-slate-200 dark:border-slate-800" />
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label htmlFor="theme-select" className="block text-lg font-semibold text-slate-900 dark:text-white mb-1">{t('settings.theme')}</label>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('settings.theme_desc')}
                                        </p>
                                    </div>
                                    <select
                                        id="theme-select"
                                        value={selectedTheme}
                                        onChange={(e) => handleThemeChange(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                                    >
                                        <option value="vyloserve-dark">{t('settings.theme_vyloserve_dark')}</option>
                                        <option value="vyloserve-light">{t('settings.theme_vyloserve_light')}</option>
                                        <option value="darcula-dark">{t('settings.theme_darcula_dark')}</option>
                                        <option value="solarized-dark">{t('settings.theme_solarized_dark')}</option>
                                        <option value="solarized-light">{t('settings.theme_solarized_light')}</option>
                                        <option value="high-contrast-dark">{t('settings.theme_high_contrast_dark')}</option>
                                        <option value="high-contrast-light">{t('settings.theme_high_contrast_light')}</option>
                                        <option value="monokai-dark">{t('settings.theme_monokai_dark')}</option>
                                        <option value="dracula-dark">{t('settings.theme_dracula_dark')}</option>
                                        <option value="nord-dark">{t('settings.theme_nord_dark')}</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* LOGS TAB */}
                        {activeTab === 'logs' && (
                            <div className="flex flex-col gap-8 w-full max-w-2xl p-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{t('settings.system_logs')}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('settings.system_logs_desc')}
                                    </p>
                                </div>
                                
                                <section className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px] text-slate-400">tune</span>
                                            <h4 className="font-medium text-slate-900 dark:text-slate-100">{t('settings.log_level')}</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">{t('settings.log_level_desc')}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pl-6">
                                        {LOG_LEVELS.map(level => (
                                            <label key={level.key} htmlFor={`log-lvl-${level.key}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group">
                                                <input id={`log-lvl-${level.key}`} aria-label={t(level.labelKey) as string} type="checkbox" checked={logLevels.includes(level.key)} onChange={() => handleToggleLogLevel(level.key)} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${level.dotClass} group-hover:scale-110 transition-transform`}></span>
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">{t(level.labelKey)}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </section>

                                <hr className="border-slate-200 dark:border-slate-800" />

                                <section className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px] text-slate-400">category</span>
                                                <h4 className="font-medium text-slate-900 dark:text-slate-100">{t('settings.log_source')}</h4>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => handleSelectAllSources(logSources.length !== ALL_LOG_SOURCE_KEYS.length)} 
                                                className="text-xs font-medium text-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded"
                                            >
                                                {logSources.length === ALL_LOG_SOURCE_KEYS.length ? t('common.unselect_all', 'Unselect All') : t('common.select_all', 'Select All')}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">{t('settings.log_source_desc')}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                                        {LOG_SOURCE_GROUPS.map(group => {
                                            const isActive = logSources.includes(group.systemKey);
                                            return (
                                                <label key={group.systemKey} htmlFor={`log-src-${group.systemKey}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group">
                                                    <input 
                                                        id={`log-src-${group.systemKey}`} aria-label={t(group.labelKey) as string}
                                                        type="checkbox" 
                                                        checked={isActive} 
                                                        onChange={() => {
                                                            if (group.fileKey) {
                                                                const newSources = [...logSources];
                                                                if (isActive) {
                                                                    const i1 = newSources.indexOf(group.systemKey); if(i1>-1) newSources.splice(i1, 1);
                                                                    const i2 = newSources.indexOf(group.fileKey); if(i2>-1) newSources.splice(i2, 1);
                                                                } else {
                                                                    newSources.push(group.systemKey, group.fileKey);
                                                                }
                                                                setLogSources(newSources);
                                                                saveSettingsInstantly({ system_log_sources: newSources }).then(() => {
                                                                    window.dispatchEvent(new CustomEvent('vylo_log_settings_changed'));
                                                                });
                                                            } else {
                                                                handleToggleLogSource(group.systemKey);
                                                            }
                                                        }} 
                                                        className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" 
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary transition-colors">{group.icon}</span>
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{t(group.labelKey)}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* UPDATES TAB */}
                        {activeTab === 'updates' && <UpdatesTabContent />}

                        {/* ABOUT TAB */}
                        {activeTab === 'about' && (
                            <div className="flex flex-col w-full h-full">
                                <div className="flex flex-col items-center justify-center text-center py-8 px-8">
                                    <div className="w-24 h-24 mb-6 relative">
                                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                                        <img src={appIcon} alt="VyloServe" className="w-full h-full object-contain relative z-10" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">VyloServe</h2>
                                    <p className="text-slate-600 dark:text-slate-400 mb-6 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">Version {appVersion}</p>
                                    
                                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                                        <p>{t('settings.about_desc')}</p>
                                        <p>{t('settings.about_built_with', 'Built with React, Vite, Tailwind, and Python.')}</p>
                                    </div>
                                </div>

                                <div className="mt-auto px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-none sm:rounded-b-lg border-x-0 border-b-0 sm:border-x sm:border-b">
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <a href="https://github.com/authntcG/vyloserve/" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-2 px-4 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 transition-colors shadow-sm">
                                            <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"></path>
                                            </svg>
                                            <span className="leading-none">{t('settings.view_on_github') || 'View on GitHub'}</span>
                                        </a>
                                        <a href="https://github.com/authntcG/vyloserve/blob/main/docs/index.md" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-2 px-4 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                            <span className="material-symbols-outlined text-[16px] leading-none">menu_book</span>
                                            <span className="leading-none">{t('settings.documentation') || 'Documentation'}</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={activeModal === 'quit'}
                onClose={onClose}
                title={t('settings.quit')}
                icon="power_settings_new"
                onApply={() => {
                    const api = (window as any).pywebview?.api;
                    if (api) api.close_app();
                }}
                applyText={t('common.yes')}
                isDestructive={true}
            >
                <div className="flex flex-col gap-2">
                    <p className="text-slate-700 dark:text-slate-300">
                        {t('settings.quit_desc')}
                    </p>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {t('settings.quit_warning')}
                    </p>
                </div>
            </Modal>
        </>
    );
}
