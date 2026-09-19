import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsModals from '../menu/tools/settings/SettingsModals';
import type { SettingsModalType } from '../menu/tools/settings/SettingsModals';

// Import Aset Logo (Light & Dark)
import brandNavLight from '../assets/brand-nav.png';
import brandNavDark from '../assets/brand-nav-dark.png';

interface SidebarProps {
    readonly isMobileOpen: boolean;
    readonly isDesktopCollapsed: boolean;
    readonly onCloseMobile: () => void;
    readonly onToggleDesktop: () => void;
    readonly activeMenu: string;
    readonly onSelectMenu: (id: string) => void;
}

interface NavItemConfig {
    id: string;
    name: string;
    icon: string;
}

interface ServiceConfig extends NavItemConfig {
    hasToggle: boolean;
}

const MAIN_MENU: NavItemConfig[] = [
    { id: 'dashboard', name: 'Dashboard', icon: 'space_dashboard' }
];

const SERVICES: ServiceConfig[] = [
    { id: 'apache', name: 'Apache', icon: 'dns', hasToggle: true },
    { id: 'php', name: 'PHP', icon: 'code', hasToggle: true },
    { id: 'database', name: 'Database', icon: 'database', hasToggle: true },
    // Runtimes bukan service yang bisa di-start/stop secara tunggal (tidak ada
    // endpoint start_service/stop_service('runtimes') di backend) -- toggle switch
    // di sini tidak pernah berfungsi, jadi tidak ditampilkan.
    { id: 'runtimes', name: 'Runtimes', icon: 'terminal', hasToggle: false }
];

const TOOLS: NavItemConfig[] = [
    { id: 'qr', name: 'QR Generator', icon: 'qr_code_2' },
    { id: 'base64', name: 'Base64 Encoder', icon: 'code_blocks' },
    { id: 'url-encode-decode', name: 'URL Encode/Decode', icon: 'link' },
    { id: 'git', name: 'Git', icon: 'merge' },
];

interface SidebarHeaderProps {
    readonly isDesktopCollapsed: boolean;
    readonly onToggleDesktop: () => void;
    readonly onCloseMobile: () => void;
}

function SidebarHeader({ isDesktopCollapsed, onToggleDesktop, onCloseMobile }: SidebarHeaderProps) {
    return (
        <div className={`flex items-center border-b border-slate-200 dark:border-slate-800 h-[72px] ${isDesktopCollapsed ? 'justify-center px-1 py-2' : 'justify-between px-4 py-4'}`}>
            <div className={`transition-all duration-300 overflow-hidden flex items-center shrink-0 ${isDesktopCollapsed ? 'max-w-0 opacity-0 h-0 ml-0 hidden' : 'max-w-[150px] opacity-100 ml-1'}`}>
                <img src={brandNavLight} alt="VyloServe" className="h-7 w-auto object-contain block dark:hidden" draggable="false" />
                <img src={brandNavDark} alt="VyloServe" className="h-7 w-auto object-contain hidden dark:block" draggable="false" />
            </div>

            <div className={`flex items-center shrink-0 ${isDesktopCollapsed ? '' : 'gap-2 mx-auto md:mx-0'}`}>
                <button type="button" onClick={onToggleDesktop} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors hidden md:flex items-center justify-center outline-none">
                    <span className={`material-symbols-outlined transition-transform duration-300 ${isDesktopCollapsed ? 'scale-x-[-1]' : ''}`}>menu_open</span>
                </button>
                <button type="button" onClick={onCloseMobile} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors md:hidden flex items-center justify-center outline-none">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        </div>
    );
}

interface ServiceNavItemProps {
    readonly service: ServiceConfig;
    readonly isSelected: boolean;
    readonly isDesktopCollapsed: boolean;
    readonly isChecked: boolean;
    readonly onSelect: () => void;
    readonly onToggleClick: (e: React.MouseEvent) => void;
    readonly t: any;
}

function ServiceNavItem({ service, isSelected, isDesktopCollapsed, isChecked, onSelect, onToggleClick, t }: ServiceNavItemProps) {
    return (
        <div className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors ${isSelected ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <button type="button" onClick={onSelect} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
                <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>{service.icon}</span>
                <span className={`font-medium text-sm truncate transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>{t(`sidebar.menu_${service.id}`, service.name)}</span>
            </button>

            {service.hasToggle && (
                <label
                    className={`relative inline-flex items-center cursor-pointer transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[40px] opacity-100'}`}
                    aria-label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t(`sidebar.menu_${service.id}`, service.name) })}
                >
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={onToggleClick}
                        onChange={() => {}}
                        className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
            )}
        </div>
    );
}

interface ToolsNavItemProps {
    readonly tools: NavItemConfig[];
    readonly isDesktopCollapsed: boolean;
    readonly showToolsDropdown: boolean;
    readonly onToggleOpen: () => void;
    readonly activeMenu: string;
    readonly onSelectMenu: (id: string) => void;
    readonly t: any;
}

function ToolsNavItem({ tools, isDesktopCollapsed, showToolsDropdown, onToggleOpen, activeMenu, onSelectMenu, t }: ToolsNavItemProps) {
    if (tools.length === 0) return null;
    return (
        <div className="relative group mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
                type="button"
                className="w-full text-left flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={onToggleOpen}
                aria-expanded={showToolsDropdown}
            >
                <div className={`flex items-center ${isDesktopCollapsed ? 'gap-0' : 'gap-3'}`}>
                    <span className="material-symbols-outlined shrink-0" style={isDesktopCollapsed ? { fontSize: '18px' } : undefined}>construction</span>
                    {isDesktopCollapsed && (
                        <span
                            className="material-symbols-outlined shrink-0 ml-0.5 text-slate-400 group-hover:text-primary transition-colors"
                            style={{ fontSize: '18px' }}
                        >
                            chevron_right
                        </span>
                    )}
                    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>{t('sidebar.tools')}</span>
                </div>
                {!isDesktopCollapsed && (
                    <span className="material-symbols-outlined text-[20px] transition-transform duration-300" style={{ transform: showToolsDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                )}
            </button>

            {/* Dropdown Menu */}
            {!isDesktopCollapsed && showToolsDropdown && (
                <div className="flex flex-col gap-1 ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 my-1">
                    {tools.map(tool => (
                        <button
                            type="button"
                            key={tool.id}
                            onClick={() => onSelectMenu(tool.id)}
                            className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors ${activeMenu === tool.id ? 'text-primary bg-slate-50 dark:bg-slate-800/50' : 'text-slate-500 dark:text-slate-400 hover:text-primary'}`}
                        >
                            <span className="material-symbols-outlined text-[18px] shrink-0">{tool.icon}</span>
                            <span className="font-medium text-sm">{t(`sidebar.menu_${tool.id}`, tool.name)}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Flyout jika Collapsed */}
            {isDesktopCollapsed && (
                <div className="absolute left-[calc(100%+4px)] top-0 w-48 flex-col gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">{t('sidebar.tools')}</div>
                    {tools.map(tool => (
                        <button
                            type="button"
                            key={tool.id}
                            onClick={() => onSelectMenu(tool.id)}
                            className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer ${activeMenu === tool.id ? 'text-primary bg-slate-50 dark:bg-slate-800' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
                            <span className="font-medium text-sm truncate">{t(`sidebar.menu_${tool.id}`, tool.name)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface SidebarFooterProps {
    readonly isDesktopCollapsed: boolean;
    readonly systemLoad: number;
    readonly systemLoadColorClass: string;
    readonly isSettingsOpen: boolean;
    readonly onToggleSettings: () => void;
    readonly onOpenModal: (modal: SettingsModalType) => void;
    readonly settingsRef: React.RefObject<HTMLDivElement | null>;
    readonly t: any;
}

function SidebarFooter({ isDesktopCollapsed, systemLoad, systemLoadColorClass, isSettingsOpen, onToggleSettings, onOpenModal, settingsRef, t }: SidebarFooterProps) {
    return (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto flex justify-between items-center relative" ref={settingsRef}>
            <div className={`flex items-center text-slate-500 dark:text-slate-400 ${isDesktopCollapsed ? 'w-full flex-col justify-center gap-0.5' : 'gap-2'}`}>
                <span className={`material-symbols-outlined text-[20px] ${systemLoadColorClass}`}>memory</span>
                {isDesktopCollapsed ? (
                    <span className={`text-[10px] font-bold leading-none ${systemLoadColorClass}`}>{systemLoad}%</span>
                ) : (
                    <span className="text-xs font-medium uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap max-w-[150px] opacity-100">
                        {t('sidebar.system_load')} <span className={systemLoad > 80 ? 'text-red-500 font-bold' : ''}>{systemLoad}%</span>
                    </span>
                )}
            </div>

            {!isDesktopCollapsed && (
                <button type="button"
                    onClick={onToggleSettings}
                    className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${isSettingsOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                </button>
            )}

            {isSettingsOpen && !isDesktopCollapsed && (
                <div className="absolute bottom-full mb-2 right-4 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden text-sm font-medium">
                    <button type="button"
                        onClick={() => onOpenModal('language')}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">translate</span>
                        {t('settings.change_language')}
                    </button>
                    <button type="button"
                        onClick={() => onOpenModal('logs')}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">filter_list</span>
                        {t('settings.system_logs')}
                    </button>
                    <button type="button"
                        onClick={() => onOpenModal('about')}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">info</span>
                        {t('settings.about')}
                    </button>
                    <button type="button"
                        onClick={() => onOpenModal('quit')}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
                        {t('settings.quit')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function Sidebar({
    isMobileOpen,
    isDesktopCollapsed,
    onCloseMobile,
    onToggleDesktop,
    activeMenu,
    onSelectMenu
}: SidebarProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeSettingsModal, setActiveSettingsModal] = useState<SettingsModalType>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
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
        } catch (error){ console.error(error);
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

        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        window.addEventListener('service_status_changed', handleStatusSync);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            window.removeEventListener('service_status_changed', handleStatusSync);
            document.removeEventListener('mousedown', handleClickOutside);
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
        } catch (error){ console.error(error);
            console.error(`Gagal mengubah status ${id}:`, error);
        }
    };

    const handleOpenSettingsModal = (modal: SettingsModalType) => {
        setActiveSettingsModal(modal);
        setIsSettingsOpen(false);
    };

    const sidebarWidthClass = isDesktopCollapsed ? 'w-20' : 'w-sidebar-width';
    const mobileTranslateClass = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

    const getSystemLoadColor = () => {
        if (systemLoad > 80) return 'text-red-500';
        if (systemLoad > 50) return 'text-amber-500';
        return 'text-emerald-500';
    };

    const filterQuery = (item: NavItemConfig) => {
        // Fallback to name if key doesn't exist, though we defined all keys
        const translatedName = t(`sidebar.menu_${item.id}`, item.name);
        return translatedName.toLowerCase().includes(searchQuery.toLowerCase());
    };

    const filteredMain = MAIN_MENU.filter(filterQuery);
    const filteredServices = SERVICES.filter(filterQuery);
    const filteredTools = TOOLS.filter(filterQuery);
    const showToolsDropdown = isToolsOpen || (searchQuery !== '' && filteredTools.length > 0);

    return (
        <>
            {isMobileOpen && (
                <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label={t('sidebar.close_menu', 'Close menu')}
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity outline-none"
                />
            )}

            <nav className={`bg-surface dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-64px)] md:h-screen fixed left-0 top-[64px] md:top-0 z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${sidebarWidthClass} ${mobileTranslateClass}`}>

                <SidebarHeader isDesktopCollapsed={isDesktopCollapsed} onToggleDesktop={onToggleDesktop} onCloseMobile={onCloseMobile} />

                {/* Search Bar */}
                <div className={`transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? 'max-h-0 opacity-0' : 'max-h-[80px] opacity-100'}`}>
                    <div className="px-4 py-4">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                            <input
                                type="text"
                                placeholder={t('sidebar.search')}
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
                        <button
                            type="button"
                            key={menu.id}
                            onClick={() => onSelectMenu(menu.id)}
                            className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${activeMenu === menu.id ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: activeMenu === menu.id ? "'FILL' 1" : "'FILL' 0" }}>{menu.icon}</span>
                            <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>{t(`sidebar.menu_${menu.id}`, menu.name)}</span>
                        </button>
                    ))}

                    {/* Services */}
                    {filteredServices.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all ${isDesktopCollapsed ? 'hidden' : 'pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                            {t('sidebar.services')}
                        </div>
                    )}
                    {filteredServices.map(service => (
                        <ServiceNavItem
                            key={service.id}
                            service={service}
                            isSelected={activeMenu === service.id}
                            isDesktopCollapsed={isDesktopCollapsed}
                            isChecked={serviceStatus[service.id] || false}
                            onSelect={() => onSelectMenu(service.id)}
                            onToggleClick={(e) => handleToggleClick(service.id, e)}
                            t={t}
                        />
                    ))}

                    <ToolsNavItem
                        tools={filteredTools}
                        isDesktopCollapsed={isDesktopCollapsed}
                        showToolsDropdown={showToolsDropdown}
                        onToggleOpen={() => !isDesktopCollapsed && setIsToolsOpen(!isToolsOpen)}
                        activeMenu={activeMenu}
                        onSelectMenu={onSelectMenu}
                        t={t}
                    />
                </div>

                <SidebarFooter
                    isDesktopCollapsed={isDesktopCollapsed}
                    systemLoad={systemLoad}
                    systemLoadColorClass={getSystemLoadColor()}
                    isSettingsOpen={isSettingsOpen}
                    onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
                    onOpenModal={handleOpenSettingsModal}
                    settingsRef={settingsRef}
                    t={t}
                />
            </nav>

            <SettingsModals
                activeModal={activeSettingsModal}
                onClose={() => setActiveSettingsModal(null)}
            />
        </>
    );
}
