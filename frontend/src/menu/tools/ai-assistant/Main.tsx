import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiAssistant } from '../../../context/AiContext';
import { useNetworkStatus } from '../../../context/NetworkContext';
import PageHeader from '../../../components/PageHeader';
import OfflineBanner from '../../../components/OfflineBanner';
import AiChatMessage, { extractVyloSuggestions } from './components/AiChatMessage';
import AiChatInput, { type AiChatInputHandle } from './components/AiChatInput';
import AiUsageBadge from './components/AiUsageBadge';
import Select from '../../../components/Select';
import Button from '../../../components/Button';
import InfoBox from '../../../components/InfoBox';
import SkeletonChatMessage from '../../../components/skeleton/SkeletonChatMessage';

interface AiAssistantMainProps {
    readonly isActive?: boolean;
}

export default function AiAssistantMain({ isActive = true }: AiAssistantMainProps) {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const {
        messages,
        isGenerating,
        streamingText,
        activeProvider,
        activeModel,
        hasApiKey,
        availableModels,
        isLoadingModels,
        fetchAvailableModels,
        attachedContext,
        sendMessage,
        stopGenerating,
        clearChat,
        setActiveModel,
        setAttachedContext,
        openAiSettings,
    } = useAiAssistant();

    const chatScrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<AiChatInputHandle>(null);

    const lastAssistantMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                return messages[i];
            }
        }
        return null;
    }, [messages]);

    const dynamicSuggestions = useMemo(() => {
        if (!lastAssistantMessage?.content) return [];
        const { suggestions } = extractVyloSuggestions(lastAssistantMessage.content, false);
        return suggestions;
    }, [lastAssistantMessage]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (chatScrollRef.current) {
            if (typeof chatScrollRef.current.scrollTo === 'function') {
                chatScrollRef.current.scrollTo({
                    top: chatScrollRef.current.scrollHeight,
                    behavior,
                });
            } else {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }
        if (messagesEndRef.current?.scrollIntoView) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        }
    }, []);

    // Auto-scroll instan ke bawah saat menu AI Assistant dibuka / aktif
    useEffect(() => {
        if (isActive) {
            const timer = window.setTimeout(() => {
                scrollToBottom('auto');
                inputRef.current?.focus();
            }, 50);
            return () => window.clearTimeout(timer);
        }
    }, [isActive, scrollToBottom]);

    // Auto-scroll saat ada pesan baru atau streaming text berubah saat aktif
    useEffect(() => {
        if (!isActive) return;
        if (streamingText) {
            // Scroll instan saat streaming chunk tiba agar tidak terjadi penumpukan animasi jitter
            scrollToBottom('auto');
        } else if (messages.length > 0 || isGenerating) {
            // Scroll halus untuk respon yang sudah selesai atau pesan user baru
            scrollToBottom('smooth');
        }
    }, [messages, streamingText, isGenerating, isActive, scrollToBottom]);

    const handleQuickPrompt = (prompt: string) => {
        inputRef.current?.setPrompt(prompt);
        inputRef.current?.focus();
    };

    const handleToggleContext = (key: 'includeScreen' | 'includeLogs') => {
        setAttachedContext((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleOpenSettings = () => {
        openAiSettings();
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full h-full min-h-[500px]">
            {/* PAGE HEADER */}
            <PageHeader
                icon="smart_toy"
                title={t('ai.title', 'AI Assistant')}
                subtitle={t('ai.subtitle', 'Your local server developer copilot')}
                actions={
                    <div className="flex items-center gap-2">
                        {/* Dynamic Model Switcher Dropdown using Select size="sm" */}
                        <div className="flex items-center gap-1.5 w-64">
                            <label htmlFor="ai-header-model-select" className="sr-only">
                                {t('ai.model', 'Model')}
                            </label>
                            <div className="flex-1 min-w-0">
                                <Select
                                    id="ai-header-model-select"
                                    size="sm"
                                    value={activeModel}
                                    onChange={setActiveModel}
                                    options={availableModels}
                                    searchable={false}
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                icon="sync"
                                loading={isLoadingModels}
                                disabled={isLoadingModels}
                                onClick={() => fetchAvailableModels()}
                                title={t('ai.refresh_models', 'Refresh model list')}
                                aria-label={t('common.refresh', 'Refresh')}
                                className="h-9 w-9 p-0 flex items-center justify-center rounded-lg shrink-0"
                            />
                        </div>

                        {/* Token Usage Badge */}
                        <AiUsageBadge />

                        {/* New Chat Button using Button */}
                        <Button
                            variant="secondary"
                            size="md"
                            icon="add"
                            onClick={clearChat}
                            title={t('ai.clear_chat', 'New Chat')}
                            className="shadow-xs h-9 px-3.5 flex items-center gap-1.5 text-xs font-medium shrink-0"
                        >
                            <span>{t('ai.clear_chat', 'New Chat')}</span>
                        </Button>

                        {/* Settings Button using Button */}
                        <Button
                            variant="secondary"
                            size="icon"
                            icon="settings"
                            onClick={handleOpenSettings}
                            title={t('settings.settings', 'Settings')}
                            aria-label={t('settings.settings', 'Settings')}
                            className="shadow-xs h-9 w-9 p-0 flex items-center justify-center rounded-lg shrink-0"
                        />
                    </div>
                }
            />

            {/* OFFLINE CLOUD PROVIDER WARNING BANNER */}
            {!isOnline && activeProvider !== 'ollama' && (
                <div className="mb-4 shrink-0">
                    <OfflineBanner
                        description={t('ai.offline_cloud_desc', { provider: activeProvider })}
                        actionButton={
                            <Button
                                variant="primary"
                                size="sm"
                                icon="settings"
                                onClick={handleOpenSettings}
                                className="shrink-0 text-xs px-2.5 py-1.5"
                            >
                                {t('ai.switch_to_ollama')}
                            </Button>
                        }
                    />
                </div>
            )}

            {/* API KEY WARNING BANNER using InfoBox */}
            {!hasApiKey && activeProvider !== 'ollama' && (
                <div className="mb-4 shrink-0">
                    <InfoBox tone="warning" icon="warning">
                        <div className="flex items-center justify-between gap-3 w-full">
                            <span>{t('ai.no_key_warning', 'No API Key configured. Please go to Settings > AI Assistant to configure your free key.')}</span>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleOpenSettings}
                                className="shrink-0"
                            >
                                {t('ai.configure_key', 'Settings')}
                            </Button>
                        </div>
                    </InfoBox>
                </div>
            )}

            {/* MAIN CHAT CONTAINER */}
            <div className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl bg-white dark:bg-slate-900/90">
                {/* MESSAGES SCROLL AREA */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 min-h-0 custom-scrollbar">
                    {messages.length === 0 && !isGenerating ? (
                        /* EMPTY STATE WITH QUICK PROMPTS */
                        <div className="h-full flex flex-col items-center justify-center p-4 md:p-8">
                            <div className="w-full max-w-3xl rounded-2xl p-6 md:p-8 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-center flex flex-col items-center gap-4 shadow-2xs">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shadow-xs">
                                    <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                                </div>
                                <div className="flex flex-col gap-1.5 max-w-lg">
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                        {t('ai.title', 'AI Assistant')}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {t('ai.subtitle', 'Your local server developer copilot')} &mdash;{' '}
                                        {t(
                                            'settings.ai_auto_context_desc',
                                            'Automatically provide active module info to AI'
                                        )}
                                    </p>
                                </div>

                                {/* QUICK PROMPT SUGGESTIONS */}
                                <div className="w-full flex flex-col gap-2.5 pt-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-left px-0.5">
                                        {t('ai.quick_prompts', 'Quick Questions')}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                                        <button
                                            type="button"
                                            onClick={() => handleQuickPrompt(t('ai.quick_prompt_logs', 'Analyze recent error logs'))}
                                            className="p-3.5 text-left rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 hover:border-primary/50 dark:hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex flex-col justify-between gap-3 group cursor-pointer shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">bug_report</span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                                    {t('ai.quick_prompt_logs', 'Analyze recent error logs')}
                                                </span>
                                            </div>
                                            <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-[transform,colors] self-end">
                                                arrow_forward
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickPrompt(t('ai.quick_prompt_vhost', 'How to create an Apache VirtualHost?'))}
                                            className="p-3.5 text-left rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 hover:border-primary/50 dark:hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex flex-col justify-between gap-3 group cursor-pointer shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">dns</span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                                    {t('ai.quick_prompt_vhost', 'How to create an Apache VirtualHost?')}
                                                </span>
                                            </div>
                                            <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-[transform,colors] self-end">
                                                arrow_forward
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickPrompt(t('ai.quick_prompt_php', 'Recommended php.ini settings for development'))}
                                            className="p-3.5 text-left rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 hover:border-primary/50 dark:hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex flex-col justify-between gap-3 group cursor-pointer shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">settings_suggest</span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                                    {t('ai.quick_prompt_php', 'Recommended php.ini settings for development')}
                                                </span>
                                            </div>
                                            <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-[transform,colors] self-end">
                                                arrow_forward
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* CHAT MESSAGES */
                        <>
                            {messages.map((msg) => (
                                <AiChatMessage key={msg.id} message={msg} />
                            ))}

                            {/* STREAMING CHUNK PLACEHOLDER */}
                            {isGenerating && streamingText && (
                                <AiChatMessage
                                    message={{
                                        id: 'streaming-preview',
                                        role: 'assistant',
                                        content: streamingText,
                                        model: activeModel,
                                        provider: activeProvider,
                                        timestamp: Date.now(),
                                    }}
                                    isStreaming={true}
                                />
                            )}

                            {/* GENERATING LOADING INDICATOR */}
                            {isGenerating && !streamingText && (
                                <SkeletonChatMessage />
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* BOTTOM COMPOSER AREA */}
                <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
                    <AiChatInput
                        ref={inputRef}
                        variant="full"
                        onSend={(text) => sendMessage(text, 'ai-assistant')}
                        onStop={stopGenerating}
                        isGenerating={isGenerating}
                        disabled={!isOnline && activeProvider !== 'ollama'}
                        activeProvider={activeProvider}
                        activeModel={activeModel}
                        attachedContext={attachedContext}
                        onToggleContext={handleToggleContext}
                        suggestions={dynamicSuggestions}
                    />
                </div>
            </div>
        </div>
    );
}
