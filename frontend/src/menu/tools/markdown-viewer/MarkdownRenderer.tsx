import { useEffect, useState, useContext, createContext, useMemo, isValidElement, Children, memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTranslation } from 'react-i18next';

mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    securityLevel: 'loose',
    logLevel: 5,
    fontFamily: 'inherit',
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    er: { useMaxWidth: false },
    pie: { useMaxWidth: false },
    state: { useMaxWidth: false }
});

interface MarkdownRendererProps {
    readonly content: string;
    readonly rootPath: string; // Used to resolve relative images if needed, though we rely on backend absolute path
    readonly readerTheme: 'light' | 'dark';
    readonly onLinkClick?: (href: string) => void;
}

interface MarkdownContextValue {
    readonly rootPath: string;
    readonly readerTheme: 'light' | 'dark';
    readonly onLinkClick?: (href: string) => void;
}

const MarkdownContext = createContext<MarkdownContextValue>({
    rootPath: '',
    readerTheme: 'light',
});

interface AdmonitionStyle {
    readonly icon: string;
    readonly defaultTitle: string;
    readonly lightBox: string;
    readonly darkBox: string;
    readonly lightHeader: string;
    readonly darkHeader: string;
}

const ADMONITION_STYLES: Record<string, AdmonitionStyle> = {
    tip: {
        icon: 'lightbulb',
        defaultTitle: 'Tip',
        lightBox: 'border-emerald-500 bg-emerald-50/70 text-slate-800',
        darkBox: 'border-emerald-500/80 bg-emerald-950/30 text-slate-200',
        lightHeader: 'text-emerald-700',
        darkHeader: 'text-emerald-400',
    },
    success: {
        icon: 'check_circle',
        defaultTitle: 'Success',
        lightBox: 'border-emerald-500 bg-emerald-50/70 text-slate-800',
        darkBox: 'border-emerald-500/80 bg-emerald-950/30 text-slate-200',
        lightHeader: 'text-emerald-700',
        darkHeader: 'text-emerald-400',
    },
    note: {
        icon: 'info',
        defaultTitle: 'Note',
        lightBox: 'border-sky-500 bg-sky-50/70 text-slate-800',
        darkBox: 'border-sky-500/80 bg-sky-950/30 text-slate-200',
        lightHeader: 'text-sky-700',
        darkHeader: 'text-sky-400',
    },
    important: {
        icon: 'priority_high',
        defaultTitle: 'Important',
        lightBox: 'border-violet-500 bg-violet-50/70 text-slate-800',
        darkBox: 'border-violet-500/80 bg-violet-950/30 text-slate-200',
        lightHeader: 'text-violet-700',
        darkHeader: 'text-violet-400',
    },
    warning: {
        icon: 'warning',
        defaultTitle: 'Warning',
        lightBox: 'border-amber-500 bg-amber-50/70 text-slate-800',
        darkBox: 'border-amber-500/80 bg-amber-950/30 text-slate-200',
        lightHeader: 'text-amber-700',
        darkHeader: 'text-amber-400',
    },
    danger: {
        icon: 'error',
        defaultTitle: 'Danger',
        lightBox: 'border-rose-500 bg-rose-50/70 text-slate-800',
        darkBox: 'border-rose-500/80 bg-rose-950/30 text-slate-200',
        lightHeader: 'text-rose-700',
        darkHeader: 'text-rose-400',
    },
};

const ADMONITION_TYPE_ALIASES: Record<string, keyof typeof ADMONITION_STYLES> = {
    tip: 'tip',
    hint: 'tip',
    success: 'success',
    check: 'success',
    done: 'success',
    note: 'note',
    info: 'note',
    todo: 'note',
    abstract: 'note',
    summary: 'note',
    important: 'important',
    question: 'important',
    help: 'important',
    faq: 'important',
    example: 'important',
    warning: 'warning',
    caution: 'warning',
    attention: 'warning',
    danger: 'danger',
    error: 'danger',
    failure: 'danger',
    fail: 'danger',
    bug: 'danger',
};

function resolveAdmonitionStyle(rawType: string): AdmonitionStyle {
    const normalized = rawType.toLowerCase();
    const key = ADMONITION_TYPE_ALIASES[normalized] || 'note';
    return ADMONITION_STYLES[key];
}

function parseMkDocsHeader(line: string): { type: string; title: string } | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('!!! ') && !trimmed.startsWith('??? ') && !trimmed.startsWith('???+ ')) {
        return null;
    }
    const rest = trimmed.replace(/^(?:!!!|\?\?\?\+?)\s+/, '');
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) {
        return rest ? { type: rest.toLowerCase(), title: '' } : null;
    }
    const type = rest.slice(0, spaceIdx).toLowerCase();
    let title = rest.slice(spaceIdx + 1).trim();
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
        title = title.slice(1, -1);
    }
    return { type, title };
}

function parseGitHubAlertHeader(line: string): { type: string; title: string } | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('>')) return null;
    const afterQuote = trimmed.slice(1).trimStart();
    if (!afterQuote.startsWith('[!')) return null;
    const closeIdx = afterQuote.indexOf(']');
    if (closeIdx <= 2) return null;
    const rawType = afterQuote.slice(2, closeIdx);
    if (!/^[a-zA-Z]+$/.test(rawType)) return null;
    const title = afterQuote.slice(closeIdx + 1).trim();
    return {
        type: rawType.toLowerCase(),
        title,
    };
}

function stripIndentUnit(line: string): string {
    if (line.startsWith('\t')) return line.slice(1);
    if (line.startsWith('    ')) return line.slice(4);
    if (line.startsWith('  ')) return line.slice(2);
    return line;
}

function isIndentedOrBlankNext(lines: string[], index: number): boolean {
    const line = lines[index];
    if (line.startsWith('    ') || line.startsWith('  ') || line.startsWith('\t')) {
        return true;
    }
    if (line.trim() === '') {
        // Keep blank line inside admonition if a subsequent line is still indented
        for (let k = index + 1; k < lines.length; k++) {
            if (lines[k].trim() === '') continue;
            return lines[k].startsWith('    ') || lines[k].startsWith('  ') || lines[k].startsWith('\t');
        }
    }
    return false;
}

function updateFenceState(trimmed: string, currentFence: string): { isFenceLine: boolean; nextFence: string } {
    if (!trimmed.startsWith('```') && !trimmed.startsWith('~~~')) {
        return { isFenceLine: false, nextFence: currentFence };
    }
    const marker = trimmed.slice(0, 3);
    if (!currentFence) {
        return { isFenceLine: true, nextFence: marker };
    }
    return {
        isFenceLine: true,
        nextFence: marker === currentFence ? '' : currentFence,
    };
}

function consumeMkDocsBlock(
    lines: string[],
    startIdx: number,
    header: { type: string; title: string },
    out: string[]
): number {
    out.push(`> [!ADMONITION:${header.type}:${header.title}]`, '>');
    let idx = startIdx + 1;
    while (idx < lines.length && isIndentedOrBlankNext(lines, idx)) {
        const bodyLine = stripIndentUnit(lines[idx]);
        out.push(bodyLine ? `> ${bodyLine}` : '>');
        idx += 1;
    }
    out.push('');
    return idx;
}

export function stripHtmlComments(markdown: string): string {
    if (!markdown) return '';
    const lines = markdown.replaceAll('\r\n', '\n').split('\n');
    const out: string[] = [];
    let fenceMarker = '';
    let inHtmlComment = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const fence = updateFenceState(line.trimStart(), fenceMarker);
        fenceMarker = fence.nextFence;

        // Inside code block or fence line itself: preserve untouched
        if (fence.isFenceLine || fenceMarker) {
            out.push(line);
            continue;
        }

        // Outside code fence: handle multi-line comment state
        if (inHtmlComment) {
            const closeIdx = line.indexOf('-->');
            if (closeIdx !== -1) {
                inHtmlComment = false;
                line = line.slice(closeIdx + 3);
            } else {
                continue;
            }
        }

        // Handle inline and multi-line comments starting on this line
        while (line.includes('<!--')) {
            const startIdx = line.indexOf('<!--');
            const endIdx = line.indexOf('-->', startIdx + 4);
            if (endIdx !== -1) {
                line = line.slice(0, startIdx) + line.slice(endIdx + 3);
            } else {
                line = line.slice(0, startIdx);
                inHtmlComment = true;
                break;
            }
        }

        // Normalize blanked comment line
        if (line.trim() === '') {
            line = '';
        }

        out.push(line);
    }

    return out.join('\n');
}

export function preprocessAdmonitions(markdown: string): string {
    if (!markdown) return '';
    const cleanMarkdown = stripHtmlComments(markdown);
    const lines = cleanMarkdown.split('\n');
    const out: string[] = [];
    let fenceMarker = '';
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const fence = updateFenceState(line.trimStart(), fenceMarker);
        fenceMarker = fence.nextFence;

        if (!fence.isFenceLine && !fenceMarker) {
            const mkHeader = parseMkDocsHeader(line);
            if (mkHeader) {
                i = consumeMkDocsBlock(lines, i, mkHeader, out);
                continue;
            }

            const ghHeader = parseGitHubAlertHeader(line);
            if (ghHeader) {
                out.push(`> [!ADMONITION:${ghHeader.type}:${ghHeader.title}]`, '>');
                i += 1;
                continue;
            }
        }

        out.push(line);
        i += 1;
    }

    return out.join('\n');
}

interface MermaidBlockProps {
    readonly code: string;
    readonly readerTheme: 'light' | 'dark';
}

let mermaidCounter = 0;

const MermaidBlock = memo(function MermaidBlock({ code, readerTheme }: MermaidBlockProps) {
    const { t } = useTranslation();
    const [svg, setSvg] = useState<string>('');

    useEffect(() => {
        let isMounted = true;
        const renderMermaid = async () => {
            mermaidCounter += 1;
            const id = `mermaid-svg-${mermaidCounter}`;
            try {
                const { svg } = await mermaid.render(id, code);
                const fixedSvg = svg.replace('<svg ', '<svg style="max-width: none; height: auto;" ');
                if (isMounted) setSvg(fixedSvg);
            } catch (err) {
                console.error('Mermaid render error:', err);
                if (isMounted) setSvg(`<div class="text-red-500 bg-red-100 p-2 rounded">${t('tools.docs_reader.render_error')}</div>`);
            }
        };
        renderMermaid();
        return () => { isMounted = false; };
    }, [code, readerTheme, t]);

    if (!svg) {
        return <div className="p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg">{t('tools.docs_reader.loading')}</div>;
    }

    return (
        <div className="relative group w-full max-w-full overflow-hidden flex justify-center my-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 not-prose">
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit={true}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded shadow-sm border border-slate-200 dark:border-slate-700 p-1">
                            <button type="button" title={t('tools.docs_reader.zoom_in')} onClick={() => zoomIn()} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                            </button>
                            <button type="button" title={t('tools.docs_reader.zoom_out')} onClick={() => zoomOut()} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                            </button>
                            <button type="button" title={t('tools.docs_reader.reset_zoom')} onClick={() => resetTransform()} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                            </button>
                        </div>
                        <TransformComponent wrapperClass="w-full cursor-grab active:cursor-grabbing">
                            <div dangerouslySetInnerHTML={{ __html: svg }} />
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </div>
    );
});

function extractNodeText(node: ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractNodeText).join('');
    if (isValidElement(node) && (node.props as any)?.children) {
        return extractNodeText((node.props as any).children);
    }
    return '';
}

function MarkdownBlockquote({ node, children, ...props }: any) {
    const { readerTheme } = useContext(MarkdownContext);
    const childArray = Children.toArray(children);

    const firstElementIdx = childArray.findIndex((child) => isValidElement(child));
    if (firstElementIdx !== -1) {
        const firstElementText = extractNodeText(childArray[firstElementIdx]).trim();
        const markerMatch = /^\[!ADMONITION:([a-zA-Z0-9_-]+):(.*)\]$/.exec(firstElementText);
        if (markerMatch) {
            const rawType = markerMatch[1];
            const customTitle = markerMatch[2].trim();
            const style = resolveAdmonitionStyle(rawType);
            const displayTitle = customTitle || style.defaultTitle;
            const bodyChildren = childArray.filter((_, idx) => idx !== firstElementIdx);
            const isDark = readerTheme === 'dark';

            return (
                <div
                    role="note"
                    className={`my-4 rounded-r-xl border-l-4 p-4 shadow-xs not-prose ${isDark ? style.darkBox : style.lightBox}`}
                >
                    <div className={`flex items-center gap-2 font-semibold text-sm mb-1.5 ${isDark ? style.darkHeader : style.lightHeader}`}>
                        <span className="material-symbols-outlined text-[18px] shrink-0">
                            {style.icon}
                        </span>
                        <span>{displayTitle}</span>
                    </div>
                    {bodyChildren.length > 0 && (
                        <div className={`prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 ${isDark ? 'prose-invert text-slate-200' : 'text-slate-700'}`}>
                            {bodyChildren}
                        </div>
                    )}
                </div>
            );
        }
    }

    return <blockquote {...props}>{children}</blockquote>;
}

const InPreContext = createContext<boolean>(false);

interface MarkdownPreProps {
    readonly children?: React.ReactNode;
    readonly [key: string]: any;
}

const MarkdownPre = memo(function MarkdownPre({ children, ...props }: MarkdownPreProps) {
    const { readerTheme } = useContext(MarkdownContext);
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const codeProps = isValidElement(children) ? (children.props as any) : null;
    const className = codeProps?.className || '';
    const match = /language-(\w+)/.exec(className);
    const lang = match ? match[1] : '';

    if (lang === 'mermaid') {
        const codeText = extractNodeText(codeProps?.children || children).replace(/\n$/, '');
        return <MermaidBlock code={codeText} readerTheme={readerTheme} />;
    }

    const codeText = extractNodeText(codeProps?.children || children).replace(/\n$/, '');

    const handleCopy = () => {
        if (!codeText) return;
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isDark = readerTheme === 'dark';

    return (
        <InPreContext.Provider value={true}>
            <div
                className={`relative group my-4 rounded-xl border overflow-hidden not-prose shadow-xs ${
                    isDark ? 'border-slate-700/80 bg-slate-900/90' : 'border-slate-200 bg-slate-900 text-slate-100'
                }`}
            >
                <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-slate-800 bg-slate-950/70 text-xs text-slate-400 select-none">
                    <span className="font-mono uppercase font-semibold text-[11px] tracking-wider text-slate-300">
                        {lang || 'code'}
                    </span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
                        title={copied ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_code')}
                        aria-label={copied ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_code')}
                    >
                        <span className="material-symbols-outlined text-[15px]">
                            {copied ? 'check' : 'content_copy'}
                        </span>
                        <span className="text-[11px] font-medium">
                            {copied ? t('tools.docs_reader.copied') : t('tools.docs_reader.copy_code')}
                        </span>
                    </button>
                </div>
                <pre
                    className="!m-0 p-4 overflow-x-auto text-xs font-mono text-slate-100 leading-relaxed bg-transparent"
                    {...props}
                >
                    {children}
                </pre>
            </div>
        </InPreContext.Provider>
    );
});

interface CodeBlockProps {
    readonly inline?: boolean;
    readonly className?: string;
    readonly children?: React.ReactNode;
    readonly [key: string]: any;
}

function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
    const inPre = useContext(InPreContext);
    const { readerTheme } = useContext(MarkdownContext);
    const match = /language-(\w+)/.exec(className || '');
    const isMermaid = match?.[1] === 'mermaid';

    if (isMermaid && !inPre) {
        return <MermaidBlock code={extractNodeText(children).replace(/\n$/, '')} readerTheme={readerTheme} />;
    }

    if (inPre) {
        return (
            <code className={className} {...props}>
                {children}
            </code>
        );
    }

    return (
        <code
            className={`px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 ${className || ''}`}
            {...props}
        >
            {children}
        </code>
    );
}

interface ImageRendererProps {
    readonly src?: string;
    readonly alt?: string;
    readonly [key: string]: any;
}

function ImageRenderer({ src, alt, ...props }: ImageRendererProps) {
    const { t } = useTranslation();
    const { rootPath, readerTheme } = useContext(MarkdownContext);
    const [imgSrc, setImgSrc] = useState<string>(src || '');
    const [isError, setIsError] = useState<boolean>(false);

    useEffect(() => {
        if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
            return;
        }

        let isMounted = true;
        const fetchLocalMedia = async () => {
            try {
                // Resolve path manually (assuming relative to rootPath or absolute)
                const isAbsolute = Boolean(/^([a-zA-Z]:[\\/]|[\\/])/.test(src));
                const absolutePath = isAbsolute ? src : `${rootPath}/${src}`.replaceAll('//', '/');
                
                const res = await (window as any).pywebview.api.md_get_media(absolutePath);
                if (res?.status === 'success' && isMounted) {
                    setImgSrc(res.data);
                } else if (isMounted) {
                    setIsError(true);
                }
            } catch {
                // Ignore local media resolution failure and fallback to error placeholder
                if (isMounted) setIsError(true);
            }
        };
        fetchLocalMedia();
        
        return () => { isMounted = false; };
    }, [src, rootPath]);

    if (isError) {
        return (
            <div className={`my-4 p-4 border-2 border-dashed flex items-center gap-2 rounded-lg text-sm ${readerTheme === 'dark' ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-300 bg-red-50 text-red-600'}`}>
                <span className="material-symbols-outlined">broken_image</span>
                <span>{alt || t('tools.docs_reader.broken_image')} ({src})</span>
            </div>
        );
    }

    return <img src={imgSrc} alt={alt} className={`max-w-full rounded-lg shadow-sm border my-4 ${readerTheme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`} {...props} />;
}

function MarkdownTable({ node, ...props }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" {...props} />
        </div>
    );
}

function MarkdownTh({ node, ...props }: any) {
    const { readerTheme } = useContext(MarkdownContext);
    return (
        <th
            className={`border-b p-2 font-semibold ${readerTheme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
            {...props}
        />
    );
}

function MarkdownTd({ node, ...props }: any) {
    const { readerTheme } = useContext(MarkdownContext);
    return (
        <td
            className={`border-b p-2 ${readerTheme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}
            {...props}
        />
    );
}

function MarkdownLink({ node, href, children, ...props }: any) {
    const { onLinkClick } = useContext(MarkdownContext);
    if (href?.startsWith('#')) {
        return (
            <a
                href={href}
                onClick={(e) => {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const el = document.getElementById(targetId);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="cursor-pointer text-primary hover:underline"
                {...props}
            >
                {children}
            </a>
        );
    }
    const isLocal = href && !href.startsWith('http') && !href.startsWith('mailto:');
    if (isLocal && onLinkClick) {
        return (
            <a 
                href={href} 
                onClick={(e) => {
                    e.preventDefault();
                    onLinkClick(href);
                }} 
                className="cursor-pointer text-primary hover:underline"
                {...props}
            >
                {children}
            </a>
        );
    }
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props}>
            {children}
        </a>
    );
}

const createHeading = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
    return function Heading({ children, className = '', ...props }: any) {
        const text = extractNodeText(children);
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        return <Tag id={id} className={`scroll-mt-6 ${className}`} {...props}>{children}</Tag>;
    };
};

const MARKDOWN_COMPONENTS = {
    blockquote: MarkdownBlockquote,
    pre: MarkdownPre,
    code: CodeBlock,
    img: ImageRenderer,
    table: MarkdownTable,
    th: MarkdownTh,
    td: MarkdownTd,
    a: MarkdownLink,
    h1: createHeading('h1'),
    h2: createHeading('h2'),
    h3: createHeading('h3'),
    h4: createHeading('h4'),
    h5: createHeading('h5'),
    h6: createHeading('h6'),
};

const REMARK_PLUGINS = [remarkGfm];

const MarkdownRenderer = memo(function MarkdownRenderer({ content, rootPath, readerTheme, onLinkClick }: MarkdownRendererProps) {
    // Initialize mermaid theme based on readerTheme
    useEffect(() => {
        mermaid.initialize({
            theme: readerTheme === 'dark' ? 'dark' : 'default',
            flowchart: { useMaxWidth: false },
            sequence: { useMaxWidth: false },
            journey: { useMaxWidth: false },
            gantt: { useMaxWidth: false },
            er: { useMaxWidth: false },
            pie: { useMaxWidth: false },
            state: { useMaxWidth: false }
        });
    }, [readerTheme]);

    const contextValue = useMemo<MarkdownContextValue>(
        () => ({ rootPath, readerTheme, onLinkClick }),
        [rootPath, readerTheme, onLinkClick]
    );

    const processedContent = useMemo(() => preprocessAdmonitions(content), [content]);

    return (
        <MarkdownContext.Provider value={contextValue}>
            <div className={`prose prose-slate max-w-none break-words prose-headings:font-semibold prose-a:text-primary hover:prose-a:text-primary/80 prose-img:m-0 ${readerTheme === 'dark' ? 'prose-invert' : ''}`}>
                <ReactMarkdown
                    remarkPlugins={REMARK_PLUGINS}
                    components={MARKDOWN_COMPONENTS}
                >
                    {processedContent}
                </ReactMarkdown>
            </div>
        </MarkdownContext.Provider>
    );
});

export default MarkdownRenderer;

