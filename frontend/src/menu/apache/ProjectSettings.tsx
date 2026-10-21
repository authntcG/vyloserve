import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectData } from './Main';
import { useToast } from '../../context/ToastContext';
import Select from '../../components/Select';
import FieldLabel from '../../components/FieldLabel';
import Skeleton from '../../components/skeleton/Skeleton';

interface Props {
    project: ProjectData;
}

export interface ProjectSettingsRef {
    submit: () => Promise<boolean>;
}

const ProjectSettings = forwardRef<ProjectSettingsRef, Props>(({ project }, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    // States untuk Dropdown PHP
    const [phpVersions, setPhpVersions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // States Data Form
    const [projectName, setProjectName] = useState(project.name || '');
    const [phpVersion, setPhpVersion] = useState(project.php_version || '');
    const [proxyPort, setProxyPort] = useState<number>(project.proxy_port || 3000);
    const isProxyProject = Boolean(project.project_type && project.project_type !== 'php');

    useEffect(() => {
        const fetchVersions = async () => {
            setIsLoading(true);
            try {
                const api = window.pywebview?.api;
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
                showToast(t('apache.empty_project_name'), "warning");
                return false;
            }
            if (isProxyProject && (!proxyPort || proxyPort < 1024 || proxyPort > 65535)) {
                showToast(t('apache.invalid_proxy_port_error'), "warning");
                return false;
            }

            try {
                const payload = {
                    id: project.id,
                    name: projectName,
                    php_version: phpVersion,
                    ...(isProxyProject ? { proxy_port: Number(proxyPort) } : {}),
                };

                const api = window.pywebview?.api;
                if (api && typeof api.update_project === 'function') {
                    const res = await api.update_project(payload);

                    if (res.status === 'success') {
                        showToast(t(res.message || '', res.args || {}) as string, 'success');
                        window.dispatchEvent(new CustomEvent('project_list_updated'));
                        return true;
                    } else {
                        showToast(t(res.message || '', res.args || {}) as string, 'error');
                        return false;
                    }
                }
                return false;
            } catch (error) {
                console.error(error);
                showToast(t('apache.update_settings_error'), "error");
                return false;
            }
        }
    }));

    return (
        <div className="flex flex-col gap-4">

            {/* Opsi Edit Nama Project */}
            <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="apache_project_name">{t('apache.project_name')}</FieldLabel>
                <input
                    id="apache_project_name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t('apache.placeholder_project_name')}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                />
            </div>

            {/* Read-Only Domain Host */}
            <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="apache_local_domain">{t('apache.local_domain')}</FieldLabel>
                <div className="flex shadow-sm rounded-lg opacity-80 cursor-not-allowed">
                    <input
                        id="apache_local_domain"
                        type="text"
                        value={project.domain.split('.')[0]}
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm rounded-l-lg block p-2.5 outline-none pointer-events-none"
                        readOnly
                    />
                    <span className="inline-flex items-center px-3 font-medium text-sm text-slate-500 bg-slate-200 border border-l-0 border-slate-300 rounded-r-lg dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400 pointer-events-none">
                        .{project.domain.split('.').pop()}
                    </span>
                </div>
                <p className="text-xs text-slate-500">{t('apache.domain_locked_desc')}</p>
            </div>

            {/* Opsi Edit Binding PHP atau Reverse Proxy Port */}
            <div className="flex flex-col gap-2">
                {isProxyProject ? (
                    <>
                        <FieldLabel htmlFor="apache_project_proxy_port">{t('apache.target_localhost_port')}</FieldLabel>
                        <input
                            id="apache_project_proxy_port"
                            type="number"
                            min={1024}
                            max={65535}
                            value={proxyPort}
                            onChange={(e) => setProxyPort(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors"
                        />
                        <p className="text-xs text-slate-500">{t('apache.proxy_routing_desc')}</p>
                    </>
                ) : (
                    <>
                        {isLoading ? (
                            <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-2">
                                <FieldLabel>{t('apache.php_fastcgi_routing')}</FieldLabel>
                                <Skeleton className="h-[42px] w-full rounded-lg" />
                            </div>
                        ) : (
                            <Select
                                searchable={false}
                                label={t('apache.php_fastcgi_routing')}
                                options={phpVersions.map(v => ({ value: v.version, label: `PHP ${v.version} (FastCGI)` }))}
                                value={phpVersion || null}
                                onChange={setPhpVersion}
                                placeholder={t('apache.no_php_installed')}
                            />
                        )}
                        <p className="text-xs text-slate-500">{t('apache.php_routing_desc')}</p>
                    </>
                )}
            </div>
        </div>
    );
});

export default ProjectSettings;
