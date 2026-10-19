import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import BackgroundProgressWidget from '../../../components/BackgroundProgressWidget';
import {
    TunnelsProvider,
    useTunnels,
    type ActiveTab
} from '../../../context/TunnelsContext';
import {
    InstallHeaderButton,
    TabButton,
    TunnelsBody
} from './TunnelsComponents';
import TunnelsInstallModal from './TunnelsInstallModal';
import TunnelsUninstallModal from './TunnelsUninstallModal';

export function TunnelsMainView() {
    const { t } = useTranslation();
    const {
        activeTab,
        setActiveTab,
        zrokStatus,
        cfStatus,
        projects,
        isZrokLoading,
        isCfLoading,
        zrokUpdateAvailable,
        cfUpdateAvailable,
        isInstallModalOpen,
        isInstalling,
        progress,
        progressText,
        openInstallModal,
        handleUpdateClick,
        setUninstallTarget,
        setIsUninstalling,
        handleStopShare,
        token,
        setToken,
        isEnabling,
        handleEnable,
        handleDisable,
        shareMode,
        setShareMode,
        selectedProject,
        setSelectedProject,
        customTarget,
        setCustomTarget,
        isStarting,
        handleStartShare,
        dropdown
    } = useTunnels();

    const installedCount = (zrokStatus?.installed ? 1 : 0) + (cfStatus?.installed ? 1 : 0);

    const shareConfig = {
        shareMode,
        selectedProject,
        customTarget,
        isStarting,
        dropdown,
        onSelectProject: (id: string) => {
            setSelectedProject(id);
            dropdown.setIsDropdownOpen(false);
        },
        onCustomTargetChange: setCustomTarget,
        onShareModeChange: setShareMode,
        onStartShare: handleStartShare
    };

    return (
        <div className="flex flex-col w-full">
            <BackgroundProgressWidget
                isOpen={isInstalling && !isInstallModalOpen}
                progressText={progressText}
                progress={progress}
                onRestore={openInstallModal}
            />

            <PageHeader
                icon="router"
                title={t('tools.tunnels.title')}
                subtitle={
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        <span>{t('tools.tunnels.services_installed', { count: installedCount })}</span>
                    </div>
                }
                actions={
                    activeTab !== 'all' ? (
                        <InstallHeaderButton
                            installed={activeTab === 'cloudflare' ? cfStatus?.installed : zrokStatus?.installed}
                            isLoading={activeTab === 'cloudflare' ? isCfLoading : isZrokLoading}
                            label={
                                activeTab === 'cloudflare'
                                    ? t('tools.cloudflare.install_cloudflare')
                                    : t('tools.zrok.install_zrok')
                            }
                            onClick={openInstallModal}
                        />
                    ) : undefined
                }
            />

            <div className="flex gap-4 border-b dark:border-slate-800 mb-6 px-1">
                <TabButton active={activeTab === 'all'} label={t('tools.zrok.tab_all')} onClick={() => setActiveTab('all')} />
                <TabButton active={activeTab === 'zrok'} label={t('tools.zrok.tab_zrok')} onClick={() => setActiveTab('zrok')} />
                <TabButton active={activeTab === 'cloudflare'} label={t('tools.cloudflare.tab')} onClick={() => setActiveTab('cloudflare')} />
            </div>

            <TunnelsBody
                activeTab={activeTab}
                zrokStatus={zrokStatus}
                cfStatus={cfStatus}
                zrokUpdateAvailable={zrokUpdateAvailable}
                cfUpdateAvailable={cfUpdateAvailable}
                isZrokLoading={isZrokLoading}
                isCfLoading={isCfLoading}
                onTabSwitch={setActiveTab}
                onCfUninstall={() => {
                    setIsUninstalling(false);
                    setUninstallTarget('cloudflare');
                }}
                onCfStopShare={handleStopShare}
                projects={projects}
                onInstallClick={openInstallModal}
                onUpdateClick={handleUpdateClick}
                onUninstall={() => {
                    setIsUninstalling(false);
                    setUninstallTarget('zrok');
                }}
                onStopShare={handleStopShare}
                account={{
                    token,
                    isEnabling,
                    onTokenChange: setToken,
                    onEnable: handleEnable,
                    onDisable: handleDisable
                }}
                cfShare={shareConfig}
                share={shareConfig}
            />

            <TunnelsInstallModal />
            <TunnelsUninstallModal />
        </div>
    );
}

export default function TunnelsMain({ initialTab = 'all' }: { readonly initialTab?: ActiveTab } = {}) {
    return (
        <TunnelsProvider initialTab={initialTab}>
            <TunnelsMainView />
        </TunnelsProvider>
    );
}
