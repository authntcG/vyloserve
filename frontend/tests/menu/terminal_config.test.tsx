import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TerminalConfigModal, { DEFAULT_TERMINAL_SETTINGS } from "../../src/menu/tools/terminal/components/TerminalConfigModal";
import type { TerminalSettings, ShellInfo, RuntimeMatrix, RuntimeProfile } from "../../src/menu/tools/terminal/types";

describe("TerminalConfigModal - Unified Terminal Configuration", () => {
    const mockShells: ShellInfo[] = [
        { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true },
        { id: "cmd", name: "Command Prompt", icon: "terminal", available: true, path: "cmd.exe", is_default: false },
        { id: "bash", name: "Git Bash", icon: "terminal", available: true, path: "bash.exe", is_default: false }
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
        },
        node: {
            name: "Node.js",
            has_vyloserve: false,
            has_os: true,
            os_path: "C:\\Program Files\\nodejs\\node.exe",
            default_mode: "os",
            versions: []
        }
    };

    const initialSettings: TerminalSettings = {
        fontFamily: "Consolas, 'Fira Code', Monaco, monospace",
        fontSize: 13,
        lineHeight: 1.2,
        theme: "vyloserve-dark",
        cursorStyle: "block",
        cursorBlink: true,
        cursorBlinkStyle: "classic",
        defaultShell: "powershell",
        defaultCwd: "D:\\Projects",
        scrollback: 5000,
        copyOnSelect: false
    };

    const initialProfile: RuntimeProfile = {
        php: "D:\\vyloserve\\bin\\php\\php-8.2.0"
    };

    beforeEach(() => {
        (window as any).pywebview = {
            api: {
                get_terminal_runtimes_matrix: vi.fn().mockResolvedValue(mockMatrix)
            }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders modal with 3 tabs and starts on initialTab", () => {
        const onClose = vi.fn();
        const onApplyProfile = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="env"
                currentProfile={initialProfile}
                settings={initialSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={onSaveSettings}
            />
        );

        // Header title
        expect(screen.getByText("tools.terminal.config_title")).toBeInTheDocument();

        // 3 tabs in tablist with General Settings matching typography
        const envTab = screen.getByRole("tab", { name: "tools.terminal.config_tab_env" });
        const appearanceTab = screen.getByRole("tab", { name: "tools.terminal.config_tab_appearance" });
        const behaviorTab = screen.getByRole("tab", { name: "tools.terminal.config_tab_behavior" });

        expect(envTab).toBeInTheDocument();
        expect(appearanceTab).toBeInTheDocument();
        expect(behaviorTab).toBeInTheDocument();

        // Verify typography parity with SettingsModals.tsx sidebar
        expect(envTab.className).toContain("text-sm font-medium");
        expect(appearanceTab.className).toContain("text-sm font-medium");
        expect(behaviorTab.className).toContain("text-sm font-medium");

        // Environment tab elements should be present
        expect(screen.getByText("tools.terminal.scope_title")).toBeInTheDocument();
    });

    it("handles Environment tab: switching scope, selecting presets and applying profile", async () => {
        const onClose = vi.fn();
        const onApplyProfile = vi.fn();
        const onOpenInNewTab = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="env"
                currentProfile={initialProfile}
                defaultProfile={{ php: "default" }}
                activeSessionTitle="Test Session"
                settings={initialSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onOpenInNewTab={onOpenInNewTab}
                onSaveSettings={onSaveSettings}
            />
        );

        await waitFor(() => {
            expect((window as any).pywebview.api.get_terminal_runtimes_matrix).toHaveBeenCalled();
            expect(screen.getAllByText("PHP").length).toBeGreaterThan(0);
            expect(screen.getAllByText("Node.js").length).toBeGreaterThan(0);
        });

        // Switch scope to global
        const globalScopeBtn = screen.getByText("tools.terminal.scope_global_default");
        fireEvent.click(globalScopeBtn);

        // Select preset 'OS Native Only'
        fireEvent.click(screen.getByText("OS Native Only"));

        // Click Apply
        fireEvent.click(screen.getByText("tools.terminal.env_apply"));

        expect(onApplyProfile).toHaveBeenCalledWith(
            expect.objectContaining({ php: "os", node: "os" }),
            "global"
        );
        expect(onClose).toHaveBeenCalled();
    });

    it("handles Appearance tab: modifying font, theme, cursor and cursor animation", async () => {
        const onClose = vi.fn();
        const onApplyProfile = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="appearance"
                currentProfile={initialProfile}
                settings={initialSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={onSaveSettings}
            />
        );

        // Check form elements have accessible labels
        const fontSelectTrigger = screen.getByLabelText("tools.terminal.settings_font_family");
        const sizeInput = screen.getByLabelText("tools.terminal.settings_font_size");
        const lineHeightSelect = screen.getByLabelText("tools.terminal.settings_line_height");
        const cursorStyleTrigger = screen.getByLabelText("tools.terminal.settings_cursor_style");
        const cursorAnimTrigger = screen.getByLabelText("tools.terminal.settings_cursor_anim");
        const themeTrigger = screen.getByLabelText("tools.terminal.settings_theme");

        expect(fontSelectTrigger).toBeInTheDocument();
        expect(sizeInput).toBeInTheDocument();
        expect(lineHeightSelect).toBeInTheDocument();
        expect(cursorStyleTrigger).toBeInTheDocument();
        expect(cursorAnimTrigger).toBeInTheDocument();
        expect(themeTrigger).toBeInTheDocument();

        // Change font size
        fireEvent.change(sizeInput, { target: { value: "15" } });

        // Change line height
        fireEvent.change(lineHeightSelect, { target: { value: "1.4" } });

        // Select cursor animation to gradient
        fireEvent.click(cursorAnimTrigger);
        const gradientOption = screen.getByRole("option", { name: "tools.terminal.cursor_blink_gradient" });
        fireEvent.click(gradientOption);

        // Select theme to vyloserve-light
        fireEvent.click(themeTrigger);
        const lightOption = screen.getByRole("option", { name: /VyloServe Light/i });
        fireEvent.click(lightOption);

        // Save
        const saveBtn = screen.getByText("common.save");
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(onSaveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    fontSize: 15,
                    lineHeight: 1.4,
                    cursorBlinkStyle: "gradient",
                    theme: "vyloserve-light"
                })
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("handles Behavior tab: modifying default shell, cwd, scrollback and copy on select", async () => {
        const onClose = vi.fn();
        const onApplyProfile = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="behavior"
                currentProfile={initialProfile}
                settings={initialSettings}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={onSaveSettings}
            />
        );

        const shellTrigger = screen.getByLabelText("tools.terminal.settings_default_shell");
        const cwdInput = screen.getByLabelText("tools.terminal.settings_default_cwd");
        const scrollbackTrigger = screen.getByLabelText("tools.terminal.settings_scrollback");

        expect(shellTrigger).toBeInTheDocument();
        expect(cwdInput).toBeInTheDocument();
        expect(scrollbackTrigger).toBeInTheDocument();

        // Change default shell to Git Bash
        fireEvent.click(shellTrigger);
        const bashOption = screen.getByRole("option", { name: /Git Bash/i });
        fireEvent.click(bashOption);

        // Change default cwd
        fireEvent.change(cwdInput, { target: { value: "E:\\Dev" } });

        // Change scrollback to 10,000 lines
        fireEvent.click(scrollbackTrigger);
        const scrollbackOption = screen.getByRole("option", { name: /10,000 lines/i });
        fireEvent.click(scrollbackOption);

        // Toggle copy on select
        const toggleBtn = screen.getByRole("checkbox", { name: "tools.terminal.settings_copy_on_select" });
        fireEvent.click(toggleBtn);

        // Save
        const saveBtn = screen.getByText("common.save");
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(onSaveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultShell: "bash",
                    defaultCwd: "E:\\Dev",
                    scrollback: 10000,
                    copyOnSelect: true
                })
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("resets settings to DEFAULT_TERMINAL_SETTINGS when clicking reset", async () => {
        const onClose = vi.fn();
        const onApplyProfile = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalConfigModal
                isOpen={true}
                onClose={onClose}
                initialTab="appearance"
                currentProfile={initialProfile}
                settings={{
                    ...initialSettings,
                    fontSize: 20,
                    cursorBlinkStyle: "smooth",
                    theme: "nord"
                }}
                availableShells={mockShells}
                onApplyProfile={onApplyProfile}
                onSaveSettings={onSaveSettings}
            />
        );

        // Click Reset
        const resetBtn = screen.getByText("tools.terminal.settings_reset_default");
        fireEvent.click(resetBtn);

        // Click Save
        const saveBtn = screen.getByText("common.save");
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(onSaveSettings).toHaveBeenCalledWith(
                expect.objectContaining(DEFAULT_TERMINAL_SETTINGS)
            );
        });
    });
});
