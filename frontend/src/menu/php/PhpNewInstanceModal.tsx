import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import NewPhpInstance from './NewInstance';
import { usePhp } from '../../context/PhpContext';

export default function PhpNewInstanceModal() {
    const { t } = useTranslation();
    const {
        isNewInstanceOpen,
        isInstalling,
        isCancelling,
        handleCancelInstall,
        updatingInstance,
        installVersion,
        setInstallVersion,
        setInstallFilename,
        installPort,
        setInstallPort,
        isFetchingVersions,
        setIsFetchingVersions,
        usedPorts,
        handleInstallPhp,
        closeNewInstanceModal,
        fetchInstalledInstances,
    } = usePhp();

    const title = updatingInstance ? t('php.updating_php') : t('php.install_php_version');

    const getIcon = () => {
        if (updatingInstance) return 'upgrade';
        return 'download';
    };

    return (
        <Modal
            isOpen={isNewInstanceOpen}
            keepMounted={isInstalling}
            onClose={closeNewInstanceModal}
            title={title}
            icon={getIcon()}
            onApply={updatingInstance ? undefined : handleInstallPhp}
            applyText={isInstalling ? t('php.installing') : t('php.install_and_configure')}
            isApplyDisabled={isFetchingVersions || isInstalling || !installVersion || usedPorts.includes(installPort)}
        >
            <NewPhpInstance
                version={installVersion}
                setVersion={setInstallVersion}
                setFilename={setInstallFilename}
                port={installPort}
                setPort={setInstallPort}
                isInstalling={isInstalling}
                isCancelling={isCancelling}
                onCancelInstall={handleCancelInstall}
                isFetchingVersions={isFetchingVersions}
                setIsFetchingVersions={setIsFetchingVersions}
                usedPorts={usedPorts}
                onRefreshStatus={fetchInstalledInstances}
            />
        </Modal>
    );
}
