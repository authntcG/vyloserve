import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import Modal from '../../../components/Modal';
import ToggleSwitch from '../../../components/ToggleSwitch';
import SkeletonCard from '../../../components/skeleton/SkeletonCard';
import Button from '../../../components/Button';
import InfoBox from '../../../components/InfoBox';
import FilterChips, { type FilterChipItem } from '../../../components/FilterChips';
import Select, { type SelectOption } from '../../../components/Select';
import { useGitLab, type GitLabStatusData, type GitLabIssueItem, type GitLabProjectItem } from '../../../context/GitLabContext';
import { useToast } from '../../../context/ToastContext';
import GitLabAccountModal from './GitLabAccountModal';

interface GitLabIntegrationTabProps {
    readonly onStatusLoaded?: (status: GitLabStatusData) => void;
}

const getCardStatus = (status: GitLabStatusData, t: TFunction): string => {
    if (status.is_external) return t('tools.gitlab.external', 'System PATH');
    if (status.in_path) return t('tools.gitlab.path_active', 'PATH Active');
    return t('tools.gitlab.isolated', 'Isolated');
};

interface GitLabIssuesContentProps {
    readonly vpnBlocked: boolean;
    readonly vpnHost: string;
    readonly isAuthenticated: boolean;
    readonly issues: GitLabIssueItem[];
    readonly isLoading: boolean;
    readonly onRetry: () => void;
}

function GitLabIssuesContent({
    vpnBlocked,
    vpnHost,
    isAuthenticated,
    issues,
    isLoading,
    onRetry,
}: GitLabIssuesContentProps) {
    const { t } = useTranslation();

    if (vpnBlocked) {
        return (
            <InfoBox tone="warning" icon="vpn_lock" title={t('tools.git.vpn_unreachable_title')}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="leading-relaxed">
                        {t('tools.git.vpn_unreachable_desc', { host: vpnHost })}
                    </p>
                    <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry} disabled={isLoading}>
                        {t('tools.git.vpn_retry_btn')}
                    </Button>
                </div>
            </InfoBox>
        );
    }

    if (!isAuthenticated) {
        return (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                {t('tools.gitlab.connect_to_view_issues', 'Connect your GitLab account to view recent issues in this repository.')}
            </p>
        );
    }

    if (issues.length === 0) {
        return (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                {t('tools.gitlab.no_issues')}
            </p>
        );
    }

    return (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {issues.map((issue, index) => (
                <div key={`${issue.id}-${index}`} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                            #{issue.id}
                        </span>
                        <span className="text-xs text-slate-800 dark:text-slate-200 truncate">
                            {issue.title}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface GitLabProjectsContentProps {
    readonly isLoading: boolean;
    readonly projects: GitLabProjectItem[];
    readonly onOpenInBrowser: (url: string) => void;
    readonly onCopyUrl: (url: string) => void;
}

function GitLabProjectsContent({
    isLoading,
    projects,
    onOpenInBrowser,
    onCopyUrl,
}: GitLabProjectsContentProps) {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
                <span className="text-xs">{t('common.loading', 'Loading...')}</span>
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                <span className="material-symbols-outlined text-[32px] opacity-40 select-none">folder_open</span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.gitlab.no_projects')}</p>
                <p className="text-xs text-slate-500 max-w-2xl mx-auto">{t('tools.gitlab.no_projects_desc')}</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((p) => (
                <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden select-none">
                            <span className="material-symbols-outlined text-[18px] leading-none">
                                {p.source === 'local' ? 'folder_open' : 'folder'}
                            </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {p.full_name}
                                </span>
                                {p.visibility === 'private' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">lock</span>
                                        {t('tools.git.visibility_private')}
                                    </span>
                                )}
                                {p.visibility === 'public' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">public</span>
                                        {t('tools.git.visibility_public')}
                                    </span>
                                )}
                                {p.visibility === 'internal' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">shield</span>
                                        {t('tools.git.visibility_internal')}
                                    </span>
                                )}
                                {p.source === 'local' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        Local
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                <span>{p.host}</span>
                                {p.default_branch && (
                                    <>
                                        <span>&bull;</span>
                                        <span>{p.default_branch}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="open_in_new"
                            onClick={() => onOpenInBrowser(p.web_url)}
                        >
                            {t('tools.git.open_repo')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            icon="content_copy"
                            onClick={() => onCopyUrl(p.http_url || p.ssh_url || p.web_url)}
                            title={t('tools.git.copy_clone_url')}
                            aria-label={t('tools.git.copy_clone_url')}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function GitLabIntegrationTab({ onStatusLoaded }: GitLabIntegrationTabProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const {
        statusData,
        isLoadingStatus,
        setIsInstallModalOpen,
        isUninstallModalOpen,
        setIsUninstallModalOpen,
        executeUninstall,
        handleTogglePath,
        updateAvailable,
        handleUpdateClick,
        accounts,
        isAccountModalOpen,
        setIsAccountModalOpen,
        editingAccount,
        setEditingAccount,
        handleRemoveAccount,
        handleSetDefaultAccount,
        issues,
        isLoadingIssues,
        issuesVpnBlocked,
        issuesVpnHost,
        fetchRecentIssues,
        projects,
        isLoadingProjects,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        setSelectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
        isProcessing,
    } = useGitLab();

    const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'public' | 'internal'>('all');

    useEffect(() => {
        onStatusLoaded?.(statusData);
    }, [statusData, onStatusLoaded]);

    const handleCopyUrl = (url: string) => {
        if (!url) return;
        navigator.clipboard.writeText(url);
        showToast(t('tools.git.copied'), 'success');
    };

    const accountOptions: ReadonlyArray<SelectOption<string>> = useMemo(() => {
        return accounts.map((acc) => ({
            value: acc.id,
            label: `@${acc.username} (${acc.host})`,
            sublabel: acc.is_default ? t('tools.gitlab.default_badge') : undefined,
        }));
    }, [accounts, t]);

    const filteredProjects = useMemo(() => {
        if (visibilityFilter === 'all') return projects;
        return projects.filter((p) => p.visibility === visibilityFilter);
    }, [projects, visibilityFilter]);

    const visibilityChips: ReadonlyArray<FilterChipItem<'all' | 'private' | 'public' | 'internal'>> = useMemo(() => {
        const counts = {
            all: projects.length,
            private: projects.filter((p) => p.visibility === 'private').length,
            public: projects.filter((p) => p.visibility === 'public').length,
            internal: projects.filter((p) => p.visibility === 'internal').length,
        };
        return [
            { id: 'all', label: t('tools.gitlab.filter_all'), count: counts.all },
            { id: 'private', label: t('tools.gitlab.filter_private'), count: counts.private, icon: 'lock' },
            { id: 'public', label: t('tools.gitlab.filter_public'), count: counts.public, icon: 'public' },
            { id: 'internal', label: t('tools.gitlab.filter_internal'), count: counts.internal, icon: 'shield' },
        ];
    }, [projects, t]);

    // 1. Loading State (Golden Standard)
    if (isLoadingStatus) {
        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 w-full min-w-0" data-testid="gitlab-tab-loading">
                <SkeletonCard gridCols="grid-cols-1" />
                <SkeletonCard gridCols="grid-cols-1" />
            </div>
        );
    }

    // 2. Empty State: Not Installed (Golden Standard)
    if (!statusData.installed && !statusData.is_external) {
        return (
            <div className="mt-6" data-testid="gitlab-tab-empty">
                <EmptyState
                    icon="terminal"
                    title={t('tools.gitlab.not_installed_title')}
                    description={t('tools.gitlab.not_installed_desc')}
                    actionText={t('tools.gitlab.install_cli')}
                    onAction={() => setIsInstallModalOpen(true)}
                />
            </div>
        );
    }

    // 3. Installed State (Standard Card Grid)
    const cardStatus = getCardStatus(statusData, t);

    return (
        <div className="flex flex-col gap-6 mt-6 w-full min-w-0" data-testid="gitlab-tab-installed">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full min-w-0">
                {/* Card 1: GitLabCoreSystemCard */}
                <Card
                    title={t('tools.gitlab.cli_card_title')}
                    status={updateAvailable ? null : cardStatus}
                    updateVersion={updateAvailable?.version_text || null}
                    gridCols="grid-cols-1 md:grid-cols-2"
                    dropdownActions={
                        !statusData.is_external ? (
                            <>
                                {updateAvailable && (
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateClick(updateAvailable)}
                                        disabled={isProcessing}
                                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                        <span className="truncate">{t('ui.update.update_to_target', { version: updateAvailable.version_text })}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsUninstallModalOpen(true)}
                                    disabled={isProcessing}
                                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                                    <span className="truncate">{t('tools.gitlab.uninstall_cli')}</span>
                                </button>
                            </>
                        ) : null
                    }
                >
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.version')}</span>
                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">
                            v{statusData.version || 'unknown'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.architecture')}</span>
                        <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">
                            {statusData.is_external ? t('tools.gitlab.external') : t('tools.git.arch_portable')}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 col-span-1 md:col-span-2 w-full min-w-0 mt-1">
                        <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.system_path_binary')}</span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate" title={statusData.path || ''}>
                            {statusData.path || '-'}
                        </span>
                    </div>

                    {/* PATH Toggle */}
                    <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className={`text-sm font-semibold truncate ${statusData.is_external ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {t('tools.gitlab.register_path')}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">
                                {statusData.is_external ? t('tools.gitlab.external_locked') : t('tools.gitlab.register_path_desc')}
                            </span>
                        </div>
                        <div className="shrink-0 ml-4">
                            <ToggleSwitch
                                checked={statusData.is_external ? false : Boolean(statusData.in_path)}
                                onChange={handleTogglePath}
                                disabled={statusData.is_external || isProcessing}
                                label={t('tools.gitlab.register_path')}
                            />
                        </div>
                    </div>

                    {statusData.is_external && (
                        <div data-testid="gitlab-external-alert" className="col-span-1 md:col-span-2 mt-2">
                            <InfoBox
                                tone="warning"
                                icon="warning"
                                title={`${t('tools.gitlab.external_warning_title')} (v${statusData.version})`}
                            >
                                <p className="leading-relaxed">
                                    {t('tools.gitlab.external_warning_desc', { version: statusData.version, path: statusData.path })}
                                </p>
                            </InfoBox>
                        </div>
                    )}
                </Card>

                {/* Card 2: GitLabRecentIssuesCard */}
                <Card
                    title={t('tools.gitlab.recent_issues')}
                    status={statusData.authenticated && issues.length > 0 ? `${issues.length} Issues` : null}
                    gridCols="grid-cols-1"
                    dropdownActions={
                        statusData.authenticated ? (
                            <button
                                type="button"
                                onClick={fetchRecentIssues}
                                disabled={isLoadingIssues}
                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">refresh</span>
                                <span className="truncate">{t('tools.gitlab.refresh_issues')}</span>
                            </button>
                        ) : null
                    }
                >
                    <GitLabIssuesContent
                        vpnBlocked={issuesVpnBlocked}
                        vpnHost={issuesVpnHost}
                        isAuthenticated={Boolean(statusData.authenticated)}
                        issues={issues}
                        isLoading={isLoadingIssues}
                        onRetry={fetchRecentIssues}
                    />
                </Card>
            </div>

            {/* Card 3: Connected GitLab Accounts Directory */}
            <Card
                title={t('tools.gitlab.accounts_card_title')}
                status={accounts.length > 0 ? `${accounts.length} Accounts` : null}
                gridCols="grid-cols-1"
                dropdownActions={
                    <button
                        type="button"
                        onClick={() => {
                            setEditingAccount(null);
                            setIsAccountModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors font-medium"
                    >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        <span className="truncate">{t('tools.gitlab.add_account')}</span>
                    </button>
                }
            >
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('tools.gitlab.accounts_card_desc')}
                        </p>
                        <Button
                            variant="primary"
                            size="sm"
                            icon="add"
                            onClick={() => {
                                setEditingAccount(null);
                                setIsAccountModalOpen(true);
                            }}
                        >
                            {t('tools.gitlab.add_account')}
                        </Button>
                    </div>

                    {accounts.length === 0 ? (
                        <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                            <span className="material-symbols-outlined text-[32px] opacity-40">hub</span>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.gitlab.no_accounts')}</p>
                            <p className="text-xs text-slate-500 max-w-2xl mx-auto">{t('tools.gitlab.account_not_connected_desc')}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {accounts.map((acc) => (
                                <div key={acc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="material-symbols-outlined text-[18px]">
                                                {acc.git_protocol === 'ssh' ? 'key' : 'account_tree'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                    @{acc.username}
                                                </span>
                                                {acc.git_name && acc.git_name !== acc.username && (
                                                    <span className="text-xs text-slate-500 truncate">
                                                        ({acc.git_name})
                                                    </span>
                                                )}
                                                {acc.is_default && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        {t('tools.gitlab.default_badge')}
                                                    </span>
                                                )}
                                                {acc.is_push_active && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                        {t('tools.gitlab.active_push_badge')}
                                                    </span>
                                                )}
                                                {acc.requires_vpn && (
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                                            acc.vpn_reachable
                                                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">vpn_lock</span>
                                                        {acc.vpn_reachable ? t('tools.git.vpn_badge') : t('tools.git.vpn_disconnected_badge')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                                <span>{acc.host}</span>
                                                {acc.git_email && (
                                                    <>
                                                        <span>&bull;</span>
                                                        <span className="truncate">{acc.git_email}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {acc.git_protocol}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {acc.auth_type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                        {!acc.is_default && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleSetDefaultAccount(acc.id, true)}
                                                disabled={isProcessing}
                                                title={t('tools.gitlab.set_default')}
                                            >
                                                {t('tools.gitlab.set_default')}
                                            </Button>
                                        )}
                                        {acc.is_default && !acc.is_push_active && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleSetDefaultAccount(acc.id, true)}
                                                disabled={isProcessing}
                                                title={t('tools.gitlab.sync_push_identity')}
                                            >
                                                {t('tools.gitlab.sync_push_identity')}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            icon="edit"
                                            onClick={() => {
                                                setEditingAccount(acc);
                                                setIsAccountModalOpen(true);
                                            }}
                                            disabled={isProcessing}
                                            title={t('tools.gitlab.edit_account')}
                                            aria-label={t('tools.gitlab.edit_account')}
                                        />
                                        <Button
                                            variant="danger-ghost"
                                            size="icon"
                                            icon="delete"
                                            onClick={() => handleRemoveAccount(acc.id)}
                                            disabled={isProcessing}
                                            title={t('tools.gitlab.delete_account')}
                                            aria-label={t('tools.gitlab.delete_account')}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Card 4: Assigned Projects & Repositories Card */}
            <Card
                title={t('tools.gitlab.projects_card_title')}
                status={projects.length > 0 ? `${filteredProjects.length} Projects` : null}
                gridCols="grid-cols-1"
                dropdownActions={
                    <button
                        type="button"
                        onClick={() => fetchProjects(selectedAccountId)}
                        disabled={isLoadingProjects}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">refresh</span>
                        <span className="truncate">{t('tools.gitlab.refresh_projects')}</span>
                    </button>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('tools.gitlab.projects_card_desc')}
                        </p>
                        {accounts.length > 1 && (
                            <div className="w-full sm:w-64 shrink-0">
                                <Select
                                    size="sm"
                                    options={accountOptions}
                                    value={selectedAccountId || (accounts[0]?.id ?? null)}
                                    onChange={(newId) => {
                                        setSelectedAccountId(newId);
                                        fetchProjects(newId);
                                    }}
                                    searchable={false}
                                />
                            </div>
                        )}
                    </div>

                    {projectsVpnBlocked && (
                        <InfoBox
                            tone="warning"
                            icon="vpn_lock"
                            title={t('tools.git.vpn_unreachable_title')}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <p className="leading-relaxed">
                                    {t('tools.git.vpn_unreachable_desc', { host: projectsVpnHost })}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="refresh"
                                    onClick={() => fetchProjects(selectedAccountId)}
                                    disabled={isLoadingProjects}
                                >
                                    {t('tools.git.vpn_retry_btn')}
                                </Button>
                            </div>
                        </InfoBox>
                    )}

                    <FilterChips
                        items={visibilityChips}
                        selectedId={visibilityFilter}
                        onChange={setVisibilityFilter}
                        ariaLabel="Filter GitLab projects by visibility"
                    />

                    <GitLabProjectsContent
                        isLoading={isLoadingProjects}
                        projects={filteredProjects}
                        onOpenInBrowser={handleOpenProjectInBrowser}
                        onCopyUrl={handleCopyUrl}
                    />
                </div>
            </Card>

            {/* GitLab Account Multi-Mode Modal */}
            <GitLabAccountModal
                isOpen={isAccountModalOpen}
                onClose={() => {
                    setIsAccountModalOpen(false);
                    setEditingAccount(null);
                }}
                editingAccount={editingAccount}
            />

            {/* Uninstall CLI Confirmation Modal */}
            <Modal
                isOpen={isUninstallModalOpen}
                onClose={() => setIsUninstallModalOpen(false)}
                title={t('tools.gitlab.uninstall_title')}
                icon="delete"
                isDanger
                onApply={executeUninstall}
                applyText={t('tools.git.yes_uninstall')}
            >
                <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                        {t('tools.gitlab.uninstall_confirm')}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-l-2 border-amber-500 pl-2">
                        {t('tools.git.uninstall_warning')}
                    </p>
                </div>
            </Modal>
        </div>
    );
}
