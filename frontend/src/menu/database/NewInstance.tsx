// src/menu/database/NewInstance.tsx
import { useState, useEffect } from 'react';

interface Props {
    activeTab: 'all' | 'mysql' | 'postgres';
}

export default function NewDbInstance({ activeTab }: Props) {
    // Tentukan engine awal sesuai dengan tab yang sedang dibuka pengguna.
    // Jika tab 'all' yang terbuka, kita jadikan 'mysql' sebagai default.
    const [engineFamily, setEngineFamily] = useState<'mysql' | 'postgres'>(
        activeTab === 'postgres' ? 'postgres' : 'mysql'
    );

    // Jika activeTab berubah dari luar (props), update state internal
    useEffect(() => {
        if (activeTab !== 'all') {
            setEngineFamily(activeTab);
        }
    }, [activeTab]);

    return (
        <div className="flex flex-col gap-5">

            {/* --- PILIHAN ENGINE UTAMA --- */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Database Engine</label>
                <select
                    value={engineFamily}
                    onChange={(e) => setEngineFamily(e.target.value as 'mysql' | 'postgres')}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                >
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="postgres">PostgreSQL</option>
                </select>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* --- FORM DINAMIS: VERSI & PORT --- */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Version</label>
                    <select className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">

                        {/* Opsi Versi Khusus MySQL / MariaDB */}
                        {engineFamily === 'mysql' && (
                            <>
                                <option value="mariadb-11.3">MariaDB 11.3 (Current)</option>
                                <option value="mariadb-10.11">MariaDB 10.11 (LTS)</option>
                                <option value="mysql-8.0">MySQL 8.0</option>
                                <option value="mysql-5.7">MySQL 5.7 (Legacy)</option>
                            </>
                        )}

                        {/* Opsi Versi Khusus PostgreSQL */}
                        {engineFamily === 'postgres' && (
                            <>
                                <option value="pg-16">PostgreSQL 16</option>
                                <option value="pg-15">PostgreSQL 15</option>
                                <option value="pg-14">PostgreSQL 14</option>
                            </>
                        )}
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">TCP Port Bind</label>
                    <input
                        type="number"
                        // Key digunakan agar React me-reset nilai default saat engineFamily berubah
                        key={`port-${engineFamily}`}
                        defaultValue={engineFamily === 'postgres' ? 5432 : 3306}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                    />
                </div>
            </div>

            {/* --- FORM DINAMIS: AUTENTIKASI --- */}
            <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Initial Authentication</h4>

                {engineFamily === 'mysql' ? (
                    // Autentikasi MySQL
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Root Password</label>
                        <input
                            type="password"
                            placeholder="Leave empty for no password"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Default user will be <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">root</code></p>
                    </div>
                ) : (
                    // Autentikasi PostgreSQL
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Superuser Name</label>
                            <input
                                type="text"
                                defaultValue="postgres"
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                            <input
                                type="password"
                                placeholder="Required for PgSQL"
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}