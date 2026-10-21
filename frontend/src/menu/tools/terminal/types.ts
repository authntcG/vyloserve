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
    isClosed?: boolean;
    exitCode?: number;
    envProfile?: Record<string, string>;
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
