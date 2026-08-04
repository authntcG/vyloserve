import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/ToastContext';

interface ProjectData {
    id: string;
    name: string;
    domain: string;
    path: string;
    framework?: string;
}

interface ServiceStatus {
    apache: boolean;
    php: boolean;
    database: boolean;
    cpu_load: number;
    ram_usage?: number;
}

export default function DashboardMain() {
    const { showToast } = useToast();

    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [status, setStatus] = useState<ServiceStatus>({ apache: false, php: false, database: false, cpu_load: 0, ram_usage: 0 });

    const [cpuHistory, setCpuHistory] = useState<number[]>(Array(20).fill(0));
    const [ramHistory, setRamHistory] = useState<number[]>(Array(20).fill(0));

    const [apacheVersions, setApacheVersions] = useState<string[]>([]);
    const [selectedApache, setSelectedApache] = useState<string>('');
    const [phpInstances, setPhpInstances] = useState<any[]>([]);
    const [selectedPhp, setSelectedPhp] = useState<string[]>([]);

    const [includedServices, setIncludedServices] = useState({ apache: true, php: true, database: false });

    // ---> STATE LOADING <---
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isTogglingAll, setIsTogglingAll] = useState<'start' | 'stop' | null>(null);

    const isPhpInitialized = useRef(false);
    const isApacheInitialized = useRef(false);
    const isConfigLoaded = useRef(false);

    const loadDashboardConfig = async () => {
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.get_dashboard_config === 'function') {
                const res = await api.get_dashboard_config();
                if (res.status === 'success' && res.data) {
                    setIncludedServices({
                        apache: res.data.apache ?? true,
                        php: res.data.php ?? true,
                        database: res.data.database ?? false
                    });

                    if (res.data.selected_php && Array.isArray(res.data.selected_php) && res.data.selected_php.length > 0) {
                        setSelectedPhp(res.data.selected_php);
                        isPhpInitialized.current = true;
                    }
                }
            }
        } catch (error) { console.error("Gagal memuat config dashboard:", error); }
        finally { isConfigLoaded.current = true; }
    };

    useEffect(() => {
        if (!isConfigLoaded.current) return;

        const saveConfig = async () => {
            try {
                const api = window.pywebview?.api || window.api;
                if (api && typeof api.save_dashboard_config === 'function') {
                    const payload = {
                        ...includedServices,
                        selected_php: selectedPhp
                    };
                    await api.save_dashboard_config(payload);
                }
            } catch (e) { console.error("Gagal menyimpan config:", e); }
        };
        saveConfig();
    }, [includedServices, selectedPhp]);

    const fetchRecentProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const api = window.pywebview?.api || window.api;
            if (api && typeof api.get_projects === 'function') {
                const res = await api.get_projects();
                if (res.status === 'success') {
                    const reversed = [...(res.data || [])].reverse();
                    setProjects(reversed.slice(0, 4));
                }
            }
        } catch (error) { console.error(error); }
        finally { setIsLoadingProjects(false); }
    };

    const fetchServicesStatus = async () => {
        try {
            const api = window.pywebview?.api || window.api;
            if (!api) return;

            if (typeof api.get_all_services_status === 'function') {
                const resStatus = await api.get_all_services_status();
                setStatus({
                    apache: resStatus.apache,
                    php: resStatus.php,
                    database: resStatus.database,
                    cpu_load: resStatus.cpu_load || 0,
                    ram_usage: resStatus.ram_usage || 0
                });

                setCpuHistory(prev => [...prev, resStatus.cpu_load || 0].slice(-20));
                setRamHistory(prev => [...prev, resStatus.ram_usage || 0].slice(-20));
            }

            if (typeof api.get_apache_installed_versions === 'function') {
                const resAp = await api.get_apache_installed_versions();
                if (resAp.status === 'success') {
                    setApacheVersions(resAp.data);
                    setSelectedApache(prev => {
                        if (!isApacheInitialized.current) {
                            isApacheInitialized.current = true;
                            return resAp.active || resAp.data[0] || '';
                        }
                        return prev;
                    });
                }
            }

            if (typeof api.get_installed_php === 'function') {
                const resPhp = await api.get_installed_php();
                setPhpInstances(resPhp);

                setSelectedPhp(prev => {
                    if (!isPhpInitialized.current) {
                        isPhpInitialized.current = true;
                        if (prev.length === 0 && resPhp.length > 0) {
                            const running = resPhp.filter((p: any) => p.status === 'running').map((p: any) => p.version);
                            return running.length > 0 ? running : [resPhp[0].version];
                        }
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsGlobalLoading(false); // <--- Mematikan Skeleton Loaders
        }
    };

    useEffect(() => {
        loadDashboardConfig();
        fetchRecentProjects();
        fetchServicesStatus();
        const interval = setInterval(fetchServicesStatus, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleAll = async (action: 'start' | 'stop') => {
        setIsTogglingAll(action);
        try {
            const api = window.pywebview?.api || window.api;
            if (!api) return;

            if (action === 'start') {
                if (includedServices.apache && selectedApache) {
                    await api.set_apache_active_version(selectedApache);
                }
                if (includedServices.php) {
                    for (const v of selectedPhp) {
                        const inst = phpInstances.find(p => p.version === v);
                        if (inst && inst.status !== 'running') {
                            await api.start_php(v);
                        }
                    }
                }
                if (includedServices.apache) {
                    await api.start_apache_server();
                }
                showToast("Proses Start servis berhasil dieksekusi!", "success");
            } else {
                if (includedServices.apache) {
                    await api.stop_apache_server();
                }
                if (includedServices.php) {
                    for (const v of selectedPhp) {
                        const inst = phpInstances.find(p => p.version === v);
                        if (inst && inst.status === 'running') {
                            await api.stop_php(v);
                        }
                    }
                }
                showToast("Proses Stop servis berhasil dieksekusi!", "success");
            }

            fetchServicesStatus();
            window.dispatchEvent(new Event('service_status_changed'));

        } catch (error) {
            console.error("Dashboard Toggle Error:", error);
            showToast("Terjadi kesalahan saat memproses servis.", "error");
        } finally {
            setIsTogglingAll(null);
        }
    };

    const togglePhpSelection = (version: string) => {
        setSelectedPhp(prev => {
            const newSelection = prev.includes(version)
                ? prev.filter(v => v !== version)
                : [...prev, version];

            if (newSelection.length === 0) setIncludedServices(p => ({ ...p, php: false }));
            else if (newSelection.length > 0 && !includedServices.php) setIncludedServices(p => ({ ...p, php: true }));

            return newSelection;
        });
    };

    const handleOpenBrowser = (domain: string) => {
        const url = `https://${domain}`;
        try {
            if (window.pywebview?.api?.open_browser) window.pywebview.api.open_browser(url);
            else window.open(url, '_blank');
        } catch (e) { console.error(e); }
    };

    const handleOpenDir = (path: string) => {
        try {
            if (window.pywebview?.api?.open_in_explorer) window.pywebview.api.open_in_explorer(path);
        } catch (e) { console.error(e); }
    };

    let canStart = false;
    let canStop = false;

    if (includedServices.apache && selectedApache) {
        if (!status.apache) canStart = true;
        if (status.apache) canStop = true;
    }

    if (includedServices.php && selectedPhp.length > 0) {
        selectedPhp.forEach(v => {
            const inst = phpInstances.find(p => p.version === v);
            if (inst) {
                if (inst.status !== 'running') canStart = true;
                if (inst.status === 'running') canStop = true;
            }
        });
    }

    const getSuggestions = () => {
        const suggestions = [];
        if (!status.apache && !status.php) {
            suggestions.push({
                icon: 'power_settings_new', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50',
                text: 'Server lokal sedang berhenti. Tentukan versi, aktifkan switch modul, lalu klik "Start Selected".'
            });
        }
        if (projects.length === 0 && !isLoadingProjects) {
            suggestions.push({
                icon: 'add_box', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/50',
                text: 'Anda belum memiliki proyek virtual host. Buka menu Apache untuk membuat proyek pertama.'
            });
        }
        if (suggestions.length === 0) {
            suggestions.push({
                icon: 'check_circle', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50',
                text: 'Semua sistem berjalan optimal. Selamat bekerja!'
            });
        }
        return suggestions;
    };

    const renderSparkline = (data: number[], id: string) => {
        const maxPoints = 20;
        const width = 100;
        const height = 35;
        const xStep = width / (maxPoints - 1);

        const points = data.map((val, idx) => ({
            x: idx * xStep,
            y: height - (val / 100) * height
        }));

        if (points.length === 0) return null;

        let linePath = `M ${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const midX = (p1.x + p2.x) / 2;
            linePath += ` C ${midX},${p1.y} ${midX},${p2.y} ${p2.x},${p2.y}`;
        }

        const fillPath = `${linePath} L ${width},${height} L 0,${height} Z`;

        return (
            <div className="w-full h-12 mt-2 relative rounded overflow-hidden">
                <svg viewBox={`0 -2 ${width} ${height + 4}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={`grad-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id={`grad-stroke-${id}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>
                    <path d={fillPath} fill={`url(#grad-fill-${id})`} stroke="none" />
                    <path d={linePath} stroke={`url(#grad-stroke-${id})`} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full gap-6 pb-10 animate-in fade-in duration-300">

            {/* HEADER DENGAN ICON */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]">space_dashboard</span>
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Dashboard</h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Welcome back. Here is the overview of your local environment.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {getSuggestions().map((sugg, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-4 rounded-xl border ${sugg.border} ${sugg.bg}`}>
                        <span className={`material-symbols-outlined ${sugg.color} text-[24px]`}>{sugg.icon}</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{sugg.text}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[300px]">

                {/* 1. GLOBAL CONTROL PANEL */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden h-full">

                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex flex-wrap justify-between items-start gap-4 z-10 shrink-0">
                        <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">dashboard_customize</span>
                                Global Control Panel
                            </h3>
                            <span className="text-xs text-slate-500">Configure and execute services simultaneously.</span>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button
                                onClick={() => handleToggleAll('start')}
                                disabled={isGlobalLoading || isTogglingAll !== null || !canStart}
                                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                            >
                                {isTogglingAll === 'start' ? (
                                    <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> Starting...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">play_arrow</span> Start Selected</>
                                )}
                            </button>

                            <button
                                onClick={() => handleToggleAll('stop')}
                                disabled={isGlobalLoading || isTogglingAll !== null || !canStop}
                                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none"
                            >
                                {isTogglingAll === 'stop' ? (
                                    <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> Stopping...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">stop</span> Stop Selected</>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2 content-start">
                        {/* ---> ENHANCEMENT: SKELETON LOADER UNTUK KARTU MODUL <--- */}
                        {isGlobalLoading ? (
                            [1, 2, 3].map((item) => (
                                <div key={item} className="flex flex-col gap-3 p-4 border border-slate-100 dark:border-slate-800/60 rounded-lg animate-pulse bg-slate-50 dark:bg-slate-950/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700/50 rounded-md shrink-0"></div>
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                        </div>
                                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700/50 rounded-full shrink-0"></div>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-1">
                                        <div className="flex justify-between items-center">
                                            <div className="h-2.5 bg-slate-200 dark:bg-slate-700/50 rounded w-20"></div>
                                            <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700/50 shrink-0"></div>
                                        </div>
                                        <div className="h-8 bg-slate-200 dark:bg-slate-700/50 rounded-md w-full mt-1"></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {/* --- APACHE CARD --- */}
                                <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${includedServices.apache ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'} rounded-lg transition-all`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`material-symbols-outlined shrink-0 transition-colors ${includedServices.apache ? 'text-primary' : 'text-slate-400'}`}>dns</span>
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">Apache Web</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={includedServices.apache}
                                                onChange={(e) => setIncludedServices(p => ({ ...p, apache: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    <div className={`flex flex-col gap-1 mt-1 transition-all ${includedServices.apache ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Default Version</span>
                                            <span className={`w-2 h-2 shrink-0 rounded-full ${status.apache ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                        </div>
                                        <select
                                            value={selectedApache}
                                            onChange={(e) => setSelectedApache(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-md p-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
                                        >
                                            {apacheVersions.length > 0 ? apacheVersions.map(v => (
                                                <option key={v} value={v}>Apache {v}</option>
                                            )) : <option>No version installed</option>}
                                        </select>
                                    </div>
                                </div>

                                {/* --- PHP CARD --- */}
                                <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border ${includedServices.php ? 'border-primary/30 shadow-sm' : 'border-slate-200 dark:border-slate-800/60 opacity-60'} rounded-lg transition-all`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`material-symbols-outlined shrink-0 transition-colors ${includedServices.php ? 'text-primary' : 'text-slate-400'}`}>php</span>
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">PHP FastCGI</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={includedServices.php}
                                                onChange={(e) => {
                                                    if (e.target.checked && selectedPhp.length === 0 && phpInstances.length > 0) {
                                                        setSelectedPhp([phpInstances[0].version]);
                                                    }
                                                    setIncludedServices(p => ({ ...p, php: e.target.checked }));
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    <div className={`flex flex-col gap-1 mt-1 transition-all ${includedServices.php ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Version(s)</span>
                                            <span className={`w-2 h-2 shrink-0 rounded-full ${phpInstances.some(p => p.status === 'running') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto custom-scrollbar pr-1 mt-0.5">
                                            {phpInstances.length > 0 ? phpInstances.map(php => {
                                                const isSelected = selectedPhp.includes(php.version);
                                                return (
                                                    <button
                                                        key={php.id}
                                                        onClick={() => togglePhpSelection(php.version)}
                                                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors border ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-primary/50 text-primary dark:text-blue-400 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'}`}
                                                    >
                                                        {php.version}
                                                    </button>
                                                )
                                            }) : <span className="text-xs text-slate-400 italic mt-1">No PHP installed</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* --- DATABASE CARD --- */}
                                <div className={`flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 rounded-lg opacity-40`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="material-symbols-outlined shrink-0 text-slate-400">database</span>
                                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Database</span>
                                        </div>
                                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full cursor-not-allowed shrink-0"></div>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Engine</span>
                                        <span className="text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1.5 rounded w-fit mt-0.5">
                                            Coming Soon
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. RESOURCE MONITOR WIDGET */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-5 h-full shrink-0">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">memory</span>
                            System Resources
                        </h3>
                        <span className="text-xs text-slate-500">Real-time historical metrics</span>
                    </div>

                    {/* ---> ENHANCEMENT: SKELETON LOADER UNTUK GRAFIK <--- */}
                    {isGlobalLoading ? (
                        <div className="flex flex-col gap-4 mt-2">
                            {[1, 2].map((item) => (
                                <div key={item} className="flex flex-col gap-2 animate-pulse">
                                    <div className="flex justify-between items-center">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-8"></div>
                                    </div>
                                    <div className="w-full h-12 bg-slate-100 dark:bg-slate-800/60 rounded-lg mt-1"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">speed</span> CPU Load
                                    </span>
                                    <span className="text-slate-900 dark:text-white font-mono">{status.cpu_load}%</span>
                                </div>
                                {renderSparkline(cpuHistory, 'cpu')}
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">memory_alt</span> Memory Usage
                                    </span>
                                    <span className="text-slate-900 dark:text-white font-mono">{status.ram_usage}%</span>
                                </div>
                                {renderSparkline(ramHistory, 'ram')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RECENT PROJECTS WIDGET --- */}
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Recent Projects
                        </h3>
                        <span className="text-xs text-slate-500">Your latest virtual hosts.</span>
                    </div>
                </div>

                {/* ---> ENHANCEMENT: SKELETON LOADER UNTUK RECENT PROJECTS <--- */}
                {isLoadingProjects ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-xl p-4 shadow-sm flex flex-col gap-4 animate-pulse">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-col gap-2 w-full">
                                        <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-3/4"></div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800/80 rounded w-1/2"></div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div className="h-7 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                                    <div className="h-7 bg-slate-200 dark:bg-slate-700/50 rounded-lg flex-1"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 dark:bg-slate-900/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="material-symbols-outlined text-slate-400 text-4xl mb-2">folder_open</span>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">No projects found</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {projects.map(proj => (
                            <div key={proj.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-4 hover:border-primary/50 transition-colors group">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-col overflow-hidden">
                                        <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">{proj.name}</h4>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{proj.domain}</span>
                                    </div>
                                    {proj.framework && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded ml-2 shrink-0">
                                            {proj.framework}
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => handleOpenBrowser(proj.domain)}
                                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-1.5 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm outline-none"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">public</span> Open
                                    </button>
                                    <button
                                        onClick={() => handleOpenDir(proj.path)}
                                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-1.5 px-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm outline-none"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">folder</span> Folder
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}