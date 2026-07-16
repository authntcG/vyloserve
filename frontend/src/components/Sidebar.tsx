interface ServiceItem {
    id: string;
    name: string;
    icon: string;
    isActive: boolean;
}

interface SidebarProps {
    isMobileOpen: boolean;
    isDesktopCollapsed: boolean;
    onCloseMobile: () => void;
    onToggleDesktop: () => void;
}

const SERVICES: ServiceItem[] = [
    { id: 'apache', name: 'Apache', icon: 'dns', isActive: true },
    { id: 'php', name: 'PHP', icon: 'code', isActive: false },
    { id: 'mysql', name: 'MySQL', icon: 'database', isActive: false },
    { id: 'postgres', name: 'PostgreSQL', icon: 'storage', isActive: false },
];

export default function Sidebar({ isMobileOpen, isDesktopCollapsed, onCloseMobile, onToggleDesktop }: SidebarProps) {
    const sidebarWidthClass = isDesktopCollapsed ? 'w-20' : 'w-sidebar-width';
    const mobileTranslateClass = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

    return (
        <>
            {/* Overlay Mobile */}
            {isMobileOpen && (
                <div
                    onClick={onCloseMobile}
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity"
                />
            )}

            {/* Drawer */}
            <nav className={`bg-surface dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-64px)] md:h-screen fixed left-0 top-[64px] md:top-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${sidebarWidthClass} ${mobileTranslateClass}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-md py-md border-b border-slate-200 dark:border-slate-800">
                    {!isDesktopCollapsed && (
                        <h1 className="font-headline-md text-lg font-semibold text-slate-900 dark:text-slate-100 transition-opacity duration-200">ServerPanel</h1>
                    )}
                    <div className="flex items-center gap-2 mx-auto md:mx-0">
                        <button onClick={onToggleDesktop} className="p-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors hidden md:block">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                                {isDesktopCollapsed ? 'menu' : 'menu_open'}
                            </span>
                        </button>
                        <button onClick={onCloseMobile} className="p-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors md:hidden">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>close</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                {!isDesktopCollapsed && (
                    <div className="px-md py-md transition-opacity duration-200">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                            <input type="text" placeholder="Search services..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary text-slate-900 dark:text-slate-100 rounded-md py-2 pl-10 pr-3 text-sm transition-all outline-none placeholder:text-slate-400" />
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <div className="flex flex-col gap-1 py-2 px-2 flex-1 overflow-y-auto">
                    {SERVICES.map((service) => (
                        <div key={service.id} className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors duration-200 group ${service.isActive ? 'bg-slate-100 dark:bg-slate-800 text-primary-fixed-dim dark:text-primary-fixed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`material-symbols-outlined ${service.isActive ? 'text-primary' : ''}`} style={{ fontVariationSettings: service.isActive ? "'FILL' 1" : "'FILL' 0" }}>{service.icon}</span>
                                {!isDesktopCollapsed && (
                                    <span className="font-medium text-sm transition-opacity duration-200">{service.name}</span>
                                )}
                            </div>

                            {!isDesktopCollapsed && (
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked={service.isActive} className="sr-only peer" />
                                    <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {!isDesktopCollapsed && (
                    <div className="p-md border-t border-slate-200 dark:border-slate-800 mt-auto transition-opacity duration-200">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">memory</span>
                            <span className="text-xs font-medium uppercase tracking-wider">System Load: 24%</span>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}