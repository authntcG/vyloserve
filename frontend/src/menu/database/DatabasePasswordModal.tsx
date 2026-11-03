import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ChangePassword from './ChangePassword';
import { useDatabase } from '../../context/DatabaseContext';

export default function DatabasePasswordModal() {
    const { t } = useTranslation();
    const {
        isPasswordModalOpen,
        selectedDb,
        isUpdatingPassword,
        passwordRef,
        handlePasswordSubmit,
        closePasswordModal,
    } = useDatabase();

    return (
        <Modal
            isOpen={isPasswordModalOpen}
            onClose={closePasswordModal}
            title={t('database.change_db_password')}
            icon="key"
            onApply={handlePasswordSubmit}
            applyText={isUpdatingPassword ? t('database.updating') : t('database.update_password')}
            isApplyDisabled={isUpdatingPassword}
            isLoading={isUpdatingPassword}
        >
            {selectedDb && <ChangePassword instance={selectedDb} ref={passwordRef} />}
        </Modal>
    );
}
