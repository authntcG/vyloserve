import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ProjectSettings from './ProjectSettings';
import { useApache } from '../../context/ApacheContext';

export default function ApacheProjectSettingsModal() {
    const { t } = useTranslation();
    const {
        isProjectSettingsOpen,
        closeProjectSettingsModal,
        selectedProject,
        isUpdatingProject,
        handleUpdateProjectSubmit,
        projectSettingsRef,
    } = useApache();

    return (
        <Modal
            isOpen={isProjectSettingsOpen}
            onClose={closeProjectSettingsModal}
            title={`${t('apache.vhost_settings_modal')}: ${selectedProject?.name || ''}`}
            icon="settings"
            onApply={handleUpdateProjectSubmit}
            applyText={isUpdatingProject ? t('apache.saving') : t('apache.save_changes')}
            isApplyDisabled={isUpdatingProject}
            isLoading={isUpdatingProject}
        >
            {selectedProject && <ProjectSettings project={selectedProject} ref={projectSettingsRef} />}
        </Modal>
    );
}
