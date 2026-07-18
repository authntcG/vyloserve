// src/menu/php/NewInstance.tsx
import { useState, useEffect } from 'react';

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
}

export default function NewPhpInstance({
    version, setVersion, setFilename, port, setPort, isInstalling,
    isFetchingVersions, setIsFetchingVersions
}: Props) {

    const [availableVersions, setAvailableVersions] = useState<PhpVersion[]>([]);
    const [progress, setProgress] = useState({ percent: 0, text: '' });

    // STATE BARU: Menampung pesan error jika koneksi gagal
    const [fetchError, setFetchError] = useState<string>('');

    useEffect(() => {
        const fetchVersions = async () => {
            setIsFetchingVersions(true);
            setFetchError('');

            if (window.pywebview && window.pywebview.api) {
                try {
                    const response = await window.pywebview.api.get_php_versions();

                    // PENANGANAN RESPONS TERSTRUKTUR DARI PYTHON
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
                        // Jika status error (misal koneksi putus)
                        setFetchError(response.message);
                        setAvailableVersions([]);
                    }
                } catch (error) {
                    setFetchError("Gagal terhubung ke backend Python.");
                    console.error(error);
                }
            }

            setIsFetchingVersions(false);
        };

        fetchVersions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ... (Listener progress vylo_progress dan handleVersionChange TETAP SAMA) ...
    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            setProgress({ percent: customEvent.detail.percent, text: customEvent.detail.text });
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

    return (
        <div className="flex flex-col gap-5">
            {isInstalling ? (
                <div className="flex flex-col items-center justify-center py-6 gap-4">
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        ></div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{progress.percent}%</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                            {progress.text || 'Preparing...'}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select PHP Version</label>
                        <select
                            value={version}
                            onChange={handleVersionChange}
                            // Kunci dropdown jika sedang fetching ATAU terjadi error
                            disabled={isFetchingVersions || availableVersions.length === 0 || fetchError !== ''}
                            className={`w-full bg-white dark:bg-slate-950 border ${fetchError ? 'border-red-400 focus:border-red-500 text-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'} text-sm rounded-lg focus:ring-primary block p-2.5 outline-none transition-colors disabled:opacity-70`}
                        >
                            {isFetchingVersions ? (
                                <option>Fetching available versions from servers...</option>
                            ) : fetchError ? (
                                <option>Error: {fetchError}</option>
                            ) : availableVersions.length > 0 ? (
                                availableVersions.map((v) => (
                                    <option key={v.version} value={v.version}>
                                        PHP {v.version}
                                    </option>
                                ))
                            ) : (
                                <option>All available versions are already installed.</option>
                            )}
                        </select>
                        <p className="text-xs text-slate-500">VyloServe will download the exact binaries from official servers.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">FastCGI Port Bind</label>
                        <input
                            type="number"
                            value={port}
                            onChange={(e) => setPort(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                        />
                    </div>
                </>
            )}
        </div>
    );
}