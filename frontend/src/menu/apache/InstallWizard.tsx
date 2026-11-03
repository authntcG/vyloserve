// src/menu/apache/InstallWizard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ProgressStatusBlock from '../../components/ProgressStatusBlock';
import OsCompatibilityCard from '../../components/OsCompatibilityCard';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import OfflineBanner from '../../components/OfflineBanner';
import { useNetworkStatus } from '../../context/NetworkContext';

export interface ApacheVersionData {
    version: string;
    filename: string;
    url: string;
}

interface ApacheInstallWizardProps {
    readonly versions: ApacheVersionData[];
    readonly version: string;
    readonly setVersion: React.Dispatch<React.SetStateAction<string>>;
    readonly setUrl: React.Dispatch<React.SetStateAction<string>>;
    readonly httpPort: number;
    readonly setHttpPort: React.Dispatch<React.SetStateAction<number>>;
    readonly httpsPort: number;
    readonly setHttpsPort: React.Dispatch<React.SetStateAction<number>>;
    readonly isInstalling: boolean;
    readonly isFetchingVersions: boolean;
    readonly progress: number;
    readonly progressText: string;
    readonly onRetryFetch?: () => void;
    readonly isCancelling?: boolean;
    readonly onCancelInstall?: () => void;
    readonly onRefreshStatus?: () => Promise<void> | void;
}

export default function ApacheInstallWizard({
    versions,
    version,
    setVersion,
    setUrl,
    httpPort,
    setHttpPort,
    httpsPort,
    setHttpsPort,
    isInstalling,
    isFetchingVersions,
    progress,
    progressText,
    onRetryFetch,
    isCancelling = false,
    onCancelInstall,
    onRefreshStatus
}: ApacheInstallWizardProps) {

    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });
    const [copied, setCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null); // Ref untuk auto-scroll

    // Deteksi Sistem Operasi
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

    // --- ENHANCEMENT: Auto-scroll ke bawah saat loading instalasi dimulai ---
    useEffect(() => {
        if (isInstalling && bottomRef.current) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [isInstalling]);

    // Handler saat opsi versi diubah
    const handleVersionChange = (selectedVersion: string) => {
        const selectedData = versions.find(v => v.version === selectedVersion);
        if (selectedData) {
            setVersion(selectedData.version);
            setUrl(selectedData.url);
        }
    };

    const isOfflineOrUnavailable = !isOnline;
    const isLinuxManualSetup = osInfo.name !== 'Windows' && versions.length === 0 && !isFetchingVersions;
    const linuxCommand = 'sudo apt update && sudo apt install -y apache2';

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

    return (
        <div className="flex flex-col gap-6 relative">
            {isOfflineOrUnavailable && (
                <OfflineBanner
                    onRetry={onRetryFetch}
                    forceShow={isOfflineOrUnavailable}
                />
            )}

            {/* --- INFO SISTEM & PEMILIHAN VERSI --- */}
            <div className="flex flex-col gap-4">
                <OsCompatibilityCard
                    icon={osInfo.icon}
                    detectedLabel={t('apache.detected_system')}
                    osName={osInfo.name}
                    arch={osInfo.arch}
                    compatibleLabel={t('apache.compatible')}
                />

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                        {t('apache.target_apache_version')}
                    </span>

                    <Select
                        searchable={false}
                        options={versions.map((v, index) => ({
                            value: v.version,
                            label: `Apache ${v.version} ${index === 0 ? t('apache.latest_stable') : ''}`.trim(),
                        }))}
                        value={version || null}
                        onChange={handleVersionChange}
                        placeholder={
                            osInfo.name !== 'Windows'
                                ? t('apache.no_linux_binaries')
                                : isOfflineOrUnavailable
                                ? t('common.offline_versions_unavailable')
                                : t('apache.server_up_to_date')
                        }
                        disabled={isInstalling || versions.length === 0}
                        loading={isFetchingVersions}
                        loadingText={t('apache.retrieving_releases')}
                    />

                    {osInfo.name === 'Windows' && !isFetchingVersions && (
                        <p className="text-[11px] text-slate-500 mt-1">
                            {t('apache.binaries_provided_by')} <strong>ApacheLounge</strong>. {t('apache.requires_vcpp')}
                        </p>
                    )}
                    {osInfo.name !== 'Windows' && !isFetchingVersions && (
                        <p className="text-[11px] text-slate-500 mt-1">
                            {t('apache.no_linux_binaries')}
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
                                        {t('apache.linux_install_guide_title')}
                                    </h4>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('apache.linux_install_guide_desc')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs shadow-inner">
                                <code className="truncate selection:bg-primary selection:text-white">{linuxCommand}</code>
                                <button
                                    type="button"
                                    onClick={handleCopyCommand}
                                    className={`px-2.5 py-1 rounded text-xs font-sans font-medium flex items-center justify-center gap-1.5 transition-all shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'}`}
                                    title={t('apache.copy_command')}
                                >
                                    <span className="material-symbols-outlined text-[14px]">
                                        {copied ? 'check' : 'content_copy'}
                                    </span>
                                    <span>{copied ? t('apache.copied_command') : t('apache.copy_command')}</span>
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                                <span>{t('apache.run_in_terminal_hint')}</span>
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
                                        <span>{isRefreshing ? t('apache.refreshing') : t('apache.refresh_status')}</span>
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
                    {t('apache.default_listening_ports')}
                </span>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="apache_http_port" size="xs">{t('apache.http_port')}</FieldLabel>
                        <input
                            id="apache_http_port"
                            type="number"
                            value={httpPort}
                            onChange={(e) => setHttpPort(Number.parseInt(e.target.value) || 80)}
                            disabled={isInstalling}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none disabled:opacity-50 transition-colors font-mono"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="apache_https_port" size="xs">{t('apache.https_port')}</FieldLabel>
                        <input
                            id="apache_https_port"
                            type="number"
                            value={httpsPort}
                            onChange={(e) => setHttpsPort(Number.parseInt(e.target.value) || 443)}
                            disabled={isInstalling}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none disabled:opacity-50 transition-colors font-mono"
                        />
                    </div>
                </div>

                {/* --- PROGRESS BAR CONTAINER DENGAN REF --- */}
                <div ref={bottomRef} className="pt-1 mt-1">
                    {isInstalling && (
                        <ProgressStatusBlock
                            progressText={progressText || t('apache.starting_process')}
                            progress={progress}
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
