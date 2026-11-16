import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';

interface ProviderInfo {
    readonly provider: string;
    readonly model: string;
    readonly is_local: boolean;
    readonly is_configured: boolean;
    readonly base_url?: string;
}

interface PrivacyConsentModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
    readonly onDisable?: () => void;
    readonly isAiEnabled?: boolean;
    readonly folderPath?: string | null;
    readonly providerInfo?: ProviderInfo | null;
}

const PrivacyConsentModal = memo(function PrivacyConsentModal({
    isOpen,
    onClose,
    onConfirm,
    onDisable,
    isAiEnabled = false,
    folderPath,
    providerInfo
}: PrivacyConsentModalProps) {
    const { t } = useTranslation();

    const isLocal = Boolean(providerInfo?.is_local);
    const providerName = providerInfo?.provider ? providerInfo.provider.toUpperCase() : 'AI';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tools.docs_reader.privacy_title')}
            icon="security"
            maxWidthClass="sm:w-[540px]"
            customFooter={
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl w-full">
                    <Button variant="secondary" onClick={onClose}>
                        {isAiEnabled ? t('common.close') : t('tools.docs_reader.privacy_btn_cancel')}
                    </Button>
                    {isAiEnabled && onDisable ? (
                        <Button variant="danger" icon="lock" onClick={onDisable}>
                            {t('tools.docs_reader.privacy_status_off')}
                        </Button>
                    ) : (
                        <Button variant="primary" icon="verified_user" onClick={onConfirm}>
                            {t('tools.docs_reader.privacy_btn_enable')}
                        </Button>
                    )}
                </div>
            }
        >
            <div className="flex flex-col gap-4 text-sm text-slate-700 dark:text-slate-300">
                {folderPath && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs">
                        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">folder</span>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-slate-500 font-medium">
                                {t('tools.docs_reader.privacy_folder_target', { path: '' }).split(':')[0]}:
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                                {folderPath}
                            </span>
                        </div>
                    </div>
                )}
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 flex gap-3 items-start">
                    <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        warning
                    </span>
                    <div className="flex flex-col gap-1 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        <span className="font-semibold text-sm">
                            {t('tools.docs_reader.privacy_desc')}
                        </span>
                        <p>{t('tools.docs_reader.privacy_warning')}</p>
                    </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                            {t('tools.docs_reader.privacy_provider_active')}:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {providerName} ({providerInfo?.model || 'default'})
                        </span>
                    </div>

                    <div className="mt-1">
                        {isLocal ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
                                <span className="material-symbols-outlined text-[15px]">verified_user</span>
                                <span>{t('tools.docs_reader.privacy_local_badge')}</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
                                <span className="material-symbols-outlined text-[15px]">cloud</span>
                                <span>{t('tools.docs_reader.privacy_cloud_badge')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
});

export default PrivacyConsentModal;
