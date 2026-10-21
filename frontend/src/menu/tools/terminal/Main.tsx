import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "../../../components/PageHeader";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import TerminalTabBar from "./components/TerminalTabBar";
import TerminalToolbar from "./components/TerminalToolbar";
import TerminalInstance from "./components/TerminalInstance";
import TerminalEnvModal from "./components/TerminalEnvModal";
import type { TerminalSession, ShellInfo, RuntimeProfile } from "./types";

interface TerminalMainProps {
    readonly isActive?: boolean;
}

export default function TerminalMain({ isActive = true }: TerminalMainProps) {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
    const [runtimeProfile, setRuntimeProfile] = useState<RuntimeProfile>({});
    const [pendingProfile, setPendingProfile] = useState<RuntimeProfile | null>(null);
    const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
    const isInitializedRef = useRef(false);

    // 1. Fetch available shells from backend
    useEffect(() => {
        const fetchShells = async () => {
            const api = (window as any).pywebview?.api;
            if (api?.get_terminal_shells) {
                try {
                    const shells = await api.get_terminal_shells();
                    if (Array.isArray(shells) && shells.length > 0) {
                        setAvailableShells(shells);
                        return shells;
                    }
                } catch (e) {
                    console.error("Failed to fetch terminal shells:", e);
                }
            }
            return [];
        };

        fetchShells().then((shells) => {
            if (!isInitializedRef.current && sessions.length === 0) {
                isInitializedRef.current = true;
                const defaultShell = shells.find((s: ShellInfo) => s.is_default && s.available)?.id || "powershell";
                handleCreateSession(defaultShell);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Create new terminal session
    const handleCreateSession = useCallback(
        async (shellId?: string, cwd?: string, title?: string, profile?: RuntimeProfile) => {
            const api = (window as any).pywebview?.api;
            if (!api?.create_terminal_session) return;

            const targetShell =
                shellId ||
                availableShells.find((s) => s.is_default && s.available)?.id ||
                "powershell";

            const effectiveProfile = profile || runtimeProfile;

            try {
                const res = await api.create_terminal_session(
                    targetShell,
                    cwd || "",
                    title || "",
                    undefined,
                    effectiveProfile
                );
                if (res?.status === "success" && res?.session) {
                    const newSession: TerminalSession = {
                        id: res.session.id,
                        title: res.session.title || title || targetShell.toUpperCase(),
                        shell_id: res.session.shell_id || targetShell,
                        cwd: res.session.cwd || "",
                        envProfile: effectiveProfile
                    };
                    setSessions((prev) => [...prev, newSession]);
                    setActiveSessionId(newSession.id);
                }
            } catch (err) {
                console.error("Failed to create terminal session:", err);
            }
        },
        [availableShells, runtimeProfile]
    );

    // 3. Close terminal session
    const handleCloseSession = useCallback(
        async (sessionId: string) => {
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
        async (sessionId: string, newProfile?: RuntimeProfile) => {
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

            const effectiveProfile = newProfile ?? runtimeProfile ?? target.envProfile;
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
                            envProfile: effectiveProfile
                        };
                        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
                        setActiveSessionId(updatedSession.id);
                    }
                } catch (err) {
                    console.error("Failed to re-create terminal session:", err);
                }
            }
        },
        [sessions, runtimeProfile]
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

    // Summary text for toolbar environment badge
    const envProfileSummary = useMemo(() => {
        const osCount = Object.values(runtimeProfile).filter((v) => v === "os").length;
        if (osCount > 0) {
            return `Hybrid (${osCount} OS)`;
        }
        return "VyloServe Stack";
    }, [runtimeProfile]);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    return (
        <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
            <div className="flex-none mb-3">
                <PageHeader
                    title={t("tools.terminal.title")}
                    subtitle={t("tools.terminal.subtitle")}
                    icon="terminal"
                />
            </div>

            <div className="flex flex-col flex-1 min-h-0 w-full bg-[#090d16] rounded-xl border border-slate-300 dark:border-slate-800 shadow-xl overflow-hidden">
                <TerminalTabBar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    availableShells={availableShells}
                    onSelectTab={setActiveSessionId}
                    onCloseTab={handleCloseSession}
                    onNewTab={handleCreateSession}
                />

                <TerminalToolbar
                    activeSession={activeSession}
                    onRestartSession={handleRestartSession}
                    onOpenEnvModal={() => setIsEnvModalOpen(true)}
                    envProfileSummary={envProfileSummary}
                />

                <div className="flex-1 min-h-0 relative w-full h-full overflow-hidden">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                            <span className="material-symbols-outlined text-[48px] opacity-40">terminal</span>
                            <p className="text-sm">{t("tools.terminal.no_sessions")}</p>
                            <button
                                type="button"
                                onClick={() => handleCreateSession()}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                {t("tools.terminal.open_session")}
                            </button>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <TerminalInstance
                                key={session.id}
                                session={session}
                                isActive={session.id === activeSessionId && isActive}
                                onSessionExit={handleSessionExit}
                                onRestartSession={handleRestartSession}
                            />
                        ))
                    )}
                </div>
            </div>

            <TerminalEnvModal
                isOpen={isEnvModalOpen}
                onClose={() => setIsEnvModalOpen(false)}
                currentProfile={runtimeProfile}
                onApplyProfile={(newProfile) => {
                    setIsEnvModalOpen(false);
                    const isDifferent = JSON.stringify(newProfile) !== JSON.stringify(runtimeProfile);
                    if (!isDifferent) {
                        return;
                    }

                    if (sessions.length > 0 && activeSessionId) {
                        setPendingProfile(newProfile);
                    } else {
                        setRuntimeProfile(newProfile);
                    }
                }}
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
                            {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (pendingProfile) {
                                    setRuntimeProfile(pendingProfile);
                                    setPendingProfile(null);
                                }
                            }}
                        >
                            {t("tools.terminal.env_restart_later")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                if (pendingProfile) {
                                    const targetProfile = pendingProfile;
                                    setRuntimeProfile(targetProfile);
                                    setPendingProfile(null);
                                    if (activeSessionId) {
                                        await handleRestartSession(activeSessionId, targetProfile);
                                    }
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
