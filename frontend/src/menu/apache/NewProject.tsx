export default function NewProject() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                <input type="text" placeholder="e.g., My Awesome Site" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors" />
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Local Domain</label>
                <div className="flex">
                    <input type="text" placeholder="my-site" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-l-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors" />
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-100 border border-l-0 border-slate-300 rounded-r-lg dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">.local</span>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Document Root (Public Folder)</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="C:/Projects/my-site/public" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors" />
                    <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors font-medium text-sm text-slate-700 dark:text-slate-300">Browse</button>
                </div>
            </div>
        </div>
    );
}