import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../../../components/ToggleSwitch';
import Select from '../../../components/Select';
import Button from '../../../components/Button';
import { useAlert } from '../../../context/AlertContext';
import { useToast } from '../../../context/ToastContext';
import { useAiAssistant, PROVIDER_MODELS } from '../../../context/AiContext';

export { PROVIDER_MODELS };

const PROVIDER_KEY_URLS: Record<string, string> = {
    gemini: 'https://aistudio.google.com/app/apikey',
    groq: 'https://console.groq.com/keys',
    openrouter: 'https://openrouter.ai/keys',
};

const DEPRECATED_GEMINI_MODELS = new Set(['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash']);

function normalizeInitialModel(prov: string, curModel: string, api: any): string {
    if (prov === 'gemini' && DEPRECATED_GEMINI_MODELS.has(curModel)) {
        api?.save_app_settings?.({ ai_model: 'gemini-3.5-flash-lite' });
        return 'gemini-3.5-flash-lite';
    }
    return curModel;
}

interface AiAccountTierBadgeProps {
    readonly isLoading: boolean;
    readonly accountTier: string;
}

function AiAccountTierBadge({ isLoading, accountTier }: AiAccountTierBadgeProps) {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                <span>{t('ai.tier_checking', 'Checking account tier...')}</span>
            </span>
        );
    }

    if (accountTier === 'free') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>{t('ai.tier_free', 'Free Tier')}</span>
            </span>
        );
    }

    if (accountTier === 'pro') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="material-symbols-outlined text-[14px]">stars</span>
                <span>{t('ai.tier_pro', 'Pro / Pay-As-You-Go')}</span>
            </span>
        );
    }

    if (accountTier === 'invalid') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                <span className="material-symbols-outlined text-[14px]">error</span>
                <span>{t('ai.tier_invalid', 'Invalid API Key')}</span>
            </span>
        );
    }

    if (accountTier === 'local') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <span className="material-symbols-outlined text-[14px]">dns</span>
                <span>{t('ai.tier_local', 'Local Offline')}</span>
            </span>
        );
    }

    return null;
}

interface AiTabTogglesSectionProps {
    readonly enableAi: boolean;
    readonly enableFloating: boolean;
    readonly onToggleEnableAi: (val: boolean) => void;
    readonly onToggleFloating: (val: boolean) => void;
}

function AiTabTogglesSection({
    enableAi,
    enableFloating,
    onToggleEnableAi,
    onToggleFloating,
}: AiTabTogglesSectionProps) {
    const { t } = useTranslation();

    return (
        <section className="flex flex-col gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
                <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                        {t('settings.enable_ai', 'Enable AI Assistant')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.enable_ai_desc', 'Display AI Assistant in sidebar and enable assistant features')}
                    </span>
                </div>
                <ToggleSwitch
                    checked={enableAi}
                    onChange={onToggleEnableAi}
                    label={t('settings.enable_ai')}
                />
            </div>

            <hr className="border-slate-200 dark:border-slate-800/60" />

            <div className="flex items-center justify-between">
                <div>
                    <span className={`font-medium text-sm block ${!enableAi ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100'}`}>
                        {t('settings.enable_floating', 'Enable Floating Assistant')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.enable_floating_desc', 'Show draggable floating AI icon across all pages')}
                    </span>
                </div>
                <ToggleSwitch
                    checked={enableFloating && enableAi}
                    onChange={onToggleFloating}
                    disabled={!enableAi}
                    label={t('settings.enable_floating')}
                />
            </div>
        </section>
    );
}

interface AiTabAdvancedSectionProps {
    readonly autoContext: boolean;
    readonly temperature: number;
    readonly onAutoContextChange: (val: boolean) => void;
    readonly onTemperatureChange: (val: number) => void;
}

function AiTabAdvancedSection({
    autoContext,
    temperature,
    onAutoContextChange,
    onTemperatureChange,
}: AiTabAdvancedSectionProps) {
    const { t } = useTranslation();

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                        {t('settings.ai_auto_context', 'Auto-attach Active Screen Context')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.ai_auto_context_desc', 'Automatically provide active module info to AI')}
                    </span>
                </div>
                <ToggleSwitch
                    checked={autoContext}
                    onChange={onAutoContextChange}
                    label={t('settings.ai_auto_context')}
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ai-temperature-range" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.ai_temperature', 'Creativity / Temperature ({{val}})', { val: temperature })}
                    </label>
                </div>
                <input
                    id="ai-temperature-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => onTemperatureChange(Number.parseFloat(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                    {t('settings.ai_temperature_desc', 'Lower values are more precise for code & configs')}
                </span>
            </div>
        </section>
    );
}

interface LoadedAiSettings {
    enableAi: boolean;
    enableFloating: boolean;
    provider: string;
    curModel: string;
    apiKey: string;
    baseUrl: string;
    autoContext: boolean;
    temperature: number;
    isCustomModel: boolean;
    shouldFetchModels: boolean;
}

function parseLoadedAiSettings(d: Record<string, any>, api: any): LoadedAiSettings {
    const enableAi = d.enable_ai_assistant ?? true;
    const enableFloating = d.enable_floating_ai ?? true;
    const prov = d.ai_provider || 'gemini';
    const curModel = normalizeInitialModel(prov, d.ai_model || 'gemini-3.5-flash-lite', api);
    const apiKey = d.ai_api_key || '';
    const baseUrl = d.ai_base_url || 'http://localhost:11434/v1';
    const autoContext = d.ai_auto_context ?? true;
    const temperature = d.ai_temperature ?? 0.5;

    const knownModels = (PROVIDER_MODELS[prov] || []).map((m) => m.value);
    const isCustomModel = !knownModels.includes(curModel);
    const shouldFetchModels = prov === 'openrouter' || prov === 'ollama' || Boolean(d.ai_api_key?.trim());

    return {
        enableAi,
        enableFloating,
        provider: prov,
        curModel,
        apiKey,
        baseUrl,
        autoContext,
        temperature,
        isCustomModel,
        shouldFetchModels,
    };
}

async function testAiProviderConnection(
    api: any,
    params: { provider: string; apiKey: string; model: string; baseUrl: string },
    t: (key: string, args?: any) => string
): Promise<{ status: 'success' | 'error'; message: string }> {
    try {
        const res = await api.ai_test_connection(params.provider, params.apiKey, params.model, params.baseUrl);
        if (res?.status === 'success') {
            return {
                status: 'success',
                message: t(res.message || 'backend.ai.connection_success'),
            };
        }
        return {
            status: 'error',
            message: t(res?.message || 'backend.ai.connection_failed', res?.args || {}),
        };
    } catch (err: any) {
        return { status: 'error', message: String(err) };
    }
}

export default function AiTabContent() {
    const { t } = useTranslation();
    const { confirm } = useAlert();
    const { showToast } = useToast();
    const { availableModels, isLoadingModels, accountTier, isCheckingTier, fetchAvailableModels } = useAiAssistant();

    const [enableAi, setEnableAi] = useState(true);
    const [enableFloating, setEnableFloating] = useState(true);
    const [provider, setProvider] = useState('gemini');
    const [model, setModel] = useState('gemini-3.5-flash-lite');
    const [customModel, setCustomModel] = useState('');
    const [isCustomModelActive, setIsCustomModelActive] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
    const [autoContext, setAutoContext] = useState(true);
    const [temperature, setTemperature] = useState(0.5);

    const [isTesting, setIsTesting] = useState(false);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [localModels, setLocalModels] = useState<Record<string, Array<{ value: string; label: string }>>>({});
    const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        const api = (window as any).pywebview?.api;
        if (!api?.get_app_settings) return;

        api.get_app_settings().then((res: any) => {
            if (res?.status !== 'success' || !res.data) return;
            const parsed = parseLoadedAiSettings(res.data, api);

            setEnableAi(parsed.enableAi);
            setEnableFloating(parsed.enableFloating);
            setProvider(parsed.provider);
            setModel(parsed.curModel);
            setApiKey(parsed.apiKey);
            setBaseUrl(parsed.baseUrl);
            setAutoContext(parsed.autoContext);
            setTemperature(parsed.temperature);

            if (parsed.isCustomModel) {
                setIsCustomModelActive(true);
                setCustomModel(parsed.curModel);
            }

            if (parsed.shouldFetchModels) {
                fetchAvailableModels(parsed.provider, parsed.apiKey, parsed.baseUrl, true)
                    .then((m) => {
                        if (m && m.length > 0) {
                            setLocalModels((prev) => ({ ...prev, [parsed.provider]: m }));
                        }
                    })
                    .catch(() => {});
            }
        });
    }, [fetchAvailableModels]);

    const saveSettings = async (updates: Record<string, any>) => {
        const api = (window as any).pywebview?.api;
        if (api?.save_app_settings) {
            await api.save_app_settings(updates);
            window.dispatchEvent(new CustomEvent('vylo_ai_settings_changed', { detail: updates }));
        }
    };

    const handleToggleEnableAi = (val: boolean) => {
        setEnableAi(val);
        saveSettings({ enable_ai_assistant: val });
    };

    const handleToggleFloating = (val: boolean) => {
        setEnableFloating(val);
        saveSettings({ enable_floating_ai: val });
    };

    const handleProviderChange = (newProv: string) => {
        setProvider(newProv);
        const provList = localModels[newProv] || PROVIDER_MODELS[newProv] || [];
        const defaultForProv = provList[0]?.value || 'custom';
        setModel(defaultForProv);
        setIsCustomModelActive(false);
        setTestResult(null);
        saveSettings({ ai_provider: newProv, ai_model: defaultForProv });

        if (newProv === 'openrouter' || newProv === 'ollama' || apiKey?.trim()) {
            fetchAvailableModels(newProv, apiKey, baseUrl, true).then((m) => {
                if (m && m.length > 0) {
                    setLocalModels((prev) => ({ ...prev, [newProv]: m }));
                }
            }).catch(() => {});
        }
    };

    const handleRefreshModels = async (overrideKey?: string) => {
        setIsFetchingModels(true);
        const targetKey = overrideKey ?? apiKey;
        try {
            const list = await fetchAvailableModels(provider, targetKey, baseUrl, false);
            if (list && list.length > 0) {
                setLocalModels((prev) => ({ ...prev, [provider]: list }));
                const values = list.map((m) => m.value);
                if (!values.includes(model) && !isCustomModelActive) {
                    const fallbackModel = list[0].value;
                    setModel(fallbackModel);
                    saveSettings({ ai_model: fallbackModel });
                }
            }
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleModelChange = (newModel: string) => {
        if (newModel === '__custom__') {
            setIsCustomModelActive(true);
            return;
        }
        setIsCustomModelActive(false);
        setModel(newModel);
        saveSettings({ ai_model: newModel });
    };

    const handleCustomModelBlur = () => {
        if (customModel.trim()) {
            setModel(customModel.trim());
            saveSettings({ ai_model: customModel.trim() });
        }
    };

    const handleApiKeyBlur = () => {
        saveSettings({ ai_api_key: apiKey });
        if (provider !== 'ollama' && apiKey.trim()) {
            handleRefreshModels(apiKey.trim());
        }
    };

    const handleBaseUrlBlur = () => {
        saveSettings({ ai_base_url: baseUrl });
    };

    const handleAutoContextChange = (val: boolean) => {
        setAutoContext(val);
        saveSettings({ ai_auto_context: val });
    };

    const handleTemperatureChange = (val: number) => {
        setTemperature(val);
        saveSettings({ ai_temperature: val });
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        const api = (window as any).pywebview?.api;
        if (!api?.ai_test_connection) {
            setIsTesting(false);
            return;
        }

        const activeModel = isCustomModelActive ? customModel : model;
        const result = await testAiProviderConnection(
            api,
            { provider, apiKey, model: activeModel, baseUrl },
            t as any
        );
        setTestResult(result);
        showToast(result.message, result.status);
        setIsTesting(false);
    };

    const handleClearHistory = async () => {
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
                showToast(t('backend.ai.history_cleared', 'Chat history cleared successfully.'), 'success');
                window.dispatchEvent(new CustomEvent('vylo_ai_history_cleared'));
            }
        }
    };

    const providerOptions = [
        { value: 'gemini', label: t('settings.ai_provider_gemini', 'Google Gemini (Free Tier)') },
        { value: 'groq', label: t('settings.ai_provider_groq', 'Groq Cloud (Free LPU)') },
        { value: 'openrouter', label: t('settings.ai_provider_openrouter', 'OpenRouter (:free models)') },
        { value: 'ollama', label: t('settings.ai_provider_ollama', 'Ollama (Local Offline)') },
    ];

    const currentModels = localModels[provider] || (provider === 'gemini' && availableModels.length > 0 ? availableModels : (PROVIDER_MODELS[provider] || []));
    const modelOptions = [
        ...currentModels,
        { value: '__custom__', label: t('ai.custom_model', 'Custom Model...') }
    ];

    const isModelDisabled = (provider === 'gemini' || provider === 'groq') && (!apiKey.trim() || accountTier === 'invalid');

    return (
        <div className="flex flex-col gap-6 w-full max-w-2xl p-6 md:p-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    {t('settings.ai_title', 'AI Assistant Configuration')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('settings.ai_desc', 'Configure your free AI provider, model preferences, and assistant behavior.')}
                </p>
            </div>

            {/* TOGGLES */}
            <AiTabTogglesSection
                enableAi={enableAi}
                enableFloating={enableFloating}
                onToggleEnableAi={handleToggleEnableAi}
                onToggleFloating={handleToggleFloating}
            />

            {/* PROVIDER, API KEY, MODEL & CONNECTION */}
            <section className="flex flex-col gap-4">
                {/* 1. SELECT PROVIDER */}
                <div>
                    <label htmlFor="ai-provider-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {t('settings.ai_provider', 'AI Provider')}
                    </label>
                    <Select
                        id="ai-provider-select"
                        value={provider}
                        onChange={handleProviderChange}
                        options={providerOptions}
                        searchable={false}
                    />
                </div>

                {/* 2. API KEY OR BASE URL (WITH TIER BADGE) */}
                {provider !== 'ollama' ? (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="ai-api-key-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.ai_api_key', 'API Key')}
                            </label>
                            {PROVIDER_KEY_URLS[provider] && (
                                <a
                                    href={PROVIDER_KEY_URLS[provider]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    <span>{t('settings.ai_api_key_get_free', 'Get Free Key')}</span>
                                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                </a>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                id="ai-api-key-input"
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                onBlur={handleApiKeyBlur}
                                placeholder="sk-..."
                                className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                aria-label="Toggle password visibility"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {showKey ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {t('settings.ai_api_key_desc', 'Stored locally on your machine')}
                            </span>
                            {/* TIER STATUS BADGE */}
                            <div>
                                <AiAccountTierBadge
                                    isLoading={isCheckingTier || isFetchingModels || isLoadingModels}
                                    accountTier={accountTier}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="ai-base-url-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            {t('settings.ai_base_url', 'API Base URL')}
                        </label>
                        <input
                            id="ai-base-url-input"
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            onBlur={handleBaseUrlBlur}
                            placeholder="http://localhost:11434/v1"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                        />
                        <div className="mt-1.5 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {t('settings.ai_base_url_desc', 'Custom endpoint (e.g. for Ollama)')}
                            </span>
                            <div>
                                <AiAccountTierBadge
                                    isLoading={isCheckingTier || isFetchingModels || isLoadingModels}
                                    accountTier={accountTier}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. SELECT AVAILABLE MODEL */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="ai-model-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('settings.ai_model', 'AI Model')}
                        </label>
                        <button
                            type="button"
                            onClick={() => handleRefreshModels()}
                            disabled={isFetchingModels || isLoadingModels || isCheckingTier || isModelDisabled}
                            title={t('ai.refresh_models', 'Refresh model list')}
                            className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                            <span className={`material-symbols-outlined text-[15px] ${(isFetchingModels || isLoadingModels || isCheckingTier) ? 'animate-spin' : ''}`}>
                                sync
                            </span>
                            <span>{(isFetchingModels || isLoadingModels || isCheckingTier) ? t('ai.fetching_models', 'Fetching models...') : t('ai.refresh_models', 'Refresh')}</span>
                        </button>
                    </div>
                    <Select
                        id="ai-model-select"
                        value={isCustomModelActive ? '__custom__' : model}
                        onChange={handleModelChange}
                        options={modelOptions}
                        searchable={false}
                        disabled={isModelDisabled}
                    />
                    {isModelDisabled && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            <span>{t('ai.api_key_required_hint', 'Enter API key to unlock available models')}</span>
                        </p>
                    )}
                    {isCustomModelActive && !isModelDisabled && (
                        <div className="mt-2">
                            <label htmlFor="ai-custom-model-input" className="sr-only">
                                {t('ai.custom_model', 'Custom Model...')}
                            </label>
                            <input
                                id="ai-custom-model-input"
                                type="text"
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value)}
                                onBlur={handleCustomModelBlur}
                                placeholder="e.g. meta-llama/llama-3.2-3b-instruct"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                            />
                        </div>
                    )}
                </div>

                {/* 4. TEST CONNECTION */}
                <div className="flex items-center gap-3 pt-1">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTestConnection}
                        disabled={isTesting || (provider !== 'ollama' && !apiKey.trim())}
                    >
                        <span className={`material-symbols-outlined text-[18px] ${isTesting ? 'animate-spin' : ''}`}>
                            {isTesting ? 'sync' : 'network_check'}
                        </span>
                        {isTesting ? t('settings.ai_testing', 'Testing...') : t('settings.ai_test_connection', 'Test Connection')}
                    </Button>

                    {testResult && (
                        <span className={`text-xs font-medium flex items-center gap-1.5 ${testResult.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            <span className="material-symbols-outlined text-[16px]">
                                {testResult.status === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {testResult.message}
                        </span>
                    )}
                </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* ADVANCED SETTINGS */}
            <AiTabAdvancedSection
                autoContext={autoContext}
                temperature={temperature}
                onAutoContextChange={handleAutoContextChange}
                onTemperatureChange={handleTemperatureChange}
            />

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* DANGER ZONE: CLEAR HISTORY */}
            <section className="flex items-center justify-between pt-1">
                <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                        {t('settings.ai_clear_history', 'Clear Chat History')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('ai.clear_confirm_msg', 'All messages in this session will be permanently deleted.')}
                    </span>
                </div>
                <Button
                    type="button"
                    variant="danger"
                    onClick={handleClearHistory}
                >
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                    {t('settings.ai_clear_history', 'Clear Chat History')}
                </Button>
            </section>
        </div>
    );
}
