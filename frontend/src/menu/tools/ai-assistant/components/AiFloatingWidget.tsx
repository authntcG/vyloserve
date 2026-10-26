import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiAssistant } from '../../../../context/AiContext';
import AiChatMessage, { extractVyloSuggestions } from './AiChatMessage';
import AiChatInput, { type AiChatInputHandle } from './AiChatInput';
import { formatTokens } from './AiUsageBadge';
import Button from '../../../../components/Button';
import InfoBox from '../../../../components/InfoBox';
import Select from '../../../../components/Select';
import SkeletonChatMessage from '../../../../components/skeleton/SkeletonChatMessage';

interface AiFloatingWidgetProps {
    readonly activeScreen: string;
    readonly onOpenFullPage: () => void;
}

type Direction = 'top' | 'bottom' | 'left' | 'right';

interface DirectionSpaces {
    fitsTop: boolean;
    fitsBottom: boolean;
    fitsLeft: boolean;
    fitsRight: boolean;
    spaceAbove: number;
    spaceBelow: number;
}

function resolveBottomHalfDirection(isRightHalf: boolean, spaces: DirectionSpaces): Direction {
    if (spaces.fitsTop) return 'top';
    if (isRightHalf && spaces.fitsLeft) return 'left';
    if (spaces.fitsRight) return 'right';
    if (spaces.fitsBottom) return 'bottom';
    return spaces.spaceAbove >= spaces.spaceBelow ? 'top' : 'bottom';
}

function resolveTopHalfDirection(isRightHalf: boolean, spaces: DirectionSpaces): Direction {
    if (spaces.fitsBottom) return 'bottom';
    if (isRightHalf && spaces.fitsLeft) return 'left';
    if (spaces.fitsRight) return 'right';
    if (spaces.fitsTop) return 'top';
    return spaces.spaceBelow >= spaces.spaceAbove ? 'bottom' : 'top';
}

function determinePopupDirection(
    localPos: { x: number; y: number },
    viewportWidth: number,
    viewportHeight: number,
    spaces: DirectionSpaces
): Direction {
    const isBottomHalf = localPos.y > viewportHeight / 2;
    const isRightHalf = localPos.x > viewportWidth / 2;

    return isBottomHalf
        ? resolveBottomHalfDirection(isRightHalf, spaces)
        : resolveTopHalfDirection(isRightHalf, spaces);
}

interface GeometryParams {
    direction: Direction;
    localPos: { x: number; y: number };
    popupWidth: number;
    popupHeight: number;
    spaceAbove: number;
    spaceBelow: number;
    spaceLeft: number;
    spaceRight: number;
    viewportWidth: number;
    viewportHeight: number;
    margin: number;
    gap: number;
    fabSize: number;
}

function calculatePopupGeometry(params: GeometryParams) {
    const { direction, localPos, popupWidth, popupHeight, viewportWidth, viewportHeight, margin, gap, fabSize } = params;

    if (direction === 'top' || direction === 'bottom') {
        const space = direction === 'top' ? params.spaceAbove : params.spaceBelow;
        const height = Math.min(popupHeight, Math.max(260, space));
        const y = direction === 'top' ? localPos.y - height - gap : localPos.y + fabSize + gap;
        const targetX = localPos.x > viewportWidth / 2 ? localPos.x + fabSize - popupWidth : localPos.x;
        const x = Math.max(margin, Math.min(viewportWidth - popupWidth - margin, targetX));
        return { x, y, width: popupWidth, height };
    }

    const space = direction === 'left' ? params.spaceLeft : params.spaceRight;
    const width = Math.min(popupWidth, Math.max(280, space));
    const x = direction === 'left' ? localPos.x - width - gap : localPos.x + fabSize + gap;
    const targetY = localPos.y > viewportHeight / 2 ? localPos.y + fabSize - popupHeight : localPos.y;
    const y = Math.max(margin, Math.min(viewportHeight - popupHeight - margin, targetY));
    return { x, y, width, height: popupHeight };
}

export default function AiFloatingWidget({ activeScreen, onOpenFullPage }: AiFloatingWidgetProps) {
    const { t } = useTranslation();
    const {
        messages,
        isGenerating,
        streamingText,
        isFloatingOpen,
        floatingPosition,
        enableAi,
        enableFloating,
        activeProvider,
        activeModel,
        hasApiKey,
        availableModels,
        attachedContext,
        usageStats,
        sendMessage,
        stopGenerating,
        clearChat,
        toggleFloatingOpen,
        setFloatingOpen,
        setFloatingPosition,
        setActiveModel,
        setAttachedContext,
        openAiSettings,
    } = useAiAssistant();

    const [localPos, setLocalPos] = useState(floatingPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; moved: boolean }>({
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        moved: false,
    });
    const rafIdRef = useRef<number | null>(null);
    const latestPosRef = useRef(floatingPosition);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const activeModelLabel = useMemo(() => {
        const found = availableModels.find((m) => m.value === activeModel);
        return found ? found.label : activeModel;
    }, [availableModels, activeModel]);

    const todayTokens = usageStats?.today?.total_tokens || 0;
    const todayRequests = usageStats?.today?.requests || 0;

    useEffect(() => {
        if (!isMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[role="listbox"]') || target?.closest('[role="option"]')) {
                return;
            }
            if (menuRef.current && !menuRef.current.contains(target)) {
                setIsMenuOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isFloatingOpen) {
            setIsMenuOpen(false);
        }
    }, [isFloatingOpen]);

    const chatScrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<AiChatInputHandle>(null);

    const lastAssistantMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                return messages[i];
            }
        }
        return null;
    }, [messages]);

    const dynamicSuggestions = useMemo(() => {
        if (!lastAssistantMessage?.content) return [];
        const { suggestions } = extractVyloSuggestions(lastAssistantMessage.content, false);
        return suggestions;
    }, [lastAssistantMessage]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (chatScrollRef.current) {
            if (typeof chatScrollRef.current.scrollTo === 'function') {
                chatScrollRef.current.scrollTo({
                    top: chatScrollRef.current.scrollHeight,
                    behavior,
                });
            } else {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }
        if (messagesEndRef.current?.scrollIntoView) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        }
    }, []);

    // Sync external floatingPosition changes to local state when not dragging
    useEffect(() => {
        if (!isDragging) {
            setLocalPos(floatingPosition);
            latestPosRef.current = floatingPosition;
        }
    }, [floatingPosition, isDragging]);

    // Cleanup animation frame on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    const prevOpenRef = useRef(false);

    // Auto-scroll ke bawah: instan saat baru dibuka atau saat streaming chunks, halus saat pesan baru / selesai
    useEffect(() => {
        if (isFloatingOpen) {
            const isJustOpened = !prevOpenRef.current;
            prevOpenRef.current = true;
            if (isJustOpened) {
                const timer = window.setTimeout(() => {
                    scrollToBottom('auto');
                }, 30);
                return () => window.clearTimeout(timer);
            } else if (streamingText) {
                scrollToBottom('auto');
            } else {
                scrollToBottom('smooth');
            }
        } else {
            prevOpenRef.current = false;
        }
    }, [messages, streamingText, isFloatingOpen, scrollToBottom]);

    // Pointer Dragging Logic untuk FAB (Smooth 60/120fps via requestAnimationFrame)
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}

        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: localPos.x,
            initialY: localPos.y,
            moved: false,
        };
        setIsDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;

        if (Math.hypot(dx, dy) > 4) {
            dragStartRef.current.moved = true;
        }

        const newX = Math.max(16, Math.min(window.innerWidth - 64, dragStartRef.current.initialX + dx));
        const newY = Math.max(16, Math.min(window.innerHeight - 64, dragStartRef.current.initialY + dy));
        latestPosRef.current = { x: newX, y: newY };

        rafIdRef.current ??= requestAnimationFrame(() => {
            setLocalPos(latestPosRef.current);
            rafIdRef.current = null;
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging) return;
        setIsDragging(false);

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        // Commit koordinat akhir ke AiContext dan localStorage
        setFloatingPosition(latestPosRef.current);

        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch (_) {}
    };

    const handleClick = () => {
        if (!dragStartRef.current.moved) {
            toggleFloatingOpen();
        }
        dragStartRef.current.moved = false;
    };


    if (!enableAi || !enableFloating || activeScreen === 'ai-assistant') {
        return null;
    }

    // Kalkulasi posisi jendela popup relatif terhadap FAB dengan 4-Direction Collision-Free Positioning
    const computePopupPosition = () => {
        const margin = 16;
        const gap = 12;
        const fabSize = 48;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

        const baseWidth = 450;
        const baseHeight = 560;

        const maxAllowedWidth = Math.max(300, viewportWidth - margin * 2);
        const maxAllowedHeight = Math.max(340, viewportHeight - margin * 2);

        const popupWidth = Math.min(baseWidth, maxAllowedWidth);
        const popupHeight = Math.min(baseHeight, maxAllowedHeight);

        // Ketersediaan ruang di ke-4 arah dari FAB
        const spaceAbove = localPos.y - margin - gap;
        const spaceBelow = viewportHeight - margin - gap - (localPos.y + fabSize);
        const spaceLeft = localPos.x - margin - gap;
        const spaceRight = viewportWidth - margin - gap - (localPos.x + fabSize);

        const direction = determinePopupDirection(localPos, viewportWidth, viewportHeight, {
            fitsTop: spaceAbove >= popupHeight,
            fitsBottom: spaceBelow >= popupHeight,
            fitsLeft: spaceLeft >= popupWidth,
            fitsRight: spaceRight >= popupWidth,
            spaceAbove,
            spaceBelow,
        });

        const geometry = calculatePopupGeometry({
            direction,
            localPos,
            popupWidth,
            popupHeight,
            spaceAbove,
            spaceBelow,
            spaceLeft,
            spaceRight,
            viewportWidth,
            viewportHeight,
            margin,
            gap,
            fabSize,
        });

        return { ...geometry, direction };
    };

    const popupPos = computePopupPosition();

    return (
        <>
            {/* FLOATING ACTION BUTTON (FAB) */}
            <div
                style={{
                    position: 'fixed',
                    left: `${localPos.x}px`,
                    top: `${localPos.y}px`,
                    zIndex: 70,
                }}
                className="select-none"
            >
                <button
                    type="button"
                    onClick={handleClick}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`relative w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:shadow-primary/30 flex items-center justify-center cursor-pointer active:scale-95 border border-white/20 touch-none ${
                        isDragging ? 'transition-none select-none' : 'transition-all'
                    }`}
                    title={t('ai.floating_title', 'VyloServe Copilot')}
                    aria-label={t('ai.floating_title', 'VyloServe Copilot')}
                >
                    <span className="material-symbols-outlined text-[24px]">
                        {isFloatingOpen ? 'chat_bubble' : 'smart_toy'}
                    </span>

                    {/* Pulse Indicator saat AI Streaming */}
                    {isGenerating && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                        </span>
                    )}
                </button>
            </div>

            {/* FLOATING CHAT CARD (WINDOW) */}
            {isFloatingOpen && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${popupPos.x}px`,
                        top: `${popupPos.y}px`,
                        width: `${popupPos.width}px`,
                        height: `${popupPos.height}px`,
                        zIndex: 65,
                    }}
                    className={`flex flex-col rounded-2xl shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 overflow-hidden ${
                        isDragging ? 'transition-none select-none pointer-events-none' : 'animate-in fade-in zoom-in-95 duration-200'
                    }`}
                >
                    {/* HEADER */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[17px]">smart_toy</span>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 mr-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-none mb-1">
                                    {t('ai.floating_title', 'VyloServe Copilot')}
                                </span>
                                {/* Model Subtitle (Static label - users configure options via kebab menu) */}
                                <span
                                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]"
                                    title={activeModelLabel}
                                >
                                    {activeModelLabel}
                                </span>
                            </div>
                        </div>

                        {/* Header Action Buttons: Clean 3-Action Group */}
                        <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                icon="add"
                                onClick={clearChat}
                                title={t('ai.clear_chat', 'New Chat')}
                                aria-label={t('ai.clear_chat', 'New Chat')}
                            />

                            {/* Kebab Menu (More Options) */}
                            <div className="relative" ref={menuRef}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    icon="more_vert"
                                    onClick={() => setIsMenuOpen((prev) => !prev)}
                                    title={t('common.more_options', 'More Options')}
                                    aria-label={t('common.more_options', 'More Options')}
                                    aria-expanded={isMenuOpen}
                                    aria-haspopup="true"
                                />

                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                                        {/* Quick Model Switcher inside Menu */}
                                        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
                                            <label htmlFor="ai-floating-model-select" className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                                {t('ai.model', 'Model')}
                                            </label>
                                            <Select
                                                id="ai-floating-model-select"
                                                size="sm"
                                                value={activeModel}
                                                onChange={(val) => {
                                                    setActiveModel(val);
                                                    setIsMenuOpen(false);
                                                }}
                                                options={availableModels}
                                                searchable={false}
                                            />
                                        </div>

                                        {/* Secondary Actions */}
                                        <div className="py-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    setFloatingOpen(false);
                                                    onOpenFullPage();
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[17px] text-slate-400">open_in_full</span>
                                                <span>{t('ai.dock_full', 'Open in Full Page')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    openAiSettings();
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[17px] text-slate-400">settings</span>
                                                <span>{t('settings.tab_ai', 'AI Assistant Settings')}</span>
                                            </button>
                                        </div>

                                        {/* Simplified Session Usage Footer (Inline Display, No Nested Popover, No Clipping) */}
                                        <div className="px-3 py-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-100/70 dark:bg-slate-800/80 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">data_usage</span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                        {t('ai.usage_status', 'Session Usage')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                        {t('ai.requests_count', '{{count}} requests', { count: todayRequests })}
                                                    </span>
                                                </div>
                                            </div>
                                            <span
                                                className="font-mono text-xs font-bold text-primary bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60 shadow-2xs shrink-0"
                                                title={t('ai.usage_today', { tokens: todayTokens.toLocaleString() })}
                                            >
                                                {formatTokens(todayTokens)} {t('ai.tokens', 'Tokens')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="danger-ghost"
                                size="icon"
                                icon="close"
                                onClick={() => setFloatingOpen(false)}
                                title={t('common.close', 'Close')}
                                aria-label={t('common.close', 'Close')}
                            />
                        </div>
                    </div>

                    {/* API KEY WARNING BANNER using InfoBox */}
                    {!hasApiKey && activeProvider !== 'ollama' && (
                        <div className="p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                            <InfoBox tone="warning" icon="warning">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span className="truncate">{t('ai.no_key_warning')}</span>
                                    <button
                                        type="button"
                                        onClick={openAiSettings}
                                        className="underline font-semibold shrink-0 cursor-pointer text-amber-700 dark:text-amber-400 hover:text-amber-800"
                                    >
                                        {t('ai.configure_key', 'Settings')}
                                    </button>
                                </div>
                            </InfoBox>
                        </div>
                    )}

                    {/* CHAT MESSAGES BODY */}
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                        {messages.length === 0 && !isGenerating && (
                            <div className="h-full flex flex-col justify-between py-2 text-slate-400">
                                {/* Hero Card */}
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                                        <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                                                {t('ai.floating_title', 'VyloServe Copilot')}
                                            </h4>
                                            <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                Ready
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                            {t('ai.subtitle', 'Your local server developer copilot')}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Action Suggestions */}
                                <div className="flex flex-col gap-2 my-auto">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                                        {t('ai.quick_prompts', 'Quick Questions')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => sendMessage(t('ai.quick_prompt_logs'), activeScreen)}
                                        className="group text-left p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-primary/50 dark:hover:border-primary/50 bg-white/60 dark:bg-slate-800/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-xs"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">bug_report</span>
                                            </div>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {t('ai.quick_prompt_logs')}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                                            arrow_forward
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => sendMessage(t('ai.quick_prompt_vhost'), activeScreen)}
                                        className="group text-left p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-primary/50 dark:hover:border-primary/50 bg-white/60 dark:bg-slate-800/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-xs"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">dns</span>
                                            </div>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {t('ai.quick_prompt_vhost')}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                                            arrow_forward
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => sendMessage(t('ai.quick_prompt_php'), activeScreen)}
                                        className="group text-left p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-primary/50 dark:hover:border-primary/50 bg-white/60 dark:bg-slate-800/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-xs"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">settings_suggest</span>
                                            </div>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {t('ai.quick_prompt_php')}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                                            arrow_forward
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <AiChatMessage key={msg.id} message={msg} />
                        ))}

                        {/* LIVE STREAMING MESSAGE */}
                        {isGenerating && streamingText && (
                            <AiChatMessage
                                message={{
                                    id: 'streaming_temp',
                                    role: 'assistant',
                                    content: streamingText,
                                    timestamp: Date.now(),
                                    model: activeModel,
                                }}
                                isStreaming={true}
                            />
                        )}

                        {isGenerating && !streamingText && (
                            <SkeletonChatMessage className="py-2" />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <AiChatInput
                        ref={inputRef}
                        variant="floating"
                        onSend={(text) => sendMessage(text, activeScreen)}
                        onStop={stopGenerating}
                        isGenerating={isGenerating}
                        activeScreen={activeScreen}
                        attachedContext={attachedContext}
                        onToggleContext={(key) =>
                            setAttachedContext((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        suggestions={dynamicSuggestions}
                        className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                    />
                </div>
            )}
        </>
    );
}
