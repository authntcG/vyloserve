import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';
import RuntimeVersionSelect from './RuntimeVersionSelect';

export interface InstallJavaRef { submit: () => Promise<boolean>; }

const InstallJava = forwardRef<InstallJavaRef, any>((_, ref) => {
    const { t } = useTranslation();
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
            if (!version) return false;
            try {
                const res = await window.pywebview?.api?.install_java(version);
                if (res?.status === 'success') {
                    showToast((res.message ? t(res.message, res.args || {}) : t('runtimes.java_install_success')) as string, 'success');
                    return true;
                } else {
                    showToast((res?.message ? t(res.message, res.args || {}) : t('runtimes.java_install_error')) as string, 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('runtimes.java_version')}</label>

                <RuntimeVersionSelect isLoading={isLoading} versionsList={versionsList} version={version} setVersion={setVersion} />

                <span className="text-xs text-slate-500">
                    {t('runtimes.java_api_desc')}
                </span>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    {t('runtimes.advanced_settings')}
                </button>
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[100px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('runtimes.java_home_auto_1')}<code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">JAVA_HOME</code>{t('runtimes.java_home_auto_2')}</p>
                </div>
            </div>
        </div>
    );
});
export default InstallJava;
