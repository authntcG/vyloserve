import { useEffect, useState } from 'react';

interface ServiceItem {
    id: string;
    name: string;
    icon: string;
    isActive: boolean; // Kembalikan isActive untuk default value toggle
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

    // 1. SAFE API ACCESSOR: Fungsi pembantu untuk mengakses backend dengan aman
    const getBackendApi = () => {
        // Prioritaskan window.pywebview.api jika menggunakan PyWebView standar
        // Atau window.api jika Anda menamai global object-nya 'api'
        return window.pywebview?.api || window.api;
    };

    // 2. Fungsi untuk Sinkronisasi Status dari Backend
    const fetchServiceStatuses = async () => {
        const api = getBackendApi();

        // Mencegah crash jika aplikasi dibuka di browser biasa tanpa Python
        if (!api || typeof api.get_all_services_status !== 'function') {
            console.warn("Backend API tidak ditemukan. Menjalankan mode demo/mock.");
            // Mock data untuk mode development
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

    // 2. Polling status setiap 2 detik
    useEffect(() => {
        fetchServiceStatuses();
        const interval = setInterval(fetchServiceStatuses, 2000);
        return () => clearInterval(interval);
    }, []);

    // 3. Handle Toggle dengan Aksi Backend
    // 3. Handle Toggle dengan Aksi Backend
    const handleToggleClick = async (id: string) => {
        const api = getBackendApi();

        if (!api) {
            console.error("Backend API tidak tersedia!");
            return;
        }

        const isCurrentlyRunning = serviceStatus[id];

        try {
            if (isCurrentlyRunning) {
                await api.stop_service(id);
            } else {
                await api.start_service(id);
            }

            // 1. Update state di Sidebar sendiri
            fetchServiceStatuses();

            // ---> 2. FIX: Tembakkan sinyal global ke halaman Utama <---
            window.dispatchEvent(new CustomEvent('service_status_changed', {
                detail: { service: id, running: !isCurrentlyRunning }
            }));

        } catch (error) {
            console.error(`Gagal mengubah status ${id}:`, error);
        }
    };

    const sidebarWidthClass = isDesktopCollapsed ? 'w-20' : 'w-sidebar-width';
    const mobileTranslateClass = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

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

                {/* Header ... */}
                <div className="flex items-center justify-between px-md py-md border-b border-slate-200 dark:border-slate-800">
                    {!isDesktopCollapsed && (
                        <h1 className="font-headline-md text-lg font-semibold text-primary dark:text-blue-400 transition-opacity duration-200">
                            VyloServe
                        </h1>
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

                {/* Search ... */}
                {!isDesktopCollapsed && (
                    <div className="px-md py-md transition-opacity duration-200">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-1 focus:ring-primary text-slate-900 dark:text-slate-100 rounded-md py-2 pl-10 pr-3 text-sm transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <div className="flex flex-col gap-1 py-2 px-2 flex-1 overflow-y-auto">

                    {/* SERVICES SECTION */}
                    {!isDesktopCollapsed && filteredServices.length > 0 && (
                        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Services
                        </div>
                    )}

                    {filteredServices.map((service) => {
                        const isMenuSelected = activeMenu === service.id; // Untuk highlight menu

                        return (
                            <div
                                key={service.id}
                                onClick={() => onSelectMenu(service.id)}
                                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors duration-200 group ${isMenuSelected ? 'bg-slate-100 dark:bg-slate-800 text-primary-fixed-dim dark:text-primary-fixed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`material-symbols-outlined ${isMenuSelected ? 'text-primary' : ''}`} style={{ fontVariationSettings: isMenuSelected ? "'FILL' 1" : "'FILL' 0" }}>{service.icon}</span>
                                    {!isDesktopCollapsed && (
                                        <span className="font-medium text-sm transition-opacity duration-200">{service.name}</span>
                                    )}
                                </div>

                                {!isDesktopCollapsed && (
                                    // 3. Ubah trigger onClick ke handleToggleClick
                                    <label
                                        className="relative inline-flex items-center cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault();  // <--- FIX: Mencegah browser mengirim klik ganda ke <input>
                                            e.stopPropagation(); // <--- Mencegah parent div berpindah menu
                                            handleToggleClick(service.id);
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={serviceStatus[service.id]}
                                            readOnly
                                            className="sr-only peer"
                                        />
                                        <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                )}
                            </div>
                        );
                    })}

                    {/* TOOLS SECTION ... */}
                    {filteredTools.length > 0 && (
                        <>
                            {!isDesktopCollapsed && (
                                <div className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-200 dark:border-slate-800">
                                    Utilities
                                </div>
                            )}

                            <div
                                className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200"
                                onClick={() => !isDesktopCollapsed && setIsToolsOpen(!isToolsOpen)}
                                title={isDesktopCollapsed ? "Tools" : ""}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>construction</span>
                                    {!isDesktopCollapsed && (
                                        <span className="font-medium text-sm transition-opacity duration-200">Tools</span>
                                    )}
                                </div>
                                {!isDesktopCollapsed && (
                                    <span
                                        className="material-symbols-outlined text-[20px] transition-transform duration-200"
                                        style={{ transform: showToolsDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                    >
                                        expand_more
                                    </span>
                                )}
                            </div>

                            {/* Dropdown Tools Content */}
                            {(showToolsDropdown && !isDesktopCollapsed) && (
                                <div className="flex flex-col gap-1 ml-4 pl-2 border-l border-slate-200 dark:border-slate-700 my-1 overflow-hidden">
                                    {filteredTools.map((tool) => (
                                        <div key={tool.id} className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
                                            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>{tool.icon}</span>
                                            <span className="font-medium text-sm">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Empty State Jika Pencarian Tidak Ditemukan */}
                    {filteredServices.length === 0 && filteredTools.length === 0 && (
                        <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                            No results found for "{searchQuery}"
                        </div>
                    )}

                </div>

                {/* Footer ... */}
                {!isDesktopCollapsed && (
                    <div className="p-md border-t border-slate-200 dark:border-slate-800 mt-auto transition-opacity duration-200">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            {/* Ikon dinamis berganti warna berdasarkan beban */}
                            <span className={`material-symbols-outlined text-[18px] transition-colors ${systemLoad > 80 ? 'text-red-500' : systemLoad > 50 ? 'text-amber-500' : 'text-emerald-500'
                                }`}>
                                memory
                            </span>

                            {/* Teks dinamis menampilkan persentase CPU */}
                            <span className="text-xs font-medium uppercase tracking-wider flex gap-1">
                                System Load:
                                <span className={`transition-colors ${systemLoad > 80 ? 'text-red-500 font-bold' : systemLoad > 50 ? 'text-amber-500 font-bold' : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                    {systemLoad}%
                                </span>
                            </span>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}