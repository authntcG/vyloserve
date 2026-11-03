import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import DbSettings from './Settings';
import { useDatabase } from '../../context/DatabaseContext';

export default function DatabaseSettingsModal() {
    const { t } = useTranslation();
    const {
        isSettingsOpen,
        selectedDb,
        settingsConfig,
        isLoadingSettings,
        isSavingSettings,
        handleConfigChange,
        handleSaveSettings,
        closeSettingsModal,
    } = useDatabase();

    return (
        <Modal
            isOpen={isSettingsOpen}
            onClose={closeSettingsModal}
            title={`${selectedDb?.name || ''}${t('database.configuration')}`}
            icon="tune"
            onApply={handleSaveSettings}
            applyText={isSavingSettings ? t('database.saving') : t('database.save_changes')}
            isApplyDisabled={isLoadingSettings || isSavingSettings}
            isLoading={isSavingSettings}
        >
            {selectedDb && (
                <DbSettings
                    instance={selectedDb}
                    config={settingsConfig}
                    onChange={handleConfigChange}
                    isLoading={isLoadingSettings}
                />
            )}
        </Modal>
    );
}
