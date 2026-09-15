import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';
import RuntimeVersionSelect from './RuntimeVersionSelect';

export interface InstallPythonRef { submit: () => Promise<boolean>; }

const InstallPython = forwardRef<InstallPythonRef, any>((_, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [version, setVersion] = useState('');
    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [installPip, setInstallPip] = useState(true);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_python_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    setVersionsList(res.data);
                    setVersion(res.data[0].value);
                } else {
                    setVersionsList([]);
                }
            } catch {
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
            if (!version || versionsList.length === 0) return false;
            try {
                const res = await window.pywebview?.api?.install_python(version, installPip);
                if (res?.status === 'success') {
                    showToast(res.message || t('runtimes.python_install_success'), 'success');
                    return true;
                } else {
                    showToast(res?.message || t('runtimes.python_install_error'), 'error');
                    return false;
                }
            } catch {
                showToast(t('runtimes.sys_error'), "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('runtimes.python_version')}</label>

                <RuntimeVersionSelect isLoading={isLoading} versionsList={versionsList} version={version} setVersion={setVersion} />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    {t('runtimes.advanced_settings')}
                </button>
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[200px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <input type="checkbox" checked={installPip} onChange={(e) => setInstallPip(e.target.checked)} className="mt-1 w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary dark:ring-offset-slate-800 dark:bg-slate-700 dark:border-slate-600" />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('runtimes.install_pip')}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('runtimes.pip_desc')}</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
});
export default InstallPython;
