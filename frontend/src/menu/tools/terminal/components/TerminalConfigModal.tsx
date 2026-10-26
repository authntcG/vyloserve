import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../../components/Modal";
import Button from "../../../../components/Button";
import Select from "../../../../components/Select";
import ToggleSwitch from "../../../../components/ToggleSwitch";
import type { TerminalSettings, ShellInfo, RuntimeMatrix, RuntimeProfile } from "../types";

interface TerminalConfigModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly initialTab?: "env" | "appearance" | "behavior";
    // Environment Props
    readonly currentProfile: RuntimeProfile;
    readonly defaultProfile?: RuntimeProfile;
    readonly activeSessionTitle?: string;
    readonly onApplyProfile: (newProfile: RuntimeProfile, scope: "current" | "global") => void;
    readonly onOpenInNewTab?: (newProfile: RuntimeProfile) => void;
    // Settings Props
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
    cursorBlinkStyle: "classic",
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

export default function TerminalConfigModal({
    isOpen,
    onClose,
    initialTab = "env",
    currentProfile,
    defaultProfile = {},
    activeSessionTitle,
    onApplyProfile,
    onOpenInNewTab,
    settings,
    availableShells,
    onSaveSettings
}: TerminalConfigModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"env" | "appearance" | "behavior">(initialTab);

    // Environment State
    const [matrix, setMatrix] = useState<RuntimeMatrix>({});
    const [scope, setScope] = useState<"current" | "global">("current");
    const [profile, setProfile] = useState<RuntimeProfile>(currentProfile);
    const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

    // Settings State
    const [currentSettings, setCurrentSettings] = useState<TerminalSettings>(settings || DEFAULT_TERMINAL_SETTINGS);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setScope("current");
            setProfile(currentProfile);
            setCurrentSettings(settings ? { ...DEFAULT_TERMINAL_SETTINGS, ...settings } : DEFAULT_TERMINAL_SETTINGS);
            setIsSaving(false);
            setIsLoadingMatrix(true);

            const fetchMatrix = async () => {
                const api = (window as any).pywebview?.api;
                if (api?.get_terminal_runtimes_matrix) {
                    try {
                        const res = await api.get_terminal_runtimes_matrix();
                        if (res && typeof res === "object") {
                            setMatrix(res);
                        }
                    } catch (e) {
                        console.error("Failed to fetch runtime matrix:", e);
                    }
                }
                setIsLoadingMatrix(false);
            };

            fetchMatrix();
        }
    }, [isOpen, initialTab, currentProfile, settings]);

    const handleApplyEnv = () => {
        onApplyProfile(profile, scope);
        onClose();
    };

    const handleOpenNewTab = () => {
        if (onOpenInNewTab) {
            onOpenInNewTab(profile);
            onClose();
        }
    };

    const handleSetAllEnv = (mode: "vyloserve" | "os") => {
        const next: RuntimeProfile = {};
        for (const [key, item] of Object.entries(matrix)) {
            if (mode === "vyloserve" && item.has_vyloserve) {
                if (item.versions && item.versions.length > 0) {
                    next[key] = item.versions[0].path;
                } else if (item.path) {
                    next[key] = item.path;
                } else {
                    next[key] = "vyloserve";
                }
            } else if (mode === "os" && item.has_os) {
                next[key] = "os";
            } else {
                next[key] = item.default_mode;
            }
        }
        setProfile(next);
    };

    const handleSaveSettings = async () => {
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

    const CURSOR_BLINK_STYLE_OPTIONS = [
        { value: "classic", label: t("tools.terminal.cursor_blink_classic") },
        { value: "smooth", label: t("tools.terminal.cursor_blink_smooth") },
        { value: "gradient", label: t("tools.terminal.cursor_blink_gradient") },
        { value: "none", label: t("tools.terminal.cursor_blink_none") }
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("tools.terminal.config_title")}
            icon="settings"
            maxWidthClass="sm:w-[720px] md:w-[820px] max-w-[calc(100vw-2rem)]"
            bodyPaddingClass="p-0"
            customFooter={
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl w-full">
                    {activeTab === "env" ? (
                        <>
                            {scope === "current" && onOpenInNewTab ? (
                                <Button
                                    variant="secondary"
                                    icon="tab"
                                    onClick={handleOpenNewTab}
                                >
                                    {t("tools.terminal.env_open_new_tab")}
                                </Button>
                            ) : (
                                <div />
                            )}
                            <div className="flex items-center gap-3">
                                <Button variant="secondary" onClick={onClose}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    variant="primary"
                                    icon="check"
                                    onClick={handleApplyEnv}
                                >
                                    {t("tools.terminal.env_apply")}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
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
                                    onClick={handleSaveSettings}
                                    disabled={isSaving}
                                >
                                    {t("common.save")}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            }
        >
            <div className="flex flex-row h-[70vh] min-h-[450px] max-h-[600px] bg-white dark:bg-slate-900 rounded-b-xl overflow-hidden">
                {/* VERTICAL SIDEBAR TABS */}
                <div
                    role="tablist"
                    aria-label={t("tools.terminal.config_title")}
                    className="w-56 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-1 shrink-0 overflow-y-auto"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "env"}
                        onClick={() => setActiveTab("env")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                            activeTab === "env"
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">bolt</span>
                        <span className="truncate">{t("tools.terminal.config_tab_env")}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "appearance"}
                        onClick={() => setActiveTab("appearance")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                            activeTab === "appearance"
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">palette</span>
                        <span className="truncate">{t("tools.terminal.config_tab_appearance")}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "behavior"}
                        onClick={() => setActiveTab("behavior")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                            activeTab === "behavior"
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">settings</span>
                        <span className="truncate">{t("tools.terminal.config_tab_behavior")}</span>
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 p-6 overflow-y-auto min-w-0">

                {/* Tab 1: Environment Stack */}
                {activeTab === "env" && (
                    <div className="flex flex-col gap-4">
                        {/* 1. Scope Selector */}
                        <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 shadow-2xs">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                {t("tools.terminal.scope_title")}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setScope("current");
                                        setProfile(currentProfile);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                        scope === "current"
                                            ? "bg-primary text-white border-primary shadow-xs"
                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                                    }`}
                                >
                                    <span aria-hidden="true" className="material-symbols-outlined text-[15px]">tab</span>
                                    <span className="truncate">
                                        {activeSessionTitle
                                            ? `${t("tools.terminal.scope_current_tab")} (${activeSessionTitle})`
                                            : t("tools.terminal.scope_current_tab")}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setScope("global");
                                        setProfile(defaultProfile);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                        scope === "global"
                                            ? "bg-primary text-white border-primary shadow-xs"
                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                                    }`}
                                >
                                    <span aria-hidden="true" className="material-symbols-outlined text-[15px]">public</span>
                                    <span className="truncate">{t("tools.terminal.scope_global_default")}</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {scope === "current"
                                    ? t("tools.terminal.scope_current_desc")
                                    : t("tools.terminal.scope_global_desc")}
                            </p>
                        </div>

                        {/* 2. Quick Presets */}
                        <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Presets:
                            </span>
                            <button
                                type="button"
                                onClick={() => handleSetAllEnv("vyloserve")}
                                className="px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">bolt</span>
                                VyloServe Stack
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetAllEnv("os")}
                                className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">terminal</span>
                                OS Native Only
                            </button>
                        </div>

                        {/* 3. Engine List */}
                        {isLoadingMatrix ? (
                            <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
                                <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                                <span className="text-xs">Loading runtime matrix...</span>
                            </div>
                        ) : Object.keys(matrix).length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">
                                No runtimes detected in VyloServe.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {Object.entries(matrix).map(([engineKey, item]) => {
                                    const selectedValue = profile[engineKey] || item.default_mode;
                                    const isCustomValue = selectedValue === "os"
                                        ? false
                                        : item.versions && item.versions.length > 0
                                        ? selectedValue !== item.versions[0].path
                                        : false;

                                    return (
                                        <div
                                            key={engineKey}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-[140px]">
                                                <span className="material-symbols-outlined text-primary text-[20px]">
                                                    {engineKey === "php" ? "terminal" : engineKey === "node" ? "javascript" : "code"}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                                        {item.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                                        {selectedValue === "os" ? item.os_path || "OS Default" : "VyloServe Managed"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-1 max-w-[340px]">
                                                <label htmlFor={`term-engine-select-${engineKey}`} className="sr-only">
                                                    {item.name}
                                                </label>
                                                <select
                                                    id={`term-engine-select-${engineKey}`}
                                                    value={selectedValue}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setProfile((prev) => ({ ...prev, [engineKey]: val }));
                                                    }}
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-primary cursor-pointer shadow-xs"
                                                >
                                                    {item.versions && item.versions.length > 0 ? (
                                                        item.versions.map((ver) => (
                                                            <option key={ver.path} value={ver.path}>
                                                                {ver.display_name}
                                                            </option>
                                                        ))
                                                    ) : item.has_vyloserve ? (
                                                        <option value={item.path || "vyloserve"}>
                                                            {item.name} (VyloServe)
                                                        </option>
                                                    ) : null}

                                                    {item.has_os && (
                                                        <option value="os">
                                                            OS System Default {item.os_path ? `(${item.os_path})` : ""}
                                                        </option>
                                                    )}
                                                </select>

                                                {isCustomValue && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-500 dark:text-amber-400 shrink-0">
                                                        MOD
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Tampilan / Appearance */}
                {activeTab === "appearance" && (
                    <div className="space-y-4">
                        {/* Font Family */}
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

                        {/* Font Size & Line Height */}
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

                        {/* Terminal Theme */}
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

                        {/* Cursor Style & Cursor Blink Style */}
                        <div className="grid grid-cols-2 gap-4">
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

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="term-opt-cursor-anim" className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {t("tools.terminal.settings_cursor_anim")}
                                </label>
                                <Select
                                    id="term-opt-cursor-anim"
                                    options={CURSOR_BLINK_STYLE_OPTIONS}
                                    value={currentSettings.cursorBlinkStyle || (currentSettings.cursorBlink ? "classic" : "none")}
                                    onChange={(val) =>
                                        setCurrentSettings((prev) => ({
                                            ...prev,
                                            cursorBlinkStyle: val as "classic" | "smooth" | "gradient" | "none",
                                            cursorBlink: val !== "none"
                                        }))
                                    }
                                    searchable={false}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 3: Perilaku / Behavior */}
                {activeTab === "behavior" && (
                    <div className="space-y-4">
                        {/* Default Shell */}
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

                        {/* Default Working Directory */}
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

                        {/* Scrollback Lines */}
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

                        {/* Copy on Select */}
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
            </div>
        </Modal>
    );
}
