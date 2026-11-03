import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import TerminalContextMenu from "./TerminalContextMenu";
import type { TerminalSession, TerminalSettings } from "../types";

export function getTerminalBufferText(term: Terminal, maxLines: number = 1000): string {
    const buffer = term.buffer.active;
    const lines: string[] = [];
    const total = buffer.length;
    const start = Math.max(0, total - maxLines);
    for (let i = start; i < total; i++) {
        const line = buffer.getLine(i);
        if (line) lines.push(line.translateToString(true));
    }
    while (lines.length > 0 && lines.at(-1)?.trim() === "") {
        lines.pop();
    }
    return lines.join("\n");
}

export const TERMINAL_THEMES: Record<string, Record<string, string>> = {
    "vyloserve-dark": {
        background: "#090d16",
        foreground: "#f8fafc",
        cursor: "#38bdf8",
        cursorAccent: "#090d16",
        selectionBackground: "rgba(56, 189, 248, 0.35)",
        black: "#1e293b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#38bdf8",
        white: "#f1f5f9",
        brightBlack: "#64748b",
        brightRed: "#ef4444",
        brightGreen: "#22c55e",
        brightYellow: "#eab308",
        brightBlue: "#3b82f6",
        brightMagenta: "#a855f7",
        brightCyan: "#06b6d4",
        brightWhite: "#ffffff"
    },
    "vyloserve-light": {
        background: "#ffffff",
        foreground: "#0f172a",
        cursor: "#0284c7",
        cursorAccent: "#ffffff",
        selectionBackground: "rgba(2, 132, 199, 0.25)",
        black: "#0f172a",
        red: "#dc2626",
        green: "#15803d",
        yellow: "#b45309",
        blue: "#1d4ed8",
        magenta: "#7e22ce",
        cyan: "#0e7490",
        white: "#334155",
        brightBlack: "#475569",
        brightRed: "#b91c1c",
        brightGreen: "#166534",
        brightYellow: "#92400e",
        brightBlue: "#1e40af",
        brightMagenta: "#6b21a8",
        brightCyan: "#155e75",
        brightWhite: "#0f172a"
    },
    "monokai": {
        background: "#272822",
        foreground: "#f8f8f2",
        cursor: "#f8f8f0",
        cursorAccent: "#272822",
        selectionBackground: "rgba(73, 72, 62, 0.7)",
        black: "#272822",
        red: "#f92672",
        green: "#a6e22e",
        yellow: "#f4bf75",
        blue: "#66d9ef",
        magenta: "#ae81ff",
        cyan: "#a1efe4",
        white: "#f8f8f2",
        brightBlack: "#75715e",
        brightRed: "#f92672",
        brightGreen: "#a6e22e",
        brightYellow: "#f4bf75",
        brightBlue: "#66d9ef",
        brightMagenta: "#ae81ff",
        brightCyan: "#a1efe4",
        brightWhite: "#f9f8f5"
    },
    "dracula": {
        background: "#282a36",
        foreground: "#f8f8f2",
        cursor: "#f8f8f2",
        cursorAccent: "#282a36",
        selectionBackground: "rgba(68, 71, 90, 0.8)",
        black: "#21222c",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#bd93f9",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
        brightBlack: "#6272a4",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#ffffa5",
        brightBlue: "#d6acff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff"
    },
    "nord": {
        background: "#2e3440",
        foreground: "#d8dee9",
        cursor: "#d8dee9",
        cursorAccent: "#2e3440",
        selectionBackground: "rgba(67, 76, 94, 0.8)",
        black: "#3b4252",
        red: "#bf616a",
        green: "#a3be8c",
        yellow: "#ebcb8b",
        blue: "#81a1c1",
        magenta: "#b48ead",
        cyan: "#88c0d0",
        white: "#e5e9f0",
        brightBlack: "#4c566a",
        brightRed: "#bf616a",
        brightGreen: "#a3be8c",
        brightYellow: "#ebcb8b",
        brightBlue: "#81a1c1",
        brightMagenta: "#b48ead",
        brightCyan: "#8fbcbb",
        brightWhite: "#eceff4"
    },
    "solarized-dark": {
        background: "#002b36",
        foreground: "#839496",
        cursor: "#93a1a1",
        cursorAccent: "#002b36",
        selectionBackground: "rgba(7, 54, 66, 0.8)",
        black: "#073642",
        red: "#dc322f",
        green: "#859900",
        yellow: "#b58900",
        blue: "#268bd2",
        magenta: "#d33682",
        cyan: "#2aa198",
        white: "#eee8d5",
        brightBlack: "#586e75",
        brightRed: "#cb4b16",
        brightGreen: "#586e75",
        brightYellow: "#657b83",
        brightBlue: "#839496",
        brightMagenta: "#6c71c4",
        brightCyan: "#93a1a1",
        brightWhite: "#fdf6e3"
    },
    "solarized-light": {
        background: "#fdf6e3",
        foreground: "#586e75",
        cursor: "#586e75",
        cursorAccent: "#fdf6e3",
        selectionBackground: "rgba(238, 232, 213, 0.8)",
        black: "#073642",
        red: "#dc322f",
        green: "#859900",
        yellow: "#a16207",
        blue: "#268bd2",
        magenta: "#d33682",
        cyan: "#2aa198",
        white: "#475569",
        brightBlack: "#002b36",
        brightRed: "#cb4b16",
        brightGreen: "#586e75",
        brightYellow: "#657b83",
        brightBlue: "#839496",
        brightMagenta: "#6c71c4",
        brightCyan: "#0e7490",
        brightWhite: "#073642"
    }
};

interface TerminalInstanceProps {
    readonly session: TerminalSession;
    readonly isActive: boolean;
    readonly settings?: TerminalSettings;
    readonly terminalSettings?: TerminalSettings;
    readonly onSessionExit?: (sessionId: string, exitCode: number) => void;
    readonly onRestartSession?: (sessionId: string) => void;
    readonly onRegisterBufferAccessor?: (sessionId: string, accessor: () => string) => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    hasSelection: boolean;
}

function handleTerminalShortcuts(
    event: KeyboardEvent,
    term: Terminal,
    fitAddon: FitAddon,
    sessionId: string,
    fontSizeRef: React.RefObject<number>,
    handleCopy: () => void,
    handlePaste: () => void
): boolean {
    if (event.type !== "keydown") return true;

    if (event.key === "Tab") {
        event.preventDefault();
        const api = (window as any).pywebview?.api;
        const buffer = term.buffer?.active;
        const lineContext = buffer ? (buffer.getLine(buffer.cursorY)?.translateToString(true) || "") : "";
        api?.send_terminal_input?.(sessionId, "\t", lineContext);
        return false;
    }

    if (!event.ctrlKey && !event.metaKey) return true;

    const key = event.key.toLowerCase();
    if (key === "c") {
        if (event.shiftKey || term.hasSelection()) {
            event.preventDefault();
            handleCopy();
            return false;
        }
        return true;
    }

    if (key === "v") {
        event.preventDefault();
        handlePaste();
        return false;
    }

    if (key === "=" || key === "+") {
        event.preventDefault();
        fontSizeRef.current = Math.min(24, fontSizeRef.current + 1);
        term.options.fontSize = fontSizeRef.current;
        fitAddon.fit();
        return false;
    }

    if (key === "-") {
        event.preventDefault();
        fontSizeRef.current = Math.max(9, fontSizeRef.current - 1);
        term.options.fontSize = fontSizeRef.current;
        fitAddon.fit();
        return false;
    }

    if (key === "0") {
        event.preventDefault();
        fontSizeRef.current = 13;
        term.options.fontSize = 13;
        fitAddon.fit();
        return false;
    }

    return true;
}

export default function TerminalInstance({
    session,
    isActive,
    settings,
    terminalSettings,
    onSessionExit,
    onRestartSession,
    onRegisterBufferAccessor
}: TerminalInstanceProps) {
    const effectiveSettings = settings || terminalSettings;
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const fontSizeRef = useRef(13);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        hasSelection: false
    });

    const handleCopy = useCallback(() => {
        if (!termRef.current) return;
        const selection = termRef.current.getSelection();
        if (selection) {
            navigator.clipboard.writeText(selection);
        }
    }, []);

    const handlePaste = useCallback(() => {
        navigator.clipboard.readText().then((text) => {
            if (text) {
                const api = (window as any).pywebview?.api;
                api?.send_terminal_input?.(session.id, text);
            }
        });
    }, [session.id]);

    const handleSelectAll = useCallback(() => {
        termRef.current?.selectAll();
    }, []);

    const handleClear = useCallback(() => {
        termRef.current?.clear();
    }, []);

    const handleRestart = useCallback(() => {
        onRestartSession?.(session.id);
    }, [onRestartSession, session.id]);

    useEffect(() => {
        if (!containerRef.current) return;

        const initialTheme = (effectiveSettings?.theme && TERMINAL_THEMES[effectiveSettings.theme]) || TERMINAL_THEMES["vyloserve-dark"];
        const initialFontSize = effectiveSettings?.fontSize || fontSizeRef.current;
        fontSizeRef.current = initialFontSize;

        const disabledBlinkStyles = ["smooth", "gradient", "none"];
        let isBlinking = effectiveSettings?.cursorBlink ?? true;
        if (effectiveSettings?.cursorBlinkStyle && disabledBlinkStyles.includes(effectiveSettings.cursorBlinkStyle)) {
            isBlinking = false;
        }

        const term = new Terminal({
            cursorBlink: isBlinking,
            cursorStyle: effectiveSettings?.cursorStyle || "block",
            fontSize: initialFontSize,
            lineHeight: effectiveSettings?.lineHeight || 1.2,
            fontFamily: effectiveSettings?.fontFamily || 'Consolas, "Fira Code", Monaco, "Courier New", monospace',
            theme: initialTheme,
            scrollback: effectiveSettings?.scrollback || 5000,
            convertEol: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Render restored session history if available
        if (session.historyBuffer) {
            term.writeln("\x1b[90m┌────────────────────────────────────────────────────────────┐\x1b[0m");
            term.writeln(`\x1b[90m│ 📜 Riwayat Sesi Sebelumnya: ${session.title} \x1b[0m`);
            term.writeln("\x1b[90m└────────────────────────────────────────────────────────────┘\x1b[0m");
            term.write(session.historyBuffer.replace(/\r?\n/g, "\r\n") + "\r\n");
            term.writeln("\x1b[90m────────────────────────────────────────────────────────────\x1b[0m\r\n");
        }

        // Register buffer accessor for parent component on save
        if (onRegisterBufferAccessor) {
            onRegisterBufferAccessor(session.id, () => getTerminalBufferText(term, 1000));
        }

        // Sync initial fit
        try {
            fitAddon.fit();
            const api = (window as any).pywebview?.api;
            if (api?.resize_terminal) {
                api.resize_terminal(session.id, term.cols, term.rows);
            }
        } catch (_) { // NOSONAR typescript:S2486
            // Initial fit can fail safely if tab is not visible yet
        }

        // Custom Key Event Handler: Intercept Tab, Copy/Paste, and Zoom
        term.attachCustomKeyEventHandler((event: KeyboardEvent) =>
            handleTerminalShortcuts(event, term, fitAddon, session.id, fontSizeRef, handleCopy, handlePaste)
        );

        // Listen for user keyboard input -> send to backend PTY
        const dataDisposable = term.onData((data) => {
            const api = (window as any).pywebview?.api;
            if (api?.send_terminal_input) {
                api.send_terminal_input(session.id, data);
            }
        });

        // Listen for terminal output emitted from backend
        const handleOutput = (e: Event) => {
            const customEvent = e as CustomEvent<{ sessionId: string; data: string }>;
            if (customEvent.detail?.sessionId === session.id) {
                term.write(customEvent.detail.data);
            }
        };

        // Listen for selection change (Copy on Select)
        const selectionDisposable = term.onSelectionChange?.(() => {
            if (effectiveSettings?.copyOnSelect && term.hasSelection()) {
                const text = term.getSelection();
                if (text) {
                    navigator.clipboard.writeText(text).catch(() => {
                        // Ignore clipboard write permission refusal
                    });
                }
            }
        });

        // Listen for session exit
        const handleExit = (e: Event) => {
            const customEvent = e as CustomEvent<{ sessionId: string; exitCode: number }>;
            if (customEvent.detail?.sessionId === session.id) {
                term.writeln(`\r\n\x1b[33m[Session exited with code ${customEvent.detail.exitCode}]\x1b[0m\r\n`);
                onSessionExit?.(session.id, customEvent.detail.exitCode);
            }
        };

        window.addEventListener("vylo_terminal_output", handleOutput);
        window.addEventListener("vylo_terminal_exit", handleExit);

        // Window resize listener with ResizeObserver, rAF throttling & ConPTY debouncing
        let resizeObserver: ResizeObserver | null = null;
        let fitRafId: number | null = null;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        if (containerRef.current) {
            resizeObserver = new ResizeObserver(() => {
                // 1. Visual Fit: Maksimal 1x per animation frame
                if (fitRafId !== null) cancelAnimationFrame(fitRafId);
                fitRafId = requestAnimationFrame(() => {
                    try {
                        fitAddon.fit();
                    } catch (_) {
                        // Suppress transient render fit error during rapid container resize
                    }
                    fitRafId = null;
                });

                // 2. OS ConPTY IPC: Debounce 100ms trailing edge
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    try {
                        const api = (window as any).pywebview?.api;
                        if (api?.resize_terminal && term.cols && term.rows) {
                            api.resize_terminal(session.id, term.cols, term.rows);
                        }
                    } catch (_) { // NOSONAR typescript:S2486
                        // Suppress resize IPC error on unmounted or busy session
                    }
                }, 100);
            });
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            dataDisposable.dispose();
            selectionDisposable?.dispose?.();
            if (onRegisterBufferAccessor) {
                onRegisterBufferAccessor(session.id, () => "");
            }
            window.removeEventListener("vylo_terminal_output", handleOutput);
            window.removeEventListener("vylo_terminal_exit", handleExit);
            if (fitRafId !== null) {
                cancelAnimationFrame(fitRafId);
            }
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            resizeObserver?.disconnect();
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, [session.id, session.title, session.historyBuffer, onSessionExit, handleCopy, handlePaste, onRegisterBufferAccessor]);

    // Dynamic preferences update without destroying instance
    useEffect(() => {
        if (!termRef.current || !effectiveSettings) return;
        const term = termRef.current;
        if (effectiveSettings.fontSize) {
            term.options.fontSize = effectiveSettings.fontSize;
            fontSizeRef.current = effectiveSettings.fontSize;
        }
        if (effectiveSettings.fontFamily) {
            term.options.fontFamily = effectiveSettings.fontFamily;
        }
        if (effectiveSettings.lineHeight) {
            term.options.lineHeight = effectiveSettings.lineHeight;
        }
        if (effectiveSettings.cursorStyle) {
            term.options.cursorStyle = effectiveSettings.cursorStyle;
        }
        if (
            effectiveSettings.cursorBlinkStyle === "smooth" ||
            effectiveSettings.cursorBlinkStyle === "gradient" ||
            effectiveSettings.cursorBlinkStyle === "none"
        ) {
            term.options.cursorBlink = false;
        } else if (effectiveSettings.cursorBlink !== undefined) {
            term.options.cursorBlink = effectiveSettings.cursorBlink;
        } else {
            term.options.cursorBlink = true;
        }
        if (effectiveSettings.scrollback) {
            term.options.scrollback = effectiveSettings.scrollback;
        }
        if (effectiveSettings.theme && TERMINAL_THEMES[effectiveSettings.theme]) {
            term.options.theme = TERMINAL_THEMES[effectiveSettings.theme];
        }
        fitAddonRef.current?.fit();
    }, [effectiveSettings]);

    // Handle when tab becomes active again
    useEffect(() => {
        if (!isActive) return;

        const timer = setTimeout(() => {
            try {
                fitAddonRef.current?.fit();
                termRef.current?.focus();
                const api = (window as any).pywebview?.api;
                if (api?.resize_terminal && termRef.current) {
                    api.resize_terminal(session.id, termRef.current.cols, termRef.current.rows);
                }
            } catch (_) { // NOSONAR typescript:S2486
                // Ignore transient fit/resize error while switching active tab
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [isActive, session.id]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const hasSelection = Boolean(termRef.current?.hasSelection());
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            hasSelection
        });
    };

    const bgHex = (effectiveSettings?.theme && TERMINAL_THEMES[effectiveSettings.theme]?.background) || "#090d16";
    const cursorAnimMap: Record<string, string> = {
        gradient: "vylo-cursor-gradient",
        smooth: "vylo-cursor-smooth",
    };
    const cursorAnimClass = (effectiveSettings?.cursorBlinkStyle && cursorAnimMap[effectiveSettings.cursorBlinkStyle]) || "";

    return (
        <div
            onContextMenu={handleContextMenu}
            style={{ backgroundColor: bgHex }}
            className={`w-full h-full min-h-0 flex-1 relative rounded-b-xl overflow-hidden ${cursorAnimClass} ${
                isActive ? "block" : "hidden"
            }`}
        >
            <div
                ref={containerRef}
                className="w-full h-full p-3 overflow-hidden text-left"
                style={{ width: "100%", height: "100%" }}
            />

            {contextMenu.visible && (
                <TerminalContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    hasSelection={contextMenu.hasSelection}
                    onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
                    onCopy={handleCopy}
                    onPaste={handlePaste}
                    onSelectAll={handleSelectAll}
                    onClear={handleClear}
                    onRestart={handleRestart}
                />
            )}
        </div>
    );
}
