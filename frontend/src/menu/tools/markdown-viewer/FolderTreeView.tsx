import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: TreeNode[];
}

export interface WorkspaceFolder {
    readonly rootPath: string;
    readonly name: string;
    readonly children: readonly TreeNode[];
}

interface FolderTreeViewProps {
    readonly data?: readonly TreeNode[];
    readonly workspaceFolders?: readonly WorkspaceFolder[];
    readonly onSelectFile: (path: string) => void;
    readonly activePath?: string | null;
    readonly onRemoveFolder?: (rootPath: string) => void;
    readonly onRefreshFolder?: (rootPath: string) => void;
}

interface TreeItemProps {
    readonly node: TreeNode;
    readonly onSelectFile: (path: string) => void;
    readonly activePath?: string | null;
    readonly depth?: number;
    readonly forceOpen?: boolean;
}

const TreeItem = memo(function TreeItem({ node, onSelectFile, activePath, depth = 0, forceOpen = false }: TreeItemProps) {
    const [isOpen, setIsOpen] = useState(true);
    const isDir = node.type === 'dir';
    const isActive = node.path === activePath;
    const effectivelyOpen = forceOpen || isOpen;

    const handleClick = () => {
        if (isDir) {
            setIsOpen(!isOpen);
        } else {
            onSelectFile(node.path);
        }
    };

    return (
        <div className="flex flex-col">
            <button
                type="button"
                className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer select-none transition-colors text-sm text-left border-0 bg-transparent ${
                    isActive 
                        ? 'bg-primary/10 text-primary dark:text-emerald-400 font-medium' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={{ paddingLeft: `${depth * 14 + 6}px` }}
                onClick={handleClick}
            >
                {isDir ? (
                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">
                        {effectivelyOpen ? 'folder_open' : 'folder'}
                    </span>
                ) : (
                    <span className={`material-symbols-outlined text-[16px] shrink-0 ${isActive ? 'text-primary dark:text-emerald-400' : 'text-slate-400'}`}>
                        description
                    </span>
                )}
                <span className="truncate">{node.name}</span>
            </button>
            
            {isDir && effectivelyOpen && node.children && (
                <div className="flex flex-col">
                    {node.children.map((child, idx) => (
                        <TreeItem 
                            key={`${child.path}-${idx}`} 
                            node={child} 
                            onSelectFile={onSelectFile} 
                            activePath={activePath}
                            depth={depth + 1}
                            forceOpen={forceOpen}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

const filterTreeRecursive = (nodes: readonly TreeNode[], query: string): TreeNode[] => {
    if (!query) return [...nodes];
    const q = query.toLowerCase();
    const out: TreeNode[] = [];
    for (const item of nodes) {
        if (item.type === 'file') {
            if (item.name.toLowerCase().includes(q)) {
                out.push(item);
            }
        } else if (item.type === 'dir' && item.children) {
            const children = filterTreeRecursive(item.children, query);
            if (children.length > 0 || item.name.toLowerCase().includes(q)) {
                out.push({ ...item, children });
            }
        }
    }
    return out;
};

const FolderTreeView = memo(function FolderTreeView({
    data = [],
    workspaceFolders,
    onSelectFile,
    activePath,
    onRemoveFolder,
    onRefreshFolder
}: FolderTreeViewProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({});

    const toggleRootCollapse = (rootPath: string) => {
        setCollapsedRoots((prev) => ({ ...prev, [rootPath]: !prev[rootPath] }));
    };

    const hasMultiRoots = Boolean(workspaceFolders && workspaceFolders.length > 0);

    const filteredMultiRoots = useMemo(() => {
        if (!workspaceFolders) return [];
        return workspaceFolders.map((wf) => ({
            ...wf,
            filteredChildren: filterTreeRecursive(wf.children, searchQuery)
        }));
    }, [workspaceFolders, searchQuery]);

    const filteredData = useMemo(() => {
        if (hasMultiRoots) return [];
        return filterTreeRecursive(data, searchQuery);
    }, [hasMultiRoots, data, searchQuery]);

    const isEmpty = hasMultiRoots
        ? filteredMultiRoots.every((wf) => wf.filteredChildren.length === 0)
        : filteredData.length === 0;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 mb-1">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[15px] text-slate-400 pointer-events-none">
                        search
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('tools.docs_reader.search_docs')}
                        aria-label={t('tools.docs_reader.search_docs')}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-6 py-1 text-xs outline-none focus:border-primary text-slate-800 dark:text-slate-200"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center p-0.5"
                        >
                            <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                    )}
                </div>
            </div>

            {hasMultiRoots && (
                <div className="flex flex-col gap-2">
                    {filteredMultiRoots.map((wf) => {
                        const isCollapsed = Boolean(collapsedRoots[wf.rootPath]);
                        const isForceOpen = Boolean(searchQuery.trim());
                        const isOpen = isForceOpen || !isCollapsed;

                        return (
                            <div
                                key={wf.rootPath}
                                className="border border-slate-200/80 dark:border-slate-800/80 rounded-lg overflow-hidden bg-slate-50/40 dark:bg-slate-900/40"
                            >
                                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800/60">
                                    <button
                                        type="button"
                                        onClick={() => toggleRootCollapse(wf.rootPath)}
                                        className="flex items-center gap-1.5 font-medium text-xs text-slate-800 dark:text-slate-200 truncate flex-1 text-left select-none"
                                    >
                                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                                            {isOpen ? 'expand_more' : 'chevron_right'}
                                        </span>
                                        <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0">
                                            folder
                                        </span>
                                        <span className="truncate">{wf.name}</span>
                                    </button>
                                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                        {onRefreshFolder && (
                                            <button
                                                type="button"
                                                onClick={() => onRefreshFolder(wf.rootPath)}
                                                title={t('tools.docs_reader.refresh_folder')}
                                                aria-label={t('tools.docs_reader.refresh_folder')}
                                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                                            </button>
                                        )}
                                        {onRemoveFolder && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveFolder(wf.rootPath)}
                                                title={t('tools.docs_reader.remove_folder')}
                                                aria-label={t('tools.docs_reader.remove_folder')}
                                                className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 rounded text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="p-1 flex flex-col gap-0.5">
                                        {wf.filteredChildren.length === 0 ? (
                                            <div className="p-2 text-center text-xs text-slate-400 italic">
                                                {searchQuery.trim() ? t('tools.docs_reader.no_files_found') : t('tools.docs_reader.empty_folder')}
                                            </div>
                                        ) : (
                                            wf.filteredChildren.map((node, idx) => (
                                                <TreeItem
                                                    key={`${node.path}-${idx}`}
                                                    node={node}
                                                    onSelectFile={onSelectFile}
                                                    activePath={activePath}
                                                    depth={0}
                                                    forceOpen={isForceOpen}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!hasMultiRoots && isEmpty && (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                    {searchQuery.trim() ? t('tools.docs_reader.no_files_found') : t('tools.docs_reader.empty_folder')}
                </div>
            )}

            {!hasMultiRoots && !isEmpty && (
                <div className="flex flex-col gap-0.5">
                    {filteredData.map((node, idx) => (
                        <TreeItem
                            key={`${node.path}-${idx}`}
                            node={node}
                            onSelectFile={onSelectFile}
                            activePath={activePath}
                            forceOpen={Boolean(searchQuery.trim())}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default FolderTreeView;
