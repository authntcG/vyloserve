import type { ProjectProps } from '../../components/ProjectCard';

interface Props {
    project: ProjectProps;
}

export default function ProjectSettings({ project }: Props) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Local Domain</label>
                <div className="flex">
                    <input type="text" defaultValue={project.domain.replace('.local', '')} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm rounded-l-lg block p-2.5 outline-none" readOnly />
                    <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-200 border border-l-0 border-slate-300 rounded-r-lg dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400">.local</span>
                </div>
                <p className="text-xs text-slate-500">Domain is locked. Create a new project to change domain.</p>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PHP Version</label>
                <select className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-colors">
                    <option value="8.3">PHP 8.3 (FastCGI)</option>
                    <option value="8.2">PHP 8.2 (FastCGI)</option>
                    <option value="8.1">PHP 8.1 (FastCGI)</option>
                </select>
            </div>
        </div>
    );
}