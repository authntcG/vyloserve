import { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContext';
import FieldLabel from '../../components/FieldLabel';
import InfoBox from '../../components/InfoBox';

interface DbInstance {
    id: string;
    name: string;
    engine: 'mysql' | 'postgres';
    version: string;
    port: number;
    status: 'running' | 'stopped';
    dataDir: string;
}

interface Props {
    instance: DbInstance;
}

export interface ChangePasswordRef {
    submit: () => Promise<boolean>;
}

const ChangePassword = forwardRef<ChangePasswordRef, Props>(({ instance }, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const isPostgres = instance.engine === 'postgres';

    const [credUser, setCredUser] = useState(isPostgres ? 'postgres' : 'root');
    const [credOld, setCredOld] = useState('');
    const [credNew, setCredNew] = useState('');

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!credNew) {
                showToast(t('database.new_password_empty_warning'), "warning");
                return false;
            }

            if (instance.status !== 'running') {
                showToast(t('database.db_must_be_running'), "warning");
                return false;
            }

            try {
                const api = window.pywebview?.api;
                if (api && typeof api.change_db_credentials === 'function') {
                    const response = await api.change_db_credentials(instance.id, credUser, credOld, credNew);
                    if (response.status === 'success') {
                        showToast((t(response.message, response.args || {}) as string), 'success');
                        return true;
                    } else {
                        showToast((t(response.message, response.args || {}) as string), 'error');
                        return false;
                    }
                }
                return false;
            } catch (error){ console.error(error);
                showToast(t('database.fetch_cred_error'), "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <InfoBox tone="info" icon="info" title={t('database.direct_sql_inject')} className="mb-2">
                {t('database.change_password_desc_1')}<b>{t('database.running_bold')}</b>.
            </InfoBox>

            <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="db_cred_user">{t('database.username')}</FieldLabel>
                <input
                    id="db_cred_user"
                    type="text"
                    value={credUser}
                    onChange={(e) => setCredUser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono"
                />
            </div>
            <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="db_cred_old">{t('database.current_password')}</FieldLabel>
                <input
                    id="db_cred_old"
                    type="password"
                    placeholder={t('database.leave_empty_no_password')}
                    value={credOld}
                    onChange={(e) => setCredOld(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none focus:ring-primary focus:border-primary transition-colors font-mono"
                />
            </div>
            <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="db_cred_new">{t('database.new_password')}</FieldLabel>
                <input
                    id="db_cred_new"
                    type="password"
                    placeholder={t('database.enter_new_password')}
                    value={credNew}
                    onChange={(e) => setCredNew(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none focus:ring-primary focus:border-primary transition-colors font-mono"
                />
            </div>
        </div>
    );
});

export default ChangePassword;