import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';

export interface InstallGoRef { submit: () => Promise<boolean>; }

const InstallGo = forwardRef<InstallGoRef, any>((_, ref) => {
    const { t } = useTranslation();
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
                } else {
                    setVersionsList([]);
                }
            } catch (error) {
                setVersionsList([]);
                showToast(t('runtimes.fetch_version_error'), "error");
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
                    showToast(res.message || t('runtimes.go_install_success'), 'success');
                    return true;
                } else {
                    showToast(res?.message || t('runtimes.go_install_error'), 'error');
                    return false;
                }
            } catch (error) {
                showToast(t('runtimes.sys_error'), "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('runtimes.go_version')}</label>

                {isLoading ? (
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                        </div>
                        <select disabled className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-wait">
                            <option>{t('runtimes.retrieving_version')}</option>
                        </select>
                    </div>

                ) : versionsList.length === 0 ? (
                <div className="relative w-full">
                    <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                    <select disabled className="w-full bg-red-50 dark:bg-red-900/10 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-not-allowed">
                        <option>{t('runtimes.error_fetching_result')}</option>
                    </select>
                </div>
                ) : (
                <select
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none cursor-pointer"
                >
                    {versionsList.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                </select>
                )}

                <span className="text-xs text-slate-500">
                    {t('runtimes.go_arch_desc_1')}<strong>windows/amd64</strong>{t('runtimes.go_arch_desc_2')}
                </span>
            </div>
        </div>
    );
});
export default InstallGo;