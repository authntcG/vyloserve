interface HeaderMobileProps {
    onMenuClick: () => void;
}

export default function HeaderMobile({ onMenuClick }: HeaderMobileProps) {
    return (
        <header className="flex items-center justify-between px-md py-sm bg-surface dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-full sticky top-0 z-40 md:hidden">
            <div className="flex items-center gap-sm">
                <button
                    onClick={onMenuClick}
                    className="p-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>menu</span>
                </button>
                <h1 className="font-headline-md text-headline-md font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
            </div>
            <button className="p-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            </button>
        </header>
    );
}