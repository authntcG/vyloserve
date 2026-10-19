import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import NewDbInstance from './NewInstance';
import { useDatabase } from '../../context/DatabaseContext';

export default function DatabaseNewInstanceModal() {
    const { t } = useTranslation();
    const {
        isNewInstanceOpen,
        isInstalling,
        updatingInstance,
        newDbRef,
        activeTab,
        usedPorts,
        progress,
        progressText,
        handleInstallDatabase,
        closeNewInstanceModal,
    } = useDatabase();

    return (
        <Modal
            keepMounted={isInstalling}
            isOpen={isNewInstanceOpen}
            onClose={closeNewInstanceModal}
            title={updatingInstance ? t('database.updating_engine') : t('database.install_db_title')}
            icon={updatingInstance ? 'upgrade' : 'download'}
            onApply={updatingInstance ? undefined : handleInstallDatabase}
            applyText={isInstalling ? t('database.processing') : t('database.install_btn')}
            isApplyDisabled={isInstalling}
        >
            <NewDbInstance
                ref={newDbRef}
                activeTab={activeTab}
                usedPorts={usedPorts}
                isInstalling={isInstalling}
                progress={progress}
                progressText={progressText}
                targetUpdate={
                    updatingInstance
                        ? {
                              engine: updatingInstance.db.engine,
                              version: updatingInstance.update.version,
                              port: updatingInstance.db.port,
                          }
                        : undefined
                }
            />
        </Modal>
    );
}
