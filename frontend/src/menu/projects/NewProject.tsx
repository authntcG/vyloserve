import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import ProgressBar from '../../components/ProgressBar';
import Select, { type SelectOption } from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';
import { clampPercent } from '../../utils/progress';

export interface NewProjectRef {
    submit: () => Promise<boolean>;
}

export type RuntimeEngineType = 'php' | 'node' | 'python' | 'go' | 'java';

interface RuntimeStatusItem {
    installed: boolean;
    in_path?: boolean;
    version: string;
}

type RuntimesInfoMap = Record<RuntimeEngineType, RuntimeStatusItem>;

const DEFAULT_RUNTIMES_INFO: RuntimesInfoMap = {
    php: { installed: true, in_path: true, version: '' },
    node: { installed: false, in_path: false, version: '' },
    python: { installed: false, in_path: false, version: '' },
    go: { installed: false, in_path: false, version: '' },
    java: { installed: false, in_path: false, version: '' },
};

const DEFAULT_FRAMEWORK_BY_ENGINE: Record<RuntimeEngineType, string> = {
    php: 'laravel',
    node: 'react-vite',
    python: 'fastapi',
    go: 'gin',
    java: 'spring-boot',
};

const DEFAULT_PORT_BY_FRAMEWORK: Record<string, number> = {
    'react-vite': 5173,
    'react-native': 8081,
    'nextjs': 3000,
    'express': 3000,
    'node-raw': 3000,
    'fastapi': 8000,
    'django': 8000,
    'flask': 5000,
    'python-raw': 8000,
    'gin': 8080,
    'fiber': 8080,
    'go-raw': 8080,
    'spring-boot': 8080,
    'java-raw': 8080,
};

const ENGINE_BY_DETECTED_FRAMEWORK: Record<string, RuntimeEngineType> = {
    'laravel': 'php',
    'codeigniter': 'php',
    'wordpress': 'php',
    'raw': 'php',
    'react-vite': 'node',
    'react-native': 'node',
    'nextjs': 'node',
    'express': 'node',
    'node-raw': 'node',
    'fastapi': 'python',
    'django': 'python',
    'flask': 'python',
    'python-raw': 'python',
    'gin': 'go',
    'fiber': 'go',
    'go-raw': 'go',
    'spring-boot': 'java',
    'java-raw': 'java',
};

const RAW_FRAMEWORKS = new Set(['raw', 'node-raw', 'python-raw', 'go-raw', 'java-raw']);

function getFrameworkOptionsForEngine(engine: RuntimeEngineType, t: any): SelectOption<string>[] {
    switch (engine) {
        case 'node':
            return [
                { value: 'react-vite', label: t('apache.framework_react_vite') },
                { value: 'react-native', label: t('apache.framework_react_native') },
                { value: 'nextjs', label: t('apache.framework_nextjs') },
                { value: 'express', label: t('apache.framework_express') },
                { value: 'node-raw', label: t('apache.framework_node_raw') },
            ];
        case 'python':
            return [
                { value: 'fastapi', label: t('apache.framework_fastapi') },
                { value: 'django', label: t('apache.framework_django') },
                { value: 'flask', label: t('apache.framework_flask') },
                { value: 'python-raw', label: t('apache.framework_python_raw') },
            ];
        case 'go':
            return [
                { value: 'gin', label: t('apache.framework_gin') },
                { value: 'fiber', label: t('apache.framework_fiber') },
                { value: 'go-raw', label: t('apache.framework_go_raw') },
            ];
        case 'java':
            return [
                { value: 'spring-boot', label: t('apache.framework_spring_boot') },
                { value: 'java-raw', label: t('apache.framework_java_raw') },
            ];
        default:
            return [
                { value: 'laravel', label: t('apache.framework_laravel') },
                { value: 'codeigniter', label: t('apache.framework_codeigniter') },
                { value: 'wordpress', label: t('apache.framework_wordpress') },
                { value: 'raw', label: t('apache.framework_raw') },
            ];
    }
}

function buildRuntimeOptions(runtimesInfo: RuntimesInfoMap, t: any): SelectOption<string>[] {
    const formatNonPhpOption = (engine: RuntimeEngineType, labelKey: string): SelectOption<string> => {
        const info = runtimesInfo[engine];
        const isInstalled = Boolean(info?.installed);
        const isInPath = Boolean(info?.in_path);
        const isReady = isInstalled && isInPath;
        let sublabel = '';
        if (!isInstalled) {
            sublabel = t('apache.runtime_not_installed_badge');
        } else if (!isInPath) {
            sublabel = t('apache.runtime_not_in_path_badge');
        } else if (info.version) {
            sublabel = `v${info.version}`;
        }
        return {
            value: engine,
            label: t(labelKey),
            sublabel,
            disabled: !isReady,
        };
    };

    return [
        { value: 'php', label: t('apache.php_engine') },
        formatNonPhpOption('node', 'apache.runtime_node'),
        formatNonPhpOption('python', 'apache.runtime_python'),
        formatNonPhpOption('go', 'apache.runtime_go'),
        formatNonPhpOption('java', 'apache.runtime_java'),
    ];
}

async function detectFrameworkForPath(api: any, path: string): Promise<{ finalPath: string; framework: string | null } | null> {
    if (typeof api.detect_framework !== 'function') return null;
    const framework = await api.detect_framework(path);
    let finalPath = path.replaceAll('\\', '/');
    const usesPublicDir = framework === 'laravel' || framework === 'codeigniter';
    if (usesPublicDir && !finalPath.endsWith('/public')) {
        finalPath = `${finalPath}/public`;
    }
    return { finalPath, framework };
}

interface FreshInstallFieldsProps {
    readonly projectType: RuntimeEngineType;
    readonly frameworkToInstall: string;
    readonly onFrameworkChange: (v: string) => void;
    readonly specificVersion: string;
    readonly onSpecificVersionChange: (v: string) => void;
    readonly frameworkVersions: SelectOption<string>[];
    readonly isLoadingFrameworkVersions: boolean;
    readonly isCreating: boolean;
    readonly installLocation: string;
    readonly onInstallLocationChange: (v: string) => void;
    readonly onBrowseFolder: () => void;
    readonly onOpenAdvanced: () => void;
    readonly useVenv: boolean;
    readonly onUseVenvChange: (v: boolean) => void;
    readonly t: any;
}

function FreshInstallFields({
    projectType,
    frameworkToInstall,
    onFrameworkChange,
    specificVersion,
    onSpecificVersionChange,
    frameworkVersions,
    isLoadingFrameworkVersions,
    isCreating,
    installLocation,
    onInstallLocationChange,
    onBrowseFolder,
    onOpenAdvanced,
    useVenv,
    onUseVenvChange,
    t,
}: FreshInstallFieldsProps) {
    const isRawFramework = RAW_FRAMEWORKS.has(frameworkToInstall);
    const versionOptions: SelectOption<string>[] = [
        { value: '', label: t('apache.framework_version_latest') },
        ...frameworkVersions,
    ];

    return (
        <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <FieldLabel tone="primary">{t('apache.framework_to_install')}</FieldLabel>
                    <Select
                        searchable={false}
                        options={getFrameworkOptionsForEngine(projectType, t)}
                        value={frameworkToInstall}
                        onChange={onFrameworkChange}
                        placeholder={t('apache.framework_to_install')}
                        disabled={isCreating}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <FieldLabel>{t('apache.framework_version_label')}</FieldLabel>
                    <Select
                        searchable={versionOptions.length > 5}
                        options={versionOptions}
                        value={specificVersion}
                        onChange={onSpecificVersionChange}
                        placeholder={t('apache.framework_version_latest')}
                        disabled={isCreating || isRawFramework}
                        loading={isLoadingFrameworkVersions}
                        loadingText={t('apache.loading')}
                    />
                </div>
            </div>

            {projectType === 'python' && (
                <div className="flex items-center gap-2 pt-1">
                    <input
                        id="apache_new_project_use_venv"
                        type="checkbox"
                        checked={useVenv}
                        onChange={(e) => onUseVenvChange(e.target.checked)}
                        disabled={isCreating}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="apache_new_project_use_venv" className="text-xs text-text-secondary select-none cursor-pointer">
                        {t('apache.use_python_venv')}
                    </label>
                </div>
            )}

            {installLocation ? (
                <div className="text-xs text-slate-500 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="truncate flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                        {t('apache.workspace_label')}<strong className="text-slate-700 dark:text-slate-300">{installLocation}</strong>
                    </span>
                    <button type="button" onClick={onOpenAdvanced} className="text-primary font-medium hover:underline shrink-0 outline-none">{t('apache.change')}</button>
                </div>
            ) : (
                <InfoBox tone="warning" icon="folder_special" title={t('apache.workspace_required')} className="animate-in fade-in zoom-in-95">
                    <span className="leading-relaxed">{t('apache.workspace_desc')}</span>
                    <div className="flex gap-2">
                        <input
                            id="apache_new_project_workspace_quick"
                            aria-label={t('apache.workspace_location')}
                            type="text"
                            value={installLocation}
                            onChange={(e) => onInstallLocationChange(e.target.value)}
                            disabled={isCreating}
                            placeholder={t('apache.placeholder_workspace')}
                            className="w-full bg-white dark:bg-slate-950 border border-amber-500/50 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none transition-colors disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={onBrowseFolder}
                            disabled={isCreating}
                            className="px-4 border rounded-lg bg-amber-500/10 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-slate-700 border-amber-500/50 text-amber-600 dark:text-amber-500 text-sm font-medium outline-none transition-colors"
                        >
                            {t('apache.browse')}
                        </button>
                    </div>
                </InfoBox>
            )}
        </div>
    );
}

interface ExistingProjectFieldsProps {
    readonly documentRoot: string;
    readonly onDocumentRootChange: (v: string) => void;
    readonly isCreating: boolean;
    readonly isDetecting: boolean;
    readonly detectedFramework: string | null;
    readonly onBrowseExisting: () => void;
    readonly inputClasses: string;
    readonly t: any;
}

function ExistingProjectFields({ documentRoot, onDocumentRootChange, isCreating, isDetecting, detectedFramework, onBrowseExisting, inputClasses, t }: ExistingProjectFieldsProps) {
    const isStandardDocroot = detectedFramework !== 'laravel' && detectedFramework !== 'codeigniter';
    return (
        <div className="flex flex-col gap-2 animate-in fade-in">
            <FieldLabel htmlFor="apache_existing_project_dir">{t('apache.project_directory')}</FieldLabel>
            <div className="flex gap-2">
                <input id="apache_existing_project_dir" type="text" value={documentRoot} onChange={(e) => onDocumentRootChange(e.target.value)} disabled={isCreating} placeholder={t('apache.placeholder_project_directory')} className={inputClasses} />
                <button type="button" onClick={onBrowseExisting} disabled={isCreating || isDetecting} className={`px-4 font-medium text-sm border rounded-lg transition-colors outline-none ${isCreating || isDetecting ? 'bg-slate-50 text-slate-400 dark:bg-slate-900 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}>
                    {t('apache.browse')}
                </button>
            </div>

            <div className="min-h-[28px]">
                {isDetecting && <span className="text-xs font-medium text-primary flex items-center gap-2 animate-pulse"><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> {t('apache.analyzing_directory')}</span>}
                {(!isDetecting && detectedFramework) && (
                    <div className={`text-xs flex items-center gap-1.5 p-2 rounded-md border ${detectedFramework === 'wordpress' ? 'text-primary bg-primary/10 border-primary/20 dark:bg-primary/20 dark:border-primary/30' : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20 dark:border-emerald-500/30'}`}>
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span><strong>{detectedFramework.toUpperCase()}{t('apache.detected')}</strong> {!isStandardDocroot ? t('apache.docroot_auto_public') : t('apache.docroot_standard')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

interface AdvancedSettingsSectionProps {
    readonly isOpen: boolean;
    readonly onToggle: () => void;
    readonly domainName: string;
    readonly onDomainNameChange: (v: string) => void;
    readonly domainExtension: string;
    readonly onDomainExtensionChange: (v: string) => void;
    readonly isCreating: boolean;
    readonly isExistingLocal: boolean;
    readonly installLocation: string;
    readonly onInstallLocationChange: (v: string) => void;
    readonly onBrowseFolder: () => void;
    readonly specificVersion: string;
    readonly onSpecificVersionChange: (v: string) => void;
    readonly inputClasses: string;
    readonly t: any;
}

function AdvancedSettingsSection({
    isOpen,
    onToggle,
    domainName,
    onDomainNameChange,
    domainExtension,
    onDomainExtensionChange,
    isCreating,
    isExistingLocal,
    installLocation,
    onInstallLocationChange,
    onBrowseFolder,
    specificVersion,
    onSpecificVersionChange,
    inputClasses,
    t,
}: AdvancedSettingsSectionProps) {
    return (
        <div className="border-t border-slate-200 dark:border-slate-800/60 pt-2">
            <button type="button" onClick={onToggle} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors outline-none w-fit">
                <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                {t('apache.advanced_settings')}
            </button>

            <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="apache_custom_domain_name" size="xs" tone="muted">{t('apache.custom_local_domain')}</FieldLabel>
                    <div className="flex shadow-sm rounded-lg">
                        <input id="apache_custom_domain_name" type="text" value={domainName} onChange={(e) => onDomainNameChange(e.target.value)} disabled={isCreating} className={`${inputClasses} rounded-r-none focus:ring-primary`} />
                        <input id="apache_custom_domain_ext" aria-label={t('apache.custom_local_domain')} type="text" value={domainExtension} onChange={(e) => onDomainExtensionChange(e.target.value)} disabled={isCreating} className="w-24 bg-slate-50 dark:bg-slate-900 border border-l-0 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-center font-medium text-sm rounded-r-lg outline-none disabled:opacity-50" />
                    </div>
                </div>

                {!isExistingLocal && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-3 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex flex-col gap-2 col-span-1 sm:col-span-2">
                            <FieldLabel htmlFor="apache_adv_workspace_loc" size="xs" tone="muted" className="flex justify-between">
                                {t('apache.workspace_location')}
                                {installLocation && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{t('apache.saved')}</span>}
                            </FieldLabel>
                            <div className="flex gap-2">
                                <input id="apache_adv_workspace_loc" type="text" value={installLocation} onChange={(e) => onInstallLocationChange(e.target.value)} disabled={isCreating} placeholder={t('apache.placeholder_workspace_location')} className={inputClasses} />
                                <button type="button" onClick={onBrowseFolder} disabled={isCreating} className="px-3 border rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-sm outline-none transition-colors">{t('apache.browse')}</button>
                            </div>
                            <span className="text-[11px] text-slate-500">{t('apache.project_extracted_to')}<strong>{installLocation ? `${installLocation}\\${domainName}`.replaceAll('\\', '/') : '...'}</strong></span>
                        </div>

                        <div className="flex flex-col gap-2 col-span-1 sm:col-span-2">
                            <FieldLabel htmlFor="apache_adv_specific_version" size="xs" tone="muted">{t('apache.specific_version')}</FieldLabel>
                            <input id="apache_adv_specific_version" type="text" value={specificVersion} onChange={(e) => onSpecificVersionChange(e.target.value)} disabled={isCreating} placeholder={t('apache.placeholder_specific_version')} className={inputClasses} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const NewApacheProject = forwardRef<NewProjectRef, any>((props, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // --- MAIN STATES ---
    const [projectName, setProjectName] = useState('');
    const [isExistingLocal, setIsExistingLocal] = useState(false);
    const [projectType, setProjectType] = useState<RuntimeEngineType>('php');
    const [frameworkToInstall, setFrameworkToInstall] = useState('laravel');
    const [proxyPort, setProxyPort] = useState<number>(3000);
    const [documentRoot, setDocumentRoot] = useState('');

    // --- ADVANCED STATES ---
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [domainName, setDomainName] = useState('');
    const [domainExtension, setDomainExtension] = useState('.test');
    const [specificVersion, setSpecificVersion] = useState('');
    const [installLocation, setInstallLocation] = useState('');
    const [useVenv, setUseVenv] = useState(true);

    // --- RUNTIME & VERSION STATES ---
    const [phpVersions, setPhpVersions] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [isLoadingVersions, setIsLoadingVersions] = useState(true);
    const [runtimesInfo, setRuntimesInfo] = useState<RuntimesInfoMap>(DEFAULT_RUNTIMES_INFO);
    const [frameworkVersions, setFrameworkVersions] = useState<SelectOption<string>[]>([]);
    const [isLoadingFrameworkVersions, setIsLoadingFrameworkVersions] = useState(false);

    // Feedback States
    const [detectedFramework, setDetectedFramework] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);

    // Progress States
    const [internalIsCreating, setInternalIsCreating] = useState(false);
    const isCreating = props.isCreatingExternal !== undefined ? props.isCreatingExternal : internalIsCreating;
    const [progress, setProgress] = useState({ percent: 0, text: '' });

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleProgress = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.source && customEvent.detail.source !== 'ProjectManager') return;
            if (customEvent.detail) {
                const rawText = customEvent.detail.text;
                const translatedText = rawText ? (t(rawText, customEvent.detail.args || {}) as string) : t('apache.processing');
                setProgress({ percent: clampPercent(customEvent.detail.percent || 0), text: translatedText });
            }
        };
        window.addEventListener('vylo_progress', handleProgress);
        return () => window.removeEventListener('vylo_progress', handleProgress);
    }, [t]);

    useEffect(() => {
        if (isCreating && bottomRef.current) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
        } else if (!isCreating) {
            setProgress({ percent: 0, text: '' });
        }
    }, [isCreating]);

    useEffect(() => {
        const api = window.pywebview?.api;
        if (api && typeof api.get_app_settings === 'function') {
            api.get_app_settings().then((res: any) => {
                if (res?.status === 'success' && res.data?.default_apache_install_location) {
                    setInstallLocation(res.data.default_apache_install_location);
                }
            }).catch((e: any) => console.error(e));
        }
    }, []);

    useEffect(() => {
        const fetchRuntimes = async () => {
            setIsLoadingVersions(true);
            try {
                const api = window.pywebview?.api as any;
                if (api && typeof api.get_installed_php === 'function') {
                    const versions = await api.get_installed_php();
                    const list = Array.isArray(versions) ? versions : (versions?.data || []);
                    setPhpVersions(list);
                    if (list.length > 0) setSelectedVersion(list[list.length - 1].version);
                }
                if (api && typeof api.get_project_runtimes_info === 'function') {
                    const rtRes = await api.get_project_runtimes_info();
                    if (rtRes?.status === 'success' && rtRes.data) {
                        setRuntimesInfo({ ...DEFAULT_RUNTIMES_INFO, ...rtRes.data });
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoadingVersions(false);
            }
        };
        fetchRuntimes();
    }, []);

    const activeRuntimeVersion = projectType === 'php' ? selectedVersion : (runtimesInfo[projectType]?.version || '');

    useEffect(() => {
        const api = window.pywebview?.api as any;
        if (isExistingLocal || RAW_FRAMEWORKS.has(frameworkToInstall) || typeof api?.get_framework_versions !== 'function') {
            setFrameworkVersions([]);
            return;
        }
        let cancelled = false;
        setIsLoadingFrameworkVersions(true);
        api.get_framework_versions(projectType, frameworkToInstall, activeRuntimeVersion)
            .then((res: any) => {
                if (!cancelled && res?.status === 'success' && Array.isArray(res.data)) {
                    setFrameworkVersions(res.data);
                }
            })
            .catch((e: any) => console.error(e))
            .finally(() => {
                if (!cancelled) setIsLoadingFrameworkVersions(false);
            });
        return () => { cancelled = true; };
    }, [isExistingLocal, projectType, frameworkToInstall, activeRuntimeVersion]);

    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setProjectName(val);
        setDomainName(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    };

    const handleEngineChange = (newEngine: string) => {
        const engine = newEngine as RuntimeEngineType;
        if (engine === projectType) return;
        setProjectType(engine);
        const defaultFw = DEFAULT_FRAMEWORK_BY_ENGINE[engine];
        setFrameworkToInstall(defaultFw);
        setSpecificVersion('');
        if (DEFAULT_PORT_BY_FRAMEWORK[defaultFw]) {
            setProxyPort(DEFAULT_PORT_BY_FRAMEWORK[defaultFw]);
        }
    };

    const handleFrameworkChange = (newFramework: string) => {
        if (newFramework === frameworkToInstall) return;
        setFrameworkToInstall(newFramework);
        setSpecificVersion('');
        if (DEFAULT_PORT_BY_FRAMEWORK[newFramework]) {
            setProxyPort(DEFAULT_PORT_BY_FRAMEWORK[newFramework]);
        }
    };

    const handleInstallLocChange = (val: string) => {
        setInstallLocation(val);
        window.pywebview?.api?.save_app_settings?.({ default_apache_install_location: val });
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
        if (!api || typeof api.browse_directory !== 'function') return;

        const selectedPath = await api.browse_directory();
        if (!selectedPath) return;

        setDocumentRoot(selectedPath);
        setIsDetecting(true);

        const detected = await detectFrameworkForPath(api, selectedPath);
        if (detected) {
            setDocumentRoot(detected.finalPath);
            setDetectedFramework(detected.framework);
            if (detected.framework && ENGINE_BY_DETECTED_FRAMEWORK[detected.framework]) {
                const detEngine = ENGINE_BY_DETECTED_FRAMEWORK[detected.framework];
                setProjectType(detEngine);
                setFrameworkToInstall(detected.framework);
                if (DEFAULT_PORT_BY_FRAMEWORK[detected.framework]) {
                    setProxyPort(DEFAULT_PORT_BY_FRAMEWORK[detected.framework]);
                }
            }
        }
        setIsDetecting(false);
    };

    useImperativeHandle(ref, () => ({
        submit: async () => {
            const isPhp = projectType === 'php';
            if (!projectName || !domainName || (isPhp && !selectedVersion)) {
                showToast(t('apache.new_project_req_error'), 'warning');
                return false;
            }
            if (!isPhp && (!proxyPort || proxyPort < 1024 || proxyPort > 65535)) {
                showToast(t('apache.invalid_proxy_port_error'), 'warning');
                return false;
            }
            if (isExistingLocal && !documentRoot) {
                showToast(t('apache.new_project_docroot_error'), 'warning');
                return false;
            }
            if (!isExistingLocal && !installLocation) {
                showToast(t('apache.new_project_workspace_error'), 'warning');
                return false;
            }

            const selectedPhpData = phpVersions.find(p => p.version === selectedVersion);
            const actualPhpPort = selectedPhpData?.port || selectedPhpData?.fastcgi_port || 9000;

            const payload = {
                name: projectName,
                domain: domainName,
                domain_extension: domainExtension,
                project_type: projectType,
                proxy_port: isPhp ? null : Number(proxyPort),
                php_version: selectedVersion,
                php_port: actualPhpPort,
                is_existing: isExistingLocal,
                document_root: documentRoot,
                framework: isExistingLocal ? (detectedFramework || frameworkToInstall) : frameworkToInstall,
                install_location: installLocation,
                specific_version: specificVersion,
                use_venv: projectType === 'python' ? useVenv : false,
            };

            setInternalIsCreating(true);
            setProgress({ percent: 10, text: t('apache.preparing_project_config') });

            try {
                const api = window.pywebview?.api;
                const response = await api?.create_project(payload);
                if (response?.status === 'success') {
                    showToast(t(response.message, response.args || {}) as string, 'success');
                    window.dispatchEvent(new CustomEvent('project_list_updated'));
                    return true;
                } else {
                    showToast(response?.message ? (t(response.message, response.args || {}) as string) : t('common.error'), 'error');
                    return false;
                }
            } catch (error) {
                console.error(error);
                showToast(t('apache.new_project_backend_error'), 'error');
                return false;
            } finally {
                setInternalIsCreating(false);
            }
        },
    }));

    const inputClasses = 'w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900';

    return (
        <div className="flex flex-col gap-4 relative">
            {/* 1. SETUP MODE (SEGMENTED CONTROL) */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                <button type="button" disabled={isCreating} onClick={() => setIsExistingLocal(false)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 outline-none disabled:cursor-not-allowed ${!isExistingLocal ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    🚀 {t('apache.fresh_install')}
                </button>
                <button type="button" disabled={isCreating} onClick={() => setIsExistingLocal(true)} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 outline-none disabled:cursor-not-allowed ${isExistingLocal ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    🔗 {t('apache.link_existing')}
                </button>
            </div>

            {/* 2. PRIMARY FIELDS (Project Name, Runtime Engine, PHP Version or Target Port) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <FieldLabel htmlFor="apache_new_project_name">{t('apache.project_name')}</FieldLabel>
                    <input id="apache_new_project_name" type="text" value={projectName} onChange={handleProjectNameChange} disabled={isCreating} placeholder={t('apache.placeholder_project_name')} className={inputClasses} />
                </div>

                <div className="flex flex-col gap-2">
                    <FieldLabel>{t('apache.environment')}</FieldLabel>
                    <Select
                        searchable={false}
                        options={buildRuntimeOptions(runtimesInfo, t)}
                        value={projectType}
                        onChange={handleEngineChange}
                        placeholder={t('apache.environment')}
                        disabled={isCreating}
                    />
                </div>

                {projectType === 'php' ? (
                    <div className="flex flex-col gap-2">
                        <FieldLabel>{t('apache.php_version_label')}</FieldLabel>
                        <Select
                            searchable={false}
                            options={phpVersions.map((php) => ({ value: php.version, label: `${php.name} (${php.version})` }))}
                            value={selectedVersion || null}
                            onChange={setSelectedVersion}
                            placeholder={t('apache.no_php_installed_exc')}
                            disabled={isCreating}
                            loading={isLoadingVersions}
                            loadingText={t('apache.loading')}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="apache_new_project_proxy_port">{t('apache.target_localhost_port')}</FieldLabel>
                        <input
                            id="apache_new_project_proxy_port"
                            type="number"
                            min={1024}
                            max={65535}
                            value={proxyPort}
                            onChange={(e) => setProxyPort(Number(e.target.value))}
                            disabled={isCreating}
                            placeholder="3000"
                            className={inputClasses}
                        />
                    </div>
                )}
            </div>

            {/* 3. DYNAMIC CONTEXTUAL FIELD */}
            {!isExistingLocal ? (
                <FreshInstallFields
                    projectType={projectType}
                    frameworkToInstall={frameworkToInstall}
                    onFrameworkChange={handleFrameworkChange}
                    specificVersion={specificVersion}
                    onSpecificVersionChange={setSpecificVersion}
                    frameworkVersions={frameworkVersions}
                    isLoadingFrameworkVersions={isLoadingFrameworkVersions}
                    isCreating={isCreating}
                    installLocation={installLocation}
                    onInstallLocationChange={handleInstallLocChange}
                    onBrowseFolder={handleBrowseFolder}
                    onOpenAdvanced={() => setIsAdvancedOpen(true)}
                    useVenv={useVenv}
                    onUseVenvChange={setUseVenv}
                    t={t}
                />
            ) : (
                <ExistingProjectFields
                    documentRoot={documentRoot}
                    onDocumentRootChange={(v) => { setDocumentRoot(v); setDetectedFramework(null); }}
                    isCreating={isCreating}
                    isDetecting={isDetecting}
                    detectedFramework={detectedFramework}
                    onBrowseExisting={handleBrowseExistingProject}
                    inputClasses={inputClasses}
                    t={t}
                />
            )}

            {/* 4. PROGRESSIVE DISCLOSURE (ADVANCED SETTINGS) */}
            <AdvancedSettingsSection
                isOpen={isAdvancedOpen}
                onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
                domainName={domainName}
                onDomainNameChange={setDomainName}
                domainExtension={domainExtension}
                onDomainExtensionChange={setDomainExtension}
                isCreating={isCreating}
                isExistingLocal={isExistingLocal}
                installLocation={installLocation}
                onInstallLocationChange={handleInstallLocChange}
                onBrowseFolder={handleBrowseFolder}
                specificVersion={specificVersion}
                onSpecificVersionChange={setSpecificVersion}
                inputClasses={inputClasses}
                t={t}
            />

            {/* 5. PROGRESS BAR CONTAINER */}
            <div ref={bottomRef} className="pt-1">
                {isCreating && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{progress.text || t('apache.processing')}</span>
                            <span className="text-xs font-bold text-primary">{progress.percent}%</span>
                        </div>
                        <ProgressBar percent={progress.percent} />
                    </div>
                )}
            </div>
        </div>
    );
});

export default NewApacheProject;
