import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import InstallNode from './InstallNode';
import InstallPython from './InstallPython';
import InstallJava from './InstallJava';
import InstallGo from './InstallGo';
import { useRuntimes } from '../../context/RuntimesContext';

export default function RuntimeInstallModal() {
    const { t } = useTranslation();
    const {
        isProcessing,
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
        handleInstallGoSubmit
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
            <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('runtimes.process_running')}</span>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500 truncate w-3/4">{progressText || t('runtimes.preparing')}</span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <ProgressBar percent={progress} />
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
                isApplyDisabled={isProcessing}
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
                isApplyDisabled={isProcessing}
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
                isApplyDisabled={isProcessing}
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
                isApplyDisabled={isProcessing}
            >
                <div className={isProcessing ? 'opacity-40 pointer-events-none transition-opacity' : ''}>
                    <InstallGo targetVersion={updatingVersion} ref={goRef} />
                </div>
                {renderProgressBar()}
            </Modal>
        </>
    );
}
