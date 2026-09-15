import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';
import RuntimeVersionSelect from './RuntimeVersionSelect';

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
            try {
                const res = await window.pywebview?.api?.install_go(version);
                if (res?.status === 'success') {
                    showToast(res.message || t('runtimes.go_install_success'), 'success');
                    return true;
                } else {
                    showToast(res?.message || t('runtimes.go_install_error'), 'error');
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
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('runtimes.go_version')}</label>

                <RuntimeVersionSelect isLoading={isLoading} versionsList={versionsList} version={version} setVersion={setVersion} />

                <span className="text-xs text-slate-500">
                    {t('runtimes.go_arch_desc_1')}<strong>windows/amd64</strong>{t('runtimes.go_arch_desc_2')}
                </span>
            </div>
        </div>
    );
});
export default InstallGo;
