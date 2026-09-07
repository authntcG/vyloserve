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

            {/* Modal Tentang */}
            <Modal
                isOpen={activeModal === 'about'}
                onClose={onClose}
                title={t('settings.about')}
                icon="info"
            >
                <div className="flex flex-col items-center gap-4 text-center pb-2">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[40px] text-primary">dns</span>
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">VyloServe</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">v1.0.0</p>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {t('settings.about_desc')}
                    </p>
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
