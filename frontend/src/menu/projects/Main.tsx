import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import ViewModeToggle, { type ViewMode } from '../../components/ViewModeToggle';
import FilterChips from '../../components/FilterChips';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import BackgroundProgressWidget from '../../components/BackgroundProgressWidget';
import ProjectCard from './ProjectCard';
import ProjectTable from './ProjectTable';
import ProjectNewModal from './ProjectNewModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import ProjectDeleteModal from './ProjectDeleteModal';
import ProjectCliInstallModal from './ProjectCliInstallModal';
import ProjectServerLogsModal from './ProjectServerLogsModal';
import { ProjectProvider, useProject } from '../../context/ProjectContext';

type RuntimeFilter = 'all' | 'php' | 'node' | 'python' | 'go' | 'java';

function ProjectsView() {
    const { t } = useTranslation();
    const {
        projects,
        isFetchingProjects,
        openNewProjectModal,
        openProjectSettingsModal,
        openDeleteConfirmModal,
        handleSyncHost,
        handleOpenBrowser,
        handleOpenDocumentRoot,
        isCreatingProject,
        isNewProjectModalOpen,
        progress,
        progressText,
        restoreProgressWidget,
        runningServers,
        handleStartServer,
        handleStopServer,
        handleViewServerLogs,
    } = useProject();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRuntime, setSelectedRuntime] = useState<RuntimeFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    // Counts per runtime
    const runtimeCounts = useMemo(() => {
        const counts: Record<RuntimeFilter, number> = {
            all: projects.length,
            php: 0,
            node: 0,
            python: 0,
            go: 0,
            java: 0,
        };
        for (const p of projects) {
            const type = (p.project_type || 'php') as RuntimeFilter;
            if (counts[type] !== undefined) {
                counts[type] += 1;
            } else {
                counts.php += 1;
            }
        }
        return counts;
    }, [projects]);

    // Filtered projects
    const filteredProjects = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return projects.filter((project) => {
            // 1. Runtime filter
            const pType = (project.project_type || 'php') as RuntimeFilter;
            if (selectedRuntime !== 'all' && pType !== selectedRuntime) {
                return false;
            }
            // 2. Search query filter
            if (!q) return true;
            return (
                (project.name || '').toLowerCase().includes(q) ||
                (project.domain || '').toLowerCase().includes(q) ||
                (project.framework || '').toLowerCase().includes(q) ||
                (project.path || '').toLowerCase().includes(q)
            );
        });
    }, [projects, selectedRuntime, searchQuery]);

    const runtimeFilterTabs: { id: RuntimeFilter; label: string }[] = [
        { id: 'all', label: t('projects.filter_all', 'All') },
        { id: 'php', label: 'PHP' },
        { id: 'node', label: 'Node.js' },
        { id: 'python', label: 'Python' },
        { id: 'go', label: 'Go' },
        { id: 'java', label: 'Java' },
    ];

    const filterChipsElement = (
        <FilterChips
            items={runtimeFilterTabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                count: runtimeCounts[tab.id],
            }))}
            selectedId={selectedRuntime}
            onChange={(id) => setSelectedRuntime(id as RuntimeFilter)}
            ariaLabel={t('projects.filter_runtime', 'Filter by runtime')}
        />
    );

    const noMatchingEmptyState = (
        <EmptyState
            icon="search_off"
            title={t('projects.no_matching', 'No matching projects')}
            description={t('projects.no_matching_desc', 'No projects match the current search or runtime filter.')}
            actionText={t('projects.clear_filters', 'Clear Filters')}
            onAction={() => {
                setSearchQuery('');
                setSelectedRuntime('all');
            }}
        />
    );

    return (
        <div className="flex flex-col w-full">
            <PageHeader
                icon="folder_open"
                title={t('projects.title', 'Projects')}
                subtitle={
                    <>
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        {t('projects.subtitle', 'Manage your web applications, frameworks, and local domains')} • {projects.length} {t('apache.virtual_hosts', 'Projects')}
                    </>
                }
                actions={
                    <div className="flex items-center gap-2">
                        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                        <Button
                            variant="primary"
                            icon="add"
                            onClick={openNewProjectModal}
                            className="shadow-sm"
                        >
                            {t('projects.add_project', 'New Project')}
                        </Button>
                    </div>
                }
            />

            {/* Content Section */}
            {isFetchingProjects ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                    {[1, 2, 3, 4].map((item) => (
                        <SkeletonCard key={item} />
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <EmptyState
                    icon="folder_open"
                    title={t('projects.no_projects_found', 'No projects found')}
                    description={t('projects.no_projects_desc', 'Create your first project to start building with Laravel, React, Next.js, Django, and more.')}
                    actionText={t('projects.create_first', 'Create Project')}
                    onAction={openNewProjectModal}
                />
            ) : viewMode === 'table' ? (
                <ProjectTable
                    projects={filteredProjects}
                    serverInfoMap={runningServers}
                    filters={filterChipsElement}
                    search={{
                        value: searchQuery,
                        onChange: setSearchQuery,
                        placeholder: t('projects.search_placeholder', 'Search projects...'),
                        ariaLabel: t('projects.search_placeholder', 'Search projects...'),
                    }}
                    emptyState={noMatchingEmptyState}
                    onStartServer={handleStartServer}
                    onStopServer={handleStopServer}
                    onViewLogs={handleViewServerLogs}
                    onOpenDocumentRoot={handleOpenDocumentRoot}
                    onOpenSettings={openProjectSettingsModal}
                    onSyncHost={handleSyncHost}
                    onDeleteClick={openDeleteConfirmModal}
                    onOpenBrowser={handleOpenBrowser}
                />
            ) : (
                <>
                    {/* Filter and Search Bar for Card View */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                        {filterChipsElement}
                        <div className="relative min-w-[240px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('projects.search_placeholder', 'Search projects...')}
                                aria-label={t('projects.search_placeholder', 'Search projects...')}
                                className="w-full h-8 pl-9 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {filteredProjects.length === 0 ? (
                        noMatchingEmptyState
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4.5 pb-8">
                            {filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    serverInfo={runningServers[project.id]}
                                    onStartServer={handleStartServer}
                                    onStopServer={handleStopServer}
                                    onViewLogs={handleViewServerLogs}
                                    onOpenDocumentRoot={handleOpenDocumentRoot}
                                    onOpenSettings={openProjectSettingsModal}
                                    onSyncHost={handleSyncHost}
                                    onDeleteClick={openDeleteConfirmModal}
                                    onOpenBrowser={handleOpenBrowser}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Widgets & Modals */}
            <BackgroundProgressWidget
                isOpen={isCreatingProject && !isNewProjectModalOpen}
                progress={progress}
                progressText={progressText}
                title={t('apache.installing_project', 'Installing Project')}
                onRestore={restoreProgressWidget}
            />

            <ProjectNewModal />
            <ProjectSettingsModal />
            <ProjectDeleteModal />
            <ProjectCliInstallModal />
            <ProjectServerLogsModal />
        </div>
    );
}

export default function ProjectsMain() {
    return (
        <ProjectProvider>
            <ProjectsView />
        </ProjectProvider>
    );
}
