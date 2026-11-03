import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TerminalInstance from "../../src/menu/tools/terminal/components/TerminalInstance";
import TerminalContextMenu from "../../src/menu/tools/terminal/components/TerminalContextMenu";
import TerminalTabBar from "../../src/menu/tools/terminal/components/TerminalTabBar";
import TerminalToolbar from "../../src/menu/tools/terminal/components/TerminalToolbar";
import TerminalConfigModal from "../../src/menu/tools/terminal/components/TerminalConfigModal";
import type { TerminalSession, TerminalSettings, ShellInfo, RuntimeMatrix } from "../../src/menu/tools/terminal/types";

let lastCustomKeyHandler: ((event: KeyboardEvent) => boolean) | null = null;
let mockTerminalInstance: any = null;
let mockFitAddonInstance: any = null;

vi.mock("@xterm/xterm", () => {
    return {
        Terminal: class {
            open = vi.fn();
            loadAddon = vi.fn();
            write = vi.fn();
            writeln = vi.fn();
            focus = vi.fn();
            dispose = vi.fn();
            onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
            onSelectionChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
            attachCustomKeyEventHandler = vi.fn().mockImplementation((handler) => {
                lastCustomKeyHandler = handler;
            });
            hasSelection = vi.fn().mockReturnValue(false);
            getSelection = vi.fn().mockReturnValue("selected sample text");
            clearSelection = vi.fn();
            selectAll = vi.fn();
            clear = vi.fn();
            options: any = { fontSize: 13, fontFamily: "monospace" };
            cols = 120;
            rows = 30;
            buffer = {
                active: {
                    cursorY: 0,
                    getLine: vi.fn().mockReturnValue({
                        translateToString: vi.fn().mockReturnValue("D:\\Projects>dir")
                    })
                }
            };

            constructor() {
                mockTerminalInstance = this;
            }
        }
    };
});

vi.mock("@xterm/addon-fit", () => {
    return {
        FitAddon: class {
            fit = vi.fn();
            constructor() {
                mockFitAddonInstance = this;
            }
        }
    };
});

describe("TerminalInstance & Context Menu & TabBar Detailed Coverage", () => {
    const mockSession: TerminalSession = {
        id: "s1",
        title: "Session 1",
        shell_id: "powershell",
        cwd: "D:\\test"
    };

    const mockSettings: TerminalSettings = {
        fontFamily: "Fira Code",
        fontSize: 13,
        lineHeight: 1.2,
        theme: "vyloserve-dark",
        cursorStyle: "block",
        cursorBlink: true,
        cursorBlinkStyle: "classic",
        defaultShell: "powershell",
        defaultCwd: "D:\\test",
        scrollback: 5000,
        copyOnSelect: false
    };

    beforeEach(() => {
        lastCustomKeyHandler = null;
        mockTerminalInstance = null;
        mockFitAddonInstance = null;

        (globalThis as any).ResizeObserver = class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        };

        (window as any).pywebview = {
            api: {
                send_terminal_input: vi.fn().mockResolvedValue(undefined),
                resize_terminal: vi.fn().mockResolvedValue(undefined)
            }
        };

        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
                readText: vi.fn().mockResolvedValue("pasted text from clipboard")
            }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders TerminalContextMenu and responds to click outside, escape, and menu actions", () => {
        const onClose = vi.fn();
        const onCopy = vi.fn();
        const onPaste = vi.fn();
        const onSelectAll = vi.fn();
        const onClear = vi.fn();
        const onRestart = vi.fn();

        const { unmount } = render(
            <TerminalContextMenu
                x={100}
                y={100}
                hasSelection={true}
                onClose={onClose}
                onCopy={onCopy}
                onPaste={onPaste}
                onSelectAll={onSelectAll}
                onClear={onClear}
                onRestart={onRestart}
            />
        );

        // Copy button is active when hasSelection is true
        const copyBtn = screen.getByText("tools.terminal.context_copy");
        fireEvent.click(copyBtn);
        expect(onCopy).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();

        // Paste button
        const pasteBtn = screen.getByText("tools.terminal.context_paste");
        fireEvent.click(pasteBtn);
        expect(onPaste).toHaveBeenCalled();

        // Select All button
        const selectAllBtn = screen.getByText("tools.terminal.context_select_all");
        fireEvent.click(selectAllBtn);
        expect(onSelectAll).toHaveBeenCalled();

        // Clear button
        const clearBtn = screen.getByText("tools.terminal.context_clear");
        fireEvent.click(clearBtn);
        expect(onClear).toHaveBeenCalled();

        // Restart button
        const restartBtn = screen.getByText("tools.terminal.context_restart");
        fireEvent.click(restartBtn);
        expect(onRestart).toHaveBeenCalled();

        // Escape key closes menu
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(6);

        // Click outside closes menu
        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(7);

        unmount();
    });

    it("handles TerminalInstance zoom shortcuts (Ctrl+=, Ctrl+-, Ctrl+0, Ctrl+V, Shift+Ctrl+C)", async () => {
        const onRegisterBufferAccessor = vi.fn();
        const onRestartSession = vi.fn();
        const onSessionExit = vi.fn();

        const { unmount } = render(
            <TerminalInstance
                session={mockSession}
                isActive={true}
                settings={mockSettings}
                onRegisterBufferAccessor={onRegisterBufferAccessor}
                onRestartSession={onRestartSession}
                onSessionExit={onSessionExit}
            />
        );

        expect(onRegisterBufferAccessor).toHaveBeenCalledWith("s1", expect.any(Function));
        expect(lastCustomKeyHandler).not.toBeNull();

        // Zoom In: Ctrl + =
        const zoomInEvent = new KeyboardEvent("keydown", { key: "=", ctrlKey: true, cancelable: true });
        const zoomInPrevent = vi.spyOn(zoomInEvent, "preventDefault");
        expect(lastCustomKeyHandler!(zoomInEvent)).toBe(false);
        expect(zoomInPrevent).toHaveBeenCalled();
        expect(mockFitAddonInstance.fit).toHaveBeenCalled();
        expect(mockTerminalInstance.options.fontSize).toBe(14);

        // Zoom In: Ctrl + +
        const zoomPlusEvent = new KeyboardEvent("keydown", { key: "+", ctrlKey: true, cancelable: true });
        expect(lastCustomKeyHandler!(zoomPlusEvent)).toBe(false);
        expect(mockTerminalInstance.options.fontSize).toBe(15);

        // Zoom Out: Ctrl + -
        const zoomOutEvent = new KeyboardEvent("keydown", { key: "-", ctrlKey: true, cancelable: true });
        const zoomOutPrevent = vi.spyOn(zoomOutEvent, "preventDefault");
        expect(lastCustomKeyHandler!(zoomOutEvent)).toBe(false);
        expect(zoomOutPrevent).toHaveBeenCalled();
        expect(mockTerminalInstance.options.fontSize).toBe(14);

        // Reset Zoom: Ctrl + 0
        const zoomResetEvent = new KeyboardEvent("keydown", { key: "0", ctrlKey: true, cancelable: true });
        const zoomResetPrevent = vi.spyOn(zoomResetEvent, "preventDefault");
        expect(lastCustomKeyHandler!(zoomResetEvent)).toBe(false);
        expect(zoomResetPrevent).toHaveBeenCalled();
        expect(mockTerminalInstance.options.fontSize).toBe(13);

        // Paste: Ctrl + V
        const pasteEvent = new KeyboardEvent("keydown", { key: "v", ctrlKey: true, cancelable: true });
        const pastePrevent = vi.spyOn(pasteEvent, "preventDefault");
        expect(lastCustomKeyHandler!(pasteEvent)).toBe(false);
        expect(pastePrevent).toHaveBeenCalled();
        await waitFor(() => {
            expect((window as any).pywebview.api.send_terminal_input).toHaveBeenCalledWith(
                "s1",
                "pasted text from clipboard"
            );
        });

        // Copy with shiftKey: Ctrl + Shift + C
        const copyShiftEvent = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true, cancelable: true });
        const copyPrevent = vi.spyOn(copyShiftEvent, "preventDefault");
        expect(lastCustomKeyHandler!(copyShiftEvent)).toBe(false);
        expect(copyPrevent).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("selected sample text");

        unmount();
    });

    it("handles vylo_terminal_output and vylo_terminal_exit events for matching session", async () => {
        const onSessionExit = vi.fn();

        const { unmount } = render(
            <TerminalInstance
                session={mockSession}
                isActive={true}
                settings={mockSettings}
                onSessionExit={onSessionExit}
            />
        );

        // Dispatch output for this session
        window.dispatchEvent(
            new CustomEvent("vylo_terminal_output", {
                detail: { sessionId: "s1", data: "Hello Terminal\r\n" }
            })
        );
        expect(mockTerminalInstance.write).toHaveBeenCalledWith("Hello Terminal\r\n");

        // Dispatch output for another session -> should NOT write
        window.dispatchEvent(
            new CustomEvent("vylo_terminal_output", {
                detail: { sessionId: "s2_other", data: "Other Terminal" }
            })
        );
        expect(mockTerminalInstance.write).not.toHaveBeenCalledWith("Other Terminal");

        // Dispatch exit for this session
        window.dispatchEvent(
            new CustomEvent("vylo_terminal_exit", {
                detail: { sessionId: "s1", exitCode: 0 }
            })
        );
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith(
            expect.stringContaining("[Session exited with code 0]")
        );
        expect(onSessionExit).toHaveBeenCalledWith("s1", 0);

        unmount();
    });

    it("updates appearance preferences dynamically when settings prop changes", () => {
        const { rerender } = render(
            <TerminalInstance
                session={mockSession}
                isActive={true}
                settings={mockSettings}
            />
        );

        // Update settings with smooth cursor, nord theme, new font
        const updatedSettings: TerminalSettings = {
            ...mockSettings,
            fontFamily: "Courier New",
            fontSize: 16,
            lineHeight: 1.5,
            cursorStyle: "underline",
            cursorBlinkStyle: "smooth",
            theme: "nord",
            scrollback: 8000
        };

        rerender(
            <TerminalInstance
                session={mockSession}
                isActive={true}
                settings={updatedSettings}
            />
        );

        expect(mockTerminalInstance.options.fontFamily).toBe("Courier New");
        expect(mockTerminalInstance.options.fontSize).toBe(16);
        expect(mockTerminalInstance.options.lineHeight).toBe(1.5);
        expect(mockTerminalInstance.options.cursorStyle).toBe("underline");
        expect(mockTerminalInstance.options.cursorBlink).toBe(false);
        expect(mockTerminalInstance.options.scrollback).toBe(8000);
        expect(mockTerminalInstance.options.theme).toBeDefined();

        // Update with gradient cursor blink style
        rerender(
            <TerminalInstance
                session={mockSession}
                isActive={true}
                settings={{ ...updatedSettings, cursorBlinkStyle: "none" }}
            />
        );
        expect(mockTerminalInstance.options.cursorBlink).toBe(false);
    });

    it("renders TerminalTabBar and supports keyboard selection and close tab", () => {
        const onSelectTab = vi.fn();
        const onCloseTab = vi.fn();
        const onNewTab = vi.fn();

        const sessions: TerminalSession[] = [
            { id: "s1", title: "Tab 1", shell_id: "powershell", cwd: "D:\\test" },
            { id: "s2", title: "Tab 2", shell_id: "cmd", cwd: "D:\\test" }
        ];

        render(
            <TerminalTabBar
                sessions={sessions}
                activeSessionId="s1"
                availableShells={[{ id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "", is_default: true }]}
                onSelectTab={onSelectTab}
                onCloseTab={onCloseTab}
                onNewTab={onNewTab}
            />
        );

        // Tab keyboard selection (Enter / Space)
        const tabs = screen.getAllByRole("tab");
        expect(tabs).toHaveLength(2);

        fireEvent.keyDown(tabs[1], { key: "Enter" });
        expect(onSelectTab).toHaveBeenCalledWith("s2");

        fireEvent.keyDown(tabs[1], { key: " " });
        expect(onSelectTab).toHaveBeenCalledWith("s2");

        // Close tab button on Tab 1
        const closeBtns = screen.getAllByTitle("tools.terminal.close_tab");
        expect(closeBtns.length).toBeGreaterThan(0);
        fireEvent.click(closeBtns[0]);
        expect(onCloseTab).toHaveBeenCalledWith("s1");
    });

    it("handles shell dropdown menu, new tab, and keyboard dismissal in TerminalTabBar", () => {
        const onSelectTab = vi.fn();
        const onCloseTab = vi.fn();
        const onNewTab = vi.fn();

        const shells: ShellInfo[] = [
            { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "", is_default: true },
            { id: "wsl", name: "WSL", icon: "terminal", available: false, path: "", is_default: false }
        ];

        render(
            <TerminalTabBar
                sessions={[{ id: "s1", title: "Tab 1", shell_id: "powershell", cwd: "D:\\test", color: "sky", isCustomEnv: true, isClosed: true }]}
                activeSessionId="s1"
                availableShells={shells}
                onSelectTab={onSelectTab}
                onCloseTab={onCloseTab}
                onNewTab={onNewTab}
            />
        );

        // Click new tab (+)
        const newTabBtn = screen.getByLabelText("tools.terminal.new_tab");
        fireEvent.click(newTabBtn);
        expect(onNewTab).toHaveBeenCalledWith();

        // Toggle shell dropdown
        const shellToggle = screen.getByLabelText("tools.terminal.shell_selector");
        fireEvent.click(shellToggle);

        // Expect dropdown to be open with shells
        expect(screen.getByText("PowerShell")).toBeInTheDocument();
        expect(screen.getByText("WSL")).toBeInTheDocument();

        // Click available shell
        fireEvent.click(screen.getByText("PowerShell"));
        expect(onNewTab).toHaveBeenCalledWith("powershell");

        // Toggle shell dropdown again and test Escape key dismissal
        fireEvent.click(shellToggle);
        expect(screen.getByText("PowerShell")).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByText("PowerShell")).not.toBeInTheDocument();

        // Toggle and test outside click dismissal
        fireEvent.click(shellToggle);
        expect(screen.getByText("PowerShell")).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByText("PowerShell")).not.toBeInTheDocument();
    });

    it("updates runtime profile on engine select in TerminalConfigModal environment tab", async () => {
        const mockShells: ShellInfo[] = [
            { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true }
        ];

        const mockMatrix: RuntimeMatrix = {
            php: {
                name: "PHP",
                has_vyloserve: true,
                has_os: true,
                os_path: "C:\\php\\php.exe",
                default_mode: "vyloserve",
                versions: [
                    { version: "8.2.0", display_name: "PHP 8.2.0 (VyloServe)", path: "D:\\vyloserve\\bin\\php\\php-8.2.0" },
                    { version: "8.3.0", display_name: "PHP 8.3.0 (VyloServe)", path: "D:\\vyloserve\\bin\\php\\php-8.3.0" }
                ]
            }
        };

        (window as any).pywebview = {
            api: {
                get_terminal_runtimes_matrix: vi.fn().mockResolvedValue(mockMatrix)
            }
        };

        const onApplyProfile = vi.fn();
        const onClose = vi.fn();

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="env"
                currentProfile={{ php: "D:\\vyloserve\\bin\\php\\php-8.2.0" }}
                settings={mockSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={vi.fn().mockResolvedValue(undefined)}
            />
        );

        await waitFor(() => {
            expect(document.getElementById("term-engine-select-php")).toBeInTheDocument();
        });

        // Change select value
        const phpSelect = document.getElementById("term-engine-select-php") as HTMLSelectElement;
        expect(phpSelect).toBeInTheDocument();

        fireEvent.change(phpSelect, { target: { value: "D:\\vyloserve\\bin\\php\\php-8.3.0" } });
        expect(phpSelect.value).toBe("D:\\vyloserve\\bin\\php\\php-8.3.0");

        // Click apply
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));
        expect(onApplyProfile).toHaveBeenCalledWith(
            expect.objectContaining({ php: "D:\\vyloserve\\bin\\php\\php-8.3.0" }),
            "current"
        );
    });

    it("supports switching scope and applying quick presets in TerminalConfigModal environment tab", async () => {
        const mockShells: ShellInfo[] = [
            { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true }
        ];

        const mockMatrix: RuntimeMatrix = {
            php: {
                name: "PHP",
                has_vyloserve: true,
                has_os: true,
                os_path: "C:\\php\\php.exe",
                default_mode: "vyloserve",
                versions: [
                    { version: "8.2.0", display_name: "PHP 8.2.0 (VyloServe)", path: "D:\\vyloserve\\bin\\php\\php-8.2.0" }
                ]
            }
        };

        (window as any).pywebview = {
            api: {
                get_terminal_runtimes_matrix: vi.fn().mockResolvedValue(mockMatrix)
            }
        };

        const onApplyProfile = vi.fn();
        const onClose = vi.fn();

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="env"
                currentProfile={{ php: "D:\\vyloserve\\bin\\php\\php-8.2.0" }}
                settings={mockSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={vi.fn().mockResolvedValue(undefined)}
            />
        );

        await waitFor(() => {
            expect(document.getElementById("term-engine-select-php")).toBeInTheDocument();
        });

        // Switch scope to global
        const globalScopeBtn = screen.getByText("tools.terminal.scope_global_default");
        fireEvent.click(globalScopeBtn);

        // Click presets
        const vyloserveBtn = screen.getByText("VyloServe Stack");
        fireEvent.click(vyloserveBtn);

        const osBtn = screen.getByText("OS Native Only");
        fireEvent.click(osBtn);

        // Switch scope back to current tab
        const currentScopeBtn = screen.getByText(/tools\.terminal\.scope_current_tab/);
        fireEvent.click(currentScopeBtn);

        // Apply profile
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));
        expect(onApplyProfile).toHaveBeenCalledWith(
            expect.objectContaining({ php: "D:\\vyloserve\\bin\\php\\php-8.2.0" }),
            "current"
        );
        expect(onClose).toHaveBeenCalled();
    });

    it("renders TerminalToolbar and handles clear, reconnect on closed session, and fallback modals", () => {
        const onRestartSession = vi.fn();
        const onOpenEnvModal = vi.fn();
        const onOpenSettingsModal = vi.fn();
        const onClear = vi.fn();

        // 1. Returns null if activeSession is null/undefined
        const { container, rerender } = render(<TerminalToolbar activeSession={undefined} />);
        expect(container.firstChild).toBeNull();

        // 2. Closed session with custom env
        const closedSession: TerminalSession = {
            id: "s_closed",
            title: "Closed Session",
            shell_id: "cmd",
            cwd: "D:\\test",
            isClosed: true,
            isCustomEnv: true
        };

        rerender(
            <TerminalToolbar
                activeSession={closedSession}
                onRestartSession={onRestartSession}
                onOpenEnvModal={onOpenEnvModal}
                onOpenSettingsModal={onOpenSettingsModal}
                onClear={onClear}
                envProfileSummary="CustomStack"
            />
        );

        expect(screen.getByText("CMD")).toBeInTheDocument();
        expect(screen.getByText("CustomStack")).toBeInTheDocument();
        expect(screen.getByText("tools.terminal.custom_env_badge")).toBeInTheDocument();

        // Reconnect button
        const reconnectBtn = screen.getByText("tools.terminal.reconnect");
        fireEvent.click(reconnectBtn);
        expect(onRestartSession).toHaveBeenCalledWith("s_closed");

        // Clear button
        const clearBtn = screen.getByTitle("tools.terminal.clear");
        fireEvent.click(clearBtn);
        expect(onClear).toHaveBeenCalled();

        // Config button invokes onOpenEnvModal fallback
        const configBtn = screen.getByTitle("tools.terminal.config_title");
        fireEvent.click(configBtn);
        expect(onOpenEnvModal).toHaveBeenCalled();

        // Settings button invokes onOpenSettingsModal
        const settingsBtn = screen.getByTitle("tools.terminal.settings_title");
        fireEvent.click(settingsBtn);
        expect(onOpenSettingsModal).toHaveBeenCalled();
    });
});
