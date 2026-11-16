import { useState, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import DocAiInput from './DocAiInput';
import Button from '../../../components/Button';
import MarkdownRenderer from './MarkdownRenderer';

interface ProviderInfo {
    readonly provider: string;
    readonly model: string;
    readonly is_local: boolean;
    readonly is_configured: boolean;
    readonly base_url?: string;
}

interface DocAiDrawerProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly docContent: string;
    readonly docPath: string | null;
    readonly folderPath?: string | null;
    readonly isAiEnabled: boolean;
    readonly onOpenPrivacyModal: () => void;
    readonly providerInfo?: ProviderInfo | null;
    readonly onOpenFile?: (path: string) => void;
}

interface Message {
    readonly id: string;
    readonly role: 'user' | 'assistant';
    content: string;
}

const CHAT_STORAGE_PREFIX = 'vylo_docs_ai_history_';

interface SavedAiState {
    readonly qaMessages: Message[];
    readonly summary: string;
}

const loadFolderHistory = (folder?: string | null): SavedAiState => {
    if (!folder) return { qaMessages: [], summary: '' };
    try {
        const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${folder}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                qaMessages: Array.isArray(parsed?.qaMessages) ? parsed.qaMessages : [],
                summary: typeof parsed?.summary === 'string' ? parsed.summary : ''
            };
        }
    } catch {
        // ignore
    }
    return { qaMessages: [], summary: '' };
};

const saveFolderHistory = (folder: string | null | undefined, data: SavedAiState) => {
    if (!folder) return;
    try {
        const cappedData = {
            ...data,
            qaMessages: data.qaMessages.slice(-50),
        };
        localStorage.setItem(`${CHAT_STORAGE_PREFIX}${folder}`, JSON.stringify(cappedData));
    } catch {
        // ignore
    }
};

const trimEnclosingQuotes = (raw: string): string => {
    const s = raw.trim();
    const firstChar = s[0];
    const lastChar = s.at(-1);
    if (s.length >= 2 && (firstChar === "'" || firstChar === '"' || firstChar === '`') && firstChar === lastChar) {
        return s.slice(1, -1).trim();
    }
    return s;
};

export const parseReferences = (content: string): { cleanContent: string; references: string[] } => {
    if (!content) return { cleanContent: '', references: [] };
    const refMarker = 'References:';
    const lastIdx = content.lastIndexOf(refMarker);
    if (lastIdx !== -1) {
        const afterMarker = content.slice(lastIdx + refMarker.length).trim();
        if (afterMarker.startsWith('[') && afterMarker.endsWith(']')) {
            const rawFiles = afterMarker
                .slice(1, -1)
                .split(',')
                .map(trimEnclosingQuotes)
                .filter(Boolean);
            const cleanContent = content.substring(0, lastIdx).trimEnd();
            return { cleanContent, references: rawFiles };
        }
    }
    return { cleanContent: content, references: [] };
};

interface ChunkDetail {
    chunk?: string;
    is_done?: boolean;
    error?: string;
    message_id?: string;
}

const handleSummaryChunk = (
    detail: ChunkDetail,
    t: (key: string) => string,
    setSummary: React.Dispatch<React.SetStateAction<string>>,
    setIsSummaryLoading: (v: boolean) => void,
    setSummaryError: (v: string | null) => void
) => {
    if (detail.chunk) {
        setSummary((prev) => prev + detail.chunk);
    }
    if (detail.is_done) {
        setIsSummaryLoading(false);
        setSummaryError(detail.error ? (t(detail.error) || detail.error) : null);
    }
};

const handleQaChunk = (
    detail: ChunkDetail,
    t: (key: string) => string,
    setQaMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    setIsQaGenerating: (v: boolean) => void
) => {
    if (detail.chunk) {
        const chunkText = detail.chunk;
        const messageId = detail.message_id ?? `assistant-${Date.now()}`;
        setQaMessages((prev) => {
            const copy = [...prev];
            const last = copy.at(-1);
            if (last?.role === 'assistant' && last.id === detail.message_id) {
                last.content += chunkText;
                return copy;
            }
            return [...copy, { id: messageId, role: 'assistant', content: chunkText }];
        });
    }
    if (detail.is_done) {
        setIsQaGenerating(false);
        if (detail.error) {
            setQaMessages((prev) => {
                const copy = [...prev];
                const last = copy.at(-1);
                if (last?.role === 'assistant') {
                    last.content += `\n\n*(Error: ${t(detail.error!) || detail.error})*`;
                }
                return copy;
            });
        }
    }
};

interface PrivacyGuardScreenProps {
    readonly onOpenPrivacyModal?: () => void;
}

function PrivacyGuardScreen({ onOpenPrivacyModal }: PrivacyGuardScreenProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[28px]">lock</span>
            </div>
            <div className="flex flex-col gap-1 max-w-xs">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {t('tools.docs_reader.privacy_status_off')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('tools.docs_reader.privacy_warning')}
                </p>
            </div>
            <Button variant="primary" size="sm" icon="verified_user" onClick={onOpenPrivacyModal}>
                {t('tools.docs_reader.privacy_btn_enable')}
            </Button>
        </div>
    );
}

interface DocSummaryTabViewProps {
    readonly summary: string;
    readonly summaryError: string | null;
    readonly isSummaryLoading: boolean;
    readonly isCopiedSummary: boolean;
    readonly docPath?: string;
    readonly readerTheme: 'light' | 'dark';
    readonly onGenerateSummary: () => void;
    readonly onStopGeneration: () => void;
    readonly onCopySummary: () => void;
}

function DocSummaryTabView({
    summary,
    summaryError,
    isSummaryLoading,
    isCopiedSummary,
    docPath,
    readerTheme,
    onGenerateSummary,
    onStopGeneration,
    onCopySummary,
}: DocSummaryTabViewProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 flex flex-col gap-3 custom-scrollbar">
            {summaryError && (
                <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 text-red-600 dark:text-red-400 min-w-0">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                        <span className="leading-relaxed break-words">{summaryError}</span>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon="refresh"
                        onClick={onGenerateSummary}
                        className="shrink-0"
                    >
                        {t('tools.docs_reader.retry')}
                    </Button>
                </div>
            )}

            {!summary && !isSummaryLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-3">
                    <div className="w-full rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center flex flex-col items-center gap-3.5 shadow-2xs">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                        </div>
                        <div className="flex flex-col gap-1 max-w-[280px]">
                            <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                {t('tools.docs_reader.tab_summary')}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {t('tools.docs_reader.summary_empty')}
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            icon="bolt"
                            onClick={onGenerateSummary}
                        >
                            {t('tools.docs_reader.summary_btn')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {isSummaryLoading
                                ? t('tools.docs_reader.summary_generating')
                                : t('tools.docs_reader.tab_summary')}
                        </span>
                        <div className="flex items-center gap-1">
                            {isSummaryLoading ? (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="stop_circle"
                                    onClick={onStopGeneration}
                                >
                                    {t('tools.docs_reader.stop_generating')}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={isCopiedSummary ? 'check' : 'content_copy'}
                                        onClick={onCopySummary}
                                    >
                                        {isCopiedSummary ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_markdown')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="refresh"
                                        onClick={onGenerateSummary}
                                    >
                                        {t('tools.docs_reader.summary_btn')}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50/70 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                        <MarkdownRenderer isCompact content={summary} rootPath={docPath || ''} readerTheme={readerTheme} />
                    </div>
                </div>
            )}
        </div>
    );
}

interface DocQaTabViewProps {
    readonly qaMessages: Message[];
    readonly isQaGenerating: boolean;
    readonly docContent: string;
    readonly docPath?: string;
    readonly folderPath?: string;
    readonly readerTheme: 'light' | 'dark';
    readonly isAiEnabled: boolean;
    readonly onSendQa: (promptText: string) => void;
    readonly onCopyAnswer: (content: string) => void;
    readonly onOpenFile?: (path: string) => void;
}

function DocQaTabView({
    qaMessages,
    isQaGenerating,
    docContent,
    docPath,
    folderPath,
    readerTheme,
    isAiEnabled,
    onSendQa,
    onCopyAnswer,
    onOpenFile,
}: DocQaTabViewProps) {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 custom-scrollbar">
                {qaMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-3">
                        <div className="w-full rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center flex flex-col items-center gap-3.5 shadow-2xs">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center">
                                <span className="material-symbols-outlined text-[24px]">forum</span>
                            </div>
                            <div className="flex flex-col gap-1 max-w-[280px]">
                                <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                    {t('tools.docs_reader.tab_qa')}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {t('tools.docs_reader.qa_empty')}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full pt-1">
                                {[
                                    { key: 'summary', text: t('tools.docs_reader.qa_suggest_summary'), icon: 'summarize' },
                                    { key: 'arch', text: t('tools.docs_reader.qa_suggest_architecture'), icon: 'account_tree' },
                                    { key: 'req', text: t('tools.docs_reader.qa_suggest_requirements'), icon: 'checklist' }
                                ].map((chip) => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={() => onSendQa(chip.text)}
                                        className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-primary/50 hover:bg-primary/5 text-slate-700 dark:text-slate-300 text-xs transition-colors flex items-center gap-2 text-left cursor-pointer group"
                                    >
                                        <span className="material-symbols-outlined text-[14px] text-primary shrink-0 group-hover:scale-110 transition-transform">
                                            {chip.icon}
                                        </span>
                                        <span className="truncate flex-1">{chip.text}</span>
                                        <span className="material-symbols-outlined text-[12px] text-slate-400 shrink-0">
                                            arrow_forward
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    qaMessages.map((msg) => (
                        msg.role === 'user' ? (
                            <div
                                key={msg.id}
                                className="flex flex-col gap-1 max-w-[85%] self-end group"
                            >
                                <div className="px-3.5 py-2 rounded-2xl rounded-tr-xs bg-primary text-white text-xs leading-relaxed shadow-xs">
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ) : (() => {
                            const { cleanContent, references } = parseReferences(msg.content);
                            return (
                                <div
                                    key={msg.id}
                                    className="flex items-start gap-2 max-w-[95%] self-start group w-full"
                                >
                                    <div className="w-6 h-6 rounded-md bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                                        <span className="material-symbols-outlined text-[14px]">psychology</span>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="relative px-3.5 py-2.5 rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-100 text-xs shadow-xs leading-relaxed">
                                            <MarkdownRenderer isCompact content={cleanContent} rootPath={docPath || ''} readerTheme={readerTheme} />
                                            {references.length > 0 && (
                                                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[11px]">
                                                    <div className="flex items-center gap-1 text-slate-400 font-medium">
                                                        <span className="material-symbols-outlined text-[13px] text-primary">menu_book</span>
                                                        <span>{t('tools.docs_reader.references')}:</span>
                                                    </div>
                                                    {references.map((ref) => {
                                                        const resolvedPath = folderPath ? `${folderPath.replace(/[/\\]$/, '')}/${ref.replace(/^[/\\]/, '')}` : ref;
                                                        return (
                                                            <button
                                                                key={ref}
                                                                type="button"
                                                                onClick={() => onOpenFile?.(resolvedPath)}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/70 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 text-slate-700 dark:text-slate-200 font-mono text-[10px] transition-colors cursor-pointer"
                                                                title={t('tools.docs_reader.cited_file', { file: ref })}
                                                                aria-label={t('tools.docs_reader.cited_file', { file: ref })}
                                                            >
                                                                <span className="material-symbols-outlined text-[11px]">description</span>
                                                                <span>{ref}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onCopyAnswer(cleanContent)}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-opacity cursor-pointer"
                                                title={t('tools.docs_reader.copy_answer')}
                                                aria-label={t('tools.docs_reader.copy_answer')}
                                            >
                                                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ))
                )}
            </div>

            <DocAiInput
                onSend={onSendQa}
                isGenerating={isQaGenerating}
                disabled={!isAiEnabled || !docContent.trim()}
            />
        </div>
    );
}

const DocAiDrawer = memo(function DocAiDrawer({
    isOpen,
    onClose,
    docContent,
    docPath,
    folderPath,
    isAiEnabled,
    onOpenPrivacyModal,
    providerInfo,
    onOpenFile
}: DocAiDrawerProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'summary' | 'qa'>('summary');

    // Summary state
    const [summary, setSummary] = useState<string>(() => loadFolderHistory(folderPath).summary);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
    const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);

    // Q&A state
    const [qaMessages, setQaMessages] = useState<Message[]>(() => loadFolderHistory(folderPath).qaMessages);
    const [isQaGenerating, setIsQaGenerating] = useState<boolean>(false);

    // Sync state when folderPath changes
    useEffect(() => {
        const saved = loadFolderHistory(folderPath);
        setSummary(saved.summary);
        setSummaryError(null);
        setQaMessages(saved.qaMessages);
    }, [folderPath]);

    // Clear conversation for this folder
    const handleClearChat = useCallback(() => {
        setQaMessages([]);
        if (folderPath) {
            saveFolderHistory(folderPath, { qaMessages: [], summary });
        }
    }, [folderPath, summary]);

    // Persist conversation per folder
    useEffect(() => {
        if (folderPath && (qaMessages.length > 0 || summary)) {
            saveFolderHistory(folderPath, { qaMessages, summary });
        }
    }, [folderPath, qaMessages, summary]);

    // Handle incoming streaming chunks
    useEffect(() => {
        const handleChunk = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            const { message_id } = detail;

            const isSummaryChunk = message_id?.startsWith('doc_sum') || (activeTab === 'summary' && !message_id?.startsWith('doc_qa'));
            if (isSummaryChunk) {
                handleSummaryChunk(detail, t, setSummary, setIsSummaryLoading, setSummaryError);
            } else {
                handleQaChunk(detail, t, setQaMessages, setIsQaGenerating);
            }
        };

        window.addEventListener('vylo_doc_ai_chunk', handleChunk);
        return () => window.removeEventListener('vylo_doc_ai_chunk', handleChunk);
    }, [activeTab, t]);

    const handleGenerateSummary = useCallback(async () => {
        if (!isAiEnabled || !docContent.trim() || isSummaryLoading) return;
        setSummary('');
        setSummaryError(null);
        setIsSummaryLoading(true);

        try {
            const api = (window as any).pywebview?.api;
            if (!api?.ai_doc_query) {
                setSummaryError('Backend API not available.');
                setIsSummaryLoading(false);
                return;
            }
            const res = await api.ai_doc_query('', docContent, 'summary');
            if (res?.status !== 'success') {
                setSummaryError(t(res?.message || 'backend.error.unexpected'));
                setIsSummaryLoading(false);
            }
        } catch (err: any) {
            setSummaryError(err?.message || 'Failed to start summary generation.');
            setIsSummaryLoading(false);
        }
    }, [isAiEnabled, docContent, isSummaryLoading, t]);

    const handleSendQa = useCallback(async (promptText: string) => {
        if (!isAiEnabled || !docContent.trim() || isQaGenerating) return;
        const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: promptText };
        setQaMessages((prev) => [...prev, userMsg]);
        setIsQaGenerating(true);

        try {
            const api = (window as any).pywebview?.api;
            if (!api?.ai_doc_query) {
                setQaMessages((prev) => [
                    ...prev,
                    { id: `err_${Date.now()}`, role: 'assistant', content: 'Backend API not available.' }
                ]);
                setIsQaGenerating(false);
                return;
            }
            const res = await api.ai_doc_query(promptText, docContent, 'qa', '', '', docPath || '', folderPath || '');
            if (res?.status !== 'success') {
                setQaMessages((prev) => [
                    ...prev,
                    { id: `err_${Date.now()}`, role: 'assistant', content: t(res?.message || 'backend.error.unexpected') }
                ]);
                setIsQaGenerating(false);
            }
        } catch (err: any) {
            setQaMessages((prev) => [
                ...prev,
                { id: `err_${Date.now()}`, role: 'assistant', content: err?.message || 'Failed to ask question.' }
            ]);
            setIsQaGenerating(false);
        }
    }, [isAiEnabled, docContent, isQaGenerating, t, docPath, folderPath]);

    const handleStopGeneration = useCallback(async () => {
        try {
            const api = (window as any).pywebview?.api;
            if (api?.ai_abort_doc_generation) {
                await api.ai_abort_doc_generation();
            }
        } catch {
            // ignore
        }
        setIsSummaryLoading(false);
        setIsQaGenerating(false);
    }, []);

    const handleCopySummary = useCallback(() => {
        if (!summary) return;
        navigator.clipboard.writeText(summary).then(() => {
            setIsCopiedSummary(true);
            showToast(t('tools.docs_reader.copied'), 'success');
            setTimeout(() => setIsCopiedSummary(false), 2000);
        });
    }, [showToast, summary, t]);

    const handleCopyAnswer = useCallback((content: string) => {
        if (!content) return;
        navigator.clipboard.writeText(content).then(() => {
            showToast(t('tools.docs_reader.copied'), 'success');
        });
    }, [showToast, t]);

    const isLocal = Boolean(providerInfo?.is_local);
    const readerTheme: 'light' | 'dark' = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    if (!isOpen) return null;

    return (
        <aside
            aria-label="AI Document Copilot Drawer"
            className="w-full flex-1 min-h-0 flex flex-col h-full bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-20"
        >
            {/* Unified Drawer Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                        psychology
                    </span>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                        {t('tools.docs_reader.ai_copilot')}
                    </span>
                    {isLocal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                            <span className="material-symbols-outlined text-[11px]">verified_user</span>
                            <span>{t('tools.docs_reader.privacy_local_badge')}</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shrink-0">
                            <span className="material-symbols-outlined text-[11px]">cloud</span>
                            <span>{providerInfo?.provider?.toUpperCase() || 'Cloud'}</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={onOpenPrivacyModal}
                        title={isAiEnabled ? t('tools.docs_reader.privacy_status_on') : t('tools.docs_reader.privacy_status_off')}
                        aria-label={isAiEnabled ? t('tools.docs_reader.privacy_status_on') : t('tools.docs_reader.privacy_status_off')}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isAiEnabled
                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">
                            {isAiEnabled ? 'lock_open' : 'lock'}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close Drawer"
                        aria-label="Close Drawer"
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>

            {/* If Privacy is disabled, show Guard Screen */}
            {!isAiEnabled && <PrivacyGuardScreen onOpenPrivacyModal={onOpenPrivacyModal} />}

            {/* If Privacy is enabled but no document is open */}
            {isAiEnabled && !docContent.trim() && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400 italic">
                    {t('tools.docs_reader.no_doc_open')}
                </div>
            )}

            {/* Main AI Content when active and document has content */}
            {isAiEnabled && Boolean(docContent.trim()) && (
                <>
                    {/* Segmented Control Tab Bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0 gap-2">
                        <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                            <button
                                type="button"
                                onClick={() => setActiveTab('summary')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === 'summary'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">summarize</span>
                                {t('tools.docs_reader.tab_summary')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('qa')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === 'qa'
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">chat</span>
                                {t('tools.docs_reader.tab_qa')}
                            </button>
                        </div>

                        {/* Trailing slot: Actions when on QA tab (Stop / Clear Chat) */}
                        <div className="flex items-center gap-1 shrink-0">
                            {activeTab === 'qa' && (
                                <>
                                    {isQaGenerating ? (
                                        <button
                                            type="button"
                                            onClick={handleStopGeneration}
                                            title={t('tools.docs_reader.stop_generating')}
                                            aria-label={t('tools.docs_reader.stop_generating')}
                                            className="text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                        >
                                            <span aria-hidden="true" className="material-symbols-outlined text-[13px]">stop_circle</span>
                                            <span>{t('tools.docs_reader.stop_generating')}</span>
                                        </button>
                                    ) : (
                                        qaMessages.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleClearChat}
                                                title={t('tools.docs_reader.clear_chat')}
                                                aria-label={t('tools.docs_reader.clear_chat')}
                                                className="text-[11px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                            >
                                                <span aria-hidden="true" className="material-symbols-outlined text-[13px]">delete_sweep</span>
                                                <span>{t('tools.docs_reader.clear_chat')}</span>
                                            </button>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tab 1: Summary */}
                    {activeTab === 'summary' && (
                        <DocSummaryTabView
                            summary={summary}
                            summaryError={summaryError}
                            isSummaryLoading={isSummaryLoading}
                            isCopiedSummary={isCopiedSummary}
                            docPath={docPath ?? undefined}
                            readerTheme={readerTheme}
                            onGenerateSummary={handleGenerateSummary}
                            onStopGeneration={handleStopGeneration}
                            onCopySummary={handleCopySummary}
                        />
                    )}

                    {/* Tab 2: Q&A */}
                    {activeTab === 'qa' && (
                        <DocQaTabView
                            qaMessages={qaMessages}
                            isQaGenerating={isQaGenerating}
                            docContent={docContent}
                            docPath={docPath ?? undefined}
                            folderPath={folderPath ?? undefined}
                            readerTheme={readerTheme}
                            isAiEnabled={isAiEnabled}
                            onSendQa={handleSendQa}
                            onCopyAnswer={handleCopyAnswer}
                            onOpenFile={onOpenFile}
                        />
                    )}
                </>
            )}
        </aside>
    );
});

export default DocAiDrawer;
