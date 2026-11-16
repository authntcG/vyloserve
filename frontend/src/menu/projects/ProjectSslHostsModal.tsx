import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { useToast } from '../../context/ToastContext';

export interface ProjectSslHostsModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
}

export interface SslHostEntry {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly target_ip: string;
    readonly is_mapped: boolean;
}

interface SslHostsData {
    ca?: {
        installed: boolean;
        cert_exists: boolean;
        cert_path: string;
        name: string;
    };
    hosts?: {
        path: string;
        exists: boolean;
        is_writable: boolean;
        entries: Array<SslHostEntry>;
    };
}

interface SslHostsTableBodyProps {
    readonly isLoading: boolean;
    readonly entries: readonly SslHostEntry[];
}

function SslHostsTableBody({ isLoading, entries }: SslHostsTableBodyProps) {
    const { t } = useTranslation();
    if (isLoading) {
        return (
            <>
                {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`loading-row-${i}`} className="animate-pulse">
                        <td className="py-3 px-3.5"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-32" /></td>
                        <td className="py-3 px-3.5"><div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                        <td className="py-3 px-3.5 text-right"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-16 ml-auto" /></td>
                    </tr>
                ))}
            </>
        );
    }

    if (entries.length === 0) {
        return (
            <tr>
                <td colSpan={3} className="py-8 text-center text-slate-400">
                    {t('projects.ssl_hosts.no_project_domains', 'No project domains configured yet.')}
                </td>
            </tr>
        );
    }

    return (
        <>
            {entries.map((entry) => (
                <tr
                    key={entry.id || entry.domain}
                    className={`transition-colors ${
                        entry.is_mapped
                            ? 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
                            : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                    }`}
                >
                    <td className="py-2.5 px-3.5">
                        <div className="flex flex-col">
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {entry.domain}
                            </span>
                            {entry.name && (
                                <span className="text-[11px] text-slate-400">
                                    {entry.name}
                                </span>
                            )}
                        </div>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                        {entry.target_ip || '127.0.0.1'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                entry.is_mapped
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${entry.is_mapped ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {entry.is_mapped
                                ? t('projects.ssl_hosts.hosts_status_mapped', 'Mapped')
                                : t('projects.ssl_hosts.hosts_status_unmapped', 'Not Mapped')}
                        </span>
                    </td>
                </tr>
            ))}
        </>
    );
}

export default function ProjectSslHostsModal({ isOpen, onClose }: ProjectSslHostsModalProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const tRef = useRef(t);
    tRef.current = t;
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    const [isLoading, setIsLoading] = useState(false);
    const [isReinstallingCa, setIsReinstallingCa] = useState(false);
    const [isSyncingHosts, setIsSyncingHosts] = useState(false);
    const [overview, setOverview] = useState<SslHostsData | null>(null);

    const fetchOverview = useCallback(async () => {
        setIsLoading(true);
        try {
            const api = (window as any).pywebview?.api;
            if (!api?.get_ssl_hosts_overview) return;
            const res = await api.get_ssl_hosts_overview();
            if (res?.status === 'success') {
                setOverview(res);
            }
        } catch {
            showToastRef.current(tRef.current('projects.fetch_projects_error', 'Failed to load SSL & hosts data.'), 'error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchOverview();
        }
    }, [isOpen, fetchOverview]);

    const handleTrustCa = async () => {
        setIsReinstallingCa(true);
        try {
            const api = (window as any).pywebview?.api;
            if (!api?.reinstall_root_ca) return;
            const res = await api.reinstall_root_ca();
            const isSuccess = res?.status === 'success';
            showToast(t(res?.message || (isSuccess ? 'backend.ssl.ca_trusted_success' : 'backend.ssl.ca_uac_denied'), res?.args || {}) as string, isSuccess ? 'success' : 'error');
            await fetchOverview();
        } catch (e: any) {
            showToast(e?.message || 'Failed to install Root CA', 'error');
        } finally {
            setIsReinstallingCa(false);
        }
    };

    const handleSyncHosts = async () => {
        setIsSyncingHosts(true);
        try {
            const api = (window as any).pywebview?.api;
            if (!api?.sync_all_hosts) return;
            const res = await api.sync_all_hosts();
            const isSuccess = res?.status === 'success';
            showToast(t(res?.message || 'backend.project.hosts_all_synced', res?.args || {}) as string, isSuccess ? 'success' : 'error');
            await fetchOverview();
        } catch (e: any) {
            showToast(e?.message || 'Failed to sync hosts file', 'error');
        } finally {
            setIsSyncingHosts(false);
        }
    };

    const handleCopyPath = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'info');
    };

    const isCaInstalled = Boolean(overview?.ca?.installed);
    const entries = overview?.hosts?.entries || [];
    const mappedCount = entries.filter((e) => e.is_mapped).length;
    const unmappedCount = entries.length - mappedCount;
    const allHostsMapped = entries.length > 0 && unmappedCount === 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            icon="verified_user"
            title={t('projects.ssl_hosts.title', 'SSL Root CA & Hosts Inspector')}
            maxWidthClass="max-w-3xl"
            customFooter={
                <div className="flex items-center justify-between w-full px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="refresh"
                        onClick={fetchOverview}
                        loading={isLoading}
                    >
                        {t('common.refresh', 'Refresh')}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        {t('common.close', 'Close')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
                    {t('projects.ssl_hosts.desc', 'Inspect and manage your local SSL Root Certificate and Windows Hosts domain mappings for development.')}
                </p>
                {/* Root CA Section */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[20px]">verified_user</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {overview?.ca?.name || t('projects.ssl_hosts.root_ca_title', 'VyloServe Local Root CA')}
                                    </h3>
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                            isCaInstalled
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isCaInstalled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        {isCaInstalled
                                            ? t('projects.ssl_hosts.root_ca_trusted', 'Trusted by OS')
                                            : t('projects.ssl_hosts.root_ca_untrusted', 'Not Trusted')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {t('projects.ssl_hosts.root_ca_desc', 'The trusted root certificate authority used to sign HTTPS certificates for all .test domains.')}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant={isCaInstalled ? 'secondary' : 'primary'}
                            size="sm"
                            icon="lock_reset"
                            loading={isReinstallingCa}
                            onClick={handleTrustCa}
                            className="shrink-0 self-start sm:self-center"
                        >
                            {t('projects.ssl_hosts.btn_trust_ca', 'Trust / Re-install CA')}
                        </Button>
                    </div>

                    {overview?.ca?.cert_path && (
                        <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium shrink-0">{t('projects.ssl_hosts.ca_cert_path', 'Certificate Path')}:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 truncate select-all" title={overview.ca.cert_path}>
                                    {overview.ca.cert_path}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopyPath(overview.ca!.cert_path)}
                                title={t('projects.ssl_hosts.copy_path', 'Copy path')}
                                aria-label={t('projects.ssl_hosts.copy_path', 'Copy path')}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors shrink-0 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Hosts Domain Mappings Section */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-slate-400">dns</span>
                                    {t('projects.ssl_hosts.hosts_inspector_title', 'Local Hosts Domain Mappings')}
                                </h3>
                                {entries.length > 0 && (
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                            allHostsMapped
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${allHostsMapped ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        {allHostsMapped
                                            ? t('projects.ssl_hosts.all_synced', 'All domains mapped')
                                            : t('projects.ssl_hosts.needs_sync', { count: unmappedCount, defaultValue: `${unmappedCount} unmapped domain(s)` })}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {t('projects.ssl_hosts.hosts_inspector_desc', 'Domains defined in projects mapped to 127.0.0.1 in the system hosts file.')}
                            </p>
                        </div>
                        <Button
                            variant={unmappedCount > 0 ? 'primary' : 'secondary'}
                            size="sm"
                            icon="sync"
                            loading={isSyncingHosts}
                            onClick={handleSyncHosts}
                            className="shrink-0 self-start sm:self-center"
                        >
                            {t('projects.ssl_hosts.btn_sync_all_hosts', 'Sync All Domains to Hosts')}
                        </Button>
                    </div>

                    {overview?.hosts?.path && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 px-3 py-1.5 rounded-lg">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium shrink-0">{t('projects.ssl_hosts.hosts_path_label', 'Hosts File Path')}:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 select-all truncate" title={overview.hosts.path}>
                                    {overview.hosts.path}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopyPath(overview.hosts!.path)}
                                title={t('projects.ssl_hosts.copy_path', 'Copy path')}
                                aria-label={t('projects.ssl_hosts.copy_path', 'Copy path')}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors shrink-0 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                            </button>
                        </div>
                    )}

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium backdrop-blur-xs">
                                    <th className="py-2.5 px-3.5">{t('projects.ssl_hosts.hosts_domain_col', 'Project & Domain')}</th>
                                    <th className="py-2.5 px-3.5">{t('projects.ssl_hosts.hosts_ip_col', 'Target IP')}</th>
                                    <th className="py-2.5 px-3.5 text-right">{t('projects.ssl_hosts.hosts_status_col', 'Mapping Status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                                <SslHostsTableBody isLoading={isLoading} entries={entries} />
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
