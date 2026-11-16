import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import Tabs, { type TabItem } from '../../components/Tabs';
import Button from '../../components/Button';
import FieldLabel from '../../components/FieldLabel';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';

export interface ProjectEnvModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly project: { id: string; name: string; domain?: string; path?: string } | null;
}

interface ParsedEnvItem {
  key: string;
  value: string;
  is_sensitive: boolean;
  line_no?: number;
}

interface MissingEnvKey {
  key: string;
  example_value: string;
  is_sensitive: boolean;
}

interface EnvSnapshotItem {
  id: string;
  created_at: string;
  timestamp_ms: number;
  size_bytes: number;
}

interface EnvNoEnvStateProps {
  readonly onInitEnv: () => void;
}

function EnvNoEnvState({ onInitEnv }: EnvNoEnvStateProps) {
  const { t } = useTranslation();
  return (
    <div className="py-6 flex flex-col items-center justify-center gap-3">
      <EmptyState
        icon="description"
        title={t('projects.env_manager.no_env_file', 'No .env file found in this project.')}
        description={t(
          'projects.env_manager.no_env_desc',
          'You can initialize an active .env file based on .env.example or create a new blank one.'
        )}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={onInitEnv}
      >
        <span className="material-symbols-outlined text-[16px] mr-1">add_circle</span>
        {t('projects.env_manager.create_env', 'Create .env File')}
      </Button>
    </div>
  );
}

interface EnvDiffTabContentProps {
  readonly hasExample: boolean;
  readonly missingKeys: readonly MissingEnvKey[];
  readonly onSyncMissingKeys: (keys?: string[]) => void;
}

function EnvDiffTabContent({ hasExample, missingKeys, onSyncMissingKeys }: EnvDiffTabContentProps) {
  const { t } = useTranslation();
  if (!hasExample) {
    return (
      <EmptyState
        icon="info"
        title={t('projects.env_manager.no_example_title', 'No .env.example Found')}
        description={t(
          'projects.env_manager.no_example_desc',
          'Create a .env.example file in your project root to compare variables.'
        )}
      />
    );
  }

  if (missingKeys.length === 0) {
    return (
      <EmptyState
        icon="verified"
        title={t('projects.env_manager.all_synced_title', 'All Keys are in Sync!')}
        description={t(
          'projects.env_manager.all_synced_desc',
          'Every variable defined in .env.example is present in your active .env file.'
        )}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {t('projects.env_manager.missing_keys_title', 'Variables Missing from .env')}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t(
              'projects.env_manager.missing_keys_desc',
              'The following keys exist in .env.example but are not declared in .env:'
            )}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => onSyncMissingKeys()}
        >
          <span className="material-symbols-outlined text-[16px] mr-1">sync_alt</span>
          {t('projects.env_manager.btn_sync_all', 'Sync Missing Keys to .env')}
        </Button>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-3 w-1/3">Missing Key</th>
              <th className="py-2.5 px-3">Example Default Value</th>
              <th className="py-2.5 px-3 w-24 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {missingKeys.map((item) => (
              <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2 px-3 font-semibold text-amber-600 dark:text-amber-400">
                  {item.key}
                </td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                  {item.example_value || '<empty>'}
                </td>
                <td className="py-2 px-3 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSyncMissingKeys([item.key])}
                  >
                    Sync
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProjectEnvModal({ isOpen, onClose, project }: ProjectEnvModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<string>('key_value');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Env Data State
  const [hasEnv, setHasEnv] = useState<boolean>(false);
  const [hasExample, setHasExample] = useState<boolean>(false);
  const [rawContent, setRawContent] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedEnvItem[]>([]);
  const [missingKeys, setMissingKeys] = useState<MissingEnvKey[]>([]);
  const [snapshots, setSnapshots] = useState<EnvSnapshotItem[]>([]);

  // Key-value editor state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyValue, setNewKeyValue] = useState<string>('');

  // Snapshot restore confirmation
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  const subTabs: TabItem[] = [
    { value: 'key_value', label: t('projects.env_manager.tab_key_value', 'Key-Value Editor') },
    { value: 'raw', label: t('projects.env_manager.tab_raw', 'Raw Editor') },
    {
      value: 'diff',
      label: `${t('projects.env_manager.tab_diff', '.env.example Diff')}${
        missingKeys.length > 0 ? ` (${missingKeys.length})` : ''
      }`,
    },
    { value: 'vault', label: t('projects.env_manager.tab_vault', 'Vault Snapshots') },
  ];

  // Fetch env details and snapshots
  const loadEnvDetails = useCallback(async () => {
    if (!project?.id) return;
    setIsLoading(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.get_project_env_details) {
        const res = await api.get_project_env_details(project.id);
        if (res.status === 'success') {
          setHasEnv(Boolean(res.has_env));
          setHasExample(Boolean(res.has_example));
          setRawContent(res.env_content || '');
          setParsedItems(res.parsed_env || []);
          setMissingKeys(res.missing_keys || []);
        } else {
          showToast(t(res.message || 'backend.project.env_read_error', res.args || {}) as string, 'error');
        }
      }

      if (api?.list_project_env_snapshots) {
        const snapRes = await api.list_project_env_snapshots(project.id);
        if (snapRes.status === 'success') {
          setSnapshots(snapRes.snapshots || []);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load .env details', 'error');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    if (isOpen && project?.id) {
      loadEnvDetails();
      setSearchQuery('');
      setRevealedKeys(new Set());
    }
  }, [isOpen, project?.id, loadEnvDetails]);

  // Toggle eye visibility for sensitive values
  const toggleRevealKey = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Add new variable to Key-Value list
  const handleAddVariable = () => {
    const k = newKeyName.trim();
    if (!k) return;

    // Check duplicate
    if (parsedItems.some((item) => item.key === k)) {
      showToast(`Key '${k}' already exists`, 'error');
      return;
    }

    const lowerK = k.toLowerCase();
    const isSensitive = ['secret', 'key', 'password', 'passwd', 'token', 'auth', 'credential', 'private'].some((kw) =>
      lowerK.includes(kw)
    );

    const updated = [...parsedItems, { key: k, value: newKeyValue, is_sensitive: isSensitive }];
    setParsedItems(updated);
    setNewKeyName('');
    setNewKeyValue('');

    // Reconstruct raw content
    reconstructRawFromItems(updated);
  };

  // Delete variable
  const handleDeleteVariable = (keyToDelete: string) => {
    const updated = parsedItems.filter((item) => item.key !== keyToDelete);
    setParsedItems(updated);
    reconstructRawFromItems(updated);
  };

  // Update item value inline
  const handleItemValueChange = (key: string, newValue: string) => {
    const updated = parsedItems.map((item) => (item.key === key ? { ...item, value: newValue } : item));
    setParsedItems(updated);
    reconstructRawFromItems(updated);
  };

  // Helper to sync raw content from parsed key-value items
  const reconstructRawFromItems = (items: ParsedEnvItem[]) => {
    const text = items.map((item) => `${item.key}=${item.value}`).join('\n');
    setRawContent(text);
  };

  // Save changes to disk
  const handleSaveEnv = async (contentToSave: string) => {
    if (!project) return;
    setIsSaving(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.save_project_env) {
        const res = await api.save_project_env(project.id, contentToSave, true);
        if (res.status === 'success') {
          showToast(t('projects.env_manager.save_success', 'Environment variables saved successfully.'), 'success');
          await loadEnvDetails();
        } else {
          showToast(t(res.message || 'backend.project.env_save_error', res.args || {}) as string, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Save error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Sync missing keys from .env.example
  const handleSyncMissingKeys = async (keysToSync?: string[]) => {
    if (!project) return;
    try {
      const api = (window as any).pywebview?.api;
      if (api?.sync_project_env_example_keys) {
        const res = await api.sync_project_env_example_keys(project.id, keysToSync || null);
        if (res.status === 'success') {
          showToast(t('projects.env_manager.sync_success', 'Missing keys synced successfully.'), 'success');
          await loadEnvDetails();
        } else {
          showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Sync error', 'error');
    }
  };

  // Restore snapshot
  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!project || !snapshotId) return;
    try {
      const api = (window as any).pywebview?.api;
      if (api?.restore_project_env_snapshot) {
        const res = await api.restore_project_env_snapshot(project.id, snapshotId);
        if (res.status === 'success') {
          showToast(t('projects.env_manager.restore_success', 'Snapshot restored successfully.'), 'success');
          setRestoringSnapshotId(null);
          await loadEnvDetails();
        } else {
          showToast(t(res.message || 'backend.project.env_restore_error', res.args || {}) as string, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Restore error', 'error');
    }
  };

  // Filtered Key-Value items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return parsedItems;
    const q = searchQuery.toLowerCase();
    return parsedItems.filter(
      (item) => item.key.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
    );
  }, [parsedItems, searchQuery]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t(
        'projects.env_manager.title',
        'Environment (.env) Manager — {{name}}',
        { name: project?.name || 'Project' }
      )}
      icon="tune"
      maxWidthClass="max-w-4xl"
    >
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <Tabs tabs={subTabs} value={activeSubTab} onChange={setActiveSubTab} />

        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <span className="material-symbols-outlined text-[32px] animate-spin text-primary">sync</span>
            <span className="text-xs">Loading environment details...</span>
          </div>
        )}

        {!isLoading && !hasEnv && activeSubTab !== 'diff' && (
          <EnvNoEnvState
            onInitEnv={() => handleSaveEnv('# Initialized by VyloServe\nAPP_NAME=' + (project?.name || ''))}
          />
        )}

        {!isLoading && (hasEnv || activeSubTab === 'diff') && (
          <>
            {/* SUB-TAB 1: KEY-VALUE EDITOR */}
            {activeSubTab === 'key_value' && (
              <div className="flex flex-col gap-4">
                {/* Search Bar & Add Variable */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="w-full sm:w-72">
                    <FieldLabel htmlFor="env-search-input" visuallyHidden>
                      {t('projects.env_manager.search_keys', 'Search environment keys...')}
                    </FieldLabel>
                    <input
                      id="env-search-input"
                      type="text"
                      placeholder={t('projects.env_manager.search_keys', 'Search environment keys...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveEnv(rawContent)}
                    disabled={isSaving}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">save</span>
                    {isSaving ? 'Saving...' : t('projects.env_manager.btn_save', 'Save Changes')}
                  </Button>
                </div>

                {/* Key-Value Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-1/3">{t('projects.env_manager.key_name', 'Key Name')}</th>
                        <th className="py-2.5 px-3">{t('projects.env_manager.key_value', 'Value')}</th>
                        <th className="py-2.5 px-3 w-16 text-right">{t('projects.env_manager.actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredItems.map((item) => {
                        const isRevealed = revealedKeys.has(item.key) || !item.is_sensitive;
                        return (
                          <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              <span className="flex items-center gap-1.5">
                                {item.key}
                                {item.is_sensitive && (
                                  <span
                                    className="material-symbols-outlined text-[14px] text-amber-500"
                                    title="Sensitive credential"
                                  >
                                    shield
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type={isRevealed ? 'text' : 'password'}
                                  value={item.value}
                                  onChange={(e) => handleItemValueChange(item.key, e.target.value)}
                                  aria-label={`Value for ${item.key}`}
                                  className="w-full text-xs font-mono px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100"
                                />
                                {item.is_sensitive && (
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealKey(item.key)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                    title={isRevealed ? 'Hide sensitive value' : 'Show sensitive value'}
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
                                      {isRevealed ? 'visibility_off' : 'visibility'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteVariable(item.key)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Delete variable"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Add New Variable Row */}
                      <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="NEW_KEY_NAME"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                            aria-label="New Key Name"
                            className="w-full text-xs font-mono px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="value..."
                            value={newKeyValue}
                            onChange={(e) => setNewKeyValue(e.target.value)}
                            aria-label="New Key Value"
                            className="w-full text-xs font-mono px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleAddVariable}
                            disabled={!newKeyName.trim()}
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: RAW EDITOR */}
            {activeSubTab === 'raw' && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    Edit raw .env content directly. Comments (#) and blank lines are preserved.
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveEnv(rawContent)}
                    disabled={isSaving}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">save</span>
                    {isSaving ? 'Saving...' : t('projects.env_manager.btn_save', 'Save Changes')}
                  </Button>
                </div>
                <FieldLabel htmlFor="raw-env-textarea" visuallyHidden>
                  Raw .env Content
                </FieldLabel>
                <textarea
                  id="raw-env-textarea"
                  rows={16}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-y leading-5"
                />
              </div>
            )}

            {/* SUB-TAB 3: .ENV.EXAMPLE DIFF */}
            {activeSubTab === 'diff' && (
              <div className="flex flex-col gap-4">
                <EnvDiffTabContent
                  hasExample={hasExample}
                  missingKeys={missingKeys}
                  onSyncMissingKeys={handleSyncMissingKeys}
                />
              </div>
            )}

            {/* SUB-TAB 4: VAULT SNAPSHOTS */}
            {activeSubTab === 'vault' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {t('projects.env_manager.vault_title', 'Local .env Backup Snapshots')}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t(
                        'projects.env_manager.vault_desc',
                        'Automatic snapshots created before every save. Restore anytime.'
                      )}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSaveEnv(rawContent)}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">history</span>
                    {t('projects.env_manager.btn_create_snapshot', 'Create Backup Snapshot')}
                  </Button>
                </div>

                {snapshots.length === 0 ? (
                  <EmptyState
                    icon="history_toggle_off"
                    title="No Snapshots Yet"
                    description="Snapshots will be automatically created whenever you save changes to your .env file."
                  />
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Snapshot File</th>
                          <th className="py-2.5 px-3">{t('projects.env_manager.col_created', 'Created At')}</th>
                          <th className="py-2.5 px-3">{t('projects.env_manager.col_size', 'Size')}</th>
                          <th className="py-2.5 px-3 w-28 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {snapshots.map((snap) => (
                          <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {snap.id}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                              {snap.created_at}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {snap.size_bytes} B
                            </td>
                            <td className="py-2 px-3 text-right">
                              {restoringSnapshotId === snap.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleRestoreSnapshot(snap.id)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setRestoringSnapshotId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setRestoringSnapshotId(snap.id)}
                                >
                                  {t('projects.env_manager.btn_restore', 'Restore')}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
