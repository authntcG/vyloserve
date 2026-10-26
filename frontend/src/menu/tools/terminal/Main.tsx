import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "../../../components/PageHeader";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import TerminalTabBar from "./components/TerminalTabBar";
import TerminalToolbar from "./components/TerminalToolbar";
import TerminalInstance from "./components/TerminalInstance";
import TerminalPresetsMenu from "./components/TerminalPresetsMenu";
import TerminalSavePresetModal from "./components/TerminalSavePresetModal";
import TerminalConfigModal from "./components/TerminalConfigModal";
import type {
    TerminalSession,
    ShellInfo,
    RuntimeProfile,
    TerminalPreset,
    TerminalWorkspace,
    TerminalWorkspaceTab,
    TerminalSettings
} from "./types";

const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
    fontFamily: "JetBrains Mono, Consolas, 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 1.2,
    theme: "vyloserve-dark",
    cursorStyle: "bar",
    cursorBlink: true,
    cursorBlinkStyle: "classic",
    defaultShell: "powershell",
    defaultCwd: "",
    scrollback: 5000,
    copyOnSelect: false,
};

interface TerminalMainProps {
    readonly isActive?: boolean;
}

export default function TerminalMain({ isActive = true }: TerminalMainProps) {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
    const [defaultProfile, setDefaultProfile] = useState<RuntimeProfile>({});
    const [runtimeProfile, setRuntimeProfile] = useState<RuntimeProfile>({});
    const [pendingProfile, setPendingProfile] = useState<{ profile: RuntimeProfile; scope: "current" | "global" } | null>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [configModalTab, setConfigModalTab] = useState<"env" | "appearance" | "behavior">("env");
    const [presets, setPresets] = useState<TerminalPreset[]>([]);
    const [workspaces, setWorkspaces] = useState<TerminalWorkspace[]>([]);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveModalMode, setSaveModalMode] = useState<"preset" | "workspace">("preset");
    const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>(DEFAULT_TERMINAL_SETTINGS);
    const [detectedCwd, setDetectedCwd] = useState<string | undefined>(undefined);
    const [activeHistoryBuffer, setActiveHistoryBuffer] = useState<string | undefined>(undefined);
    const [allTabsHistory, setAllTabsHistory] = useState<Record<string, string>>({});
    const bufferAccessorsRef = useRef<Map<string, () => string>>(new Map());
    const isInitializedRef = useRef(false);

    // 1. Fetch available shells and saved presets/config from backend
    useEffect(() => {
        const fetchInitialData = async () => {
            const api = (window as any).pywebview?.api;
            let loadedDefaultProfile: RuntimeProfile = {};
            let loadedSettings: TerminalSettings = DEFAULT_TERMINAL_SETTINGS;

            if (api?.get_terminal_config) {
                try {
                    const res = await api.get_terminal_config();
                    if (res?.status === "success" && res?.config?.default_profile) {
                        loadedDefaultProfile = res.config.default_profile;
                        setDefaultProfile(res.config.default_profile);
                        setRuntimeProfile(res.config.default_profile);
                    }
                    if (res?.status === "success" && res?.config?.settings) {
                        loadedSettings = { ...DEFAULT_TERMINAL_SETTINGS, ...res.config.settings };
                        setTerminalSettings(loadedSettings);
                    }
                } catch (e) {
                    console.error("Failed to fetch terminal config:", e);
                }
            }

            if (api?.get_terminal_saved_sessions) {
                try {
                    const res = await api.get_terminal_saved_sessions();
                    if (res?.status === "success") {
                        if (Array.isArray(res.presets)) setPresets(res.presets);
                        if (Array.isArray(res.workspaces)) setWorkspaces(res.workspaces);
                    }
                } catch (e) {
                    console.error("Failed to fetch terminal saved sessions:", e);
                }
            }

            if (api?.get_terminal_shells) {
                try {
                    const shells = await api.get_terminal_shells();
                    if (Array.isArray(shells) && shells.length > 0) {
                        setAvailableShells(shells);
                        if (!isInitializedRef.current && sessions.length === 0) {
                            isInitializedRef.current = true;
                            const defaultShell =
                                (loadedSettings.defaultShell && shells.find((s: ShellInfo) => s.id === loadedSettings.defaultShell && s.available)?.id) ||
                                shells.find((s: ShellInfo) => s.is_default && s.available)?.id ||
                                "powershell";
                            const initialCwd = loadedSettings.defaultCwd || undefined;
                            handleCreateSession(defaultShell, initialCwd, undefined, loadedDefaultProfile);
                        }
                        return;
                    }
                } catch (e) {
                    console.error("Failed to fetch terminal shells:", e);
                }
            }
        };

        fetchInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Create new terminal session
    const handleCreateSession = useCallback(
        async (
            shellId?: string,
            cwd?: string,
            title?: string,
            profile?: RuntimeProfile,
            color?: string,
            icon?: string,
            historyBuffer?: string
        ) => {
            const api = (window as any).pywebview?.api;
            if (!api?.create_terminal_session) return;

            const targetShell =
                shellId ||
                (terminalSettings.defaultShell && availableShells.find((s) => s.id === terminalSettings.defaultShell && s.available)?.id) ||
                availableShells.find((s) => s.is_default && s.available)?.id ||
                "powershell";

            const targetCwd = cwd || terminalSettings.defaultCwd || "";
            const effectiveProfile = profile || defaultProfile || runtimeProfile;
            const isCustom = Boolean(
                profile &&
                Object.keys(profile).length > 0 &&
                JSON.stringify(profile) !== JSON.stringify(defaultProfile)
            );

            try {
                const res = await api.create_terminal_session(
                    targetShell,
                    targetCwd,
                    title || "",
                    undefined,
                    effectiveProfile
                );
                if (res?.status === "success" && res?.session) {
                    const newSession: TerminalSession = {
                        id: res.session.id,
                        title: res.session.title || title || targetShell.toUpperCase(),
                        shell_id: res.session.shell_id || targetShell,
                        cwd: res.session.cwd || targetCwd,
                        lastCwd: targetCwd,
                        historyBuffer,
                        envProfile: effectiveProfile,
                        isCustomEnv: isCustom,
                        color,
                        icon
                    };
                    setSessions((prev) => [...prev, newSession]);
                    setActiveSessionId(newSession.id);
                }
            } catch (err) {
                console.error("Failed to create terminal session:", err);
            }
        },
        [availableShells, defaultProfile, runtimeProfile, terminalSettings]
    );

    // Buffer accessor registration for active sessions
    const handleRegisterBufferAccessor = useCallback((sessionId: string, accessor: () => string) => {
        bufferAccessorsRef.current.set(sessionId, accessor);
    }, []);

    // 3. Close terminal session
    const handleCloseSession = useCallback(
        async (sessionId: string) => {
            bufferAccessorsRef.current.delete(sessionId);
            const api = (window as any).pywebview?.api;
            if (api?.close_terminal_session) {
                try {
                    await api.close_terminal_session(sessionId);
                } catch (err) {
                    console.error("Failed to close terminal session:", err);
                }
            }

            setSessions((prev) => {
                const next = prev.filter((s) => s.id !== sessionId);
                if (activeSessionId === sessionId) {
                    const nextActive = next.length > 0 ? next[next.length - 1].id : null;
                    setActiveSessionId(nextActive);
                }
                return next;
            });
        },
        [activeSessionId]
    );

    // 4. Restart closed session or re-apply profile
    const handleRestartSession = useCallback(
        async (sessionId: string, newProfile?: RuntimeProfile, isCustom?: boolean) => {
            const target = sessions.find((s) => s.id === sessionId);
            if (!target) return;

            const api = (window as any).pywebview?.api;
            if (api?.close_terminal_session) {
                try {
                    await api.close_terminal_session(sessionId);
                } catch (err) {
                    console.error("Failed to close terminal session for restart:", err);
                }
            }

            const effectiveProfile = newProfile ?? target.envProfile ?? defaultProfile ?? runtimeProfile;
            const effectiveCustom = isCustom !== undefined ? isCustom : target.isCustomEnv;

            if (api?.create_terminal_session) {
                try {
                    const res = await api.create_terminal_session(
                        target.shell_id,
                        target.cwd || "",
                        target.title || "",
                        undefined,
                        effectiveProfile
                    );
                    if (res?.status === "success" && res?.session) {
                        const updatedSession: TerminalSession = {
                            id: res.session.id,
                            title: res.session.title || target.title,
                            shell_id: res.session.shell_id || target.shell_id,
                            cwd: res.session.cwd || target.cwd,
                            envProfile: effectiveProfile,
                            isCustomEnv: effectiveCustom,
                            color: target.color,
                            icon: target.icon
                        };
                        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
                        setActiveSessionId(updatedSession.id);
                    }
                } catch (err) {
                    console.error("Failed to re-create terminal session:", err);
                }
            }
        },
        [sessions, defaultProfile, runtimeProfile]
    );

    // 5. Handle session exit emitted from process
    const handleSessionExit = useCallback((sessionId: string, exitCode: number) => {
        setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, isClosed: true, exitCode } : s))
        );
    }, []);

    // 6. Deep linking listener: 'vylo_open_terminal_project' (e.g. from Apache cards)
    useEffect(() => {
        const handleOpenProject = (e: Event) => {
            const customEvent = e as CustomEvent<{ cwd: string; title?: string }>;
            if (customEvent.detail?.cwd) {
                handleCreateSession(
                    undefined,
                    customEvent.detail.cwd,
                    customEvent.detail.title || "Project"
                );
            }
        };

        window.addEventListener("vylo_open_terminal_project", handleOpenProject);
        return () => window.removeEventListener("vylo_open_terminal_project", handleOpenProject);
    }, [handleCreateSession]);

    // 6b. Real-time dynamic CWD tracking for active session
    useEffect(() => {
        if (!activeSessionId || !isActive) return;

        let isMounted = true;
        const checkActiveCwd = async () => {
            const api = (window as any).pywebview?.api;
            if (!api?.get_terminal_session_cwd) return;
            try {
                const res = await api.get_terminal_session_cwd(activeSessionId);
                if (isMounted && res?.status === "success" && res?.cwd) {
                    setSessions((prev) =>
                        prev.map((s) => {
                            if (s.id === activeSessionId && s.cwd !== res.cwd) {
                                return { ...s, cwd: res.cwd, lastCwd: res.cwd };
                            }
                            return s;
                        })
                    );
                }
            } catch (_) {}
        };

        checkActiveCwd();

        // Check periodically every 3 seconds while active
        const interval = setInterval(checkActiveCwd, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeSessionId, isActive]);

    // 7. Preset & Workspace Handlers
    const handleLaunchPreset = useCallback(
        (preset: TerminalPreset) => {
            handleCreateSession(
                preset.shell_id,
                preset.lastCwd || preset.cwd,
                preset.name,
                preset.envProfile,
                preset.color,
                preset.icon,
                preset.historyBuffer
            );
        },
        [handleCreateSession]
    );

    const handleDeletePreset = useCallback(async (presetId: string) => {
        const api = (window as any).pywebview?.api;
        if (api?.delete_terminal_preset) {
            try {
                await api.delete_terminal_preset(presetId);
            } catch (e) {
                console.error("Failed to delete preset:", e);
            }
        }
        setPresets((prev) => prev.filter((p) => p.id !== presetId));
    }, []);

    const handleLaunchWorkspace = useCallback(
        (workspace: TerminalWorkspace) => {
            for (const tab of workspace.tabs) {
                handleCreateSession(
                    tab.shell_id,
                    tab.lastCwd || tab.cwd,
                    tab.title,
                    tab.envProfile,
                    tab.color,
                    tab.icon,
                    tab.historyBuffer
                );
            }
        },
        [handleCreateSession]
    );

    const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
        const api = (window as any).pywebview?.api;
        if (api?.delete_terminal_workspace) {
            try {
                await api.delete_terminal_workspace(workspaceId);
            } catch (e) {
                console.error("Failed to delete workspace:", e);
            }
        }
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    }, []);

    const handleSavePreset = useCallback(
        async (presetData: {
            name: string;
            shell_id: string;
            cwd: string;
            lastCwd?: string;
            historyBuffer?: string;
            envProfile: RuntimeProfile;
            color: string;
            icon: string;
        }) => {
            const api = (window as any).pywebview?.api;
            if (api?.save_terminal_preset) {
                try {
                    const res = await api.save_terminal_preset(presetData);
                    if (res?.status === "success" && res?.preset) {
                        setPresets((prev) => {
                            const idx = prev.findIndex((p) => p.id === res.preset.id);
                            if (idx >= 0) {
                                const next = [...prev];
                                next[idx] = res.preset;
                                return next;
                            }
                            return [...prev, res.preset];
                        });
                    }
                } catch (e) {
                    console.error("Failed to save preset:", e);
                }
            }
        },
        []
    );

    const handleSaveWorkspace = useCallback(
        async (workspaceData: {
            name: string;
            tabs: TerminalWorkspaceTab[];
        }) => {
            const api = (window as any).pywebview?.api;
            if (api?.save_terminal_workspace) {
                try {
                    const res = await api.save_terminal_workspace(workspaceData);
                    if (res?.status === "success" && res?.workspace) {
                        setWorkspaces((prev) => {
                            const idx = prev.findIndex((w) => w.id === res.workspace.id);
                            if (idx >= 0) {
                                const next = [...prev];
                                next[idx] = res.workspace;
                                return next;
                            }
                            return [...prev, res.workspace];
                        });
                    }
                } catch (e) {
                    console.error("Failed to save workspace:", e);
                }
            }
        },
        []
    );

    const handleSaveSettings = useCallback(async (newSettings: TerminalSettings) => {
        setTerminalSettings(newSettings);
        const api = (window as any).pywebview?.api;
        if (api?.save_terminal_settings) {
            try {
                await api.save_terminal_settings(newSettings);
            } catch (e) {
                console.error("Failed to save terminal settings:", e);
            }
        }
    }, []);

    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const currentEffectiveProfile = activeSession?.envProfile || runtimeProfile;

    const handleOpenSavePresetModal = useCallback(async () => {
        setSaveModalMode("preset");
        let detected: string | undefined = undefined;
        if (activeSessionId) {
            const api = (window as any).pywebview?.api;
            if (api?.get_terminal_session_cwd) {
                try {
                    const res = await api.get_terminal_session_cwd(activeSessionId);
                    if (res?.status === "success" && res?.cwd) {
                        detected = res.cwd;
                    }
                } catch (e) {
                    console.error("Failed to detect session cwd:", e);
                }
            }
        }
        setDetectedCwd(detected || activeSession?.cwd || "");
        const buf = activeSessionId ? bufferAccessorsRef.current.get(activeSessionId)?.() : "";
        setActiveHistoryBuffer(buf);
        setIsSaveModalOpen(true);
    }, [activeSessionId, activeSession]);

    const handleOpenSaveWorkspaceModal = useCallback(async () => {
        setSaveModalMode("workspace");
        const historyMap: Record<string, string> = {};
        for (const s of sessions) {
            const buf = bufferAccessorsRef.current.get(s.id)?.() || "";
            if (buf) {
                historyMap[s.id] = buf;
            }
        }
        setAllTabsHistory(historyMap);
        setIsSaveModalOpen(true);
    }, [sessions]);

    const handleApplyProfile = useCallback(
        (newProfile: RuntimeProfile, scope: "current" | "global") => {
            setIsConfigModalOpen(false);

            if (scope === "current") {
                const currentSession = sessions.find((s) => s.id === activeSessionId);
                const isDiff =
                    JSON.stringify(newProfile) !==
                    JSON.stringify(currentSession?.envProfile || defaultProfile || runtimeProfile);
                if (!isDiff) return;

                if (sessions.length > 0 && activeSessionId) {
                    setPendingProfile({ profile: newProfile, scope: "current" });
                } else {
                    setRuntimeProfile(newProfile);
                }
            } else {
                // Global default
                const isDiff = JSON.stringify(newProfile) !== JSON.stringify(defaultProfile);
                if (!isDiff) return;

                setDefaultProfile(newProfile);
                setRuntimeProfile(newProfile);

                const api = (window as any).pywebview?.api;
                if (api?.save_terminal_default_profile) {
                    api.save_terminal_default_profile(newProfile).catch(console.error);
                }

                // If active session does not have custom env, offer restart to apply immediately
                const currentSession = sessions.find((s) => s.id === activeSessionId);
                if (currentSession && !currentSession.isCustomEnv) {
                    setPendingProfile({ profile: newProfile, scope: "global" });
                }
            }
        },
        [sessions, activeSessionId, defaultProfile, runtimeProfile]
    );

    // Summary text for toolbar environment badge
    const envProfileSummary = useMemo(() => {
        const osCount = Object.values(currentEffectiveProfile).filter((v) => v === "os").length;
        if (osCount > 0) {
            return `Hybrid (${osCount} OS)`;
        }
        return "VyloServe Stack";
    }, [currentEffectiveProfile]);

    return (
        <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
            <div className="flex-none mb-3">
                <PageHeader
                    title={t("tools.terminal.title")}
                    subtitle={t("tools.terminal.subtitle")}
                    icon="terminal"
                />
            </div>

            <div className={`flex flex-col flex-1 min-h-0 w-full ${terminalSettings?.theme?.includes("light") ? "bg-white" : "bg-[#090d16]"} rounded-xl border border-slate-300 dark:border-slate-800 shadow-xl overflow-hidden`}>
                <TerminalTabBar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    availableShells={availableShells}
                    onSelectTab={setActiveSessionId}
                    onCloseTab={handleCloseSession}
                    onNewTab={handleCreateSession}
                    actionsSlot={
                        <TerminalPresetsMenu
                            presets={presets}
                            workspaces={workspaces}
                            activeSession={activeSession}
                            totalSessions={sessions.length}
                            onLaunchPreset={handleLaunchPreset}
                            onDeletePreset={handleDeletePreset}
                            onLaunchWorkspace={handleLaunchWorkspace}
                            onDeleteWorkspace={handleDeleteWorkspace}
                            onOpenSavePresetModal={handleOpenSavePresetModal}
                            onOpenSaveWorkspaceModal={handleOpenSaveWorkspaceModal}
                        />
                    }
                />

                <TerminalToolbar
                    activeSession={activeSession}
                    onRestartSession={handleRestartSession}
                    onOpenConfigModal={(tab) => {
                        setConfigModalTab(tab || "env");
                        setIsConfigModalOpen(true);
                    }}
                    envProfileSummary={envProfileSummary}
                />

                <div className="flex-1 min-h-0 relative w-full h-full overflow-hidden">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                            <span className="material-symbols-outlined text-[48px] opacity-40">terminal</span>
                            <p className="text-sm">{t("tools.terminal.no_sessions")}</p>
                            <Button
                                variant="primary"
                                size="sm"
                                icon="add"
                                onClick={() => handleCreateSession()}
                                className="shadow-md"
                            >
                                {t("tools.terminal.open_session")}
                            </Button>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <TerminalInstance
                                key={session.id}
                                session={session}
                                isActive={session.id === activeSessionId && isActive}
                                settings={terminalSettings}
                                onSessionExit={handleSessionExit}
                                onRestartSession={handleRestartSession}
                                onRegisterBufferAccessor={handleRegisterBufferAccessor}
                            />
                        ))
                    )}
                </div>
            </div>

            <TerminalConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                initialTab={configModalTab}
                currentProfile={currentEffectiveProfile}
                defaultProfile={defaultProfile}
                activeSessionTitle={activeSession?.title}
                onApplyProfile={handleApplyProfile}
                onOpenInNewTab={(newProfile) => {
                    handleCreateSession(undefined, undefined, undefined, newProfile);
                }}
                settings={terminalSettings}
                availableShells={availableShells}
                onSaveSettings={handleSaveSettings}
            />

            <TerminalSavePresetModal
                isOpen={isSaveModalOpen}
                mode={saveModalMode}
                onClose={() => setIsSaveModalOpen(false)}
                activeSession={activeSession}
                sessions={sessions}
                availableShells={availableShells}
                detectedCwd={detectedCwd}
                activeHistoryBuffer={activeHistoryBuffer}
                allTabsHistory={allTabsHistory}
                onSavePreset={handleSavePreset}
                onSaveWorkspace={handleSaveWorkspace}
            />

            {/* Restart Terminal Confirmation Modal */}
            <Modal
                isOpen={Boolean(pendingProfile)}
                onClose={() => setPendingProfile(null)}
                title={t("tools.terminal.env_restart_title")}
                icon="restart_alt"
                maxWidthClass="sm:w-[480px]"
                customFooter={
                    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                        <Button
                            variant="secondary"
                            onClick={() => setPendingProfile(null)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (pendingProfile) {
                                    setDefaultProfile(pendingProfile.profile);
                                    setRuntimeProfile(pendingProfile.profile);
                                    const api = (window as any).pywebview?.api;
                                    if (api?.save_terminal_default_profile) {
                                        api.save_terminal_default_profile(pendingProfile.profile).catch(console.error);
                                    }
                                    setPendingProfile(null);
                                }
                            }}
                        >
                            {t("tools.terminal.env_restart_later")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                if (pendingProfile && activeSessionId) {
                                    const targetProfile = pendingProfile.profile;
                                    const isCustom = pendingProfile.scope === "current";
                                    setPendingProfile(null);
                                    await handleRestartSession(activeSessionId, targetProfile, isCustom);
                                }
                            }}
                        >
                            {t("tools.terminal.env_restart_now")}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                    <p>{t("tools.terminal.env_restart_desc")}</p>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                        <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                        <span>{t("tools.terminal.env_restart_warning")}</span>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
