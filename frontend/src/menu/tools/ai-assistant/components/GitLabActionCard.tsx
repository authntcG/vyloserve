import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAiAssistant } from '../../../../context/AiContext';
import type { VyloActionPayload } from './AiActionCard';

export interface GitLabActionCardProps {
    readonly action: VyloActionPayload;
    readonly actionKey?: string;
    readonly onExecuted?: () => void;
}

export default function GitLabActionCard({ action, actionKey, onExecuted }: GitLabActionCardProps) {
    const { t } = useTranslation();
    const ai = useOptionalAiAssistant();

    const persistentState = actionKey && ai?.actionStates ? ai.actionStates[actionKey] : undefined;
    const [localStatus, setLocalStatus] = useState<'proposed' | 'executing' | 'success' | 'failed' | 'cancelled'>('proposed');
    const [localFeedback, setLocalFeedback] = useState<string>('');
    const [webUrl, setWebUrl] = useState<string>('');
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [draftComment, setDraftComment] = useState<string>(action.params?.comment || '');

    const status = persistentState?.status || localStatus;
    const feedbackMessage = persistentState?.message ?? localFeedback;

    const updateStatus = (
        newStatus: 'proposed' | 'executing' | 'success' | 'failed' | 'cancelled',
        msg: string = '',
        url: string = ''
    ) => {
        setLocalStatus(newStatus);
        setLocalFeedback(msg);
        if (url) setWebUrl(url);
        if (actionKey && ai?.setActionState) {
            ai.setActionState(actionKey, { status: newStatus, message: msg });
        }
    };

    const repo = action.params?.repo || '';
    const targetId = action.target || '';
    const isMR = action.action === 'comment_mr';

    const handleExecute = async () => {
        updateStatus('executing');
        try {
            const api = (window as any).pywebview?.api;
            if (!api?.execute_gitlab_action) {
                updateStatus('failed', t('tools.gitlab.cli_not_ready', 'GitLab API is not ready.'));
                return;
            }

            const res = await api.execute_gitlab_action(
                action.action,
                repo,
                targetId,
                { comment: draftComment }
            );

            if (res?.status === 'success') {
                updateStatus('success', t('tools.gitlab.comment_sent', 'Posted to GitLab'), res.web_url || '');
                onExecuted?.();
            } else {
                const errMsg = res?.args?.e || res?.message || t('backend.gitlab.comment_failed', 'Failed to post comment.');
                updateStatus('failed', errMsg);
            }
        } catch (err: any) {
            updateStatus('failed', err?.message || String(err));
        }
    };

    const handleDiscard = () => {
        updateStatus('cancelled', t('tools.gitlab.discarded', 'Action discarded.'));
    };

    const handleOpenWeb = () => {
        if (!webUrl) return;
        const api = (window as any).pywebview?.api;
        if (api?.open_external_url) {
            api.open_external_url(webUrl);
        } else {
            window.open(webUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            data-testid="gitlab-action-card"
            className="my-2.5 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-surface/80 dark:bg-surface/60 overflow-hidden shadow-xs transition-all"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-orange-50/70 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900/40">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-orange-500 text-white font-bold text-xs shrink-0">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M22.65 14.39L20 6.21a.73.73 0 0 0-.27-.37.76.76 0 0 0-.46-.14.78.78 0 0 0-.44.13.73.73 0 0 0-.27.38l-1.9 5.86H7.34l-1.9-5.86a.73.73 0 0 0-.27-.38.78.78 0 0 0-.44-.13.76.76 0 0 0-.46.14.73.73 0 0 0-.27.37l-2.65 8.18a.69.69 0 0 0 .25.77l10.15 7.38a.74.74 0 0 0 .88 0l10.15-7.38a.69.69 0 0 0 .27-.77z" />
                        </svg>
                    </span>
                    <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {isMR ? `MR !${targetId}` : `Issue #${targetId}`}
                        </span>
                        {repo && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                ({repo})
                            </span>
                        )}
                    </div>
                </div>

                {/* Status Badge */}
                <div>
                    {status === 'proposed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                            {t('tools.gitlab.review_required', 'Action Proposal')}
                        </span>
                    )}
                    {status === 'executing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                            {t('tools.gitlab.sending', 'Sending...')}
                        </span>
                    )}
                    {status === 'success' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="material-symbols-outlined text-[12px]">check</span>
                            {t('tools.gitlab.comment_sent', 'Posted to GitLab')}
                        </span>
                    )}
                    {status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            <span className="material-symbols-outlined text-[12px]">error</span>
                            {t('backend.common.failed', 'Failed')}
                        </span>
                    )}
                    {status === 'cancelled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {t('tools.gitlab.discarded', 'Discarded')}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="p-3">
                {status === 'proposed' && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {t('tools.gitlab.comment_preview', 'Comment Preview')}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsEditing(!isEditing)}
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline focus:outline-hidden"
                            >
                                <span className="material-symbols-outlined text-[13px]">
                                    {isEditing ? 'visibility' : 'edit'}
                                </span>
                                {isEditing ? t('tools.gitlab.preview', 'Preview') : t('tools.gitlab.edit_comment', 'Edit')}
                            </button>
                        </div>

                        {isEditing ? (
                            <textarea
                                value={draftComment}
                                onChange={(e) => setDraftComment(e.target.value)}
                                rows={4}
                                aria-label={t('tools.gitlab.comment_preview', 'Comment Preview')}
                                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-primary"
                            />
                        ) : (
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto">
                                {draftComment || <span className="italic text-slate-400">{t('tools.gitlab.empty_comment', 'No comment draft')}</span>}
                            </div>
                        )}

                        {/* Buttons (Human-in-the-Loop) */}
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleDiscard}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                {t('tools.gitlab.discard', 'Discard')}
                            </button>
                            <button
                                type="button"
                                onClick={handleExecute}
                                disabled={!draftComment.trim()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">send</span>
                                {t('tools.gitlab.send_comment', 'Send to GitLab')}
                            </button>
                        </div>
                    </div>
                )}

                {status === 'executing' && (
                    <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {t('tools.gitlab.sending', 'Sending...')}
                    </div>
                )}

                {status === 'success' && (
                    <div className="space-y-2">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {feedbackMessage || t('tools.gitlab.comment_sent', 'Posted to GitLab')}
                        </p>
                        {webUrl && (
                            <button
                                type="button"
                                onClick={handleOpenWeb}
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                            >
                                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                {t('tools.gitlab.open_web', 'Open in GitLab')}
                            </button>
                        )}
                    </div>
                )}

                {status === 'failed' && (
                    <div className="space-y-2">
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {feedbackMessage}
                        </p>
                        <button
                            type="button"
                            onClick={() => updateStatus('proposed')}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                            {t('tools.terminal.reconnect', 'Restart Session')}
                        </button>
                    </div>
                )}

                {status === 'cancelled' && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        {feedbackMessage || t('tools.gitlab.discarded', 'Discarded')}
                    </p>
                )}
            </div>
        </div>
    );
}
