export default function NewDbInstance() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Engine & Version</label>
                <select className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">
                    <option value="mariadb-11.3">MariaDB 11.3 (Current)</option>
                    <option value="mariadb-10.11">MariaDB 10.11 (LTS)</option>
                    <option value="mysql-8.0">MySQL 8.0</option>
                    <option value="mysql-5.7">MySQL 5.7 (Legacy)</option>
                </select>
                <p className="text-xs text-slate-500">VyloServe will download the binaries automatically.</p>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">TCP Port Bind</label>
                <input type="number" defaultValue="3306" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors" />
                <p className="text-xs text-slate-500">Default port is 3306. Change this if running multiple instances.</p>
            </div>
        </div>
    );
}