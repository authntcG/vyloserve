import { useState, isValidElement, memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import type { AiMessage } from '../../../../context/AiContext';
import AiActionCard, { type VyloActionPayload } from './AiActionCard';

const REMARK_PLUGINS = [remarkGfm];

export function extractVyloSuggestions(content: string, isStreaming: boolean = false): { cleanContent: string; suggestions: string[] } {
    const suggestionRegex = /```vylo_suggestions\b([\s\S]*?)```/g;
    const suggestions: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = suggestionRegex.exec(content)) !== null) {
        try {
            const raw = JSON.parse(match[1]);
            const items = Array.isArray(raw) ? raw : [raw];
            for (const item of items) {
                if (typeof item === 'string' && item.trim()) {
                    suggestions.push(item.trim());
                }
            }
        } catch {
            // Ignore malformed JSON during streaming
        }
    }

    let clean = content.replace(suggestionRegex, '').trim();
    if (isStreaming && clean.includes('```vylo_suggestions')) {
        clean = clean.split('```vylo_suggestions')[0].trim();
    }
    return { cleanContent: clean, suggestions };
}

export function extractVyloActions(content: string, isStreaming: boolean = false): { cleanContent: string; actions: VyloActionPayload[] } {
    const actionRegex = /```vylo_action\b([\s\S]*?)```/g;
    const actions: VyloActionPayload[] = [];
    let match: RegExpExecArray | null;

    while ((match = actionRegex.exec(content)) !== null) {
        try {
            const raw = JSON.parse(match[1]);
            const items = Array.isArray(raw) ? raw : [raw];
            for (const parsed of items) {
                if (
                    parsed &&
                    typeof parsed === 'object' &&
                    ['apache', 'php', 'database'].includes(parsed.service) &&
                    ['start', 'stop', 'restart', 'switch_version', 'start_all', 'stop_all'].includes(parsed.action)
                ) {
                    actions.push(parsed as VyloActionPayload);
                }
            }
        } catch {
            // Ignore malformed JSON
        }
    }

    let clean = content.replace(actionRegex, '').trim();
    if (isStreaming && clean.includes('```vylo_action')) {
        clean = clean.split('```vylo_action')[0].trim();
    }
    return { cleanContent: clean, actions };
}

function extractNodeText(node: ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractNodeText).join('');
    if (isValidElement(node) && (node.props as any)?.children) {
        return extractNodeText((node.props as any).children);
    }
    return '';
}

interface CodeBlockProps {
    readonly inline?: boolean;
    readonly className?: string;
    readonly children?: React.ReactNode;
    readonly [key: string]: any;
}

function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
    const { t } = useTranslation();
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : '';
    const codeContent = extractNodeText(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (!inline && (match || codeContent.includes('\n'))) {
        return (
            <div className="my-2.5 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 shadow-sm text-xs">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-slate-400 text-[11px] font-mono">
                    <span>{lang || 'code'}</span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[13px]">
                            {isCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isCopied ? t('ai.copied', 'Copied!') : t('ai.copy', 'Copy')}</span>
                    </button>
                </div>
                <pre className="p-3 overflow-x-auto text-slate-100 font-mono text-xs leading-relaxed m-0">
                    <code>{children}</code>
                </pre>
            </div>
        );
    }

    return (
        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-primary font-mono text-xs font-semibold" {...props}>
            {children}
        </code>
    );
}

interface MarkdownLinkProps {
    readonly href?: string;
    readonly children?: React.ReactNode;
    readonly [key: string]: any;
}

function MarkdownLink({ href, children, ...props }: MarkdownLinkProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline font-medium"
            {...props}
        >
            {children}
        </a>
    );
}

const MARKDOWN_COMPONENTS = {
    code: CodeBlock,
    a: MarkdownLink,
};

const SOURCE_ICONS: Record<string, string> = {
    doc: 'menu_book',
    system: 'dns',
};

interface AiChatMessageProps {
    readonly message: AiMessage;
    readonly isStreaming?: boolean;
}

export function AiChatMessage({ message, isStreaming = false }: AiChatMessageProps) {
    const { t } = useTranslation();
    const [isMessageCopied, setIsMessageCopied] = useState(false);
    const [isContextCopied, setIsContextCopied] = useState(false);
    const [showContext, setShowContext] = useState(false);

    const isUser = message.role === 'user';
    const { cleanContent: contentWithoutActions, actions } = extractVyloActions(message.content || '', isStreaming);
    const { cleanContent } = extractVyloSuggestions(contentWithoutActions, isStreaming);

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsMessageCopied(true);
        setTimeout(() => setIsMessageCopied(false), 2000);
    };

    const handleCopyContext = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsContextCopied(true);
        setTimeout(() => setIsContextCopied(false), 2000);
    };

    if (isUser) {
        return (
            <div className="flex flex-col items-end mb-4 group w-full max-w-full min-w-0">
                <div className="max-w-[85%] md:max-w-[75%] rounded-2xl rounded-tr-xs px-4 py-3 bg-primary text-white shadow-sm border border-primary/20 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                </div>

                {message.context && (
                    <div className="mt-1.5 flex flex-col items-end w-full max-w-full min-w-0 text-xs">
                        <button
                            type="button"
                            onClick={() => setShowContext(!showContext)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer text-[11px] font-medium border border-slate-200/80 dark:border-slate-700/60"
                        >
                            <span className="material-symbols-outlined text-[14px] text-primary">info</span>
                            <span>{showContext ? t('ai.context_hide', 'Hide Context') : t('ai.context_attached', 'Context Attached')}</span>
                            <span className="material-symbols-outlined text-[14px] text-slate-400">
                                {showContext ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>

                        {showContext && (
                            <div className="mt-2 w-full max-w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-xs text-left animate-in fade-in duration-150 box-border">
                                <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                                        <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
                                        <span>{t('ai.context_title', 'Attached Server Context')}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyContext(message.context || '')}
                                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary transition-colors cursor-pointer"
                                        title={t('ai.copy_context', 'Copy Context')}
                                    >
                                        <span className="material-symbols-outlined text-[13px]">
                                            {isContextCopied ? 'check' : 'content_copy'}
                                        </span>
                                        <span>{isContextCopied ? t('ai.copied', 'Copied!') : t('ai.copy', 'Copy')}</span>
                                    </button>
                                </div>
                                <pre className="p-3 text-[10px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed max-h-44 overflow-y-auto overflow-x-auto select-text m-0 box-border">
                                    <code>{message.context}</code>
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Assistant Message
    return (
        <div className="flex items-start gap-3 mb-5 group">
            {/* Avatar */}
            <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center text-primary mt-0.5">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            </div>

            {/* Bubble Container */}
            <div className="flex-1 min-w-0">
                <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-100 shadow-xs text-sm leading-relaxed">
                    {message.error ? (
                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                            <span>{message.error}</span>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert prose-sm max-w-none break-words">
                            <ReactMarkdown
                                remarkPlugins={REMARK_PLUGINS}
                                components={MARKDOWN_COMPONENTS}
                            >
                                {cleanContent}
                            </ReactMarkdown>
                            {isStreaming && (
                                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                            )}
                        </div>
                    )}

                    {/* Proposed Operational Actions (Human-in-the-Loop) */}
                    {!message.error && actions.length > 0 && (
                        <div className="mt-2.5 flex flex-col gap-2">
                            {actions.length > 1 && (
                                <div className="flex items-center gap-1.5 px-1 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                                    <span className="material-symbols-outlined text-[14px] text-primary">playlist_play</span>
                                    <span>{t('ai.action_multiple_title', 'Proposed System Actions ({{count}})', { count: actions.length })}</span>
                                </div>
                            )}
                            {actions.map((act, idx) => {
                                const actionKey = `action_${message.id}_${act.service}_${act.action}_${act.target || ''}_${idx}`;
                                return (
                                    <AiActionCard
                                        key={actionKey}
                                        actionKey={actionKey}
                                        action={act}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Data Source Citations */}
                    {!message.error && message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px] uppercase tracking-wider flex items-center gap-1 mr-0.5">
                                <span className="material-symbols-outlined text-[13px]">menu_book</span>
                                {t('ai.sources_label', 'Sources')}:
                            </span>
                            {message.sources.map((src, idx) => {
                                const iconName = SOURCE_ICONS[src.type] ?? 'article';
                                return (
                                    <span
                                        key={`${src.type}_${idx}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600/60 text-[10.5px] font-medium shadow-2xs"
                                        title={src.label}
                                    >
                                        <span className="material-symbols-outlined text-[12px] text-primary shrink-0">{iconName}</span>
                                        <span className="truncate max-w-[200px]">{src.label}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Message Actions */}
                {!isStreaming && cleanContent && (
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 pl-1">
                        {message.model && (
                            <span className="font-mono text-[10px] text-slate-400/80">
                                {message.model}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => handleCopyMessage(cleanContent)}
                            className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[13px]">
                                {isMessageCopied ? 'check' : 'content_copy'}
                            </span>
                            <span>{isMessageCopied ? t('ai.copied', 'Copied!') : t('ai.copy', 'Copy')}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function areAiChatMessagePropsEqual(prev: AiChatMessageProps, next: AiChatMessageProps): boolean {
    if (prev.isStreaming !== next.isStreaming) return false;
    const pm = prev.message;
    const nm = next.message;
    return (
        pm.id === nm.id &&
        pm.content === nm.content &&
        pm.error === nm.error &&
        pm.model === nm.model &&
        pm.provider === nm.provider &&
        pm.timestamp === nm.timestamp &&
        pm.context === nm.context
    );
}

export default memo(AiChatMessage, areAiChatMessagePropsEqual);
