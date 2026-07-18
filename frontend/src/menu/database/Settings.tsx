// src/menu/database/Settings.tsx

// Tipe data ini sebaiknya diekstrak ke file types.ts terpisah agar bisa di-import,
// namun untuk contoh ini kita deklarasikan kembali agar jelas.
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
}

export default function DbSettings({ instance }: Props) {
    // Variabel pembantu untuk mempermudah logika kondisional
    const isPostgres = instance.engine === 'postgres';
    const isMysql = instance.engine === 'mysql';

    return (
        <div className="flex flex-col gap-6">

            {/* --- PENGATURAN UMUM (COMMON SETTINGS) --- */}
            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                    Network Connection
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Port</label>
                        <input
                            type="number"
                            defaultValue={instance.port}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Bind Address</label>
                        <input
                            type="text"
                            // Postgres biasanya menggunakan '*' atau 'localhost', MySQL biasanya '127.0.0.1'
                            defaultValue={isPostgres ? '*' : '127.0.0.1'}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- PENGATURAN SPESIFIK ENGINE --- */}
            <div className="flex flex-col gap-4">
                {/* Judul akan berubah otomatis tergantung engine */}
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                    Performance ({isPostgres ? 'postgresql.conf' : 'my.ini'})
                </h4>

                <div className="grid grid-cols-2 gap-4">

                    {/* RENDER KHUSUS MYSQL / MARIADB */}
                    {isMysql && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">innodb_buffer_pool_size</label>
                                <input type="text" defaultValue="256M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_allowed_packet</label>
                                <input type="text" defaultValue="64M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_connections</label>
                                <input type="number" defaultValue="151" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                        </>
                    )}

                    {/* RENDER KHUSUS POSTGRESQL */}
                    {isPostgres && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">shared_buffers</label>
                                <input type="text" defaultValue="128MB" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">work_mem</label>
                                <input type="text" defaultValue="4MB" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_connections</label>
                                <input type="number" defaultValue="100" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none transition-colors" />
                            </div>
                        </>
                    )}

                </div>
            </div>

        </div>
    );
}