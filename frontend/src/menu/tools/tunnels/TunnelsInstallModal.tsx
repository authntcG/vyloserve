import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import ProgressStatusBlock from '../../../components/ProgressStatusBlock';
import InstallTunnel from './InstallTunnel';
import { useTunnels } from '../../../context/TunnelsContext';
import { useNetworkStatus } from '../../../context/NetworkContext';

export default function TunnelsInstallModal() {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const {
        activeTab,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isInstalling,
        isCancelling,
        handleCancelInstall,
        progress,
        progressText,
        cfInstallRef,
        zrokInstallRef,
        cfStatus,
        zrokStatus,
        handleInstallSubmit
    } = useTunnels();

    const isCloudflare = activeTab === 'cloudflare';
    const installed = isCloudflare ? !!cfStatus?.installed : !!zrokStatus?.installed;

    const getApplyText = () => {
        if (isInstalling) {
            return installed ? t('tools.updating_btn') : t('common.installing');
        }
        if (installed) {
            return t('tools.update_btn');
        }
        return isCloudflare ? t('tools.cloudflare.install_cloudflare') : t('tools.zrok.install_zrok');
    };

    const getModalTitle = () => {
        if (installed) {
            return isCloudflare ? t('tools.cloudflare.update_cloudflare') : t('tools.zrok.update_zrok');
        }
        return isCloudflare ? t('tools.cloudflare.install_cloudflare') : t('tools.zrok.install_zrok');
    };

    return (
        <Modal
            isOpen={isInstallModalOpen}
            keepMounted={isInstalling}
            onClose={() => setIsInstallModalOpen(false)}
            title={getModalTitle()}
            icon="cloud_download"
            onApply={handleInstallSubmit}
            applyText={getApplyText()}
            isApplyDisabled={isInstalling || !isOnline}
        >
            <div className={isInstalling ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                {activeTab === 'cloudflare' ? (
                    <InstallTunnel
                        ref={cfInstallRef}
                        fetchVersionsApi={() => window.pywebview?.api?.get_available_cloudflare_versions()}
                        installApi={(version) => window.pywebview?.api?.install_cloudflare(version)}
                        translations={{
                            fetchFailed: 'backend.cloudflare.release_not_found',
                            installSuccess: 'backend.cloudflare.install_success',
                            installFailed: 'backend.error.unexpected',
                            info1: 'tools.cloudflare.install_info_1',
                            info2: 'tools.cloudflare.install_info_2',
                            versionLabel: 'ui.update.current_version'
                        }}
                    />
                ) : (
                    <InstallTunnel
                        ref={zrokInstallRef}
                        fetchVersionsApi={() => window.pywebview?.api?.get_available_zrok_versions()}
                        installApi={(version) => window.pywebview?.api?.install_zrok(version)}
                        translations={{
                            fetchFailed: 'tools.zrok.fetch_versions_failed',
                            installSuccess: 'tools.zrok.install_success',
                            installFailed: 'tools.zrok.install_failed',
                            info1: 'tools.zrok.install_info_1',
                            info2: 'tools.zrok.install_info_2',
                            versionLabel: 'tools.zrok.version'
                        }}
                    />
                )}
            </div>
            {isInstalling && (
                <div className="mt-5">
                    <ProgressStatusBlock
                        progressText={progressText || t('common.preparing')}
                        progress={progress}
                        onCancel={handleCancelInstall}
                        isCancelling={isCancelling}
                    />
                </div>
            )}
        </Modal>
    );
}
