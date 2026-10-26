import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import { useProject } from '../../context/ProjectContext';

export default function ProjectDeleteModal() {
    const { t } = useTranslation();
    const {
        isDeleteConfirmOpen,
        closeDeleteConfirmModal,
        selectedProject,
        isDeletingProject,
        isDeleteFiles,
        setIsDeleteFiles,
        handleDeleteProjectSubmit,
    } = useProject();

    return (
        <Modal
            isOpen={isDeleteConfirmOpen}
            onClose={closeDeleteConfirmModal}
            title={t('apache.delete_virtual_host')}
            icon="delete"
            onApply={handleDeleteProjectSubmit}
            applyText={isDeletingProject ? t('apache.deleting') : t('apache.delete_project')}
            isApplyDisabled={isDeletingProject}
            isDestructive={true}
            isLoading={isDeletingProject}
        >
            <p className="text-slate-700 dark:text-slate-300 mb-2">
                {t('apache.delete_project')} <strong className="text-slate-900 dark:text-white">{selectedProject?.domain}</strong>?
            </p>
            <label htmlFor="delete-files-checkbox" className="flex items-start gap-2 cursor-pointer bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                <input
                    id="delete-files-checkbox"
                    type="checkbox"
                    checked={isDeleteFiles}
                    onChange={(e) => setIsDeleteFiles(e.target.checked)}
                    aria-label={t('apache.delete_all_files')}
                    className="mt-0.5"
                />
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-red-800 dark:text-red-400">{t('apache.delete_all_files')}</span>
                    <span className="text-xs text-red-600/80 dark:text-red-400/80">{t('apache.permanent_action')}</span>
                </div>
            </label>
        </Modal>
    );
}
