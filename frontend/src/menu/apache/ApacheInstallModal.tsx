import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ApacheInstallWizard from './InstallWizard';
import { useApache } from '../../context/ApacheContext';
import { useNetworkStatus } from '../../context/NetworkContext';

export default function ApacheInstallModal() {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const {
        isInstallServerOpen,
        isInstalling,
        isApacheInstalled,
        installVersion,
        isFetchingVersions,
        availableVersions,
        setInstallVersion,
        setInstallUrl,
        httpPort,
        setHttpPort,
        httpsPort,
        setHttpsPort,
        progress,
        progressText,
        handleInstallApache,
        handleCancelInstall,
        isCancelling,
        fetchAvailableVersions,
        closeInstallModal,
    } = useApache();

    const title = isInstalling && isApacheInstalled
        ? t('apache.updating_apache_title', { version: installVersion })
        : t('apache.install_apache_server');

    return (
        <Modal
            isOpen={isInstallServerOpen}
            keepMounted={isInstalling}
            onClose={closeInstallModal}
            title={title}
            icon={isInstalling && isApacheInstalled ? 'upgrade' : 'download'}
            onApply={isInstalling ? undefined : handleInstallApache}
            applyText={isInstalling ? t('apache.installing_start') : t('apache.download_install')}
            isApplyDisabled={isFetchingVersions || isInstalling || availableVersions.length === 0 || !isOnline}
        >
            <ApacheInstallWizard
                versions={availableVersions}
                version={installVersion}
                setVersion={setInstallVersion}
                setUrl={setInstallUrl}
                httpPort={httpPort}
                setHttpPort={setHttpPort}
                httpsPort={httpsPort}
                setHttpsPort={setHttpsPort}
                isInstalling={isInstalling}
                isFetchingVersions={isFetchingVersions}
                progress={progress}
                progressText={progressText}
                isApacheInstalled={isApacheInstalled}
                onRetryFetch={fetchAvailableVersions}
                isCancelling={isCancelling}
                onCancelInstall={handleCancelInstall}
            />
        </Modal>
    );
}
