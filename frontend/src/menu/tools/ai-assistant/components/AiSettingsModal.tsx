import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../../components/Modal';
import ToggleSwitch from '../../../../components/ToggleSwitch';
import Select from '../../../../components/Select';
import Button from '../../../../components/Button';
import { useAlert } from '../../../../context/AlertContext';
import { useToast } from '../../../../context/ToastContext';
import { useAiAssistant, PROVIDER_MODELS } from '../../../../context/AiContext';

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

interface AiSettingsModalProps {
    readonly isOpen?: boolean;
    readonly onClose?: () => void;
}

export default function AiSettingsModal({ isOpen: controlledIsOpen, onClose: controlledOnClose }: AiSettingsModalProps) {
    const { t } = useTranslation();
    const { confirm } = useAlert();
    const { showToast } = useToast();
    const {
        isAiSettingsOpen,
        closeAiSettings,
        availableModels,
        isLoadingModels,
        accountTier,
        isCheckingTier,
        fetchAvailableModels,
    } = useAiAssistant();

    const isModalOpen = controlledIsOpen ?? isAiSettingsOpen;
    const handleCloseModal = controlledOnClose ?? closeAiSettings;

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

    const syncProviderModels = (prov: string, key: string, url: string, silent: boolean) => {
        fetchAvailableModels(prov, key, url, silent)
            .then((m) => {
                if (m && m.length > 0) {
                    setLocalModels((prev) => ({ ...prev, [prov]: m }));
                }
            })
            .catch(() => {});
    };

    useEffect(() => {
        if (!isModalOpen) return;

        const api = (window as any).pywebview?.api;
        if (!api?.get_app_settings) return;

        api.get_app_settings().then((res: any) => {
            if (res?.status !== 'success' || !res.data) return;
            const d = res.data;

            const savedEnableAi = d.enable_ai_assistant ?? true;
            const savedEnableFloating = d.enable_floating_ai ?? true;
            const prov = d.ai_provider || 'gemini';
            const curModel = normalizeInitialModel(prov, d.ai_model || 'gemini-3.5-flash-lite', api);
            const savedApiKey = d.ai_api_key || '';
            const savedBaseUrl = d.ai_base_url || 'http://localhost:11434/v1';
            const savedAutoContext = d.ai_auto_context ?? true;
            const savedTemp = d.ai_temperature ?? 0.5;

            setEnableAi(savedEnableAi);
            setEnableFloating(savedEnableFloating);
            setProvider(prov);
            setModel(curModel);
            setApiKey(savedApiKey);
            setBaseUrl(savedBaseUrl);
            setAutoContext(savedAutoContext);
            setTemperature(savedTemp);

            const knownModels = (PROVIDER_MODELS[prov] || []).map((m) => m.value);
            const isCustom = !knownModels.includes(curModel);
            if (isCustom) {
                setIsCustomModelActive(true);
                setCustomModel(curModel);
            }

            const shouldFetch = prov === 'openrouter' || prov === 'ollama' || Boolean(d.ai_api_key?.trim());
            if (shouldFetch) {
                syncProviderModels(prov, savedApiKey, savedBaseUrl, true);
            }
        });
    }, [isModalOpen, fetchAvailableModels]);

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
            syncProviderModels(newProv, apiKey, baseUrl, true);
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

        const targetModel = isCustomModelActive ? customModel : model;
        try {
            const res = await api.ai_test_connection(provider, apiKey, targetModel, baseUrl);
            if (res?.status === 'success') {
                const msg = t(res.message || 'backend.ai.connection_success');
                setTestResult({ status: 'success', message: msg });
                showToast(msg, 'success');
            } else {
                const msg = t(res?.message || 'backend.ai.connection_failed', res?.args || {}) as string;
                setTestResult({ status: 'error', message: msg });
                showToast(msg, 'error');
            }
        } catch (err: any) {
            const msg = String(err);
            setTestResult({ status: 'error', message: msg });
            showToast(msg, 'error');
        } finally {
            setIsTesting(false);
        }
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

    const currentModels = localModels[provider] || (provider === 'gemini' && availableModels.length > 0 ? availableModels : PROVIDER_MODELS[provider] || []);
    const modelOptions = [
        ...currentModels,
        { value: '__custom__', label: t('settings.ai_model_custom', '+ Custom Model Name...') },
    ];

    return (
        <Modal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={t('settings.tab_ai', 'AI Assistant Settings')}
            icon="smart_toy"
            maxWidthClass="sm:w-[620px] md:w-[680px] max-w-[calc(100vw-2rem)]"
            bodyPaddingClass="p-6"
        >
            <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-200 min-w-0">
                {/* 1. MASTER TOGGLES */}
                <section className="flex flex-col gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/70 dark:bg-slate-800/60 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                                {t('settings.enable_ai', 'Enable AI Assistant')}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                                {t('settings.enable_ai_desc', 'Display AI Assistant in sidebar and enable assistant features')}
                            </span>
                        </div>
                        <ToggleSwitch
                            checked={enableAi}
                            onChange={handleToggleEnableAi}
                            label={t('settings.enable_ai')}
                        />
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700/60" />

                    <div className={`flex items-center justify-between transition-opacity duration-200 ${!enableAi ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                                {t('settings.enable_floating', 'Enable Floating Assistant')}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                                {t('settings.enable_floating_desc', 'Show draggable floating AI icon across all pages')}
                            </span>
                        </div>
                        <ToggleSwitch
                            checked={enableFloating && enableAi}
                            onChange={handleToggleFloating}
                            disabled={!enableAi}
                            label={t('settings.enable_floating')}
                        />
                    </div>
                </section>

                {/* 2. PROVIDER & MODEL CONFIGURATION */}
                <section className="flex flex-col gap-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('ai.provider_model_config', 'Provider & Model')}
                    </h4>

                    {/* Provider Select */}
                    <div>
                        <label htmlFor="ai-settings-provider-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            {t('settings.ai_provider', 'AI Provider')}
                        </label>
                        <Select
                            id="ai-settings-provider-select"
                            value={provider}
                            onChange={handleProviderChange}
                            options={providerOptions}
                            searchable={false}
                        />
                    </div>

                    {/* Model Select */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="ai-settings-model-select" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.ai_model', 'Active Model')}
                            </label>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="sync"
                                loading={isFetchingModels || isLoadingModels}
                                disabled={isFetchingModels || isLoadingModels}
                                onClick={() => handleRefreshModels()}
                                className="h-6 px-2 text-xs flex items-center gap-1 text-slate-500 hover:text-primary"
                            >
                                <span>{t('ai.refresh_models', 'Refresh List')}</span>
                            </Button>
                        </div>

                        {!isCustomModelActive ? (
                            <Select
                                id="ai-settings-model-select"
                                value={model}
                                onChange={handleModelChange}
                                options={modelOptions}
                                searchable={false}
                            />
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="ai-settings-custom-model-input"
                                        type="text"
                                        value={customModel}
                                        onChange={(e) => setCustomModel(e.target.value)}
                                        onBlur={handleCustomModelBlur}
                                        placeholder="e.g. gpt-4o, claude-3-5-sonnet, mistral-large"
                                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        onClick={() => setIsCustomModelActive(false)}
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </Button>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('settings.ai_model_custom_desc', 'Enter the exact model identifier supported by your provider')}
                                </span>
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. CREDENTIALS & CONNECTION */}
                <section className="flex flex-col gap-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('ai.credentials_connection', 'Credentials & Connection')}
                    </h4>

                    {provider === 'ollama' ? (
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
                                <AiAccountTierBadge
                                    isLoading={isCheckingTier}
                                    accountTier={accountTier}
                                />
                            </div>
                        </div>
                    ) : (
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
                                <AiAccountTierBadge
                                    isLoading={isCheckingTier}
                                    accountTier={accountTier}
                                />
                            </div>
                        </div>
                    )}

                    {/* Test Connection Button */}
                    <div className="flex items-center gap-3 pt-1">
                        <Button
                            variant="secondary"
                            size="md"
                            icon="network_check"
                            loading={isTesting}
                            disabled={isTesting || (provider !== 'ollama' && !apiKey.trim())}
                            onClick={handleTestConnection}
                            className="shadow-xs"
                        >
                            {t('settings.ai_test_connection', 'Test Connection')}
                        </Button>

                        {testResult && (
                            <span
                                className={`text-xs flex items-center gap-1.5 font-medium ${
                                    testResult.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {testResult.status === 'success' ? 'check_circle' : 'error'}
                                </span>
                                <span className="truncate max-w-[280px]">{testResult.message}</span>
                            </span>
                        )}
                    </div>
                </section>

                {/* 4. ADVANCED PREFERENCES */}
                <section className="flex flex-col gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('ai.advanced_preferences', 'Context & Creativity')}
                    </h4>

                    {/* Auto Context Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm block">
                                {t('settings.ai_auto_context', 'Auto-attach Active Screen Context')}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                                {t('settings.ai_auto_context_desc', 'Automatically provide active module info to AI')}
                            </span>
                        </div>
                        <ToggleSwitch
                            checked={autoContext}
                            onChange={handleAutoContextChange}
                            label={t('settings.ai_auto_context')}
                        />
                    </div>

                    {/* Temperature Range Slider */}
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
                            onChange={(e) => handleTemperatureChange(Number.parseFloat(e.target.value))}
                            className="w-full accent-primary cursor-pointer"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                            {t('settings.ai_temperature_desc', 'Lower values are more precise for code & configs')}
                        </span>
                    </div>
                </section>

                {/* 5. DANGER ZONE: CLEAR CHAT HISTORY */}
                <section className="flex items-center justify-between p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
                    <div>
                        <span className="font-medium text-sm text-red-900 dark:text-red-300 block">
                            {t('ai.clear_confirm_title', 'Clear Chat History?')}
                        </span>
                        <span className="text-xs text-red-700 dark:text-red-400/80">
                            {t('ai.clear_chat_desc', 'Permanently remove all messages from this session')}
                        </span>
                    </div>
                    <Button
                        variant="danger-ghost"
                        size="sm"
                        icon="delete"
                        onClick={handleClearHistory}
                    >
                        {t('common.delete', 'Delete')}
                    </Button>
                </section>
            </div>
        </Modal>
    );
}
