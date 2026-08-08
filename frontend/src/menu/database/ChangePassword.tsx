import { useState, forwardRef, useImperativeHandle } from 'react';
import { useToast } from '../../components/ToastContext';

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
    const { showToast } = useToast();
    const isPostgres = instance.engine === 'postgres';

    const [credUser, setCredUser] = useState(isPostgres ? 'postgres' : 'root');
    const [credOld, setCredOld] = useState('');
    const [credNew, setCredNew] = useState('');

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!credNew) {
                showToast("Password baru tidak boleh kosong.", "warning");
                return false;
            }

            if (instance.status !== 'running') {
                showToast("Database harus dalam keadaan menyala (Running) untuk mengubah kredensial.", "warning");
                return false;
            }

            try {
                const api = window.pywebview?.api;
                if (api && typeof api.change_db_credentials === 'function') {
                    const response = await api.change_db_credentials(instance.id, credUser, credOld, credNew);
                    if (response.status === 'success') {
                        showToast(response.message, 'success');
                        return true;
                    } else {
                        showToast(response.message, 'error');
                        return false;
                    }
                }
                return false;
            } catch (error) {
                console.error(error);
                showToast("Gagal menghubungi server untuk mengubah kredensial.", "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg flex items-start gap-3 mb-2">
                <span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5">info</span>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-400">Direct SQL Inject</span>
                    <span className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
                        Pengubahan password dieksekusi langsung menggunakan antarmuka Command Line (CLI) SQL ke dalam database. Pastikan engine sedang <b>Running</b>.
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                <input
                    type="text"
                    value={credUser}
                    onChange={(e) => setCredUser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none font-mono"
                />
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
                <input
                    type="password"
                    placeholder="Leave empty if no password"
                    value={credOld}
                    onChange={(e) => setCredOld(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none focus:ring-primary focus:border-primary transition-colors font-mono"
                />
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                <input
                    type="password"
                    placeholder="Enter new password"
                    value={credNew}
                    onChange={(e) => setCredNew(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg block p-2.5 outline-none focus:ring-primary focus:border-primary transition-colors font-mono"
                />
            </div>
        </div>
    );
});

export default ChangePassword;