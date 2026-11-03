import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import { useGit } from '../../../context/GitContext';

export default function GitUninstallModal() {
    const { t } = useTranslation();
    const {
        isUninstallModalOpen,
        setIsUninstallModalOpen,
        isProcessing,
        executeUninstall
    } = useGit();

    return (
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
            <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                <p
                    className="text-sm text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: t('tools.git.uninstall_confirm') }}
                ></p>
                <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                    {t('tools.git.uninstall_warning')}
                </p>
            </div>
        </Modal>
    );
}
