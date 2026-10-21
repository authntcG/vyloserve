import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import TerminalContextMenu from "./TerminalContextMenu";
import type { TerminalSession } from "../types";

interface TerminalInstanceProps {
    readonly session: TerminalSession;
    readonly isActive: boolean;
    readonly onSessionExit?: (sessionId: string, exitCode: number) => void;
    readonly onRestartSession?: (sessionId: string) => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    hasSelection: boolean;
}

export default function TerminalInstance({
    session,
    isActive,
    onSessionExit,
    onRestartSession
}: TerminalInstanceProps) {
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

        const term = new Terminal({
            cursorBlink: true,
            fontSize: fontSizeRef.current,
            fontFamily: 'Consolas, "Fira Code", Monaco, "Courier New", monospace',
            theme: {
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
            scrollback: 5000,
            convertEol: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Sync initial fit
        try {
            fitAddon.fit();
            const api = (window as any).pywebview?.api;
            if (api?.resize_terminal) {
                api.resize_terminal(session.id, term.cols, term.rows);
            }
        } catch (_) {}

        // Custom Key Event Handler: Intercept Tab, Copy/Paste, and Zoom
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            // 1. Tab Auto-Completion Trap (Prevent browser focus traversal!)
            if (event.key === "Tab") {
                if (event.type === "keydown") {
                    event.preventDefault();
                    const api = (window as any).pywebview?.api;
                    api?.send_terminal_input?.(session.id, "\t");
                }
                return false;
            }

            // 2. Clipboard shortcuts (Ctrl+C, Ctrl+Shift+C, Ctrl+V, Ctrl+Shift+V)
            if (event.ctrlKey || event.metaKey) {
                const key = event.key.toLowerCase();

                // Ctrl+Shift+C -> Always copy
                if (event.shiftKey && key === "c") {
                    if (event.type === "keydown") {
                        event.preventDefault();
                        handleCopy();
                    }
                    return false;
                }

                // Ctrl+C -> Copy if selection exists, else let SIGINT pass to shell!
                if (!event.shiftKey && key === "c") {
                    if (term.hasSelection()) {
                        if (event.type === "keydown") {
                            event.preventDefault();
                            handleCopy();
                        }
                        return false;
                    }
                    // No selection: let standard \x03 signal pass to process
                    return true;
                }

                // Ctrl+V or Ctrl+Shift+V -> Paste
                if (key === "v") {
                    if (event.type === "keydown") {
                        event.preventDefault();
                        handlePaste();
                    }
                    return false;
                }

                // Ctrl + '=' (Zoom in)
                if (key === "=" || key === "+") {
                    if (event.type === "keydown") {
                        event.preventDefault();
                        fontSizeRef.current = Math.min(24, fontSizeRef.current + 1);
                        term.options.fontSize = fontSizeRef.current;
                        fitAddon.fit();
                    }
                    return false;
                }

                // Ctrl + '-' (Zoom out)
                if (key === "-") {
                    if (event.type === "keydown") {
                        event.preventDefault();
                        fontSizeRef.current = Math.max(9, fontSizeRef.current - 1);
                        term.options.fontSize = fontSizeRef.current;
                        fitAddon.fit();
                    }
                    return false;
                }

                // Ctrl + '0' (Reset zoom)
                if (key === "0") {
                    if (event.type === "keydown") {
                        event.preventDefault();
                        fontSizeRef.current = 13;
                        term.options.fontSize = 13;
                        fitAddon.fit();
                    }
                    return false;
                }
            }

            return true;
        });

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

        // Window resize listener with ResizeObserver
        let resizeObserver: ResizeObserver | null = null;
        if (containerRef.current) {
            resizeObserver = new ResizeObserver(() => {
                try {
                    fitAddon.fit();
                    const api = (window as any).pywebview?.api;
                    if (api?.resize_terminal && term.cols && term.rows) {
                        api.resize_terminal(session.id, term.cols, term.rows);
                    }
                } catch (_) {}
            });
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            dataDisposable.dispose();
            window.removeEventListener("vylo_terminal_output", handleOutput);
            window.removeEventListener("vylo_terminal_exit", handleExit);
            resizeObserver?.disconnect();
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, [session.id, onSessionExit, handleCopy, handlePaste]);

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
            } catch (_) {}
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

    return (
        <div
            onContextMenu={handleContextMenu}
            className={`w-full h-full min-h-0 flex-1 relative bg-[#090d16] rounded-b-xl overflow-hidden ${
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
