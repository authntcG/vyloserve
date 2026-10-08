// src/menu/php/NewInstance.tsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ProgressBar from '../../components/ProgressBar';
import OsCompatibilityCard from '../../components/OsCompatibilityCard';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';
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
    readonly isFetchingVersions: boolean;
    readonly setIsFetchingVersions: (val: boolean) => void;
    readonly usedPorts: number[];
}

export default function NewPhpInstance({
    version, setVersion, setFilename, port, setPort, isInstalling,
    isFetchingVersions, setIsFetchingVersions, usedPorts
}: Props) {

    const { t } = useTranslation();
    const [availableVersions, setAvailableVersions] = useState<PhpVersion[]>([]);
    const [progress, setProgress] = useState({ percent: 0, text: '' });
    const [fetchError, setFetchError] = useState<string>('');
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });

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

    useEffect(() => {
        const fetchVersions = async () => {
            setIsFetchingVersions(true);
            setFetchError('');

            if (window.pywebview?.api) {
                try {
                    const response = await window.pywebview.api.get_php_versions();
                    if (response.status === 'success') {
                        const versions = response.data;
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
                        setFetchError((t(response.message, response.args || {}) as string));
                        setAvailableVersions([]);
                    }
                } catch (error) {
                    console.error(error);
                    setFetchError(t('php.backend_connection_error'));
                }
            }
            setIsFetchingVersions(false);
        };

        fetchVersions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            // Abaikan progress milik modul lain — lihat docs/known_bugs.md #7.
            if (customEvent.detail?.source && customEvent.detail.source !== 'PhpManager') return;
            setProgress({ percent: clampPercent(customEvent.detail.percent), text: customEvent.detail.text || '' });
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    useEffect(() => {
        if (!isInstalling) setProgress({ percent: 0, text: '' });
    }, [isInstalling]);

    const handleVersionChange = (selectedVer: string) => {
        setVersion(selectedVer);
        const found = availableVersions.find(v => v.version === selectedVer);
        if (found) setFilename(found.filename);
    };

    const recommendedPort = usedPorts.length > 0 ? Math.max(...usedPorts) + 1 : 9001;

    return (
        <div className="flex flex-col gap-6 relative">

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
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">php</span>
                        {t('php.target_php_version')}
                    </label>

                    <Select
                        options={availableVersions.map((v, index) => ({
                            value: v.version,
                            label: `PHP ${v.version} ${index === 0 ? t('php.latest_release') : ''}`.trim(),
                        }))}
                        value={version || null}
                        onChange={handleVersionChange}
                        placeholder={t('php.all_versions_installed')}
                        disabled={isInstalling || availableVersions.length === 0}
                        loading={isFetchingVersions}
                        loadingText={t('php.retrieving_versions')}
                        errorText={fetchError ? `${t('php.version_fetch_error_prefix')}${fetchError}` : undefined}
                    />
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- PENGATURAN PORT ESENSIAL --- */}
            <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-500">settings_ethernet</span>
                    {t('php.fastcgi_configuration')}
                </label>
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
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {progress.text || t('php.starting_process')}
                                </span>
                                <span className="text-xs font-bold text-primary">
                                    {progress.percent}%
                                </span>
                            </div>
                            <ProgressBar percent={progress.percent} />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}