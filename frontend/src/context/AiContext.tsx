import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useAlert } from './AlertContext';

export interface AiSource {
    type: 'doc' | 'system' | 'log';
    label: string;
    id?: string;
}

export interface AiMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    provider?: string;
    timestamp: number;
    context?: string;
    error?: string;
    sources?: AiSource[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface AiTokenUsageData {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    requests: number;
}

export interface AiUsageStats {
    today: AiTokenUsageData;
    week: AiTokenUsageData;
    all_time?: {
        total_tokens: number;
        requests: number;
    };
    rate_limits?: Record<string, any>;
    active_provider?: string;
}

export interface AttachedContextState {
    includeScreen: boolean;
    includeLogs: boolean;
}

export interface ActionExecutionState {
    status: 'proposed' | 'executing' | 'success' | 'failed' | 'cancelled';
    message?: string;
}

export interface ModelOption {
    value: string;
    label: string;
}

export const PROVIDER_MODELS: Record<string, ModelOption[]> = {
    gemini: [
        { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Fast & Recommended)' },
        { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Latest Flagship)' },
        { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
        { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
    ],
    groq: [
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recommended)' },
        { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
        { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B' },
    ],
    openrouter: [
        { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Free' },
        { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash Free' },
        { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Free' },
        { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Free' },
    ],
    ollama: [
        { value: 'llama3.2', label: 'Llama 3.2' },
        { value: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
        { value: 'deepseek-r1', label: 'DeepSeek R1' },
        { value: 'phi4', label: 'Phi 4' },
    ],
};

interface AiContextValue {
    messages: AiMessage[];
    isGenerating: boolean;
    streamingText: string;
    isFloatingOpen: boolean;
    floatingPosition: { x: number; y: number };
    enableAi: boolean;
    enableFloating: boolean;
    activeProvider: string;
    activeModel: string;
    hasApiKey: boolean;
    availableModels: ModelOption[];
    isLoadingModels: boolean;
    accountTier: string;
    isCheckingTier: boolean;
    detectAccountTier: (prov?: string, key?: string, url?: string) => Promise<any>;
    fetchAvailableModels: (prov?: string, key?: string, url?: string, silent?: boolean, tier?: string) => Promise<ModelOption[]>;
    attachedContext: AttachedContextState;
    sendMessage: (prompt: string, activeScreen?: string) => Promise<void>;
    stopGenerating: () => void;
    clearChat: () => Promise<void>;
    toggleFloatingOpen: () => void;
    setFloatingOpen: (open: boolean) => void;
    setFloatingPosition: (pos: { x: number; y: number }) => void;
    setActiveModel: (model: string) => Promise<void>;
    setAttachedContext: React.Dispatch<React.SetStateAction<AttachedContextState>>;
    actionStates: Record<string, ActionExecutionState>;
    setActionState: (key: string, state: ActionExecutionState) => void;
    usageStats: AiUsageStats | null;
    refreshUsageStats: () => Promise<void>;
    resetUsageStats: () => Promise<void>;
}

const AiContext = createContext<AiContextValue | undefined>(undefined);

export function AiProvider({ children }: { readonly children: React.ReactNode }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();

    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const streamingTextRef = useRef('');

    const [isFloatingOpen, setIsFloatingOpen] = useState(false);
    const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem('vylo_ai_floating_pos');
            if (saved) return JSON.parse(saved);
        } catch {
            // Ignore corrupted localStorage data and fallback to default position
        }
        return { x: window.innerWidth - 80, y: window.innerHeight - 100 };
    });

    const [enableAi, setEnableAi] = useState(true);
    const [enableFloating, setEnableFloating] = useState(true);
    const [activeProvider, setActiveProvider] = useState('gemini');
    const [currentModel, setCurrentModel] = useState('gemini-3.5-flash-lite');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelOption[]>(() => PROVIDER_MODELS['gemini'] || []);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [accountTier, setAccountTier] = useState<string>('unknown');
    const [isCheckingTier, setIsCheckingTier] = useState(false);
    const [usageStats, setUsageStats] = useState<AiUsageStats | null>(null);

    const apiKeyRef = useRef('');
    const baseUrlRef = useRef('http://localhost:11434/v1');
    const modelsCacheRef = useRef<Record<string, ModelOption[]>>({});
    const activeMsgIdRef = useRef<string | null>(null);
    const activeProviderRef = useRef('gemini');
    const activeModelRef = useRef('gemini-3.5-flash-lite');

    const [attachedContext, setAttachedContext] = useState<AttachedContextState>({
        includeScreen: true,
        includeLogs: false,
    });

    const [actionStates, setActionStates] = useState<Record<string, ActionExecutionState>>(() => {
        try {
            const saved = localStorage.getItem('vylo_ai_action_states');
            if (saved) return JSON.parse(saved);
        } catch {
            // Ignore localStorage errors and fallback to empty state
        }
        return {};
    });

    const refreshUsageStats = useCallback(async () => {
        const api = (window as any).pywebview?.api;
        if (!api?.ai_get_usage_stats) return;
        try {
            const res = await api.ai_get_usage_stats(activeProviderRef.current);
            if (res?.status === 'success' && res.data) {
                setUsageStats(res.data);
            }
        } catch {
            // Best-effort stats refresh; ignore network/IPC failure
        }
    }, []);

    const resetUsageStats = useCallback(async () => {
        const ok = await confirm({
            title: t('ai.reset_usage', 'Reset Usage'),
            message: t('ai.reset_usage_confirm', 'Are you sure you want to reset token usage statistics?'),
            type: 'warning',
            confirmText: t('common.confirm', 'Confirm'),
            cancelText: t('common.cancel', 'Cancel'),
        });
        if (!ok) return;

        const api = (window as any).pywebview?.api;
        if (!api?.ai_reset_usage_stats) return;
        try {
            const res = await api.ai_reset_usage_stats();
            if (res?.status === 'success') {
                showToast(t(res.message || 'backend.ai.usage_reset_success'), 'success');
                await refreshUsageStats();
            }
        } catch (err: any) {
            showToast(String(err), 'error');
        }
    }, [confirm, refreshUsageStats, showToast, t]);

    const setActionState = useCallback((key: string, state: ActionExecutionState) => {
        setActionStates((prev) => {
            const updated = { ...prev, [key]: state };
            try {
                localStorage.setItem('vylo_ai_action_states', JSON.stringify(updated));
            } catch {
                // Best-effort persistence; ignore storage quota errors
            }
            const api = (window as any).pywebview?.api;
            if (api?.ai_save_action_states) {
                api.ai_save_action_states(updated).catch(() => {});
            }
            return updated;
        });
    }, []);

    const detectAccountTier = useCallback(async (
        prov?: string,
        key?: string,
        url?: string
    ) => {
        const targetProv = prov || activeProviderRef.current;
        const targetKey = key ?? apiKeyRef.current;
        const targetUrl = url ?? baseUrlRef.current;

        const api = (window as any).pywebview?.api;
        if (!api?.ai_detect_account_tier) {
            return { status: 'error', tier: 'unknown', is_pro: false };
        }

        if (targetProv !== 'ollama' && !targetKey?.trim()) {
            setAccountTier('unknown');
            return { status: 'error', tier: 'invalid', is_pro: false, message: 'backend.ai.key_missing' };
        }

        setIsCheckingTier(true);
        try {
            const res = await api.ai_detect_account_tier(targetProv, targetKey, targetUrl);
            if (res?.status === 'success') {
                const tier = res.tier || (res.is_pro ? 'pro' : 'free');
                setAccountTier(tier);
                return res;
            } else {
                const tier = res?.tier || 'invalid';
                setAccountTier(tier);
                return res;
            }
        } catch (err: any) {
            setAccountTier('invalid');
            return { status: 'error', tier: 'invalid', is_pro: false, message: String(err) };
        } finally {
            setIsCheckingTier(false);
        }
    }, []);

    const handleFetchModelsFailure = useCallback((
        targetProv: string,
        fallback: ModelOption[],
        res?: any,
        err?: any,
        silent: boolean = false
    ) => {
        if (res?.tier) {
            setAccountTier(res.tier);
        }
        if (!silent) {
            const msg = err ? String(err) : (t(res?.message || 'backend.ai.fetch_models_failed', res?.args || {}) as string);
            showToast(msg, 'error');
        }
        const cached = modelsCacheRef.current[targetProv] || fallback;
        setAvailableModels(cached);
        return cached;
    }, [showToast, t]);

    const fetchAvailableModels = useCallback(async (
        prov?: string,
        key?: string,
        url?: string,
        silent: boolean = false,
        tier?: string
    ): Promise<ModelOption[]> => {
        const targetProv = prov || activeProviderRef.current;
        const targetKey = key ?? apiKeyRef.current;
        const targetUrl = url ?? baseUrlRef.current;

        const fallback = PROVIDER_MODELS[targetProv] || [{ value: activeModelRef.current, label: activeModelRef.current }];

        const api = (window as any).pywebview?.api;
        if (!api?.ai_get_available_models) {
            setAvailableModels(fallback);
            return fallback;
        }

        if (targetProv !== 'ollama' && targetProv !== 'openrouter' && !targetKey?.trim()) {
            setAvailableModels(fallback);
            setAccountTier('unknown');
            return fallback;
        }

        setIsLoadingModels(true);
        try {
            const res = await api.ai_get_available_models(targetProv, targetKey, targetUrl, tier || '');
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                modelsCacheRef.current[targetProv] = res.data;
                setAvailableModels(res.data);
                if (res.tier) {
                    setAccountTier(res.tier);
                }
                if (!silent) {
                    showToast(t('ai.models_refreshed', 'Model list updated successfully.'), 'success');
                }
                return res.data;
            }
            return handleFetchModelsFailure(targetProv, fallback, res, undefined, silent);
        } catch (err: any) {
            return handleFetchModelsFailure(targetProv, fallback, undefined, err, silent);
        } finally {
            setIsLoadingModels(false);
        }
    }, [handleFetchModelsFailure, showToast, t]);

    const applySettingsData = useCallback((d: any) => {
        if (!d) return;
        if (typeof d.enable_ai_assistant === 'boolean') setEnableAi(d.enable_ai_assistant);
        if (typeof d.enable_floating_ai === 'boolean') setEnableFloating(d.enable_floating_ai);
        const prov = d.ai_provider || 'gemini';
        if (d.ai_provider) {
            setActiveProvider(prov);
            activeProviderRef.current = prov;
        }
        let m = d.ai_model || 'gemini-3.5-flash-lite';
        if (prov === 'gemini' && (m === 'gemini-2.0-flash' || m === 'gemini-1.5-flash' || m === 'gemini-1.5-pro' || m === 'gemini-2.5-flash')) {
            m = 'gemini-3.5-flash-lite';
        }
        setCurrentModel(m);
        activeModelRef.current = m;
        if (d.ai_api_key !== undefined) {
            apiKeyRef.current = d.ai_api_key || '';
            setHasApiKey(prov === 'ollama' || Boolean(d.ai_api_key?.trim()));
        }
        if (d.ai_base_url !== undefined) {
            baseUrlRef.current = d.ai_base_url || 'http://localhost:11434/v1';
        }
    }, []);

    const loadHistory = useCallback(() => {
        const api = (window as any).pywebview?.api;
        if (!api) return;

        if (api.ai_get_chat_history) {
            api.ai_get_chat_history().then((res: any) => {
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    setMessages(res.data);
                }
            }).catch(() => {});
        }

        if (api.ai_get_action_states) {
            api.ai_get_action_states().then((res: any) => {
                if (res?.status === 'success' && res.data && typeof res.data === 'object') {
                    setActionStates((prev) => {
                        const merged = { ...res.data, ...prev };
                        try {
                            if (Object.keys(merged).length > 0) {
                                localStorage.setItem('vylo_ai_action_states', JSON.stringify(merged));
                            } else {
                                localStorage.removeItem('vylo_ai_action_states');
                            }
                        } catch {
                            // Ignore localStorage quota or access errors
                        }
                        return merged;
                    });
                }
            }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        const cached = modelsCacheRef.current[activeProvider];
        if (cached && cached.length > 0) {
            setAvailableModels(cached);
        } else {
            setAvailableModels(PROVIDER_MODELS[activeProvider] || [{ value: currentModel, label: currentModel }]);
            if (hasApiKey || activeProvider === 'ollama' || activeProvider === 'openrouter') {
                fetchAvailableModels(activeProvider, undefined, undefined, true);
            }
        }
        refreshUsageStats();
    }, [activeProvider, hasApiKey, fetchAvailableModels, currentModel, refreshUsageStats]);

    useEffect(() => {
        loadHistory();
        refreshUsageStats();

        const handleAiSettings = (e: Event) => {
            applySettingsData((e as CustomEvent).detail);
        };
        const handleHistoryCleared = () => {
            setMessages([]);
            setStreamingText('');
            streamingTextRef.current = '';
            setActionStates({});
            try {
                localStorage.removeItem('vylo_ai_action_states');
            } catch (_) {}
        };

        window.addEventListener('vylo_ai_settings_changed', handleAiSettings);
        window.addEventListener('vylo_ai_history_cleared', handleHistoryCleared);

        const handleChunk = (e: Event) => {
            const ce = e as CustomEvent;
            const { chunk, is_done, error, message_id, sources, usage } = ce.detail || {};

            if (chunk) {
                streamingTextRef.current += chunk;
                setStreamingText(streamingTextRef.current);
            }

            if (is_done) {
                setIsGenerating(false);
                const finalContent = streamingTextRef.current;
                const targetId = message_id || activeMsgIdRef.current || `ai_${Date.now()}`;
                const chunkSources: AiSource[] = Array.isArray(sources) ? sources : [];

                if (finalContent || error) {
                    setMessages((prev) => {
                        const exists = prev.some((m) => m.id === targetId);
                        if (exists) {
                            return prev.map((m) =>
                                m.id === targetId ? {
                                    ...m,
                                    content: finalContent,
                                    error,
                                    sources: chunkSources.length > 0 ? chunkSources : m.sources,
                                    usage: usage || m.usage,
                                } : m
                            );
                        }
                        return [
                            ...prev,
                            {
                                id: targetId,
                                role: 'assistant',
                                content: finalContent,
                                timestamp: Date.now(),
                                error,
                                sources: chunkSources,
                                usage,
                            },
                        ];
                    });
                }

                setStreamingText('');
                streamingTextRef.current = '';
                activeMsgIdRef.current = null;
                refreshUsageStats();

                if (error && error !== 'backend.ai.aborted') {
                    showToast(t(error) || error, 'error');
                }
            }
        };

        window.addEventListener('vylo_ai_chunk', handleChunk);

        return () => {
            window.removeEventListener('vylo_ai_chunk', handleChunk);
            window.removeEventListener('vylo_ai_settings_changed', handleAiSettings);
            window.removeEventListener('vylo_ai_history_cleared', handleHistoryCleared);
        };
    }, [applySettingsData, loadHistory, refreshUsageStats, showToast, t]);

    const updateFloatingPosition = (pos: { x: number; y: number }) => {
        setFloatingPosition(pos);
        try {
            localStorage.setItem('vylo_ai_floating_pos', JSON.stringify(pos));
        } catch {
            // Ignore localStorage errors
        }
    };

    const setActiveModel = async (newModel: string) => {
        setCurrentModel(newModel);
        const api = (window as any).pywebview?.api;
        if (api?.save_app_settings) {
            await api.save_app_settings({ ai_model: newModel });
        }
    };

    const stopGenerating = () => {
        const api = (window as any).pywebview?.api;
        if (api?.ai_abort_generation) {
            api.ai_abort_generation();
        }
        setIsGenerating(false);
    };

    const clearChat = async () => {
        const ok = await confirm({
            title: t('ai.clear_confirm_title', 'Clear Chat History?'),
            message: t('ai.clear_confirm_msg', 'All messages in this session will be permanently deleted.'),
            type: 'warning',
            confirmText: t('common.delete', 'Delete'),
            cancelText: t('common.cancel', 'Cancel'),
        });
        if (!ok) return;

        const api = (window as any).pywebview?.api;
        if (api?.ai_clear_chat_history) {
            const res = await api.ai_clear_chat_history();
            if (res?.status === 'success') {
                setMessages([]);
                setStreamingText('');
                streamingTextRef.current = '';
                setActionStates({});
                try {
                    localStorage.removeItem('vylo_ai_action_states');
                } catch {
                    // Ignore localStorage removal errors
                }
                showToast(t('backend.ai.history_cleared', 'Chat history cleared successfully.'), 'success');
            }
        }
    };

    const sendMessage = async (prompt: string, activeScreen: string = 'dashboard') => {
        if (!prompt.trim() || isGenerating) return;

        const api = (window as any).pywebview?.api;
        if (!api?.ai_send_message) return;

        // Ambil konteks server jika diaktifkan
        let contextText = '';
        if (attachedContext.includeScreen && api.ai_get_server_context) {
            try {
                const ctxRes = await api.ai_get_server_context(activeScreen, attachedContext.includeLogs);
                if (ctxRes?.status === 'success') {
                    contextText = ctxRes.data || '';
                }
            } catch {
                // Server context retrieval is optional; fallback to empty context on failure
            }
        }

        const userMsgId = `usr_${Date.now()}`;
        const userMsg: AiMessage = {
            id: userMsgId,
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
            context: contextText,
        };

        setMessages((prev) => [...prev, userMsg]);
        setIsGenerating(true);
        setStreamingText('');
        streamingTextRef.current = '';

        try {
            const res = await api.ai_send_message(prompt, contextText, currentModel, activeProvider);
            if (res?.status === 'success') {
                activeMsgIdRef.current = res.message_id;
            } else {
                setIsGenerating(false);
                const errMsg = t(res?.message || 'backend.ai.connection_failed', res?.args || {}) as string;
                showToast(errMsg, 'error');
            }
        } catch (err: any) {
            setIsGenerating(false);
            showToast(String(err), 'error');
        }
    };

    const toggleFloatingOpen = () => setIsFloatingOpen((prev) => !prev);

    const value: AiContextValue = useMemo(() => ({
        messages,
        isGenerating,
        streamingText,
        isFloatingOpen,
        floatingPosition,
        enableAi,
        enableFloating,
        activeProvider,
        activeModel: currentModel,
        hasApiKey,
        availableModels,
        isLoadingModels,
        accountTier,
        isCheckingTier,
        detectAccountTier,
        fetchAvailableModels,
        attachedContext,
        sendMessage,
        stopGenerating,
        clearChat,
        toggleFloatingOpen,
        setFloatingOpen: setIsFloatingOpen,
        setFloatingPosition: updateFloatingPosition,
        setActiveModel,
        setAttachedContext,
        actionStates,
        setActionState,
        usageStats,
        refreshUsageStats,
        resetUsageStats,
    }), [
        messages,
        isGenerating,
        streamingText,
        isFloatingOpen,
        floatingPosition,
        enableAi,
        enableFloating,
        activeProvider,
        currentModel,
        hasApiKey,
        availableModels,
        isLoadingModels,
        accountTier,
        isCheckingTier,
        detectAccountTier,
        fetchAvailableModels,
        attachedContext,
        sendMessage,
        clearChat,
        setActionState,
        actionStates,
        usageStats,
        refreshUsageStats,
        resetUsageStats,
    ]);

    return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAiAssistant(): AiContextValue {
    const ctx = useContext(AiContext);
    if (!ctx) {
        throw new Error('useAiAssistant must be used within an AiProvider');
    }
    return ctx;
}

export function useOptionalAiAssistant(): AiContextValue | null {
    return useContext(AiContext) || null;
}
