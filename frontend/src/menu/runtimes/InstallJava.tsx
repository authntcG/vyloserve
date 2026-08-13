import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useToast } from '../../components/ToastContext';

export interface InstallJavaRef { submit: () => Promise<boolean>; }

const InstallJava = forwardRef<InstallJavaRef, any>((_, ref) => {
    const { showToast } = useToast();
    const [version, setVersion] = useState('');
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_java_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    setVersionsList(res.data);
                    setVersion(res.data[0].value); // Set default ke yang pertama (Latest LTS biasanya)
                }
            } catch (error) {
                showToast("Gagal memuat daftar versi Java.", "error");
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
                const res = await window.pywebview?.api?.install_java(version);
                if (res?.status === 'success') {
                    showToast(res.message || "Java berhasil diinstal!", 'success');
                    return true;
                } else {
                    showToast(res?.message || "Gagal menginstal Java", 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Java Development Kit (Eclipse Temurin)</label>

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
                    Daftar versi ditarik langsung dari API resmi Eclipse Adoptium. Instalasi Java Virtual Machine (JVM) mutlak diperlukan untuk mengeksekusi skrip PySpark atau Apache Hadoop.
                </span>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    Advanced Settings
                </button>
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[100px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Variabel lingkungan <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">JAVA_HOME</code> akan otomatis disiapkan oleh VyloServe setelah instalasi selesai.</p>
                </div>
            </div>
        </div>
    );
});
export default InstallJava;