import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';
import SkeletonDocument from '../../../components/skeleton/SkeletonDocument';
import MarkdownRenderer from './MarkdownRenderer';
import FolderTreeView from './FolderTreeView';
import type { TreeNode } from './FolderTreeView';

const RECENT_FOLDERS_KEY = 'vylo_recent_docs_folders';

interface HeadingItem {
    readonly level: number;
    readonly text: string;
    readonly id: string;
}

export default function MarkdownViewer() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [mdContent, setMdContent] = useState<string>('');
    const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
    const [isRefreshingTree, setIsRefreshingTree] = useState<boolean>(false);
    const [showToc, setShowToc] = useState<boolean>(false);
    const [tocFilter, setTocFilter] = useState<string>('');
    const [isCopiedDoc, setIsCopiedDoc] = useState<boolean>(false);

    // Recent folders from localStorage
    const [recentFolders, setRecentFolders] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(RECENT_FOLDERS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Theme sync with app theme
    const getSystemTheme = (): 'light' | 'dark' =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    const [readerTheme, setReaderTheme] = useState<'light' | 'dark'>(getSystemTheme);

    useEffect(() => {
        const updateTheme = () => setReaderTheme(getSystemTheme());
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        return () => observer.disconnect();
    }, []);

    // Save recent folder
    const saveRecentFolder = (folderPath: string) => {
        try {
            const updated = [folderPath, ...recentFolders.filter((f) => f !== folderPath)].slice(0, 5);
            localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(updated));
            setRecentFolders(updated);
        } catch {
            // ignore
        }
    };

    const handleClearRecent = () => {
        try {
            localStorage.removeItem(RECENT_FOLDERS_KEY);
            setRecentFolders([]);
        } catch {
            // ignore
        }
    };

    // Recursively find index.md or README.md in the tree to auto-open
    const findDefaultFile = (nodes: TreeNode[]): string | null => {
        for (const node of nodes) {
            if (node.type === 'file' && (node.name.toLowerCase() === 'index.md' || node.name.toLowerCase() === 'readme.md')) {
                return node.path;
            }
        }
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
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const treeRes = await api.md_get_tree(rootPath);
            if (treeRes?.status === 'success' && Array.isArray(treeRes.data)) {
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
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const res = await api.md_select_directory();
            
            if (res?.status === 'success' && res.data) {
                const selectedPath = res.data;
                setRootPath(selectedPath);
                saveRecentFolder(selectedPath);
                
                const treeRes = await api.md_get_tree(selectedPath);
                if (treeRes?.status === 'success') {
                    setTreeData(treeRes.data || []);
                    const defaultFile = findDefaultFile(treeRes.data || []);
                    if (defaultFile) {
                        handleFileClick(defaultFile);
                    } else {
                        setSelectedFile(null);
                        setMdContent('');
                    }
                }
            } else if (res?.status === 'error') {
                console.error(res.message);
            }
        } catch (err) {
            console.error('Failed to select folder', err);
        }
    };

    const handleOpenRecentFolder = async (folderPath: string) => {
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const treeRes = await api.md_get_tree(folderPath);
            if (treeRes?.status === 'success') {
                setRootPath(folderPath);
                setTreeData(treeRes.data || []);
                saveRecentFolder(folderPath);

                const defaultFile = findDefaultFile(treeRes.data || []);
                if (defaultFile) {
                    handleFileClick(defaultFile);
                } else {
                    setSelectedFile(null);
                    setMdContent('');
                }
            }
        } catch (err) {
            console.error('Failed to open recent folder', err);
        }
    };

    const handleFileClick = useCallback(async (filePath: string) => {
        if (filePath === selectedFile) return;
        
        setIsFileLoading(true);
        setSelectedFile(filePath);
        setTocFilter('');
        setIsCopiedDoc(false);
        
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const res = await api.md_read_file(filePath);
            
            if (res?.status === 'success') {
                setMdContent(res.data);
            } else {
                setMdContent(`**${t('tools.docs_reader.file_load_error')}**\n\n${res?.message || ''}`);
            }
        } catch (err) {
            console.error('Failed to read file', err);
            setMdContent(`**${t('tools.docs_reader.file_load_error')}**`);
        } finally {
            setIsFileLoading(false);
        }
    }, [selectedFile, t]);

    const handleLinkClick = useCallback((href: string) => {
        if (!selectedFile) return;
        
        const cleanHref = href.split('#')[0];
        if (!cleanHref) return;

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
    }, [selectedFile, handleFileClick]);

    const handleCloseFolder = useCallback(() => {
        setRootPath(null);
        setTreeData([]);
        setSelectedFile(null);
        setMdContent('');
        setShowToc(false);
        setTocFilter('');
        setIsCopiedDoc(false);
    }, []);

    const handleCopyDoc = useCallback(async () => {
        if (!mdContent) return;
        try {
            await navigator.clipboard.writeText(mdContent);
            setIsCopiedDoc(true);
            showToast(t('tools.docs_reader.copy_success'), 'success');
            setTimeout(() => setIsCopiedDoc(false), 2000);
        } catch (err) {
            console.error('Failed to copy document markdown', err);
        }
    }, [mdContent, showToast, t]);

    // Parse Headings for TOC, excluding code blocks
    const headings = useMemo<HeadingItem[]>(() => {
        if (!mdContent) return [];
        const lines = mdContent.split('\n');
        const result: HeadingItem[] = [];
        let inCodeBlock = false;
        const seenIds = new Map<string, number>();

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) continue;

            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2].trim().replace(/[*_`#]/g, '');
                let rawId = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                if (!rawId) rawId = `heading-${result.length + 1}`;
                const count = seenIds.get(rawId) || 0;
                seenIds.set(rawId, count + 1);
                const id = count === 0 ? rawId : `${rawId}-${count}`;
                result.push({ level, text, id });
            }
        }
        return result;
    }, [mdContent]);

    // Live search/filter inside TOC headings
    const filteredHeadings = useMemo(() => {
        if (!tocFilter.trim()) return headings;
        const q = tocFilter.toLowerCase();
        return headings.filter((h) => h.text.toLowerCase().includes(q));
    }, [headings, tocFilter]);

    // Word count & Reading stats
    const wordCount = useMemo(() => {
        if (!mdContent) return 0;
        return mdContent.trim().split(/\s+/).filter(Boolean).length;
    }, [mdContent]);

    const readingTimeMin = useMemo(() => {
        return Math.max(1, Math.ceil(wordCount / 200));
    }, [wordCount]);

    const handleJumpToHeading = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

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
            <div className="flex flex-col select-text">
                {/* Document Top Bar: Stats, TOC Toggle, Theme Toggle */}
                <div className="flex flex-col min-[1233px]:flex-row min-[1233px]:items-center justify-between gap-2.5 min-[1233px]:gap-3 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 min-w-0 w-full min-[1233px]:w-auto">
                        <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-[320px]">
                            {selectedFile ? selectedFile.split(/[/\\]/).pop() : ''}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono">
                            {t('tools.docs_reader.words_count', { count: wordCount })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono">
                            {t('tools.docs_reader.reading_time', { min: readingTimeMin })}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full min-[1233px]:w-auto min-[1233px]:shrink-0 -ml-2.5 min-[1233px]:ml-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={isCopiedDoc ? 'check' : 'content_copy'}
                            onClick={handleCopyDoc}
                            title={t('tools.docs_reader.copy_markdown')}
                            aria-label={t('tools.docs_reader.copy_markdown')}
                        >
                            {isCopiedDoc ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_markdown')}
                        </Button>
                        {headings.length > 0 && (
                            <Button
                                variant={showToc ? 'primary' : 'secondary'}
                                size="sm"
                                icon="format_list_bulleted"
                                onClick={() => setShowToc(!showToc)}
                            >
                                {t('tools.docs_reader.table_of_contents')} ({headings.length})
                            </Button>
                        )}
                        <button
                            type="button"
                            onClick={() => setReaderTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                            title={readerTheme === 'light' ? t('tools.docs_reader.switch_dark') : t('tools.docs_reader.switch_light')}
                            aria-label={readerTheme === 'light' ? t('tools.docs_reader.switch_dark') : t('tools.docs_reader.switch_light')}
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {readerTheme === 'light' ? 'dark_mode' : 'light_mode'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Collapsible Table of Contents */}
                {showToc && headings.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px]">toc</span>
                                {t('tools.docs_reader.table_of_contents')}
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-primary/15 text-primary">
                                    {filteredHeadings.length === headings.length ? headings.length : `${filteredHeadings.length}/${headings.length}`}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowToc(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                                aria-label="Close outline"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>

                        {/* Search/Filter Bar for Headings when headings > 8 */}
                        {headings.length > 8 && (
                            <div className="relative mb-2.5">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">
                                    search
                                </span>
                                <input
                                    type="text"
                                    value={tocFilter}
                                    onChange={(e) => setTocFilter(e.target.value)}
                                    placeholder={t('tools.docs_reader.filter_outline')}
                                    aria-label={t('tools.docs_reader.filter_outline')}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs outline-none focus:border-primary text-slate-800 dark:text-slate-200"
                                />
                                {tocFilter && (
                                    <button
                                        type="button"
                                        onClick={() => setTocFilter('')}
                                        aria-label="Clear filter"
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center p-0.5"
                                    >
                                        <span className="material-symbols-outlined text-[13px]">close</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Outline Items List */}
                        {filteredHeadings.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-400 italic">
                                {t('tools.docs_reader.no_headings_matching')}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 max-h-72 sm:max-h-84 overflow-y-auto pr-1">
                                {filteredHeadings.map((h, i) => (
                                    <button
                                        key={`${h.id}-${i}`}
                                        type="button"
                                        onClick={() => handleJumpToHeading(h.id)}
                                        className="w-full shrink-0 flex items-center justify-between text-left text-xs text-slate-700 dark:text-slate-300 hover:text-primary hover:bg-primary/10 rounded-md py-1.5 px-2 transition-colors cursor-pointer group"
                                        style={{ paddingLeft: `${(h.level - 1) * 14 + 8}px` }}
                                    >
                                        <span className="truncate">{h.text}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800 text-slate-400 group-hover:text-primary shrink-0 ml-2">
                                            H{h.level}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <MarkdownRenderer
                    content={mdContent}
                    rootPath={rootPath || ''}
                    readerTheme={readerTheme}
                    onLinkClick={handleLinkClick}
                />
            </div>
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
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={handleSelectFolder} className="text-sm" icon="folder_open">
                                {t('tools.docs_reader.open_folder')}
                            </Button>
                            <Button variant="secondary" onClick={handleCloseFolder} className="text-sm" icon="close">
                                {t('common.close') || 'Close'}
                            </Button>
                        </div>
                    ) : undefined
                }
            />

            {!rootPath ? (
                <div className="flex flex-col gap-6">
                    <Card title={t('tools.docs_reader.title')} gridCols="grid-cols-1">
                        <EmptyState
                            icon="menu_book"
                            title={t('tools.docs_reader.no_folder')}
                            description={t('tools.docs_reader.no_folder_desc')}
                            actionText={t('tools.docs_reader.btn_select')}
                            onAction={handleSelectFolder}
                        />
                    </Card>

                    {recentFolders.length > 0 && (
                        <Card title={t('tools.docs_reader.recent_folders')} gridCols="grid-cols-1">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-medium">
                                        {t('tools.docs_reader.recent_folders')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleClearRecent}
                                        className="text-xs text-rose-500 hover:underline"
                                    >
                                        {t('tools.docs_reader.clear_recent')}
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    {recentFolders.map((path) => (
                                        <div
                                            key={path}
                                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0">
                                                    folder
                                                </span>
                                                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                                                    {path}
                                                </span>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon="arrow_forward"
                                                onClick={() => handleOpenRecentFolder(path)}
                                            >
                                                {t('tools.docs_reader.open_folder')}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT PANE - TREEVIEW */}
                    <div className="w-full lg:col-span-3 lg:sticky lg:top-4 max-h-[calc(100vh-240px)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
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
                    <div className="w-full lg:col-span-9 min-w-0 overflow-hidden min-h-[500px] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {renderContent()}
                    </div>
                </div>
            )}
        </div>
    );
}
