import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useToast } from '../../components/ToastContext';

export interface NewProjectRef {
    submit: () => Promise<boolean>;
}

const NewApacheProject = forwardRef<NewProjectRef, any>((props, ref) => {
    const { showToast } = useToast();

    // --- MAIN STATES ---
    const [projectName, setProjectName] = useState('');
    const [isExistingLocal, setIsExistingLocal] = useState(false);
    const [frameworkToInstall, setFrameworkToInstall] = useState('laravel');
    const [documentRoot, setDocumentRoot] = useState('');

    // --- ADVANCED STATES ---
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [domainName, setDomainName] = useState('');
    const [domainExtension, setDomainExtension] = useState('.test');
    const [projectType, setProjectType] = useState('php');
    const [specificVersion, setSpecificVersion] = useState('');

    // Mengingat lokasi instalasi terakhir di LocalStorage
    const [installLocation, setInstallLocation] = useState(() => localStorage.getItem('vylo_install_loc') || '');

    // PHP States
    const [phpVersions, setPhpVersions] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [isLoadingVersions, setIsLoadingVersions] = useState(true);

    // Feedback States
    const [detectedFramework, setDetectedFramework] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);

    // Progress States
    const [internalIsCreating, setInternalIsCreating] = useState(false);
    const isCreating = props.isCreatingExternal !== undefined ? props.isCreatingExternal : internalIsCreating;
    const [progress, setProgress] = useState({ percent: 0, text: '' });

    const bottomRef = useRef<HTMLDivElement>(null);

    // --- EVENT LISTENERS ---
    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                setProgress({ percent: customEvent.detail.percent || 0, text: customEvent.detail.text || 'Memproses...' });
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, []);

    useEffect(() => {
        if (isCreating && bottomRef.current) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
        } else if (!isCreating) {
            setProgress({ percent: 0, text: '' });
        }
    }, [isCreating]);

    useEffect(() => {
        const fetchPhpVersions = async () => {
            setIsLoadingVersions(true);
            try {
                const api = window.pywebview?.api;
                if (api && typeof api.get_installed_php === 'function') {
                    const versions = await api.get_installed_php();
                    setPhpVersions(versions);
                    if (versions.length > 0) setSelectedVersion(versions[versions.length - 1].version);
                }
            } catch (error) { console.error(error); }
            finally { setIsLoadingVersions(false); }
        };
        fetchPhpVersions();
    }, []);

    // --- HANDLERS ---
    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setProjectName(val);
        setDomainName(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    };

    const handleInstallLocChange = (val: string) => {
        setInstallLocation(val);
        localStorage.setItem('vylo_install_loc', val);
    };

    const handleBrowseFolder = async () => {
        const api = window.pywebview?.api;
        if (api && typeof api.browse_directory === 'function') {
            const path = await api.browse_directory();
            if (path) handleInstallLocChange(path);
        }
    };

    const handleBrowseExistingProject = async () => {
        const api = window.pywebview?.api;
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
                showToast("Please provide a Workspace Location for your project.", "warning");
                return false;
            }

            const selectedPhpData = phpVersions.find(p => p.version === selectedVersion);
            const actualPhpPort = selectedPhpData?.port || selectedPhpData?.fastcgi_port || 9000;

            const payload = {
                name: projectName, domain: domainName, domain_extension: domainExtension,
                php_version: selectedVersion, php_port: actualPhpPort,
                is_existing: isExistingLocal, document_root: documentRoot,
                framework: frameworkToInstall, install_location: installLocation, specific_version: specificVersion
            };

            setInternalIsCreating(true);
            setProgress({ percent: 10, text: "Menyiapkan konfigurasi proyek..." });

            try {
                const api = window.pywebview?.api;
                const response = await api?.create_project(payload);
                if (response?.status === 'success') {
                    showToast(response.message, 'success');
                    window.dispatchEvent(new CustomEvent('project_list_updated'));
                    return true;
                } else {
                    showToast(response?.message || 'Error', 'error');
                    return false;
                }
            } catch (error) {
                showToast("Kesalahan sistem saat menghubungi backend.", "error");
                return false;
            } finally {
                setInternalIsCreating(false);
            }
        }
    }));

    const inputClasses = "w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900";

    return (
        <div className="flex flex-col gap-4 relative">

            {/* 1. SETUP MODE (SEGMENTED CONTROL) */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                <button type="button" disabled={isCreating} onClick={() => setIsExistingLocal(false)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 outline-none disabled:cursor-not-allowed ${!isExistingLocal ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    🚀 Fresh Install
                </button>
                <button type="button" disabled={isCreating} onClick={() => setIsExistingLocal(true)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 outline-none disabled:cursor-not-allowed ${isExistingLocal ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    🔗 Link Existing
                </button>
            </div>

            {/* 2. PRIMARY FIELDS (Always Visible) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                    <input type="text" value={projectName} onChange={handleProjectNameChange} disabled={isCreating} placeholder="e.g., My Awesome Site" className={inputClasses} />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PHP Version</label>
                    <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} disabled={isLoadingVersions || isCreating} className={inputClasses}>
                        {isLoadingVersions ? <option>Loading...</option> : phpVersions.length === 0 ? <option>No PHP Installed!</option> : phpVersions.map((php) => <option key={php.version} value={php.version}>{php.name} ({php.version})</option>)}
                    </select>
                </div>
            </div>

            {/* 3. DYNAMIC CONTEXTUAL FIELD */}
            {!isExistingLocal ? (
                <div className="flex flex-col gap-4 animate-in fade-in">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-primary dark:text-blue-400">Framework to Install</label>
                        <select value={frameworkToInstall} onChange={(e) => setFrameworkToInstall(e.target.value)} disabled={isCreating} className={`${inputClasses} border-primary/30 shadow-sm`}>
                            <option value="laravel">Laravel (Latest via Composer)</option>
                            <option value="codeigniter">CodeIgniter 4</option>
                            <option value="wordpress">WordPress (Latest Download)</option>
                            <option value="raw">Empty PHP Project</option>
                        </select>
                    </div>

                    {/* ---> ENHANCEMENT: FIRST TIME SETUP HINT <--- */}
                    {!installLocation ? (
                        <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800/50 rounded-xl flex flex-col gap-3 animate-in fade-in zoom-in-95">
                            <div className="flex gap-3 items-start">
                                <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">folder_special</span>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">Workspace Required</span>
                                    <span className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">
                                        This seems to be your first project. Please select a primary folder where VyloServe should extract and save your future projects.
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={installLocation}
                                    onChange={(e) => handleInstallLocChange(e.target.value)}
                                    disabled={isCreating}
                                    placeholder="e.g., C:/Projects"
                                    className="w-full bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-700/50 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none transition-colors disabled:opacity-50"
                                />
                                <button
                                    onClick={handleBrowseFolder}
                                    disabled={isCreating}
                                    className="px-4 border rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-amber-300 dark:border-amber-700/50 text-amber-800 dark:text-amber-400 text-sm font-medium outline-none transition-colors"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="truncate flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                Workspace: <strong className="text-slate-700 dark:text-slate-300">{installLocation}</strong>
                            </span>
                            <button type="button" onClick={() => setIsAdvancedOpen(true)} className="text-primary font-medium hover:underline shrink-0 outline-none">Change</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2 animate-in fade-in">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Directory</label>
                    <div className="flex gap-2">
                        <input type="text" value={documentRoot} onChange={(e) => { setDocumentRoot(e.target.value); setDetectedFramework(null); }} disabled={isCreating} placeholder="C:/Projects/my-site" className={inputClasses} />
                        <button onClick={handleBrowseExistingProject} disabled={isCreating || isDetecting} className={`px-4 font-medium text-sm border rounded-lg transition-colors outline-none ${isCreating || isDetecting ? 'bg-slate-50 text-slate-400 dark:bg-slate-900 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}>
                            Browse
                        </button>
                    </div>

                    <div className="min-h-[28px]">
                        {isDetecting && <span className="text-xs font-medium text-primary flex items-center gap-2 animate-pulse"><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> Analyzing directory structure...</span>}
                        {(!isDetecting && detectedFramework) && (
                            <div className={`text-xs flex items-center gap-1.5 p-2 rounded-md border ${detectedFramework === 'wordpress' ? 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800/50' : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/50'}`}>
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                <span><strong>{detectedFramework.toUpperCase()} detected!</strong> {detectedFramework !== 'wordpress' ? 'Document root auto-assigned to /public' : 'Standard root applied.'}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. PROGRESSIVE DISCLOSURE (ADVANCED SETTINGS) */}
            <div className="border-t border-slate-200 dark:border-slate-800/60 pt-2">
                <button type="button" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>expand_more</span>
                    Advanced Settings
                </button>

                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isAdvancedOpen ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>

                    {/* Editable Local Domain */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Custom Local Domain</label>
                        <div className="flex shadow-sm rounded-lg">
                            <input type="text" value={domainName} onChange={(e) => setDomainName(e.target.value)} disabled={isCreating} className={`${inputClasses} rounded-r-none focus:ring-primary`} />
                            <input type="text" value={domainExtension} onChange={(e) => setDomainExtension(e.target.value)} disabled={isCreating} className={`w-24 bg-slate-50 dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-center font-medium text-sm rounded-r-lg outline-none disabled:opacity-50`} />
                        </div>
                    </div>

                    {/* Fresh Install specific options */}
                    {!isExistingLocal && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-3 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">

                            {/* Input Workspace di Advanced Settings */}
                            <div className="flex flex-col gap-2 col-span-1 sm:col-span-2">
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex justify-between">
                                    Workspace Location
                                    {installLocation && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Saved</span>}
                                </label>
                                <div className="flex gap-2">
                                    <input type="text" value={installLocation} onChange={(e) => handleInstallLocChange(e.target.value)} disabled={isCreating} placeholder="C:/vylo-workspace" className={inputClasses} />
                                    <button onClick={handleBrowseFolder} disabled={isCreating} className="px-3 border rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sm outline-none transition-colors">Browse</button>
                                </div>
                                <span className="text-[11px] text-slate-500">Project will be extracted to: <strong>{installLocation ? `${installLocation}\\${domainName}`.replace(/\\/g, '/') : '...'}</strong></span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Specific Version</label>
                                <input type="text" value={specificVersion} onChange={(e) => setSpecificVersion(e.target.value)} disabled={isCreating} placeholder="e.g., ^10.0" className={inputClasses} />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Environment</label>
                                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} disabled={isCreating} className={inputClasses}>
                                    <option value="php">PHP Engine</option>
                                    <option value="node" disabled>Node.js (Soon)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 5. PROGRESS BAR CONTAINER */}
            <div ref={bottomRef} className="pt-1">
                {isCreating && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{progress.text || 'Memproses...'}</span>
                            <span className="text-xs font-bold text-primary">{progress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress.percent}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default NewApacheProject;