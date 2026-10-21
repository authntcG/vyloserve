import { useTranslation } from 'react-i18next';
import Card from '../../../components/Card';
import ToggleSwitch from '../../../components/ToggleSwitch';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import { useGit } from '../../../context/GitContext';

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
        return (
            <button
                type="button"
                disabled
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-100 disabled:cursor-default border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap"
            >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t('common.installed')}
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap"
        >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t('tools.git.install_git')}
        </button>
    );
}

export function ExternalCard({ gitData, t }: any) {
    if (!gitData.external?.exists || gitData.installed) return null;
    return (
        <div className="mt-6">
            <Card title={t('tools.git.native_os_card_title')} status={t('tools.git.native_os')} gridCols="grid-cols-1">
                <div className="flex flex-col gap-1 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.installed_version')}</span>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                        {gitData.external.version}
                    </span>
                </div>
                <div className="flex flex-col gap-1 mt-3 w-full min-w-0">
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('tools.git.system_path_binary')}</span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all bg-slate-100 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700/50 leading-relaxed">
                        {gitData.external.path}
                    </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
                    <div className="flex items-start gap-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">lock</span>
                        <span className="leading-relaxed break-words">{t('tools.git.external_locked')}</span>
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
                            className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px] text-blue-500 shrink-0">upgrade</span>
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
            {gitData.external?.exists && (
                <InfoBox tone="warning" icon="warning" className="col-span-1 md:col-span-2 mb-3 w-full min-w-0">
                    {t('tools.git.external_warning')}
                </InfoBox>
            )}
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
                        {t('tools.git.register_path_desc')}
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
                    <FieldLabel size="xs" tone="subtle">
                        {t('tools.git.global_user_name')} (
                        <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.name</code>)
                    </FieldLabel>
                    <input
                        type="text"
                        value={configData.userName}
                        onChange={(e) => setConfigData({ ...configData, userName: e.target.value })}
                        disabled={isProcessing}
                        placeholder={t('tools.git.eg_name')}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-50"
                    />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                    <FieldLabel size="xs" tone="subtle">
                        {t('tools.git.global_email')} (
                        <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">user.email</code>)
                    </FieldLabel>
                    <input
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
                        className="bg-slate-900 dark:bg-white hover:bg-slate-800 disabled:opacity-50 text-white dark:text-slate-900 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        {isProcessing ? t('tools.git.saving') : t('tools.git.save_config')}
                    </button>
                </div>
            </div>
        </Card>
    );
}
