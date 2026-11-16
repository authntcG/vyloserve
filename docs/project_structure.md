# Struktur Proyek (Project Tree)

Aplikasi VyloServe menggunakan struktur *monorepo* sederhana di mana Backend (Python) dan Frontend (React) berada dalam satu direktori yang sama.

```text
vyloserve/
├── core/                       # Logika Utama Backend Python
│   ├── api.py                  # Router / Facade API yang menjembatani React (PyWebView)
│   ├── utils/                  # Skrip utilitas yang bersifat global (tidak spesifik domain)
│   │   ├── file_utils.py       # Manipulasi JSON, Unduhan file, Ekstraksi arsip (ZIP/TAR)
│   │   ├── system_utils.py     # Pengecekan Port, Subprocess silent (OS CMD), Registry, DWM, Named Pipe IPC
│   │   ├── cancellation.py     # CancellationToken asinkron, pembersihan proses/direktori parsial
│   │   ├── network_utils.py    # Multi-endpoint internet socket probe, deteksi is_network_error
│   │   └── splash_window.py    # Native Tkinter Splash Screen Bootstrapper frameless dengan queue polling & locales
│   └── services/               # Manajer Domain Spesifik (Menerapkan Single Responsibility)
│       ├── apache.py           # Logika Web Server Apache
│       ├── php.py              # Logika instalasi & ekstensi PHP
│       ├── database.py         # Logika MariaDB/MySQL, PostgreSQL, Redis, & Database Schema Manager
│       ├── runtimes_manager.py # Logika Node.js, Python, Java, Go, dan Windows Registry
│       ├── project.py          # Logika Virtual Host, Scaffolding, Dev Server, App Logs, Env Editor, SSL Hosts
│       ├── git_manager.py      # Instalasi PortableGit, Credential Helper, & Global Config
│       ├── gitlab_manager.py   # Siklus hidup biner portable glab, multi-account PAT/SSH, VPN probing, Issue/MR
│       ├── health_manager.py   # 3-Tier Self-Healing Startup Health Check, local config restore, safe cleansing
│       ├── mail_sandbox.py     # In-process Async SMTP mock server (port 1025), email viewer, EML exporter
│       ├── webhook_inspector.py# In-process Async HTTP webhook listener, payload inspection, cURL replay
│       ├── port_manager.py     # Pengecekan port aktif di OS via psutil/netstat & terminasi proses aman
│       ├── crypto_tools.py     # Hash generation (MD5, SHA), HMAC, secure random token/key generator
│       ├── ssl_manager.py      # Pembuatan Certificate Authority (CA) lokal
│       ├── dashboard.py        # Menyimpan Status Toggle UI Dashboard
│       ├── settings.py         # Menyimpan Preferensi Aplikasi (Bahasa, Tema, AI, filter log, opsi update, notifikasi)
│       ├── updater.py          # Auto-Updater: cek/unduh/pasang rilis baru dari GitHub Releases
│       ├── tunnels.py          # Logika tunnel (zrok & Cloudflare) — expose port lokal ke URL publik
│       ├── markdown_viewer.py  # Logika penampil dokumentasi Markdown lokal (scanner tree, reader, media base64)
│       ├── ai_assistant.py     # AI Copilot: in-memory RAG DocRetriever, streaming SSE, usage tracker, HITL
│       └── terminal.py         # Developer Terminal: session manager, multi-tab bridge, environment scoping, presets
├── frontend/                   # Repositori UI berbasis React (Vite + TS)
│   ├── src/
│   │   ├── components/         # Komponen UI Reusable generik (Modal, Card, PageHeader, Select, StatusBadge, dll)
│   │   │   │                   # DataTable.tsx, FilterChips.tsx, ViewModeToggle.tsx, InstalledBadge.tsx, ServiceToggleButton.tsx
│   │   │   │                   # Input.tsx (theme-aware input standar), TableActionMenu.tsx (popover dropdown tabel)
│   │   │   │                   # NotificationBell.tsx (panel histori toast + notifikasi native Windows)
│   │   │   │                   # CompactFileDropzone.tsx, OfflineBanner.tsx, BackgroundProgressWidget.tsx
│   │   │   └── skeleton/       # Primitif Skeleton Loading (Skeleton, SkeletonCard, SkeletonForm, AppSkeletonLayout)
│   │   ├── context/            # React Context Providers untuk UI global dan logika domain per-modul
│   │   │   ├── AlertContext.tsx, ToastContext.tsx (dialog confirm & toast notification)
│   │   │   ├── AiContext.tsx   # AiProvider: state streaming SSE, riwayat chat, usage stats, actions persistence
│   │   │   ├── NetworkContext.tsx # NetworkProvider: status konektivitas internet online/offline reaktif
│   │   │   ├── ProjectContext.tsx # ProjectProvider: state proyek, scaffolding, dev servers, app logs, env, ssl
│   │   │   ├── GitLabContext.tsx  # GitLabProvider: state GitLab CLI, akun multi-host, VPN check, issues & MRs
│   │   │   └── ApacheContext.tsx, PhpContext.tsx, DatabaseContext.tsx, DashboardContext.tsx, RuntimesContext.tsx, TunnelsContext.tsx, GitContext.tsx
│   │   ├── locales/            # Berkas i18n JSON untuk bahasa (en, id)
│   │   ├── menu/                # Halaman utama aplikasi:
│   │   │   ├── dashboard/, apache/, php/
│   │   │   ├── database/       # Main.tsx, DatabaseTable.tsx, DatabaseSchemaModal.tsx, RedisStatsWidget.tsx, NewInstance.tsx, Settings.tsx, ChangePassword.tsx
│   │   │   ├── projects/       # Projects Hub: ProjectsTable.tsx, ProjectCards.tsx, NewProjectModal.tsx, ProjectSettingsModal.tsx, ProjectAppLogsModal.tsx, ProjectEnvModal.tsx, ProjectSslHostsModal.tsx
│   │   │   ├── runtimes/       # RuntimeEnginePanel.tsx, RuntimePathHub.tsx, RuntimeTable.tsx, InstallNode.tsx, InstallPython.tsx, InstallJava.tsx, InstallGo.tsx
│   │   │   ├── tools/          # ai-assistant/, git/ (GitLabIntegrationTab.tsx, GitAccountModal.tsx), qr-generator/, base64-encode-decode/, url-encode-decode/, tunnels/, markdown-viewer/, mail-sandbox/, webhook-inspector/, port-manager/, settings/
│   │   │   │   └── terminal/   # Developer Terminal: TerminalTabBar.tsx, TerminalToolbar.tsx, TerminalInstance.tsx, TerminalSettingsModal.tsx, TerminalEnvModal.tsx, TerminalPresetsMenu.tsx
│   │   │   └── utilities/      # Developer Utilities: crypto-generator/, data-converter/, json-studio/, jwt-debugger/, regex-epoch/
│   │   ├── utils/               # Helper murni lintas-halaman (BUKAN komponen React)
│   │   │   ├── a11y.ts          # onEnterOrSpace() — keyboard support (Enter/Space) utk elemen non-native
│   │   │   ├── progress.ts      # clampPercent() — clamp nilai progress vylo_progress ke [0, 100]
│   │   │   ├── theme.ts         # applyTheme() — atur data-theme, toggle class dark, sync DWM titlebar native
│   │   │   ├── version.ts       # compareVersions() — bandingkan versi semantik (bukan string !=)
│   │   │   ├── clipboard.ts     # copyToClipboard() helper aman dengan toast fallback
│   │   │   ├── dataConverter.ts # Konversi dua arah JSON <-> YAML <-> XML <-> CSV
│   │   │   ├── jsonStudio.ts    # JSON formatting, validator, path querying
│   │   │   ├── jwtDebugger.ts   # JWT decoder, expiration calculator, header/payload inspector
│   │   │   └── regexEpoch.ts    # Regex tester regex flags & Epoch timestamp converter
│   │   ├── hooks/               # Custom React hooks lintas-komponen
│   │   │   ├── useWindowPresence.ts    # Deteksi fokus/minimize/hidden-ke-tray window
│   │   │   └── usePersistedViewMode.ts # Persistensi mode tampilan Card vs Table ke localStorage per modul
│   │   ├── i18n.ts             # Konfigurasi react-i18next
│   │   └── App.tsx             # Routing MANUAL via useState (BUKAN React Router)
│   ├── package.json            # Daftar dependensi Frontend (React, Tailwind, i18next)
│   └── vite.config.ts          # Konfigurasi bundler Vite
├── tests/                      # Folder Unit Test (Pytest)
│   ├── test_utils/             # Pengujian modul utils (file_utils, system_utils, splash_window, dll)
│   └── test_services/          # Pengujian layanan utama (1.159 unit tests, coverage 89.5%+, mocks & isolated tmp_path)
├── bin/                        # (Ter-Generate) Folder instalasi engine (Apache, PHP, Node, Python, Java, Go, Git, glab, Tunnels, Redis)
├── data/                       # (Ter-Generate) Folder konfigurasi aplikasi, SSL, & logs
│                               # (apache.json, projects.json, settings.json, dashboard.json, gitlab.json, terminal_config.json, ai_chat_history.json, VyloServeRootCA.key)
├── www/                        # (Ter-Generate) Direktori utama penyimpan proyek Web
├── main.py                     # Entrypoint aplikasi (PyWebView, System Tray, Named Pipe IPC, AppLifecycle)
├── main.spec                   # Spesifikasi PyInstaller executable bundling (datas, webview, certifi, hiddenimports)
├── requirements.txt            # Dependensi Python
└── AGENTS.md                   # Instruksi dasar untuk AI Assistant (standar agents.md, lintas-vendor)
```

## Penjelasan Direktori *Generate*
Direktori-direktori berikut tidak disimpan di Git (di-ignore), namun akan terbuat secara otomatis saat aplikasi dijalankan dan digunakan oleh pengguna:
*   `bin/`: Seluruh binary executable dari layanan (Apache, PHP, dsb) akan diletakkan di sini. Aplikasi VyloServe bersifat mandiri dan *portable*, tidak bergantung pada instalasi C:/Program Files. Arsip unduhan (`.zip`/`.tar.gz`) juga diunduh LANGSUNG ke subfolder service-nya sendiri di sini (mis. `bin/database/<db_id>.zip`) sebelum diekstrak ke tempat yang sama — tidak ada direktori temp terpisah.
*   `data/`: Menyimpan konfigurasi state dalam bentuk JSON (seperti `apache.json`, `settings.json`, `dashboard.json`, `ai_chat_history.json`, `ai_action_states.json`, `ai_usage.json`), serta kunci SSL (`VyloServeRootCA.key`).
*   `www/`: Direktori *Document Root* global. Di sinilah proyek-proyek seperti Laravel atau CodeIgniter akan diletakkan.
