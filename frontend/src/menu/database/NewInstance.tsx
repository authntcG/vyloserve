import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

interface Props {
    activeTab: 'all' | 'mysql' | 'postgres';
    usedPorts: number[];
    isInstalling: boolean;
    progress: number;
    progressText: string;
}

export interface NewDbInstanceRef {
    getFormData: () => { engine: string; version: string; url: string; port: number; rootPass: string } | null;
}

interface OnlineVersion {
    name: string;
    version: string;
    url: string;
}

const NewDbInstance = forwardRef<NewDbInstanceRef, Props>(({ activeTab, usedPorts, isInstalling, progress, progressText }, ref) => {
    const [engineFamily, setEngineFamily] = useState<'mysql' | 'postgres'>(
        activeTab === 'postgres' ? 'postgres' : 'mysql'
    );
    const [port, setPort] = useState(activeTab === 'postgres' ? 5432 : 3306);
    const [rootPass, setRootPass] = useState('');

    const [availableVersions, setAvailableVersions] = useState<OnlineVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [isFetchingVersions, setIsFetchingVersions] = useState(false);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // ---> DETEKSI OS DARI FRONTEND <---
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const DISPLAY_LIMIT = 15;

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) {
            setOsInfo({ name: 'Windows', arch: 'Win64', icon: 'window' });
        } else if (userAgent.includes('mac')) {
            setOsInfo({ name: 'macOS', arch: 'Universal', icon: 'laptop_mac' });
        } else if (userAgent.includes('linux')) {
            setOsInfo({ name: 'Linux', arch: 'x86_64', icon: 'terminal' });
        }
    }, []);

    useEffect(() => {
        if (isInstalling && bottomRef.current) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [isInstalling]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isDropdownOpen) {
            setSearchQuery('');
        } else {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isDropdownOpen]);

    const fetchOnlineVersions = async (engine: string) => {
        setIsFetchingVersions(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.get_available_databases === 'function') {
                const res = await api.get_available_databases(engine);
                if (res.status === 'success') {
                    setAvailableVersions(res.data);
                    if (res.data.length > 0) setSelectedVersion(res.data[0].version);
                } else setAvailableVersions([]);
            }
        } catch (error) {
            console.error("Gagal menarik versi DB online");
        } finally {
            setIsFetchingVersions(false);
        }
    };

    useEffect(() => {
        fetchOnlineVersions(engineFamily);
    }, [engineFamily]);

    useEffect(() => {
        if (activeTab !== 'all') {
            setEngineFamily(activeTab);
            setPort(activeTab === 'postgres' ? 5432 : 3306);
        }
    }, [activeTab]);

    useImperativeHandle(ref, () => ({
        getFormData: () => {
            const target = availableVersions.find(v => v.version === selectedVersion);
            if (!target) return null;
            return { engine: engineFamily, version: target.version, url: target.url, port, rootPass };
        }
    }));

    const filteredVersions = availableVersions
        .filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, DISPLAY_LIMIT);

    const baseInputClass = "w-full h-[42px] px-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm rounded-lg outline-none transition-colors border";
    const normalInputClass = `${baseInputClass} border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary`;
    const errorInputClass = `${baseInputClass} border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500`;

    return (
        <div className="flex flex-col gap-5 relative">

            {/* ---> INFO SISTEM (Mengikuti gaya PHP) <--- */}
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Database Engine</label>
                <select
                    value={engineFamily}
                    disabled={isInstalling}
                    onChange={(e) => {
                        const eng = e.target.value as 'mysql' | 'postgres';
                        setEngineFamily(eng);
                        setPort(eng === 'postgres' ? 5432 : 3306);
                        setIsDropdownOpen(false);
                    }}
                    className={`${normalInputClass} ${isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'cursor-pointer'}`}
                >
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="postgres">PostgreSQL</option>
                </select>
                <p className="text-xs text-slate-500">
                    Source: {engineFamily === 'mysql' ? 'archive.mariadb.org' : 'enterprisedb.com'}
                </p>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Version</label>

                    {/* ---> LOADING STATE (Mengikuti gaya PHP) <--- */}
                    {isFetchingVersions ? (
                        <div className="h-[42px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                            <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                            <span className="text-sm text-slate-500">Retrieving versions...</span>
                        </div>
                    ) : (
                        <div
                            onClick={() => {
                                if (availableVersions.length > 0 && !isInstalling) setIsDropdownOpen(!isDropdownOpen);
                            }}
                            className={`${baseInputClass} flex justify-between items-center ${isDropdownOpen ? 'border-primary ring-1 ring-primary' : 'border-slate-300 dark:border-slate-700'} ${availableVersions.length === 0 || isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'cursor-pointer'}`}
                        >
                            <span className="truncate pr-2">
                                {availableVersions.length === 0 ? 'Failed to fetch' : availableVersions.find(v => v.version === selectedVersion)?.name || 'Select version'}
                            </span>
                            <span className={`material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                                expand_more
                            </span>
                        </div>
                    )}

                    {isDropdownOpen && !isInstalling && (
                        <div className="absolute top-[70px] left-0 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Find version..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                                {filteredVersions.length > 0 ? (
                                    filteredVersions.map(ver => {
                                        const isSelected = selectedVersion === ver.version;
                                        return (
                                            <div
                                                key={ver.version}
                                                onClick={() => {
                                                    setSelectedVersion(ver.version);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`px-3 py-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                            >
                                                <span>{ver.name}</span>
                                                {isSelected && <span className="material-symbols-outlined text-[16px] text-primary">check</span>}
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="px-3 py-4 text-center text-xs text-slate-500">No versions found</div>
                                )}
                            </div>
                            {availableVersions.length > DISPLAY_LIMIT && searchQuery === '' && (
                                <div className="px-3 py-1.5 text-[10px] font-medium text-center text-slate-400 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
                                    Showing top {DISPLAY_LIMIT} recent releases
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">TCP Port Bind</label>
                    <input
                        type="number"
                        disabled={isInstalling}
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className={`${usedPorts.includes(port) ? errorInputClass : normalInputClass} ${isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : ''}`}
                    />
                    {usedPorts.includes(port) && !isInstalling && (
                        <p className="text-xs text-red-500 font-medium animate-in fade-in">Port {port} in use!</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Initial Setup</h4>

                {engineFamily === 'postgres' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg flex items-start gap-2 mb-1 animate-in fade-in">
                        <span className="material-symbols-outlined text-amber-500 text-[18px]">security</span>
                        <span className="text-xs text-amber-800 dark:text-amber-400">PostgreSQL requires a superuser password during initialization.</span>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {engineFamily === 'postgres' ? 'Superuser (postgres) Password' : 'Root Password'}
                    </label>
                    <input
                        type="password"
                        disabled={isInstalling}
                        value={rootPass}
                        onChange={(e) => setRootPass(e.target.value)}
                        placeholder={engineFamily === 'postgres' ? 'Required (e.g., root)' : 'Leave empty for no password'}
                        className={`${engineFamily === 'postgres' && !rootPass ? `${baseInputClass} border-amber-300 dark:border-amber-700 focus:ring-1 focus:ring-amber-500` : normalInputClass} ${isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : ''}`}
                    />
                </div>
            </div>

            {/* ---> PROGRESS BAR (Teks diselaraskan dengan PHP) <--- */}
            <div ref={bottomRef} className="pt-1 mt-1 transition-all duration-300">
                {isInstalling && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {progressText || 'Memulai proses...'}
                            </span>
                            <span className="text-xs font-bold text-primary dark:text-blue-400">
                                {progress}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            You can safely close this dialog. The download will continue.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});

export default NewDbInstance;