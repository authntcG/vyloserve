import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import AiSuggestionChips from './AiSuggestionChips';

export interface AiChatInputHandle {
    setPrompt: (text: string) => void;
    focus: () => void;
    clear: () => void;
}

export interface AiChatInputProps {
    readonly onSend: (prompt: string) => Promise<void> | void;
    readonly onStop: () => void;
    readonly isGenerating: boolean;
    readonly variant?: 'full' | 'floating';
    readonly activeProvider?: string;
    readonly activeModel?: string;
    readonly activeScreen?: string;
    readonly attachedContext: {
        readonly includeScreen?: boolean;
        readonly includeLogs: boolean;
    };
    readonly onToggleContext: (key: 'includeScreen' | 'includeLogs') => void;
    readonly suggestions?: readonly string[];
    readonly onSelectSuggestion?: (suggestion: string) => void;
    readonly className?: string;
}

function autoResizeTextarea(textarea: HTMLTextAreaElement, variant: 'full' | 'floating') {
    requestAnimationFrame(() => {
        textarea.style.height = 'auto';
        const maxHeight = variant === 'floating' ? 96 : 176;
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    });
}

interface AiChatContextBarProps {
    readonly variant: 'full' | 'floating';
    readonly attachedContext: {
        readonly includeScreen?: boolean;
        readonly includeLogs: boolean;
    };
    readonly onToggleContext: (key: 'includeScreen' | 'includeLogs') => void;
    readonly activeProvider?: string;
    readonly activeModel?: string;
    readonly activeScreen?: string;
}

function AiChatContextBar({
    variant,
    attachedContext,
    onToggleContext,
    activeProvider,
    activeModel,
    activeScreen,
}: AiChatContextBarProps) {
    const { t } = useTranslation();

    if (variant === 'full') {
        return (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        <span className="material-symbols-outlined text-[13px] text-emerald-500">check_circle</span>
                        {t('ai.context_include_status', 'Server Status Attached')}
                    </span>

                    <button
                        type="button"
                        onClick={() => onToggleContext('includeLogs')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                            attachedContext.includeLogs
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : 'bg-transparent text-slate-400 border-dashed border-slate-300 dark:border-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[13px]">
                            {attachedContext.includeLogs ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        {t('ai.context_include_logs', 'Attach Error Logs')}
                    </button>
                </div>

                {activeProvider && activeModel && (
                    <div className="text-[11px] text-slate-400 font-mono">
                        {activeProvider} &bull; {activeModel}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="px-1 py-1 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
                type="button"
                onClick={() => onToggleContext('includeScreen')}
                className={`px-2 py-0.5 rounded-md border text-[10px] flex items-center gap-1 shrink-0 transition-colors ${
                    attachedContext.includeScreen
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
            >
                <span className="material-symbols-outlined text-[12px]">
                    {attachedContext.includeScreen ? 'check' : 'add'}
                </span>
                <span>
                    {t('ai.context_active_screen', 'Context: {{screen}}', {
                        screen: activeScreen,
                    })}
                </span>
            </button>

            <button
                type="button"
                onClick={() => onToggleContext('includeLogs')}
                className={`px-2 py-0.5 rounded-md border text-[10px] flex items-center gap-1 shrink-0 transition-colors ${
                    attachedContext.includeLogs
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
            >
                <span className="material-symbols-outlined text-[12px]">
                    {attachedContext.includeLogs ? 'check' : 'add'}
                </span>
                <span>{t('ai.context_include_logs', 'Attach Error Logs')}</span>
            </button>
        </div>
    );
}

const AiChatInput = forwardRef<AiChatInputHandle, AiChatInputProps>(function AiChatInput(
    {
        onSend,
        onStop,
        isGenerating,
        variant = 'full',
        activeProvider = '',
        activeModel = '',
        activeScreen = '',
        attachedContext,
        onToggleContext,
        suggestions = [],
        onSelectSuggestion,
        className = '',
    },
    ref
) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
        setPrompt: (text: string) => {
            setPrompt(text);
            if (textareaRef.current) {
                textareaRef.current.focus();
                autoResizeTextarea(textareaRef.current, variant);
            }
        },
        focus: () => {
            textareaRef.current?.focus();
        },
        clear: () => {
            setPrompt('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        },
    }));

    const handleSend = () => {
        const text = prompt.trim();
        if (!text || isGenerating) return;

        setPrompt('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        onSend(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
        autoResizeTextarea(e.target, variant);
    };

    const handleSuggestionClick = (suggestion: string) => {
        if (onSelectSuggestion) {
            onSelectSuggestion(suggestion);
        } else {
            setPrompt(suggestion);
            if (textareaRef.current) {
                textareaRef.current.focus();
                autoResizeTextarea(textareaRef.current, variant);
            }
        }
    };

    const inputId = variant === 'floating' ? 'ai-floating-prompt-input' : 'ai-full-prompt-input';

    return (
        <div className={`flex flex-col gap-2 shrink-0 ${className}`}>
            {/* DYNAMIC FOLLOW-UP SUGGESTIONS */}
            {!isGenerating && suggestions && suggestions.length > 0 && (
                <AiSuggestionChips
                    suggestions={suggestions}
                    onSelectSuggestion={handleSuggestionClick}
                    disabled={isGenerating}
                />
            )}

            {/* CONTEXT CHIPS TOOLBAR */}
            <AiChatContextBar
                variant={variant}
                attachedContext={attachedContext}
                onToggleContext={onToggleContext}
                activeProvider={activeProvider}
                activeModel={activeModel}
                activeScreen={activeScreen}
            />

            {/* INPUT FORM CONTAINER */}
            <div
                className={
                    variant === 'full'
                        ? 'relative flex items-center gap-2 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2 shadow-inner focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all'
                        : 'flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl p-1.5 border border-slate-200 dark:border-slate-700/80 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all'
                }
            >
                <label htmlFor={inputId} className="sr-only">
                    {t('ai.input_placeholder', 'Prompt')}
                </label>
                <textarea
                    ref={textareaRef}
                    id={inputId}
                    rows={1}
                    value={prompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t('ai.input_placeholder', 'Ask anything about server configs, errors, or code...')}
                    className={
                        variant === 'full'
                            ? 'flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 max-h-44 py-1.5 px-2 leading-normal m-0'
                            : 'flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none max-h-24 px-2 py-1 leading-normal m-0'
                    }
                />

                {isGenerating ? (
                    <Button
                        variant="danger"
                        size={variant === 'full' ? 'sm' : 'icon'}
                        icon={variant === 'full' ? 'stop_circle' : 'stop'}
                        onClick={onStop}
                        title={t('ai.stop', 'Stop')}
                        aria-label={t('ai.stop', 'Stop')}
                        className={variant === 'full' ? 'h-9 px-3 shrink-0 shadow-xs' : 'p-1.5 rounded-lg shrink-0'}
                    >
                        {variant === 'full' && <span>{t('ai.stop', 'Stop')}</span>}
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        size="icon"
                        icon="send"
                        onClick={handleSend}
                        disabled={!prompt.trim()}
                        title={t('ai.send', 'Send')}
                        aria-label={t('ai.send', 'Send')}
                        className={variant === 'full' ? 'h-9 w-9 shrink-0 shadow-xs' : 'p-1.5 rounded-lg shrink-0'}
                    />
                )}
            </div>
        </div>
    );
});

export default React.memo(AiChatInput);
