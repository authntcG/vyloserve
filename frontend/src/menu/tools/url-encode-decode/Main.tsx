import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import { useToast } from '../../../components/ToastContext';

export default function UrlMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');
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
                currentOutput = encodeURIComponent(input);
                setOutput(currentOutput);
            } else {
                currentOutput = decodeURIComponent(input);
                setOutput(currentOutput);
            }
        } catch (e) {
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
    }, [input, mode]);

    const handleCopy = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        showToast(t('tools.url.copy_success'), "success");
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="link"
                title={t('tools.url.title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.url.subtitle')}</>}
            />

            <div className="flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => { setMode('encode'); setInput(''); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${mode === 'encode' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('tools.url.encode_url')}</button>
                <button type="button" onClick={() => { setMode('decode'); setInput(''); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${mode === 'decode' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('tools.url.decode_url')}</button>
            </div>

            {/* Layout responsif menggunakan proporsi 7:5 (12 Grid) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 w-full min-w-0">
                
                {/* Editor Section (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    <Card title={`Input Text (${mode === 'encode' ? 'Raw' : 'Encoded'})`} status={t('tools.url.status_active')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={mode === 'encode' ? "https://example.com/api?search=hello world" : "https%3A%2F%2Fexample.com%2Fapi%3Fsearch%3Dhello%20world"}
                                className="w-full h-36 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none break-all"
                                spellCheck="false"
                            ></textarea>
                        </div>
                    </Card>

                    <Card title={`Output Text (${mode === 'encode' ? 'Encoded' : 'Decoded'})`} status={t('tools.url.status_result')} gridCols="grid-cols-1">
                        <div className="relative w-full min-w-0 flex flex-col">
                            <textarea
                                value={output}
                                readOnly
                                className="w-full h-36 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm outline-none text-slate-900 dark:text-white resize-none break-all"
                                spellCheck="false"
                            ></textarea>
                            <button type="button" onClick={handleCopy} disabled={!output || output.startsWith('Error')} className="absolute bottom-3 right-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-1.5 px-3 rounded shadow-sm transition-all flex items-center gap-1 disabled:opacity-50">
                                <span className="material-symbols-outlined text-[16px]">content_copy</span> {t('tools.url.copy')}
                            </button>
                        </div>
                    </Card>
                </div>

                {/* URL Hierarchy Visualizer (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <Card title={t('tools.url.hierarchy_title')} status={parsedUrl ? t('tools.url.valid_url') : t('tools.url.waiting')} gridCols="grid-cols-1">
                        {!parsedUrl ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 w-full">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">account_tree</span>
                                <p className="text-sm text-center">{t('tools.url.placeholder')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 w-full min-w-0">
                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.protocol_origin')}</span>
                                    <div className="flex items-center gap-2 mt-1 w-full min-w-0">
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-mono font-bold shrink-0">{parsedUrl.protocol.replaceAll(':', '')}</span>
                                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{parsedUrl.host}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.path_hierarchy')}</span>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 w-full">
                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[18px] shrink-0">home</span>
                                        {parsedUrl.pathname === '/' ? (
                                            <span className="text-sm text-slate-500 italic">/ (Root)</span>
                                        ) : (
                                            parsedUrl.pathname.split('/').filter(Boolean).map((segment, index) => (
                                                <div key={index} className="flex items-center gap-2 max-w-full">
                                                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[16px] shrink-0">chevron_right</span>
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono truncate max-w-[200px]" title={segment}>{segment}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {parsedUrl.search && parsedUrl.search.length > 1 && (
                                    <div className="flex flex-col gap-1 w-full min-w-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.url.search_params')}</span>
                                        <div className="flex flex-col gap-2 mt-2 w-full min-w-0">
                                            {parsedUrl.search.substring(1).split('&').map((param, idx) => {
                                                const [key, ...valueParts] = param.split('=');
                                                const value = valueParts.join('=');
                                                return (
                                                    <div key={idx} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 w-full min-w-0">
                                                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 px-2 py-0.5 rounded break-words max-w-[40%] shrink-0">
                                                            {decodeURIComponent(key)}
                                                        </span>
                                                        <span className="text-slate-400 text-xs mt-0.5 shrink-0">=</span>
                                                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300 break-words min-w-0 flex-1">
                                                            {decodeURIComponent(value || '')}
                                                        </span>
                                                    </div>
                                                );
                                            })}
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