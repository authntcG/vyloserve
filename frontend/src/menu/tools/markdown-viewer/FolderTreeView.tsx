import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: TreeNode[];
}

interface FolderTreeViewProps {
    readonly data: readonly TreeNode[];
    readonly onSelectFile: (path: string) => void;
    readonly activePath?: string | null;
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

const FolderTreeView = memo(function FolderTreeView({ data, onSelectFile, activePath }: FolderTreeViewProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.toLowerCase();

        const filterRecursive = (nodes: readonly TreeNode[]): TreeNode[] => {
            const out: TreeNode[] = [];
            for (const item of nodes) {
                if (item.type === 'file') {
                    if (item.name.toLowerCase().includes(q)) {
                        out.push(item);
                    }
                } else if (item.type === 'dir' && item.children) {
                    const children = filterRecursive(item.children);
                    if (children.length > 0 || item.name.toLowerCase().includes(q)) {
                        out.push({ ...item, children });
                    }
                }
            }
            return out;
        };

        return filterRecursive(data);
    }, [data, searchQuery]);

    if (!data || data.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                {t('tools.docs_reader.empty_folder')}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="relative mb-1">
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

            {filteredData.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 italic">
                    {t('tools.docs_reader.no_files_found')}
                </div>
            ) : (
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
