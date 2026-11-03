import { useTranslation } from 'react-i18next';
import Select from '../../components/Select';
import OfflineBanner from '../../components/OfflineBanner';
import { useNetworkStatus } from '../../context/NetworkContext';

interface RuntimeVersionSelectProps {
    readonly isLoading: boolean;
    readonly versionsList: any[];
    readonly version: string;
    readonly setVersion: (val: string) => void;
    readonly onRetry?: () => void;
}

export default function RuntimeVersionSelect({ isLoading, versionsList, version, setVersion, onRetry }: RuntimeVersionSelectProps) {
    const { t } = useTranslation();
    const { isOnline } = useNetworkStatus();
    const showOfflineBanner = !isLoading && !isOnline;

    return (
        <div className="flex flex-col gap-3">
            {showOfflineBanner && (
                <OfflineBanner
                    onRetry={onRetry}
                    forceShow={showOfflineBanner}
                />
            )}
            <Select
                searchable={false}
                options={versionsList.map((v) => ({ value: v.value, label: v.label }))}
                value={version || null}
                onChange={setVersion}
                placeholder={!isLoading && versionsList.length === 0 ? t('common.offline_versions_unavailable') : t('runtimes.retrieving_version')}
                loading={isLoading}
                loadingText={t('runtimes.retrieving_version')}
                errorText={!isLoading && versionsList.length === 0 ? t('runtimes.error_fetching_result') : undefined}
            />
        </div>
    );
}
