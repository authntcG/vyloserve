export default function NewPhpInstance() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select PHP Version</label>
                <select className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">
                    <option value="8.3.4">PHP 8.3.4</option>
                    <option value="8.2.16">PHP 8.2.16</option>
                    <option value="8.1.27">PHP 8.1.27</option>
                    <option value="7.4.33">PHP 7.4.33 (Legacy)</option>
                </select>
                <p className="text-xs text-slate-500">VyloServe will download the binaries automatically.</p>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">FastCGI Port Bind</label>
                <input type="number" defaultValue="9002" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors" />
                <p className="text-xs text-slate-500">Make sure the port is not used by other services.</p>
            </div>
        </div>
    );
}