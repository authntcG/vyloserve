import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ApacheSettings from './Settings';
import { useApache } from '../../context/ApacheContext';

export default function ApacheOptionsModal() {
    const { t } = useTranslation();
    const { isOptionsOpen, closeOptionsModal } = useApache();

    return (
        <Modal
            isOpen={isOptionsOpen}
            onClose={closeOptionsModal}
            title={t('apache.global_apache_config')}
            icon="tune"
            onApply={closeOptionsModal}
        >
            <ApacheSettings />
        </Modal>
    );
}
