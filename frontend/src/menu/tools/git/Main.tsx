import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import SkeletonCard from '../../../components/skeleton/SkeletonCard';
import BackgroundProgressWidget from '../../../components/BackgroundProgressWidget';
import Tabs, { type TabItem } from '../../../components/Tabs';
import { GitProvider, useGit } from '../../../context/GitContext';
import { GitLabProvider, useGitLab } from '../../../context/GitLabContext';
import {
    GitInstallButton,
    GitLabInstallButton,
    ExternalCard,
    GitCoreSystemCard,
    GitGlobalConfigCard,
    GitAccountsCard,
    GitAssignedProjectsCard
} from './GitComponents';
import InstallGitModal from './InstallGitModal';
import GitUninstallModal from './GitUninstallModal';
import InstallGitLabModal from './InstallGitLabModal';
import GitAccountModal from './GitAccountModal';
import GitLabIntegrationTab from './GitLabIntegrationTab';

export function GitMainView() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'core' | 'gitlab'>('core');

    const {
        gitData,
        isLoading,
        setIsInstallModalOpen,
        isProcessing,
        isCancelling,
        handleCancelInstall,
        isInstallModalOpen,
        isUninstallModalOpen,
        isAccountModalOpen,
        setIsAccountModalOpen,
        editingAccount,
        setEditingAccount,
        isMinimized,
        setIsMinimized,
        progress,
        progressText
    } = useGit();

    const {
        statusData: gitlabStatus,
        isLoadingStatus: isLoadingGitlab,
        setIsInstallModalOpen: setIsGitlabInstallModalOpen,
        isInstallModalOpen: isGitlabInstallModalOpen,
        isProcessing: isGitlabProcessing,
        isCancelling: isGitlabCancelling,
        isMinimized: isGitlabMinimized,
        setIsMinimized: setIsGitlabMinimized,
        isUninstallModalOpen: isGitlabUninstallModalOpen,
        progress: gitlabProgress,
        progressText: gitlabProgressText,
        handleCancelInstall: handleGitlabCancelInstall,
    } = useGitLab();

    const tabs: ReadonlyArray<TabItem<'core' | 'gitlab'>> = [
        { value: 'core', label: t('tools.git.tab_core', 'Git Repository') },
        { value: 'gitlab', label: t('tools.git.tab_gitlab', 'GitLab Integration') },
    ];

    const getSubtitleText = (): string => {
        if (activeTab === 'core') {
            return isLoading ? t('tools.git.loading_data') : t('tools.git.subtitle');
        }
        return isLoadingGitlab ? t('tools.git.loading_data') : t('tools.gitlab.subtitle');
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="merge"
                title={t('tools.git.title')}
                subtitle={
                    <>
                        <span className="material-symbols-outlined text-[14px]">info</span>{' '}
                        {getSubtitleText()}
                    </>
                }
                actions={
                    activeTab === 'core' ? (
                        <GitInstallButton
                            installed={gitData.installed}
                            isLoading={isLoading}
                            isBlockedByExternal={!!gitData.external?.exists}
                            onClick={() => setIsInstallModalOpen(true)}
                            t={t}
                        />
                    ) : (
                        <GitLabInstallButton
                            installed={gitlabStatus.installed || gitlabStatus.is_external}
                            isLoading={isLoadingGitlab}
                            onClick={() => setIsGitlabInstallModalOpen(true)}
                            t={t}
                        />
                    )
                }
            />

            <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

            {activeTab === 'gitlab' ? (
                <>
                    <GitLabIntegrationTab />
                    <InstallGitLabModal />
                    <BackgroundProgressWidget
                        isOpen={isGitlabProcessing && (!isGitlabInstallModalOpen || isGitlabMinimized) && !isGitlabUninstallModalOpen}
                        progress={gitlabProgress}
                        progressText={gitlabProgressText}
                        title={t('tools.gitlab.installing')}
                        onRestore={() => {
                            setIsGitlabMinimized(false);
                            if (!isGitlabInstallModalOpen && !isGitlabUninstallModalOpen) {
                                setIsGitlabInstallModalOpen(true);
                            }
                        }}
                        onCancel={handleGitlabCancelInstall}
                        isCancelling={isGitlabCancelling}
                    />
                </>
            ) : (
                <>
                    {!isLoading && <ExternalCard gitData={gitData} t={t} />}

                    {isLoading && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 w-full min-w-0">
                            <SkeletonCard gridCols="grid-cols-1" />
                            <SkeletonCard gridCols="grid-cols-1" />
                        </div>
                    )}

                    {!isLoading && !gitData.installed && !gitData.external?.exists && (
                        <div className="mt-6">
                            <EmptyState
                                icon="merge"
                                title={t('tools.git.not_installed_title')}
                                description={t('tools.git.not_installed_desc')}
                                actionText={t('tools.git.download_git_now')}
                                onAction={() => setIsInstallModalOpen(true)}
                            />
                        </div>
                    )}

                    {!isLoading && gitData.installed ? (
                        <>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 w-full min-w-0">
                                <GitCoreSystemCard />
                                <GitGlobalConfigCard />
                            </div>
                            <div className="mt-6 w-full min-w-0">
                                <GitAccountsCard />
                            </div>
                            <div className="mt-6 w-full min-w-0">
                                <GitAssignedProjectsCard />
                            </div>
                        </>
                    ) : null}

                    <BackgroundProgressWidget
                        isOpen={isProcessing && (!isInstallModalOpen || isMinimized) && !isUninstallModalOpen}
                        progress={progress}
                        progressText={progressText}
                        title={t('tools.git.installing')}
                        onRestore={() => {
                            setIsMinimized(false);
                            if (!isInstallModalOpen && !isUninstallModalOpen) {
                                setIsInstallModalOpen(true);
                            }
                        }}
                        onCancel={handleCancelInstall}
                        isCancelling={isCancelling}
                    />

                    <InstallGitModal />
                    <GitUninstallModal />
                    <GitAccountModal
                        isOpen={isAccountModalOpen}
                        onClose={() => {
                            setIsAccountModalOpen(false);
                            setEditingAccount(null);
                        }}
                        editingAccount={editingAccount}
                    />
                </>
            )}
        </div>
    );
}

export default function GitMain() {
    return (
        <GitProvider>
            <GitLabProvider>
                <GitMainView />
            </GitLabProvider>
        </GitProvider>
    );
}
