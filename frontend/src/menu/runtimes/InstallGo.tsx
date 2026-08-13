import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useToast } from '../../components/ToastContext';

export interface InstallGoRef { submit: () => Promise<boolean>; }

const InstallGo = forwardRef<InstallGoRef, any>((_, ref) => {
    const { showToast } = useToast();
    const [version, setVersion] = useState('latest');
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_go_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    setVersionsList(res.data);
                    setVersion(res.data[0].value);
                }
            } catch (error) {
                showToast("Gagal memuat daftar versi Go.", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, []);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            try {
                const res = await window.pywebview?.api?.install_go(version);
                if (res?.status === 'success') {
                    showToast(res.message || "Go Compiler berhasil diinstal!", 'success');
                    return true;
                } else {
                    showToast(res?.message || "Gagal menginstal Go", 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Go Compiler Version</label>

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

                <span className="text-xs text-slate-500">
                    Biner yang diunduh difokuskan untuk arsitektur <strong>windows/amd64</strong>.
                </span>
            </div>
        </div>
    );
});
export default InstallGo;