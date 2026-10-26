import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../../components/Modal";
import Button from "../../../../components/Button";
import type { RuntimeMatrix, RuntimeProfile } from "../types";

interface TerminalEnvModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly currentProfile: RuntimeProfile;
    readonly defaultProfile?: RuntimeProfile;
    readonly activeSessionTitle?: string;
    readonly onApplyProfile: (newProfile: RuntimeProfile, scope: "current" | "global") => void;
    readonly onOpenInNewTab?: (newProfile: RuntimeProfile) => void;
}

export default function TerminalEnvModal({
    isOpen,
    onClose,
    currentProfile,
    defaultProfile = {},
    activeSessionTitle,
    onApplyProfile,
    onOpenInNewTab
}: TerminalEnvModalProps) {
    const { t } = useTranslation();
    const [matrix, setMatrix] = useState<RuntimeMatrix>({});
    const [scope, setScope] = useState<"current" | "global">("current");
    const [profile, setProfile] = useState<RuntimeProfile>(currentProfile);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setScope("current");
        setProfile(currentProfile);
        setIsLoading(true);

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
            setIsLoading(false);
        };

        fetchMatrix();
    }, [isOpen, currentProfile]);

    const handleApply = () => {
        onApplyProfile(profile, scope);
        onClose();
    };

    const handleOpenNewTab = () => {
        if (onOpenInNewTab) {
            onOpenInNewTab(profile);
            onClose();
        }
    };

    const handleSetAll = (mode: "vyloserve" | "os") => {
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t("tools.terminal.env_title")}
            icon="bolt"
            maxWidthClass="sm:w-[640px] max-w-[calc(100vw-2rem)]"
            bodyPaddingClass="p-6"
            customFooter={
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl w-full">
                    {scope === "current" && onOpenInNewTab ? (
                        <Button
                            variant="secondary"
                            icon="tab"
                            onClick={handleOpenNewTab}
                        >
                            {t("tools.terminal.env_open_new_tab")}
                        </Button>
                    ) : <div />}

                    <div className="flex items-center gap-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            icon="check"
                            onClick={handleApply}
                        >
                            {t("tools.terminal.env_apply")}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-5 text-sm">
                {/* 1. Scope Selector */}
                <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/70 dark:bg-slate-800/60 shadow-2xs">
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
                            className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                scope === "current"
                                    ? "bg-primary text-white border-primary shadow-xs"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">tab</span>
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
                            className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                scope === "global"
                                    ? "bg-primary text-white border-primary shadow-xs"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">public</span>
                            <span className="truncate">{t("tools.terminal.scope_global_default")}</span>
                        </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                        {scope === "current"
                            ? t("tools.terminal.scope_current_desc")
                            : t("tools.terminal.scope_global_desc")}
                    </p>
                </div>

                {/* 2. Preset quick buttons */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Presets:
                    </span>
                    <button
                        type="button"
                        onClick={() => handleSetAll("vyloserve")}
                        className="px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        VyloServe Stack
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSetAll("os")}
                        className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[14px]">terminal</span>
                        OS Native Only
                    </button>
                </div>

                {/* 3. Engine list */}
                {isLoading ? (
                    <div className="py-8 text-center text-slate-500">
                        <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                        {Object.entries(matrix).map(([engineKey, item]) => {
                            const rawVal = profile[engineKey] || item.default_mode;
                            const isUsingOS = rawVal === "os";
                            const selectedValue = isUsingOS
                                ? "os"
                                : (rawVal === "vyloserve" && item.versions && item.versions.length > 0
                                    ? item.versions[0].path
                                    : rawVal);

                            const activePathPreview = isUsingOS
                                ? (item.os_path ? `OS PATH: ${item.os_path}` : "OS PATH binary")
                                : (typeof selectedValue === "string" && selectedValue.includes("\\")
                                    ? selectedValue
                                    : item.path || (item.versions?.[0]?.path) || "Managed by VyloServe");

                            return (
                                <div
                                    key={engineKey}
                                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col gap-2 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <label
                                                htmlFor={`term-env-select-${engineKey}`}
                                                className="font-semibold text-slate-800 dark:text-slate-200 text-sm cursor-pointer"
                                            >
                                                {item.name}
                                            </label>
                                            {item.has_vyloserve && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-medium shrink-0">
                                                    {item.versions && item.versions.length > 1
                                                        ? `VyloServe (${item.versions.length} ver)`
                                                        : "VyloServe"}
                                                </span>
                                            )}
                                            {item.has_os && (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-medium shrink-0">
                                                    OS
                                                </span>
                                            )}
                                        </div>

                                        {/* Mode Selector */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <select
                                                id={`term-env-select-${engineKey}`}
                                                aria-label={item.name}
                                                value={selectedValue}
                                                onChange={(e) => {
                                                    setProfile((prev) => ({
                                                        ...prev,
                                                        [engineKey]: e.target.value
                                                    }));
                                                }}
                                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary cursor-pointer min-w-[170px] shadow-sm"
                                            >
                                                {item.has_vyloserve && (
                                                    <>
                                                        {item.versions && item.versions.length > 0 ? (
                                                            item.versions.map((ver) => (
                                                                <option key={ver.path} value={ver.path}>
                                                                    {ver.display_name}
                                                                </option>
                                                            ))
                                                        ) : (
                                                            <option value={item.path || "vyloserve"}>
                                                                {t("tools.terminal.env_use_vyloserve")}
                                                            </option>
                                                        )}
                                                    </>
                                                )}
                                                {item.has_os && (
                                                    <option value="os">
                                                        {t("tools.terminal.env_use_os")}
                                                    </option>
                                                )}
                                                {!item.has_vyloserve && !item.has_os && (
                                                    <option value="none">Not Found</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Path preview */}
                                    <div
                                        className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate px-0.5"
                                        title={activePathPreview}
                                    >
                                        {activePathPreview}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
}
