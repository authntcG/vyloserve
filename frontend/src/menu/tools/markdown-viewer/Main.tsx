import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../context/ToastContext';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';
import SkeletonDocument from '../../../components/skeleton/SkeletonDocument';
import MarkdownRenderer from './MarkdownRenderer';
import FolderTreeView, { type TreeNode, type WorkspaceFolder } from './FolderTreeView';
import PrivacyConsentModal from './PrivacyConsentModal';
import DocAiDrawer from './DocAiDrawer';

const RECENT_FOLDERS_KEY = 'vylo_recent_docs_folders';
const CONSENTED_PATHS_KEY = 'vylo_docs_ai_consented_paths';
const SIDEBAR_COLLAPSED_KEY = 'vylo_docs_sidebar_collapsed';

const getActiveFolderRoot = (
    filePath: string | null,
    folders: WorkspaceFolder[],
    fallbackRoot: string | null
): string | null => {
    if (!filePath) return fallbackRoot;
    const normalizedFile = filePath.replaceAll('\\', '/');
    const match = folders.find((f) => normalizedFile.startsWith(f.rootPath.replaceAll('\\', '/')));
    if (match) return match.rootPath;
    return fallbackRoot;
};

interface HeadingItem {
    readonly level: number;
    readonly text: string;
    readonly id: string;
}

const calculateSidebarEdge = (): number => {
    if (typeof window === 'undefined') return 260;
    if (window.innerWidth < 768) return 0;
    const nav = document.querySelector('nav');
    if (!nav) return 260;
    const right = nav.getBoundingClientRect().right;
    return right > 0 ? right : 260;
};

const getCenterPaneColSpan = (collapsed: boolean, aiOpen: boolean): string => {
    if (collapsed) {
        return aiOpen ? 'lg:col-span-8' : 'lg:col-span-12';
    }
    return aiOpen ? 'lg:col-span-5' : 'lg:col-span-9';
};

const getPeekHandleThemeClass = (peeking: boolean, dark: boolean): string => {
    if (peeking) return 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30';
    if (dark) return 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300 hover:text-primary hover:border-primary/60 hover:shadow-primary/10';
    return 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-primary hover:border-primary/60 hover:shadow-slate-300';
};

const getToggleBtnClass = (isActive: boolean, dark: boolean): string => {
    if (isActive) return 'bg-primary text-white border-primary';
    if (dark) return 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800';
    return 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-2xs';
};

interface DocTopBarProps {
    readonly isReaderDark: boolean;
    readonly isSidebarCollapsed: boolean;
    readonly selectedFile: string;
    readonly wordCount: number;
    readonly readingTimeMin: number;
    readonly isCopiedDoc: boolean;
    readonly showToc: boolean;
    readonly headingsCount: number;
    readonly readerTheme: 'light' | 'dark';
    readonly isFullscreen: boolean;
    readonly isAiDrawerOpen: boolean;
    readonly isCurrentFolderAiEnabled: boolean;
    readonly onPinSidebar: () => void;
    readonly onPeekMouseEnter: () => void;
    readonly onPeekMouseLeave: () => void;
    readonly onCopyDoc: () => void;
    readonly onToggleToc: () => void;
    readonly onToggleTheme: () => void;
    readonly onToggleFullscreen: () => void;
    readonly onToggleAiDrawer: () => void;
}

interface DocMetaInfoProps {
    readonly isReaderDark: boolean;
    readonly isSidebarCollapsed: boolean;
    readonly selectedFile: string;
    readonly wordCount: number;
    readonly readingTimeMin: number;
    readonly onPinSidebar: () => void;
    readonly onPeekMouseEnter: () => void;
    readonly onPeekMouseLeave: () => void;
}

function DocMetaInfo({
    isReaderDark,
    isSidebarCollapsed,
    selectedFile,
    wordCount,
    readingTimeMin,
    onPinSidebar,
    onPeekMouseEnter,
    onPeekMouseLeave,
}: DocMetaInfoProps) {
    const { t } = useTranslation();
    const fileName = selectedFile.split(/[/\\]/).pop() || '';

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 min-w-0 w-full min-[1233px]:w-auto">
            {isSidebarCollapsed && (
                <button
                    type="button"
                    onClick={onPinSidebar}
                    onMouseEnter={onPeekMouseEnter}
                    onMouseLeave={onPeekMouseLeave}
                    title={t('tools.docs_reader.pin_sidebar')}
                    aria-label={t('tools.docs_reader.pin_sidebar')}
                    className={`p-1.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-colors cursor-pointer mr-0.5 ${
                        isReaderDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                            : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-2xs'
                    }`}
                >
                    <span className="material-symbols-outlined text-[16px] text-primary">
                        dock_to_left
                    </span>
                </button>
            )}
            <span className="material-symbols-outlined text-[16px] text-primary">description</span>
            <span className={`font-medium truncate max-w-[200px] md:max-w-[320px] ${isReaderDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {fileName}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono border ${isReaderDark ? 'bg-slate-900 text-slate-300 border-slate-800' : 'bg-slate-200/60 text-slate-600 border-slate-200'}`}>
                {t('tools.docs_reader.words_count', { count: wordCount })} · {t('tools.docs_reader.reading_time', { min: readingTimeMin })}
            </span>
        </div>
    );
}

interface DocActionBarProps {
    readonly isReaderDark: boolean;
    readonly isCopiedDoc: boolean;
    readonly showToc: boolean;
    readonly headingsCount: number;
    readonly readerTheme: 'light' | 'dark';
    readonly isFullscreen: boolean;
    readonly isAiDrawerOpen: boolean;
    readonly isCurrentFolderAiEnabled: boolean;
    readonly onCopyDoc: () => void;
    readonly onToggleToc: () => void;
    readonly onToggleTheme: () => void;
    readonly onToggleFullscreen: () => void;
    readonly onToggleAiDrawer: () => void;
}

function DocActionBar({
    isReaderDark,
    isCopiedDoc,
    showToc,
    headingsCount,
    readerTheme,
    isFullscreen,
    isAiDrawerOpen,
    isCurrentFolderAiEnabled,
    onCopyDoc,
    onToggleToc,
    onToggleTheme,
    onToggleFullscreen,
    onToggleAiDrawer,
}: DocActionBarProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-2 flex-wrap w-full min-[1233px]:w-auto min-[1233px]:shrink-0 -ml-2.5 min-[1233px]:ml-0">
            <button
                type="button"
                onClick={onCopyDoc}
                title={t('tools.docs_reader.copy_markdown')}
                aria-label={t('tools.docs_reader.copy_markdown')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isReaderDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                        : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-2xs'
                }`}
            >
                <span className="material-symbols-outlined text-[16px]">
                    {isCopiedDoc ? 'check' : 'content_copy'}
                </span>
                <span className="hidden sm:inline">
                    {isCopiedDoc ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_markdown')}
                </span>
            </button>
            {headingsCount > 0 && (
                <button
                    type="button"
                    onClick={onToggleToc}
                    title={t('tools.docs_reader.table_of_contents')}
                    aria-label={`${t('tools.docs_reader.table_of_contents')} (${headingsCount})`}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${getToggleBtnClass(showToc, isReaderDark)}`}
                >
                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                    <span>
                        {t('tools.docs_reader.table_of_contents')} ({headingsCount})
                    </span>
                </button>
            )}
            <button
                type="button"
                onClick={onToggleTheme}
                className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                    isReaderDark
                        ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-primary'
                        : 'bg-white border-slate-300 text-slate-600 hover:text-primary shadow-2xs'
                }`}
                title={readerTheme === 'light' ? t('tools.docs_reader.switch_dark') : t('tools.docs_reader.switch_light')}
                aria-label={readerTheme === 'light' ? t('tools.docs_reader.switch_dark') : t('tools.docs_reader.switch_light')}
            >
                <span className="material-symbols-outlined text-[16px]">
                    {readerTheme === 'light' ? 'dark_mode' : 'light_mode'}
                </span>
            </button>
            <button
                type="button"
                onClick={onToggleFullscreen}
                className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                    isReaderDark
                        ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-primary'
                        : 'bg-white border-slate-300 text-slate-600 hover:text-primary shadow-2xs'
                }`}
                title={isFullscreen ? t('tools.docs_reader.exit_fullscreen') : t('tools.docs_reader.fullscreen')}
                aria-label={isFullscreen ? t('tools.docs_reader.exit_fullscreen') : t('tools.docs_reader.fullscreen')}
            >
                <span className="material-symbols-outlined text-[16px]">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
            </button>

            {/* AI Doc Copilot Toggle */}
            <button
                type="button"
                onClick={onToggleAiDrawer}
                title={isCurrentFolderAiEnabled ? t('tools.docs_reader.ai_copilot') : t('tools.docs_reader.privacy_status_off')}
                aria-label={isCurrentFolderAiEnabled ? t('tools.docs_reader.ai_copilot') : t('tools.docs_reader.privacy_status_off')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${getToggleBtnClass(isAiDrawerOpen, isReaderDark)}`}
            >
                <span className="material-symbols-outlined text-[16px]">
                    {isCurrentFolderAiEnabled ? 'psychology' : 'lock'}
                </span>
                <span className="hidden sm:inline">
                    {isCurrentFolderAiEnabled ? t('tools.docs_reader.ai_copilot') : t('tools.docs_reader.privacy_status_off')}
                </span>
            </button>
        </div>
    );
}

function DocTopBar({
    isReaderDark,
    isSidebarCollapsed,
    selectedFile,
    wordCount,
    readingTimeMin,
    isCopiedDoc,
    showToc,
    headingsCount,
    readerTheme,
    isFullscreen,
    isAiDrawerOpen,
    isCurrentFolderAiEnabled,
    onPinSidebar,
    onPeekMouseEnter,
    onPeekMouseLeave,
    onCopyDoc,
    onToggleToc,
    onToggleTheme,
    onToggleFullscreen,
    onToggleAiDrawer,
}: DocTopBarProps) {
    return (
        <div className={`flex flex-col min-[1233px]:flex-row min-[1233px]:items-center justify-between gap-2.5 min-[1233px]:gap-3 p-4 border-b shrink-0 ${isReaderDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <DocMetaInfo
                isReaderDark={isReaderDark}
                isSidebarCollapsed={isSidebarCollapsed}
                selectedFile={selectedFile}
                wordCount={wordCount}
                readingTimeMin={readingTimeMin}
                onPinSidebar={onPinSidebar}
                onPeekMouseEnter={onPeekMouseEnter}
                onPeekMouseLeave={onPeekMouseLeave}
            />
            <DocActionBar
                isReaderDark={isReaderDark}
                isCopiedDoc={isCopiedDoc}
                showToc={showToc}
                headingsCount={headingsCount}
                readerTheme={readerTheme}
                isFullscreen={isFullscreen}
                isAiDrawerOpen={isAiDrawerOpen}
                isCurrentFolderAiEnabled={isCurrentFolderAiEnabled}
                onCopyDoc={onCopyDoc}
                onToggleToc={onToggleToc}
                onToggleTheme={onToggleTheme}
                onToggleFullscreen={onToggleFullscreen}
                onToggleAiDrawer={onToggleAiDrawer}
            />
        </div>
    );
}

interface DocTocPanelProps {
    readonly isReaderDark: boolean;
    readonly totalHeadings: number;
    readonly filteredHeadings: HeadingItem[];
    readonly tocFilter: string;
    readonly onCloseToc: () => void;
    readonly onFilterChange: (val: string) => void;
    readonly onClearFilter: () => void;
    readonly onJumpToHeading: (id: string) => void;
}

function DocTocPanel({
    isReaderDark,
    totalHeadings,
    filteredHeadings,
    tocFilter,
    onCloseToc,
    onFilterChange,
    onClearFilter,
    onJumpToHeading,
}: DocTocPanelProps) {
    const { t } = useTranslation();

    return (
        <div className={`shrink-0 mx-4 mt-3 p-4 rounded-xl border transition-colors ${isReaderDark ? 'border-primary/30 bg-slate-900/90' : 'border-primary/20 bg-primary/5'}`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">toc</span>
                    {t('tools.docs_reader.table_of_contents')}
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-primary/15 text-primary">
                        {filteredHeadings.length === totalHeadings ? totalHeadings : `${filteredHeadings.length}/${totalHeadings}`}
                    </span>
                </span>
                <button
                    type="button"
                    onClick={onCloseToc}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                    aria-label="Close outline"
                >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
            </div>

            {/* Search/Filter Bar for Headings when headings > 8 */}
            {totalHeadings > 8 && (
                <div className="relative mb-2.5">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">
                        search
                    </span>
                    <input
                        type="text"
                        value={tocFilter}
                        onChange={(e) => onFilterChange(e.target.value)}
                        placeholder={t('tools.docs_reader.filter_outline')}
                        aria-label={t('tools.docs_reader.filter_outline')}
                        className={`w-full border rounded-lg pl-8 pr-7 py-1 text-xs outline-none focus:border-primary ${
                            isReaderDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                    />
                    {tocFilter && (
                        <button
                            type="button"
                            onClick={onClearFilter}
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
                            onClick={() => onJumpToHeading(h.id)}
                            className={`w-full shrink-0 flex items-center justify-between text-left text-xs rounded-md py-1.5 px-2 transition-colors cursor-pointer group ${
                                isReaderDark
                                    ? 'text-slate-300 hover:text-primary hover:bg-slate-800/60'
                                    : 'text-slate-700 hover:text-primary hover:bg-primary/10'
                            }`}
                            style={{ paddingLeft: `${(h.level - 1) * 14 + 8}px` }}
                        >
                            <span className="truncate">{h.text}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded group-hover:text-primary shrink-0 ml-2 ${
                                isReaderDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/50 text-slate-400'
                            }`}>
                                H{h.level}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function MarkdownViewer() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    
    const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>([]);
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [mdContent, setMdContent] = useState<string>('');
    const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
    const [isRefreshingTree, setIsRefreshingTree] = useState<boolean>(false);
    const [showToc, setShowToc] = useState<boolean>(false);
    const [tocFilter, setTocFilter] = useState<string>('');
    const [isCopiedDoc, setIsCopiedDoc] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Escape hotkey to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        if (isFullscreen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // AI Copilot & Privacy states (Per-folder consent)
    const [consentedPaths, setConsentedPaths] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(CONSENTED_PATHS_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
    const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
    const [providerInfo, setProviderInfo] = useState<any>(null);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
        } catch {
            // ignore
        }
    }, [isSidebarCollapsed]);

    // Peek Drawer state & timers
    const [isPeeking, setIsPeeking] = useState<boolean>(false);
    const peekEnterTimerRef = useRef<any>(null);
    const peekLeaveTimerRef = useRef<any>(null);

    // Track dynamic sidebar right edge to keep Edge Arrow flush against app sidebar
    const [sidebarRightEdge, setSidebarRightEdge] = useState<number>(calculateSidebarEdge);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updatePos = () => {
            setSidebarRightEdge(calculateSidebarEdge());
        };

        updatePos();
        window.addEventListener('resize', updatePos);

        const nav = document.querySelector('nav');
        let observer: ResizeObserver | null = null;
        if (nav && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(updatePos);
            observer.observe(nav);
        }

        return () => {
            window.removeEventListener('resize', updatePos);
            if (observer) observer.disconnect();
        };
    }, []);

    const handlePeekMouseEnter = useCallback(() => {
        if (peekLeaveTimerRef.current) {
            clearTimeout(peekLeaveTimerRef.current);
            peekLeaveTimerRef.current = null;
        }
        if (!isPeeking) {
            peekEnterTimerRef.current = setTimeout(() => {
                setIsPeeking(true);
            }, 120);
        }
    }, [isPeeking]);

    const handlePeekMouseLeave = useCallback(() => {
        if (peekEnterTimerRef.current) {
            clearTimeout(peekEnterTimerRef.current);
            peekEnterTimerRef.current = null;
        }
        peekLeaveTimerRef.current = setTimeout(() => {
            setIsPeeking(false);
        }, 350);
    }, []);

    const handlePinSidebar = useCallback((e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (peekEnterTimerRef.current) {
            clearTimeout(peekEnterTimerRef.current);
            peekEnterTimerRef.current = null;
        }
        if (peekLeaveTimerRef.current) {
            clearTimeout(peekLeaveTimerRef.current);
            peekLeaveTimerRef.current = null;
        }
        setIsPeeking(false);
        setIsSidebarCollapsed(false);
    }, []);

    const activeFolderRoot = useMemo(
        () => getActiveFolderRoot(selectedFile, workspaceFolders, rootPath),
        [selectedFile, workspaceFolders, rootPath]
    );

    const isCurrentFolderAiEnabled = Boolean(activeFolderRoot && consentedPaths.includes(activeFolderRoot));

    // Automatically close AI drawer if document switched to an unconsented folder
    useEffect(() => {
        if (isAiDrawerOpen && !isCurrentFolderAiEnabled) {
            setIsAiDrawerOpen(false);
        }
    }, [isCurrentFolderAiEnabled, isAiDrawerOpen]);

    // Fetch AI provider info on mount
    useEffect(() => {
        const fetchProvider = async () => {
            try {
                const api = (window as any).pywebview?.api;
                if (api?.ai_get_doc_provider_info) {
                    const res = await api.ai_get_doc_provider_info();
                    if (res?.status === 'success') {
                        setProviderInfo(res.data);
                    }
                }
            } catch {
                // ignore
            }
        };
        fetchProvider();
    }, []);

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
    const isReaderDark = readerTheme === 'dark';

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

    const openSingleOrAddWorkspaceFolder = useCallback(
        async (folderPath: string, isAppend: boolean) => {
            const api = (window as any).pywebview?.api;
            if (!api) return;

            if (isAppend && workspaceFolders.some((f) => f.rootPath === folderPath)) {
                showToast(t('tools.docs_reader.folder_already_added'), 'info');
                return;
            }

            const treeRes = await api.md_get_tree(folderPath);
            if (treeRes?.status === 'success') {
                const newChildren: TreeNode[] = treeRes.data || [];
                const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
                const newFolder: WorkspaceFolder = {
                    rootPath: folderPath,
                    name: folderName,
                    children: newChildren
                };

                const updatedFolders = isAppend ? [...workspaceFolders, newFolder] : [newFolder];
                setWorkspaceFolders(updatedFolders);
                setRootPath(updatedFolders[0].rootPath);
                setTreeData(updatedFolders[0].children as TreeNode[]);
                saveRecentFolder(folderPath);

                if (api.md_register_roots) {
                    api.md_register_roots(updatedFolders.map((f) => f.rootPath));
                }

                if (!selectedFile || !isAppend) {
                    const defaultFile = findDefaultFile(newChildren);
                    if (defaultFile) {
                        handleFileClick(defaultFile);
                    } else if (!isAppend) {
                        setSelectedFile(null);
                        setMdContent('');
                    }
                }
            }
        },
        [workspaceFolders, selectedFile, showToast, t]
    );

    const handleSelectFolder = async () => {
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const res = await api.md_select_directory();
            if (res?.status === 'success' && res.data) {
                await openSingleOrAddWorkspaceFolder(res.data, false);
            }
        } catch (err) {
            console.error('Failed to select folder', err);
        }
    };

    const handleAddFolder = async () => {
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const res = await api.md_select_directory();
            if (res?.status === 'success' && res.data) {
                await openSingleOrAddWorkspaceFolder(res.data, true);
            }
        } catch (err) {
            console.error('Failed to add folder to workspace', err);
        }
    };

    const handleRemoveFolder = useCallback(
        (targetPath: string) => {
            setWorkspaceFolders((prev) => {
                const filtered = prev.filter((f) => f.rootPath !== targetPath);
                if (filtered.length === 0) {
                    setRootPath(null);
                    setTreeData([]);
                    setSelectedFile(null);
                    setMdContent('');
                    return [];
                }
                setRootPath(filtered[0].rootPath);
                setTreeData(filtered[0].children as TreeNode[]);
                const api = (window as any).pywebview?.api;
                if (api?.md_register_roots) {
                    api.md_register_roots(filtered.map((f) => f.rootPath));
                }
                return filtered;
            });

            if (selectedFile?.startsWith(targetPath)) {
                setSelectedFile(null);
                setMdContent('');
            }
        },
        [selectedFile]
    );

    const handleRefreshFolder = useCallback(async (targetPath: string) => {
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            const treeRes = await api.md_get_tree(targetPath);
            if (treeRes?.status === 'success') {
                const refreshedChildren: TreeNode[] = treeRes.data || [];
                setWorkspaceFolders((prev) =>
                    prev.map((f) => (f.rootPath === targetPath ? { ...f, children: refreshedChildren } : f))
                );
            }
        } catch (err) {
            console.error('Failed to refresh folder', err);
        }
    }, []);

    const handleRefreshTree = async () => {
        if (!rootPath || isRefreshingTree) return;
        setIsRefreshingTree(true);
        try {
            const api = (window as any).pywebview?.api;
            if (!api) return;
            if (workspaceFolders.length > 0) {
                const updated: WorkspaceFolder[] = [];
                for (const folder of workspaceFolders) {
                    const treeRes = await api.md_get_tree(folder.rootPath);
                    updated.push({
                        ...folder,
                        children: treeRes?.status === 'success' ? treeRes.data : folder.children
                    });
                }
                setWorkspaceFolders(updated);
                setTreeData(updated[0].children as TreeNode[]);
            } else {
                const treeRes = await api.md_get_tree(rootPath);
                if (treeRes?.status === 'success' && Array.isArray(treeRes.data)) {
                    setTreeData(treeRes.data);
                }
            }
        } catch (err) {
            console.error('Failed to refresh folder tree', err);
        } finally {
            setIsRefreshingTree(false);
        }
    };

    const handleOpenRecentFolder = async (folderPath: string) => {
        await openSingleOrAddWorkspaceFolder(folderPath, false);
    };

    const handleCloseFolder = useCallback(() => {
        setRootPath(null);
        setWorkspaceFolders([]);
        setTreeData([]);
        setSelectedFile(null);
        setMdContent('');
        setShowToc(false);
        setTocFilter('');
        setIsCopiedDoc(false);
        setIsAiDrawerOpen(false);
    }, []);

    const handleEnableAi = useCallback(() => {
        if (activeFolderRoot) {
            setConsentedPaths((prev) => {
                const updated = prev.includes(activeFolderRoot) ? prev : [...prev, activeFolderRoot];
                try {
                    localStorage.setItem(CONSENTED_PATHS_KEY, JSON.stringify(updated));
                } catch {
                    // ignore
                }
                return updated;
            });
        }
        setIsPrivacyModalOpen(false);
        setIsAiDrawerOpen(true);
        setIsSidebarCollapsed(true);
        showToast(t('tools.docs_reader.privacy_status_on'), 'success');
    }, [activeFolderRoot, showToast, t]);

    const handleDisableAi = useCallback(() => {
        if (activeFolderRoot) {
            setConsentedPaths((prev) => {
                const updated = prev.filter((p) => p !== activeFolderRoot);
                try {
                    localStorage.setItem(CONSENTED_PATHS_KEY, JSON.stringify(updated));
                } catch {
                    // ignore
                }
                return updated;
            });
        }
        setIsPrivacyModalOpen(false);
        setIsAiDrawerOpen(false);
        showToast(t('tools.docs_reader.privacy_status_off'), 'info');
    }, [activeFolderRoot, showToast, t]);

    const handleToggleAiDrawer = useCallback(() => {
        if (!isCurrentFolderAiEnabled) {
            setIsPrivacyModalOpen(true);
        } else {
            setIsAiDrawerOpen((prev) => {
                const next = !prev;
                if (next) {
                    setIsSidebarCollapsed(true);
                }
                return next;
            });
        }
    }, [isCurrentFolderAiEnabled]);

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

            const match = /^(#{1,6})\s+(\S.*)$/.exec(line);
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

        const isReaderDark = readerTheme === 'dark';

        return (
            <div className="flex flex-col h-full min-h-0 select-text">
                <DocTopBar
                    isReaderDark={isReaderDark}
                    isSidebarCollapsed={isSidebarCollapsed}
                    selectedFile={selectedFile}
                    wordCount={wordCount}
                    readingTimeMin={readingTimeMin}
                    isCopiedDoc={isCopiedDoc}
                    showToc={showToc}
                    headingsCount={headings.length}
                    readerTheme={readerTheme}
                    isFullscreen={isFullscreen}
                    isAiDrawerOpen={isAiDrawerOpen}
                    isCurrentFolderAiEnabled={isCurrentFolderAiEnabled}
                    onPinSidebar={handlePinSidebar}
                    onPeekMouseEnter={handlePeekMouseEnter}
                    onPeekMouseLeave={handlePeekMouseLeave}
                    onCopyDoc={handleCopyDoc}
                    onToggleToc={() => setShowToc(!showToc)}
                    onToggleTheme={() => setReaderTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
                    onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                    onToggleAiDrawer={handleToggleAiDrawer}
                />

                {showToc && headings.length > 0 && (
                    <DocTocPanel
                        isReaderDark={isReaderDark}
                        totalHeadings={headings.length}
                        filteredHeadings={filteredHeadings}
                        tocFilter={tocFilter}
                        onCloseToc={() => setShowToc(false)}
                        onFilterChange={(val) => setTocFilter(val)}
                        onClearFilter={() => setTocFilter('')}
                        onJumpToHeading={handleJumpToHeading}
                    />
                )}

                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <MarkdownRenderer
                        content={mdContent}
                        rootPath={rootPath || ''}
                        readerTheme={readerTheme}
                        onLinkClick={handleLinkClick}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full h-full gap-4">
            <div className="shrink-0">
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
                                    {t('tools.docs_reader.close_workspace')}
                                </Button>
                            </div>
                        ) : undefined
                    }
                />
            </div>

            {!rootPath ? (
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6 custom-scrollbar pb-4 pr-1">
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
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-stretch">
                    {/* LEFT PANE - TREEVIEW */}
                    {!isSidebarCollapsed && (
                        <div
                            className="w-full lg:col-span-3 h-full min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs"
                        >
                            <div className="flex items-center justify-between mb-2 px-1 shrink-0 gap-1 min-w-0">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate min-w-0 flex-1">
                                    {workspaceFolders.length > 1 ? t('tools.docs_reader.workspace_title') : t('tools.docs_reader.tree_title')}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleAddFolder}
                                        title={t('tools.docs_reader.add_folder')}
                                        aria-label={t('tools.docs_reader.add_folder')}
                                        className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">create_new_folder</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRefreshTree}
                                        disabled={isRefreshingTree}
                                        title={t('tools.docs_reader.refresh_tree')}
                                        aria-label={t('tools.docs_reader.refresh_tree')}
                                        className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
                                    >
                                        <span className={`material-symbols-outlined text-[15px] ${isRefreshingTree ? 'animate-spin' : ''}`}>
                                            refresh
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsSidebarCollapsed(true)}
                                        title={t('tools.docs_reader.hide_sidebar')}
                                        aria-label={t('tools.docs_reader.hide_sidebar')}
                                        className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">dock_to_left</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                                <FolderTreeView 
                                    data={treeData}
                                    workspaceFolders={workspaceFolders}
                                    onSelectFile={handleFileClick} 
                                    activePath={selectedFile}
                                    onRemoveFolder={handleRemoveFolder}
                                    onRefreshFolder={handleRefreshFolder}
                                />
                            </div>
                        </div>
                    )}

                    {/* CENTER PANE - CONTENT */}
                    {!isFullscreen && (
                        <div className={`w-full ${getCenterPaneColSpan(isSidebarCollapsed, isAiDrawerOpen)} h-full min-h-0 relative min-w-0 flex flex-col`}>
                            {/* Document Content Card */}
                            <div className={`w-full h-full min-h-0 border rounded-xl shadow-xs transition-colors flex flex-col overflow-hidden ${
                                isReaderDark 
                                    ? 'bg-[#0b0f19] text-slate-100 border-slate-800' 
                                    : 'bg-[#fafbfc] text-slate-800 border-slate-200'
                            }`}>
                                {renderContent()}
                            </div>
                        </div>
                    )}

                    {/* RIGHT PANE - AI DRAWER */}
                    {isAiDrawerOpen && (
                        <div
                            className="w-full lg:col-span-4 h-full min-h-0 flex flex-col rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800"
                        >
                            <DocAiDrawer
                                isOpen={isAiDrawerOpen}
                                onClose={() => setIsAiDrawerOpen(false)}
                                docContent={mdContent}
                                docPath={selectedFile}
                                folderPath={activeFolderRoot}
                                isAiEnabled={isCurrentFolderAiEnabled}
                                onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
                                providerInfo={providerInfo}
                                onOpenFile={handleFileClick}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* EDGE ARROW HANDLE (Hover to Peek, Click to Pin) */}
            {isSidebarCollapsed && rootPath && !isFullscreen && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${sidebarRightEdge}px`,
                        top: 'calc(var(--header-mobile-height, 0px) + (100vh - var(--header-mobile-height, 0px) - var(--system-logs-height, 196px)) / 2)',
                        transform: 'translateY(-50%)',
                        zIndex: 45,
                    }}
                    className="flex items-center"
                    onMouseEnter={handlePeekMouseEnter}
                    onMouseLeave={handlePeekMouseLeave}
                >
                    <button
                        type="button"
                        onClick={handlePinSidebar}
                        title={t('tools.docs_reader.peek_handle')}
                        aria-label={t('tools.docs_reader.peek_handle')}
                        className={`w-8 sm:w-9 h-20 sm:h-24 rounded-r-xl border-y border-r shadow-xl flex items-center justify-center cursor-pointer transition-all duration-200 group select-none active:scale-95 ${getPeekHandleThemeClass(isPeeking, isReaderDark)}`}
                    >
                        <span className="material-symbols-outlined text-[20px] font-bold text-primary transition-transform duration-200 group-hover:scale-125 group-hover:translate-x-0.5 pointer-events-none">
                            chevron_right
                        </span>
                    </button>
                </div>
            )}

            {/* PEEK DRAWER OVERLAY */}
            {isPeeking && isSidebarCollapsed && rootPath && !isFullscreen && (
                <>
                    <button
                        type="button"
                        aria-label="Close peek drawer"
                        className="fixed inset-0 bg-black/20 z-40 transition-opacity cursor-default border-0 p-0"
                        onClick={() => setIsPeeking(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsPeeking(false);
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: `${sidebarRightEdge + 38}px`,
                            top: 'calc(var(--header-mobile-height, 0px) + 24px)',
                            bottom: 'calc(var(--system-logs-height, 196px) + 16px)',
                            width: '20rem',
                            zIndex: 50,
                        }}
                        className="fixed bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col p-3 animate-in slide-in-from-left duration-200"
                        onMouseEnter={handlePeekMouseEnter}
                        onMouseLeave={handlePeekMouseLeave}
                    >
                        <div className="flex items-center justify-between mb-2 px-1 shrink-0 gap-1 min-w-0 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate min-w-0 flex-1">
                                {workspaceFolders.length > 1 ? t('tools.docs_reader.workspace_title') : t('tools.docs_reader.tree_title')}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={handlePinSidebar}
                                    title={t('tools.docs_reader.pin_sidebar')}
                                    aria-label={t('tools.docs_reader.pin_sidebar')}
                                    className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPeeking(false)}
                                    title={t('common.close')}
                                    aria-label={t('common.close')}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                            <FolderTreeView 
                                data={treeData}
                                workspaceFolders={workspaceFolders}
                                onSelectFile={(path) => {
                                    handleFileClick(path);
                                    setIsPeeking(false);
                                }} 
                                activePath={selectedFile}
                                onRemoveFolder={handleRemoveFolder}
                                onRefreshFolder={handleRefreshFolder}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* FULLSCREEN OVERLAY */}
            {isFullscreen && selectedFile && (
                <div
                    className={`fixed inset-0 z-50 p-6 md:p-10 overflow-y-auto flex flex-col ${
                        isReaderDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-[#fafbfc] text-slate-800'
                    }`}
                >
                    <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
                        {renderContent()}
                    </div>
                </div>
            )}

            <PrivacyConsentModal
                isOpen={isPrivacyModalOpen}
                onClose={() => setIsPrivacyModalOpen(false)}
                onConfirm={handleEnableAi}
                onDisable={handleDisableAi}
                isAiEnabled={isCurrentFolderAiEnabled}
                folderPath={activeFolderRoot}
                providerInfo={providerInfo}
            />
        </div>
    );
}
