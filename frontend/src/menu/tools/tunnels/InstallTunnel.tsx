import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ToastContext';
import Select from '../../../components/Select';
import InfoBox from '../../../components/InfoBox';

export interface InstallTunnelRef { submit: () => Promise<boolean>; }

interface OnlineVersion {
    id: string;
    name: string;
    version: string;
}

interface InstallTunnelProps {
    readonly fetchVersionsApi: () => Promise<any>;
    readonly installApi: (version: string) => Promise<any>;
    readonly translations: {
        readonly fetchFailed: string;
        readonly installSuccess: string;
        readonly installFailed: string;
        readonly info1: string;
        readonly info2: string;
        readonly versionLabel: string;
    };
}

const InstallTunnel = forwardRef<InstallTunnelRef, InstallTunnelProps>(({ fetchVersionsApi, installApi, translations }, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [version, setVersion] = useState('');
    const [versionsList, setVersionsList] = useState<OnlineVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await fetchVersionsApi();
                if (res?.status === 'success' && res.data.length > 0) {
                    const mappedVersions = res.data.map((d: any) => ({
                        id: d.id,
                        name: d.label,
                        version: d.value
                    }));
                    setVersionsList(mappedVersions);
                    setVersion(mappedVersions[0].version);
                } else {
                    setVersionsList([]);
                }
            } catch {
                setVersionsList([]);
                showToast(t(translations.fetchFailed), 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!version) return false;
            try {
                const res = await installApi(version);
                if (res?.status === 'success') {
                    showToast((res.message ? t(res.message, res.args || {}) : t(translations.installSuccess)) as string, 'success');
                    return true;
                } else {
                    showToast((res?.message ? t(res.message, res.args || {}) : t(translations.installFailed)) as string, 'error');
                    return false;
                }
            } catch {
                showToast(t('backend.error.unexpected'), 'error');
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <p className="text-slate-600 dark:text-slate-400">
                {t(translations.info1)}
            </p>
            <Select
                label={t(translations.versionLabel)}
                options={versionsList.map(v => ({ value: v.version, label: v.name }))}
                value={version || null}
                onChange={setVersion}
                placeholder={t('tools.zrok.select')}
                searchPlaceholder={t('tools.zrok.find')}
                loading={isLoading}
                loadingText={t('tools.zrok.retrieving')}
                errorText={versionsList.length === 0 ? t(translations.fetchFailed) : undefined}
                emptyText={t('tools.zrok.no_versions')}
            />
            <InfoBox tone="info" icon="info">{t(translations.info2)}</InfoBox>
        </div>
    );
});

export default InstallTunnel;
