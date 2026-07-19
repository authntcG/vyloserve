// src/menu/apache/InstallWizard.tsx
import React, { useState, useEffect } from 'react';

export interface ApacheVersionData {
    version: string;
    filename: string;
    url: string;
}

interface ApacheInstallWizardProps {
    versions: ApacheVersionData[];
    version: string;
    setVersion: React.Dispatch<React.SetStateAction<string>>;
    setUrl: React.Dispatch<React.SetStateAction<string>>;
    httpPort: number;
    setHttpPort: React.Dispatch<React.SetStateAction<number>>;
    httpsPort: number;
    setHttpsPort: React.Dispatch<React.SetStateAction<number>>;
    isInstalling: boolean;
    isFetchingVersions: boolean;
    progress: number;
    progressText: string;
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

    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });

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

    // Handler saat opsi versi diubah
    const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedVersion = e.target.value;
        const selectedData = versions.find(v => v.version === selectedVersion);
        if (selectedData) {
            setVersion(selectedData.version);
            setUrl(selectedData.url);
        }
    };

    return (
        <div className="flex flex-col gap-6">

            {/* --- INFO SISTEM & PEMILIHAN VERSI --- */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">{osInfo.icon}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Detected System</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {osInfo.name} <span className="text-primary dark:text-blue-400 font-mono text-xs ml-1 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{osInfo.arch}</span>
                            </span>
                        </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400">
                        COMPATIBLE
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                        Target Apache Version
                    </label>

                    {isFetchingVersions ? (
                        <div className="h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                            <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                            <span className="text-sm text-slate-500">Retrieving stable releases...</span>
                        </div>
                    ) : (
                        <select
                            value={version}
                            onChange={handleVersionChange}
                            disabled={isInstalling || versions.length === 0}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none disabled:opacity-70 transition-colors"
                        >
                            {versions.length > 0 ? (
                                versions.map((v, index) => (
                                    <option key={v.version} value={v.version}>
                                        Apache {v.version} {index === 0 ? '(Latest Stable)' : ''}
                                    </option>
                                ))
                            ) : (
                                <option>Server is up to date (No new versions available).</option>
                            )}
                        </select>
                    )}

                    {osInfo.name === 'Windows' && !isFetchingVersions && (
                        <p className="text-[11px] text-slate-500 mt-1">
                            Binaries provided by <strong>ApacheLounge</strong>. Requires Visual C++ Redistributable.
                        </p>
                    )}
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- PENGATURAN PORT ESENSIAL --- */}
            <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-500">settings_ethernet</span>
                    Default Listening Ports
                </label>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">HTTP Port</label>
                        <input
                            type="number"
                            value={httpPort}
                            onChange={(e) => setHttpPort(parseInt(e.target.value) || 80)}
                            disabled={isInstalling}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none disabled:opacity-50 transition-colors font-mono"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">HTTPS Port (SSL)</label>
                        <input
                            type="number"
                            value={httpsPort}
                            onChange={(e) => setHttpsPort(parseInt(e.target.value) || 443)}
                            disabled={isInstalling}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none disabled:opacity-50 transition-colors font-mono"
                        />
                    </div>
                </div>

                {/* --- PROGRESS BAR (Hanya muncul saat proses instalasi) --- */}
                {isInstalling && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{progressText || 'Memulai proses...'}</span>
                            <span className="text-xs font-bold text-primary dark:text-blue-400">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}