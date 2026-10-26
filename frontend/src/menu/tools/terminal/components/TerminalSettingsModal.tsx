import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../../components/Modal";
import Button from "../../../../components/Button";
import Select from "../../../../components/Select";
import ToggleSwitch from "../../../../components/ToggleSwitch";
import type { TerminalSettings, ShellInfo } from "../types";

interface TerminalSettingsModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly settings: TerminalSettings;
    readonly availableShells: ShellInfo[];
    readonly onSaveSettings: (newSettings: TerminalSettings) => Promise<void>;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
    fontFamily: "Consolas, 'Fira Code', Monaco, monospace",
    fontSize: 13,
    lineHeight: 1.2,
    theme: "vyloserve-dark",
    cursorStyle: "block",
    cursorBlink: true,
    defaultCwd: "",
    defaultShell: "powershell",
    scrollback: 5000,
    copyOnSelect: false
};

const FONT_OPTIONS = [
    { value: "Consolas, 'Fira Code', Monaco, monospace", label: "Consolas (Default)" },
    { value: "'Fira Code', Consolas, monospace", label: "Fira Code" },
    { value: "'JetBrains Mono', Consolas, monospace", label: "JetBrains Mono" },
    { value: "'Cascadia Code', Consolas, monospace", label: "Cascadia Code" },
    { value: "'Courier New', monospace", label: "Courier New" }
];

const THEME_OPTIONS = [
    { value: "vyloserve-dark", label: "VyloServe Dark (Default)", swatches: ["#090d16", "#38bdf8", "#4ade80"] },
    { value: "vyloserve-light", label: "VyloServe Light", swatches: ["#ffffff", "#0284c7", "#16a34a"] },
    { value: "monokai", label: "Monokai", swatches: ["#272822", "#a6e22e", "#f92672"] },
    { value: "dracula", label: "Dracula", swatches: ["#282a36", "#bd93f9", "#50fa7b"] },
    { value: "nord", label: "Nord", swatches: ["#2e3440", "#88c0d0", "#a3be8c"] },
    { value: "solarized-dark", label: "Solarized Dark", swatches: ["#002b36", "#268bd2", "#859900"] },
    { value: "solarized-light", label: "Solarized Light", swatches: ["#fdf6e3", "#268bd2", "#2aa198"] }
];

const CURSOR_OPTIONS = [
    { value: "block", label: "Block (█)" },
    { value: "underline", label: "Underline (_)" },
    { value: "bar", label: "Bar (|)" }
];

const SCROLLBACK_OPTIONS = [
    { value: "1000", label: "1,000 lines" },
    { value: "3000", label: "3,000 lines" },
    { value: "5000", label: "5,000 lines (Default)" },
    { value: "10000", label: "10,000 lines" },
    { value: "20000", label: "20,000 lines" }
];

export default function TerminalSettingsModal({
    isOpen,
    onClose,
    settings,
    availableShells,
    onSaveSettings
}: TerminalSettingsModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"appearance" | "behavior">("appearance");
    const [currentSettings, setCurrentSettings] = useState<TerminalSettings>(settings || DEFAULT_TERMINAL_SETTINGS);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCurrentSettings(settings ? { ...DEFAULT_TERMINAL_SETTINGS, ...settings } : DEFAULT_TERMINAL_SETTINGS);
            setIsSaving(false);
        }
    }, [isOpen, settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSaveSettings(currentSettings);
            onClose();
        } catch (err) {
            console.error("Failed to save terminal settings:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const shellOptions = availableShells
        .filter((s) => s.available)
        .map((s) => ({
            value: s.id,
            label: `${s.name}${s.is_default ? " (Default)" : ""}`
        }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("tools.terminal.settings_title")}
            icon="tune"
            maxWidthClass="sm:w-[580px] max-w-[calc(100vw-2rem)]"
            bodyPaddingClass="p-6"
            customFooter={
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl w-full">
                    <Button
                        variant="secondary"
                        onClick={() => setCurrentSettings(DEFAULT_TERMINAL_SETTINGS)}
                        disabled={isSaving}
                    >
                        {t("tools.terminal.settings_reset_default")}
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            icon="check"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {t("common.save")}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-5 text-sm">
                {/* Segmented Tab Navigation */}
                <div role="tablist" aria-label={t("tools.terminal.settings_title")} className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "appearance"}
                        onClick={() => setActiveTab("appearance")}
                        className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            activeTab === "appearance"
                                ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">palette</span>
                        <span>{t("tools.terminal.settings_tab_appearance")}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "behavior"}
                        onClick={() => setActiveTab("behavior")}
                        className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            activeTab === "behavior"
                                ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">settings</span>
                        <span>{t("tools.terminal.settings_tab_behavior")}</span>
                    </button>
                </div>

                {activeTab === "appearance" ? (
                    <div className="space-y-4">
                        {/* 1. Font Family */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="term-opt-font" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.settings_font_family")}
                            </label>
                            <Select
                                id="term-opt-font"
                                options={FONT_OPTIONS}
                                value={currentSettings.fontFamily}
                                onChange={(val) => setCurrentSettings((prev) => ({ ...prev, fontFamily: val }))}
                                searchable={false}
                            />
                        </div>

                        {/* 2. Font Size & Line Height */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="term-opt-font-size" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                        {t("tools.terminal.settings_font_size")}
                                    </label>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                        {currentSettings.fontSize}px
                                    </span>
                                </div>
                                <input
                                    id="term-opt-font-size"
                                    type="range"
                                    min="11"
                                    max="22"
                                    step="1"
                                    value={currentSettings.fontSize}
                                    onChange={(e) =>
                                        setCurrentSettings((prev) => ({
                                            ...prev,
                                            fontSize: Number.parseInt(e.target.value, 10)
                                        }))
                                    }
                                    className="w-full accent-primary cursor-pointer mt-1"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="term-opt-line-height" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {t("tools.terminal.settings_line_height")}
                                </label>
                                <select
                                    id="term-opt-line-height"
                                    value={currentSettings.lineHeight.toString()}
                                    onChange={(e) =>
                                        setCurrentSettings((prev) => ({
                                            ...prev,
                                            lineHeight: Number.parseFloat(e.target.value)
                                        }))
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-primary cursor-pointer shadow-xs"
                                >
                                    <option value="1.0">1.0 (Compact)</option>
                                    <option value="1.1">1.1</option>
                                    <option value="1.2">1.2 (Default)</option>
                                    <option value="1.3">1.3</option>
                                    <option value="1.4">1.4 (Spacious)</option>
                                </select>
                            </div>
                        </div>

                        {/* 3. Terminal Theme */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="term-opt-theme" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.settings_theme")}
                            </label>
                            <Select
                                id="term-opt-theme"
                                options={THEME_OPTIONS}
                                value={currentSettings.theme}
                                onChange={(val) => setCurrentSettings((prev) => ({ ...prev, theme: val }))}
                                searchable={false}
                            />
                        </div>

                        {/* 4. Cursor Style & Cursor Blink */}
                        <div className="grid grid-cols-2 gap-4 items-center pt-1">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="term-opt-cursor" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {t("tools.terminal.settings_cursor_style")}
                                </label>
                                <Select
                                    id="term-opt-cursor"
                                    options={CURSOR_OPTIONS}
                                    value={currentSettings.cursorStyle}
                                    onChange={(val) =>
                                        setCurrentSettings((prev) => ({
                                            ...prev,
                                            cursorStyle: val as "block" | "underline" | "bar"
                                        }))
                                    }
                                    searchable={false}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 mt-5">
                                <div className="flex flex-col">
                                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                                        {t("tools.terminal.settings_cursor_blink")}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        {t("tools.terminal.settings_cursor_blink_desc")}
                                    </span>
                                </div>
                                <ToggleSwitch
                                    label={t("tools.terminal.settings_cursor_blink")}
                                    checked={currentSettings.cursorBlink}
                                    onChange={(checked) =>
                                        setCurrentSettings((prev) => ({ ...prev, cursorBlink: checked }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 1. Default Shell */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="term-opt-def-shell" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.settings_default_shell")}
                            </label>
                            <Select
                                id="term-opt-def-shell"
                                options={shellOptions}
                                value={currentSettings.defaultShell}
                                onChange={(val) => setCurrentSettings((prev) => ({ ...prev, defaultShell: val }))}
                                searchable={false}
                            />
                        </div>

                        {/* 2. Default Working Directory */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="term-opt-def-cwd" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.settings_default_cwd")}
                            </label>
                            <input
                                id="term-opt-def-cwd"
                                type="text"
                                value={currentSettings.defaultCwd}
                                onChange={(e) => setCurrentSettings((prev) => ({ ...prev, defaultCwd: e.target.value }))}
                                placeholder="C:\Users\username"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-primary shadow-xs"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t("tools.terminal.settings_default_cwd_desc")}
                            </p>
                        </div>

                        {/* 3. Scrollback Lines */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="term-opt-scrollback" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {t("tools.terminal.settings_scrollback")}
                            </label>
                            <Select
                                id="term-opt-scrollback"
                                options={SCROLLBACK_OPTIONS}
                                value={currentSettings.scrollback.toString()}
                                onChange={(val) =>
                                    setCurrentSettings((prev) => ({
                                        ...prev,
                                        scrollback: Number.parseInt(val, 10)
                                    }))
                                }
                                searchable={false}
                            />
                        </div>

                        {/* 4. Copy on Select */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                                    {t("tools.terminal.settings_copy_on_select")}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {t("tools.terminal.settings_copy_on_select_desc")}
                                </span>
                            </div>
                            <ToggleSwitch
                                label={t("tools.terminal.settings_copy_on_select")}
                                checked={currentSettings.copyOnSelect}
                                onChange={(checked) =>
                                    setCurrentSettings((prev) => ({ ...prev, copyOnSelect: checked }))
                                }
                            />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}