import { useEffect, useState } from 'react';

// Import Aset Logo (Light & Dark)
import brandNavLight from '../assets/brand-nav.png';
import brandNavDark from '../assets/brand-nav-dark.png';

interface SidebarProps {
    isMobileOpen: boolean;
    isDesktopCollapsed: boolean;
    onCloseMobile: () => void;
    onToggleDesktop: () => void;
    activeMenu: string;
    onSelectMenu: (id: string) => void;
}

const MAIN_MENU = [
    { id: 'dashboard', name: 'Dashboard', icon: 'space_dashboard' }
];

const SERVICES = [
    { id: 'apache', name: 'Apache', icon: 'dns' },
    { id: 'php', name: 'PHP', icon: 'code' },
    { id: 'database', name: 'Database', icon: 'database' },
];

const TOOLS = [
    { id: 'qr', name: 'QR Generator', icon: 'qr_code_2' },
    { id: 'base64', name: 'Base64 Encoder', icon: 'code_blocks' },
    { id: 'url', name: 'URL Encode/Decode', icon: 'link' },
];

export default function Sidebar({
    isMobileOpen,
    isDesktopCollapsed,
    onCloseMobile,
    onToggleDesktop,
    activeMenu,
    onSelectMenu
}: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [systemLoad, setSystemLoad] = useState<number>(0);
    const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({
        apache: false,
        php: false,
        database: false
    });

    const getBackendApi = () => window.pywebview?.api;

    const fetchServiceStatuses = async () => {
        const api = getBackendApi();
        if (!api || typeof api.get_all_services_status !== 'function') return;

        try {
            const status = await api.get_all_services_status();
            setServiceStatus(status);
            if (status.cpu_load !== undefined) setSystemLoad(status.cpu_load);
        } catch (error) {
            console.error("Gagal sinkronisasi status:", error);
        }
    };

    useEffect(() => {
        fetchServiceStatuses();
        const interval = setInterval(fetchServiceStatuses, 2000);

        const handleStatusSync = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.service) {
                fetchServiceStatuses();
            }
        };
        window.addEventListener('service_status_changed', handleStatusSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener('service_status_changed', handleStatusSync);
        };
    }, []);

    const handleToggleClick = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const api = getBackendApi();
        if (!api) return;

        const isRunning = serviceStatus[id];
        try {
            if (isRunning && typeof api.stop_service === 'function') {
                await api.stop_service(id);
            } else if (!isRunning && typeof api.start_service === 'function') {
                await api.start_service(id);
            }

            fetchServiceStatuses();
            window.dispatchEvent(new CustomEvent('service_status_changed', {
                detail: { service: id, running: !isRunning }
            }));
        } catch (error) {
            console.error(`Gagal mengubah status ${id}:`, error);
        }
    };

    const sidebarWidthClass = isDesktopCollapsed ? 'w-20' : 'w-sidebar-width';
    const mobileTranslateClass = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

    const filterQuery = (item: { name: string }) => item.name.toLowerCase().includes(searchQuery.toLowerCase());

    const filteredMain = MAIN_MENU.filter(filterQuery);
    const filteredServices = SERVICES.filter(filterQuery);
    const filteredTools = TOOLS.filter(filterQuery);
    const showToolsDropdown = isToolsOpen || (searchQuery !== '' && filteredTools.length > 0);

    return (
        <>
            {isMobileOpen && (
                <div onClick={onCloseMobile} className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity" />
            )}

            <nav className={`bg-surface dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-64px)] md:h-screen fixed left-0 top-[64px] md:top-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${sidebarWidthClass} ${mobileTranslateClass}`}>

                {/* Header Logo */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800 h-[72px]">
                    <div className={`transition-all duration-300 overflow-hidden flex items-center shrink-0 ${isDesktopCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-1'}`}>
                        <img src={brandNavLight} alt="VyloServe" className="h-7 w-auto object-contain block dark:hidden" draggable="false" />
                        <img src={brandNavDark} alt="VyloServe" className="h-7 w-auto object-contain hidden dark:block" draggable="false" />
                    </div>

                    <div className="flex items-center gap-2 mx-auto md:mx-0 shrink-0">
                        <button onClick={onToggleDesktop} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors hidden md:flex items-center justify-center outline-none">
                            <span className="material-symbols-outlined">{isDesktopCollapsed ? 'menu' : 'menu_open'}</span>
                        </button>
                        <button onClick={onCloseMobile} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors md:hidden flex items-center justify-center outline-none">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className={`transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? 'max-h-0 opacity-0' : 'max-h-[80px] opacity-100'}`}>
                    <div className="px-4 py-4">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary text-slate-900 dark:text-slate-100 rounded-md py-2 pl-10 pr-3 text-sm transition-all outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <div className={`flex flex-col gap-1 py-2 px-2 flex-1 custom-scrollbar ${isDesktopCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>

                    {/* Overview */}
                    {filteredMain.map(menu => (
                        <div
                            key={menu.id}
                            onClick={() => onSelectMenu(menu.id)}
                            className={`flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${activeMenu === menu.id ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: activeMenu === menu.id ? "'FILL' 1" : "'FILL' 0" }}>{menu.icon}</span>
                            <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>{menu.name}</span>
                        </div>
                    ))}

                    {/* Services */}
                    {filteredServices.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all ${isDesktopCollapsed ? 'hidden' : 'pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                            Services
                        </div>
                    )}
                    {filteredServices.map(service => {
                        const isSelected = activeMenu === service.id;
                        return (
                            <div
                                key={service.id}
                                onClick={() => onSelectMenu(service.id)}
                                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>{service.icon}</span>
                                    <span className={`font-medium text-sm truncate transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>{service.name}</span>
                                </div>

                                <label className={`relative inline-flex items-center cursor-pointer transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[40px] opacity-100'}`} onClick={(e) => handleToggleClick(service.id, e)}>
                                    <input type="checkbox" checked={serviceStatus[service.id] || false} readOnly className="sr-only peer" />
                                    <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                        );
                    })}

                    {/* Utilities Tools */}
                    {filteredTools.length > 0 && (
                        <div className="relative group mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <div
                                className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => !isDesktopCollapsed && setIsToolsOpen(!isToolsOpen)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined shrink-0">construction</span>
                                    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>Tools</span>
                                </div>
                                <span className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${isDesktopCollapsed ? 'hidden' : ''}`} style={{ transform: showToolsDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                            </div>

                            {/* Dropdown Menu */}
                            {!isDesktopCollapsed && showToolsDropdown && (
                                <div className="flex flex-col gap-1 ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 my-1">
                                    {filteredTools.map(tool => (
                                        <div key={tool.id} onClick={() => onSelectMenu(tool.id)} className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors ${activeMenu === tool.id ? 'text-primary bg-slate-50 dark:bg-slate-800/50' : 'text-slate-500 dark:text-slate-400 hover:text-primary'}`}>
                                            <span className="material-symbols-outlined text-[18px] shrink-0">{tool.icon}</span>
                                            <span className="font-medium text-sm">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Flyout jika Collapsed */}
                            {isDesktopCollapsed && (
                                <div className="absolute left-[calc(100%+4px)] top-0 w-48 flex-col gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                    <div className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">Tools</div>
                                    {filteredTools.map(tool => (
                                        <div key={tool.id} onClick={() => onSelectMenu(tool.id)} className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer ${activeMenu === tool.id ? 'text-primary bg-slate-50 dark:bg-slate-800' : 'text-slate-600 dark:text-slate-300'}`}>
                                            <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
                                            <span className="font-medium text-sm truncate">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer System Load */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto flex justify-center md:justify-start">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 w-full">
                        <span className={`material-symbols-outlined text-[20px] ${systemLoad > 80 ? 'text-red-500' : systemLoad > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>memory</span>
                        <span className={`text-xs font-medium uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap ${isDesktopCollapsed ? 'max-w-0 opacity-0 hidden' : 'max-w-[150px] opacity-100'}`}>
                            System Load: <span className={systemLoad > 80 ? 'text-red-500 font-bold' : ''}>{systemLoad}%</span>
                        </span>
                    </div>
                </div>
            </nav>
        </>
    );
}