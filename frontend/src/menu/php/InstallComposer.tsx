import { useState, forwardRef, useImperativeHandle } from 'react';
import { useToast } from '../../components/ToastContext';

interface PhpInstance {
    id: string;
    name: string;
    version: string;
}

interface Props {
    phpInstances: PhpInstance[];
}

export interface InstallComposerRef {
    submit: () => Promise<boolean>;
}

const InstallComposer = forwardRef<InstallComposerRef, Props>(({ phpInstances }, ref) => {
    const { showToast } = useToast();
    const [installMode, setInstallMode] = useState<'latest' | 'specific'>('latest');
    const [specificVersion, setSpecificVersion] = useState('');
    const [linkedPhp, setLinkedPhp] = useState(phpInstances.length > 0 ? phpInstances[phpInstances.length - 1].version : '');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!linkedPhp) {
                showToast("Anda harus memilih versi PHP untuk menjalankan Composer.", "warning");
                return false;
            }
            if (installMode === 'specific' && !specificVersion) {
                showToast("Harap masukkan versi spesifik (contoh: 2.7.2).", "warning");
                return false;
            }

            try {
                const api = window.pywebview?.api;
                const versionToInstall = installMode === 'latest' ? 'latest' : specificVersion;

                // Panggil API Backend (Asumsi fungsi ini akan dibuat di Python)
                const res = await api?.install_composer(versionToInstall, linkedPhp);

                if (res?.status === 'success') {
                    showToast(res.message || "Composer berhasil diinstal!", 'success');
                    return true;
                } else {
                    showToast(res?.message || "Gagal menginstal Composer", 'error');
                    return false;
                }
            } catch (error) {
                showToast("Kesalahan sistem saat menghubungi backend.", "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link to PHP Engine</label>
                <select
                    value={linkedPhp}
                    onChange={(e) => setLinkedPhp(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                >
                    {phpInstances.length === 0 && <option value="">No PHP Installed</option>}
                    {phpInstances.map(php => (
                        <option key={php.id} value={php.version}>{php.name} ({php.version})</option>
                    ))}
                </select>
                <span className="text-xs text-slate-500">Composer membutuhkan PHP CLI untuk dapat dieksekusi.</span>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit"
                >
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    Advanced Settings
                </button>

                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[200px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                        <button type="button" onClick={() => setInstallMode('latest')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 outline-none ${installMode === 'latest' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            Latest Stable
                        </button>
                        <button type="button" onClick={() => setInstallMode('specific')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 outline-none ${installMode === 'specific' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            Specific Version
                        </button>
                    </div>

                    {installMode === 'specific' && (
                        <div className="flex flex-col gap-2 animate-in fade-in">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Version Number</label>
                            <input
                                type="text"
                                value={specificVersion}
                                onChange={(e) => setSpecificVersion(e.target.value)}
                                placeholder="e.g., 2.7.2"
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default InstallComposer;