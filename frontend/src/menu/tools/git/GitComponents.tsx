import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import ToggleSwitch from '../../../components/ToggleSwitch';
import FieldLabel from '../../../components/FieldLabel';
import Button from '../../../components/Button';
import InstalledBadge from '../../../components/InstalledBadge';
import InfoBox from '../../../components/InfoBox';
import FilterChips, { type FilterChipItem } from '../../../components/FilterChips';
import Select, { type SelectOption } from '../../../components/Select';
import { useGit } from '../../../context/GitContext';
import { useToast } from '../../../context/ToastContext';

export function GitInstallButton({
    installed,
    isLoading,
    isBlockedByExternal: _isBlockedByExternal,
    onClick,
    t
}: {
    readonly installed: boolean;
    readonly isLoading: boolean;
    readonly isBlockedByExternal: boolean;
    readonly onClick: () => void;
    readonly t: any;
}) {
    if (installed) {
        return <InstalledBadge />;
    }
    return (
        <Button
            variant="primary"
            icon="download"
            onClick={onClick}
            disabled={isLoading}
            className="whitespace-nowrap shrink-0 shadow-sm"
        >
            {t('tools.git.install_git')}
        </Button>
    );
}

export function GitLabInstallButton({
    installed,
    isLoading,
    onClick,
    t
}: {
    readonly installed: boolean;
    readonly isLoading: boolean;
    readonly onClick: () => void;
    readonly t: any;
}) {
    if (installed) {
        return <InstalledBadge />;
    }
    return (
        <Button
            variant="primary"
            icon="download"
            onClick={onClick}
            disabled={isLoading}
            className="whitespace-nowrap shrink-0 shadow-sm"
        >
            {t('tools.gitlab.install_cli')}
        </Button>
    );
}

export function ExternalCard({ gitData, t }: any) {
    if (!gitData.external?.exists || gitData.installed) return null;
    return (
        <div className="mt-6">
            <Card title={t('tools.git.native_os_card_title')} status={t('tools.git.native_os')} gridCols="grid-cols-1 md:grid-cols-2">
                <div className="flex flex-col gap-1 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.version')}</span>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                        {gitData.external.version}
                    </span>
                </div>
                <div className="flex flex-col gap-1 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.architecture')}</span>
                    <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">
                        {t('tools.git.native_os')}
                    </span>
                </div>
                <div className="flex flex-col gap-1 col-span-1 md:col-span-2 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.system_path_binary')}</span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate" title={gitData.external.path}>
                        {gitData.external.path}
                    </span>
                </div>
                <div className="col-span-1 md:col-span-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                    <div data-testid="external-git-warning-alert">
                        <InfoBox
                            tone="warning"
                            icon="warning"
                            title={`${t('tools.git.external_overview_title')} (v${gitData.external.version})`}
                        >
                            <div className="flex flex-col gap-1.5 min-w-0">
                                {gitData.external.path && (
                                    <span
                                        className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-950/50 px-2 py-0.5 rounded border border-amber-500/20 truncate"
                                        title={gitData.external.path}
                                    >
                                        {gitData.external.path}
                                    </span>
                                )}
                                <p className="leading-relaxed">
                                    {t('tools.git.external_overview_desc', { version: gitData.external.version, path: gitData.external.path })}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-amber-600 dark:text-amber-500 font-medium">
                                    <span className="material-symbols-outlined text-[16px] shrink-0">lock</span>
                                    <span className="leading-relaxed">{t('tools.git.external_locked')}</span>
                                </div>
                            </div>
                        </InfoBox>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export function GitCoreSystemCard() {
    const { t } = useTranslation();
    const {
        gitData,
        updateAvailable,
        handleUpdateClick,
        setIsUninstallModalOpen,
        isProcessing,
        handleTogglePath
    } = useGit();

    const getCardStatus = () => {
        if (updateAvailable) return null;
        if (gitData.external?.exists) return t('tools.git.native_os');
        return gitData.in_path ? t('tools.git.path_active') : t('tools.git.isolated');
    };

    return (
        <Card
            title={t('tools.git.core_system_title')}
            status={getCardStatus()}
            updateVersion={updateAvailable?.version_text || null}
            gridCols="grid-cols-1 md:grid-cols-2"
            dropdownActions={
                <>
                    {updateAvailable && (
                        <button
                            type="button"
                            onClick={() => handleUpdateClick(updateAvailable)}
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors"
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
                        <span className="truncate">{t('tools.git.uninstall_git')}</span>
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.version')}</span>
                <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{gitData.version}</span>
            </div>
            <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.architecture')}</span>
                <span className="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">{t('tools.git.arch_portable')}</span>
            </div>

            <div className="col-span-1 md:col-span-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 w-full min-w-0">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className={`text-sm font-semibold truncate ${gitData.external?.exists ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {t('tools.git.register_path')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words leading-relaxed">
                        {gitData.external?.exists ? t('tools.git.external_locked') : t('tools.git.register_path_desc')}
                    </span>
                </div>
                <div className="shrink-0 ml-4">
                    <ToggleSwitch
                        checked={gitData.external?.exists ? false : gitData.in_path}
                        onChange={handleTogglePath}
                        disabled={gitData.external?.exists || isProcessing}
                        label={t('tools.git.register_path')}
                    />
                </div>
            </div>

            {gitData.external?.exists && (
                <div data-testid="git-external-alert" className="col-span-1 md:col-span-2 mt-1">
                    <InfoBox
                        tone="warning"
                        icon="warning"
                        title={`${t('tools.git.external_overview_title')} (v${gitData.external.version})`}
                    >
                        <div className="flex flex-col gap-1.5 min-w-0">
                            {gitData.external.path && (
                                <span
                                    className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-950/50 px-2 py-0.5 rounded border border-amber-500/20 truncate"
                                    title={gitData.external.path}
                                >
                                    {gitData.external.path}
                                </span>
                            )}
                            <p className="leading-relaxed">
                                {t('tools.git.external_overview_desc', { version: gitData.external.version, path: gitData.external.path })}
                            </p>
                        </div>
                    </InfoBox>
                </div>
            )}
        </Card>
    );
}

export function GitGlobalConfigCard() {
    const { t } = useTranslation();
    const { configData, setConfigData, isProcessing, handleSaveConfig } = useGit();

    return (
        <Card title={t('tools.git.global_config')} status={t('tools.git.active')} gridCols="grid-cols-1">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                    <FieldLabel htmlFor="git_global_user_name_input" size="xs" tone="subtle">
                        {t('tools.git.global_user_name')} (
                        <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.name</code>)
                    </FieldLabel>
                    <input
                        id="git_global_user_name_input"
                        type="text"
                        value={configData.userName}
                        onChange={(e) => setConfigData({ ...configData, userName: e.target.value })}
                        disabled={isProcessing}
                        placeholder={t('tools.git.eg_name')}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-50"
                    />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                    <FieldLabel htmlFor="git_global_user_email_input" size="xs" tone="subtle">
                        {t('tools.git.global_email')} (
                        <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.email</code>)
                    </FieldLabel>
                    <input
                        id="git_global_user_email_input"
                        type="email"
                        value={configData.userEmail}
                        onChange={(e) => setConfigData({ ...configData, userEmail: e.target.value })}
                        disabled={isProcessing}
                        placeholder={t('tools.git.eg_email')}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-50"
                    />
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={isProcessing}
                        className="bg-slate-900 dark:bg-white hover:bg-slate-800 disabled:opacity-50 text-white dark:text-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                        {isProcessing ? t('tools.git.saving') : t('tools.git.save_config')}
                    </button>
                </div>
            </div>
        </Card>
    );
}

export function GitAccountsCard() {
    const { t } = useTranslation();
    const {
        accounts,
        setIsAccountModalOpen,
        setEditingAccount,
        handleDeleteAccount,
        handleSetDefaultAccount,
        isProcessing
    } = useGit();

    return (
        <Card
            title={t('tools.git.accounts_card_title')}
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
                    <span className="truncate">{t('tools.git.add_account')}</span>
                </button>
            }
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('tools.git.accounts_card_desc')}
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
                        {t('tools.git.add_account')}
                    </Button>
                </div>

                {accounts.length === 0 ? (
                    <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                        <span className="material-symbols-outlined text-[32px] opacity-40">manage_accounts</span>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.git.no_accounts')}</p>
                        <p className="text-xs text-slate-500 max-w-2xl mx-auto">{t('tools.git.no_accounts_desc')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {accounts.map((acc) => (
                            <div key={acc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                                        <span className="material-symbols-outlined text-[18px]">
                                            {acc.protocol === 'ssh' ? 'key' : 'code'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                {acc.label || acc.username}
                                            </span>
                                            {acc.is_default && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    {t('tools.git.default_badge')}
                                                </span>
                                            )}
                                            {acc.is_push_active && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                    {t('tools.git.active_push_badge')}
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
                                            <span>{acc.username}</span>
                                            <span>&bull;</span>
                                            <span className="truncate">{acc.email}</span>
                                            <span>&bull;</span>
                                            <span className="text-slate-400">{acc.endpoint}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                {acc.protocol}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                {acc.auth_mode}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {!acc.is_default && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleSetDefaultAccount(acc.id)}
                                            disabled={isProcessing}
                                            title={t('tools.git.set_default')}
                                        >
                                            {t('tools.git.set_default')}
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
                                        title={t('tools.git.edit_account')}
                                        aria-label={t('tools.git.edit_account')}
                                    />
                                    <Button
                                        variant="danger-ghost"
                                        size="icon"
                                        icon="delete"
                                        onClick={() => handleDeleteAccount(acc.id)}
                                        disabled={isProcessing}
                                        title={t('tools.git.delete_account')}
                                        aria-label={t('tools.git.delete_account')}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}

export function GitAssignedProjectsCard() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const {
        accounts,
        projects,
        isLoadingProjects,
        projectsAuthWarning,
        projectsVpnBlocked,
        projectsVpnHost,
        selectedAccountId,
        setSelectedAccountId,
        fetchProjects,
        handleOpenProjectInBrowser,
        setEditingAccount,
        setIsAccountModalOpen,
    } = useGit();

    const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'public' | 'internal'>('all');

    const handleCopyUrl = (url: string) => {
        if (!url) return;
        navigator.clipboard.writeText(url);
        showToast(t('tools.git.copied'), 'success');
    };

    const accountOptions: ReadonlyArray<SelectOption<string>> = useMemo(() => {
        return accounts.map((acc) => ({
            value: acc.id,
            label: `${acc.label || acc.username} (${acc.endpoint})`,
            sublabel: acc.is_default ? t('tools.git.default_badge') : undefined,
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
            { id: 'all', label: t('tools.git.filter_all'), count: counts.all },
            { id: 'private', label: t('tools.git.filter_private'), count: counts.private, icon: 'lock' },
            { id: 'public', label: t('tools.git.filter_public'), count: counts.public, icon: 'public' },
            { id: 'internal', label: t('tools.git.filter_internal'), count: counts.internal, icon: 'shield' },
        ];
    }, [projects, t]);

    return (
        <Card
            title={t('tools.git.projects_card_title')}
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
                    <span className="truncate">{t('tools.git.refresh_projects')}</span>
                </button>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('tools.git.projects_card_desc')}
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

                {projectsAuthWarning && (
                    <InfoBox
                        tone="warning"
                        icon="warning"
                        title={t('tools.git.github_auth_warning_title')}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <p className="leading-relaxed">
                                {t('tools.git.github_auth_warning_desc')}
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="key"
                                onClick={() => {
                                    const activeAcc = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
                                    setEditingAccount(activeAcc);
                                    setIsAccountModalOpen(true);
                                }}
                            >
                                {t('tools.git.update_token_btn')}
                            </Button>
                        </div>
                    </InfoBox>
                )}

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
                    ariaLabel="Filter Git repositories by visibility"
                />

                {isLoadingProjects && (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
                        <span className="text-xs">{t('common.loading', 'Loading...')}</span>
                    </div>
                )}

                {!isLoadingProjects && filteredProjects.length === 0 && (
                    <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                        <span className="material-symbols-outlined text-[32px] opacity-40 select-none">folder_open</span>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.git.no_projects')}</p>
                        <p className="text-xs text-slate-500 max-w-2xl mx-auto">{t('tools.git.no_projects_desc')}</p>
                    </div>
                )}

                {!isLoadingProjects && filteredProjects.length > 0 && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredProjects.map((p) => (
                            <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 mt-0.5 overflow-hidden select-none">
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
                                        onClick={() => handleOpenProjectInBrowser(p.web_url)}
                                    >
                                        {t('tools.git.open_repo')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        icon="content_copy"
                                        onClick={() => handleCopyUrl(p.http_url || p.ssh_url || p.web_url)}
                                        title={t('tools.git.copy_clone_url')}
                                        aria-label={t('tools.git.copy_clone_url')}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}
