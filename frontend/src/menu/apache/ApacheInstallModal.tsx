import { useState, useEffect } from 'react';
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
        fetchApacheStatus,
    } = useApache();

    const [isNonWindows, setIsNonWindows] = useState(false);

    useEffect(() => {
        setIsNonWindows(!window.navigator.userAgent.toLowerCase().includes('win'));
    }, []);

    const isLinuxManualInstall = isNonWindows && availableVersions.length === 0;

    const getTitle = () => {
        if (isInstalling && isApacheInstalled) {
            return t('apache.updating_apache_title', { version: installVersion });
        }
        if (isLinuxManualInstall) {
            return t('apache.linux_install_guide_title');
        }
        return t('apache.install_apache_server');
    };

    const getIcon = () => {
        if (isInstalling && isApacheInstalled) return 'upgrade';
        if (isLinuxManualInstall) return 'terminal';
        return 'download';
    };

    return (
        <Modal
            isOpen={isInstallServerOpen}
            keepMounted={isInstalling}
            onClose={closeInstallModal}
            title={getTitle()}
            icon={getIcon()}
            onApply={isInstalling ? undefined : handleInstallApache}
            applyText={isInstalling ? t('apache.installing_start') : (isNonWindows ? t('apache.install_system_package') : t('apache.download_install'))}
            isApplyDisabled={isFetchingVersions || isInstalling || availableVersions.length === 0 || (!isNonWindows && !isOnline)}
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
                onRetryFetch={fetchAvailableVersions}
                isCancelling={isCancelling}
                onCancelInstall={handleCancelInstall}
                onRefreshStatus={fetchApacheStatus}
            />
        </Modal>
    );
}
