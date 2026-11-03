export interface ShellInfo {
    id: string;
    name: string;
    icon: string;
    available: boolean;
    path: string;
    is_default: boolean;
}

export interface TerminalSession {
    id: string;
    title: string;
    shell_id: string;
    cwd: string;
    lastCwd?: string;
    historyBuffer?: string;
    isClosed?: boolean;
    exitCode?: number;
    envProfile?: Record<string, string>;
    isCustomEnv?: boolean;
    envProfileSummary?: string;
    color?: string;
    icon?: string;
}

export interface TerminalPreset {
    id: string;
    name: string;
    shell_id: string;
    cwd: string;
    lastCwd?: string;
    historyBuffer?: string;
    envProfile: RuntimeProfile;
    color?: string;
    icon?: string;
    createdAt?: number;
}

export interface TerminalWorkspaceTab {
    title: string;
    shell_id: string;
    cwd: string;
    lastCwd?: string;
    historyBuffer?: string;
    envProfile?: RuntimeProfile;
    color?: string;
    icon?: string;
}

export interface TerminalWorkspace {
    id: string;
    name: string;
    tabs: TerminalWorkspaceTab[];
    createdAt?: number;
}

export interface TerminalSettings {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    theme: string;
    cursorStyle: "block" | "underline" | "bar";
    cursorBlink: boolean;
    cursorBlinkStyle?: "classic" | "smooth" | "gradient" | "none";
    defaultCwd: string;
    defaultShell: string;
    scrollback: number;
    copyOnSelect: boolean;
}

export interface RuntimeVersionInfo {
    version: string;
    path: string;
    display_name: string;
}

export interface RuntimeMatrixItem {
    name: string;
    has_vyloserve: boolean;
    has_os: boolean;
    os_path?: string | null;
    path?: string;
    versions?: RuntimeVersionInfo[];
    default_mode: string;
}

export type RuntimeMatrix = Record<string, RuntimeMatrixItem>;
export type RuntimeProfile = Record<string, string>;
