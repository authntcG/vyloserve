import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import QRCodeStyling from 'qr-code-styling';
import type { DotType, CornerSquareType, FileExtension } from 'qr-code-styling';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import { useToast } from '../../../components/ToastContext';

export default function QrMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // --- STATES: DATA KONTEN ---
    const [contentType, setContentType] = useState<'url' | 'text' | 'email' | 'wifi'>('url');
    const [inputUrl, setInputUrl] = useState('https://vyloserve.com');
    const [inputText, setInputText] = useState('');
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });
    const [wifiData, setWifiData] = useState({ ssid: '', password: '', encryption: 'WPA', hidden: false });

    // --- STATES: VISUAL & LOGO ---
    const [size, setSize] = useState(240);
    const [margin, setMargin] = useState(10);
    const [dotsType, setDotsType] = useState<DotType>('rounded');
    const [dotsColor, setDotsColor] = useState('#0f172a'); // slate-900
    const [cornerType, setCornerType] = useState<CornerSquareType>('extra-rounded');
    const [cornerColor, setCornerColor] = useState('#0f172a');
    
    const [logo, setLogo] = useState<string | null>(null);
    const [logoSize, setLogoSize] = useState(0.3);
    const [downloadExt, setDownloadExt] = useState<FileExtension>('png');

    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);

    // --- LOGIKA: PEMBUAT DATA MENTAH ---
    const rawData = useMemo(() => {
        switch (contentType) {
            case 'url': return inputUrl || 'https://';
            case 'text': return inputText || 'kosong';
            case 'email': 
                return `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
            case 'wifi':
                return `WIFI:T:${wifiData.encryption};S:${wifiData.ssid};P:${wifiData.password};H:${wifiData.hidden};;`;
            default: return 'https://vyloserve.com';
        }
    }, [contentType, inputUrl, inputText, emailData, wifiData]);

    // --- INISIALISASI & UPDATE QR CODE ---
    useEffect(() => {
        if (!qrCode.current) {
            qrCode.current = new QRCodeStyling({
                width: size, height: size, margin: margin,
                data: rawData,
                imageOptions: { hideBackgroundDots: true, imageSize: logoSize, margin: 5 },
                dotsOptions: { type: dotsType, color: dotsColor },
                cornersSquareOptions: { type: cornerType, color: cornerColor },
                backgroundOptions: { color: '#ffffff' }
            });
            if (qrRef.current) qrCode.current.append(qrRef.current);
        } else {
            qrCode.current.update({
                width: size, height: size, margin: margin,
                data: rawData,
                image: logo || undefined,
                imageOptions: { hideBackgroundDots: true, imageSize: logoSize, margin: 5 },
                dotsOptions: { type: dotsType, color: dotsColor },
                cornersSquareOptions: { type: cornerType, color: cornerColor }
            });
        }
    }, [rawData, size, margin, dotsType, dotsColor, cornerType, cornerColor, logo, logoSize]);

    // --- HANDLER: UPLOAD LOGO ---
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return setLogo(null);
        const reader = new FileReader();
        reader.onload = (event) => setLogo(event.target?.result as string);
        reader.readAsDataURL(file);
    };

    // --- HANDLER: DOWNLOAD ---
    const handleDownload = () => {
        if (qrCode.current) {
            qrCode.current.download({ name: `vyloserve_qr_${new Date().getTime()}`, extension: downloadExt });
            showToast(`${t('tools.qr.download_success')} ${downloadExt.toUpperCase()}!`, "success");
        }
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="qr_code_2"
                title={t('tools.qr.title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.qr.subtitle')}</>}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 mt-6 w-full min-w-0">
                
                {/* SETTINGS SECTION (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    
                    {/* Card 1: Data Konten */}
                    <Card title={t('tools.qr.data_qr_code')} status={t('tools.qr.input')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.content_type')}</label>
                                <select value={contentType} onChange={(e) => setContentType(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 outline-none cursor-pointer">
                                    <option value="url">{t('tools.qr.type_url')}</option>
                                    <option value="text">{t('tools.qr.type_text')}</option>
                                    <option value="email">{t('tools.qr.type_email')}</option>
                                    <option value="wifi">{t('tools.qr.type_wifi')}</option>
                                </select>
                            </div>

                            {/* Dynamic Inputs */}
                            {contentType === 'url' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.enter_url')}</label>
                                    <input type="url" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                                </div>
                            )}

                            {contentType === 'text' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.enter_text')}</label>
                                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none"></textarea>
                                </div>
                            )}

                            {contentType === 'email' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.email_to')}</label>
                                        <input type="email" value={emailData.to} onChange={(e) => setEmailData({...emailData, to: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.email_subject')}</label>
                                        <input type="text" value={emailData.subject} onChange={(e) => setEmailData({...emailData, subject: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.email_body')}</label>
                                        <textarea value={emailData.body} onChange={(e) => setEmailData({...emailData, body: e.target.value})} rows={2} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none"></textarea>
                                    </div>
                                </div>
                            )}

                            {contentType === 'wifi' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.wifi_ssid')}</label>
                                        <input type="text" value={wifiData.ssid} onChange={(e) => setWifiData({...wifiData, ssid: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.password')}</label>
                                        <input type="text" value={wifiData.password} onChange={(e) => setWifiData({...wifiData, password: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.security')}</label>
                                        <select value={wifiData.encryption} onChange={(e) => setWifiData({...wifiData, encryption: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 outline-none cursor-pointer">
                                            <option value="WPA">WPA/WPA2</option>
                                            <option value="WEP">WEP</option>
                                            <option value="nopass">{t('tools.qr.no_password')}</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('tools.qr.raw_data_output')}</span>
                                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">{rawData}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Card 2: Desain Visual */}
                    <Card title={t('tools.qr.visual_design')} status={t('tools.qr.design_status')} gridCols="grid-cols-1 md:grid-cols-2">
                        <div className="flex flex-col gap-2 w-full min-w-0">
                            <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.dot_pattern')}</label>
                            <div className="flex items-center gap-2">
                                <select value={dotsType} onChange={(e) => setDotsType(e.target.value as DotType)} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 outline-none cursor-pointer">
                                    <option value="square">{t('tools.qr.square')}</option>
                                    <option value="rounded">{t('tools.qr.rounded')}</option>
                                    <option value="dots">{t('tools.qr.dots')}</option>
                                    <option value="classy">{t('tools.qr.classy')}</option>
                                </select>
                                <input type="color" value={dotsColor} onChange={(e) => setDotsColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-950 shrink-0" />
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full min-w-0">
                            <label className="text-xs font-medium text-slate-500 uppercase">{t('tools.qr.corner_pattern')}</label>
                            <div className="flex items-center gap-2">
                                <select value={cornerType} onChange={(e) => setCornerType(e.target.value as CornerSquareType)} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 outline-none cursor-pointer">
                                    <option value="square">{t('tools.qr.square')}</option>
                                    <option value="extra-rounded">{t('tools.qr.extra_rounded')}</option>
                                    <option value="dot">{t('tools.qr.large_dot')}</option>
                                </select>
                                <input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-950 shrink-0" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full min-w-0 mt-2">
                            <label className="flex justify-between text-xs font-medium text-slate-500 uppercase">
                                <span>{t('tools.qr.resolution')}</span>
                                <span className="font-mono text-primary">{size}px</span>
                            </label>
                            <input type="range" min="200" max="600" step="20" value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full min-w-0 mt-2">
                            <label className="flex justify-between text-xs font-medium text-slate-500 uppercase">
                                <span>{t('tools.qr.white_margin')}</span>
                                <span className="font-mono text-primary">{margin}px</span>
                            </label>
                            <input type="range" min="0" max="50" step="5" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700" />
                        </div>
                    </Card>

                    {/* Card 3: Logo */}
                    <Card title={t('tools.qr.insert_logo')} status={t('tools.qr.optional')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col gap-4">
                            <input type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-primary hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 cursor-pointer" />
                            
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <label className="flex justify-between text-xs font-medium text-slate-500 uppercase">
                                    <span>{t('tools.qr.logo_scale')}</span>
                                    <span className="font-mono text-primary">{logoSize}</span>
                                </label>
                                <input type="range" min="0.1" max="0.4" step="0.05" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} disabled={!logo} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 disabled:opacity-50" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* PREVIEW SECTION (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <div className="sticky xl:top-6">
                        <Card title={t('tools.qr.live_preview')} status={t('tools.qr.ready')} gridCols="grid-cols-1">
                            <div className="flex flex-col items-center justify-center gap-6 w-full min-w-0 py-6">
                                
                                {/* Tempat Render Canvas */}
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 shadow-inner flex items-center justify-center overflow-hidden">
                                    <div ref={qrRef} className="rounded-lg overflow-hidden shadow-md max-w-[280px] [&>canvas]:max-w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>svg]:h-auto"></div>
                                </div>

                                <div className="flex items-center gap-2 w-full max-w-[280px]">
                                    <select value={downloadExt} onChange={(e) => setDownloadExt(e.target.value as FileExtension)} className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 outline-none cursor-pointer shrink-0">
                                        <option value="png">PNG</option>
                                        <option value="jpeg">JPG</option>
                                        <option value="svg">SVG</option>
                                    </select>
                                    
                                    <button type="button" onClick={handleDownload} className="flex-1 bg-primary hover:bg-blue-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined text-[18px]">download</span> {t('tools.qr.download')}
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}