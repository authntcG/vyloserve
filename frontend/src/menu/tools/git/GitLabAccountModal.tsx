import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import FieldLabel from '../../../components/FieldLabel';
import Select, { type SelectOption } from '../../../components/Select';
import Button from '../../../components/Button';
import InfoBox from '../../../components/InfoBox';
import { useToast } from '../../../context/ToastContext';
import { useGitLab, type GitLabAccountItem } from '../../../context/GitLabContext';

interface GitLabAccountModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly editingAccount: GitLabAccountItem | null;
}

export default function GitLabAccountModal({ isOpen, onClose, editingAccount }: GitLabAccountModalProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { handleSaveAccount, isProcessing, sshKeys } = useGitLab();

    const [host, setHost] = useState<string>('gitlab.com');
    const [authMode, setAuthMode] = useState<'pat' | 'credentials' | 'oauth' | 'ssh'>('pat');
    const [username, setUsername] = useState<string>('');
    const [token, setToken] = useState<string>('');
    const [showToken, setShowToken] = useState<boolean>(false);
    const [protocol, setProtocol] = useState<'https' | 'ssh'>('https');
    const [gitName, setGitName] = useState<string>('');
    const [gitEmail, setGitEmail] = useState<string>('');
    const [selectedSshKey, setSelectedSshKey] = useState<string>('');
    const [requiresVpn, setRequiresVpn] = useState<boolean>(false);
    const [syncGitConfig, setSyncGitConfig] = useState<boolean>(true);

    useEffect(() => {
        if (editingAccount) {
            setHost(editingAccount.host || 'gitlab.com');
            const mode = (editingAccount.auth_type as any) || 'pat';
            const validAuthModes = new Set(['credentials', 'oauth', 'ssh', 'pat']);
            setAuthMode(validAuthModes.has(mode) ? mode : 'pat');
            setUsername(editingAccount.username || '');
            setToken('');
            setProtocol(editingAccount.git_protocol || 'https');
            setGitName(editingAccount.git_name || '');
            setGitEmail(editingAccount.git_email || '');
            setSelectedSshKey(editingAccount.ssh_key_path || (sshKeys[0]?.path || ''));
            setRequiresVpn(Boolean(editingAccount.requires_vpn));
            setSyncGitConfig(Boolean(editingAccount.is_default));
        } else {
            setHost('gitlab.com');
            setAuthMode('pat');
            setUsername('');
            setToken('');
            setProtocol('https');
            setGitName('');
            setGitEmail('');
            setSelectedSshKey(sshKeys[0]?.path || '');
            setRequiresVpn(false);
            setSyncGitConfig(true);
        }
        setShowToken(false);
    }, [editingAccount, isOpen, sshKeys]);

    const handleCopyPublicKey = () => {
        const found = sshKeys.find(k => k.path === selectedSshKey) || sshKeys[0];
        if (found?.public_key) {
            navigator.clipboard.writeText(found.public_key);
            showToast(t('tools.gitlab.public_key_copied'), 'success');
        }
    };

    const handleOpenTokenUrl = () => {
        const cleanHost = host.trim() || 'gitlab.com';
        const url = `https://${cleanHost}/-/user_settings/personal_access_tokens?name=VyloServe&scopes=api,read_user,write_repository`;
        const api = (window as any).pywebview?.api;
        if (api?.open_browser) {
            api.open_browser(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const getTokenFieldLabel = (mode: string): string => {
        if (mode === 'credentials') return t('tools.gitlab.password_label');
        if (mode === 'oauth') return t('tools.gitlab.oauth_token_label');
        return t('tools.gitlab.token');
    };

    const getTokenPlaceholder = (mode: string): string => {
        if (mode === 'credentials') return t('tools.gitlab.password_placeholder') as string;
        if (mode === 'oauth') return t('tools.gitlab.oauth_token_placeholder') as string;
        return t('tools.gitlab.token_placeholder') as string;
    };

    const getTokenHint = (isEditingWithoutToken: boolean, mode: string): string => {
        if (isEditingWithoutToken) return t('tools.git.token_optional_hint');
        if (mode === 'oauth') return t('tools.gitlab.oauth_browser_hint');
        return t('tools.gitlab.token_hint');
    };

    const handleSubmit = async (e?: React.SyntheticEvent) => {
        if (e) e.preventDefault();
        const cleanHost = host.trim() || 'gitlab.com';

        // Validasi: mode PAT atau credentials mewajibkan token/password jika bukan editing
        if ((authMode === 'pat' || authMode === 'credentials') && !token.trim() && !editingAccount?.has_token) {
            showToast(t('tools.gitlab.token_hint'), 'error');
            return;
        }

        const payload = {
            host: cleanHost,
            auth_type: authMode,
            username: username.trim(),
            token: token.trim(),
            git_protocol: protocol,
            git_name: gitName.trim(),
            git_email: gitEmail.trim(),
            ssh_key_path: authMode === 'ssh' || protocol === 'ssh' ? selectedSshKey : '',
            requires_vpn: requiresVpn,
            sync_git_config: syncGitConfig,
        };

        await handleSaveAccount(payload);
    };

    const isApplyDisabled =
        isProcessing ||
        ((authMode === 'pat' || authMode === 'credentials') && !token.trim() && !editingAccount?.has_token);

    const protocolOptions: ReadonlyArray<SelectOption<'https' | 'ssh'>> = [
        { value: 'https', label: 'HTTPS' },
        { value: 'ssh', label: 'SSH' },
    ];

    const authModeOptions: ReadonlyArray<SelectOption<'pat' | 'credentials' | 'oauth' | 'ssh'>> = [
        { value: 'pat', label: t('tools.gitlab.auth_pat') },
        { value: 'credentials', label: t('tools.gitlab.auth_credentials') },
        { value: 'oauth', label: t('tools.gitlab.auth_oauth') },
        { value: 'ssh', label: t('tools.gitlab.auth_ssh') },
    ];

    const sshKeyOptions: ReadonlyArray<SelectOption<string>> = sshKeys.length > 0
        ? sshKeys.map(k => ({
            value: k.path,
            label: `${k.filename} (${k.type})`,
            sublabel: k.comment || undefined,
        }))
        : [{ value: '', label: t('tools.gitlab.no_ssh_keys'), disabled: true }];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingAccount ? t('tools.gitlab.account_modal_edit_title') : t('tools.gitlab.account_modal_title')}
            icon="manage_accounts"
            onApply={handleSubmit}
            applyText={t('tools.gitlab.save_connect')}
            isLoading={isProcessing}
            isApplyDisabled={isApplyDisabled}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Host & Protocol */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_host_input" size="xs" tone="subtle">
                            {t('tools.gitlab.host')}
                        </FieldLabel>
                        <input
                            id="gitlab_host_input"
                            type="text"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder={t('tools.gitlab.host_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_protocol_select" size="xs" tone="subtle">
                            {t('tools.gitlab.protocol')}
                        </FieldLabel>
                        <Select
                            id="gitlab_protocol_select"
                            options={protocolOptions}
                            value={protocol}
                            onChange={(val) => setProtocol(val)}
                            searchable={false}
                        />
                    </div>
                </div>

                {/* Auth Mode Select */}
                <div className="flex flex-col gap-1 min-w-0">
                    <FieldLabel htmlFor="gitlab_auth_mode_select" size="xs" tone="subtle">
                        {t('tools.gitlab.auth_mode')}
                    </FieldLabel>
                    <Select
                        id="gitlab_auth_mode_select"
                        options={authModeOptions}
                        value={authMode}
                        onChange={(val) => setAuthMode(val)}
                        searchable={false}
                    />
                </div>

                {/* Username Input (for credentials mode) */}
                {authMode === 'credentials' && (
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_username_input" size="xs" tone="subtle">
                            {t('tools.gitlab.username')}
                        </FieldLabel>
                        <input
                            id="gitlab_username_input"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('tools.gitlab.username_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white font-mono"
                        />
                    </div>
                )}

                {/* Token or Password Field (for PAT, credentials, or OAuth token) */}
                {authMode !== 'ssh' && (
                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <FieldLabel htmlFor="gitlab_token_input" size="xs" tone="subtle">
                                {getTokenFieldLabel(authMode)}
                            </FieldLabel>
                            {authMode === 'pat' && (
                                <button
                                    type="button"
                                    onClick={handleOpenTokenUrl}
                                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    {t('tools.gitlab.open_token_page')}
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                id="gitlab_token_input"
                                type={showToken ? 'text' : 'password'}
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder={getTokenPlaceholder(authMode)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 pr-10 text-sm outline-none focus:border-primary text-slate-900 dark:text-white font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                aria-label={showToken ? 'Hide token' : 'Show token'}
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {showToken ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {getTokenHint(Boolean(editingAccount && !token), authMode)}
                        </p>
                    </div>
                )}

                {/* OAuth Browser Info */}
                {authMode === 'oauth' && !token && (
                    <InfoBox tone="info" icon="info">
                        {t('tools.gitlab.oauth_browser_info')}
                    </InfoBox>
                )}

                {/* SSH Key Selector */}
                {(authMode === 'ssh' || protocol === 'ssh') && (
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_ssh_key_select" size="xs" tone="subtle">
                            {t('tools.gitlab.ssh_key')}
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <Select
                                    id="gitlab_ssh_key_select"
                                    options={sshKeyOptions}
                                    value={selectedSshKey}
                                    onChange={(val) => setSelectedSshKey(val)}
                                    searchable={false}
                                />
                            </div>
                            {sshKeys.length > 0 && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="content_copy"
                                    onClick={handleCopyPublicKey}
                                    title={t('tools.gitlab.copy_public_key')}
                                >
                                    <span className="hidden sm:inline">{t('tools.gitlab.copy_public_key')}</span>
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Push user.name & user.email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_push_name_input" size="xs" tone="subtle">
                            {t('tools.gitlab.push_name')}
                        </FieldLabel>
                        <input
                            id="gitlab_push_name_input"
                            type="text"
                            value={gitName}
                            onChange={(e) => setGitName(e.target.value)}
                            placeholder={t('tools.gitlab.push_name_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="gitlab_push_email_input" size="xs" tone="subtle">
                            {t('tools.gitlab.push_email')}
                        </FieldLabel>
                        <input
                            id="gitlab_push_email_input"
                            type="email"
                            value={gitEmail}
                            onChange={(e) => setGitEmail(e.target.value)}
                            placeholder={t('tools.gitlab.push_email_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                        />
                    </div>
                </div>

                {/* Checkbox: Requires VPN */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="gitlab_requires_vpn_checkbox"
                            checked={requiresVpn}
                            onChange={(e) => setRequiresVpn(e.target.checked)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="gitlab_requires_vpn_checkbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            {t('tools.git.requires_vpn_label')}
                        </label>
                    </div>
                    <span className="text-[11px] text-slate-500 pl-6">
                        {t('tools.git.requires_vpn_desc')}
                    </span>
                </div>

                {/* Auto Sync to Git Checkbox */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="gitlab_sync_git_checkbox"
                        checked={syncGitConfig}
                        onChange={(e) => setSyncGitConfig(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="gitlab_sync_git_checkbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        {t('tools.gitlab.auto_sync_git')}
                    </label>
                </div>
            </form>
        </Modal>
    );
}
