// src/menu/php/NewInstance.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ProgressStatusBlock from '../../components/ProgressStatusBlock';
import OsCompatibilityCard from '../../components/OsCompatibilityCard';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';
import OfflineBanner from '../../components/OfflineBanner';
import { useNetworkStatus, isOfflineResponse } from '../../context/NetworkContext';
import { clampPercent } from '../../utils/progress';

interface PhpVersion {
    version: string;
    filename: string;
}

interface Props {
    readonly version: string;
    readonly setVersion: (val: string) => void;
    readonly setFilename: (val: string) => void;
    readonly port: number;
    readonly setPort: (val: number) => void;
    readonly isInstalling?: boolean;
    readonly isCancelling?: boolean;
    readonly onCancelInstall?: () => void;
    readonly isFetchingVersions: boolean;
    readonly setIsFetchingVersions: (val: boolean) => void;
    readonly usedPorts: number[];
    readonly onRefreshStatus?: () => Promise<void> | void;
}

export default function NewPhpInstance({
    version, setVersion, setFilename, port, setPort, isInstalling,
    isCancelling = false, onCancelInstall,
    isFetchingVersions, setIsFetchingVersions, usedPorts, onRefreshStatus
}: Props) {

    const { t } = useTranslation();
    const { isOnline, reportOffline, reportOnline } = useNetworkStatus();
    const [availableVersions, setAvailableVersions] = useState<PhpVersion[]>([]);
    const [progress, setProgress] = useState({ percent: 0, text: '' });
    const [fetchError, setFetchError] = useState<string>('');
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isPortConflict = usedPorts.includes(port);
    const bottomRef = useRef<HTMLDivElement>(null); // ---> REF AUTO-SCROLL

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) {
            setOsInfo({ name: 'Windows', arch: 'Win64', icon: 'window' });
        } else if (userAgent.includes('mac')) {
            setOsInfo({ name: 'macOS', arch: 'Universal (ARM/x64)', icon: 'laptop_mac' });
        } else if (userAgent.includes('linux')) {
            setOsInfo({ name: 'Linux', arch: 'x86_64', icon: 'terminal' });
        }
    }, []);

    // ---> ENHANCEMENT: Auto-scroll saat menginstal <---
    useEffect(() => {
        if (isInstalling && bottomRef.current) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [isInstalling]);

    const handlePhpVersionsResponse = useCallback((response: any) => {
        if (response.status === 'success') {
            reportOnline();
            const versions = response.data || [];
            setAvailableVersions(versions);

            if (versions.length > 0) {
                if (!version) {
                    setVersion(versions[0].version);
                    setFilename(versions[0].filename);
                }
            } else {
                setVersion('');
                setFilename('');
            }
        } else {
            if (isOfflineResponse(response)) {
                reportOffline();
            }
            setFetchError((t(response.message, response.args || {}) as string));
            setAvailableVersions([]);
        }
    }, [version, t]);

    const fetchVersions = useCallback(async () => {
        setIsFetchingVersions(true);
        setFetchError('');

        if (window.pywebview?.api?.get_php_versions) {
            try {
                const response = await window.pywebview.api.get_php_versions();
                handlePhpVersionsResponse(response);
            } catch (error) {
                console.error(error);
                setFetchError(t('php.backend_connection_error'));
            }
        }
        setIsFetchingVersions(false);
    }, [handlePhpVersionsResponse, t]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            // Abaikan progress milik modul lain — lihat docs/known_bugs.md #7.
            if (customEvent.detail?.source && customEvent.detail.source !== 'PhpManager') return;
            const rawText = customEvent.detail?.text || '';
            const translatedText = rawText ? (t(rawText, customEvent.detail?.args || {}) as string) : '';
            setProgress({ percent: clampPercent(customEvent.detail?.percent), text: translatedText });
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [t]);

    useEffect(() => {
        if (!isInstalling) setProgress({ percent: 0, text: '' });
    }, [isInstalling]);

    const handleVersionChange = (selectedVer: string) => {
        setVersion(selectedVer);
        const found = availableVersions.find(v => v.version === selectedVer);
        if (found) setFilename(found.filename);
    };

    const isLinuxManualSetup = osInfo.name === 'Linux' && availableVersions.length === 0 && !fetchError && !isFetchingVersions;
    const linuxCommand = 'sudo apt update && sudo apt install -y php php-cli php-fpm php-common';

    const handleCopyCommand = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(linuxCommand);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = linuxCommand;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Ignore clipboard errors
        }
    };

    const handleRefresh = async () => {
        if (!onRefreshStatus) return;
        setIsRefreshing(true);
        try {
            await onRefreshStatus();
        } finally {
            setIsRefreshing(false);
        }
    };

    const recommendedPort = usedPorts.length > 0 ? Math.max(...usedPorts) + 1 : 9001;

    const isOfflineOrFetchError = !isOnline || Boolean(fetchError);

    return (
        <div className="flex flex-col gap-6 relative">
            {!isFetchingVersions && isOfflineOrFetchError && (
                <OfflineBanner
                    onRetry={fetchVersions}
                    forceShow={isOfflineOrFetchError}
                />
            )}

            {/* --- INFO SISTEM & PEMILIHAN VERSI --- */}
            <div className="flex flex-col gap-4">
                <OsCompatibilityCard
                    icon={osInfo.icon}
                    detectedLabel={t('php.detected_system')}
                    osName={osInfo.name}
                    arch={osInfo.arch}
                    compatibleLabel={t('php.compatible')}
                />

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">php</span>
                        {t('php.target_php_version')}
                    </span>

                    <Select
                        options={availableVersions.map((v, index) => ({
                            value: v.version,
                            label: v.version === 'system'
                                ? t('php.linux_system_package')
                                : `PHP ${v.version} ${index === 0 ? t('php.latest_release') : ''}`.trim(),
                        }))}
                        value={version || null}
                        onChange={handleVersionChange}
                        placeholder={
                            osInfo.name === 'Linux'
                                ? t('php.linux_system_package')
                                : isOfflineOrFetchError
                                ? t('common.offline_versions_unavailable')
                                : t('php.all_versions_installed')
                        }
                        disabled={isInstalling || availableVersions.length === 0}
                        loading={isFetchingVersions}
                        loadingText={t('php.retrieving_versions')}
                        errorText={fetchError ? `${t('php.version_fetch_error_prefix')}${fetchError}` : undefined}
                    />

                    {osInfo.name === 'Linux' && !isFetchingVersions && (
                        <p className="text-[11px] text-slate-500 mt-1">
                            {t('php.linux_system_package')}
                        </p>
                    )}

                    {isLinuxManualSetup && (
                        <div className="flex flex-col gap-3 p-3.5 mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-start gap-2.5">
                                <span className="p-1.5 rounded-lg bg-primary/10 text-primary material-symbols-outlined text-[18px] shrink-0">
                                    terminal
                                </span>
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                                        {t('php.linux_install_guide_title')}
                                    </h4>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('php.linux_install_guide_desc')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs shadow-inner">
                                <code className="truncate selection:bg-primary selection:text-white">{linuxCommand}</code>
                                <button
                                    type="button"
                                    onClick={handleCopyCommand}
                                    className={`px-2.5 py-1 rounded text-xs font-sans font-medium flex items-center justify-center gap-1.5 transition-all shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'}`}
                                    title={t('php.copy_command')}
                                >
                                    <span className="material-symbols-outlined text-[14px]">
                                        {copied ? 'check' : 'content_copy'}
                                    </span>
                                    <span>{copied ? t('php.copied_command') : t('php.copy_command')}</span>
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                                <span>{t('php.run_in_terminal_hint')}</span>
                                {onRefreshStatus && (
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                    >
                                        <span className={`material-symbols-outlined text-[15px] ${isRefreshing ? 'animate-spin' : ''}`}>
                                            refresh
                                        </span>
                                        <span>{isRefreshing ? t('php.refreshing') : t('php.refresh_status')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- PENGATURAN PORT ESENSIAL --- */}
            <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-500">settings_ethernet</span>
                    {t('php.fastcgi_configuration')}
                </span>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-2">
                    {t('php.fastcgi_desc')}
                </p>

                <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="php_new_instance_port" size="xs">{t('php.listening_port')}</FieldLabel>
                    <input
                        id="php_new_instance_port"
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        disabled={isInstalling}
                        className={`w-full bg-white dark:bg-slate-950 border ${isPortConflict ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary'} text-sm rounded-lg block p-2.5 outline-none transition-colors font-mono disabled:opacity-70`}
                    />
                </div>

                {(() => {
                    if (isPortConflict) return (
                        <InfoBox tone="danger" icon="error" className="mt-1 animate-in fade-in">
                            <strong>{t('php.port_conflict')}</strong> {t('php.port_used_desc_1')}{port}{t('php.port_used_desc_2')}<strong>{recommendedPort}</strong>.
                        </InfoBox>
                    );
                    if (port === 9000) return (
                        <InfoBox tone="info" icon="info" className="mt-1">
                            <strong>{t('php.tip')}</strong> {t('php.port_9000_tip')}
                        </InfoBox>
                    );
                    return null;
                })()}

                {/* --- PROGRESS BAR DENGAN GAP YANG DIRAPATKAN --- */}
                <div ref={bottomRef} className="pt-1 mt-1">
                    {isInstalling && (
                        <ProgressStatusBlock
                            progressText={progress.text || t('php.starting_process')}
                            progress={progress.percent}
                            onCancel={onCancelInstall}
                            isCancelling={isCancelling}
                            className="shadow-sm"
                        />
                    )}
                </div>

                    </div>
        </div>
    );
}
