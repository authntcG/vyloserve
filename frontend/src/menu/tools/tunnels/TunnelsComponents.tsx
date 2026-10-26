import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import SkeletonCard from '../../../components/skeleton/SkeletonCard';
import Button from '../../../components/Button';
import InstalledBadge from '../../../components/InstalledBadge';
import Select from '../../../components/Select';
import {
    type ShareMode,
    type ZrokStatus,
    pickShareTarget
} from '../../../context/TunnelsContext';

export function TunnelOverviewCard({
    title,
    description,
    icon,
    installed,
    notInstalledText,
    onManage,
    onUninstall,
    updateAvailable,
    onUpdate
}: {
    readonly title: string;
    readonly description: string;
    readonly icon: string;
    readonly installed: boolean;
    readonly notInstalledText: string;
    readonly onManage: () => void;
    readonly onUninstall: () => void;
    readonly updateAvailable?: string | null;
    readonly onUpdate?: () => void;
}) {
    const { t } = useTranslation();
    const getCardStatus = () => {
        if (updateAvailable) return null;
        return installed ? t('runtimes.installed') : notInstalledText;
    };

    return (
        <Card
            title={title}
            status={getCardStatus()}
            updateVersion={updateAvailable || null}
            gridCols="grid-cols-1"
            dropdownActions={
                installed ? (
                    <>
                        {updateAvailable && onUpdate && (
                            <button
                                type="button"
                                onClick={onUpdate}
                                className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                                <span className="truncate">{t('ui.update.update_to_target', { version: updateAvailable })}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onUninstall}
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                            <span className="truncate">{t('common.uninstall')}</span>
                        </button>
                    </>
                ) : undefined
            }
        >
            <div className="flex justify-between items-center w-full mt-2">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[32px] text-slate-400">{icon}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{description}</span>
                </div>
                {installed && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onManage}
                    >
                        {t('common.manage')}
                    </Button>
                )}
            </div>
        </Card>
    );
}

export function InstallHeaderButton({
    installed,
    isLoading,
    label,
    onClick
}: {
    readonly installed?: boolean;
    readonly isLoading: boolean;
    readonly label: string;
    readonly onClick: () => void;
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
            {label}
        </Button>
    );
}

export function TabButton({
    active,
    label,
    onClick
}: {
    readonly active: boolean;
    readonly label: string;
    readonly onClick: () => void;
}) {
    const stateClass = active ? 'border-primary text-primary' : 'border-transparent text-slate-500';
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${stateClass}`}
        >
            {label}
        </button>
    );
}

export function EngineCard({
    title,
    uninstallText,
    version,
    onUninstall,
    updateAvailable,
    onUpdate
}: {
    readonly title: string;
    readonly uninstallText: string;
    readonly version?: string;
    readonly onUninstall: () => void;
    readonly updateAvailable?: string | null;
    readonly onUpdate?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Card
            title={title}
            status={updateAvailable ? null : t('runtimes.installed')}
            updateVersion={updateAvailable || null}
            gridCols="grid-cols-1"
            dropdownActions={
                <>
                    {updateAvailable && onUpdate && (
                        <button
                            type="button"
                            onClick={onUpdate}
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-primary hover:bg-primary/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">upgrade</span>
                            <span className="truncate">{t('ui.update.update_to_target', { version: updateAvailable })}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onUninstall}
                        className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">delete</span>
                        <span className="truncate">{uninstallText}</span>
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-xs font-medium text-slate-500 uppercase">{t('runtimes.installed_version')}</span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                    {version || t('common.unknown')}
                </span>
            </div>
        </Card>
    );
}

export interface EnableFormProps {
    readonly token: string;
    readonly isEnabling: boolean;
    readonly onTokenChange: (value: string) => void;
    readonly onEnable: () => void;
}

export function ZrokEnableForm({ token, isEnabling, onTokenChange, onEnable }: EnableFormProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">{t('tools.zrok.enable_account')}</h3>
            <p className="text-sm text-slate-500 mb-4">{t('tools.zrok.enable_desc')}</p>
            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="zrok-token" className="sr-only">{t('tools.zrok.token_label')}</label>
                    <input
                        id="zrok-token"
                        type="text"
                        value={token}
                        onChange={(e) => onTokenChange(e.target.value)}
                        placeholder={t('tools.zrok.token_placeholder')}
                        className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-slate-700 dark:text-slate-200 bg-white"
                    />
                </div>
                <Button
                    variant="primary"
                    onClick={onEnable}
                    disabled={isEnabling || !token.trim()}
                    loading={isEnabling}
                >
                    {t('common.enable')}
                </Button>
            </div>
        </div>
    );
}

export function ZrokEnabledInfo({ envStatus }: { readonly envStatus?: string }) {
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

export interface AccountCardProps extends EnableFormProps {
    readonly status: ZrokStatus;
    readonly onDisable: () => void;
}

export function ZrokAccountCard({ status, token, isEnabling, onTokenChange, onEnable, onDisable }: AccountCardProps) {
    const { t } = useTranslation();
    return (
        <Card
            title={t('tools.zrok.account_card_title')}
            gridCols="grid-cols-1"
            footerActions={
                status.enabled ? (
                    <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={onDisable}
                    >
                        {t('tools.zrok.disable_account')}
                    </Button>
                ) : null
            }
        >
            {status.enabled ? (
                <ZrokEnabledInfo envStatus={status.env_status} />
            ) : (
                <ZrokEnableForm token={token} isEnabling={isEnabling} onTokenChange={onTokenChange} onEnable={onEnable} />
            )}
        </Card>
    );
}

export function ShareModeButton({
    active,
    disabled,
    label,
    onClick
}: {
    readonly active: boolean;
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick: () => void;
}) {
    const stateClass = active
        ? 'bg-white dark:bg-slate-700 shadow-xs text-primary font-semibold'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400';
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex-1 py-2 text-sm rounded-md transition-all duration-200 outline-none ${stateClass}`}
        >
            {label}
        </button>
    );
}

export interface ShareTargetFieldProps {
    readonly shareMode: ShareMode;
    readonly projects: any[];
    readonly selectedProject: string;
    readonly customTarget: string;
    readonly isStarting: boolean;
    readonly dropdown?: any;
    readonly onSelectProject: (id: string) => void;
    readonly onCustomTargetChange: (value: string) => void;
}

export function ShareTargetField({
    shareMode,
    projects,
    selectedProject,
    customTarget,
    isStarting,
    onSelectProject,
    onCustomTargetChange
}: ShareTargetFieldProps) {
    const { t } = useTranslation();
    const isProjectMode = shareMode === 'project';
    const projectOptions = useMemo(() => projects.map((p: any) => ({
        value: p.id,
        label: p.domain,
        sublabel: p.name
    })), [projects]);

    return (
        <div className="flex-1 flex flex-col gap-2">
            <label
                htmlFor={isProjectMode ? 'project-select' : 'custom-target'}
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
                {isProjectMode ? t('tools.zrok.select_project') : t('tools.zrok.custom_target')}
            </label>
            {isProjectMode ? (
                <Select
                    id="project-select"
                    options={projectOptions}
                    value={selectedProject || null}
                    onChange={onSelectProject}
                    disabled={isStarting || projects.length === 0}
                    placeholder={projects.length === 0 ? t('tools.zrok.no_projects') : t('tools.zrok.select_project')}
                    searchable={true}
                    searchPlaceholder={t('common.search')}
                    emptyText={t('common.no_results')}
                    filterFn={(option, query) => {
                        const q = query.toLowerCase();
                        return option.label.toLowerCase().includes(q) || (option.sublabel?.toLowerCase().includes(q) ?? false);
                    }}
                />
            ) : (
                <input
                    id="custom-target"
                    type="text"
                    value={customTarget}
                    onChange={(e) => onCustomTargetChange(e.target.value)}
                    placeholder="localhost:3000"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-slate-700 dark:text-slate-200 bg-white"
                />
            )}
        </div>
    );
}

export interface ShareCardProps extends ShareTargetFieldProps {
    readonly onShareModeChange: (mode: ShareMode) => void;
    readonly onStartShare: () => void;
}

export function ShareCard(props: ShareCardProps) {
    const { t } = useTranslation();
    const { shareMode, selectedProject, customTarget, isStarting, onShareModeChange, onStartShare } = props;
    const hasTarget = Boolean(pickShareTarget(shareMode, selectedProject, customTarget));
    return (
        <Card title={t('tools.zrok.share_card_title')} gridCols="grid-cols-1">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg mb-2">
                <ShareModeButton
                    active={shareMode === 'project'}
                    disabled={isStarting}
                    label={t('tools.zrok.mode_project')}
                    onClick={() => onShareModeChange('project')}
                />
                <ShareModeButton
                    active={shareMode === 'custom'}
                    disabled={isStarting}
                    label={t('tools.zrok.mode_custom')}
                    onClick={() => onShareModeChange('custom')}
                />
            </div>
            <div className="flex gap-4 items-end mt-2">
                <ShareTargetField {...props} />
                <Button
                    variant="primary"
                    onClick={onStartShare}
                    disabled={isStarting || !hasTarget}
                    loading={isStarting}
                    className="h-10 flex items-center justify-center gap-2"
                >
                    {t('tools.zrok.start_share')}
                </Button>
            </div>
        </Card>
    );
}

export interface ActiveSharesCardProps {
    readonly shares: { id: string; target?: string; project_id?: string; url: string }[];
    readonly projects: any[];
    readonly onStop: (shareId: string) => void;
}

export function ActiveSharesCard({ shares, projects, onStop }: ActiveSharesCardProps) {
    const { t } = useTranslation();
    return (
        <Card title={t('tools.zrok.active_shares')} gridCols="grid-cols-1">
            {shares.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">{t('tools.zrok.no_active_shares')}</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {shares.map((share) => {
                        const targetKey = share.project_id || share.target;
                        const proj = projects.find((p) => p.id === targetKey);
                        return (
                            <div
                                key={share.id}
                                className="flex justify-between items-center p-4 border dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                            >
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {proj ? proj.domain : targetKey}
                                    </p>
                                    <a
                                        href={share.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        {share.url}
                                    </a>
                                </div>
                                <Button
                                    variant="danger-ghost"
                                    size="sm"
                                    onClick={() => onStop(share.id)}
                                >
                                    {t('tools.zrok.stop_share')}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

export interface ZrokSectionsProps {
    readonly status: ZrokStatus;
    readonly projects: any[];
    readonly account: EnableFormProps & { readonly onDisable: () => void };
    readonly share: Omit<ShareCardProps, 'projects'>;
    readonly onUninstall: () => void;
    readonly updateAvailable?: string | null;
    readonly onUpdate?: () => void;
    readonly onStopShare: (shareId: string) => void;
}

export function ZrokSections({
    status,
    projects,
    account,
    share,
    onUninstall,
    onStopShare,
    updateAvailable,
    onUpdate
}: ZrokSectionsProps) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-6">
            {status.installed && (
                <EngineCard
                    title={t('tools.zrok.engine_card_title')}
                    uninstallText={t('tools.zrok.uninstall')}
                    version={status.version}
                    onUninstall={onUninstall}
                    updateAvailable={updateAvailable}
                    onUpdate={onUpdate}
                />
            )}
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

export function AllTunnelsTab({
    zrokStatus,
    cfStatus,
    zrokUpdateAvailable,
    cfUpdateAvailable,
    onUpdateClick,
    onTabSwitch,
    onZrokUninstall,
    onCfUninstall
}: any) {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <TunnelOverviewCard
                title="Zrok"
                description={zrokStatus?.installed ? t('tools.zrok.installed_desc') : t('tools.zrok.not_installed_desc')}
                icon="router"
                installed={!!zrokStatus?.installed}
                notInstalledText={t('tools.zrok.not_installed_title')}
                onManage={() => onTabSwitch('zrok')}
                onUninstall={onZrokUninstall}
                updateAvailable={zrokUpdateAvailable}
                onUpdate={() => onUpdateClick('zrok', zrokUpdateAvailable)}
            />
            <TunnelOverviewCard
                title="Cloudflare"
                description={cfStatus?.installed ? t('tools.cloudflare.installed_desc') : t('tools.cloudflare.not_installed_desc')}
                icon="cloud"
                installed={!!cfStatus?.installed}
                notInstalledText={t('tools.cloudflare.not_installed_title')}
                onManage={() => onTabSwitch('cloudflare')}
                onUninstall={onCfUninstall}
                updateAvailable={cfUpdateAvailable}
                onUpdate={() => onUpdateClick('cloudflare', cfUpdateAvailable)}
            />
        </div>
    );
}

export function ZrokTunnelTab({ zrokStatus, zrokUpdateAvailable, onInstallClick, onUpdateClick, zrokProps }: any) {
    const { t } = useTranslation();
    if (!zrokStatus?.installed) {
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
    return (
        <ZrokSections
            status={zrokStatus}
            updateAvailable={zrokUpdateAvailable}
            onUpdate={() => onUpdateClick('zrok', zrokUpdateAvailable)}
            {...zrokProps}
        />
    );
}

export function CloudflareTunnelTab({
    cfStatus,
    cfUpdateAvailable,
    onInstallClick,
    onUpdateClick,
    onCfUninstall,
    onCfStopShare,
    projects,
    cfShare
}: any) {
    const { t } = useTranslation();
    if (!cfStatus?.installed) {
        return (
            <div className="mt-6">
                <EmptyState
                    icon="cloud_download"
                    title={t('tools.cloudflare.not_installed_title')}
                    description={t('tools.cloudflare.not_installed_desc')}
                    actionText={t('tools.cloudflare.install_cloudflare')}
                    onAction={onInstallClick}
                />
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-6">
            <EngineCard
                title={t('tools.cloudflare.engine_card_title')}
                uninstallText={t('tools.cloudflare.uninstall')}
                version={cfStatus.version}
                onUninstall={onCfUninstall}
                updateAvailable={cfUpdateAvailable}
                onUpdate={() => onUpdateClick('cloudflare', cfUpdateAvailable)}
            />
            <ShareCard projects={projects} {...cfShare} />
            <ActiveSharesCard shares={cfStatus.active_shares} projects={projects} onStop={onCfStopShare} />
        </div>
    );
}

export function TunnelsBody({
    activeTab,
    zrokStatus,
    cfStatus,
    zrokUpdateAvailable,
    cfUpdateAvailable,
    isZrokLoading,
    isCfLoading,
    onInstallClick,
    onUpdateClick,
    onTabSwitch,
    onCfUninstall,
    onCfStopShare,
    cfShare,
    ...zrokProps
}: any) {
    if (activeTab === 'all') {
        if (isZrokLoading || isCfLoading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SkeletonCard gridCols="grid-cols-1" />
                    <SkeletonCard gridCols="grid-cols-1" />
                </div>
            );
        }
        return (
            <AllTunnelsTab
                zrokStatus={zrokStatus}
                cfStatus={cfStatus}
                zrokUpdateAvailable={zrokUpdateAvailable}
                cfUpdateAvailable={cfUpdateAvailable}
                onUpdateClick={onUpdateClick}
                onTabSwitch={onTabSwitch}
                onZrokUninstall={zrokProps.onUninstall}
                onCfUninstall={onCfUninstall}
            />
        );
    }
    if (activeTab === 'zrok') {
        if (isZrokLoading) return <SkeletonCard />;
        return (
            <ZrokTunnelTab
                zrokStatus={zrokStatus}
                zrokUpdateAvailable={zrokUpdateAvailable}
                onInstallClick={onInstallClick}
                onUpdateClick={onUpdateClick}
                zrokProps={zrokProps}
            />
        );
    }
    if (activeTab === 'cloudflare') {
        if (isCfLoading) return <SkeletonCard />;
        return (
            <CloudflareTunnelTab
                cfStatus={cfStatus}
                cfUpdateAvailable={cfUpdateAvailable}
                onInstallClick={onInstallClick}
                onUpdateClick={onUpdateClick}
                onCfUninstall={onCfUninstall}
                onCfStopShare={onCfStopShare}
                projects={zrokProps.projects}
                cfShare={cfShare}
            />
        );
    }
    return null;
}
