import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ProjectProps } from '../../components/ProjectCard';
import { useToast } from '../../components/ToastContext';

interface Props {
    project: ProjectProps;
}

export interface ProjectSettingsRef {
    submit: () => Promise<boolean>;
}

const ProjectSettings = forwardRef<ProjectSettingsRef, Props>(({ project }, ref) => {
    const { showToast } = useToast();

    // States untuk Dropdown PHP
    const [phpVersions, setPhpVersions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // States Data Form
    const [projectName, setProjectName] = useState(project.name || '');
    const [phpVersion, setPhpVersion] = useState(project.php_version || '');

    useEffect(() => {
        const fetchVersions = async () => {
            setIsLoading(true);
            try {
                const api = window.pywebview?.api || window.api;
                if (api && typeof api.get_installed_php === 'function') {
                    const res = await api.get_installed_php();
                    setPhpVersions(res || []);
                }
            } catch (error) {
                console.error("Gagal memuat versi PHP:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, []);

    // Ekspos fungsi Submit ke Modal induk (Main.tsx)
    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!projectName.trim()) {
                showToast("Nama proyek tidak boleh kosong.", "warning");
                return false;
            }

            try {
                const payload = {
                    id: project.id,
                    name: projectName,
                    php_version: phpVersion
                };

                const api = window.pywebview?.api || window.api;
                if (api && typeof api.update_project === 'function') {
                    const res = await api.update_project(payload);

                    if (res.status === 'success') {
                        showToast(res.message, 'success');
                        // Beri sinyal ke Main.tsx agar daftar project dimuat ulang
                        window.dispatchEvent(new CustomEvent('project_list_updated'));
                        return true;
                    } else {
                        showToast(res.message, 'error');
                        return false;
                    }
                }
                return false;
            } catch (error) {
                console.error(error);
                showToast("Gagal memperbarui pengaturan.", "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">

            {/* Opsi Edit Nama Project */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., My Awesome Site"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                />
            </div>

            {/* Read-Only Domain Host */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Local Domain</label>
                <div className="flex shadow-sm rounded-lg opacity-80 cursor-not-allowed">
                    <input
                        type="text"
                        value={project.domain.split('.')[0]}
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm rounded-l-lg block p-2.5 outline-none pointer-events-none"
                        readOnly
                    />
                    <span className="inline-flex items-center px-3 font-medium text-sm text-slate-500 bg-slate-200 border border-l-0 border-slate-300 rounded-r-lg dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400 pointer-events-none">
                        .{project.domain.split('.').pop()}
                    </span>
                </div>
                <p className="text-xs text-slate-500">Domain is locked and tied to the Virtual Host.</p>
            </div>

            {/* Opsi Edit Binding PHP */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PHP FastCGI Routing</label>
                {isLoading ? (
                    <div className="h-[42px] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg animate-pulse"></div>
                ) : (
                    <select
                        value={phpVersion}
                        onChange={(e) => setPhpVersion(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                    >
                        {phpVersions.length > 0 ? (
                            phpVersions.map(v => (
                                <option key={v.version} value={v.version}>PHP {v.version} (FastCGI)</option>
                            ))
                        ) : (
                            <option>No PHP versions installed</option>
                        )}
                    </select>
                )}
                <p className="text-xs text-slate-500">Changing the PHP routing will automatically rewrite the VHost and restart Apache.</p>
            </div>
        </div>
    );
});

export default ProjectSettings;