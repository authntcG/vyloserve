import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import SkeletonCard from '../../../components/skeleton/SkeletonCard';
import BackgroundProgressWidget from '../../../components/BackgroundProgressWidget';
import { GitProvider, useGit } from '../../../context/GitContext';
import {
    GitInstallButton,
    ExternalCard,
    GitCoreSystemCard,
    GitGlobalConfigCard
} from './GitComponents';
import InstallGitModal from './InstallGitModal';
import GitUninstallModal from './GitUninstallModal';

export function GitMainView() {
    const { t } = useTranslation();
    const {
        gitData,
        isLoading,
        setIsInstallModalOpen,
        isProcessing,
        isInstallModalOpen,
        isUninstallModalOpen,
        isMinimized,
        setIsMinimized,
        progress,
        progressText
    } = useGit();

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="merge"
                title={t('tools.git.title')}
                subtitle={
                    <>
                        <span className="material-symbols-outlined text-[14px]">info</span>{' '}
                        {isLoading ? t('tools.git.loading_data') : t('tools.git.subtitle')}
                    </>
                }
                actions={
                    <GitInstallButton
                        installed={gitData.installed}
                        isLoading={isLoading}
                        isBlockedByExternal={!!gitData.external?.exists}
                        onClick={() => setIsInstallModalOpen(true)}
                        t={t}
                    />
                }
            />

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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 w-full min-w-0">
                    <GitCoreSystemCard />
                    <GitGlobalConfigCard />
                </div>
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
            />

            <InstallGitModal />
            <GitUninstallModal />
        </div>
    );
}

export default function GitMain() {
    return (
        <GitProvider>
            <GitMainView />
        </GitProvider>
    );
}
