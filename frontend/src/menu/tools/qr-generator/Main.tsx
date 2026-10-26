import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import QRCodeStyling from 'qr-code-styling';
import type { DotType, CornerSquareType, FileExtension, ErrorCorrectionLevel } from 'qr-code-styling';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Tabs from '../../../components/Tabs';
import Select from '../../../components/Select';
import FieldLabel from '../../../components/FieldLabel';
import CompactFileDropzone from '../../../components/CompactFileDropzone';
import { useToast } from '../../../context/ToastContext';

type TopTabType = 'text_url' | 'wifi' | 'contact';
type ContactSubType = 'vcard' | 'email' | 'sms';

export default function QrMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // --- STATES: DATA KONTEN ---
    const [topTab, setTopTab] = useState<TopTabType>('text_url');
    const [contactSub, setContactSub] = useState<ContactSubType>('vcard');
    const [inputUrlText, setInputUrlText] = useState('https://vyloserve.com');
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });
    const [wifiData, setWifiData] = useState({ ssid: '', password: '', encryption: 'WPA', hidden: false });
    const [vcardData, setVcardData] = useState({ name: '', phone: '', email: '', org: '', url: '' });
    const [smsData, setSmsData] = useState({ phone: '', message: '' });

    // --- STATES: VISUAL & LOGO ---
    const [eccLevel, setEccLevel] = useState<ErrorCorrectionLevel>('M');
    const [size, setSize] = useState(240);
    const [margin, setMargin] = useState(10);
    const [dotsType, setDotsType] = useState<DotType>('rounded');
    const [dotsColor, setDotsColor] = useState('#0f172a');
    const [cornerType, setCornerType] = useState<CornerSquareType>('extra-rounded');
    const [cornerColor, setCornerColor] = useState('#0f172a');
    
    const [logo, setLogo] = useState<string | null>(null);
    const [logoName, setLogoName] = useState<string | null>(null);
    const [logoSize, setLogoSize] = useState(0.3);
    const [downloadExt, setDownloadExt] = useState<FileExtension>('png');

    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);

    // --- DETEKSI URL ---
    const isUrl = useMemo(() => {
        const trimmed = inputUrlText.trim().toLowerCase();
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('ftp://');
    }, [inputUrlText]);

    // --- LOGIKA: PEMBUAT DATA MENTAH ---
    const rawData = useMemo(() => {
        switch (topTab) {
            case 'text_url':
                return inputUrlText || 'kosong';
            case 'wifi':
                return `WIFI:T:${wifiData.encryption};S:${wifiData.ssid};P:${wifiData.password};H:${wifiData.hidden};;`;
            case 'contact': {
                if (contactSub === 'email') {
                    return `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
                }
                if (contactSub === 'sms') {
                    return `SMSTO:${smsData.phone}:${smsData.message}`;
                }
                const parts = [
                    'BEGIN:VCARD',
                    'VERSION:3.0',
                    vcardData.name ? `FN:${vcardData.name}` : '',
                    vcardData.org ? `ORG:${vcardData.org}` : '',
                    vcardData.phone ? `TEL:${vcardData.phone}` : '',
                    vcardData.email ? `EMAIL:${vcardData.email}` : '',
                    vcardData.url ? `URL:${vcardData.url}` : '',
                    'END:VCARD'
                ].filter(Boolean);
                return parts.join('\n');
            }
            default:
                return 'https://vyloserve.com';
        }
    }, [topTab, contactSub, inputUrlText, emailData, wifiData, vcardData, smsData]);

    // --- INISIALISASI & UPDATE QR CODE ---
    useEffect(() => {
        if (!qrCode.current) {
            qrCode.current = new QRCodeStyling({
                width: size,
                height: size,
                margin: margin,
                data: rawData,
                qrOptions: { errorCorrectionLevel: eccLevel },
                imageOptions: { hideBackgroundDots: true, imageSize: logoSize, margin: 5 },
                dotsOptions: { type: dotsType, color: dotsColor },
                cornersSquareOptions: { type: cornerType, color: cornerColor },
                backgroundOptions: { color: '#ffffff' }
            });
            if (qrRef.current) {
                qrCode.current.append(qrRef.current);
            }
        } else {
            qrCode.current.update({
                width: size,
                height: size,
                margin: margin,
                data: rawData,
                image: logo || undefined,
                qrOptions: { errorCorrectionLevel: eccLevel },
                imageOptions: { hideBackgroundDots: true, imageSize: logoSize, margin: 5 },
                dotsOptions: { type: dotsType, color: dotsColor },
                cornersSquareOptions: { type: cornerType, color: cornerColor }
            });
        }
    }, [rawData, size, margin, dotsType, dotsColor, cornerType, cornerColor, logo, logoSize, eccLevel]);

    // --- TOOLBAR ACTIONS: SAMPLE, PASTE, CLEAR ---
    const handleLoadSample = () => {
        switch (topTab) {
            case 'text_url':
                setInputUrlText('https://vyloserve.com');
                break;
            case 'wifi':
                setWifiData({ ssid: 'VyloServe_Office', password: 'SecurePassword2026!', encryption: 'WPA', hidden: false });
                break;
            case 'contact':
                if (contactSub === 'vcard') {
                    setVcardData({
                        name: 'Jane Doe',
                        org: 'VyloServe Team',
                        phone: '+1-555-0199',
                        email: 'jane@vyloserve.com',
                        url: 'https://vyloserve.com'
                    });
                } else if (contactSub === 'email') {
                    setEmailData({ to: 'team@vyloserve.com', subject: 'Inquiry', body: 'Hello VyloServe team!' });
                } else if (contactSub === 'sms') {
                    setSmsData({ phone: '+1-555-0199', message: 'Hello from VyloServe QR Generator!' });
                }
                break;
        }
    };

    const handlePaste = async () => {
        try {
            const clipText = await navigator.clipboard.readText();
            if (!clipText) return;
            switch (topTab) {
                case 'text_url':
                    setInputUrlText(clipText);
                    break;
                case 'wifi':
                    setWifiData((prev) => ({ ...prev, ssid: clipText }));
                    break;
                case 'contact':
                    if (contactSub === 'vcard') {
                        setVcardData((prev) => ({ ...prev, name: clipText }));
                    } else if (contactSub === 'email') {
                        setEmailData((prev) => ({ ...prev, to: clipText }));
                    } else if (contactSub === 'sms') {
                        setSmsData((prev) => ({ ...prev, message: clipText }));
                    }
                    break;
            }
        } catch {
            // best-effort paste
        }
    };

    const handleClear = () => {
        switch (topTab) {
            case 'text_url':
                setInputUrlText('');
                break;
            case 'wifi':
                setWifiData({ ssid: '', password: '', encryption: 'WPA', hidden: false });
                break;
            case 'contact':
                if (contactSub === 'vcard') {
                    setVcardData({ name: '', phone: '', email: '', org: '', url: '' });
                } else if (contactSub === 'email') {
                    setEmailData({ to: '', subject: '', body: '' });
                } else if (contactSub === 'sms') {
                    setSmsData({ phone: '', message: '' });
                }
                break;
        }
    };

    // --- HANDLER: LOGO SELECTION VIA DROPZONE ---
    const handleLogoSelected = (_file: File, dataUrl: string) => {
        setLogo(dataUrl);
        setLogoName(_file.name);
    };

    const handleLogoClear = () => {
        setLogo(null);
        setLogoName(null);
    };

    // --- HANDLER: COPY IMAGE TO CLIPBOARD ---
    const handleCopyImage = async () => {
        try {
            const canvas = qrRef.current?.querySelector('canvas');
            if (canvas && 'toBlob' in canvas) {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        showToast(t('tools.qr.copy_image_failed'), 'error');
                        return;
                    }
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast(t('tools.qr.copy_image_success'), 'success');
                    } catch {
                        showToast(t('tools.qr.copy_image_failed'), 'error');
                    }
                }, 'image/png');
            } else if (qrCode.current) {
                const rawBlob = await qrCode.current.getRawData('png');
                if (rawBlob && navigator.clipboard?.write) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': rawBlob as Blob })
                    ]);
                    showToast(t('tools.qr.copy_image_success'), 'success');
                } else {
                    showToast(t('tools.qr.copy_image_failed'), 'error');
                }
            }
        } catch {
            showToast(t('tools.qr.copy_image_failed'), 'error');
        }
    };

    // --- HANDLER: COPY RAW DATA ---
    const handleCopyRaw = async () => {
        try {
            await navigator.clipboard.writeText(rawData);
            showToast(t('common.copied_to_clipboard') || 'Copied to clipboard', 'success');
        } catch {
            // ignore clipboard error
        }
    };

    // --- HANDLER: DOWNLOAD ---
    const handleDownload = async () => {
        if (qrCode.current) {
            try {
                const blob = await qrCode.current.getRawData(downloadExt);
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64data = (reader.result as string).split(',')[1];
                    let fileTypes = ['All files (*.*)'];
                    if (downloadExt === 'png') fileTypes = ['PNG Image (*.png)', 'All files (*.*)'];
                    else if (downloadExt === 'jpeg') fileTypes = ['JPEG Image (*.jpeg;*.jpg)', 'All files (*.*)'];
                    else if (downloadExt === 'svg') fileTypes = ['SVG Vector (*.svg)', 'All files (*.*)'];
                    
                    const res = await (window as any).pywebview?.api?.save_base64_file(
                        `vyloserve_qr_${Date.now()}.${downloadExt}`,
                        base64data,
                        fileTypes
                    );
                    if (res?.status === 'success') {
                        showToast(t(res.message, res.args) as string, 'success');
                    } else if (res?.status === 'error') {
                        showToast(t(res.message, res.args) as string, 'error');
                    }
                };
                reader.readAsDataURL(blob as Blob);
            } catch (err) {
                console.error('Failed to generate QR blob:', err);
            }
        }
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <PageHeader
                icon="qr_code_2"
                title={t('tools.qr.title')}
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> {t('tools.qr.subtitle')}</>}
            />

            <Tabs
                tabs={[
                    { value: 'text_url', label: t('tools.qr.type_text_url') },
                    { value: 'wifi', label: t('tools.qr.type_wifi') },
                    { value: 'contact', label: t('tools.qr.type_contact') },
                ]}
                value={topTab}
                onChange={(val) => setTopTab(val as TopTabType)}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-8 w-full min-w-0">
                
                {/* SETTINGS SECTION (Col 7) */}
                <div className="col-span-1 xl:col-span-7 flex flex-col gap-6 w-full min-w-0">
                    
                    {/* Card 1: Data Konten */}
                    <Card title={t('tools.qr.data_qr_code')} status={t('tools.qr.input')} gridCols="grid-cols-1">
                        <div className="w-full min-w-0 flex flex-col gap-4">
                            {/* Actions Toolbar */}
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tools.qr.input')}</span>
                                <div className="flex items-center gap-1.5">
                                    <Button variant="secondary" size="sm" icon="auto_fix_high" onClick={handleLoadSample}>
                                        {t('tools.qr.sample')}
                                    </Button>
                                    <Button variant="secondary" size="sm" icon="content_paste" onClick={handlePaste}>
                                        {t('tools.qr.paste')}
                                    </Button>
                                    <Button variant="secondary" size="sm" icon="clear" onClick={handleClear}>
                                        {t('tools.qr.clear')}
                                    </Button>
                                </div>
                            </div>

                            {/* TAB: TEXT / URL */}
                            {topTab === 'text_url' && (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <FieldLabel htmlFor="qr_input_text_url" size="xs" tone="eyebrow">{t('tools.qr.type_text_url')}</FieldLabel>
                                        {isUrl && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                                                <span className="material-symbols-outlined text-[13px]">link</span>
                                                {t('tools.qr.url_detected')}
                                            </span>
                                        )}
                                    </div>
                                    <textarea
                                        id="qr_input_text_url"
                                        value={inputUrlText}
                                        onChange={(e) => setInputUrlText(e.target.value)}
                                        rows={3}
                                        placeholder="https://... or plain text"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none"
                                    />
                                    <div className="text-right text-[11px] text-slate-400">
                                        {t('tools.qr.chars_count', { count: inputUrlText.length })}
                                    </div>
                                </div>
                            )}

                            {/* TAB: WI-FI */}
                            {topTab === 'wifi' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <FieldLabel htmlFor="qr_wifi_ssid" size="xs" tone="eyebrow">{t('tools.qr.wifi_ssid')}</FieldLabel>
                                        <input
                                            id="qr_wifi_ssid"
                                            type="text"
                                            value={wifiData.ssid}
                                            onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel htmlFor="qr_wifi_password" size="xs" tone="eyebrow">{t('tools.qr.password')}</FieldLabel>
                                        <input
                                            id="qr_wifi_password"
                                            type="text"
                                            value={wifiData.password}
                                            onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel size="xs" tone="eyebrow">{t('tools.qr.security')}</FieldLabel>
                                        <Select
                                            searchable={false}
                                            options={[
                                                { value: 'WPA', label: 'WPA/WPA2' },
                                                { value: 'WEP', label: 'WEP' },
                                                { value: 'nopass', label: t('tools.qr.no_password') },
                                            ]}
                                            value={wifiData.encryption}
                                            onChange={(encryption) => setWifiData({ ...wifiData, encryption })}
                                            placeholder={t('tools.qr.security')}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB: CONTACT & MESSAGING */}
                            {topTab === 'contact' && (
                                <div className="flex flex-col gap-4">
                                    {/* Sub-pill Switcher */}
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit border border-slate-200 dark:border-slate-800" role="group" aria-label={t('tools.qr.type_contact')}>
                                        <button
                                            type="button"
                                            onClick={() => setContactSub('vcard')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                                contactSub === 'vcard'
                                                    ? 'bg-white dark:bg-slate-800 text-primary shadow-sm font-semibold'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">contact_page</span>
                                            {t('tools.qr.contact_vcard')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setContactSub('email')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                                contactSub === 'email'
                                                    ? 'bg-white dark:bg-slate-800 text-primary shadow-sm font-semibold'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">mail</span>
                                            {t('tools.qr.contact_email')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setContactSub('sms')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                                contactSub === 'sms'
                                                    ? 'bg-white dark:bg-slate-800 text-primary shadow-sm font-semibold'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">sms</span>
                                            {t('tools.qr.contact_sms')}
                                        </button>
                                    </div>

                                    {/* Sub-tab 1: vCard */}
                                    {contactSub === 'vcard' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <FieldLabel htmlFor="qr_vcard_name" size="xs" tone="eyebrow">{t('tools.qr.vcard_name')}</FieldLabel>
                                                <input
                                                    id="qr_vcard_name"
                                                    type="text"
                                                    value={vcardData.name}
                                                    onChange={(e) => setVcardData({ ...vcardData, name: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <FieldLabel htmlFor="qr_vcard_phone" size="xs" tone="eyebrow">{t('tools.qr.vcard_phone')}</FieldLabel>
                                                <input
                                                    id="qr_vcard_phone"
                                                    type="tel"
                                                    value={vcardData.phone}
                                                    onChange={(e) => setVcardData({ ...vcardData, phone: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <FieldLabel htmlFor="qr_vcard_email" size="xs" tone="eyebrow">{t('tools.qr.vcard_email')}</FieldLabel>
                                                <input
                                                    id="qr_vcard_email"
                                                    type="email"
                                                    value={vcardData.email}
                                                    onChange={(e) => setVcardData({ ...vcardData, email: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <FieldLabel htmlFor="qr_vcard_org" size="xs" tone="eyebrow">{t('tools.qr.vcard_org')}</FieldLabel>
                                                <input
                                                    id="qr_vcard_org"
                                                    type="text"
                                                    value={vcardData.org}
                                                    onChange={(e) => setVcardData({ ...vcardData, org: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_vcard_url" size="xs" tone="eyebrow">{t('tools.qr.vcard_url')}</FieldLabel>
                                                <input
                                                    id="qr_vcard_url"
                                                    type="url"
                                                    value={vcardData.url}
                                                    onChange={(e) => setVcardData({ ...vcardData, url: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-tab 2: Email */}
                                    {contactSub === 'email' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_email_to" size="xs" tone="eyebrow">{t('tools.qr.email_to')}</FieldLabel>
                                                <input
                                                    id="qr_email_to"
                                                    type="email"
                                                    value={emailData.to}
                                                    onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_email_subject" size="xs" tone="eyebrow">{t('tools.qr.email_subject')}</FieldLabel>
                                                <input
                                                    id="qr_email_subject"
                                                    type="text"
                                                    value={emailData.subject}
                                                    onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_email_body" size="xs" tone="eyebrow">{t('tools.qr.email_body')}</FieldLabel>
                                                <textarea
                                                    id="qr_email_body"
                                                    value={emailData.body}
                                                    onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                                                    rows={2}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-tab 3: SMS */}
                                    {contactSub === 'sms' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_sms_phone" size="xs" tone="eyebrow">{t('tools.qr.sms_phone')}</FieldLabel>
                                                <input
                                                    id="qr_sms_phone"
                                                    type="tel"
                                                    value={smsData.phone}
                                                    onChange={(e) => setSmsData({ ...smsData, phone: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 md:col-span-2">
                                                <FieldLabel htmlFor="qr_sms_message" size="xs" tone="eyebrow">{t('tools.qr.sms_message')}</FieldLabel>
                                                <textarea
                                                    id="qr_sms_message"
                                                    value={smsData.message}
                                                    onChange={(e) => setSmsData({ ...smsData, message: e.target.value })}
                                                    rows={2}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-primary text-slate-900 dark:text-white resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Card 2: Desain Visual & Logo */}
                    <Card title={t('tools.qr.styling_and_logo')} status={t('tools.qr.design_status')} gridCols="grid-cols-1 md:grid-cols-2">
                        {/* Left Column: Visual Styling */}
                        <div className="flex flex-col gap-4 w-full min-w-0">
                            {/* ECC Selector */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel size="xs" tone="eyebrow">{t('tools.qr.ecc_level')}</FieldLabel>
                                <Select
                                    searchable={false}
                                    options={[
                                        { value: 'L', label: t('tools.qr.ecc_l') },
                                        { value: 'M', label: t('tools.qr.ecc_m') },
                                        { value: 'Q', label: t('tools.qr.ecc_q') },
                                        { value: 'H', label: t('tools.qr.ecc_h') },
                                    ]}
                                    value={eccLevel}
                                    onChange={(val) => setEccLevel(val as ErrorCorrectionLevel)}
                                    placeholder={t('tools.qr.ecc_level')}
                                />
                            </div>

                            {/* Dot Pattern */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel size="xs" tone="eyebrow">{t('tools.qr.dot_pattern')}</FieldLabel>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Select
                                            searchable={false}
                                            options={[
                                                { value: 'square', label: t('tools.qr.square') },
                                                { value: 'rounded', label: t('tools.qr.rounded') },
                                                { value: 'dots', label: t('tools.qr.dots') },
                                                { value: 'classy', label: t('tools.qr.classy') },
                                            ]}
                                            value={dotsType}
                                            onChange={setDotsType}
                                            placeholder={t('tools.qr.dot_pattern')}
                                        />
                                    </div>
                                    <input
                                        type="color"
                                        value={dotsColor}
                                        onChange={(e) => setDotsColor(e.target.value)}
                                        aria-label={t('tools.qr.dot_pattern')}
                                        className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-950 shrink-0"
                                    />
                                </div>
                            </div>
                            
                            {/* Corner Pattern */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel size="xs" tone="eyebrow">{t('tools.qr.corner_pattern')}</FieldLabel>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Select
                                            searchable={false}
                                            options={[
                                                { value: 'square', label: t('tools.qr.square') },
                                                { value: 'extra-rounded', label: t('tools.qr.extra_rounded') },
                                                { value: 'dot', label: t('tools.qr.large_dot') },
                                            ]}
                                            value={cornerType}
                                            onChange={setCornerType}
                                            placeholder={t('tools.qr.corner_pattern')}
                                        />
                                    </div>
                                    <input
                                        type="color"
                                        value={cornerColor}
                                        onChange={(e) => setCornerColor(e.target.value)}
                                        aria-label={t('tools.qr.corner_pattern')}
                                        className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-950 shrink-0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Sizing & Logo */}
                        <div className="flex flex-col gap-4 w-full min-w-0">
                            {/* Resolution */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel htmlFor="qr_resolution" size="xs" tone="eyebrow" className="flex justify-between">
                                    <span>{t('tools.qr.resolution')}</span>
                                    <span className="font-mono text-primary">{size}px</span>
                                </FieldLabel>
                                <input
                                    id="qr_resolution"
                                    type="range"
                                    min="200"
                                    max="600"
                                    step="20"
                                    value={size}
                                    onChange={(e) => setSize(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                                />
                            </div>
                            
                            {/* Margin */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel htmlFor="qr_white_margin" size="xs" tone="eyebrow" className="flex justify-between">
                                    <span>{t('tools.qr.white_margin')}</span>
                                    <span className="font-mono text-primary">{margin}px</span>
                                </FieldLabel>
                                <input
                                    id="qr_white_margin"
                                    type="range"
                                    min="0"
                                    max="50"
                                    step="5"
                                    value={margin}
                                    onChange={(e) => setMargin(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                                />
                            </div>

                            {/* Logo Dropzone */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel htmlFor="qr_logo_file" size="xs" tone="eyebrow">{t('tools.qr.logo_label')}</FieldLabel>
                                <CompactFileDropzone
                                    id="qr_logo_file"
                                    accept="image/png, image/jpeg, image/svg+xml"
                                    compact
                                    currentFileName={logoName}
                                    onFileSelected={handleLogoSelected}
                                    onClearFile={handleLogoClear}
                                    promptText={t('tools.qr.insert_logo')}
                                />
                            </div>
                            
                            {/* Logo Scale */}
                            <div className="flex flex-col gap-2 w-full min-w-0">
                                <FieldLabel htmlFor="qr_logo_scale" size="xs" tone="eyebrow" className="flex justify-between">
                                    <span>{t('tools.qr.logo_scale')}</span>
                                    <span className="font-mono text-primary">{logoSize}</span>
                                </FieldLabel>
                                <input
                                    id="qr_logo_scale"
                                    type="range"
                                    min="0.1"
                                    max="0.4"
                                    step="0.05"
                                    value={logoSize}
                                    onChange={(e) => setLogoSize(Number(e.target.value))}
                                    disabled={!logo}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 disabled:opacity-50"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* PREVIEW SECTION (Col 5) */}
                <div className="col-span-1 xl:col-span-5 w-full min-w-0">
                    <div className="sticky xl:top-6 flex flex-col gap-6">
                        <Card title={t('tools.qr.live_preview')} status={t('tools.qr.ready')} gridCols="grid-cols-1">
                            <div className="flex flex-col items-center justify-center gap-6 w-full min-w-0 py-4">
                                
                                {/* Tempat Render Canvas */}
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 shadow-inner flex items-center justify-center overflow-hidden">
                                    <div ref={qrRef} className="rounded-lg overflow-hidden shadow-md max-w-[280px] [&>canvas]:max-w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>svg]:h-auto"></div>
                                </div>

                                {/* Export & Action Buttons */}
                                <div className="flex flex-col gap-3 w-full max-w-[280px]">
                                    <div className="flex items-center gap-2 w-full">
                                        <div className="shrink-0 w-28">
                                            <Select
                                                searchable={false}
                                                options={[
                                                    { value: 'png', label: 'PNG' },
                                                    { value: 'jpeg', label: 'JPG' },
                                                    { value: 'svg', label: 'SVG' },
                                                ]}
                                                value={downloadExt}
                                                onChange={setDownloadExt}
                                                placeholder={t('tools.qr.export_format')}
                                            />
                                        </div>
                                        
                                        <Button variant="primary" icon="download" onClick={handleDownload} className="flex-1 shadow-sm">
                                            {t('tools.qr.download')}
                                        </Button>
                                    </div>

                                    <Button variant="secondary" icon="content_copy" onClick={handleCopyImage} className="w-full">
                                        {t('tools.qr.copy_image')}
                                    </Button>
                                </div>

                                {/* Raw Output Box with Copy Button */}
                                <div className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('tools.qr.raw_data_output')}</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyRaw}
                                            className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">content_copy</span>
                                            {t('tools.qr.copy_raw')}
                                        </button>
                                    </div>
                                    <div className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all max-h-24 overflow-y-auto whitespace-pre-wrap">
                                        {rawData}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
