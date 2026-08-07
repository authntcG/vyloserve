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
    instance: DbInstance;
    config: any;
    onChange: (key: string, value: string | number) => void;
    isLoading: boolean;
}

export default function DbSettings({ instance, config, onChange, isLoading }: Props) {
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
                    Network Connection
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Port</label>
                        <input
                            type="number"
                            value={config.port || ''}
                            onChange={(e) => onChange('port', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors font-mono"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {isPostgres ? 'listen_addresses' : 'bind-address'}
                        </label>
                        <input
                            type="text"
                            value={isPostgres ? (config.listen_addresses || '') : (config.bind_address || '')}
                            onChange={(e) => onChange(isPostgres ? 'listen_addresses' : 'bind_address', e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors font-mono"
                        />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex justify-between">
                    <span>Performance Tweaks</span>
                    <span className="text-slate-400 font-mono text-xs normal-case">{isPostgres ? 'postgresql.conf' : 'my.ini'}</span>
                </h4>

                <div className="grid grid-cols-2 gap-4">
                    {/* MYSQL */}
                    {isMysql && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">innodb_buffer_pool_size</label>
                                <input type="text" value={config.innodb_buffer_pool_size || ''} onChange={(e) => onChange('innodb_buffer_pool_size', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_allowed_packet</label>
                                <input type="text" value={config.max_allowed_packet || ''} onChange={(e) => onChange('max_allowed_packet', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_connections</label>
                                <input type="number" value={config.max_connections || ''} onChange={(e) => onChange('max_connections', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">character_set_server</label>
                                <select value={config.character_set_server || 'utf8mb4'} onChange={(e) => onChange('character_set_server', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono">
                                    <option value="utf8mb4">utf8mb4</option>
                                    <option value="utf8">utf8</option>
                                    <option value="latin1">latin1</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">collation_server</label>
                                <input type="text" value={config.collation_server || 'utf8mb4_unicode_ci'} onChange={(e) => onChange('collation_server', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">default_storage_engine</label>
                                <input type="text" value={config.default_storage_engine || 'InnoDB'} onChange={(e) => onChange('default_storage_engine', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                        </>
                    )}

                    {/* POSTGRESQL */}
                    {isPostgres && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">shared_buffers</label>
                                <input type="text" value={config.shared_buffers || ''} onChange={(e) => onChange('shared_buffers', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">work_mem</label>
                                <input type="text" value={config.work_mem || ''} onChange={(e) => onChange('work_mem', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">maintenance_work_mem</label>
                                <input type="text" value={config.maintenance_work_mem || ''} onChange={(e) => onChange('maintenance_work_mem', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">effective_cache_size</label>
                                <input type="text" value={config.effective_cache_size || ''} onChange={(e) => onChange('effective_cache_size', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_connections</label>
                                <input type="number" value={config.max_connections || ''} onChange={(e) => onChange('max_connections', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">timezone</label>
                                <input type="text" value={config.timezone || ''} onChange={(e) => onChange('timezone', e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2 outline-none font-mono" />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 bg-amber-50 dark:bg-amber-900/10 p-2.5 rounded border border-amber-200/50 dark:border-amber-800/30 flex gap-2 items-start">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Saving configuration will automatically restart the database engine to apply the changes.
            </p>
        </div>
    );
}