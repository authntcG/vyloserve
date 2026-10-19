import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import PhpSettings from './Settings';
import { usePhp } from '../../context/PhpContext';

export default function PhpSettingsModal() {
    const { t } = useTranslation();
    const {
        isSettingsOpen,
        selectedInstance,
        isSavingSettings,
        isLoadingSettings,
        settingsConfig,
        setSettingsConfig,
        settingsExtensions,
        setSettingsExtensions,
        usedPorts,
        handleSaveSettings,
        closeSettingsModal,
    } = usePhp();

    const isPortConflict = selectedInstance
        ? usedPorts.filter(p => p !== selectedInstance.port).includes(Number(settingsConfig.port))
        : false;

    return (
        <Modal
            isOpen={isSettingsOpen}
            onClose={closeSettingsModal}
            title={`${selectedInstance?.name || 'PHP'} ${t('php.configuration')}`}
            icon="tune"
            onApply={handleSaveSettings}
            applyText={isSavingSettings ? t('php.saving') : t('php.save_changes')}
            isApplyDisabled={isLoadingSettings || isSavingSettings || isPortConflict}
            isLoading={isSavingSettings}
        >
            <PhpSettings
                config={settingsConfig}
                setConfig={setSettingsConfig}
                extensions={settingsExtensions}
                setExtensions={setSettingsExtensions}
                isLoading={isLoadingSettings}
                usedPorts={selectedInstance ? usedPorts.filter(p => p !== selectedInstance.port) : []}
            />
        </Modal>
    );
}
