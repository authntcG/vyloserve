import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import ProgressStatusBlock from '../../../components/ProgressStatusBlock';
import Select from '../../../components/Select';
import FieldLabel from '../../../components/FieldLabel';
import OfflineBanner from '../../../components/OfflineBanner';
import { useToast } from '../../../context/ToastContext';
import { useGit, type InstallGitRef } from '../../../context/GitContext';
import { useNetworkStatus, isOfflineResponse } from '../../../context/NetworkContext';

export const InstallGitForm = forwardRef<InstallGitRef, any>((_, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { isOnline, reportOffline, reportOnline } = useNetworkStatus();
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(true);

    const fetchVersions = async () => {
        setIsLoading(true);
        try {
            const res = await window.pywebview?.api?.get_available_git_versions();
            if (res?.status === 'success' && res.data.length > 0) {
                reportOnline();
                setVersionsList(res.data);
                setSelectedIndex('0');
            } else {
                if (isOfflineResponse(res)) {
                    reportOffline();
                }
                setVersionsList([]);
            }
        } catch (error) {
            console.error(error);
            setVersionsList([]);
            showToast(t('tools.git.fetch_error'), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVersions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (versionsList.length === 0) return false;
            try {
                const selected = versionsList[Number.parseInt(selectedIndex)];
                const res = await window.pywebview?.api?.install_git(selected.value, selected.filename, selected.version_text);
                if (res?.status === 'success') {
                    showToast(t(res.message || 'backend.git.install_success') as string, 'success');
                    return true;
                }
                if (res?.status === 'cancelled') {
                    showToast(t(res.message || 'backend.git.install_cancelled') as string, 'info');
                    return false;
                }
                throw new Error(res?.message || t('tools.git.install_error'));
            } catch (error: any) {
                showToast(error.message || t('tools.git.sys_install_error'), 'error');
                return false;
            }
        }
    }));

    const selectContent = (
        <Select
            searchable={false}
            options={versionsList.map((v, idx) => ({ value: String(idx), label: v.label }))}
            value={selectedIndex}
            onChange={setSelectedIndex}
            placeholder={t('tools.git.error_fetching')}
            loading={isLoading}
            loadingText={t('tools.git.retrieving')}
            errorText={!isLoading && versionsList.length === 0 ? t('tools.git.error_fetching') : undefined}
        />
    );

    const showOfflineBanner = !isLoading && (!isOnline || versionsList.length === 0);

    return (
        <div className="flex flex-col gap-4">
            {showOfflineBanner && (
                <OfflineBanner
                    onRetry={fetchVersions}
                    forceShow={showOfflineBanner}
                />
            )}
            <div className="flex flex-col gap-2">
                <FieldLabel>{t('tools.git.select_release')}</FieldLabel>
                {selectContent}

                <span className="text-xs text-slate-500 mt-1">
                    {t('tools.git.binary_desc_1')} <strong>PortableGit 64-bit (SFX)</strong> {t('tools.git.binary_desc_2')}{' '}
                    <code>git-for-windows</code>.
                </span>
            </div>
        </div>
    );
});

export const GitProgressCard = ({
    isProcessing,
    isUninstallModalOpen,
    progressText,
    progress,
    isCancelling,
    onCancelInstall,
    t
}: any) => {
    if (!isProcessing || isUninstallModalOpen) return null;
    return (
        <div className="mt-5">
            <ProgressStatusBlock
                progressText={progressText || t('tools.git.preparing')}
                progress={progress}
                onCancel={onCancelInstall}
                isCancelling={isCancelling}
            />
        </div>
    );
};

export default function InstallGitModal() {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const {
        isInstallModalOpen,
        setIsInstallModalOpen,
        isProcessing,
        isCancelling,
        handleCancelInstall,
        setIsMinimized,
        isMinimized,
        updateAvailable,
        gitData,
        handleInstallSubmit,
        gitRef,
        isUninstallModalOpen,
        progressText,
        progress
    } = useGit();

    const getApplyText = () => {
        if (isProcessing) return t('tools.git.installing_btn');
        if (updateAvailable && gitData.installed) return t('tools.git.update_git', 'Update Git');
        return t('tools.git.install_engine');
    };

    return (
        <Modal
            isOpen={isInstallModalOpen && !isMinimized}
            keepMounted={isProcessing}
            onClose={() => (isProcessing ? setIsMinimized(true) : setIsInstallModalOpen(false))}
            title={updateAvailable && gitData.installed ? t('tools.git.update_git', 'Update Git') : t('tools.git.install_git')}
            icon="merge"
            onApply={handleInstallSubmit}
            applyText={getApplyText()}
            isApplyDisabled={isProcessing || !isOnline}
        >
            <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                <InstallGitForm ref={gitRef} />
            </div>
            <GitProgressCard
                isProcessing={isProcessing}
                isUninstallModalOpen={isUninstallModalOpen}
                progressText={progressText}
                progress={progress}
                isCancelling={isCancelling}
                onCancelInstall={handleCancelInstall}
                t={t}
            />
        </Modal>
    );
}
