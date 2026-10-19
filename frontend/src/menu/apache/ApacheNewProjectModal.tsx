import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import NewApacheProject from './NewProject';
import { useApache } from '../../context/ApacheContext';

export default function ApacheNewProjectModal() {
    const { t } = useTranslation();
    const {
        isNewProjectModalOpen,
        isCreatingProject,
        closeNewProjectModal,
        handleCreateSubmit,
        projectFormRef,
    } = useApache();

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
            <NewApacheProject ref={projectFormRef} isCreatingExternal={isCreatingProject} />
        </Modal>
    );
}
