import { useEffect, useState } from 'react';

// Import Aset Logo (Light & Dark)
import brandNavLight from '../assets/brand-nav.png';
import brandNavDark from '../assets/brand-nav-dark.png';

interface MainMenuItem {
    id: string;
    name: string;
    icon: string;
}

interface ServiceItem {
    id: string;
    name: string;
    icon: string;
    isActive: boolean;
}

interface ToolItem {
    id: string;
    name: string;
    icon: string;
}

interface SidebarProps {
    isMobileOpen: boolean;
    isDesktopCollapsed: boolean;
    onCloseMobile: () => void;
    onToggleDesktop: () => void;
    activeMenu: string;
    onSelectMenu: (id: string) => void;
}

const MAIN_MENU: MainMenuItem[] = [
    { id: 'dashboard', name: 'Dashboard', icon: 'space_dashboard' }
];

const SERVICES: ServiceItem[] = [
    { id: 'apache', name: 'Apache', icon: 'dns', isActive: true },
    { id: 'php', name: 'PHP', icon: 'code', isActive: false },
    { id: 'database', name: 'Database', icon: 'database', isActive: false },
];

const TOOLS: ToolItem[] = [
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

    const getBackendApi = () => {
        return window.pywebview?.api || window.api;
    };

    const fetchServiceStatuses = async () => {
        const api = getBackendApi();

        if (!api || typeof api.get_all_services_status !== 'function') {
            setServiceStatus({ apache: true, php: false, database: false });
            return;
        }

        try {
            const status = await api.get_all_services_status();
            setServiceStatus(status);

            if (status.cpu_load !== undefined) {
                setSystemLoad(status.cpu_load);
            }
        } catch (error) {
            console.error("Gagal sinkronisasi status:", error);
        }
    };

    useEffect(() => {
        fetchServiceStatuses();
        const interval = setInterval(fetchServiceStatuses, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleClick = async (id: string) => {
        const api = getBackendApi();
        if (!api) return;

        const isCurrentlyRunning = serviceStatus[id];

        try {
            if (isCurrentlyRunning) {
                await api.stop_service(id);
            } else {
                await api.start_service(id);
            }

            fetchServiceStatuses();
            window.dispatchEvent(new CustomEvent('service_status_changed', {
                detail: { service: id, running: !isCurrentlyRunning }
            }));

        } catch (error) {
            console.error(`Gagal mengubah status ${id}:`, error);
        }
    };

    const sidebarWidthClass = isDesktopCollapsed ? 'w-20' : 'w-sidebar-width';
    const mobileTranslateClass = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

    const filteredMain = MAIN_MENU.filter(menu =>
        menu.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredServices = SERVICES.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTools = TOOLS.filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showToolsDropdown = isToolsOpen || (searchQuery !== '' && filteredTools.length > 0);

    return (
        <>
            {isMobileOpen && (
                <div onClick={onCloseMobile} className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity" />
            )}

            <nav className={`bg-surface dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-64px)] md:h-screen fixed left-0 top-[64px] md:top-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${sidebarWidthClass} ${mobileTranslateClass}`}>

                {/* --- HEADER DENGAN LOGO BRAND & ANIMASI SMOOTH --- */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800 h-[72px]">

                    {/* Logo Wrapper dengan Transisi Lebar */}
                    <div className={`transition-all duration-300 overflow-hidden flex items-center shrink-0 ${isDesktopCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-1'}`}>
                        <img src={brandNavLight} alt="VyloServe" className="h-7 w-auto object-contain block dark:hidden" draggable="false" />
                        <img src={brandNavDark} alt="VyloServe" className="h-7 w-auto object-contain hidden dark:block" draggable="false" />
                    </div>

                    <div className="flex items-center gap-2 mx-auto md:mx-0 shrink-0">
                        <button onClick={onToggleDesktop} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors hidden md:flex items-center justify-center outline-none">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                                {isDesktopCollapsed ? 'menu' : 'menu_open'}
                            </span>
                        </button>
                        <button onClick={onCloseMobile} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors md:hidden flex items-center justify-center outline-none">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>close</span>
                        </button>
                    </div>
                </div>

                {/* --- SEARCH BAR DENGAN ANIMASI FOLD --- */}
                <div className={`transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? 'max-h-0 opacity-0' : 'max-h-[80px] opacity-100'}`}>
                    <div className="px-4 py-4">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary text-slate-900 dark:text-slate-100 rounded-md py-2 pl-10 pr-3 text-sm transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                {/* --- NAVIGATION ITEMS --- */}
                {/* Enhancement: Mematikan auto-scroll (overflow-y-auto) saat collapsed agar Flyout Submenu tidak terpotong (clipped) */}
                <div className={`flex flex-col gap-1 py-2 px-2 flex-1 custom-scrollbar ${isDesktopCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>

                    {/* MAIN MENU SECTION */}
                    {filteredMain.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-h-0 opacity-0 pt-0' : 'max-h-[40px] opacity-100 pt-2'}`}>
                            Overview
                        </div>
                    )}
                    {filteredMain.map((menu) => {
                        const isMenuSelected = activeMenu === menu.id;
                        return (
                            <div
                                key={menu.id}
                                onClick={() => onSelectMenu(menu.id)}
                                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors duration-200 group ${isMenuSelected ? 'bg-slate-100 dark:bg-slate-800 text-primary-fixed-dim dark:text-primary-fixed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title={isDesktopCollapsed ? menu.name : ''}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`material-symbols-outlined shrink-0 ${isMenuSelected ? 'text-primary' : ''}`} style={{ fontVariationSettings: isMenuSelected ? "'FILL' 1" : "'FILL' 0" }}>{menu.icon}</span>
                                    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                                        {menu.name}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* SERVICES SECTION */}
                    {filteredServices.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-h-0 opacity-0 pt-0 border-transparent mt-0' : 'max-h-[40px] opacity-100 pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                            Services
                        </div>
                    )}

                    {filteredServices.map((service) => {
                        const isMenuSelected = activeMenu === service.id;

                        return (
                            <div
                                key={service.id}
                                onClick={() => onSelectMenu(service.id)}
                                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors duration-200 group ${isMenuSelected ? 'bg-slate-100 dark:bg-slate-800 text-primary-fixed-dim dark:text-primary-fixed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title={isDesktopCollapsed ? service.name : ''}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`material-symbols-outlined shrink-0 ${isMenuSelected ? 'text-primary' : ''}`} style={{ fontVariationSettings: isMenuSelected ? "'FILL' 1" : "'FILL' 0" }}>{service.icon}</span>
                                    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                                        {service.name}
                                    </span>
                                </div>

                                {/* Animated Switch Toggle */}
                                <label
                                    className={`relative inline-flex items-center cursor-pointer overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[40px] opacity-100'}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleClick(service.id);
                                    }}
                                >
                                    <input type="checkbox" checked={serviceStatus[service.id] || false} readOnly className="sr-only peer" />
                                    <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                        );
                    })}

                    {/* TOOLS / UTILITIES SECTION DENGAN HOVER FLYOUT */}
                    {filteredTools.length > 0 && (
                        <div className="relative group">

                            <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-h-0 opacity-0 pt-0 border-transparent mt-0' : 'max-h-[40px] opacity-100 pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                                Utilities
                            </div>

                            <div
                                className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 relative"
                                onClick={() => !isDesktopCollapsed && setIsToolsOpen(!isToolsOpen)}
                                title={isDesktopCollapsed ? "Utilities" : ""}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>construction</span>
                                    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                                        Tools
                                    </span>
                                </div>

                                {/* Indikator Mode Normal (Expand Arrow) */}
                                <span
                                    className={`material-symbols-outlined text-[20px] transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[20px] opacity-100'}`}
                                    style={{ transform: showToolsDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                >
                                    expand_more
                                </span>

                                {/* Indikator Mode Collapsed (Chevron Right) */}
                                {isDesktopCollapsed && (
                                    <span className="material-symbols-outlined text-[14px] absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 opacity-60">
                                        chevron_right
                                    </span>
                                )}
                            </div>

                            {/* --- EXPANDED MODE: INLINE DROPDOWN --- */}
                            <div className={`transition-all duration-300 overflow-hidden ${(!isDesktopCollapsed && showToolsDropdown) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="flex flex-col gap-1 ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 my-1">
                                    {filteredTools.map((tool) => (
                                        <div key={tool.id} onClick={() => onSelectMenu(tool.id)} className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors duration-200 ${activeMenu === tool.id ? 'text-primary dark:text-primary bg-slate-50 dark:bg-slate-800/50' : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>{tool.icon}</span>
                                            <span className="font-medium text-sm whitespace-nowrap">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* --- COLLAPSED MODE: HOVER FLYOUT POP-UP --- */}
                            {isDesktopCollapsed && (
                                <div className="absolute left-[calc(100%+4px)] top-0 w-48 flex-col gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0">
                                    <div className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                                        Utilities Tools
                                    </div>
                                    {filteredTools.map((tool) => (
                                        <div key={tool.id} onClick={() => onSelectMenu(tool.id)} className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors duration-200 ${activeMenu === tool.id ? 'text-primary dark:text-primary bg-slate-50 dark:bg-slate-800/50' : 'text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>{tool.icon}</span>
                                            <span className="font-medium text-sm truncate">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    )}

                    {filteredMain.length === 0 && filteredServices.length === 0 && filteredTools.length === 0 && (
                        <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                            No results found for "{searchQuery}"
                        </div>
                    )}

                </div>

                {/* --- FOOTER: SYSTEM LOAD (SIMPLIFIED ON COLLAPSED) --- */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto transition-all duration-300 flex justify-center md:justify-start">
                    <div
                        className={`flex items-center gap-2 text-slate-500 dark:text-slate-400 w-full ${isDesktopCollapsed ? 'justify-center flex-col gap-1' : ''}`}
                        title={isDesktopCollapsed ? `System Load: ${systemLoad}%` : ''}
                    >
                        {/* Ikon CPU Berubah Warna Otomatis */}
                        <span className={`material-symbols-outlined transition-colors text-[20px] ${systemLoad > 80 ? 'text-red-500' : systemLoad > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            memory
                        </span>

                        {/* Teks Lengkap (Sembunyikan saat Collapsed dengan transisi) */}
                        <span className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0 hidden' : 'max-w-[150px] opacity-100'}`}>
                            System Load:
                            <span className={`transition-colors ${systemLoad > 80 ? 'text-red-500 font-bold' : systemLoad > 50 ? 'text-amber-500 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                {systemLoad}%
                            </span>
                        </span>

                        {/* Indikator Angka Kecil (Hanya Muncul saat Collapsed) */}
                        {isDesktopCollapsed && (
                            <span className={`text-[10px] font-bold transition-colors ${systemLoad > 80 ? 'text-red-500' : systemLoad > 50 ? 'text-amber-500' : 'text-slate-500'}`}>
                                {systemLoad}%
                            </span>
                        )}
                    </div>
                </div>

            </nav>
        </>
    );
}