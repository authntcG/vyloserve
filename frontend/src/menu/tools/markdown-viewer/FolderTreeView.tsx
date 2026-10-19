import { useState } from 'react';
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
}

const TreeItem = ({ node, onSelectFile, activePath, depth = 0 }: TreeItemProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const isDir = node.type === 'dir';
    const isActive = node.path === activePath;

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
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
            >
                {isDir ? (
                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">
                        {isOpen ? 'folder_open' : 'folder'}
                    </span>
                ) : (
                    <span className={`material-symbols-outlined text-[16px] shrink-0 ${isActive ? 'text-primary dark:text-emerald-400' : 'text-slate-400'}`}>
                        description
                    </span>
                )}
                <span className="truncate">{node.name}</span>
            </button>
            
            {isDir && isOpen && node.children && (
                <div className="flex flex-col">
                    {node.children.map((child, idx) => (
                        <TreeItem 
                            key={`${child.path}-${idx}`} 
                            node={child} 
                            onSelectFile={onSelectFile} 
                            activePath={activePath}
                            depth={depth + 1} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function FolderTreeView({ data, onSelectFile, activePath }: FolderTreeViewProps) {
    const { t } = useTranslation();

    if (!data || data.length === 0) {
        return (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                {t('tools.docs_reader.empty_folder')}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5">
            {data.map((node, idx) => (
                <TreeItem 
                    key={`${node.path}-${idx}`} 
                    node={node} 
                    onSelectFile={onSelectFile} 
                    activePath={activePath} 
                />
            ))}
        </div>
    );
}
