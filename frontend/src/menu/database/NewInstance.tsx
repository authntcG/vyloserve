import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Select from '../../components/Select';
import ProgressBar from '../../components/ProgressBar';
import OsCompatibilityCard from '../../components/OsCompatibilityCard';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';

interface Props {
    activeTab: 'all' | 'mysql' | 'postgres';
    usedPorts: number[];
    isInstalling: boolean;
    progress: number;
    progressText: string;
}

export interface NewDbInstanceRef {
    getFormData: () => { engine: string; version: string; url: string; port: number; rootPass: string } | null;
}

interface OnlineVersion {
    name: string;
    version: string;
    url: string;
}

const NewDbInstance = forwardRef<NewDbInstanceRef, Props>(({ activeTab, usedPorts, isInstalling, progress, progressText }, ref) => {
    const { t } = useTranslation();
    const [engineFamily, setEngineFamily] = useState<'mysql' | 'postgres'>(
        activeTab === 'postgres' ? 'postgres' : 'mysql'
    );
    const [port, setPort] = useState(activeTab === 'postgres' ? 5432 : 3306);
    const [rootPass, setRootPass] = useState('');

    const [availableVersions, setAvailableVersions] = useState<OnlineVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [isFetchingVersions, setIsFetchingVersions] = useState(false);

    // ---> DETEKSI OS DARI FRONTEND <---
    const [osInfo, setOsInfo] = useState({ name: 'Windows', arch: 'x64', icon: 'window' });

    const bottomRef = useRef<HTMLDivElement>(null);

    const DISPLAY_LIMIT = 15;

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) {
            setOsInfo({ name: 'Windows', arch: 'Win64', icon: 'window' });
        } else if (userAgent.includes('mac')) {
            setOsInfo({ name: 'macOS', arch: 'Universal', icon: 'laptop_mac' });
        } else if (userAgent.includes('linux')) {
            setOsInfo({ name: 'Linux', arch: 'x86_64', icon: 'terminal' });
        }
    }, []);

    useEffect(() => {
        if (isInstalling && bottomRef.current) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [isInstalling]);

    useEffect(() => {
        // ---> GUARD TERHADAP RESPON ASYNC BASI (STALE) <---
        // `get_available_databases('mysql')` jauh lebih lambat (resolve tiap versi lewat
        // scraping HTML per-versi di backend) dibanding `get_available_databases('postgres')`
        // (satu kali fetch halaman). Kalau user switch engine dengan cepat, request LAMA bisa
        // resolve SETELAH request BARU -- tanpa guard ini, hasilnya `availableVersions` terisi
        // versi engine SEBELUMNYA padahal `engineFamily` sudah berpindah, sehingga
        // `getFormData()` mengirim `engine` yang benar tapi `version`/`url` milik engine lain
        // (mis. versi MariaDB "13.1.1" terpasang sebagai PostgreSQL). Lihat docs/known_bugs.md #52.
        let ignore = false;

        const fetchOnlineVersions = async (engine: string) => {
            setIsFetchingVersions(true);
            try {
                const api = window.pywebview?.api;
                if (api && typeof api.get_available_databases === 'function') {
                    const res = await api.get_available_databases(engine);
                    if (ignore) return;
                    if (res.status === 'success') {
                        setAvailableVersions(res.data);
                        if (res.data.length > 0) setSelectedVersion(res.data[0].version);
                    } else setAvailableVersions([]);
                }
            } catch (error) {
                if (!ignore) console.error("Gagal menarik versi DB online", error);
            } finally {
                if (!ignore) setIsFetchingVersions(false);
            }
        };

        fetchOnlineVersions(engineFamily);
        return () => { ignore = true; };
    }, [engineFamily]);

    useEffect(() => {
        if (activeTab !== 'all') {
            setEngineFamily(activeTab);
            setPort(activeTab === 'postgres' ? 5432 : 3306);
        }
    }, [activeTab]);

    useImperativeHandle(ref, () => ({
        getFormData: () => {
            const target = availableVersions.find(v => v.version === selectedVersion);
            if (!target) return null;
            return { engine: engineFamily, version: target.version, url: target.url, port, rootPass };
        }
    }));

    const baseInputClass = "w-full h-[42px] px-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm rounded-lg outline-none transition-colors border";
    const normalInputClass = `${baseInputClass} border-slate-300 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary`;
    const errorInputClass = `${baseInputClass} border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500`;
    const warningInputClass = `${baseInputClass} border-amber-500/50 focus:ring-1 focus:ring-amber-500`;
    const needsPostgresPasswordWarning = engineFamily === 'postgres' && !rootPass;
    const rootPassInputClass = needsPostgresPasswordWarning ? warningInputClass : normalInputClass;

    return (
        <div className="flex flex-col gap-5 relative">

            {/* ---> INFO SISTEM (Mengikuti gaya PHP) <--- */}
            <OsCompatibilityCard
                icon={osInfo.icon}
                detectedLabel={t('database.detected_system')}
                osName={osInfo.name}
                arch={osInfo.arch}
                compatibleLabel={t('database.compatible')}
            />

            <div className="flex flex-col gap-2">
                <FieldLabel>{t('database.database_engine_label')}</FieldLabel>
                <Select
                    searchable={false}
                    options={[
                        { value: 'mysql', label: t('database.mysql_mariadb') },
                        { value: 'postgres', label: t('database.postgres') },
                    ]}
                    value={engineFamily}
                    onChange={(eng) => {
                        setEngineFamily(eng);
                        setPort(eng === 'postgres' ? 5432 : 3306);
                    }}
                    placeholder={t('database.database_engine_label')}
                    disabled={isInstalling}
                />
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="grid grid-cols-2 gap-4">
                <Select
                    label={t('database.version')}
                    options={availableVersions.map(v => ({ value: v.version, label: v.name }))}
                    value={selectedVersion || null}
                    onChange={setSelectedVersion}
                    placeholder={t('database.select_version')}
                    searchPlaceholder={t('database.find_version')}
                    disabled={isInstalling}
                    loading={isFetchingVersions}
                    loadingText={t('database.retrieving_versions')}
                    errorText={availableVersions.length === 0 ? t('database.failed_to_fetch') : undefined}
                    emptyText={t('database.no_versions_found')}
                    displayLimit={DISPLAY_LIMIT}
                    truncatedText={`${t('database.showing_top')}${DISPLAY_LIMIT}${t('database.recent_releases')}`}
                />

                <div className="flex flex-col gap-2">
                    <FieldLabel>{t('database.tcp_port_bind')}</FieldLabel>
                    <input
                        type="number"
                        disabled={isInstalling}
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className={`${usedPorts.includes(port) ? errorInputClass : normalInputClass} ${isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : ''}`}
                    />
                    {usedPorts.includes(port) && !isInstalling && (
                        <p className="text-xs text-red-500 font-medium animate-in fade-in">{t('database.port_in_use')}{port}{t('database.in_use')}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t('database.initial_setup')}</h4>

                {engineFamily === 'postgres' && (
                    <InfoBox tone="warning" icon="security" className="mb-1 animate-in fade-in">{t('database.postgres_password_req')}</InfoBox>
                )}

                <div className="flex flex-col gap-2">
                    <FieldLabel size="xs">
                        {engineFamily === 'postgres' ? t('database.superuser_password') : t('database.root_password')}
                    </FieldLabel>
                    <input
                        type="password"
                        disabled={isInstalling}
                        value={rootPass}
                        onChange={(e) => setRootPass(e.target.value)}
                        placeholder={engineFamily === 'postgres' ? t('database.required_password_placeholder') : t('database.empty_password_placeholder')}
                        className={`${rootPassInputClass} ${isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : ''}`}
                    />
                </div>
            </div>

            {/* --- PROGRESS BAR DENGAN GAP YANG DIRAPATKAN --- */}
            <div ref={bottomRef} className="pt-1 mt-1">
                {isInstalling && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {progressText || t('database.starting_process')}
                            </span>
                            <span className="text-xs font-bold text-primary">
                                {progress}%
                            </span>
                        </div>
                        <ProgressBar percent={progress} />
                    </div>
                )}
            </div>
        </div>
    );
});

export default NewDbInstance;