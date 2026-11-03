import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TerminalSettingsModal from "../../src/menu/tools/terminal/components/TerminalSettingsModal";
import TerminalToolbar from "../../src/menu/tools/terminal/components/TerminalToolbar";
import type { TerminalSettings, ShellInfo, TerminalSession } from "../../src/menu/tools/terminal/types";

describe("Terminal Settings & Customization", () => {
    const mockShells: ShellInfo[] = [
        { id: "powershell", name: "PowerShell", icon: "terminal", available: true, path: "powershell.exe", is_default: true },
        { id: "cmd", name: "Command Prompt", icon: "terminal", available: true, path: "cmd.exe", is_default: false }
    ];

    const initialSettings: TerminalSettings = {
        fontFamily: "JetBrains Mono, Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.2,
        theme: "vyloserve-dark",
        cursorStyle: "bar",
        cursorBlink: true,
        defaultShell: "powershell",
        defaultCwd: "D:\\Projects",
        scrollback: 5000,
        copyOnSelect: false
    };

    it("renders modal with Appearance tab by default and has accessible form controls", () => {
        const onClose = vi.fn();
        const onSaveSettings = vi.fn();

        render(
            <TerminalSettingsModal
                isOpen={true}
                onClose={onClose}
                settings={initialSettings}
                availableShells={mockShells}
                onSaveSettings={onSaveSettings}
            />
        );

        expect(screen.getByText("tools.terminal.settings_title")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "tools.terminal.settings_tab_appearance" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "tools.terminal.settings_tab_behavior" })).toBeInTheDocument();

        // Check labels and inputs have matching htmlFor and id
        const fontInput = screen.getByLabelText("tools.terminal.settings_font_family");
        expect(fontInput).toBeInTheDocument();
        expect(fontInput.id).toBe("term-opt-font");

        const sizeInput = screen.getByLabelText("tools.terminal.settings_font_size");
        expect(sizeInput).toBeInTheDocument();
        expect(sizeInput.id).toBe("term-opt-font-size");

        const lineHeightInput = screen.getByLabelText("tools.terminal.settings_line_height");
        expect(lineHeightInput).toBeInTheDocument();
        expect(lineHeightInput.id).toBe("term-opt-line-height");

        const cursorStyleSelect = screen.getByLabelText("tools.terminal.settings_cursor_style");
        expect(cursorStyleSelect).toBeInTheDocument();
        expect(cursorStyleSelect.id).toBe("term-opt-cursor");
    });

    it("switches to Behavior tab and displays behavior settings", () => {
        const onClose = vi.fn();
        const onSaveSettings = vi.fn();

        render(
            <TerminalSettingsModal
                isOpen={true}
                onClose={onClose}
                settings={initialSettings}
                availableShells={mockShells}
                onSaveSettings={onSaveSettings}
            />
        );

        const behaviorTab = screen.getByRole("tab", { name: "tools.terminal.settings_tab_behavior" });
        fireEvent.click(behaviorTab);

        const shellSelect = screen.getByLabelText("tools.terminal.settings_default_shell");
        expect(shellSelect).toBeInTheDocument();
        expect(shellSelect.id).toBe("term-opt-def-shell");

        const cwdInput = screen.getByLabelText("tools.terminal.settings_default_cwd");
        expect(cwdInput).toBeInTheDocument();
        expect(cwdInput.id).toBe("term-opt-def-cwd");

        const scrollbackInput = screen.getByLabelText("tools.terminal.settings_scrollback");
        expect(scrollbackInput).toBeInTheDocument();
        expect(scrollbackInput.id).toBe("term-opt-scrollback");

        expect(screen.getByText("tools.terminal.settings_copy_on_select")).toBeInTheDocument();
    });

    it("allows updating settings and saves changes on submit", async () => {
        const onClose = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalSettingsModal
                isOpen={true}
                onClose={onClose}
                settings={initialSettings}
                availableShells={mockShells}
                onSaveSettings={onSaveSettings}
            />
        );

        // Change font size
        const sizeInput = screen.getByLabelText("tools.terminal.settings_font_size");
        fireEvent.change(sizeInput, { target: { value: "16" } });

        // Change line height
        const lineHeightSelect = screen.getByLabelText("tools.terminal.settings_line_height");
        fireEvent.change(lineHeightSelect, { target: { value: "1.4" } });

        // Save
        const saveBtn = screen.getByText("common.save");
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(onSaveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    fontSize: 16,
                    lineHeight: 1.4
                })
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("resets settings to default values", async () => {
        const onClose = vi.fn();
        const onSaveSettings = vi.fn().mockResolvedValue(undefined);

        render(
            <TerminalSettingsModal
                isOpen={true}
                onClose={onClose}
                settings={{
                    ...initialSettings,
                    fontSize: 22,
                    theme: "nord"
                }}
                availableShells={mockShells}
                onSaveSettings={onSaveSettings}
            />
        );

        const resetBtn = screen.getByText("tools.terminal.settings_reset_default");
        fireEvent.click(resetBtn);

        const saveBtn = screen.getByText("common.save");
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(onSaveSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    fontSize: 13,
                    theme: "vyloserve-dark"
                })
            );
        });
    });

    it("renders settings button on TerminalToolbar and triggers callback", () => {
        const onOpenSettings = vi.fn();
        const mockSession: TerminalSession = {
            id: "s1",
            title: "PowerShell",
            shell_id: "powershell",
            cwd: "C:\\Users\\Test"
        };

        render(
            <TerminalToolbar
                activeSession={mockSession}
                onOpenSettingsModal={onOpenSettings}
            />
        );

        const settingsBtn = screen.getByRole("button", { name: "tools.terminal.settings_title" });
        expect(settingsBtn).toBeInTheDocument();
        fireEvent.click(settingsBtn);
        expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
});
