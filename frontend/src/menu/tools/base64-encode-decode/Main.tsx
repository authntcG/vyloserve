import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import { useToast } from '../../../components/ToastContext';

export default function Base64Main() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');
    const [inputType, setInputType] = useState<'text' | 'file'>('text');
    
    // States
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [fileDataUrl, setFileDataUrl] = useState('');
    const [fileMeta, setFileMeta] = useState<{ name: string, size: number, type: string } | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- LOGIKA ENCODE & DECODE AMAN (UTF-8 SAFE) ---
    useEffect(() => {
        if (mode === 'encode') {
            setPreviewImage(null);
            if (inputType === 'text') {
                if (!inputText) return setOutputText('');
                try {
                    const bytes = new TextEncoder().encode(inputText);
                    const binString = Array.from(bytes, byte => String.fromCodePoint(byte)).join("");
                    setOutputText(btoa(binString));
                } catch (e){ console.error(e);
                    setOutputText(t('tools.base64.encode_error'));
                }
            } else {
                // Mode File: Tampilkan Data URL
                setOutputText(fileDataUrl);
            }
        } else {
            // Mode Decode
            if (!inputText) {
                setOutputText('');
                setPreviewImage(null);
                return;
            }

            try {
                // Deteksi dan bersihkan Data URI Header jika ada
                let base64String = inputText.trim();
                const dataUriMatch = base64String.match(/^data:(.*?);base64,(.*)$/);
                
                if (dataUriMatch) {
                    const mimeType = dataUriMatch[1];
                    base64String = dataUriMatch[2];
                    if (mimeType.startsWith('image/')) setPreviewImage(inputText);
                    else setPreviewImage(null);
                } else {
                    setPreviewImage(null);
                }

                // Coba decode sebagai teks
                const binString = atob(base64String);
                const bytes = Uint8Array.from(binString, m => m.codePointAt(0) as number);
                setOutputText(new TextDecoder().decode(bytes));
            } catch (e){ console.error(e);
                setOutputText(t('tools.base64.decode_error'));
                setPreviewImage(null);
            }
        }
    }, [inputText, mode, inputType, fileDataUrl]);

    // --- HANDLER FILE ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileMeta({ name: file.name, size: file.size, type: file.type });
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setFileDataUrl(event.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleCopy = () => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText);
        showToast(t('tools.base64.copied_to_clipboard'), "success");
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024, dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const clearAll = () => {
        setInputText('');
        setOutputText('');
        setFileDataUrl('');
        setFileMeta(null);
        setPreviewImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="code_blocks"
                title="Base64 Encoder / Decoder"
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.base64.subtitle')}</>}
            />

            <div className="flex gap-1 overflow-x-auto no-scrollbar mb-6 border-b border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => { setMode('encode'); clearAll(); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${mode === 'encode' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Encode Base64</button>
                <button type="button" onClick={() => { setMode('decode'); setInputType('text'); clearAll(); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${mode === 'decode' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Decode Base64</button>
            </div>

            {mode === 'encode' && (
                <div className="flex gap-2 mb-6">
                    <button type="button" onClick={() => { setInputType('text'); clearAll(); }} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${inputType === 'text' ? 'bg-primary border-primary text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{t('tools.base64.text_input')}</button>
                    <button type="button" onClick={() => { setInputType('file'); clearAll(); }} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center gap-1 ${inputType === 'file' ? 'bg-primary border-primary text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined text-[14px]">upload_file</span> {t('tools.base64.file_input')}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 w-full min-w-0">
                
                {/* Editor Section (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    <Card title={`Input ${mode === 'encode' ? (inputType === 'text' ? 'Text' : 'File') : 'Base64 String'}`} status={t('tools.base64.status_active')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col">
                            {mode === 'encode' && inputType === 'file' ? (
                                <div className="w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative overflow-hidden">
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">cloud_upload</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.base64.drag_drop_file')}</span>
                                    {fileMeta && <span className="text-xs text-primary font-mono mt-1">{fileMeta.name}</span>}
                                </div>
                            ) : (
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={mode === 'encode' ? t('tools.base64.type_text_here') : t('tools.base64.paste_base64_here')}
                                    className="w-full h-36 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none break-all"
                                    spellCheck="false"
                                ></textarea>
                            )}
                        </div>
                    </Card>

                    <Card title={`Output ${mode === 'encode' ? 'Base64' : 'Text'}`} status={t('tools.base64.status_result')} gridCols="grid-cols-1">
                        <div className="relative w-full min-w-0 flex flex-col">
                            <textarea
                                value={outputText}
                                readOnly
                                className="w-full h-36 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm outline-none text-slate-900 dark:text-white resize-none break-all"
                                spellCheck="false"
                            ></textarea>
                            <button type="button" onClick={handleCopy} disabled={!outputText || outputText.startsWith('Error')} className="absolute bottom-3 right-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium py-1.5 px-3 rounded shadow-sm transition-all flex items-center gap-1 disabled:opacity-50">
                                <span className="material-symbols-outlined text-[16px]">content_copy</span> {t('tools.base64.copy')}
                            </button>
                        </div>
                    </Card>
                </div>

                {/* Info & Visualizer Section (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <Card title={t('tools.base64.payload_info')} status={outputText && !outputText.startsWith('Error') ? t('tools.base64.status_valid') : t('tools.base64.status_waiting')} gridCols="grid-cols-1">
                        <div className="flex flex-col gap-4 w-full min-w-0">
                            
                            {/* File Metadata (Khusus Encode File) */}
                            {mode === 'encode' && inputType === 'file' && fileMeta && (
                                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.file_metadata')}</span>
                                    <div className="flex items-center justify-between mt-1 w-full min-w-0">
                                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate pr-2">{fileMeta.name}</span>
                                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold shrink-0">{fileMeta.type || 'unknown'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Data Size Comparison */}
                            <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3 w-full min-w-0">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.size_estimation')}</span>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[11px] text-slate-500">{t('tools.base64.raw_size')}</span>
                                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200">
                                            {mode === 'encode' 
                                                ? (inputType === 'file' ? formatBytes(fileMeta?.size || 0) : formatBytes(new Blob([inputText]).size)) 
                                                : formatBytes(new Blob([outputText]).size)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
                                        <span className="text-[11px] text-slate-500">{t('tools.base64.base64_size')}</span>
                                        <span className="font-mono text-sm font-semibold text-primary">
                                            {mode === 'encode' 
                                                ? formatBytes(new Blob([outputText]).size) 
                                                : formatBytes(new Blob([inputText]).size)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Image Preview */}
                            {previewImage && (
                                <div className="flex flex-col gap-1 w-full min-w-0">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('tools.base64.image_preview')}</span>
                                    <div className="mt-2 w-full h-40 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjBmMGYwIiAvPgo8cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjBmMGYwIiAvPjwvc3ZnPg==')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWUxZTFlIiAvPgo8cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWUxZTFlIiAvPjwvc3ZnPg==')] flex items-center justify-center p-2">
                                        <img src={previewImage} alt="Base64 Preview" className="max-w-full max-h-full object-contain shadow-sm" />
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
    );
}