import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useToast } from '../../components/ToastContext';

export interface InstallNodeRef { submit: () => Promise<boolean>; }

const InstallNode = forwardRef<InstallNodeRef, any>((_, ref) => {
    const { showToast } = useToast();
    const [version, setVersion] = useState('');
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [enableCorepack, setEnableCorepack] = useState(true);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_node_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    setVersionsList(res.data);
                    setVersion(res.data[0].value);
                }
            } catch (error) {
                showToast("Gagal memuat daftar versi Node.js.", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, []);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!version) return false;
            try {
                const res = await window.pywebview?.api?.install_node(version, enableCorepack);
                if (res?.status === 'success') {
                    showToast(res.message || "Node.js berhasil diinstal!", 'success');
                    return true;
                } else {
                    showToast(res?.message || "Gagal menginstal Node.js", 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Node.js Version</label>
                {isLoading ? (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 animate-pulse h-10 rounded-lg"></div>
                ) : (
                    <select
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none"
                    >
                        {versionsList.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    Advanced Settings
                </button>
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[200px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <input type="checkbox" checked={enableCorepack} onChange={(e) => setEnableCorepack(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Enable Corepack</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mendukung package manager alternatif seperti Yarn dan pnpm secara bawaan.</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
});
export default InstallNode;