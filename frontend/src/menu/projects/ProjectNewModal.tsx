import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import NewProject from './NewProject';
import { useProject } from '../../context/ProjectContext';

export default function ProjectNewModal() {
    const { t } = useTranslation();
    const {
        isNewProjectModalOpen,
        isCreatingProject,
        closeNewProjectModal,
        handleCreateSubmit,
        projectFormRef,
    } = useProject();

    return (
        <Modal
            isOpen={isNewProjectModalOpen}
            keepMounted={isCreatingProject}
            onClose={closeNewProjectModal}
            title={t('apache.create_new_project')}
            icon="add_box"
            onApply={handleCreateSubmit}
            applyText={isCreatingProject ? t('apache.installing_start') : t('apache.create_project')}
            isApplyDisabled={isCreatingProject}
        >
            <NewProject ref={projectFormRef} isCreatingExternal={isCreatingProject} />
        </Modal>
    );
}
