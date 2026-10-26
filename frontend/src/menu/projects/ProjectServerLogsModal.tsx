import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { useProject } from '../../context/ProjectContext';

export default function ProjectServerLogsModal() {
    const { t } = useTranslation();
    const {
        isServerLogsModalOpen,
        serverLogsProject,
        serverLogsContent,
        isFetchingLogs,
        refreshServerLogs,
        closeServerLogsModal,
    } = useProject();

    const logContainerRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [serverLogsContent, isServerLogsModalOpen]);

    const title = serverLogsProject
        ? `${t('projects.server_logs_title')} - ${serverLogsProject.name || serverLogsProject.domain}`
        : t('projects.server_logs_title');

    return (
        <Modal
            isOpen={isServerLogsModalOpen}
            onClose={closeServerLogsModal}
            title={title}
            icon="terminal"
            maxWidthClass="sm:w-[720px]"
            customFooter={
                <div className="flex items-center justify-between w-full">
                    <Button
                        type="button"
                        variant="secondary"
                        icon="sync"
                        loading={isFetchingLogs}
                        onClick={refreshServerLogs}
                        className="text-xs"
                    >
                        {t('projects.refresh_logs')}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={closeServerLogsModal}
                        className="text-xs"
                    >
                        {t('projects.close_logs')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                        {serverLogsProject?.project_type?.toUpperCase()} (127.0.0.1:{serverLogsProject?.proxy_port})
                    </span>
                    {isFetchingLogs && (
                        <span className="inline-flex items-center gap-1.5 text-primary text-[11px]">
                            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                            {t('common.loading', 'Loading...')}
                        </span>
                    )}
                </div>
                <pre
                    ref={logContainerRef}
                    tabIndex={0}
                    aria-label={t('projects.server_logs_title')}
                    className="w-full h-80 overflow-y-auto p-3.5 bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed rounded-lg border border-slate-800 focus:outline-none focus:ring-1 focus:ring-primary select-text whitespace-pre-wrap break-all"
                >
                    {serverLogsContent ? serverLogsContent : (
                        <span className="text-slate-500 italic">
                            {t('projects.server_logs_empty')}
                        </span>
                    )}
                </pre>
            </div>
        </Modal>
    );
}
