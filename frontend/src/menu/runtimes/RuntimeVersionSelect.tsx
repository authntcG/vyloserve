import { useTranslation } from 'react-i18next';
import Select from '../../components/Select';

interface RuntimeVersionSelectProps {
    readonly isLoading: boolean;
    readonly versionsList: any[];
    readonly version: string;
    readonly setVersion: (val: string) => void;
}

export default function RuntimeVersionSelect({ isLoading, versionsList, version, setVersion }: RuntimeVersionSelectProps) {
    const { t } = useTranslation();

    return (
        <Select
            searchable={false}
            options={versionsList.map((v) => ({ value: v.value, label: v.label }))}
            value={version || null}
            onChange={setVersion}
            placeholder={t('runtimes.retrieving_version')}
            loading={isLoading}
            loadingText={t('runtimes.retrieving_version')}
            errorText={!isLoading && versionsList.length === 0 ? t('runtimes.error_fetching_result') : undefined}
        />
    );
}
