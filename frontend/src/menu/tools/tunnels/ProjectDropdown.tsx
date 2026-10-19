import React from 'react';

export function getProjectDropdownLabel(projects: any[], target: any, t: any): string {
    if (projects.length === 0) return t('tools.zrok.no_projects');
    if (target) return `${target.domain} (${target.name})`;
    return t('tools.zrok.select_project');
}

export default function ProjectDropdown({
    projects,
    selectedProject,
    isDropdownOpen,
    onToggleDropdown,
    searchQuery,
    onSearchChange,
    onSelectProject,
    dropdownRef,
    searchInputRef,
    t,
    disabled
}: any) {
    const onEnterOrSpace = (cb: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cb();
        }
    };

    const filtered = projects.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.domain.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50);

    const target = projects.find((p: any) => p.id === selectedProject);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={onToggleDropdown}
                disabled={disabled}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 outline-none flex items-center justify-between transition-colors ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
                        : 'bg-white dark:bg-slate-800 cursor-pointer hover:border-primary text-slate-700 dark:text-slate-200'
                }`}
            >
                <span className="truncate pr-2 text-sm text-left">
                    {getProjectDropdownLabel(projects, target, t)}
                </span>
                <span
                    className={`material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180 text-primary' : ''
                    }`}
                >
                    expand_more
                </span>
            </button>

            {isDropdownOpen && !disabled && (
                <div className="absolute top-[45px] left-0 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                                search
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('common.search')}
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                        {filtered.length > 0 ? (
                            filtered.map((p: any) => {
                                const isSelected = selectedProject === p.id;
                                return (
                                    <div // NOSONAR typescript:S6819
                                        key={p.id}
                                        onClick={() => onSelectProject(p.id)}
                                        onKeyDown={onEnterOrSpace(() => onSelectProject(p.id))}
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={0}
                                        className={`px-3 py-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between group outline-none ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span>
                                            {p.domain} <span className="text-xs text-slate-500 ml-1">({p.name})</span>
                                        </span>
                                        {isSelected && <span className="material-symbols-outlined text-[16px] text-primary">check</span>}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-500">
                                {t('common.no_results')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
