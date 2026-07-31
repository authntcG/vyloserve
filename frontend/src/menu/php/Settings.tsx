// src/menu/php/Settings.tsx
import React, { useState } from 'react';

interface Extension {
    name: string;
    active: boolean;
}

interface ConfigData {
    port: number;
    memory_limit: string;
    max_execution_time: string;
    upload_max_filesize: string;
    post_max_size: string;
}

interface Props {
    config: ConfigData;
    setConfig: React.Dispatch<React.SetStateAction<ConfigData>>;
    extensions: Extension[];
    setExtensions: React.Dispatch<React.SetStateAction<Extension[]>>;
    isLoading: boolean;
    usedPorts: number[]; // PROPERTI BARU: Daftar port yang terpakai
}

export default function PhpSettings({ config, setConfig, extensions, setExtensions, isLoading, usedPorts }: Props) {
    // STATE BARU: Untuk fitur pencarian
    const [searchQuery, setSearchQuery] = useState('');

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">sync</span>
                <span className="text-sm text-slate-500 mt-3">Reading php.ini...</span>
            </div>
        );
    }

    const toggleExtension = (extName: string) => {
        setExtensions(prev => prev.map(ext =>
            ext.name === extName ? { ...ext, active: !ext.active } : ext
        ));
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof ConfigData) => {
        setConfig(prev => ({ ...prev, [key]: e.target.value }));
    };

    // CEK KONFLIK PORT
    const isPortConflict = usedPorts.includes(Number(config.port));

    // FILTER EKSTENSI BERDASARKAN PENCARIAN
    const filteredExtensions = extensions.filter(ext =>
        ext.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6">

            {/* --- PENGATURAN UMUM --- */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
                    Basic Configuration
                </h4>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">FastCGI Port</label>
                        <input
                            type="number"
                            value={config.port}
                            onChange={(e) => handleConfigChange(e, 'port')}
                            className={`w-full bg-white dark:bg-slate-950 border ${isPortConflict ? 'border-red-500 text-red-600 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary'} text-sm rounded-lg block p-2 outline-none transition-colors font-mono`}
                        />
                        {/* WARNING KONFLIK PORT */}
                        {isPortConflict && (
                            <span className="text-[11px] text-red-500 font-medium flex items-center gap-1 animate-in fade-in">
                                <span className="material-symbols-outlined text-[12px]">error</span>
                                Port already in use!
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">memory_limit</label>
                        <input
                            type="text"
                            value={config.memory_limit}
                            onChange={(e) => handleConfigChange(e, 'memory_limit')}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_execution_time (sec)</label>
                        <input
                            type="text"
                            value={config.max_execution_time}
                            onChange={(e) => handleConfigChange(e, 'max_execution_time')}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">upload_max_filesize</label>
                        <input
                            type="text"
                            value={config.upload_max_filesize}
                            onChange={(e) => handleConfigChange(e, 'upload_max_filesize')}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- EXTENSIONS TOGGLE DENGAN SEARCH BAR --- */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500">extension</span>
                        PHP Extensions
                    </h4>
                    <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-1 px-2 rounded">
                        {extensions.filter(e => e.active).length} Active
                    </span>
                </div>

                {/* SEARCH BAR (ENHANCEMENT UX) */}
                <div className="relative mb-1">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400 pointer-events-none">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search extension name..."
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300 placeholder-slate-400"
                    />
                </div>

                {/* Scrollable Container untuk Extension */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredExtensions.length > 0 ? (
                        filteredExtensions.map(ext => (
                            <div
                                key={ext.name}
                                onClick={() => toggleExtension(ext.name)}
                                className={`flex items-center justify-between p-2 rounded border cursor-pointer select-none transition-all ${ext.active
                                    ? 'border-primary/50 bg-blue-50/50 dark:bg-blue-900/10 dark:border-primary/40'
                                    : 'border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className={`text-xs font-medium truncate pr-2 ${ext.active ? 'text-primary dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {ext.name}
                                </span>

                                <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                                    <input type="checkbox" className="sr-only peer" checked={ext.active} readOnly />
                                    <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-2 md:col-span-3 text-center py-6 text-sm text-slate-500">
                            {extensions.length === 0 ? "No extensions found in the ext/ folder." : "No extensions match your search."}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}