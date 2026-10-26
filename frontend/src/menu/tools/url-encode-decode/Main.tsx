import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Tabs from '../../../components/Tabs';
import { useToast } from '../../../context/ToastContext';

function safeDecode(str: string) {
    try {
        return decodeURIComponent(str);
    } catch {
        return str;
    }
}

function getByteLength(str: string): number {
    return new TextEncoder().encode(str).length;
}

const SAMPLE_URL = 'https://vyloserve.com/api/v1/search?query=hello world&filter=dev tools&page=1#results';

export default function UrlMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');
    const [scope, setScope] = useState<'component' | 'full'>('component');
    const [spaceEncoding, setSpaceEncoding] = useState<'standard' | 'plus'>('standard');
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [parsedUrl, setParsedUrl] = useState<URL | null>(null);

    useEffect(() => {
        if (!input.trim()) {
            setOutput('');
            setParsedUrl(null);
            return;
        }

        let currentOutput = '';
        
        try {
            if (mode === 'encode') {
                if (scope === 'full') {
                    currentOutput = encodeURI(input);
                } else {
                    currentOutput = encodeURIComponent(input);
                }
                if (spaceEncoding === 'plus') {
                    currentOutput = currentOutput.replaceAll('%20', '+');
                }
                setOutput(currentOutput);
            } else {
                const preparedInput = input.replaceAll('+', '%20');
                currentOutput = decodeURIComponent(preparedInput);
                setOutput(currentOutput);
            }
        } catch (e) {
            console.error(e);
            setOutput(t('tools.url.error_malformed'));
            setParsedUrl(null);
            return;
        }

        const stringToParse = mode === 'encode' ? input : currentOutput;
        try {
            const url = new URL(stringToParse);
            setParsedUrl(url);
        } catch {
            setParsedUrl(null);
        }
    }, [input, mode, scope, spaceEncoding]);

    const handleCopy = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        showToast(t('tools.url.copy_success'), "success");
    };

    const handleCopyText = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast(t('tools.url.copy_success'), "success");
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setInput(text);
                showToast(t('tools.url.copy_success'), "info");
            }
        } catch {
            // Clipboard read unavailable or denied
        }
    };

    const handleParamChange = (index: number, newKey: string, newValue: string) => {
        if (!parsedUrl) return;
        try {
            const urlObj = new URL(parsedUrl.toString());
            const entries = Array.from(urlObj.searchParams.entries());
            if (index < entries.length) {
                entries[index] = [newKey, newValue];
            }
            urlObj.search = '';
            for (const [k, v] of entries) {
                if (k.trim()) urlObj.searchParams.append(k, v);
            }
            const updated = urlObj.toString();
            setInput(mode === 'encode' ? updated : (scope === 'full' ? encodeURI(updated) : encodeURIComponent(updated)));
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddParam = () => {
        if (!parsedUrl) return;
        try {
            const urlObj = new URL(parsedUrl.toString());
            urlObj.searchParams.append('key', 'value');
            const updated = urlObj.toString();
            setInput(mode === 'encode' ? updated : (scope === 'full' ? encodeURI(updated) : encodeURIComponent(updated)));
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteParam = (index: number) => {
        if (!parsedUrl) return;
        try {
            const urlObj = new URL(parsedUrl.toString());
            const entries = Array.from(urlObj.searchParams.entries());
            entries.splice(index, 1);
            urlObj.search = '';
            for (const [k, v] of entries) {
                urlObj.searchParams.append(k, v);
            }
            const updated = urlObj.toString();
            setInput(mode === 'encode' ? updated : (scope === 'full' ? encodeURI(updated) : encodeURIComponent(updated)));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="link"
                title={t('tools.url.title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.url.subtitle')}</>}
            />

            <Tabs
                tabs={[
                    { value: 'encode', label: t('tools.url.encode_url') },
                    { value: 'decode', label: t('tools.url.decode_url') },
                ]}
                value={mode}
                onChange={(m) => { setMode(m); setInput(''); }}
            />

            {/* Sub-options toolbar */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-xs text-slate-600 dark:text-slate-400">
                {/* Scope Options */}
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-500 dark:text-slate-400">{t('tools.url.scope')}:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/50 dark:bg-slate-900/50">
                        <button
                            type="button"
                            onClick={() => setScope('component')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${scope === 'component' ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            {t('tools.url.scope_component')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('full')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${scope === 'full' ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            {t('tools.url.scope_full')}
                        </button>
                    </div>
                </div>

                {/* Space Encoding Options */}
                {mode === 'encode' && (
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-500 dark:text-slate-400">{t('tools.url.space_encoding')}:</span>
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/50 dark:bg-slate-900/50">
                            <button
                                type="button"
                                onClick={() => setSpaceEncoding('standard')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${spaceEncoding === 'standard' ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {t('tools.url.space_standard')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSpaceEncoding('plus')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${spaceEncoding === 'plus' ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {t('tools.url.space_plus')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Layout responsif menggunakan proporsi 7:5 (12 Grid) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 w-full min-w-0">
                
                {/* Editor Section (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    <Card title={t('tools.url.input_card_title', { mode: mode === 'encode' ? t('tools.url.mode_raw') : t('tools.url.mode_encoded') })} status={t('tools.url.status_active')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col">
                            {/* Input Toolbar */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    {mode === 'encode' ? t('tools.url.mode_raw') : t('tools.url.mode_encoded')}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setInput(SAMPLE_URL)}
                                        className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
                                        title={t('tools.url.sample')}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">data_object</span>
                                        <span>{t('tools.url.sample')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePaste}
                                        className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
                                        title={t('tools.url.paste')}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">content_paste</span>
                                        <span>{t('tools.url.paste')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInput('')}
                                        disabled={!input}
                                        className="px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                                        title={t('tools.url.clear')}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">backspace</span>
                                        <span>{t('tools.url.clear')}</span>
                                    </button>
                                </div>
                            </div>

                            <textarea
                                id="url-input-textarea"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={mode === 'encode' ? t('tools.url.placeholder_encode') : t('tools.url.placeholder_decode')}
                                className="w-full h-36 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-y break-all font-mono"
                                spellCheck="false"
                            ></textarea>

                            {/* Footer stats */}
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-mono">
                                <span>{t('tools.url.chars_count', { chars: input.length, bytes: getByteLength(input) })}</span>
                            </div>
                        </div>
                    </Card>

                    <Card title={t('tools.url.output_card_title', { mode: mode === 'encode' ? t('tools.url.mode_encoded') : t('tools.url.mode_decoded') })} status={t('tools.url.status_result')} gridCols="grid-cols-1">
                        <div className="relative w-full min-w-0 flex flex-col">
                            {/* Output Toolbar */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    {mode === 'encode' ? t('tools.url.mode_encoded') : t('tools.url.mode_decoded')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        disabled={!output || output.startsWith('Error')}
                                        aria-label={t('tools.url.copy')}
                                        className="px-2.5 py-1 text-xs rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                        <span>{t('tools.url.copy')}</span>
                                    </button>
                                </div>
                            </div>

                            <textarea
                                id="url-output-textarea"
                                value={output}
                                readOnly
                                className="w-full h-36 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm outline-none text-slate-900 dark:text-white resize-y break-all font-mono"
                                spellCheck="false"
                            ></textarea>

                            {/* Footer stats */}
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-mono">
                                <span>{t('tools.url.chars_count', { chars: output.length, bytes: getByteLength(output) })}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* URL Hierarchy Visualizer (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <Card title={t('tools.url.hierarchy_title')} status={parsedUrl ? t('tools.url.valid_url') : t('tools.url.waiting')} gridCols="grid-cols-1">
                        {!parsedUrl ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 w-full gap-2">
                                <span className="material-symbols-outlined text-4xl mb-1 opacity-50">account_tree</span>
                                <p className="text-sm text-center">{t('tools.url.placeholder')}</p>
                                <button
                                    type="button"
                                    onClick={() => setInput(SAMPLE_URL)}
                                    className="mt-2 text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[14px]">data_object</span>
                                    <span>{t('tools.url.sample')}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 w-full min-w-0">
                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.protocol_origin')}</span>
                                    <div className="flex items-center gap-2 mt-1 w-full min-w-0">
                                        <span className="px-2 py-1 bg-primary/10 dark:bg-primary/20 text-primary rounded text-xs font-mono font-bold shrink-0">{parsedUrl.protocol.replaceAll(':', '')}</span>
                                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{parsedUrl.host}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.path_hierarchy')}</span>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 w-full">
                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[18px] shrink-0">home</span>
                                        {parsedUrl.pathname === '/' ? (
                                            <span className="text-sm text-slate-500 italic">{t('tools.url.root')}</span>
                                        ) : (
                                            parsedUrl.pathname.split('/').filter(Boolean).map((segment, index) => (
                                                <div key={`${segment}-${index}`} className="flex items-center gap-2 max-w-full">
                                                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[16px] shrink-0">chevron_right</span>
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono truncate max-w-[200px]" title={segment}>{segment}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Interactive Query Parameters Table */}
                                <div className="flex flex-col gap-2 w-full min-w-0 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.params_edit')}</span>
                                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-mono">
                                                {Array.from(parsedUrl.searchParams.keys()).length}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddParam}
                                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                            <span>{t('tools.url.add_param')}</span>
                                        </button>
                                    </div>

                                    {Array.from(parsedUrl.searchParams.entries()).length === 0 ? (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 italic">
                                            {t('tools.url.placeholder')}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 mt-1 w-full min-w-0 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            {Array.from(parsedUrl.searchParams.entries()).map(([key, value], idx) => (
                                                <div key={`${key}-${idx}`} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800 w-full min-w-0">
                                                    <span className="sr-only">{safeDecode(key)}</span>
                                                    <span className="sr-only">{safeDecode(value || '')}</span>
                                                    <input
                                                        type="text"
                                                        value={safeDecode(key)}
                                                        onChange={(e) => handleParamChange(idx, e.target.value, value)}
                                                        placeholder={t('tools.url.param_key')}
                                                        aria-label={t('tools.url.param_key')}
                                                        className="w-1/3 min-w-[70px] font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-primary"
                                                    />
                                                    <span className="text-slate-400 text-xs shrink-0">=</span>
                                                    <input
                                                        type="text"
                                                        value={safeDecode(value)}
                                                        onChange={(e) => handleParamChange(idx, key, e.target.value)}
                                                        placeholder={t('tools.url.param_value')}
                                                        aria-label={t('tools.url.param_value')}
                                                        className="flex-1 min-w-[80px] font-mono text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:border-primary"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyText(value)}
                                                        title={t('tools.url.copy_value')}
                                                        aria-label={t('tools.url.copy_value')}
                                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteParam(idx)}
                                                        title={t('tools.url.delete_param')}
                                                        aria-label={t('tools.url.delete_param')}
                                                        className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Fragment (#) */}
                                {parsedUrl.hash && (
                                    <div className="flex flex-col gap-1 w-full min-w-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.hash_fragment')}</span>
                                        <div className="flex items-center gap-2 mt-1 w-full min-w-0">
                                            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded break-all">
                                                {parsedUrl.hash}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
