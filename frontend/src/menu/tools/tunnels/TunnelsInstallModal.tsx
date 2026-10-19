import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import InstallTunnel from './InstallTunnel';
import { useTunnels } from '../../../context/TunnelsContext';

export default function TunnelsInstallModal() {
    const { t } = useTranslation();
    const {
        activeTab,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isInstalling,
        progress,
        progressText,
        cfInstallRef,
        zrokInstallRef,
        cfStatus,
        zrokStatus,
        handleInstallSubmit
    } = useTunnels();

    const isCloudflare = activeTab === 'cloudflare';
    const installed = isCloudflare ? !!cfStatus?.installed : !!zrokStatus?.installed;

    const getApplyText = () => {
        if (isInstalling) {
            return installed ? t('tools.updating_btn') : t('common.installing');
        }
        if (installed) {
            return t('tools.update_btn');
        }
        return isCloudflare ? t('tools.cloudflare.install_cloudflare') : t('tools.zrok.install_zrok');
    };

    const getModalTitle = () => {
        if (installed) {
            return isCloudflare ? t('tools.cloudflare.update_cloudflare') : t('tools.zrok.update_zrok');
        }
        return isCloudflare ? t('tools.cloudflare.install_cloudflare') : t('tools.zrok.install_zrok');
    };

    return (
        <Modal
            isOpen={isInstallModalOpen}
            keepMounted={isInstalling}
            onClose={() => setIsInstallModalOpen(false)}
            title={getModalTitle()}
            icon="cloud_download"
            onApply={handleInstallSubmit}
            applyText={getApplyText()}
            isApplyDisabled={isInstalling}
        >
            <div className={isInstalling ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                {activeTab === 'cloudflare' ? (
                    <InstallTunnel
                        ref={cfInstallRef}
                        fetchVersionsApi={() => window.pywebview?.api?.get_available_cloudflare_versions()}
                        installApi={(version) => window.pywebview?.api?.install_cloudflare(version)}
                        translations={{
                            fetchFailed: 'backend.cloudflare.release_not_found',
                            installSuccess: 'backend.cloudflare.install_success',
                            installFailed: 'backend.error.unexpected',
                            info1: 'tools.cloudflare.install_info_1',
                            info2: 'tools.cloudflare.install_info_2',
                            versionLabel: 'ui.update.current_version'
                        }}
                    />
                ) : (
                    <InstallTunnel
                        ref={zrokInstallRef}
                        fetchVersionsApi={() => window.pywebview?.api?.get_available_zrok_versions()}
                        installApi={(version) => window.pywebview?.api?.install_zrok(version)}
                        translations={{
                            fetchFailed: 'tools.zrok.fetch_versions_failed',
                            installSuccess: 'tools.zrok.install_success',
                            installFailed: 'tools.zrok.install_failed',
                            info1: 'tools.zrok.install_info_1',
                            info2: 'tools.zrok.install_info_2',
                            versionLabel: 'tools.zrok.version'
                        }}
                    />
                )}
            </div>
            {isInstalling && (
                <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('common.installation_progress')}
                        </span>
                    </div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-slate-500 truncate w-3/4">{progressText || t('common.preparing')}</span>
                        <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
