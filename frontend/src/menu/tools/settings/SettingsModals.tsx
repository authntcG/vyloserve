import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';

export type SettingsModalType = 'language' | 'about' | 'quit' | null;

interface SettingsModalsProps {
    activeModal: SettingsModalType;
    onClose: () => void;
}

export default function SettingsModals({ activeModal, onClose }: SettingsModalsProps) {
    const { t, i18n } = useTranslation();
    const [selectedLang, setSelectedLang] = useState(i18n.language);

    // Sinkronisasikan state lokal jika modal bahasa dibuka
    useEffect(() => {
        if (activeModal === 'language') {
            setSelectedLang(i18n.language);
        }
    }, [activeModal, i18n.language]);

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
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">English</span>
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
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bahasa Indonesia</span>
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
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Close">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                }
                customFooter={
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <a href="https://github.com/authntcG/vyloserve/" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 transition-colors shadow-sm">
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"></path>
                                </svg>
                                <span>{t('settings.view_on_github') || 'View on GitHub'}</span>
                            </a>
                            <a href="https://github.com/authntcG/vyloserve/tree/main/docs" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                                <span>{t('settings.documentation') || 'Documentation'}</span>
                            </a>
                        </div>
                        <button onClick={onClose} className="w-full sm:w-auto px-5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-blue-600 text-white transition-all shadow-sm active:scale-95">
                            {t('common.close') || 'Close'}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                    {/* Left Side: App Icon & Badges */}
                    <div className="flex flex-col items-center text-center w-full md:w-44 shrink-0">
                        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl p-2 bg-gradient-to-b from-blue-500/10 to-indigo-500/5 border border-blue-500/20 shadow-lg shadow-blue-500/10 flex items-center justify-center group mb-3">
                            <img alt="VyloServe Icon" className="w-full h-full object-contain rounded-xl drop-shadow-md transition-transform duration-300 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida/AEtjO1WzpPKyfC1AAcOYPYOMRCtSXUBj1YpP8ZJfWYT8LO5b-eMKjJyMW3NIOvEu5XFWjitwqTXyrI1849SHWbyr0Jj4m6d76kCjryvtqIzw8uKcgemS92gt4RWD9M23qQOwCZA0_VH7O79CxnHrJ6wPRXjhVonMVc0yX_arwS8Ohb5B1Tzefsqw73ozLk8Y-LFj4NWyVU3DfadKZY-mrtdMvY577nGb45bEziHPKY5TqnPS9M6GZW6HbWk3" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white text-base">VyloServe</span>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                v1.0.0
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
                            <p className="text-xs md:text-sm font-medium text-primary dark:text-blue-400 mt-0.5">The Modern, High-Performance Local Web Server Manager</p>
                        </div>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {t('settings.about_desc')}
                        </p>
                        
                        {/* Feature Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>Smart Global Dashboard</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>Zero-CPU Sparklines</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>Apache Virtual Hosts</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                <span>Multi-version FastCGI</span>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300">License:</span> GNU General Public License v3.0 (GPL-3.0)
                        </div>
                    </div>
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
