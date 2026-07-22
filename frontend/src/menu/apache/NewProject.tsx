import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useToast } from '../../components/ToastContext';

export interface NewProjectRef {
    submit: () => Promise<boolean>;
}

const NewApacheProject = forwardRef<NewProjectRef, any>((props, ref) => {
    // --- STATE MANAGEMENT ---
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState('php');

    // Domain Management
    const [domainName, setDomainName] = useState('');
    const [domainExtension, setDomainExtension] = useState('.test');

    // PHP Version State
    const [phpVersions, setPhpVersions] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [isLoadingVersions, setIsLoadingVersions] = useState(true);

    // Flow Toggle (Existing vs New)
    const [isExistingLocal, setIsExistingLocal] = useState(true);

    // Existing Project States
    const [documentRoot, setDocumentRoot] = useState('');
    const [detectedFramework, setDetectedFramework] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);

    // New Project States
    const [frameworkToInstall, setFrameworkToInstall] = useState('laravel');
    const [installLocation, setInstallLocation] = useState('');
    const [specificVersion, setSpecificVersion] = useState('');

    // STATE PROGRESS BAR
    const [isCreating, setIsCreating] = useState(false);
    const [progress, setProgress] = useState({ percent: 0, text: '' });

    // ENHANCEMENT: Ref untuk scroll ke bawah
    const bottomRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    // --- EVENT LISTENER: Progress Bar dari Python ---
    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                setProgress({
                    percent: customEvent.detail.percent || 0,
                    text: customEvent.detail.text || 'Memproses...'
                });
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    // --- ENHANCEMENT: Auto-scroll ke bawah saat loading dimulai ---
    useEffect(() => {
        if (isCreating && bottomRef.current) {
            // Beri sedikit delay agar DOM merender progress bar terlebih dahulu
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        } else if (!isCreating) {
            setProgress({ percent: 0, text: '' });
        }
    }, [isCreating]);

    // --- FETCH DATA PHP SAAT KOMPONEN DIMUAT ---
    useEffect(() => {
        const fetchPhpVersions = async () => {
            setIsLoadingVersions(true);
            try {
                const api = window.pywebview?.api || window.api;
                if (api && typeof api.get_installed_php === 'function') {
                    const versions = await api.get_installed_php();
                    setPhpVersions(versions);
                    if (versions.length > 0) setSelectedVersion(versions[versions.length - 1].version);
                }
            } catch (error) {
                console.error("Gagal memuat versi PHP:", error);
            } finally {
                setIsLoadingVersions(false);
            }
        };

        fetchPhpVersions();
    }, []);

    // Helper untuk auto-fill domain
    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setProjectName(val);
        setDomainName(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    };

    // Fungsi Default Browse Folder (Untuk Install Baru)
    const handleBrowseFolder = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
        const api = window.pywebview?.api || window.api;
        if (api && typeof api.browse_directory === 'function') {
            const path = await api.browse_directory();
            if (path) setter(path);
        }
    };

    // ---> FUNGSI BARU: BROWSE & AUTO DETECT UNTUK EXISTING PROJECT <---
    const handleBrowseExistingProject = async () => {
        const api = window.pywebview?.api || window.api;
        if (api && typeof api.browse_directory === 'function') {
            const selectedPath = await api.browse_directory();
            if (selectedPath) {
                setDocumentRoot(selectedPath);
                setIsDetecting(true);

                if (typeof api.detect_framework === 'function') {
                    const framework = await api.detect_framework(selectedPath);
                    let finalPath = selectedPath.replace(/\\/g, '/');
                    if (framework === 'laravel' || framework === 'codeigniter') {
                        finalPath = finalPath.endsWith('/public') ? finalPath : `${finalPath}/public`;
                    }
                    setDocumentRoot(finalPath);
                    setDetectedFramework(framework);
                }
                setIsDetecting(false);
            }
        }
    };

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!projectName || !domainName || !selectedVersion) {
                showToast("Project Name, Domain, and PHP Version are required!", "warning");
                return false;
            }
            if (isExistingLocal && !documentRoot) {
                showToast("Please provide the Document Root path.", "warning");
                return false;
            }
            if (!isExistingLocal && !installLocation) {
                showToast("Please provide an Installation Location.", "warning");
                return false;
            }

            const payload = {
                name: projectName,
                domain: domainName,
                domain_extension: domainExtension,
                php_version: selectedVersion,
                is_existing: isExistingLocal,
                document_root: documentRoot,
                framework: frameworkToInstall,
                install_location: installLocation,
                specific_version: specificVersion
            };

            setIsCreating(true);
            setProgress({ percent: 10, text: "Menyiapkan konfigurasi proyek..." });

            try {
                const api = window.pywebview?.api || window.api;
                if (!api) throw new Error("API Backend terputus.");

                const response = await api.create_project(payload);

                if (response.status === 'success') {
                    showToast(response.message, 'success');
                    window.dispatchEvent(new CustomEvent('project_list_updated'));
                    return true;
                } else {
                    showToast(response.message, 'error');
                    return false;
                }
            } catch (error) {
                console.error("System error:", error);
                showToast("Terjadi kesalahan sistem saat menghubungi backend.", "error");
                return false;
            } finally {
                setIsCreating(false);
            }
        }
    }));

    // Utility class untuk mempermudah penulisan disabled state
    const inputDisabledClass = "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900";

    return (
        <div className="flex flex-col gap-5 relative">
            {/* --- NAMA PROYEK --- */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                <input
                    type="text"
                    value={projectName}
                    onChange={handleProjectNameChange}
                    disabled={isCreating}
                    placeholder="e.g., My Awesome Site"
                    className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                />
            </div>

            {/* --- LOCAL DOMAIN (CUSTOMIZABLE TLD) --- */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Local Domain</label>
                <div className="flex shadow-sm rounded-lg">
                    <input
                        type="text"
                        value={domainName}
                        onChange={(e) => setDomainName(e.target.value)}
                        disabled={isCreating}
                        placeholder="my-site"
                        className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-l-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                    />
                    <input
                        type="text"
                        value={domainExtension}
                        onChange={(e) => setDomainExtension(e.target.value)}
                        disabled={isCreating}
                        placeholder=".test"
                        className={`w-24 bg-slate-50 dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium text-sm rounded-r-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors text-center ${inputDisabledClass}`}
                    />
                </div>
            </div>

            {/* --- PROJECT TYPE & VERSION --- */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment Type</label>
                    <select
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value)}
                        disabled={isCreating}
                        className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                    >
                        <option value="php">PHP Environment</option>
                        <option value="node" disabled>Node.js (Coming Soon)</option>
                        <option value="python" disabled>Python (Coming Soon)</option>
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {projectType === 'php' ? 'PHP Version' : 'Version'}
                    </label>
                    <select
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                        disabled={isLoadingVersions || isCreating}
                        className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                    >
                        {isLoadingVersions ? (
                            <option>Loading...</option>
                        ) : phpVersions.length === 0 ? (
                            <option>No PHP Installed!</option>
                        ) : (
                            phpVersions.map((php) => (
                                <option key={php.version} value={php.version}>
                                    {php.name} ({php.version})
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 my-1"></div>

            {/* --- TOGGLE CHECKLIST (EXISTING VS NEW) --- */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isCreating ? 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
                <label className={`relative inline-flex items-center ${isCreating ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={isExistingLocal}
                        onChange={() => setIsExistingLocal(!isExistingLocal)}
                        disabled={isCreating}
                        className="sr-only peer"
                    />
                    <div className={`w-9 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isCreating ? 'peer-checked:bg-primary/50' : 'peer-checked:bg-primary'}`}></div>
                </label>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Project already exists locally
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isExistingLocal
                            ? "VyloServe will just create a Virtual Host for your existing folder."
                            : "VyloServe will download and install a fresh framework for you."}
                    </span>
                </div>
            </div>

            {/* --- CONDITIONAL RENDERING --- */}
            {isExistingLocal ? (
                /* --- SKENARIO 1: PROYEK SUDAH ADA (AUTO DETECT) --- */
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Directory</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={documentRoot}
                                onChange={(e) => {
                                    setDocumentRoot(e.target.value);
                                    setDetectedFramework(null);
                                }}
                                disabled={isCreating}
                                placeholder="C:/Projects/my-site"
                                className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                            />
                            <button
                                onClick={handleBrowseExistingProject}
                                disabled={isCreating || isDetecting}
                                className={`px-3 py-2 border rounded-lg transition-colors font-medium text-sm ${isCreating || isDetecting ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                            >
                                Browse
                            </button>
                        </div>

                        {/* Area Umpan Balik (Feedback) Deteksi Otomatis */}
                        <div className="min-h-[28px] mt-1">
                            {isDetecting && (
                                <span className="text-xs font-medium text-primary flex items-center gap-2 animate-pulse">
                                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                    Analyzing directory structure...
                                </span>
                            )}
                            {(!isDetecting && detectedFramework === 'laravel') && (
                                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                    <span><strong>Laravel detected!</strong> Document root auto-assigned to <code>/public</code></span>
                                </div>
                            )}
                            {(!isDetecting && detectedFramework === 'codeigniter') && (
                                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                    <span><strong>CodeIgniter 4 detected!</strong> Document root auto-assigned to <code>/public</code></span>
                                </div>
                            )}
                            {(!isDetecting && detectedFramework === 'wordpress') && (
                                <div className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-200 dark:border-blue-800/50">
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                    <span><strong>WordPress detected!</strong> Standard root applied.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- SKENARIO 2: INSTALASI BARU --- */
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-primary dark:text-blue-400">Framework to Install</label>
                        <select
                            value={frameworkToInstall}
                            onChange={(e) => setFrameworkToInstall(e.target.value)}
                            disabled={isCreating}
                            className={`w-full bg-white dark:bg-slate-950 border border-primary/30 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors shadow-sm ${inputDisabledClass}`}
                        >
                            <option value="laravel">Laravel (Latest via Composer)</option>
                            <option value="codeigniter">CodeIgniter</option>
                            <option value="wordpress">WordPress (Latest Download)</option>
                            <option value="raw">Empty PHP Project</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Specific Version <span className="text-slate-400 font-normal">(Optional)</span></label>
                        <input
                            type="text"
                            value={specificVersion}
                            onChange={(e) => setSpecificVersion(e.target.value)}
                            disabled={isCreating}
                            placeholder="Leave blank for auto-detect (e.g., ^10.0, 9.*)"
                            className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                        />
                        <span className="text-[11px] text-slate-500">
                            VyloServe uses Composer. If left blank, it automatically installs the best version for your selected PHP.
                        </span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Installation Location</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={installLocation}
                                onChange={(e) => setInstallLocation(e.target.value)}
                                disabled={isCreating}
                                placeholder="C:/Projects"
                                className={`w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors ${inputDisabledClass}`}
                            />
                            <button
                                onClick={() => handleBrowseFolder(setInstallLocation)}
                                disabled={isCreating}
                                className={`px-3 py-2 border rounded-lg transition-colors font-medium text-sm ${isCreating ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                            >
                                Browse
                            </button>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                            Project will be created inside: <span className="font-semibold text-slate-700 dark:text-slate-300">{installLocation ? `${installLocation}\\${domainName}`.replace(/\\/g, '/') : '...'}</span>
                        </span>
                    </div>
                </div>
            )}

            {/* --- CONTAINER PROGRESS BAR BERSERTA REF UNTUK AUTO-SCROLL --- */}
            <div ref={bottomRef} className="pt-1">
                {isCreating && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {progress.text || 'Sedang menyiapkan proyek...'}
                            </span>
                            <span className="text-xs font-bold text-primary dark:text-blue-400">
                                {progress.percent}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress.percent}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default NewApacheProject;