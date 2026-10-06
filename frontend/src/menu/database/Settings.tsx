import { useTranslation } from 'react-i18next';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';

const CHARSET_OPTIONS = [
    { value: 'utf8mb4', label: 'utf8mb4' },
    { value: 'utf8', label: 'utf8' },
    { value: 'latin1', label: 'latin1' },
];

type DbEngineType = 'mysql' | 'postgres';

interface DbInstance {
    id: string;
    name: string;
    engine: DbEngineType;
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dataDir: string;
}

interface Props {
    readonly instance: DbInstance;
    readonly config: any;
    readonly onChange: (key: string, value: string | number) => void;
    readonly isLoading: boolean;
}

export default function DbSettings({ instance, config, onChange, isLoading }: Props) {
    const { t } = useTranslation();
    const isPostgres = instance.engine === 'postgres';
    const isMysql = instance.engine === 'mysql';

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-1/3 mb-2"></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                    <div className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                    {t('database.network_connection')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="db-port" size="sm">{t('database.port')}</FieldLabel>
                        <input type="number" id="db-port" value={config.port || ''} onChange={(e) => onChange('port', Number(e.target.value))} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors font-mono" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="db-bind-address" size="sm">
                            {isPostgres ? 'listen_addresses' : 'bind-address'}
                        </FieldLabel>
                        <input type="text" id="db-bind-address" value={isPostgres ? (config.listen_addresses || '') : (config.bind_address || '')} onChange={(e) => onChange(isPostgres ? 'listen_addresses' : 'bind_address', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors font-mono" />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex justify-between">
                    <span>{t('database.performance_tweaks')}</span>
                    <span className="text-slate-400 font-mono text-xs normal-case">{isPostgres ? 'postgresql.conf' : 'my.ini'}</span>
                </h4>

                <div className="grid grid-cols-2 gap-4">
                    {/* MYSQL */}
                    {isMysql && (
                        <>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-innodb-buffer-pool-size" size="sm">innodb_buffer_pool_size</FieldLabel>
                                <input type="text" id="db-innodb-buffer-pool-size" value={config.innodb_buffer_pool_size || ''} onChange={(e) => onChange('innodb_buffer_pool_size', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-max-allowed-packet" size="sm">max_allowed_packet</FieldLabel>
                                <input type="text" id="db-max-allowed-packet" value={config.max_allowed_packet || ''} onChange={(e) => onChange('max_allowed_packet', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-max-connections-mysql" size="sm">max_connections</FieldLabel>
                                <input type="number" id="db-max-connections-mysql" value={config.max_connections || ''} onChange={(e) => onChange('max_connections', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <Select
                                searchable={false}
                                label="character_set_server"
                                options={CHARSET_OPTIONS}
                                value={config.character_set_server || 'utf8mb4'}
                                onChange={(v) => onChange('character_set_server', v)}
                                placeholder="utf8mb4"
                            />
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-collation-server" size="sm">collation_server</FieldLabel>
                                <input type="text" id="db-collation-server" value={config.collation_server || 'utf8mb4_unicode_ci'} onChange={(e) => onChange('collation_server', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-default-storage-engine" size="sm">default_storage_engine</FieldLabel>
                                <input type="text" id="db-default-storage-engine" value={config.default_storage_engine || 'InnoDB'} onChange={(e) => onChange('default_storage_engine', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                        </>
                    )}

                    {/* POSTGRESQL */}
                    {isPostgres && (
                        <>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="shared_buffers" size="sm">shared_buffers</FieldLabel>
                                <input type="text" id="shared_buffers" value={config.shared_buffers || ''} onChange={(e) => onChange('shared_buffers', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-work-mem" size="sm">work_mem</FieldLabel>
                                <input type="text" id="db-work-mem" value={config.work_mem || ''} onChange={(e) => onChange('work_mem', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-maintenance-work-mem" size="sm">maintenance_work_mem</FieldLabel>
                                <input type="text" id="db-maintenance-work-mem" value={config.maintenance_work_mem || ''} onChange={(e) => onChange('maintenance_work_mem', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="effective_cache_size" size="sm">effective_cache_size</FieldLabel>
                                <input type="text" id="effective_cache_size" value={config.effective_cache_size || ''} onChange={(e) => onChange('effective_cache_size', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="db-max-connections-pg" size="sm">max_connections</FieldLabel>
                                <input type="number" id="db-max-connections-pg" value={config.max_connections || ''} onChange={(e) => onChange('max_connections', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel htmlFor="timezone" size="sm">timezone</FieldLabel>
                                <input type="text" id="timezone" value={config.timezone || ''} onChange={(e) => onChange('timezone', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono" />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <InfoBox tone="warning" icon="info" className="mt-2">{t('database.save_restart_warning')}</InfoBox>
        </div>
    );
}