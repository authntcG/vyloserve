// src/menu/apache/Settings.tsx
import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastContext';

export default function ApacheSettings() {
    const { showToast } = useToast();

    const [installedVersions, setInstalledVersions] = useState<string[]>([]);
    const [activeVersion, setActiveVersion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    // Fetch versi yang terinstal dari direktori saat modal dibuka
    useEffect(() => {
        const fetchInstalledVersions = async () => {
            setIsLoading(true);
            try {
                if (window.pywebview && window.pywebview.api) {
                    const response = await window.pywebview.api.get_apache_installed_versions();
                    if (response.status === 'success') {
                        setInstalledVersions(response.data);
                        setActiveVersion(response.active || '');
                    } else {
                        showToast(response.message, 'error');
                    }
                }
            } catch (error) {
                showToast("Gagal mengambil data versi dari server lokal.", "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInstalledVersions();
    }, []);

    // Handler ketika pengguna mengubah versi via Dropdown
    const handleVersionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVersion = e.target.value;
        setActiveVersion(newVersion);

        try {
            if (window.pywebview && window.pywebview.api) {
                const response = await window.pywebview.api.set_apache_active_version(newVersion);
                if (response.status === 'success') {
                    showToast(response.message, 'success');
                } else {
                    showToast(response.message, 'error');
                }
            }
        } catch (error) {
            showToast("Gagal menyimpan pengaturan versi.", "error");
        }
    };

    // Handler untuk keempat tombol shortcut
    const handleOpenFile = async (fileType: string) => {
        try {
            if (window.pywebview && window.pywebview.api) {
                const response = await window.pywebview.api.open_apache_file(fileType);
                if (response.status === 'error') {
                    showToast(response.message, 'error');
                }
            }
        } catch (error) {
            showToast("Gagal membuka file. Periksa koneksi API.", "error");
        }
    };

    return (
        <>
            {/* Version Selector */}
            <div className="flex flex-col gap-2">
                <label htmlFor="apache-version" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Active Version
                </label>

                {isLoading ? (
                    <div className="h-[42px] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg animate-pulse"></div>
                ) : (
                    <select
                        id="apache-version"
                        value={activeVersion}
                        onChange={handleVersionChange}
                        disabled={installedVersions.length === 0}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors disabled:opacity-50"
                    >
                        {installedVersions.length > 0 ? (
                            installedVersions.map(ver => (
                                <option key={ver} value={ver}>Apache {ver}</option>
                            ))
                        ) : (
                            <option>No Apache installation found</option>
                        )}
                    </select>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Changing the version will automatically restart the Apache service.
                </p>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Quick Shortcuts */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Essential Configurations</h4>

                {installedVersions.length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
                        Install Apache first to access configurations.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button onClick={() => handleOpenFile('httpd')} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">description</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">httpd.conf</span>
                                <span className="text-xs text-slate-500">Main configuration</span>
                            </div>
                        </button>

                        <button onClick={() => handleOpenFile('vhosts')} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">link</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">vhosts.conf</span>
                                <span className="text-xs text-slate-500">Virtual domains setup</span>
                            </div>
                        </button>

                        <button onClick={() => handleOpenFile('error')} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">bug_report</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">error.log</span>
                                <span className="text-xs text-slate-500">View crash reports</span>
                            </div>
                        </button>

                        <button onClick={() => handleOpenFile('fcgi')} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">sync_alt</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">PHP Binding</span>
                                <span className="text-xs text-slate-500">FastCGI setup</span>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}