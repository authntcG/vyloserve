import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import ProgressStatusBlock from '../../../components/ProgressStatusBlock';
import Select from '../../../components/Select';
import FieldLabel from '../../../components/FieldLabel';
import OfflineBanner from '../../../components/OfflineBanner';
import { useToast } from '../../../context/ToastContext';
import { useGitLab, type InstallGitLabRef } from '../../../context/GitLabContext';
import { useNetworkStatus, isOfflineResponse } from '../../../context/NetworkContext';

export const InstallGitLabForm = forwardRef<InstallGitLabRef, any>((_, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { isOnline, reportOffline, reportOnline } = useNetworkStatus();
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<string>('0');
    const [isLoading, setIsLoading] = useState(true);

    const fetchVersions = async () => {
        setIsLoading(true);
        try {
            const api = (window as any).pywebview?.api;
            const res = await api?.get_available_gitlab_versions();
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                reportOnline();
                setVersionsList(res.data);
                setSelectedIndex('0');
            } else {
                if (isOfflineResponse(res)) {
                    reportOffline();
                }
                setVersionsList(res?.data || []);
            }
        } catch (error) {
            console.error(error);
            setVersionsList([]);
            showToast(t('tools.gitlab.error_fetching'), 'error');
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
                const api = (window as any).pywebview?.api;
                const res = await api?.install_gitlab_cli(selected.value);
                if (res?.status === 'success') {
                    showToast(t(res.message || 'backend.gitlab.install_success', res.args || {}) as string, 'success');
                    return true;
                }
                if (res?.status === 'cancelled') {
                    showToast(t(res.message || 'backend.gitlab.install_cancelled', res.args || {}) as string, 'info');
                    return false;
                }
                const errorKey = res?.message || 'backend.gitlab.install_failed';
                const errorArgs = res?.args || { e: 'Unknown error' };
                showToast(t(errorKey, errorArgs) as string, 'error');
                return false;
            } catch (error: any) {
                showToast(t('backend.gitlab.install_failed', { e: error?.message || String(error) }) as string, 'error');
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
            placeholder={t('tools.gitlab.error_fetching')}
            loading={isLoading}
            loadingText={t('tools.gitlab.retrieving')}
            errorText={!isLoading && versionsList.length === 0 ? t('tools.gitlab.error_fetching') : undefined}
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
                <FieldLabel htmlFor="gitlab_release_select">{t('tools.gitlab.select_release')}</FieldLabel>
                {selectContent}

                <span className="text-xs text-slate-500 mt-1">
                    {t('tools.gitlab.binary_desc_1')} <strong>GitLab CLI (glab)</strong> {t('tools.gitlab.binary_desc_2')}{' '}
                    <code>gitlab-org/cli</code>.
                </span>
            </div>
        </div>
    );
});

InstallGitLabForm.displayName = 'InstallGitLabForm';

export const GitLabProgressCard = ({
    isProcessing,
    progressText,
    progress,
    isCancelling,
    onCancelInstall,
    t
}: any) => {
    if (!isProcessing) return null;
    return (
        <div className="mt-5">
            <ProgressStatusBlock
                progressText={progressText || t('tools.gitlab.preparing')}
                progress={progress}
                onCancel={onCancelInstall}
                isCancelling={isCancelling}
            />
        </div>
    );
};

export default function InstallGitLabModal() {
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
        statusData,
        handleInstallSubmit,
        gitlabRef,
        progressText,
        progress
    } = useGitLab();

    const getApplyText = () => {
        if (isProcessing) return t('tools.gitlab.installing_btn');
        if (statusData.installed) return t('tools.gitlab.update_gitlab');
        return t('tools.gitlab.install_engine');
    };

    return (
        <Modal
            isOpen={isInstallModalOpen && !isMinimized}
            keepMounted={isProcessing}
            onClose={() => (isProcessing ? setIsMinimized(true) : setIsInstallModalOpen(false))}
            title={statusData.installed ? t('tools.gitlab.update_gitlab') : t('tools.gitlab.install_cli')}
            icon="terminal"
            onApply={handleInstallSubmit}
            applyText={getApplyText()}
            isApplyDisabled={isProcessing || !isOnline}
        >
            <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                <InstallGitLabForm ref={gitlabRef} />
            </div>
            <GitLabProgressCard
                isProcessing={isProcessing}
                progressText={progressText}
                progress={progress}
                isCancelling={isCancelling}
                onCancelInstall={handleCancelInstall}
                t={t}
            />
        </Modal>
    );
}
