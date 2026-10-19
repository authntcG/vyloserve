import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAiAssistant } from '../../../../context/AiContext';

export interface VyloActionPayload {
    service: 'apache' | 'php' | 'database';
    action: 'start' | 'stop' | 'restart' | 'switch_version' | 'start_all' | 'stop_all';
    target?: string;
    label?: string;
}

interface AiActionCardProps {
    readonly action: VyloActionPayload;
    readonly actionKey?: string;
    readonly onExecuted?: () => void;
}

async function dispatchApacheAction(api: any, action: VyloActionPayload) {
    if (action.action === 'start' || action.action === 'start_all') {
        return await api.start_apache_server();
    }
    if (action.action === 'stop' || action.action === 'stop_all') {
        return await api.stop_apache_server();
    }
    if (action.action === 'restart') {
        return await api.restart_apache_server();
    }
    if (action.action === 'switch_version' && action.target) {
        return await api.set_apache_active_version(action.target);
    }
    return null;
}

async function dispatchPhpAction(api: any, action: VyloActionPayload) {
    const hasTarget = Boolean(action.target && action.target !== 'all');
    if (action.action === 'start' || action.action === 'start_all') {
        return hasTarget ? await api.start_php(action.target) : await api.start_service('php');
    }
    if (action.action === 'stop' || action.action === 'stop_all') {
        return hasTarget ? await api.stop_php(action.target) : await api.stop_service('php');
    }
    return null;
}

async function dispatchDatabaseAction(api: any, action: VyloActionPayload) {
    const hasTarget = Boolean(action.target && action.target !== 'all');
    if (action.action === 'start' || action.action === 'start_all') {
        return hasTarget ? await api.start_database(action.target) : await api.start_service('database');
    }
    if (action.action === 'stop' || action.action === 'stop_all') {
        return hasTarget ? await api.stop_database(action.target) : await api.stop_service('database');
    }
    return null;
}

async function executeActionPayload(api: any, action: VyloActionPayload) {
    if (action.service === 'apache') {
        return await dispatchApacheAction(api, action);
    }
    if (action.service === 'php') {
        return await dispatchPhpAction(api, action);
    }
    if (action.service === 'database') {
        return await dispatchDatabaseAction(api, action);
    }
    return null;
}

export default function AiActionCard({ action, actionKey, onExecuted }: AiActionCardProps) {
    const { t } = useTranslation();
    const ai = useOptionalAiAssistant();

    const persistentState = actionKey && ai?.actionStates ? ai.actionStates[actionKey] : undefined;
    const [localStatus, setLocalStatus] = useState<'proposed' | 'executing' | 'success' | 'failed' | 'cancelled'>('proposed');
    const [localFeedback, setLocalFeedback] = useState<string>('');

    const status = persistentState?.status || localStatus;
    const feedbackMessage = persistentState?.message ?? localFeedback;

    const updateStatus = (newStatus: 'proposed' | 'executing' | 'success' | 'failed' | 'cancelled', msg: string = '') => {
        setLocalStatus(newStatus);
        setLocalFeedback(msg);
        if (actionKey && ai?.setActionState) {
            ai.setActionState(actionKey, { status: newStatus, message: msg });
        }
    };

    // Service meta
    const serviceMeta = {
        apache: {
            name: t('ai.action_service_apache', 'Apache HTTP Server'),
            icon: 'dns',
            color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60',
        },
        php: {
            name: t('ai.action_service_php', 'PHP Engine'),
            icon: 'code',
            color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
        },
        database: {
            name: t('ai.action_service_database', 'Database Engine'),
            icon: 'database',
            color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
        },
    }[action.service] || {
        name: action.service,
        icon: 'settings',
        color: 'text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    };

    // Action label
    const actionLabel = {
        start: t('ai.action_type_start', 'Start Service'),
        stop: t('ai.action_type_stop', 'Stop Service'),
        restart: t('ai.action_type_restart', 'Restart Service'),
        switch_version: t('ai.action_type_switch_version', 'Switch Version'),
        start_all: t('ai.action_type_start_all', 'Start All Services'),
        stop_all: t('ai.action_type_stop_all', 'Stop All Services'),
    }[action.action] || action.action;

    const handleExecute = async () => {
        updateStatus('executing');

        try {
            const api = (window as any).pywebview?.api;
            if (!api) {
                updateStatus('failed', 'Desktop API bridge is not connected.');
                return;
            }

            const res = await executeActionPayload(api, action);

            if (res?.status === 'success') {
                const msg = res.message ? t(res.message, res.args || {}) : t('ai.action_success', 'Action executed successfully.');
                const finalMsg = typeof msg === 'string' ? msg : t('ai.action_success', 'Action executed successfully.');
                updateStatus('success', finalMsg);

                // Broadcast ke listener modul spesifik (apache, php, database) dan dashboard/sidebar
                const isStarting = action.action === 'start' || action.action === 'start_all';
                window.dispatchEvent(new CustomEvent('service_status_changed', {
                    detail: { service: action.service, running: isStarting }
                }));
                window.dispatchEvent(new CustomEvent('service_status_changed', {
                    detail: { service: 'all' }
                }));
                window.dispatchEvent(new CustomEvent('vylo_service_change'));
                if (onExecuted) onExecuted();
            } else {
                const errMsg = res?.message ? t(res.message, res.args || {}) : t('ai.action_failed', 'Action execution failed.');
                const finalErr = typeof errMsg === 'string' ? errMsg : t('ai.action_failed', 'Action execution failed.');
                updateStatus('failed', finalErr);
            }
        } catch (err: any) {
            updateStatus('failed', err?.message || t('ai.action_failed', 'Action execution failed.'));
        }
    };

    const handleCancel = () => {
        updateStatus('cancelled');
    };

    return (
        <div className="my-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/70 p-3 shadow-xs text-xs select-none box-border w-full transition-all">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${serviceMeta.color}`}>
                        <span className="material-symbols-outlined text-[15px]">{serviceMeta.icon}</span>
                    </div>
                    <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">
                            {action.label || serviceMeta.name}
                        </span>
                    </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                        {actionLabel}
                    </span>
                    {action.target && action.target !== 'all' && (
                        <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20">
                            {action.target}
                        </span>
                    )}
                </div>
            </div>

            {/* Action State Feedback */}
            {status === 'success' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                    <span>{feedbackMessage || t('ai.action_success', 'Action executed successfully.')}</span>
                </div>
            )}

            {status === 'failed' && (
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-[11px]">
                    <div className="flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">error</span>
                        <span className="font-medium break-all">{feedbackMessage || t('ai.action_failed', 'Action execution failed.')}</span>
                    </div>
                    <div className="flex justify-end mt-1">
                        <button
                            type="button"
                            onClick={handleExecute}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-medium transition-colors cursor-pointer"
                        >
                            {t('settings.refresh', 'Coba Lagi')}
                        </button>
                    </div>
                </div>
            )}

            {status === 'cancelled' && (
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                    <span className="material-symbols-outlined text-[15px]">block</span>
                    <span>{t('ai.action_cancelled', 'Action cancelled.')}</span>
                </div>
            )}

            {/* Confirmation Buttons (Proposed / Executing) */}
            {(status === 'proposed' || status === 'executing') && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-primary">touch_app</span>
                        <span>{t('ai.action_proposed_title', 'Proposed System Action')}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={status === 'executing'}
                            className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {t('ai.action_cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleExecute}
                            disabled={status === 'executing'}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-medium shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            {status === 'executing' ? (
                                <>
                                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                    <span>{t('ai.action_executing', 'Executing...')}</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                                    <span>{t('ai.action_confirm', 'Confirm & Execute')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
