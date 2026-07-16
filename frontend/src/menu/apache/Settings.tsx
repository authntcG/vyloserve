// src/menu/apache/Settings.tsx

export default function ApacheSettings() {
    return (
        <>
            {/* Version Selector */}
            <div className="flex flex-col gap-2">
                <label htmlFor="apache-version" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Active Version
                </label>
                <select
                    id="apache-version"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                    defaultValue="2.4.54"
                >
                    <option value="2.4.58">Apache 2.4.58 (Latest)</option>
                    <option value="2.4.54">Apache 2.4.54</option>
                    <option value="2.4.41">Apache 2.4.41 (Legacy)</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Changing the version will automatically restart the Apache service.
                </p>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Quick Shortcuts */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Essential Configurations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">description</span>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">httpd.conf</span>
                            <span className="text-xs text-slate-500">Main configuration</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">link</span>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">vhosts.conf</span>
                            <span className="text-xs text-slate-500">Virtual domains setup</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">bug_report</span>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">error.log</span>
                            <span className="text-xs text-slate-500">View crash reports</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">sync_alt</span>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">PHP Binding</span>
                            <span className="text-xs text-slate-500">FastCGI setup</span>
                        </div>
                    </button>
                </div>
            </div>
        </>
    );
}