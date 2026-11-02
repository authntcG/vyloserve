import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ProgressStatusBlock from '../../components/ProgressStatusBlock';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import InstallNode from './InstallNode';
import InstallPython from './InstallPython';
import InstallJava from './InstallJava';
import InstallGo from './InstallGo';
import { useRuntimes } from '../../context/RuntimesContext';
import { useNetworkStatus } from '../../context/NetworkContext';

export default function RuntimeInstallModal() {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const {
        isProcessing,
        isCancelling,
        installingEngine,
        updatingVersion,
        progress,
        progressText,
        isMinimized,
        setIsMinimized,
        isNodeModalOpen,
        setIsNodeModalOpen,
        isPythonModalOpen,
        setIsPythonModalOpen,
        isJavaModalOpen,
        setIsJavaModalOpen,
        isGoModalOpen,
        setIsGoModalOpen,
        nodeRef,
        pythonRef,
        javaRef,
        goRef,
        handleInstallNodeSubmit,
        handleInstallPythonSubmit,
        handleInstallJavaSubmit,
        handleInstallGoSubmit,
        handleCancelInstall,
    } = useRuntimes();

    const isUpdateFlow = Boolean(updatingVersion);

    const getApplyButtonText = () => {
        if (isProcessing) {
            return isUpdateFlow ? t('runtimes.updating_btn') : t('runtimes.installing_btn');
        }
        return isUpdateFlow ? t('runtimes.update_engine_btn') : t('runtimes.install_engine_btn');
    };

    const getModalTitle = (name: string) => {
        const prefix = isUpdateFlow ? t('runtimes.update_title') : t('runtimes.install_title');
        return `${prefix}${name}`;
    };

    const renderProgressBar = () => {
        if (!isProcessing) return null;
        return (
            <div className="mt-5">
                <ProgressStatusBlock
                    progressText={progressText || t('runtimes.preparing')}
                    progress={progress}
                    onCancel={handleCancelInstall}
                    isCancelling={isCancelling}
                />
            </div>
        );
    };

    return (
        <>
            <BackgroundProgressWidget
                isOpen={isMinimized && isProcessing && !!installingEngine}
                progress={progress}
                progressText={progressText}
                title={
                    updatingVersion
                        ? `${t('runtimes.update_title')}${installingEngine?.toUpperCase()}`
                        : `${t('runtimes.install_title')}${installingEngine?.toUpperCase()}`
                }
                onRestore={() => setIsMinimized(false)}
                onCancel={handleCancelInstall}
                isCancelling={isCancelling}
            />

            {/* Modal order: node, python, java, go (Preserved for tests & accessibility) */}
            <Modal
                isOpen={isNodeModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => (isProcessing ? setIsMinimized(true) : setIsNodeModalOpen(false))}
                title={getModalTitle('Node.js')}
                icon="javascript"
                onApply={updatingVersion ? undefined : handleInstallNodeSubmit}
                applyText={getApplyButtonText()}
                isApplyDisabled={isProcessing || !isOnline}
            >
                <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                    <InstallNode targetVersion={updatingVersion} ref={nodeRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isPythonModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => (isProcessing ? setIsMinimized(true) : setIsPythonModalOpen(false))}
                title={getModalTitle('Python')}
                icon="data_object"
                onApply={updatingVersion ? undefined : handleInstallPythonSubmit}
                applyText={getApplyButtonText()}
                isApplyDisabled={isProcessing || !isOnline}
            >
                <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                    <InstallPython targetVersion={updatingVersion} ref={pythonRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isJavaModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => (isProcessing ? setIsMinimized(true) : setIsJavaModalOpen(false))}
                title={getModalTitle('Java (JDK)')}
                icon="coffee"
                onApply={updatingVersion ? undefined : handleInstallJavaSubmit}
                applyText={getApplyButtonText()}
                isApplyDisabled={isProcessing || !isOnline}
            >
                <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                    <InstallJava targetVersion={updatingVersion} ref={javaRef} />
                </div>
                {renderProgressBar()}
            </Modal>

            <Modal
                isOpen={isGoModalOpen && !isMinimized}
                keepMounted={isProcessing}
                onClose={() => (isProcessing ? setIsMinimized(true) : setIsGoModalOpen(false))}
                title={getModalTitle('Go Compiler')}
                icon="rocket_launch"
                onApply={updatingVersion ? undefined : handleInstallGoSubmit}
                applyText={getApplyButtonText()}
                isApplyDisabled={isProcessing || !isOnline}
            >
                <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                    <InstallGo targetVersion={updatingVersion} ref={goRef} />
                </div>
                {renderProgressBar()}
            </Modal>
        </>
    );
}
