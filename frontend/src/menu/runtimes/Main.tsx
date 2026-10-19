import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import {
    RuntimesProvider,
    useRuntimes,
    type RuntimeEngine,
    type EngineData
} from '../../context/RuntimesContext';
import {
    RuntimeEnginePanel,
    engineTabBadgeClass,
    tabVisibilityClass
} from './RuntimeEnginePanel';
import RuntimeInstallModal from './RuntimeInstallModal';

interface RuntimesSubtitleProps {
    readonly isLoading: boolean;
    readonly activeEnginesCount: number;
    readonly t: any;
}

function RuntimesSubtitle({ isLoading, activeEnginesCount, t }: RuntimesSubtitleProps) {
    return (
        <>
            <span className="material-symbols-outlined text-[14px]">info</span>
            {isLoading ? t('runtimes.loading_data') : `${activeEnginesCount}${t('runtimes.engines_detected')}`}
        </>
    );
}

interface RuntimesHeaderActionsProps {
    readonly activeEngine: EngineData;
    readonly activeTab: RuntimeEngine;
    readonly isLoading: boolean;
    readonly onOpenInstall: () => void;
    readonly t: any;
}

function RuntimesHeaderActions({ activeEngine, activeTab, isLoading, onOpenInstall, t }: RuntimesHeaderActionsProps) {
    if (activeEngine.installed) {
        return (
            <button
                type="button"
                disabled
                className="text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm bg-emerald-500 opacity-80 cursor-default whitespace-nowrap shrink-0"
            >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t('common.installed') || 'Installed'}
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onOpenInstall}
            disabled={isLoading}
            className="text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap shrink-0 bg-primary hover:bg-primary/90 border border-transparent"
        >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {`${t('runtimes.add')} ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </button>
    );
}

export function RuntimesMainView() {
    const { t } = useTranslation();
    const {
        activeTab,
        setActiveTab,
        runtimeData,
        isLoading,
        isProcessing,
        activeEnginesCount,
        handleOpenInstall,
        setIsNodeModalOpen,
        setIsPythonModalOpen,
        setIsJavaModalOpen,
        setIsGoModalOpen,
        handleUpdateClick,
        handleTogglePath,
        executeUninstall
    } = useRuntimes();

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="terminal"
                title={t('runtimes.runtimes_engines')}
                subtitle={<RuntimesSubtitle isLoading={isLoading} activeEnginesCount={activeEnginesCount} t={t} />}
                actions={
                    <RuntimesHeaderActions
                        activeEngine={runtimeData[activeTab]}
                        activeTab={activeTab}
                        isLoading={isLoading}
                        onOpenInstall={handleOpenInstall}
                        t={t}
                    />
                }
            />

            <div className="w-full max-w-full overflow-hidden">
                <Tabs
                    className="w-full"
                    tabs={[
                        { value: 'node', label: 'Node.js', badgeColorClass: engineTabBadgeClass(runtimeData.node) },
                        { value: 'python', label: 'Python', badgeColorClass: engineTabBadgeClass(runtimeData.python) },
                        { value: 'java', label: 'Java JDK', badgeColorClass: engineTabBadgeClass(runtimeData.java) },
                        { value: 'go', label: 'Go Compiler', badgeColorClass: engineTabBadgeClass(runtimeData.go) },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'node')}>
                <RuntimeEnginePanel
                    data={runtimeData.node}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="javascript"
                    emptyTitle={t('runtimes.node_not_installed')}
                    emptyDesc={t('runtimes.node_desc')}
                    emptyActionText={t('runtimes.install_node_now')}
                    onOpenModal={() => setIsNodeModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('node', runtimeData.node.updateAvailable!)}
                    cardTitle="Node.js (VyloServe)"
                    engineTitle="Node.js"
                    onUninstallClick={() => executeUninstall('node')}
                    uninstallLabel={t('runtimes.uninstall_node')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.npm_corepack')}
                    pathDescKey="runtimes.node_path_desc"
                    onTogglePath={(checked) => handleTogglePath('node', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'python')}>
                <RuntimeEnginePanel
                    data={runtimeData.python}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="data_object"
                    emptyTitle={t('runtimes.python_not_installed')}
                    emptyDesc={t('runtimes.python_desc')}
                    emptyActionText={t('runtimes.install_python_now')}
                    onOpenModal={() => setIsPythonModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('python', runtimeData.python.updateAvailable!)}
                    cardTitle="Python (VyloServe)"
                    engineTitle="Python"
                    onUninstallClick={() => executeUninstall('python')}
                    uninstallLabel={t('runtimes.uninstall_python')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.pip_available')}
                    pathDescKey="runtimes.python_path_desc"
                    onTogglePath={(checked) => handleTogglePath('python', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'java')}>
                <RuntimeEnginePanel
                    data={runtimeData.java}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="coffee"
                    emptyTitle={t('runtimes.java_not_installed')}
                    emptyDesc={t('runtimes.java_desc')}
                    emptyActionText={t('runtimes.install_java_now')}
                    onOpenModal={() => setIsJavaModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('java', runtimeData.java.updateAvailable!)}
                    cardTitle="Java JDK (VyloServe)"
                    engineTitle="Java JDK"
                    onUninstallClick={() => executeUninstall('java')}
                    uninstallLabel={t('runtimes.uninstall_java')}
                    field2Label={t('runtimes.environment')}
                    field2Value={t('runtimes.java_home_set')}
                    pathDescKey="runtimes.java_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('java', checked)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'go')}>
                <RuntimeEnginePanel
                    data={runtimeData.go}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="rocket_launch"
                    emptyTitle={t('runtimes.go_not_installed')}
                    emptyDesc={t('runtimes.go_desc')}
                    emptyActionText={t('runtimes.install_go_now')}
                    onOpenModal={() => setIsGoModalOpen(true)}
                    onUpdateClick={() => handleUpdateClick('go', runtimeData.go.updateAvailable!)}
                    cardTitle="Go Compiler (VyloServe)"
                    engineTitle="Go Compiler"
                    onUninstallClick={() => executeUninstall('go')}
                    uninstallLabel={t('runtimes.uninstall_go')}
                    field2Label={t('runtimes.architecture')}
                    field2Value="amd64"
                    pathDescKey="runtimes.go_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('go', checked)}
                />
            </div>

            <RuntimeInstallModal />
        </div>
    );
}

export default function RuntimesMain() {
    return (
        <RuntimesProvider>
            <RuntimesMainView />
        </RuntimesProvider>
    );
}
