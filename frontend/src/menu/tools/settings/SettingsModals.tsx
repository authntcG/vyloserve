import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import appIcon from '../../../assets/icons-nobg.png';

export type SettingsModalType = 'language' | 'about' | 'quit' | 'logs' | null;

// Daftar level & source/modul yang bisa disaring di panel System Logs. 'source' berasal dari
// auto-detection nama class Manager di backend (lihat core/api.py, _resolve_event_source).
// dotClass = warna dot indikator, mengikuti warna yang sama dipakai LogsPanel.getColorClass().
const LOG_LEVELS = [
    { key: 'info', labelKey: 'settings.log_level_info', dotClass: 'bg-primary' },
    { key: 'warn', labelKey: 'settings.log_level_warn', dotClass: 'bg-amber-400' },
    { key: 'error', labelKey: 'settings.log_level_error', dotClass: 'bg-red-500' },
    { key: 'success', labelKey: 'settings.log_level_success', dotClass: 'bg-emerald-500' },
];

// Dikelompokkan per-modul (bukan daftar datar) supaya Apache & Database masing-masing bisa
// menampilkan DUA toggle terpisah dalam satu baris: pesan sistem biasa (instal/start/stop/error)
// VS baris yang disalurkan dari file log persisten (error_log/access_log/db_startup.log/*.err
// lewat Api.start_log_watcher(), lihat docs/backend_services.md §11.2). `fileKey` di-set eksplisit
// lewat source_override di emit_log(), BUKAN auto-detect nama class, supaya keduanya bisa difilter
// independen (mis. matikan baris file log tapi tetap lihat pesan sistem, atau sebaliknya). Modul
// tanpa file log (PHP, Project, dst.) cukup satu toggle ("fileKey" di-omit).
const LOG_SOURCE_GROUPS = [
    { icon: 'dns', labelKey: 'settings.log_source_apache', systemKey: 'ApacheManager', fileKey: 'ApacheFileLog' },
    { icon: 'code', labelKey: 'settings.log_source_php', systemKey: 'PhpManager' },
    { icon: 'database', labelKey: 'settings.log_source_database', systemKey: 'DatabaseManager', fileKey: 'DatabaseFileLog' },
    { icon: 'folder', labelKey: 'settings.log_source_project', systemKey: 'ProjectManager' },
    { icon: 'terminal', labelKey: 'settings.log_source_runtimes', systemKey: 'RuntimesManager' },
    { icon: 'merge', labelKey: 'settings.log_source_git', systemKey: 'GitManager' },
    { icon: 'lock', labelKey: 'settings.log_source_ssl', systemKey: 'SslManager' },
    { icon: 'space_dashboard', labelKey: 'settings.log_source_dashboard', systemKey: 'DashboardManager' },
    { icon: 'tune', labelKey: 'settings.log_source_settings', systemKey: 'SettingsManager' },
];
const ALL_LOG_LEVEL_KEYS = LOG_LEVELS.map(l => l.key);
const ALL_LOG_SOURCE_KEYS = LOG_SOURCE_GROUPS.flatMap(g => g.fileKey ? [g.systemKey, g.fileKey] : [g.systemKey]);

// Toggle switch pill kecil -- identik dengan yang sudah dipakai di Sidebar.tsx untuk toggle
// start/stop service, disamakan supaya modal ini tidak keluar dari pakem UI yang ada.
function ToggleSwitch({ checked, onChange, label }: { readonly checked: boolean; readonly onChange: () => void; readonly label: string }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer shrink-0" aria-label={label}>
            <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
            <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
    );
}

interface SettingsModalsProps {
    readonly activeModal: SettingsModalType;
    readonly onClose: () => void;
}

export default function SettingsModals({ activeModal, onClose }: SettingsModalsProps) {
    const { t, i18n } = useTranslation();
    const [selectedLang, setSelectedLang] = useState(i18n.language);
    const [logLevels, setLogLevels] = useState<string[]>(ALL_LOG_LEVEL_KEYS);
    const [logSources, setLogSources] = useState<string[]>(ALL_LOG_SOURCE_KEYS);

    // Sinkronisasikan state lokal jika modal bahasa dibuka
    useEffect(() => {
        if (activeModal === 'language') {
            setSelectedLang(i18n.language);
        }
    }, [activeModal, i18n.language]);

    // Muat filter System Logs yang tersimpan setiap kali modalnya dibuka
    useEffect(() => {
        if (activeModal !== 'logs') return;
        const api = (window as any).pywebview?.api;
        if (!api || typeof api.get_app_settings !== 'function') return;

        api.get_app_settings().then((res: any) => {
            if (res?.status !== 'success') return;
            // null tersimpan = belum pernah dikustomisasi -> tampilkan checkbox semua tercentang.
            // Array (termasuk array kosong) = daftar eksplisit tersimpan, pakai apa adanya --
            // JANGAN diperlakukan sama seperti null, atau uncheck-semua-lalu-Save akan terlihat
            // seolah gagal tersimpan setiap modal dibuka lagi (lihat docs/known_bugs.md).
            const savedLevels: string[] | null = res.data?.system_log_levels ?? null;
            const savedSources: string[] | null = res.data?.system_log_sources ?? null;
            setLogLevels(savedLevels ?? ALL_LOG_LEVEL_KEYS);
            setLogSources(savedSources ?? ALL_LOG_SOURCE_KEYS);
        }).catch((e: any) => console.error(e));
    }, [activeModal]);

    const toggleLogLevel = (key: string) => {
        setLogLevels(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const toggleLogSource = (key: string) => {
        setLogSources(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    // Simpan filter System Logs & beri tahu LogsPanel yang sedang mounted agar langsung ikut menyaring.
    // Selalu simpan array literal apa adanya (TERMASUK array kosong kalau user uncheck semua) --
    // tidak lagi "dikompres" jadi array kosong saat semua tercentang, karena itulah akar bug lama:
    // array kosong yang sama dipakai untuk dua makna berbeda (lihat docs/known_bugs.md).
    const handleApplyLogSettings = async () => {
        const api = (window as any).pywebview?.api;
        if (api && typeof api.save_app_settings === 'function') {
            await api.save_app_settings({ system_log_levels: logLevels, system_log_sources: logSources });
            window.dispatchEvent(new CustomEvent('vylo_log_settings_changed'));
        }
        onClose();
    };

    // Handle aksi apply perubahan bahasa
    const handleApplyLanguage = async () => {
        if (selectedLang !== i18n.language) {
            i18n.changeLanguage(selectedLang);
            
            // Simpan ke file settings.json via Backend
            const api = (window as any).pywebview?.api;
            if (api && typeof api.save_app_settings === 'function') {
                await api.save_app_settings({ language: selectedLang });
            }
        }
        onClose();
    };

    // Handle aksi apply quit/keluar aplikasi
    const handleQuit = () => {
        // Coba menutup aplikasi lewat backend pywebview jika ada, atau fallback window.close()
        const api = (window as any).pywebview?.api;
        if (api && typeof api.close_app === 'function') {
            api.close_app();
        } else {
            window.close();
        }
    };

    return (
        <>
            {/* Modal Ubah Bahasa */}
            <Modal
                isOpen={activeModal === 'language'}
                onClose={onClose}
                title={t('settings.change_language')}
                icon="translate"
                onApply={handleApplyLanguage}
                applyText={t('common.save')}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('settings.language_desc')}
                    </p>
                    <div className="flex flex-col gap-2">
                        <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedLang === 'en' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <input
                                type="radio"
                                name="language"
                                value="en"
                                checked={selectedLang === 'en'}
                                onChange={(e) => setSelectedLang(e.target.value)}
                                className="w-4 h-4 text-primary"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.lang_option_english')}</span>
                        </label>
                        <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedLang === 'id' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <input
                                type="radio"
                                name="language"
                                value="id"
                                checked={selectedLang === 'id'}
                                onChange={(e) => setSelectedLang(e.target.value)}
                                className="w-4 h-4 text-primary"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.lang_option_indonesian')}</span>
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Modal Tentang Custom Menggunakan Komponen Modal DRY */}
            <Modal
                isOpen={activeModal === 'about'}
                onClose={onClose}
                title={t('settings.about')}
                maxWidthClass="max-w-2xl"
                bodyPaddingClass="p-6 md:p-8"
                customHeader={
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[20px] text-primary">info</span>
                            <span className="text-xs font-semibold tracking-wider uppercase">{t('settings.about')}</span>
                        </div>
                        <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={t('common.close', 'Close')}>
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                }
                customFooter={
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
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
                        <button type="button" onClick={onClose} className="w-full sm:w-auto inline-flex h-9 items-center justify-center px-4 text-xs font-semibold rounded-lg bg-primary hover:bg-blue-600 text-white transition-all shadow-sm active:scale-95">
                            <span className="leading-none">{t('common.close') || 'Close'}</span>
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                    {/* Left Side: App Icon & Badges */}
                    <div className="flex flex-col items-center text-center w-full md:w-44 shrink-0">
                        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl p-2 bg-gradient-to-b from-blue-500/10 to-indigo-500/5 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center group mb-3">
                            <img alt="VyloServe Icon" className="w-full h-full object-contain rounded-xl drop-shadow-md transition-transform duration-300 group-hover:scale-105" src={appIcon} />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white text-base">VyloServe</span>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                {t('settings.version')}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                GPL-3.0
                            </span>
                        </div>
                    </div>

                    {/* Right Side: Content & Description */}
                    <div className="flex-1 flex flex-col gap-4 text-left">
                        <div>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">VyloServe</h3>
                            <p className="text-xs md:text-sm font-medium text-primary dark:text-blue-400 mt-0.5">{t('settings.app_tagline')}</p>
                        </div>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {t('settings.about_desc')}
                        </p>
                        
                        {/* Feature Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>{t('settings.feature_dashboard')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>{t('settings.feature_sparklines')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>{t('settings.feature_apache_vhosts')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>{t('settings.feature_fastcgi')}</span>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{t('settings.license_label')}</span> GNU General Public License v3.0 (GPL-3.0)
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Filter System Logs */}
            <Modal
                isOpen={activeModal === 'logs'}
                onClose={onClose}
                title={t('settings.system_logs')}
                icon="filter_list"
                maxWidthClass="sm:w-[560px]"
                onApply={handleApplyLogSettings}
                applyText={t('common.save')}
            >
                <div className="flex flex-col gap-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('settings.system_logs_desc')}
                    </p>

                    {/* Level Log */}
                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-primary">filter_list</span>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">{t('settings.log_levels_label')}</h4>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.log_levels_desc')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {LOG_LEVELS.map(({ key, labelKey, dotClass }) => (
                                <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`}></span>
                                        <span className="text-xs font-medium text-slate-900 dark:text-slate-200">{t(labelKey)}</span>
                                    </div>
                                    <ToggleSwitch checked={logLevels.includes(key)} onChange={() => toggleLogLevel(key)} label={t(labelKey)} />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Kategori Modul */}
                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">{t('settings.log_sources_label')}</h4>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.log_sources_desc')}</p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {LOG_SOURCE_GROUPS.map(({ icon, labelKey, systemKey, fileKey }) => (
                                <div key={systemKey} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
                                        <h5 className="text-xs font-semibold text-slate-900 dark:text-white">{t(labelKey)}</h5>
                                    </div>
                                    <div className="flex items-center gap-4 sm:gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.log_group_system')}</span>
                                            <ToggleSwitch checked={logSources.includes(systemKey)} onChange={() => toggleLogSource(systemKey)} label={`${t(labelKey)} ${t('settings.log_group_system')}`} />
                                        </div>
                                        {fileKey && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.log_group_file')}</span>
                                                <ToggleSwitch checked={logSources.includes(fileKey)} onChange={() => toggleLogSource(fileKey)} label={`${t(labelKey)} ${t('settings.log_group_file')}`} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </Modal>

            {/* Modal Matikan Aplikasi */}
            <Modal
                isOpen={activeModal === 'quit'}
                onClose={onClose}
                title={t('settings.quit')}
                icon="power_settings_new"
                onApply={handleQuit}
                applyText={t('settings.quit')}
                isDestructive={true}
            >
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {t('settings.quit_desc')}
                </p>
            </Modal>
        </>
    );
}
