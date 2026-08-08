export default function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-pulse">
            <div className="flex items-center justify-between mb-2">
                <div className="h-5 bg-slate-200 dark:bg-slate-700/50 rounded w-1/3"></div>
                <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700/50 rounded-full"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3 w-full">
                <div className="flex flex-col gap-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-16"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-12"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-16"></div>
                </div>
                <div className="flex flex-col gap-2 col-span-2 md:col-span-3">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-48"></div>
                </div>
            </div>
            <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="h-9 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                <div className="h-9 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
            </div>
        </div>
    );
}