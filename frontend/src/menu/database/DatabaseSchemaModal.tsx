import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { useDatabase } from '../../context/DatabaseContext';
import { useToast } from '../../context/ToastContext';
import { useAlert } from '../../context/AlertContext';
import Skeleton from '../../components/skeleton/Skeleton';

interface DatabaseSchemaItem {
    name: string;
    is_system: boolean;
}

export default function DatabaseSchemaModal() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { confirm } = useAlert();
    const { activeSchemaDb, closeSchemaModal } = useDatabase();

    const [schemas, setSchemas] = useState<DatabaseSchemaItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newSchemaName, setNewSchemaName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [actionLoading, setActionLoading] = useState<{ type: 'export' | 'import' | 'drop'; schemaName: string } | null>(null);

    const api = (window as any).pywebview?.api;

    const fetchSchemas = useCallback(async (pwd?: string) => {
        if (!activeSchemaDb || !api) return;
        const passwordToUse = pwd ?? authPassword;
        setIsLoading(true);
        try {
            const res = await api.list_database_schemas(activeSchemaDb.id, passwordToUse);
            if (res.status === 'success') {
                setSchemas(res.data || []);
            } else {
                showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
                if (res.message?.includes('password') || res.message?.includes('access denied')) {
                    setShowAuthPassword(true);
                }
            }
        } catch (err: any) {
            showToast(t('backend.error.unexpected', { e: err.message || String(err) }), 'error');
        } finally {
            setIsLoading(false);
        }
    }, [activeSchemaDb, authPassword, showToast, t]);

    useEffect(() => {
        if (activeSchemaDb) {
            setNewSchemaName('');
            setAuthPassword('');
            setShowAuthPassword(false);
            fetchSchemas('');
        } else {
            setSchemas([]);
        }
    }, [activeSchemaDb]);

    const handleCreate = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const trimmed = newSchemaName.trim();
        const api = (window as any).pywebview?.api;
        if (!trimmed || !activeSchemaDb || !api) return;

        if (!/^\w{1,64}$/.test(trimmed)) {
            showToast(t('backend.database.schema_name_invalid'), 'error');
            return;
        }

        setIsCreating(true);
        try {
            const res = await api.create_database_schema(activeSchemaDb.id, trimmed, authPassword);
            if (res.status === 'success') {
                showToast(t(res.message, res.args || {}) as string, 'success');
                setNewSchemaName('');
                await fetchSchemas();
            } else {
                showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
            }
        } catch (err: any) {
            showToast(t('backend.error.unexpected', { e: err.message || String(err) }), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDrop = async (schema: DatabaseSchemaItem) => {
        const api = (window as any).pywebview?.api;
        if (!activeSchemaDb || !api || schema.is_system) return;

        const confirmed = await confirm({
            title: t('database.drop_schema_confirm_title', { name: schema.name }),
            message: t('database.drop_schema_confirm_desc', { name: schema.name }),
            confirmText: t('database.drop_schema'),
            type: 'danger',
        });
        if (!confirmed) return;

        setActionLoading({ type: 'drop', schemaName: schema.name });
        try {
            const res = await api.drop_database_schema(activeSchemaDb.id, schema.name, authPassword);
            if (res.status === 'success') {
                showToast(t(res.message, res.args || {}) as string, 'success');
                await fetchSchemas();
            } else {
                showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
            }
        } catch (err: any) {
            showToast(t('backend.error.unexpected', { e: err.message || String(err) }), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleExport = async (schemaName: string) => {
        if (!activeSchemaDb || !api) return;

        try {
            const defaultName = `${schemaName}_${new Date().toISOString().slice(0, 10)}.sql`;
            const savePath = await api.browse_save_file?.(defaultName, ['SQL files (*.sql)', 'All files (*.*)']);
            if (!savePath) return;

            setActionLoading({ type: 'export', schemaName });
            const res = await api.export_database_schema(activeSchemaDb.id, schemaName, savePath, authPassword);
            if (res.status === 'success') {
                showToast(t(res.message, res.args || {}) as string, 'success');
            } else {
                showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
            }
        } catch (err: any) {
            showToast(t('backend.error.unexpected', { e: err.message || String(err) }), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleImport = async (schemaName: string) => {
        if (!activeSchemaDb || !api) return;

        try {
            const filePath = await api.browse_open_file?.(['SQL files (*.sql)', 'All files (*.*)']);
            if (!filePath) return;

            setActionLoading({ type: 'import', schemaName });
            const res = await api.import_database_schema(activeSchemaDb.id, schemaName, filePath, authPassword);
            if (res.status === 'success') {
                showToast(t(res.message, res.args || {}) as string, 'success');
                await fetchSchemas();
            } else {
                showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
            }
        } catch (err: any) {
            showToast(t('backend.error.unexpected', { e: err.message || String(err) }), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const { userSchemas, systemSchemas } = useMemo(() => {
        const user: DatabaseSchemaItem[] = [];
        const system: DatabaseSchemaItem[] = [];
        for (const s of schemas) {
            if (s.is_system) system.push(s);
            else user.push(s);
        }
        return { userSchemas: user, systemSchemas: system };
    }, [schemas]);

    return (
        <Modal
            isOpen={activeSchemaDb !== null}
            onClose={closeSchemaModal}
            title={t('database.schemas_title', { name: activeSchemaDb?.name || '' })}
            icon="database"
            maxWidthClass="sm:w-[680px]"
            isLoading={isLoading || isCreating || Boolean(actionLoading)}
        >
            <div className="space-y-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('database.schemas_modal_desc')}
                </p>

                {/* Password Bar (Collapsible if not needed) */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setShowAuthPassword(!showAuthPassword)}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {showAuthPassword ? 'expand_less' : 'key'}
                            </span>
                            <span>{t('database.auth_password_optional')}</span>
                        </button>
                        <span className="text-[11px] text-slate-400">
                            {t('database.auth_password_hint')}
                        </span>
                    </div>
                    {showAuthPassword && (
                        <div className="mt-2.5 flex items-center gap-2">
                            <input
                                id="schema_auth_password_input"
                                type="password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder="••••••••"
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary"
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => fetchSchemas()}
                                disabled={isLoading}
                            >
                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Create New Database Form */}
                <form onSubmit={handleCreate} className="space-y-1.5">
                    <label htmlFor="new_schema_input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {t('database.new_schema_name')}
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                                database
                            </span>
                            <input
                                id="new_schema_input"
                                type="text"
                                value={newSchemaName}
                                onChange={(e) => setNewSchemaName(e.target.value)}
                                placeholder={t('database.placeholder_schema_name')}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary"
                                disabled={isCreating}
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={!newSchemaName.trim() || isCreating}
                            loading={isCreating}
                        >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            <span>{isCreating ? t('database.creating_schema') : t('database.create_schema_btn')}</span>
                        </Button>
                    </div>
                </form>

                {/* Schema List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {t('database.schemas_count', { count: userSchemas.length })}
                        </span>
                        {systemSchemas.length > 0 && (
                            <span className="text-[11px] text-slate-400">
                                {systemSchemas.length} {t('database.system_db_badge', 'System')}
                            </span>
                        )}
                    </div>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[320px] overflow-y-auto">
                        {isLoading && (
                            <div className="p-4 space-y-3">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        )}
                        {!isLoading && userSchemas.length === 0 && systemSchemas.length === 0 && (
                            <div className="p-8 text-center text-slate-400 space-y-2">
                                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                                    database
                                </span>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    {t('database.no_user_schemas')}
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {t('database.no_user_schemas_desc')}
                                </p>
                            </div>
                        )}
                        {!isLoading && (userSchemas.length > 0 || systemSchemas.length > 0) && (
                            <>
                                {userSchemas.map((schema) => {
                                    const isRowLoading = actionLoading?.schemaName === schema.name;
                                    return (
                                        <div
                                            key={schema.name}
                                            className="flex items-center justify-between p-2.5 px-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        database
                                                    </span>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                    {schema.name}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleExport(schema.name)}
                                                    disabled={isRowLoading}
                                                    title={t('database.export_sql')}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">
                                                        download
                                                    </span>
                                                    <span className="hidden sm:inline text-[11px]">
                                                        {isRowLoading && actionLoading?.type === 'export'
                                                            ? t('database.exporting_sql')
                                                            : t('database.export_sql')}
                                                    </span>
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleImport(schema.name)}
                                                    disabled={isRowLoading}
                                                    title={t('database.import_sql')}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">
                                                        upload
                                                    </span>
                                                    <span className="hidden sm:inline text-[11px]">
                                                        {isRowLoading && actionLoading?.type === 'import'
                                                            ? t('database.importing_sql')
                                                            : t('database.import_sql')}
                                                    </span>
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleDrop(schema)}
                                                    disabled={isRowLoading}
                                                    title={t('database.drop_schema')}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">
                                                        delete
                                                    </span>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {systemSchemas.map((schema) => (
                                    <div
                                        key={schema.name}
                                        className="flex items-center justify-between p-2.5 px-3 bg-slate-50/40 dark:bg-slate-900/40 opacity-75"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-md bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">
                                                    lock
                                                </span>
                                            </div>
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                                                {schema.name}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                                                {t('database.system_db_badge')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
