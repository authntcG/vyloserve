import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'dir';
    children?: TreeNode[];
}

interface FolderTreeViewProps {
    data: TreeNode[];
    onSelectFile: (path: string) => void;
    activePath?: string | null;
}

const TreeItem = ({ node, onSelectFile, activePath, depth = 0 }: { node: TreeNode, onSelectFile: (path: string) => void, activePath?: string | null, depth?: number }) => {
    const [isOpen, setIsOpen] = useState(true);
    const isDir = node.type === 'dir';
    const isActive = node.path === activePath;

    return (
        <div className="flex flex-col">
            <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer select-none transition-colors text-sm ${
                    isActive 
                        ? 'bg-primary/10 text-primary dark:text-emerald-400 font-medium' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => {
                    if (isDir) {
                        setIsOpen(!isOpen);
                    } else {
                        onSelectFile(node.path);
                    }
                }}
            >
                {isDir ? (
                    <span className="material-symbols-outlined text-[16px] text-slate-400">
                        {isOpen ? 'folder_open' : 'folder'}
                    </span>
                ) : (
                    <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-primary dark:text-emerald-400' : 'text-slate-400'}`}>
                        description
                    </span>
                )}
                <span className="truncate">{node.name}</span>
            </div>
            
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
