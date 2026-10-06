import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from './ToggleSwitch';
import NotificationBell from './NotificationBell';
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

// Services = punya status running/stopped + toggle switch nyata di backend
// (start_service/stop_service). Lihat docs/frontend_ui.md §4.4 untuk prinsip
// kategorisasi lengkap (Services vs Tools vs Utilities).
const SERVICES: ServiceConfig[] = [
    { id: 'apache', name: 'Apache', icon: 'dns', hasToggle: true },
    { id: 'php', name: 'PHP', icon: 'code', hasToggle: true },
    { id: 'database', name: 'Database', icon: 'database', hasToggle: true },
];

// Tools = aksi yang terikat ke project/environment aktif, tanpa status running
// persisten (karenanya tidak pernah punya toggle switch). Runtimes dipindah ke
// sini dari SERVICES -- ia tidak punya endpoint start_service/stop_service('runtimes')
// di backend, jadi secara fungsional lebih mirip Git/Tunnels daripada daemon
// Apache/PHP/Database. Urutan mengikuti perkiraan frekuensi pemakaian (lihat
// docs/frontend_ui.md §4.4): Tunnels lebih sering dipakai dari perkiraan awal,
// Git lebih jarang (cuma "handler" status, tidak bisa menjalankan perintah git
// dari VyloServe).
const TOOLS: NavItemConfig[] = [
    { id: 'tunnels', name: 'Tunnels', icon: 'router' },
    { id: 'runtimes', name: 'Runtimes', icon: 'terminal' },
    { id: 'git', name: 'Git', icon: 'merge' },
];

// Utilities = konverter data berdiri sendiri, nol keterkaitan ke project/backend --
// bisa dipakai bahkan tanpa project VyloServe apa pun berjalan.
const UTILITIES: NavItemConfig[] = [
    { id: 'qr', name: 'QR Generator', icon: 'qr_code_2' },
    { id: 'base64', name: 'Base64 Encoder', icon: 'code_blocks' },
    { id: 'url-encode-decode', name: 'URL Encode/Decode', icon: 'link' },
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
                <div className={`transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0 overflow-hidden' : 'max-w-[40px] opacity-100'}`}>
                    <ToggleSwitch
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={onToggleClick}
                        tone="status"
                        label={t('sidebar.toggle_service', 'Toggle {{service}}', { service: t(`sidebar.menu_${service.id}`, service.name) })}
                    />
                </div>
            )}
        </div>
    );
}

interface PlainNavItemProps {
    readonly item: NavItemConfig;
    readonly isSelected: boolean;
    readonly isDesktopCollapsed: boolean;
    readonly onSelect: () => void;
    readonly t: any;
}

/** Tombol nav tanpa toggle switch -- dipakai bersama untuk grup Tools maupun Utilities. */
function PlainNavItem({ item, isSelected, isDesktopCollapsed, onSelect, t }: PlainNavItemProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-left flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
                isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 text-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isDesktopCollapsed ? t(`sidebar.menu_${item.id}`, item.name) : undefined}
        >
            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
            </span>
            <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                {t(`sidebar.menu_${item.id}`, item.name)}
            </span>
        </button>
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto flex items-center relative" ref={settingsRef}>
            {isDesktopCollapsed ? (
                // Mode collapsed: bell di ATAS ikon system-load, satu kolom vertikal (tanpa
                // tombol Settings -- popovernya butuh ruang horizontal yang tidak ada di rail
                // 80px, lihat perilaku lama tombol Settings yang juga disembunyikan saat collapsed).
                <div className="w-full flex flex-col items-center gap-2">
                    <NotificationBell />
                    <div className="flex flex-col items-center gap-0.5 text-slate-500 dark:text-slate-400">
                        <span className={`material-symbols-outlined text-[20px] ${systemLoadColorClass}`}>memory</span>
                        <span className={`text-[10px] font-bold leading-none ${systemLoadColorClass}`}>{systemLoad}%</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className={`material-symbols-outlined text-[20px] ${systemLoadColorClass}`}>memory</span>
                        <span className="text-xs font-medium uppercase tracking-wider transition-all duration-300 overflow-hidden whitespace-nowrap max-w-[150px] opacity-100">
                            {t('sidebar.system_load')} <span className={systemLoad > 80 ? 'text-red-500 font-bold' : ''}>{systemLoad}%</span>
                        </span>
                    </div>

                    {/* Bell bersampingan dengan Settings -- satu grup "status & aksi ambient" di kanan. */}
                    <div className="ml-auto flex items-center gap-1">
                        <NotificationBell />
                        <button type="button"
                            onClick={onToggleSettings}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${isSettingsOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                        </button>
                    </div>
                </>
            )}

            {isSettingsOpen && !isDesktopCollapsed && (
                <div className="absolute bottom-full mb-2 right-4 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden text-sm font-medium">
                    <button type="button"
                        onClick={() => onOpenModal('settings')}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">settings</span>
                        {t('settings.settings')}
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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeSettingsModal, setActiveSettingsModal] = useState<SettingsModalType>(null);
    const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'logs' | 'updates' | 'about'>('general');
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

        const handleOpenSettingsModalEvent = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.modal) {
            const m = customEvent.detail.modal;
            if (m === 'updates' || m === 'about' || m === 'logs' || m === 'general') {
                setActiveSettingsTab(m);
                setActiveSettingsModal('settings');
            } else {
                setActiveSettingsModal(m);
            }
        }
    };

        const handleUpdateReadyGlobal = () => {
        setActiveSettingsTab('updates');
        setActiveSettingsModal('settings');
    };

        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };

        window.addEventListener('service_status_changed', handleStatusSync);
        window.addEventListener('vylo_open_settings_modal', handleOpenSettingsModalEvent);
        window.addEventListener('vylo_update_ready', handleUpdateReadyGlobal);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(interval);
            window.removeEventListener('service_status_changed', handleStatusSync);
            window.removeEventListener('vylo_open_settings_modal', handleOpenSettingsModalEvent);
            window.removeEventListener('vylo_update_ready', handleUpdateReadyGlobal);
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
    const filteredUtilities = UTILITIES.filter(filterQuery);

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

                    {/* Tools */}
                    {filteredTools.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all ${isDesktopCollapsed ? 'hidden' : 'pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                            {t('sidebar.tools')}
                        </div>
                    )}
                    {filteredTools.map(tool => (
                        <PlainNavItem
                            key={tool.id}
                            item={tool}
                            isSelected={activeMenu === tool.id}
                            isDesktopCollapsed={isDesktopCollapsed}
                            onSelect={() => onSelectMenu(tool.id)}
                            t={t}
                        />
                    ))}

                    {/* Utilities */}
                    {filteredUtilities.length > 0 && (
                        <div className={`px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all ${isDesktopCollapsed ? 'hidden' : 'pt-4 border-t border-slate-200 dark:border-slate-800 mt-2'}`}>
                            {t('sidebar.utilities')}
                        </div>
                    )}
                    {filteredUtilities.map(utility => (
                        <PlainNavItem
                            key={utility.id}
                            item={utility}
                            isSelected={activeMenu === utility.id}
                            isDesktopCollapsed={isDesktopCollapsed}
                            onSelect={() => onSelectMenu(utility.id)}
                            t={t}
                        />
                    ))}
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
                defaultTab={activeSettingsTab}
                onClose={() => setActiveSettingsModal(null)}
            />
        </>
    );
}
