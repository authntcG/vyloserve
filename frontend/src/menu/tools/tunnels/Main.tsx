import { useState, useEffect, useRef } from 'react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ToastContext';
import PageHeader from '../../../components/PageHeader';
import SkeletonCard from '../../../components/SkeletonCard';
import EmptyState from '../../../components/EmptyState';
import Card from '../../../components/Card';
import Modal from '../../../components/Modal';
import BackgroundProgressWidget from '../../../components/BackgroundProgressWidget';
import { clampPercent } from '../../../utils/progress';
import InstallZrok from './InstallZrok';

interface ZrokStatus {
    installed: boolean;
    enabled: boolean;
    version?: string;
    env_status?: string;
    active_shares: { id: string, project_id: string, url: string }[];
}

interface InstallZrokRef {
    submit: () => Promise<boolean>;
}


function getProjectDropdownLabel(projects: any[], target: any, t: any): string {
    if (projects.length === 0) return t('tools.zrok.no_projects');
    if (target) return `${target.domain} (${target.name})`;
    return t('tools.zrok.select_project');
}

// ----------------------------------------------------------------------------
// PROJECT DROPDOWN COMPONENT (Searchable Combobox)
// ----------------------------------------------------------------------------
function ProjectDropdown({ 
    projects, 
    selectedProject, 
    isDropdownOpen, 
    onToggleDropdown, 
    searchQuery, 
    onSearchChange, 
    onSelectProject, 
    dropdownRef, 
    searchInputRef, 
    t, 
    disabled 
}: any) {
    const onEnterOrSpace = (cb: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cb();
        }
    };

    const filtered = projects.filter((p: any) => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.domain.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50);

    const target = projects.find((p: any) => p.id === selectedProject);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={onToggleDropdown}
                disabled={disabled}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 outline-none flex items-center justify-between transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'bg-white dark:bg-slate-800 cursor-pointer hover:border-primary text-slate-700 dark:text-slate-200'}`}
            >
                <span className="truncate pr-2 text-sm text-left">
                    {getProjectDropdownLabel(projects, target, t)}
                </span>
                <span className={`material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                    expand_more
                </span>
            </button>

            {isDropdownOpen && !disabled && (
                <div className="absolute top-[45px] left-0 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('common.search', 'Search...')}
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                        {filtered.length > 0 ? (
                            filtered.map((p: any) => {
                                const isSelected = selectedProject === p.id;
                                return (
                                    <div // NOSONAR typescript:S6819
                                        key={p.id}
                                        onClick={() => onSelectProject(p.id)}
                                        onKeyDown={onEnterOrSpace(() => onSelectProject(p.id))}
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={0}
                                        className={`px-3 py-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between group outline-none ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    >
                                        <span>{p.domain} <span className="text-xs text-slate-500 ml-1">({p.name})</span></span>
                                        {isSelected && <span className="material-symbols-outlined text-[16px] text-primary">check</span>}
                                    </div>
                                )
                            })
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-500">
                                {t('common.no_results', 'No results found')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------------
// HELPERS & HOOKS (dipecah dari TunnelsMain supaya Cognitive Complexity tiap fungsi tetap rendah)
// ----------------------------------------------------------------------------
type ToastFn = ReturnType<typeof useToast>['showToast'];
type ShareMode = 'project' | 'custom';
type ActiveTab = 'all' | 'zrok';

const UNEXPECTED_ERROR_KEY = 'backend.error.unexpected';
const PROGRESS_HIDE_DELAY_MS = 3000;
const SETTLED_PERCENT = 100;

interface ZrokActionContext {
    readonly t: any;
    readonly showToast: ToastFn;
    readonly onSuccess: () => void;
}

/** Pola umum semua aksi zrok: panggil API, tampilkan toast hasilnya, refresh kalau sukses. */
async function runZrokAction(call: () => Promise<any> | undefined, { t, showToast, onSuccess }: ZrokActionContext) {
    try {
        const res = await call();
        showToast(t(res?.message || '', res?.args || {}) as string, res?.status === 'success' ? 'success' : 'error');
        if (res?.status === 'success') onSuccess();
    } catch (e) {
        console.error('Zrok action failed:', e);
        showToast(t(UNEXPECTED_ERROR_KEY), 'error');
    }
}

interface UninstallContext {
    readonly t: any;
    readonly showToast: ToastFn;
    readonly closeModal: () => void;
    readonly clearStatus: () => void;
    readonly refresh: () => void;
}

async function performUninstall({ t, showToast, closeModal, clearStatus, refresh }: UninstallContext) {
    try {
        const res = await window.pywebview?.api?.uninstall_zrok();
        if (res?.status === 'success') {
            showToast(t(res.message || 'tools.zrok.uninstall_success') as string, 'success');
            closeModal();
            clearStatus(); // Clear status immediately, wait for fetchData
            refresh();
        } else {
            showToast(t(res?.message || UNEXPECTED_ERROR_KEY, res?.args || {}) as string, 'error');
        }
    } catch (e) {
        console.error('Zrok uninstall failed:', e);
        showToast(t(UNEXPECTED_ERROR_KEY), 'error');
    }
}

function pickShareTarget(shareMode: ShareMode, selectedProject: string, customTarget: string): string {
    return shareMode === 'project' ? selectedProject : customTarget;
}

interface ProgressControls {
    readonly t: any;
    readonly hideTimeoutRef: { current: number | null };
    readonly setIsInstalling: (value: boolean) => void;
    readonly setProgress: (value: number) => void;
    readonly setProgressText: (value: string) => void;
    readonly onFinished: () => void;
}

/** Terapkan satu event `vylo_progress` ke state widget instalasi. */
function applyProgressEvent(detail: any, controls: ProgressControls) {
    const percent = detail.percent;
    if (controls.hideTimeoutRef.current) {
        window.clearTimeout(controls.hideTimeoutRef.current);
        controls.hideTimeoutRef.current = null;
    }
    if (percent < 0) {
        controls.setIsInstalling(false);
        controls.setProgress(0);
        return;
    }
    if (percent > 0 && percent < SETTLED_PERCENT) controls.setIsInstalling(true);
    controls.setProgress(clampPercent(percent));
    controls.setProgressText(controls.t(detail.text || '', detail.args || {}) as string);
    if (percent >= SETTLED_PERCENT) {
        controls.hideTimeoutRef.current = window.setTimeout(controls.onFinished, PROGRESS_HIDE_DELAY_MS);
    }
}

function useZrokData() {
    const [status, setStatus] = useState<ZrokStatus | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const zStatus = await window.pywebview?.api?.get_zrok_status();
            if (zStatus && typeof zStatus.installed === 'boolean') {
                setStatus(zStatus);
            }
            const pRes = await window.pywebview?.api?.get_projects();
            if (pRes?.status === 'success') {
                setProjects(pRes.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const handleStatus = (e: any) => { if (['zrok', 'all'].includes(e.detail?.service)) fetchData(); };
        window.addEventListener('service_status_changed', handleStatus);
        return () => window.removeEventListener('service_status_changed', handleStatus);
    }, []);

    return { status, setStatus, projects, isLoading, fetchData };
}

function useProjectDropdown() {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isDropdownOpen) {
            setSearchQuery('');
        } else {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isDropdownOpen]);

    return { isDropdownOpen, setIsDropdownOpen, searchQuery, setSearchQuery, dropdownRef, searchInputRef };
}

function useInstallProgress(t: any, onFinished: () => void) {
    const [isInstalling, setIsInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const hideProgressTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleProg = (e: any) => {
            if (!e.detail) return;
            applyProgressEvent(e.detail, {
                t,
                hideTimeoutRef: hideProgressTimeoutRef,
                setIsInstalling,
                setProgress,
                setProgressText,
                onFinished: () => {
                    setProgress(0);
                    setIsInstalling(false);
                    onFinished();
                },
            });
        };
        window.addEventListener('vylo_progress', handleProg);
        return () => window.removeEventListener('vylo_progress', handleProg);
    }, [t]);

    return { isInstalling, setIsInstalling, progress, setProgress, progressText, setProgressText };
}

// ----------------------------------------------------------------------------
// PRESENTATIONAL SUB-COMPONENTS
// ----------------------------------------------------------------------------
function InstallHeaderButton({ installed, isLoading, onClick }: { readonly installed?: boolean; readonly isLoading: boolean; readonly onClick: () => void }) {
    const { t } = useTranslation();
    const colorClass = installed
        ? 'bg-emerald-500 hover:bg-emerald-600 disabled:opacity-100 disabled:cursor-default border-transparent'
        : 'bg-primary hover:bg-blue-600 border border-transparent';
    return (
        <button type="button"
            onClick={onClick}
            disabled={installed || isLoading}
            className={`text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm ${colorClass}`}>
            <span className="material-symbols-outlined text-[18px]">
                {installed ? 'check_circle' : 'download'}
            </span> 
            {installed ? t('runtimes.installed') : t('tools.zrok.install_tunnel')}
        </button>
    );
}

function TabButton({ active, label, onClick }: { readonly active: boolean; readonly label: string; readonly onClick: () => void }) {
    const stateClass = active ? 'border-primary text-primary' : 'border-transparent text-slate-500';
    return (
        <button type="button" onClick={onClick} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${stateClass}`}>{label}</button>
    );
}

function ZrokEngineCard({ version, onUninstall }: { readonly version?: string; readonly onUninstall: () => void }) {
    const { t } = useTranslation();
    return (
        <Card title={t('tools.zrok.engine_card_title')} status={t('runtimes.installed')} gridCols="grid-cols-1" dropdownActions={
            <button type="button" onClick={onUninstall} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                {t('tools.zrok.uninstall')}
            </button>
        }>
            <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.installed_version')}</span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                    {version || t('common.unknown')}
                </span>
            </div>
        </Card>
    );
}

interface EnableFormProps {
    readonly token: string;
    readonly isEnabling: boolean;
    readonly onTokenChange: (value: string) => void;
    readonly onEnable: () => void;
}

function ZrokEnableForm({ token, isEnabling, onTokenChange, onEnable }: EnableFormProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">{t('tools.zrok.enable_account')}</h3>
            <p className="text-sm text-slate-500 mb-4">{t('tools.zrok.enable_desc')}</p>
            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="zrok-token" className="sr-only">{t('tools.zrok.token_label')}</label>
                    <input id="zrok-token" type="text" value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder={t('tools.zrok.token_placeholder')} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200 bg-white" />
                </div>
                <button type="button" onClick={onEnable} disabled={isEnabling || !token.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {t('common.enable')}
                </button>
            </div>
        </div>
    );
}

function ZrokEnabledInfo({ envStatus }: { readonly envStatus?: string }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined">check_circle</span>
                <span className="text-sm font-medium">{t('tools.zrok.account_enabled')}</span>
            </div>
            {envStatus && (
                <pre className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-100 dark:border-slate-800">
                    {envStatus}
                </pre>
            )}
        </div>
    );
}

interface AccountCardProps extends EnableFormProps {
    readonly status: ZrokStatus;
    readonly onDisable: () => void;
}

function ZrokAccountCard({ status, token, isEnabling, onTokenChange, onEnable, onDisable }: AccountCardProps) {
    const { t } = useTranslation();
    return (
        <Card 
            title={t('tools.zrok.account_card_title')} gridCols="grid-cols-1" 
            footerActions={
                status.enabled ? (
                    <button type="button" onClick={onDisable} className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2">
                        {t('tools.zrok.disable_account')}
                    </button>
                ) : null
            }
        >
            {status.enabled
                ? <ZrokEnabledInfo envStatus={status.env_status} />
                : <ZrokEnableForm token={token} isEnabling={isEnabling} onTokenChange={onTokenChange} onEnable={onEnable} />}
        </Card>
    );
}

function ShareModeButton({ active, disabled, label, onClick }: { readonly active: boolean; readonly disabled: boolean; readonly label: string; readonly onClick: () => void }) {
    const stateClass = active ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400';
    return (
        <button type="button" disabled={disabled} onClick={onClick} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 outline-none ${stateClass}`}>
            {label}
        </button>
    );
}

interface ShareTargetFieldProps {
    readonly shareMode: ShareMode;
    readonly projects: any[];
    readonly selectedProject: string;
    readonly customTarget: string;
    readonly isStarting: boolean;
    readonly dropdown: ReturnType<typeof useProjectDropdown>;
    readonly onSelectProject: (id: string) => void;
    readonly onCustomTargetChange: (value: string) => void;
}

function ShareTargetField({ shareMode, projects, selectedProject, customTarget, isStarting, dropdown, onSelectProject, onCustomTargetChange }: ShareTargetFieldProps) {
    const { t } = useTranslation();
    const isProjectMode = shareMode === 'project';
    const toggleDropdown = () => {
        if (projects.length > 0 && !isStarting) dropdown.setIsDropdownOpen(!dropdown.isDropdownOpen);
    };
    return (
        <div className="flex-1 flex flex-col gap-2">
            <label htmlFor={isProjectMode ? "project-select" : "custom-target"} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isProjectMode ? t('tools.zrok.select_project') : t('tools.zrok.custom_target')}
            </label>
            {isProjectMode ? (
                <ProjectDropdown 
                    projects={projects}
                    selectedProject={selectedProject}
                    isDropdownOpen={dropdown.isDropdownOpen}
                    onToggleDropdown={toggleDropdown}
                    searchQuery={dropdown.searchQuery}
                    onSearchChange={dropdown.setSearchQuery}
                    onSelectProject={onSelectProject}
                    dropdownRef={dropdown.dropdownRef}
                    searchInputRef={dropdown.searchInputRef}
                    t={t}
                    disabled={isStarting}
                />
            ) : (
                <input id="custom-target" type="text" value={customTarget} onChange={(e) => onCustomTargetChange(e.target.value)} placeholder="localhost:3000" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200 bg-white" />
            )}
        </div>
    );
}

interface ShareCardProps extends ShareTargetFieldProps {
    readonly onShareModeChange: (mode: ShareMode) => void;
    readonly onStartShare: () => void;
}

function ShareCard(props: ShareCardProps) {
    const { t } = useTranslation();
    const { shareMode, selectedProject, customTarget, isStarting, onShareModeChange, onStartShare } = props;
    const hasTarget = Boolean(pickShareTarget(shareMode, selectedProject, customTarget));
    return (
        <Card title={t('tools.zrok.share_card_title')} gridCols="grid-cols-1">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg mb-2">
                <ShareModeButton active={shareMode === 'project'} disabled={isStarting} label={t('tools.zrok.mode_project')} onClick={() => onShareModeChange('project')} />
                <ShareModeButton active={shareMode === 'custom'} disabled={isStarting} label={t('tools.zrok.mode_custom')} onClick={() => onShareModeChange('custom')} />
            </div>
            <div className="flex gap-4 items-end mt-2">
                <ShareTargetField {...props} />
                <button type="button" onClick={onStartShare} disabled={isStarting || !hasTarget} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 h-10 flex items-center justify-center gap-2">
                    {isStarting && <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>}
                    {t('tools.zrok.start_share')}
                </button>
            </div>
        </Card>
    );
}

interface ActiveSharesCardProps {
    readonly shares: ZrokStatus['active_shares'];
    readonly projects: any[];
    readonly onStop: (shareId: string) => void;
}

function ActiveSharesCard({ shares, projects, onStop }: ActiveSharesCardProps) {
    const { t } = useTranslation();
    return (
        <Card title={t('tools.zrok.active_shares')} gridCols="grid-cols-1">
            {shares.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">{t('tools.zrok.no_active_shares')}</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {shares.map(share => {
                        const proj = projects.find(p => p.id === share.project_id);
                        return (
                            <div key={share.id} className="flex justify-between items-center p-4 border dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">{proj ? proj.domain : share.project_id}</p>
                                    <a href={share.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">{share.url}</a>
                                </div>
                                <button type="button" onClick={() => onStop(share.id)} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 font-medium text-sm">
                                    {t('tools.zrok.stop_share')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

interface ZrokSectionsProps {
    readonly status: ZrokStatus;
    readonly projects: any[];
    readonly account: EnableFormProps & { readonly onDisable: () => void };
    readonly share: Omit<ShareCardProps, 'projects'>;
    readonly onUninstall: () => void;
    readonly onStopShare: (shareId: string) => void;
}

function ZrokSections({ status, projects, account, share, onUninstall, onStopShare }: ZrokSectionsProps) {
    return (
        <div className="flex flex-col gap-6">
            {status.installed && <ZrokEngineCard version={status.version} onUninstall={onUninstall} />}
            {status.installed && <ZrokAccountCard status={status} {...account} />}
            {status.enabled && (
                <div className="flex flex-col gap-6">
                    <ShareCard projects={projects} {...share} />
                    <ActiveSharesCard shares={status.active_shares} projects={projects} onStop={onStopShare} />
                </div>
            )}
        </div>
    );
}

interface TunnelsBodyProps extends Omit<ZrokSectionsProps, 'status'> {
    readonly status: ZrokStatus | null;
    readonly isLoading: boolean;
    readonly activeTab: ActiveTab;
    readonly onInstallClick: () => void;
}

function TunnelsBody({ status, isLoading, activeTab, onInstallClick, ...sectionProps }: TunnelsBodyProps) {
    const { t } = useTranslation();
    const isKnownTab = activeTab === 'all' || activeTab === 'zrok';
    if (isLoading) return <SkeletonCard />;
    if (!status?.installed && isKnownTab) {
        return (
            <div className="mt-6">
                <EmptyState 
                    icon="cloud_download" 
                    title={t('tools.zrok.not_installed_title')} 
                    description={t('tools.zrok.not_installed_desc')} 
                    actionText={t('tools.zrok.install_zrok')} 
                    onAction={onInstallClick} 
                />
            </div>
        );
    }
    if (isKnownTab && status) return <ZrokSections status={status} {...sectionProps} />;
    return null;
}

interface InstallModalProps {
    readonly isOpen: boolean;
    readonly isInstalling: boolean;
    readonly progress: number;
    readonly progressText: string;
    readonly installRef: Ref<InstallZrokRef>;
    readonly onClose: () => void;
    readonly onApply: () => void;
}

function InstallZrokModal({ isOpen, isInstalling, progress, progressText, installRef, onClose, onApply }: InstallModalProps) {
    const { t } = useTranslation();
    return (
        <Modal 
            isOpen={isOpen} 
            keepMounted={isInstalling} 
            onClose={onClose} 
            title={t('tools.zrok.install_zrok')} 
            icon="cloud_download" 
            onApply={onApply} 
            applyText={isInstalling ? t('common.installing') : t('tools.zrok.install_zrok')} 
            isApplyDisabled={isInstalling}
        >
            <div className={isInstalling ? "opacity-40 pointer-events-none transition-opacity" : ""}>
                <InstallZrok ref={installRef} />
            </div>
            {isInstalling && (
                <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('common.installation_progress')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-slate-500 truncate w-3/4">{progressText || t('common.preparing')}</span>
                        <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}
        </Modal>
    );
}

export default function TunnelsMain() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { status, setStatus, projects, isLoading, fetchData } = useZrokData();
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [token, setToken] = useState('');
    const [isEnabling, setIsEnabling] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>('project');
    const [customTarget, setCustomTarget] = useState('localhost:3000');
    const [activeTab, setActiveTab] = useState<ActiveTab>('all');
    const dropdown = useProjectDropdown();
    const { isInstalling, setIsInstalling, progress, setProgress, progressText, setProgressText } = useInstallProgress(t, () => {
        setIsInstallModalOpen(false);
        fetchData();
    });
    const installRef = useRef<InstallZrokRef>(null);

    const actionContext: ZrokActionContext = { t, showToast, onSuccess: fetchData };

    const handleUninstall = async () => {
        setIsUninstalling(true);
        await performUninstall({
            t,
            showToast,
            closeModal: () => setIsUninstallModalOpen(false),
            clearStatus: () => setStatus(null),
            refresh: fetchData,
        });
        setIsUninstalling(false);
    };

    const handleInstallSubmit = async () => {
        if (!installRef.current) return;
        setIsInstalling(true);
        setProgress(0);
        setProgressText(t('common.preparing'));
        const success = await installRef.current.submit();
        if (success) {
            setIsInstallModalOpen(false);
            fetchData();
        } else {
            setIsInstalling(false);
        }
    };

    const handleEnable = async () => {
        if (!token.trim()) return;
        setIsEnabling(true);
        await runZrokAction(() => window.pywebview?.api?.enable_zrok(token.trim()), actionContext);
        setIsEnabling(false);
    };

    const handleDisable = () => runZrokAction(() => window.pywebview?.api?.disable_zrok(), actionContext);

    const handleStartShare = async () => {
        const target = pickShareTarget(shareMode, selectedProject, customTarget);
        if (!target) return;
        setIsStarting(true);
        await runZrokAction(() => window.pywebview?.api?.start_zrok_share(target), actionContext);
        setIsStarting(false);
    };

    const handleStopShare = (shareId: string) => runZrokAction(() => window.pywebview?.api?.stop_zrok_share(shareId), actionContext);

    const openInstallModal = () => setIsInstallModalOpen(true);

    return (
        <div className="flex flex-col w-full">
            <BackgroundProgressWidget isOpen={isInstalling && !isInstallModalOpen} progressText={progressText} progress={progress} onRestore={openInstallModal} />
            
            <PageHeader 
                icon="router" 
                title={t('tools.zrok.title')} 
                subtitle={t('tools.zrok.subtitle')} 
                actions={<InstallHeaderButton installed={status?.installed} isLoading={isLoading} onClick={openInstallModal} />}
            />

            <div className="flex gap-4 border-b dark:border-slate-800 mb-6 px-1">
                <TabButton active={activeTab === 'all'} label={t('tools.zrok.tab_all')} onClick={() => setActiveTab('all')} />
                <TabButton active={activeTab === 'zrok'} label={t('tools.zrok.tab_zrok')} onClick={() => setActiveTab('zrok')} />
            </div>

            <TunnelsBody
                status={status}
                isLoading={isLoading}
                activeTab={activeTab}
                projects={projects}
                onInstallClick={openInstallModal}
                onUninstall={() => setIsUninstallModalOpen(true)}
                onStopShare={handleStopShare}
                account={{ token, isEnabling, onTokenChange: setToken, onEnable: handleEnable, onDisable: handleDisable }}
                share={{
                    shareMode,
                    selectedProject,
                    customTarget,
                    isStarting,
                    dropdown,
                    onSelectProject: (id: string) => {
                        setSelectedProject(id);
                        dropdown.setIsDropdownOpen(false);
                    },
                    onCustomTargetChange: setCustomTarget,
                    onShareModeChange: setShareMode,
                    onStartShare: handleStartShare,
                }}
            />

            <InstallZrokModal
                isOpen={isInstallModalOpen}
                isInstalling={isInstalling}
                progress={progress}
                progressText={progressText}
                installRef={installRef}
                onClose={() => setIsInstallModalOpen(false)}
                onApply={handleInstallSubmit}
            />

            <Modal
                isOpen={isUninstallModalOpen}
                onClose={() => setIsUninstallModalOpen(false)}
                title={t('tools.zrok.uninstall_confirm_title')}
                icon="delete"
                onApply={handleUninstall}
                applyText={isUninstalling ? t('common.uninstall') + '...' : t('common.uninstall')}
                isDestructive={true}
                isApplyDisabled={isUninstalling}
            >
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('tools.zrok.uninstall_confirm_desc')}
                </p>
            </Modal>
        </div>
    );
}
