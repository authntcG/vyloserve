import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';

export interface InstallNodeRef { submit: () => Promise<boolean>; }

const InstallNode = forwardRef<InstallNodeRef, any>((_, ref) => {
    const { t } = useTranslation();
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
            if (!version) return false;
            try {
                const res = await window.pywebview?.api?.install_node(version, enableCorepack);
                if (res?.status === 'success') {
                    showToast(res.message || t('runtimes.node_install_success'), 'success');
                    return true;
                } else {
                    showToast(res?.message || t('runtimes.node_install_error'), 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('runtimes.node_version')}</label>
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
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="material-symbols-outlined text-[18px] text-red-500">wifi_off</span>
                    </div>
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
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    {t('runtimes.advanced_settings')}
                </button>
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[200px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <input type="checkbox" checked={enableCorepack} onChange={(e) => setEnableCorepack(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('runtimes.enable_corepack')}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('runtimes.corepack_desc')}</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
});
export default InstallNode;