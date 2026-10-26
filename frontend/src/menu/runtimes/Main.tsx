import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import Button from '../../components/Button';
import ViewModeToggle, { type ViewMode } from '../../components/ViewModeToggle';
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
    readonly viewMode: ViewMode;
    readonly setViewMode: (mode: ViewMode) => void;
    readonly onOpenInstall: () => void;
    readonly t: any;
}

function RuntimesHeaderActions({ activeEngine, activeTab, isLoading, viewMode, setViewMode, onOpenInstall, t }: RuntimesHeaderActionsProps) {
    const hasVersions = Boolean(activeEngine.installed_versions && activeEngine.installed_versions.length > 0) || activeEngine.installed;

    return (
        <div className="flex items-center gap-2.5">
            {hasVersions && (
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            )}
            <Button
                variant="primary"
                icon="add"
                onClick={onOpenInstall}
                disabled={isLoading}
                className="whitespace-nowrap shrink-0 shadow-sm"
            >
                {`${t('runtimes.add')} ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            </Button>
        </div>
    );
}

export function RuntimesMainView() {
    const { t } = useTranslation();
    const {
        activeTab,
        setActiveTab,
        viewMode,
        setViewMode,
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
        executeUninstall,
        handleSetActiveVersion,
        handleDeactivateVersion,
        handleUninstallVersion,
        handleOpenFolder,
        handleOpenTerminal,
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
                        viewMode={viewMode}
                        setViewMode={setViewMode}
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
                    engine="node"
                    viewMode={viewMode}
                    data={runtimeData.node}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="javascript"
                    emptyTitle={t('runtimes.node_not_installed')}
                    emptyDesc={t('runtimes.node_desc')}
                    emptyActionText={t('runtimes.install_node_now')}
                    onOpenModal={() => setIsNodeModalOpen(true)}
                    onUpdateClick={(newVer, oldVer) => handleUpdateClick('node', newVer || runtimeData.node.updateAvailable!, oldVer)}
                    cardTitle="Node.js (VyloServe)"
                    engineTitle="Node.js"
                    onUninstallClick={() => executeUninstall('node')}
                    onSetActiveVersion={(ver) => handleSetActiveVersion('node', ver)}
                    onDeactivateVersion={() => handleDeactivateVersion('node')}
                    onUninstallVersion={(ver) => handleUninstallVersion('node', ver)}
                    uninstallLabel={t('runtimes.uninstall_node')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.npm_corepack')}
                    pathDescKey="runtimes.node_path_desc"
                    onTogglePath={(checked) => handleTogglePath('node', checked)}
                    onOpenFolder={() => handleOpenFolder('node')}
                    onOpenTerminal={() => handleOpenTerminal('node')}
                    onOpenFolderForVersion={(ver) => handleOpenFolder('node', ver)}
                    onOpenTerminalForVersion={(ver) => handleOpenTerminal('node', ver)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'python')}>
                <RuntimeEnginePanel
                    engine="python"
                    viewMode={viewMode}
                    data={runtimeData.python}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="data_object"
                    emptyTitle={t('runtimes.python_not_installed')}
                    emptyDesc={t('runtimes.python_desc')}
                    emptyActionText={t('runtimes.install_python_now')}
                    onOpenModal={() => setIsPythonModalOpen(true)}
                    onUpdateClick={(newVer, oldVer) => handleUpdateClick('python', newVer || runtimeData.python.updateAvailable!, oldVer)}
                    cardTitle="Python (VyloServe)"
                    engineTitle="Python"
                    onUninstallClick={() => executeUninstall('python')}
                    onSetActiveVersion={(ver) => handleSetActiveVersion('python', ver)}
                    onDeactivateVersion={() => handleDeactivateVersion('python')}
                    onUninstallVersion={(ver) => handleUninstallVersion('python', ver)}
                    uninstallLabel={t('runtimes.uninstall_python')}
                    field2Label={t('runtimes.package_manager')}
                    field2Value={t('runtimes.pip_available')}
                    pathDescKey="runtimes.python_path_desc"
                    onTogglePath={(checked) => handleTogglePath('python', checked)}
                    onOpenFolder={() => handleOpenFolder('python')}
                    onOpenTerminal={() => handleOpenTerminal('python')}
                    onOpenFolderForVersion={(ver) => handleOpenFolder('python', ver)}
                    onOpenTerminalForVersion={(ver) => handleOpenTerminal('python', ver)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'java')}>
                <RuntimeEnginePanel
                    engine="java"
                    viewMode={viewMode}
                    data={runtimeData.java}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="coffee"
                    emptyTitle={t('runtimes.java_not_installed')}
                    emptyDesc={t('runtimes.java_desc')}
                    emptyActionText={t('runtimes.install_java_now')}
                    onOpenModal={() => setIsJavaModalOpen(true)}
                    onUpdateClick={(newVer, oldVer) => handleUpdateClick('java', newVer || runtimeData.java.updateAvailable!, oldVer)}
                    cardTitle="Java JDK (VyloServe)"
                    engineTitle="Java JDK"
                    onUninstallClick={() => executeUninstall('java')}
                    onSetActiveVersion={(ver) => handleSetActiveVersion('java', ver)}
                    onDeactivateVersion={() => handleDeactivateVersion('java')}
                    onUninstallVersion={(ver) => handleUninstallVersion('java', ver)}
                    uninstallLabel={t('runtimes.uninstall_java')}
                    field2Label={t('runtimes.environment')}
                    field2Value={t('runtimes.java_home_set')}
                    pathDescKey="runtimes.java_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('java', checked)}
                    onOpenFolder={() => handleOpenFolder('java')}
                    onOpenTerminal={() => handleOpenTerminal('java')}
                    onOpenFolderForVersion={(ver) => handleOpenFolder('java', ver)}
                    onOpenTerminalForVersion={(ver) => handleOpenTerminal('java', ver)}
                />
            </div>

            <div className={tabVisibilityClass(activeTab, 'go')}>
                <RuntimeEnginePanel
                    engine="go"
                    viewMode={viewMode}
                    data={runtimeData.go}
                    isLoading={isLoading}
                    isProcessing={isProcessing}
                    emptyIcon="rocket_launch"
                    emptyTitle={t('runtimes.go_not_installed')}
                    emptyDesc={t('runtimes.go_desc')}
                    emptyActionText={t('runtimes.install_go_now')}
                    onOpenModal={() => setIsGoModalOpen(true)}
                    onUpdateClick={(newVer, oldVer) => handleUpdateClick('go', newVer || runtimeData.go.updateAvailable!, oldVer)}
                    cardTitle="Go Compiler (VyloServe)"
                    engineTitle="Go Compiler"
                    onUninstallClick={() => executeUninstall('go')}
                    onSetActiveVersion={(ver) => handleSetActiveVersion('go', ver)}
                    onDeactivateVersion={() => handleDeactivateVersion('go')}
                    onUninstallVersion={(ver) => handleUninstallVersion('go', ver)}
                    uninstallLabel={t('runtimes.uninstall_go')}
                    field2Label={t('runtimes.architecture')}
                    field2Value="amd64"
                    pathDescKey="runtimes.go_path_desc"
                    toggleMarginClass="ml-4"
                    onTogglePath={(checked) => handleTogglePath('go', checked)}
                    onOpenFolder={() => handleOpenFolder('go')}
                    onOpenTerminal={() => handleOpenTerminal('go')}
                    onOpenFolderForVersion={(ver) => handleOpenFolder('go', ver)}
                    onOpenTerminalForVersion={(ver) => handleOpenTerminal('go', ver)}
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
