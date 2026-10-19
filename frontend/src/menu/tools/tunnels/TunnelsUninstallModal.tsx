import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import { useTunnels } from '../../../context/TunnelsContext';

export default function TunnelsUninstallModal() {
    const { t } = useTranslation();
    const {
        uninstallTarget,
        setUninstallTarget,
        isUninstalling,
        handleCfUninstall,
        handleZrokUninstall
    } = useTunnels();

    return (
        <Modal
            isOpen={uninstallTarget !== null}
            onClose={() => setUninstallTarget(null)}
            title={
                uninstallTarget === 'cloudflare'
                    ? t('tools.cloudflare.uninstall_confirm_title')
                    : t('tools.zrok.uninstall_confirm_title')
            }
            icon="delete"
            onApply={uninstallTarget === 'cloudflare' ? handleCfUninstall : handleZrokUninstall}
            applyText={isUninstalling ? t('common.uninstall') + '...' : t('common.uninstall')}
            isDestructive={true}
            isApplyDisabled={isUninstalling}
        >
            <p className="text-sm text-slate-600 dark:text-slate-400">
                {uninstallTarget === 'cloudflare'
                    ? t('tools.cloudflare.uninstall_confirm_desc')
                    : t('tools.zrok.uninstall_confirm_desc')}
            </p>
        </Modal>
    );
}
