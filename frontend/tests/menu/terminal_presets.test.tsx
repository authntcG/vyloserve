import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TerminalPresetsMenu from "../../src/menu/tools/terminal/components/TerminalPresetsMenu";
import TerminalSavePresetModal from "../../src/menu/tools/terminal/components/TerminalSavePresetModal";
import TerminalMain from "../../src/menu/tools/terminal/Main";
import type { TerminalPreset, TerminalWorkspace, TerminalSession, ShellInfo } from "../../src/menu/tools/terminal/types";

describe("Terminal Presets, Workspaces & Scoping", () => {
    const mockShells: ShellInfo[] = [
        { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true },
        { id: "cmd", name: "Command Prompt", icon: "terminal", available: true, path: "cmd.exe", is_default: false }
    ];

    const mockPreset: TerminalPreset = {
        id: "p1",
        name: "Laravel Dev",
        shell_id: "powershell",
        cwd: "D:\\Projects\\Laravel",
        envProfile: { php: "D:\\vyloserve\\bin\\php\\php-8.2.0" },
        color: "emerald",
        icon: "terminal"
    };

    const mockWorkspace: TerminalWorkspace = {
        id: "w1",
        name: "Fullstack App",
        tabs: [
            { title: "Frontend", shell_id: "powershell", cwd: "D:\\App\\frontend", envProfile: { node: "20.10.0" } },
            { title: "Backend", shell_id: "powershell", cwd: "D:\\App\\backend", envProfile: { php: "8.2.0" } }
        ]
    };

    const mockSession: TerminalSession = {
        id: "s1",
        title: "Active Tab",
        shell_id: "powershell",
        cwd: "C:\\Users\\Test",
        envProfile: { php: "8.2.0" },
        isCustomEnv: true,
        color: "sky"
    };

    beforeEach(() => {
        (globalThis as any).ResizeObserver = class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        };

        (window as any).pywebview = {
            api: {
                get_terminal_shells: vi.fn().mockResolvedValue(mockShells),
                get_terminal_config: vi.fn().mockResolvedValue({
                    status: "success",
                    config: { default_profile: { php: "default" } }
                }),
                get_terminal_saved_sessions: vi.fn().mockResolvedValue({
                    status: "success",
                    presets: [mockPreset],
                    workspaces: [mockWorkspace]
                }),
                save_terminal_preset: vi.fn().mockImplementation((p) =>
                    Promise.resolve({ status: "success", preset: { ...p, id: "p-new" } })
                ),
                delete_terminal_preset: vi.fn().mockResolvedValue({ status: "success" }),
                save_terminal_workspace: vi.fn().mockImplementation((w) =>
                    Promise.resolve({ status: "success", workspace: { ...w, id: "w-new" } })
                ),
                delete_terminal_workspace: vi.fn().mockResolvedValue({ status: "success" }),
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
                close_terminal_session: vi.fn().mockResolvedValue({ status: "success" })
            }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders TerminalPresetsMenu, opens dropdown, and triggers preset launch & delete", () => {
        const onLaunchPreset = vi.fn();
        const onDeletePreset = vi.fn();
        const onLaunchWorkspace = vi.fn();
        const onDeleteWorkspace = vi.fn();
        const onOpenSavePresetModal = vi.fn();
        const onOpenSaveWorkspaceModal = vi.fn();

        render(
            <TerminalPresetsMenu
                presets={[mockPreset]}
                workspaces={[mockWorkspace]}
                activeSession={mockSession}
                totalSessions={1}
                onLaunchPreset={onLaunchPreset}
                onDeletePreset={onDeletePreset}
                onLaunchWorkspace={onLaunchWorkspace}
                onDeleteWorkspace={onDeleteWorkspace}
                onOpenSavePresetModal={onOpenSavePresetModal}
                onOpenSaveWorkspaceModal={onOpenSaveWorkspaceModal}
            />
        );

        // Open menu
        const toggleBtn = screen.getByLabelText("tools.terminal.saved_sessions_btn");
        fireEvent.click(toggleBtn);

        // Presets & Workspaces should be visible
        expect(screen.getByText("Laravel Dev")).toBeInTheDocument();
        expect(screen.getByText("Fullstack App")).toBeInTheDocument();

        // Launch preset
        fireEvent.click(screen.getByText("Laravel Dev"));
        expect(onLaunchPreset).toHaveBeenCalledWith(mockPreset);

        // Reopen menu to test delete
        fireEvent.click(toggleBtn);
        const deleteButtons = screen.getAllByTitle("tools.terminal.delete_tab");
        fireEvent.click(deleteButtons[0]);
        expect(onDeletePreset).toHaveBeenCalledWith("p1");

        // Click save as tab action
        const savePresetBtn = screen.getByText("tools.terminal.save_tab_action");
        fireEvent.click(savePresetBtn);
        expect(onOpenSavePresetModal).toHaveBeenCalled();
    });

    it("renders TerminalSavePresetModal for preset mode and calls onSavePreset with accessible form fields", async () => {
        const onClose = vi.fn();
        const onSavePreset = vi.fn().mockResolvedValue(undefined);
        const onSaveWorkspace = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalSavePresetModal
                isOpen={true}
                mode="preset"
                onClose={onClose}
                activeSession={mockSession}
                sessions={[mockSession]}
                availableShells={mockShells}
                onSavePreset={onSavePreset}
                onSaveWorkspace={onSaveWorkspace}
            />
        );

        // Check label-input accessibility pair
        const nameInput = screen.getByLabelText("tools.terminal.tab_name_label");
        expect(screen.getByText("tools.terminal.detected_path_label")).toBeInTheDocument();
        const shellSelect = screen.getByLabelText("tools.terminal.shell_label");

        expect(nameInput).toBeInTheDocument();
        expect(shellSelect).toBeInTheDocument();

        // Change name
        fireEvent.change(nameInput, { target: { value: "My React Stack" } });

        // Select color
        const skyColorBtn = screen.getByLabelText("Sky");
        fireEvent.click(skyColorBtn);

        // Submit form
        fireEvent.click(screen.getByText("tools.terminal.save_tab_btn"));

        await waitFor(() => {
            expect(onSavePreset).toHaveBeenCalledWith({
                name: "My React Stack",
                shell_id: "powershell",
                cwd: "C:\\Users\\Test",
                lastCwd: "C:\\Users\\Test",
                historyBuffer: "",
                envProfile: mockSession.envProfile,
                color: "sky",
                icon: "terminal"
            });
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("renders TerminalSavePresetModal for workspace mode and previews tabs", async () => {
        const onClose = vi.fn();
        const onSavePreset = vi.fn().mockResolvedValue(undefined);
        const onSaveWorkspace = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalSavePresetModal
                isOpen={true}
                mode="workspace"
                onClose={onClose}
                activeSession={mockSession}
                sessions={[mockSession, { ...mockSession, id: "s2", title: "Tab 2", shell_id: "cmd" }]}
                availableShells={mockShells}
                onSavePreset={onSavePreset}
                onSaveWorkspace={onSaveWorkspace}
            />
        );

        const wsNameInput = screen.getByLabelText("tools.terminal.group_name_label");
        expect(wsNameInput).toBeInTheDocument();

        // Check tabs preview
        expect(screen.getByText("1. Active Tab")).toBeInTheDocument();
        expect(screen.getByText("2. Tab 2")).toBeInTheDocument();

        fireEvent.change(wsNameInput, { target: { value: "Dual Stack Workspace" } });
        fireEvent.click(screen.getByText("tools.terminal.save_group_btn"));

        await waitFor(() => {
            expect(onSaveWorkspace).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Dual Stack Workspace",
                    tabs: expect.arrayContaining([
                        expect.objectContaining({ title: "Active Tab" }),
                        expect.objectContaining({ title: "Tab 2" })
                    ])
                })
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("launches a saved workspace with multi-tab sessions in TerminalMain", async () => {
        render(<TerminalMain isActive={true} />);

        await waitFor(() => {
            expect((window as any).pywebview.api.get_terminal_saved_sessions).toHaveBeenCalled();
        });

        // Open Saved Sessions dropdown
        const toggleBtn = screen.getByLabelText("tools.terminal.saved_sessions_btn");
        fireEvent.click(toggleBtn);

        // Click launch workspace
        const openWsButtons = screen.getAllByTitle("tools.terminal.launch_group");
        fireEvent.click(openWsButtons[0]);

        await waitFor(() => {
            // Should have created initial tab + 2 tabs from workspace
            expect((window as any).pywebview.api.create_terminal_session).toHaveBeenCalledTimes(3);
        });
    });
});