import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/Modal';
import FieldLabel from '../../../components/FieldLabel';
import Select, { type SelectOption } from '../../../components/Select';
import Button from '../../../components/Button';
import InfoBox from '../../../components/InfoBox';
import { useToast } from '../../../context/ToastContext';
import { useGit, type GitAccountItem } from '../../../context/GitContext';

export type GitAuthMode = 'pat' | 'credentials' | 'gcm' | 'ssh';

interface GitAccountModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly editingAccount: GitAccountItem | null;
}

const PRESET_ENDPOINTS = [
    { value: 'github.com', label: 'GitHub (github.com)' },
    { value: 'gitlab.com', label: 'GitLab (gitlab.com)' },
    { value: 'bitbucket.org', label: 'Bitbucket (bitbucket.org)' },
    { value: 'custom', label: 'Custom Endpoint...' },
];

function stripEndpointProtocol(rawEndpoint: string): string {
    const trimmed = rawEndpoint.trim();
    if (trimmed.startsWith('https://')) {
        return trimmed.slice(8);
    }
    if (trimmed.startsWith('http://')) {
        return trimmed.slice(7);
    }
    return trimmed;
}

export default function GitAccountModal({ isOpen, onClose, editingAccount }: GitAccountModalProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { handleSaveAccount, isProcessing, sshKeys } = useGit();

    const [preset, setPreset] = useState<string>('github.com');
    const [endpoint, setEndpoint] = useState<string>('github.com');
    const [label, setLabel] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [protocol, setProtocol] = useState<'https' | 'ssh'>('https');
    const [authMode, setAuthMode] = useState<GitAuthMode>('pat');
    const [token, setToken] = useState<string>('');
    const [showToken, setShowToken] = useState<boolean>(false);
    const [selectedSshKey, setSelectedSshKey] = useState<string>('');
    const [requiresVpn, setRequiresVpn] = useState<boolean>(false);
    const [setAsDefault, setSetAsDefault] = useState<boolean>(true);

    useEffect(() => {
        if (editingAccount) {
            const isPreset = PRESET_ENDPOINTS.some(p => p.value === editingAccount.endpoint && p.value !== 'custom');
            setPreset(isPreset ? editingAccount.endpoint : 'custom');
            setEndpoint(editingAccount.endpoint || 'github.com');
            setLabel(editingAccount.label || '');
            setUsername(editingAccount.username || '');
            setEmail(editingAccount.email || '');
            setProtocol(editingAccount.protocol || 'https');
            const mode = (editingAccount.auth_mode as any) || 'pat';
            const validAuthModes: GitAuthMode[] = ['ssh', 'credentials', 'gcm', 'pat'];
            const resolvedMode = validAuthModes.includes(mode) ? mode : 'pat';
            setAuthMode(resolvedMode);
            setToken('');
            setSelectedSshKey(editingAccount.ssh_key_path || (sshKeys[0]?.path || ''));
            setRequiresVpn(Boolean(editingAccount.requires_vpn));
            setSetAsDefault(Boolean(editingAccount.is_default));
        } else {
            setPreset('github.com');
            setEndpoint('github.com');
            setLabel('');
            setUsername('');
            setEmail('');
            setProtocol('https');
            setAuthMode('pat');
            setToken('');
            setSelectedSshKey(sshKeys[0]?.path || '');
            setRequiresVpn(false);
            setSetAsDefault(true);
        }
        setShowToken(false);
    }, [editingAccount, isOpen, sshKeys]);

    const handlePresetChange = (val: string) => {
        setPreset(val);
        if (val !== 'custom') {
            setEndpoint(val);
        }
    };

    const handleCopyPublicKey = () => {
        const found = sshKeys.find(k => k.path === selectedSshKey) || sshKeys[0];
        if (found?.public_key) {
            navigator.clipboard.writeText(found.public_key);
            showToast(t('tools.git.public_key_copied'), 'success');
        }
    };

    const handleOpenTokenUrl = () => {
        const withoutProto = stripEndpointProtocol(endpoint);
        const cleanHost = withoutProto.split('/')[0].trim() || 'github.com';
        const url = cleanHost.toLowerCase().includes('github.com')
            ? 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=VyloServe+Desktop'
            : `https://${cleanHost}/-/user_settings/personal_access_tokens`;
        const api = (window as any).pywebview?.api;
        if (api?.open_browser) {
            api.open_browser(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const handleSubmit = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        if (!username.trim() || !email.trim()) {
            return;
        }

        const payload = {
            id: editingAccount?.id || '',
            label: label.trim() || `${username.trim()} (${endpoint.trim()})`,
            endpoint: endpoint.trim() || 'github.com',
            username: username.trim(),
            email: email.trim(),
            protocol,
            auth_mode: protocol === 'ssh' ? 'ssh' : authMode,
            token: token.trim(),
            ssh_key_path: protocol === 'ssh' || authMode === 'ssh' ? selectedSshKey : '',
            requires_vpn: requiresVpn,
            set_as_default: setAsDefault,
        };

        await handleSaveAccount(payload);
    };

    const protocolOptions: ReadonlyArray<SelectOption<'https' | 'ssh'>> = [
        { value: 'https', label: 'HTTPS' },
        { value: 'ssh', label: 'SSH' },
    ];

    const authModeOptions: ReadonlyArray<SelectOption<'pat' | 'credentials' | 'gcm' | 'ssh'>> = protocol === 'https'
        ? [
            { value: 'pat', label: t('tools.git.auth_pat') },
            { value: 'credentials', label: t('tools.git.auth_credentials') },
            { value: 'gcm', label: t('tools.git.auth_gcm') },
        ]
        : [{ value: 'ssh', label: t('tools.git.auth_ssh') }];

    const sshKeyOptions: ReadonlyArray<SelectOption<string>> = sshKeys.length > 0
        ? sshKeys.map(k => ({
            value: k.path,
            label: `${k.filename} (${k.type})`,
            sublabel: k.comment || undefined,
        }))
        : [{ value: '', label: t('tools.git.no_ssh_keys'), disabled: true }];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingAccount ? t('tools.git.account_modal_edit_title') : t('tools.git.account_modal_title')}
            icon="manage_accounts"
            onApply={handleSubmit}
            applyText={t('common.save', 'Save')}
            isLoading={isProcessing}
            isApplyDisabled={!username.trim() || !email.trim() || isProcessing}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Endpoint Preset & Custom Host */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_endpoint_preset" size="xs" tone="subtle">
                            {t('tools.git.endpoint_preset')}
                        </FieldLabel>
                        <Select
                            id="git_endpoint_preset"
                            options={PRESET_ENDPOINTS}
                            value={preset}
                            onChange={(val) => handlePresetChange(val)}
                            searchable={false}
                        />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_endpoint_input" size="xs" tone="subtle">
                            {t('tools.git.endpoint')}
                        </FieldLabel>
                        <input
                            id="git_endpoint_input"
                            type="text"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            disabled={preset !== 'custom'}
                            placeholder="gitlab.mycompany.com"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white disabled:opacity-60"
                        />
                    </div>
                </div>

                {/* Account Label */}
                <div className="flex flex-col gap-1 min-w-0">
                    <FieldLabel htmlFor="git_account_label_input" size="xs" tone="subtle">
                        {t('tools.git.label_name')}
                    </FieldLabel>
                    <input
                        id="git_account_label_input"
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder={t('tools.git.label_placeholder') as string}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                    />
                </div>

                {/* Push Username and Push Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_acc_username" size="xs" tone="subtle">
                            {t('tools.git.global_user_name')} *
                        </FieldLabel>
                        <input
                            id="git_acc_username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('tools.git.username_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_acc_email" size="xs" tone="subtle">
                            {t('tools.git.global_email')} *
                        </FieldLabel>
                        <input
                            id="git_acc_email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('tools.git.email_placeholder') as string}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-primary text-slate-900 dark:text-white"
                        />
                    </div>
                </div>

                {/* Protocol & Auth Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_protocol_select" size="xs" tone="subtle">
                            {t('tools.git.protocol')}
                        </FieldLabel>
                        <Select
                            id="git_protocol_select"
                            options={protocolOptions}
                            value={protocol}
                            onChange={(val) => {
                                setProtocol(val);
                                if (val === 'ssh') setAuthMode('ssh');
                                else if (authMode === 'ssh') setAuthMode('pat');
                            }}
                            searchable={false}
                        />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_auth_mode_select" size="xs" tone="subtle">
                            {t('tools.git.auth_mode')}
                        </FieldLabel>
                        <Select
                            id="git_auth_mode_select"
                            options={authModeOptions}
                            value={authMode}
                            disabled={protocol === 'ssh'}
                            onChange={(val) => setAuthMode(val)}
                            searchable={false}
                        />
                    </div>
                </div>

                {/* PAT or Password Field */}
                {(authMode === 'pat' || authMode === 'credentials') && protocol === 'https' && (
                    <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <FieldLabel htmlFor="git_pat_token_input" size="xs" tone="subtle">
                                {authMode === 'credentials' ? t('tools.git.password_label') : t('tools.git.auth_pat')}
                            </FieldLabel>
                            {(endpoint.toLowerCase().includes('github.com') || endpoint.toLowerCase().includes('gitlab')) && (
                                <button
                                    type="button"
                                    onClick={handleOpenTokenUrl}
                                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    {endpoint.toLowerCase().includes('github.com')
                                        ? t('tools.git.open_github_token_page')
                                        : t('tools.gitlab.open_token_page')}
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                id="git_pat_token_input"
                                type={showToken ? 'text' : 'password'}
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder={authMode === 'credentials' ? (t('tools.git.password_placeholder') as string) : (t('tools.git.token_placeholder') as string)}
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
                        {editingAccount && (
                            <span className="text-[11px] text-slate-500">
                                {t('tools.git.token_optional_hint')}
                            </span>
                        )}
                        {endpoint.toLowerCase().includes('github.com') && authMode === 'credentials' && (
                            <div className="mt-1">
                                <InfoBox tone="info" icon="info">
                                    {t('tools.git.github_credentials_hint')}
                                </InfoBox>
                            </div>
                        )}
                    </div>
                )}

                {/* SSH Key Selector */}
                {(protocol === 'ssh' || authMode === 'ssh') && (
                    <div className="flex flex-col gap-1 min-w-0">
                        <FieldLabel htmlFor="git_ssh_key_select" size="xs" tone="subtle">
                            {t('tools.git.ssh_key')}
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <Select
                                    id="git_ssh_key_select"
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
                                    title={t('tools.git.copy_public_key')}
                                >
                                    <span className="hidden sm:inline">{t('tools.git.copy_public_key')}</span>
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Checkbox: Requires VPN */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="git_requires_vpn_checkbox"
                            checked={requiresVpn}
                            onChange={(e) => setRequiresVpn(e.target.checked)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="git_requires_vpn_checkbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            {t('tools.git.requires_vpn_label')}
                        </label>
                    </div>
                    <span className="text-[11px] text-slate-500 pl-6">
                        {t('tools.git.requires_vpn_desc')}
                    </span>
                </div>

                {/* Checkbox: Set as Default Push */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="git_set_default_checkbox"
                        checked={setAsDefault}
                        onChange={(e) => setSetAsDefault(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="git_set_default_checkbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        {t('tools.git.sync_global')}
                    </label>
                </div>
            </form>
        </Modal>
    );
}
