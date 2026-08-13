import { useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../components/ToastContext';

export default function GitMain() {
    const { showToast } = useToast();

    // Dummy state sebelum backend siap
    const [isInstalled, setIsInstalled] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [gitData, setGitData] = useState({ version: '2.44.0', in_path: false, userName: '', userEmail: '' });

    const handleInstall = () => {
        setIsInstalling(true);
        // Simulasi backend loading
        setTimeout(() => {
            setIsInstalled(true);
            setIsInstalling(false);
            showToast("Git berhasil diinstal!", "success");
        }, 1500);
    };

    const handleTogglePath = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enable = e.target.checked;
        setGitData({ ...gitData, in_path: enable });
        if (enable) showToast("Git ditambahkan ke PATH. Harap restart terminal.", "success");
        else showToast("Git dihapus dari Sistem PATH.", "success");
    };

    const handleSaveConfig = () => {
        // Panggil backend git config --global ...
        showToast("Konfigurasi Git Global berhasil disimpan.", "success");
    };

    return (
        <div className="flex flex-col w-full">
            <PageHeader
                icon="merge"
                title="Git Version Control"
                subtitle={<><span className="material-symbols-outlined text-[14px]">info</span> Portable Git environment and global configurations.</>}
                actions={
                    !isInstalled && (
                        <button onClick={handleInstall} disabled={isInstalling} className="bg-primary hover:bg-blue-600 disabled:bg-slate-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">{isInstalling ? 'sync' : 'download'}</span>
                            {isInstalling ? 'Installing...' : 'Install Git'}
                        </button>
                    )
                }
            />

            {!isInstalled ? (
                <div className="mt-6">
                    <EmptyState
                        icon="merge" title="Git is not installed"
                        description="Install Portable Git to track changes, manage code versions, and collaborate without installing it globally on Windows."
                        actionText="Download Git now" onAction={handleInstall}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                    {/* Card 1: Status & Path */}
                    <Card title="Git Core System" status="running" dropdownActions={<button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Uninstall Git</button>}>
                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">Version</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200">{gitData.version}</span></div>
                        <div className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-500 uppercase">Architecture</span><span className="font-mono text-sm text-slate-900 dark:text-slate-200">64-bit (Portable)</span></div>

                        <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5"><span className="text-sm font-semibold text-slate-900 dark:text-white">Register to Windows PATH (Global CMD)</span><span className="text-xs text-slate-500 dark:text-slate-400">Allow VSCode and CMD to use this Git installation.</span></div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                                <input type="checkbox" checked={gitData.in_path} onChange={handleTogglePath} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90"></div>
                            </label>
                        </div>
                    </Card>

                    {/* Card 2: Global Config */}
                    <Card title="Global Configuration" status="running">
                        <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-500">Global User Name (<code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.name</code>)</label>
                                <input type="text" value={gitData.userName} onChange={(e) => setGitData({ ...gitData, userName: e.target.value })} placeholder="e.g. John Doe" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-500">Global Email (<code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.email</code>)</label>
                                <input type="email" value={gitData.userEmail} onChange={(e) => setGitData({ ...gitData, userEmail: e.target.value })} placeholder="e.g. john@example.com" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white" />
                            </div>
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button onClick={handleSaveConfig} className="bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all">Save Config</button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}