import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TerminalMain from "../../src/menu/tools/terminal/Main";
import TerminalToolbar from "../../src/menu/tools/terminal/components/TerminalToolbar";
import TerminalTabBar from "../../src/menu/tools/terminal/components/TerminalTabBar";
import TerminalEnvModal from "../../src/menu/tools/terminal/components/TerminalEnvModal";
import type { TerminalSession, ShellInfo, RuntimeMatrix } from "../../src/menu/tools/terminal/types";

let lastCustomKeyHandler: ((event: KeyboardEvent) => boolean) | null = null;
let mockTerminalInstance: any = null;

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
            attachCustomKeyEventHandler = vi.fn().mockImplementation((handler) => {
                lastCustomKeyHandler = handler;
            });
            hasSelection = vi.fn().mockReturnValue(false);
            getSelection = vi.fn().mockReturnValue("selected sample text");
            clearSelection = vi.fn();
            selectAll = vi.fn();
            clear = vi.fn();
            options = { fontSize: 13 };
            cols = 120;
            rows = 30;

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
        }
    };
});

describe("Terminal Components & Main View", () => {
    const mockShells: ShellInfo[] = [
        { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true },
        { id: "cmd", name: "Command Prompt", icon: "terminal", available: true, path: "cmd.exe", is_default: false },
        { id: "git-bash", name: "Git Bash", icon: "terminal", available: false, path: "", is_default: false }
    ];

    const mockMatrix: RuntimeMatrix = {
        php: {
            name: "PHP",
            has_vyloserve: true,
            has_os: true,
            os_path: "C:\\php\\php.exe",
            default_mode: "vyloserve",
            versions: [
                { version: "8.2.0", path: "D:\\vyloserve\\bin\\php\\php-8.2.0", display_name: "PHP 8.2.0 (VyloServe)" },
                { version: "8.3.0", path: "D:\\vyloserve\\bin\\php\\php-8.3.0", display_name: "PHP 8.3.0 (VyloServe)" }
            ]
        },
        node: {
            name: "Node.js",
            has_vyloserve: true,
            has_os: true,
            os_path: "C:\\Program Files\\nodejs\\node.exe",
            path: "D:\\vyloserve\\bin\\runtimes\\node\\20.10.0",
            default_mode: "D:\\vyloserve\\bin\\runtimes\\node\\20.10.0",
            versions: [
                { version: "20.10.0", path: "D:\\vyloserve\\bin\\runtimes\\node\\20.10.0", display_name: "Node.js 20.10.0 (VyloServe)" }
            ]
        }
    };

    beforeEach(() => {
        lastCustomKeyHandler = null;
        mockTerminalInstance = null;

        (globalThis as any).ResizeObserver = class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        };

        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
                readText: vi.fn().mockResolvedValue("clipboard text")
            }
        });

        (window as any).pywebview = {
            api: {
                get_terminal_shells: vi.fn().mockResolvedValue(mockShells),
                get_terminal_runtimes_matrix: vi.fn().mockResolvedValue(mockMatrix),
                create_terminal_session: vi.fn().mockImplementation((shellId, cwd, title, envOverrides, envProfile) =>
                    Promise.resolve({
                        status: "success",
                        session: {
                            id: `sess-${Date.now()}-${Math.random()}`,
                            title: title || (shellId || "powershell").toUpperCase(),
                            shell_id: shellId || "powershell",
                            cwd: cwd || "C:\\Users\\Test"
                        }
                    })
                ),
                send_terminal_input: vi.fn().mockResolvedValue({ status: "success" }),
                resize_terminal: vi.fn().mockResolvedValue({ status: "success" }),
                close_terminal_session: vi.fn().mockResolvedValue({ status: "success" })
            }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders TerminalMain and auto-initializes default shell session", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect((window as any).pywebview.api.get_terminal_shells).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledWith(
                "powershell",
                "",
                "",
                undefined,
                expect.any(Object)
            );
        });
    });

    it("renders TerminalTabBar and switches active tabs", () => {
        const mockSessions: TerminalSession[] = [
            { id: "s1", title: "PowerShell", shell_id: "powershell", cwd: "C:\\Users" },
            { id: "s2", title: "Project Alpha", shell_id: "powershell", cwd: "D:\\Projects\\Alpha" }
        ];

        const onSelectTab = vi.fn();
        const onCloseTab = vi.fn();
        const onNewTab = vi.fn();

        render(
            <TerminalTabBar
                sessions={mockSessions}
                activeSessionId="s1"
                availableShells={mockShells}
                onSelectTab={onSelectTab}
                onCloseTab={onCloseTab}
                onNewTab={onNewTab}
            />
        );

        expect(screen.getByText("PowerShell")).toBeInTheDocument();
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Project Alpha"));
        expect(onSelectTab).toHaveBeenCalledWith("s2");
    });

    it("renders TerminalToolbar with cwd, shell details and env badge", () => {
        const session: TerminalSession = {
            id: "s1",
            title: "PowerShell",
            shell_id: "powershell",
            cwd: "D:\\Projects\\vyloserve"
        };
        const onOpenEnvModal = vi.fn();

        render(
            <TerminalToolbar
                activeSession={session}
                onOpenEnvModal={onOpenEnvModal}
                envProfileSummary="VyloStack"
            />
        );

        expect(screen.getByText("POWERSHELL")).toBeInTheDocument();
        expect(screen.getByText(/D:\\Projects\\vyloserve/)).toBeInTheDocument();
        expect(screen.getByText("VyloStack")).toBeInTheDocument();
        expect(screen.getByText("Ctrl + `")).toBeInTheDocument();

        fireEvent.click(screen.getByText("VyloStack"));
        expect(onOpenEnvModal).toHaveBeenCalledTimes(1);
    });

    it("responds to vylo_open_terminal_project event and creates project tab", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledWith(
                "powershell",
                "",
                "",
                undefined,
                expect.any(Object)
            );
        });

        window.dispatchEvent(
            new CustomEvent("vylo_open_terminal_project", {
                detail: { cwd: "D:\\Projects\\MyNextApp", title: "MyNextApp" }
            })
        );

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledWith(
                "powershell",
                "D:\\Projects\\MyNextApp",
                "MyNextApp",
                undefined,
                expect.any(Object)
            );
        });
    });

    it("handles Tab key via customKeyEventHandler and transmits tab character to backend PTY", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect(lastCustomKeyHandler).not.toBeNull();
        });

        const tabEvent = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
        const preventSpy = vi.spyOn(tabEvent, "preventDefault");

        const handled = lastCustomKeyHandler!(tabEvent);

        expect(handled).toBe(false);
        expect(preventSpy).toHaveBeenCalled();
        expect((window as any).pywebview.api.send_terminal_input).toHaveBeenCalledWith(
            expect.any(String),
            "\t"
        );
    });

    it("handles Ctrl+C copying selection when text is selected vs passing SIGINT when not selected", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect(lastCustomKeyHandler).not.toBeNull();
            expect(mockTerminalInstance).not.toBeNull();
        });

        // 1. Text is selected
        mockTerminalInstance.hasSelection.mockReturnValue(true);
        const copyEvent = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true });
        const copyPreventSpy = vi.spyOn(copyEvent, "preventDefault");

        const handledWithSelection = lastCustomKeyHandler!(copyEvent);
        expect(handledWithSelection).toBe(false);
        expect(copyPreventSpy).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("selected sample text");

        // 2. No selection -> should return true (pass through to PTY for SIGINT)
        mockTerminalInstance.hasSelection.mockReturnValue(false);
        const sigintEvent = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true });
        const sigintPreventSpy = vi.spyOn(sigintEvent, "preventDefault");

        const handledWithoutSelection = lastCustomKeyHandler!(sigintEvent);
        expect(handledWithoutSelection).toBe(true);
        expect(sigintPreventSpy).not.toHaveBeenCalled();
    });

    it("opens TerminalContextMenu on contextmenu event and supports Select All and Clear", async () => {
        const { container } = render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect(mockTerminalInstance).not.toBeNull();
        });

        // Find the terminal instance wrapper
        const terminalWrapper = container.querySelector(".rounded-b-xl.overflow-hidden");
        expect(terminalWrapper).toBeInTheDocument();

        fireEvent.contextMenu(terminalWrapper!, { clientX: 200, clientY: 200 });

        // Check context menu is visible via translation key
        await waitFor(() => {
            expect(screen.getByText("tools.terminal.context_select_all")).toBeInTheDocument();
            expect(screen.getByText("tools.terminal.context_clear")).toBeInTheDocument();
        });

        // Click Select All
        fireEvent.click(screen.getByText("tools.terminal.context_select_all"));
        expect(mockTerminalInstance.selectAll).toHaveBeenCalled();

        // Right-click again and click Clear Terminal
        fireEvent.contextMenu(terminalWrapper!, { clientX: 200, clientY: 200 });
        await waitFor(() => {
            expect(screen.getByText("tools.terminal.context_clear")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText("tools.terminal.context_clear"));
        expect(mockTerminalInstance.clear).toHaveBeenCalled();
    });

    it("renders TerminalEnvModal and allows configuring runtime profile", async () => {
        const onApplyProfile = vi.fn();
        const onClose = vi.fn();

        render(
            <TerminalEnvModal
                isOpen={true}
                onClose={onClose}
                currentProfile={{ php: "vyloserve" }}
                onApplyProfile={onApplyProfile}
            />
        );

        await waitFor(() => {
            expect((window as any).pywebview.api.get_terminal_runtimes_matrix).toHaveBeenCalled();
            expect(screen.getByText("PHP")).toBeInTheDocument();
            expect(screen.getByText("Node.js")).toBeInTheDocument();
        });

        // Click preset 'OS Native Only'
        fireEvent.click(screen.getByText("OS Native Only"));

        // Click Apply
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));

        expect(onApplyProfile).toHaveBeenCalledWith(
            expect.objectContaining({
                php: "os"
            })
        );
        expect(onClose).toHaveBeenCalled();
    });

    it("shows restart confirmation modal when profile changes with active session and supports restart now", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(1);
        });

        // Open environment modal via toolbar badge
        const envBadge = screen.getByText("VyloServe Stack");
        fireEvent.click(envBadge);

        await waitFor(() => {
            expect(screen.getByText("tools.terminal.env_title")).toBeInTheDocument();
        });

        // Click preset 'OS Native Only'
        fireEvent.click(screen.getByText("OS Native Only"));

        // Click Apply in Env modal
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));

        // Expect restart confirmation modal to be displayed
        await waitFor(() => {
            expect(screen.getByText("tools.terminal.env_restart_title")).toBeInTheDocument();
            expect(screen.getByText("tools.terminal.env_restart_now")).toBeInTheDocument();
            expect(screen.getByText("tools.terminal.env_restart_later")).toBeInTheDocument();
        });

        // Click Restart Now
        fireEvent.click(screen.getByText("tools.terminal.env_restart_now"));

        await waitFor(() => {
            expect((window as any).pywebview.api.close_terminal_session).toHaveBeenCalled();
            // Second create_terminal_session call with updated profile containing os
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(2);
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenLastCalledWith(
                "powershell",
                "C:\\Users\\Test",
                "POWERSHELL",
                undefined,
                expect.objectContaining({ php: "os", node: "os" })
            );
        });
    });

    it("supports applying environment profile to new tabs only without restarting active session", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(1);
        });

        // Open environment modal
        fireEvent.click(screen.getByText("VyloServe Stack"));

        await waitFor(() => {
            expect(screen.getByText("tools.terminal.env_title")).toBeInTheDocument();
        });

        // Click preset 'OS Native Only'
        fireEvent.click(screen.getByText("OS Native Only"));

        // Click Apply
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));

        // Expect restart confirmation modal
        await waitFor(() => {
            expect(screen.getByText("tools.terminal.env_restart_title")).toBeInTheDocument();
        });

        // Click Apply to New Tabs Only
        fireEvent.click(screen.getByText("tools.terminal.env_restart_later"));

        // Active session should NOT be closed or recreated
        expect((window as any).pywebview.api.close_terminal_session).not.toHaveBeenCalled();
        expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(1);

        // Confirmation modal should close
        await waitFor(() => {
            expect(screen.queryByText("tools.terminal.env_restart_title")).not.toBeInTheDocument();
        });

        // Opening a new tab should now use the newly applied profile
        const newTabButton = screen.getByTitle("tools.terminal.new_tab");
        fireEvent.click(newTabButton);

        await waitFor(() => {
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(2);
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenLastCalledWith(
                "powershell",
                "",
                "",
                undefined,
                expect.objectContaining({ php: "os", node: "os" })
            );
        });
    });
});
