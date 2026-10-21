import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { useApache } from '../../context/ApacheContext';

export default function ApacheCliInstallModal() {
    const { t } = useTranslation();
    const {
        isCreatingProject,
        isCliModalOpen,
        cliPromptText,
        confirmCancelProjectInstall,
    } = useApache();

    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!isCreatingProject || !containerRef.current) {
            if (termRef.current) {
                termRef.current.dispose();
                termRef.current = null;
                fitAddonRef.current = null;
            }
            return;
        }

        let term: Terminal | null = null;
        try {
            term = new Terminal({
                cursorBlink: true,
                convertEol: true,
                fontSize: 13,
                fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
                theme: {
                    background: '#020617',
                    foreground: '#e2e8f0',
                    cursor: '#38bdf8',
                },
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);
            term.onData((data: string) => {
                const api = window.pywebview?.api as any;
                api?.send_project_cli_input?.(data);
            });
            termRef.current = term;
            fitAddonRef.current = fitAddon;
        } catch (err) {
            console.error(err);
        }

        const handleCliOutput = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.data && termRef.current) {
                termRef.current.write(detail.data);
            }
        };

        window.addEventListener('vylo_cli_output', handleCliOutput);
        return () => {
            window.removeEventListener('vylo_cli_output', handleCliOutput);
            if (term) {
                term.dispose();
            }
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, [isCreatingProject]);

    useEffect(() => {
        if (!isCliModalOpen || !termRef.current || !fitAddonRef.current) return;
        const timer = window.setTimeout(() => {
            try {
                fitAddonRef.current?.fit();
                termRef.current?.focus();
                const api = window.pywebview?.api as any;
                if (termRef.current) {
                    api?.resize_project_cli?.(termRef.current.cols, termRef.current.rows);
                }
            } catch (err) {
                console.error(err);
            }
        }, 80);
        return () => window.clearTimeout(timer);
    }, [isCliModalOpen]);

    const isOpen = isCreatingProject && isCliModalOpen;

    return (
        <Modal
            isOpen={isOpen}
            keepMounted={isCreatingProject}
            onClose={confirmCancelProjectInstall}
            title={t('apache.cli_modal_title')}
            icon="terminal"
            maxWidthClass="sm:w-[740px]"
            bodyPaddingClass="p-4"
            customHeader={
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-amber-500">terminal</span>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('apache.cli_modal_title')}</h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {t('apache.cli_waiting_input_badge')}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={confirmCancelProjectInstall}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title={t('common.close', 'Close')}
                        aria-label={t('common.close', 'Close')}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            }
            customFooter={
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-primary">keyboard</span>
                        {t('apache.cli_keyboard_hint')}
                    </span>
                    <Button variant="danger" icon="cancel" onClick={confirmCancelProjectInstall}>
                        {t('apache.cli_cancel_install_btn')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
                    <div className="flex flex-col gap-0.5">
                        <span>{t('apache.cli_auto_popup_hint')}</span>
                        {cliPromptText && (
                            <span className="font-mono text-[11px] text-amber-900 dark:text-amber-200 font-semibold truncate max-w-[620px]">
                                {cliPromptText}
                            </span>
                        )}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    data-testid="apache-cli-xterm-container"
                    className="w-full h-[340px] rounded-xl bg-slate-950 p-3 overflow-hidden border border-slate-800 shadow-inner"
                />
            </div>
        </Modal>
    );
}
