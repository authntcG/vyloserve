// src/menu/apache/InstallWizard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ProgressBar from '../../components/ProgressBar';
import OsCompatibilityCard from '../../components/OsCompatibilityCard';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';

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
    progressText
}: ApacheInstallWizardProps) {

    const { t } = useTranslation();
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });
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

    return (
        <div className="flex flex-col gap-6 relative">

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
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                        {t('apache.target_apache_version')}
                    </label>

                    <Select
                        searchable={false}
                        options={versions.map((v, index) => ({
                            value: v.version,
                            label: `Apache ${v.version} ${index === 0 ? t('apache.latest_stable') : ''}`.trim(),
                        }))}
                        value={version || null}
                        onChange={handleVersionChange}
                        placeholder={t('apache.server_up_to_date')}
                        disabled={isInstalling || versions.length === 0}
                        loading={isFetchingVersions}
                        loadingText={t('apache.retrieving_releases')}
                    />

                    {osInfo.name === 'Windows' && !isFetchingVersions && (
                        <p className="text-[11px] text-slate-500 mt-1">
                            {t('apache.binaries_provided_by')} <strong>ApacheLounge</strong>. {t('apache.requires_vcpp')}
                        </p>
                    )}
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- PENGATURAN PORT ESENSIAL --- */}
            <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-500">settings_ethernet</span>
                    {t('apache.default_listening_ports')}
                </label>

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
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-3/4">{progressText || t('apache.starting_process')}</span>
                                <span className="text-xs font-bold text-primary">{progress}%</span>
                            </div>
                            <ProgressBar percent={progress} />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}