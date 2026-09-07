// src/menu/php/NewInstance.tsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface PhpVersion {
    version: string;
    filename: string;
}

interface Props {
    version: string;
    setVersion: (val: string) => void;
    setFilename: (val: string) => void;
    port: number;
    setPort: (val: number) => void;
    isInstalling?: boolean;
    isFetchingVersions: boolean;
    setIsFetchingVersions: (val: boolean) => void;
    usedPorts: number[];
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

            if (window.pywebview && window.pywebview.api) {
                try {
                    const response = await window.pywebview.api.get_php_versions();
                    if (response.status === 'success') {
                        const versions = response.data;
                        setAvailableVersions(versions);

                        if (versions.length > 0) {
                            setVersion(versions[0].version);
                            setFilename(versions[0].filename);
                        } else {
                            setVersion('');
                            setFilename('');
                        }
                    } else {
                        setFetchError(response.message);
                        setAvailableVersions([]);
                    }
                } catch (error) {
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
            setProgress({ percent: customEvent.detail.percent, text: customEvent.detail.text || '' });
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    useEffect(() => {
        if (!isInstalling) setProgress({ percent: 0, text: '' });
    }, [isInstalling]);

    const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedVer = e.target.value;
        setVersion(selectedVer);
        const found = availableVersions.find(v => v.version === selectedVer);
        if (found) setFilename(found.filename);
    };

    const recommendedPort = usedPorts.length > 0 ? Math.max(...usedPorts) + 1 : 9001;

    return (
        <div className="flex flex-col gap-6 relative">

            {/* --- INFO SISTEM & PEMILIHAN VERSI --- */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">{osInfo.icon}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t('php.detected_system')}</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {osInfo.name} <span className="text-primary dark:text-blue-400 font-mono text-xs ml-1 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{osInfo.arch}</span>
                            </span>
                        </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400">
                        {t('php.compatible')}
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">php</span>
                        {t('php.target_php_version')}
                    </label>

                    {isFetchingVersions ? (
                        <div className="h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                            <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                            <span className="text-sm text-slate-500">{t('php.retrieving_versions')}</span>
                        </div>
                    ) : (
                        <select
                            value={version}
                            onChange={handleVersionChange}
                            disabled={isInstalling || availableVersions.length === 0 || fetchError !== ''}
                            className={`w-full bg-white dark:bg-slate-950 border ${fetchError ? 'border-red-400 focus:border-red-500 text-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'} text-sm rounded-lg focus:ring-primary block p-2.5 outline-none transition-colors disabled:opacity-70`}
                        >
                            {fetchError ? (
                                <option>Error: {fetchError}</option>
                            ) : availableVersions.length > 0 ? (
                                availableVersions.map((v, index) => (
                                    <option key={v.version} value={v.version}>
                                        PHP {v.version} {index === 0 ? t('php.latest_release') : ''}
                                    </option>
                                ))
                            ) : (
                                <option>{t('php.all_versions_installed')}</option>
                            )}
                        </select>
                    )}
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
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('php.listening_port')}</label>
                    <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        disabled={isInstalling}
                        className={`w-full bg-white dark:bg-slate-950 border ${isPortConflict ? 'border-red-500 text-red-600 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary'} text-sm rounded-lg block p-2.5 outline-none transition-colors font-mono disabled:opacity-70`}
                    />
                </div>

                {isPortConflict ? (
                    <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg flex gap-3 animate-in fade-in">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-[20px] shrink-0">error</span>
                        <p className="text-[12px] text-red-800 dark:text-red-400">
                            <strong>{t('php.port_conflict')}</strong> {t('php.port_used_desc_1')}{port}{t('php.port_used_desc_2')}<strong>{recommendedPort}</strong>.
                        </p>
                    </div>
                ) : port === 9000 ? (
                    <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg flex gap-3">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-500 text-[20px] shrink-0">info</span>
                        <p className="text-[12px] text-blue-800 dark:text-blue-400">
                            <strong>{t('php.tip')}</strong> {t('php.port_9000_tip')}
                        </p>
                    </div>
                ) : null}

                {/* --- PROGRESS BAR DENGAN GAP YANG DIRAPATKAN --- */}
                <div ref={bottomRef} className="pt-1 mt-1">
                    {isInstalling && (
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {progress.text || t('php.starting_process')}
                                </span>
                                <span className="text-xs font-bold text-primary dark:text-blue-400">
                                    {progress.percent}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress.percent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}