import { useTranslation } from 'react-i18next';

interface RuntimeVersionSelectProps {
    readonly isLoading: boolean;
    readonly versionsList: any[];
    readonly version: string;
    readonly setVersion: (val: string) => void;
}

export default function RuntimeVersionSelect({ isLoading, versionsList, version, setVersion }: RuntimeVersionSelectProps) {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                </div>
                <select disabled className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-wait">
                    <option>{t('runtimes.retrieving_version')}</option>
                </select>
            </div>
        );
    }

    if (versionsList.length === 0) {
        return (
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="material-symbols-outlined text-[18px] text-red-500">wifi_off</span>
                </div>
                <select disabled className="w-full bg-red-50 dark:bg-red-900/10 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm rounded-lg block p-2.5 pl-10 outline-none appearance-none cursor-not-allowed">
                    <option>{t('runtimes.error_fetching_result')}</option>
                </select>
            </div>
        );
    }

    return (
        <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none cursor-pointer"
        >
            {versionsList.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
            ))}
        </select>
    );
}
