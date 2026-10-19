import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';
import SkeletonDocument from '../../../components/skeleton/SkeletonDocument';
import MarkdownRenderer from './MarkdownRenderer';
import FolderTreeView from './FolderTreeView';
import type { TreeNode } from './FolderTreeView';

export default function MarkdownViewer() {
    const { t } = useTranslation();
    
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [mdContent, setMdContent] = useState<string>('');
    const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
    const [isRefreshingTree, setIsRefreshingTree] = useState<boolean>(false);
    
    // Default theme based on current system theme
    const [readerTheme, setReaderTheme] = useState<'light' | 'dark'>(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );

    // Recursively find index.md or README.md in the tree to auto-open
    const findDefaultFile = (nodes: TreeNode[]): string | null => {
        // Check files in current level first
        for (const node of nodes) {
            if (node.type === 'file' && (node.name.toLowerCase() === 'index.md' || node.name.toLowerCase() === 'readme.md')) {
                return node.path;
            }
        }
        // Then check children
        for (const node of nodes) {
            if (node.type === 'dir' && node.children) {
                const found = findDefaultFile(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const hasFileInTree = (nodes: TreeNode[], targetPath: string): boolean => {
        for (const node of nodes) {
            if (node.type === 'file' && node.path === targetPath) {
                return true;
            }
            if (node.type === 'dir' && node.children && hasFileInTree(node.children, targetPath)) {
                return true;
            }
        }
        return false;
    };

    const handleRefreshTree = async () => {
        if (!rootPath || isRefreshingTree) return;
        setIsRefreshingTree(true);
        try {
            const api = (window as any).pywebview.api;
            const treeRes = await api.md_get_tree(rootPath);
            if (treeRes.status === 'success' && Array.isArray(treeRes.data)) {
                setTreeData(treeRes.data);
                if (!selectedFile || !hasFileInTree(treeRes.data, selectedFile)) {
                    const defaultFile = findDefaultFile(treeRes.data);
                    if (defaultFile) {
                        handleFileClick(defaultFile);
                    } else {
                        setSelectedFile(null);
                        setMdContent('');
                    }
                }
            }
        } catch (err) {
            console.error('Failed to refresh folder tree', err);
        } finally {
            setIsRefreshingTree(false);
        }
    };

    const handleSelectFolder = async () => {
        try {
            const api = (window as any).pywebview.api;
            const res = await api.md_select_directory();
            
            if (res.status === 'success' && res.data) {
                const selectedPath = res.data;
                setRootPath(selectedPath);
                
                // Fetch tree
                const treeRes = await api.md_get_tree(selectedPath);
                if (treeRes.status === 'success') {
                    setTreeData(treeRes.data);
                    
                    // Auto-open index.md or readme.md
                    const defaultFile = findDefaultFile(treeRes.data);
                    if (defaultFile) {
                        handleFileClick(defaultFile);
                    } else {
                        setSelectedFile(null);
                        setMdContent('');
                    }
                }
            } else if (res.status === 'error') {
                console.error(res.message);
            }
        } catch (err) {
            console.error('Failed to select folder', err);
        }
    };

    const handleFileClick = async (filePath: string) => {
        if (filePath === selectedFile) return;
        
        setIsFileLoading(true);
        setSelectedFile(filePath);
        
        try {
            const api = (window as any).pywebview.api;
            const res = await api.md_read_file(filePath);
            
            if (res.status === 'success') {
                setMdContent(res.data);
            } else {
                setMdContent(`**${t('tools.docs_reader.file_load_error')}**\n\n${res.message}`);
            }
        } catch (err) {
            console.error('Failed to read file', err);
            setMdContent(`**${t('tools.docs_reader.file_load_error')}**`);
        } finally {
            setIsFileLoading(false);
        }
    };

    const handleLinkClick = (href: string) => {
        if (!selectedFile) return;
        
        // Remove hash from href if any
        const cleanHref = href.split('#')[0];
        if (!cleanHref) return; // Only hash, do nothing

        // Base directory of the currently selected file
        let baseDir = selectedFile.replaceAll('\\', '/');
        baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'));
        
        const relParts = cleanHref.replaceAll('\\', '/').split('/');
        const baseParts = baseDir.split('/');
        
        for (const part of relParts) {
            if (part === '.') continue;
            if (part === '..') {
                baseParts.pop();
            } else {
                baseParts.push(part);
            }
        }
        
        const resolvedPath = baseParts.join('/');
        handleFileClick(resolvedPath);
    };

    const handleCloseFolder = () => {
        setRootPath(null);
        setTreeData([]);
        setSelectedFile(null);
        setMdContent('');
    };

    const renderContent = () => {
        if (!selectedFile) {
            return (
                <div className="flex items-center justify-center h-[400px] text-slate-400">
                    <p>{t('tools.docs_reader.no_folder_desc')}</p>
                </div>
            );
        }

        if (isFileLoading) {
            return <SkeletonDocument />;
        }

        return (
            <MarkdownRenderer
                content={mdContent}
                rootPath={rootPath || ''}
                readerTheme={readerTheme}
                onLinkClick={handleLinkClick}
            />
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
            <PageHeader 
                icon="menu_book"
                title={t('tools.docs_reader.title')} 
                subtitle={t('tools.docs_reader.desc')}
                actions={
                    rootPath ? (
                        <Button variant="secondary" onClick={handleCloseFolder} className="text-sm">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                            {t('tools.docs_reader.btn_select')}
                        </Button>
                    ) : undefined
                }
            />

            {!rootPath ? (
                <Card title={t('tools.docs_reader.title')} gridCols="grid-cols-1">
                    <EmptyState
                        icon="menu_book"
                        title={t('tools.docs_reader.no_folder')}
                        description={t('tools.docs_reader.no_folder_desc')}
                        actionText={t('tools.docs_reader.btn_select')}
                        onAction={handleSelectFolder}
                    />
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT PANE - TREEVIEW */}
                    <div className="w-full lg:col-span-3 lg:sticky lg:top-4 max-h-[calc(100vh-240px)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2 px-2 shrink-0">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {t('tools.docs_reader.tree_title')}
                            </span>
                            <button
                                type="button"
                                onClick={handleRefreshTree}
                                disabled={isRefreshingTree}
                                title={t('tools.docs_reader.refresh_tree')}
                                aria-label={t('tools.docs_reader.refresh_tree')}
                                className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
                            >
                                <span className={`material-symbols-outlined text-[16px] ${isRefreshingTree ? 'animate-spin' : ''}`}>
                                    refresh
                                </span>
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                            <FolderTreeView 
                                data={treeData} 
                                onSelectFile={handleFileClick} 
                                activePath={selectedFile} 
                            />
                        </div>
                    </div>

                    {/* RIGHT PANE - CONTENT */}
                    <div className={`w-full lg:col-span-9 min-w-0 overflow-hidden min-h-[500px] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-colors relative ${readerTheme === 'dark' ? 'bg-slate-900 text-slate-100 dark' : 'bg-white text-slate-900'}`}>
                        {/* Theme Toggle Button */}
                        {selectedFile && !isFileLoading && (
                            <button 
                                type="button"
                                onClick={() => setReaderTheme(prev => prev === 'light' ? 'dark' : 'light')}
                                className="absolute top-4 right-4 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-colors flex items-center justify-center z-10 shadow-sm"
                                title={readerTheme === 'light' ? t('tools.docs_reader.switch_dark') : t('tools.docs_reader.switch_light')}
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {readerTheme === 'light' ? 'dark_mode' : 'light_mode'}
                                </span>
                            </button>
                        )}

                        {renderContent()}
                    </div>
                </div>
            )}
        </div>
    );
}
