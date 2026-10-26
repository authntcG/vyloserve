import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Tabs from '../../../components/Tabs';
import Button from '../../../components/Button';
import CompactFileDropzone from '../../../components/CompactFileDropzone';
import { useToast } from '../../../context/ToastContext';

function getByteLength(str: string): number {
    return new TextEncoder().encode(str).length;
}

function applyLineWrap(str: string, wrapLength: number): string {
    if (!str || wrapLength <= 0) return str;
    const regex = new RegExp(`.{1,${wrapLength}}`, 'g');
    return str.match(regex)?.join('\n') || str;
}

function encodeTextToBase64(inputText: string, isUrlSafe: boolean, lineWrap: number, t: any): string {
    if (!inputText) return '';
    try {
        const bytes = new TextEncoder().encode(inputText);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
        let b64 = btoa(binString);
        if (isUrlSafe) {
            b64 = b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
        }
        return applyLineWrap(b64, lineWrap);
    } catch (e) {
        console.error(e);
        return t('tools.base64.encode_error');
    }
}

function decodeBase64Input(inputText: string, isUrlSafe: boolean, t: any): { output: string; preview: string | null; pureBase64: string } {
    if (!inputText) return { output: '', preview: null, pureBase64: '' };
    try {
        let base64String = inputText.trim();
        const dataUriMatch = /^data:(.*?);base64,(.*)$/.exec(base64String);
        let preview: string | null = null;

        if (dataUriMatch) {
            const mimeType = dataUriMatch[1];
            base64String = dataUriMatch[2];
            preview = mimeType.startsWith('image/') ? inputText : null;
        }

        let cleanBase64 = base64String.replace(/\s+/g, '');
        if (isUrlSafe || cleanBase64.includes('-') || cleanBase64.includes('_')) {
            cleanBase64 = cleanBase64.replaceAll('-', '+').replaceAll('_', '/');
            while (cleanBase64.length % 4 !== 0) {
                cleanBase64 += '=';
            }
        }

        const binString = atob(cleanBase64);
        const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0) as number);
        return { output: new TextDecoder().decode(bytes), preview, pureBase64: cleanBase64 };
    } catch (e) {
        console.error(e);
        return { output: t('tools.base64.decode_error'), preview: null, pureBase64: '' };
    }
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const SAMPLE_TEXT = '{\n  "app": "VyloServe",\n  "feature": "Base64 Encoder",\n  "status": "active"\n}';
const SAMPLE_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwZmQ2YTIiLz48L3N2Zz4=';

interface FileMeta {
    name: string;
    size: number;
    type: string;
}

export default function Base64Main() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');
    const [isUrlSafe, setIsUrlSafe] = useState(false);
    const [lineWrap, setLineWrap] = useState<number>(0);
    
    // States
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [pureBase64, setPureBase64] = useState('');
    const [fileDataUrl, setFileDataUrl] = useState('');
    const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // --- LOGIKA ENCODE & DECODE AMAN (UTF-8 SAFE) ---
    useEffect(() => {
        if (mode === 'encode') {
            setPreviewImage(null);
            setPureBase64('');
            if (fileMeta && fileDataUrl) {
                // If a file is attached in encode mode, output is the base64 data URL
                let finalB64 = fileDataUrl;
                if (isUrlSafe) {
                    finalB64 = finalB64.replaceAll('+', '-').replaceAll('/', '_');
                }
                setOutputText(applyLineWrap(finalB64, lineWrap));
            } else {
                setOutputText(encodeTextToBase64(inputText, isUrlSafe, lineWrap, t));
            }
            return;
        }

        const { output, preview, pureBase64: cleanB64 } = decodeBase64Input(inputText, isUrlSafe, t);
        setOutputText(output);
        setPreviewImage(preview);
        setPureBase64(cleanB64);
    }, [inputText, mode, fileDataUrl, fileMeta, isUrlSafe, lineWrap, t]);

    // --- HANDLER FILE ---
    const handleFileSelected = (file: File, dataUrl: string) => {
        setFileMeta({ name: file.name, size: file.size, type: file.type });
        setFileDataUrl(dataUrl);

        if (mode === 'decode') {
            // In decode mode, if user uploads a file, attempt to read as base64 string
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (text) {
                    setInputText(text.trim());
                } else {
                    setInputText(dataUrl);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleClearFile = () => {
        setFileMeta(null);
        setFileDataUrl('');
    };

    const handleCopy = () => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText);
        showToast(t('tools.base64.copied_to_clipboard'), 'success');
    };

    const handlePaste = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (clip) setInputText(clip);
        } catch {
            // clipboard access denied
        }
    };

    const handleLoadSample = () => {
        handleClearFile();
        if (mode === 'encode') {
            setInputText(SAMPLE_TEXT);
        } else {
            setInputText(SAMPLE_BASE64);
        }
    };

    const clearAll = () => {
        setInputText('');
        setOutputText('');
        setPureBase64('');
        setFileDataUrl('');
        setFileMeta(null);
        setPreviewImage(null);
    };

    const handleDownloadDecodedFile = async () => {
        if (!pureBase64) return;
        let ext = 'bin';
        if (fileMeta?.type) {
            const parts = fileMeta.type.split('/');
            if (parts[1]) ext = parts[1].replace('+xml', '');
        } else if (previewImage?.includes('image/png')) {
            ext = 'png';
        } else if (previewImage?.includes('image/jpeg')) {
            ext = 'jpg';
        } else if (previewImage?.includes('image/svg')) {
            ext = 'svg';
        }
        const defaultFilename = `vyloserve_decoded_${Date.now()}.${ext}`;

        const api = (window as any).pywebview?.api;
        if (api?.save_base64_file) {
            try {
                const res = await api.save_base64_file(defaultFilename, pureBase64, ['All files (*.*)']);
                if (res?.status === 'success') {
                    showToast(t('tools.base64.download_success'), 'success');
                }
                return;
            } catch (e) {
                console.error('Failed to save file via desktop API:', e);
            }
        }

        // Fallback: browser blob download
        try {
            const binStr = atob(pureBase64.replaceAll('-', '+').replaceAll('_', '/'));
            const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
            const blob = new Blob([bytes]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultFilename;
            a.click();
            URL.revokeObjectURL(url);
            showToast(t('tools.base64.download_success'), 'success');
        } catch (e) {
            console.error('Blob download failed:', e);
        }
    };

    const rawSizeLabel = (() => {
        if (mode !== 'encode') return formatBytes(new Blob([outputText]).size);
        if (fileMeta) return formatBytes(fileMeta.size);
        return formatBytes(new Blob([inputText]).size);
    })();

    const base64SizeLabel = mode === 'encode' ? formatBytes(new Blob([outputText]).size) : formatBytes(new Blob([inputText]).size);

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="code_blocks"
                title={t('tools.base64.page_title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.base64.subtitle')}</>}
            />

            <Tabs
                tabs={[
                    { value: 'encode', label: t('tools.base64.tab_encode') },
                    { value: 'decode', label: t('tools.base64.tab_decode') },
                ]}
                value={mode}
                onChange={(m) => {
                    setMode(m);
                    clearAll();
                }}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 w-full min-w-0">
                {/* LEFT COLUMN: Input & Output Cards (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    
                    {/* Card 1: Universal Dual-Input */}
                    <Card
                        title={mode === 'encode' ? t('tools.base64.input_card_title', { label: t('tools.base64.label_text') }) : t('tools.base64.input_card_title', { label: t('tools.base64.label_base64_string') })}
                        status={t('tools.base64.status_active')}
                        gridCols="grid-cols-1"
                    >
                        <div className="w-full min-w-0 flex flex-col gap-3">
                            
                            {/* Toolbar: URL-Safe, Line Wrap, Sample, Paste, Clear */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* URL Safe Toggle */}
                                    <label htmlFor="b64_url_safe" className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-400">
                                        <input
                                            id="b64_url_safe"
                                            type="checkbox"
                                            checked={isUrlSafe}
                                            onChange={(e) => setIsUrlSafe(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-primary border-slate-300 dark:border-slate-700 focus:ring-primary cursor-pointer"
                                        />
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{t('tools.base64.url_safe')}</span>
                                    </label>

                                    {/* Line Wrap (Encode Mode) */}
                                    {mode === 'encode' && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span>{t('tools.base64.line_wrap')}:</span>
                                            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100/50 dark:bg-slate-900/50">
                                                <button
                                                    type="button"
                                                    onClick={() => setLineWrap(0)}
                                                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${lineWrap === 0 ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                                                >
                                                    {t('tools.base64.wrap_none')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLineWrap(64)}
                                                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${lineWrap === 64 ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                                                >
                                                    {t('tools.base64.wrap_64')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLineWrap(76)}
                                                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors cursor-pointer ${lineWrap === 76 ? 'bg-white dark:bg-slate-800 text-primary shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                                                >
                                                    {t('tools.base64.wrap_76')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions: Sample, Paste, Clear */}
                                <div className="flex items-center gap-1.5">
                                    <Button variant="secondary" size="sm" icon="auto_fix_high" onClick={handleLoadSample}>
                                        {t('tools.base64.sample')}
                                    </Button>
                                    <Button variant="secondary" size="sm" icon="content_paste" onClick={handlePaste}>
                                        {t('tools.base64.paste')}
                                    </Button>
                                    <Button variant="secondary" size="sm" icon="clear" onClick={clearAll} disabled={!inputText && !fileMeta}>
                                        {t('tools.base64.clear')}
                                    </Button>
                                </div>
                            </div>

                            {/* Text Input Area */}
                            <textarea
                                value={inputText}
                                onChange={(e) => {
                                    setInputText(e.target.value);
                                    if (fileMeta) handleClearFile();
                                }}
                                placeholder={mode === 'encode' ? t('tools.base64.type_text_here') : t('tools.base64.paste_base64_here')}
                                rows={4}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-y break-all font-mono"
                                spellCheck="false"
                            />

                            {/* Integrated File Dropzone */}
                            <CompactFileDropzone
                                id="base64_file_input"
                                compact={true}
                                currentFileName={fileMeta?.name}
                                currentFileSize={fileMeta?.size}
                                currentFileType={fileMeta?.type}
                                onFileSelected={handleFileSelected}
                                onClearFile={handleClearFile}
                                promptText={mode === 'encode' ? t('tools.base64.drop_file_hint') : t('tools.base64.universal_decode_prompt')}
                            />

                            {/* Stats Footer */}
                            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
                                <span>{t('tools.base64.chars_count', { chars: inputText.length, bytes: getByteLength(inputText) })}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Card 2: Output */}
                    <Card
                        title={t('tools.base64.output_card_title', { label: mode === 'encode' ? t('tools.base64.label_base64') : t('tools.base64.label_text') })}
                        status={t('tools.base64.status_result')}
                        gridCols="grid-cols-1"
                    >
                        <div className="relative w-full min-w-0 flex flex-col gap-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {mode === 'encode' ? t('tools.base64.label_base64') : t('tools.base64.label_text')}
                                </span>
                                <div className="flex items-center gap-2">
                                    {mode === 'decode' && pureBase64 && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon="download"
                                            onClick={handleDownloadDecodedFile}
                                        >
                                            {t('tools.base64.download_file')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="content_copy"
                                        onClick={handleCopy}
                                        disabled={!outputText || outputText.startsWith('Error')}
                                    >
                                        {t('tools.base64.copy')}
                                    </Button>
                                </div>
                            </div>

                            <textarea
                                value={outputText}
                                readOnly
                                rows={5}
                                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm outline-none text-slate-900 dark:text-white resize-y break-all font-mono"
                                spellCheck="false"
                            />

                            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
                                <span>{t('tools.base64.chars_count', { chars: outputText.length, bytes: getByteLength(outputText) })}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* RIGHT COLUMN: Payload Info Card (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <div className="sticky xl:top-6">
                        <Card
                            title={t('tools.base64.payload_info')}
                            status={outputText && !outputText.startsWith('Error') ? t('tools.base64.status_valid') : t('tools.base64.status_waiting')}
                            gridCols="grid-cols-1"
                        >
                            <div className="flex flex-col gap-4 w-full min-w-0">
                                {fileMeta && (
                                    <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.file_metadata')}</span>
                                        <div className="flex items-center justify-between mt-1 w-full min-w-0">
                                            <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate pr-2">{fileMeta.name}</span>
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold shrink-0">
                                                {fileMeta.type || t('tools.base64.unknown_type')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.size_estimation')}</span>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[11px] text-slate-500">{t('tools.base64.raw_size')}</span>
                                            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200">
                                                {rawSizeLabel}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
                                            <span className="text-[11px] text-slate-500">{t('tools.base64.base64_size')}</span>
                                            <span className="font-mono text-sm font-semibold text-primary">
                                                {base64SizeLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {previewImage && (
                                    <div className="flex flex-col gap-1 w-full min-w-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.image_preview')}</span>
                                        <div className="mt-2 w-full h-40 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-2">
                                            <img src={previewImage} alt={t('tools.base64.preview_alt')} className="max-w-full max-h-full object-contain shadow-sm" />
                                        </div>
                                    </div>
                                )}

                                {!previewImage && !outputText && (
                                    <div className="flex items-center gap-2 mt-2 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <span className="material-symbols-outlined text-slate-400 text-[18px]">data_object</span>
                                        <span className="text-xs text-slate-500 leading-relaxed">{t('tools.base64.info_placeholder')}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
