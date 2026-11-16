<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/src/assets/brand-dark.png">
  <img alt="VyloServe" src="frontend/src/assets/brand-nobg.png" width="360">
</picture>

**A one-click local web server manager for Windows.**

[![Latest Release](https://img.shields.io/github/v/release/authntcG/vyloserve?label=latest%20release&style=flat-square)](https://github.com/authntcG/vyloserve/releases/latest)
[![Version](https://img.shields.io/badge/version-v0.0.8--alpha-orange?style=flat-square)](RELEASE_NOTES.md)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&style=flat-square)

[Download](#download--installation) • [Features](#features) • [Documentation](#documentation)

</div>

## What is VyloServe?

VyloServe runs Apache, PHP, MySQL/MariaDB, PostgreSQL, and Redis on your own Windows machine — without installing Windows Services, editing config files by hand, or juggling separate installers for each piece. Everything is controlled from one dashboard: start and stop services, switch PHP versions, create virtual hosts, manage database schemas, install language runtimes, and more.

It's built for web developers who want the convenience of tools like XAMPP or Laragon, with a native desktop app (Python + pywebview) instead of a browser-based control panel.

## Download & Installation

Get the latest build from the [Releases page](https://github.com/authntcG/vyloserve/releases/latest). Each release ships two options:

- **`VyloServe_Setup_v0.0.8-alpha.exe`** — standard installer, adds VyloServe to your Start Menu.
- **`vyloserve_portable.exe`** — no installation, just run it from anywhere.

**Requirements:** Windows 10 (version 1809 or later) or Windows 11, plus the [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/). WebView2 is pre-installed on most up-to-date Windows 10/11 systems — VyloServe will prompt you to install it if it's missing.

## Features

### Web Server (Apache)
- Portable install — no separate Apache download needed.
- Auto-detects a free port and configures Apache to listen on it.
- Routes `.php` requests to PHP automatically through a built-in reverse proxy.
- Runs as a background process — no Windows Service required.

### PHP
- Install and run multiple PHP versions side by side.
- Enable or disable PHP extensions from the UI — no manual `php.ini` editing.
- Change `memory_limit`, `upload_max_filesize`, and other settings from the UI.

### Database (MariaDB, PostgreSQL, & Redis)
- Install MariaDB (MySQL-compatible), PostgreSQL, or Redis (In-Memory Key-Value Store & Cache), independently or side by side.
- Built-in Database Schema Manager: inspect, create, drop, and manage schemas across active database engines without third-party GUI clients.
- Redis Live Stats & Monitoring: real-time RAM usage tracking (`used_memory` vs `maxmemory`), connected client count, keyspace hit/miss ratios, uptime, and an interactive ping latency tester.
- Runs silently in the background without Windows Services, auto-tuning memory settings and avoiding port conflicts with host databases.
- Optimized release fetching with local caching and atomic auto-rollback on install or update failure.
- Cancellable operations with real-time progress tracking across all installation wizards.

### Runtimes Manager
- Multi-version concurrency per engine: install and manage multiple versions of Node.js (with Corepack), Python (embeddable with pip), Java (Adoptium Temurin JDK), and Go (official portable binary).
- Centralized `RuntimePathHub`: single-toggle Windows System PATH management per engine, 1-click active version switcher, and in-card native OS detection preventing priority conflicts.
- Dual layout modes: 100% symmetric inventory cards with standard quick actions (Open Folder, Open Terminal) and high-density Table View.
- Offline resilience: proactive network probe, smart offline indicators, and instant retry mechanisms.

### Projects Hub
- Dedicated top-level project manager supporting multi-runtime framework scaffolding: PHP (Laravel, CodeIgniter 3/4, WordPress, Raw), Node.js (Next.js, Vite/React, Express), Python (FastAPI, Flask, Django), Go (Gin, Fiber, Standard HTTP), and Java (Spring Boot).
- Automated Apache Virtual Hosts (`.local` domains) with reverse proxy port allocation and WebSocket proxy support.
- Automated Windows `hosts` file synchronization (with UAC elevation prompt).
- Integrated Dev Server process manager with live background log tailing.
- Application Logs Viewer (`ProjectAppLogsModal`): framework runtime log tailing, severity filtering, and export.
- Integrated `.env` Editor (`ProjectEnvModal`): password/secret key masking, line-by-line visual diffing, and automated `.env.bak` backups.
- Custom SSL Hosts Customizer (`ProjectSslHostsModal`): configure additional domain aliases and custom SANs.
- Interactive CLI installation modal with real-time bidirectional terminal streaming (PTY/stdin/stdout) for frameworks requiring interactive prompt answers.
- Smart Offline Barrier: allows linking existing directories and scaffolding offline-friendly raw templates when no internet connection is available.

### Developer Terminal
- Integrated multi-tab developer terminal powered by `xterm.js` with real-time bidirectional backend subprocess streaming.
- Shell profile support: PowerShell, Command Prompt (CMD), Git Bash, and custom shells.
- Environment Presets & Scoping: configure scoped profiles (Current Tab vs Global Default, "VyloServe Stack" vs "OS Native Only") injecting specific PHP, Node, Python, Java, Go, or Git paths into session PATH without mutating Windows global PATH.
- Saved Sessions & Workspaces: save custom tab configurations and launch multi-tab tab groups in a single click.
- Real-time current working directory (CWD) detection and terminal appearance customization (font family, size, cursor style, blinking, scrollback).

### Git, SSL & GitLab Integration
- Portable Git installation with aligned in-card native OS warning, adaptive status badges (`Native OS`, `PATH Active`, `Isolated`), toggle lockout, and global git configuration (`user.name`, `user.email`).
- GitLab CLI Integration (`GitLabManager`): manage official portable `glab.exe` binararies, connect multiple accounts (GitLab.com and Self-Hosted instances) via PAT/SSH, non-blocking VPN probing circuit breaker (`requires_vpn`), inspect issues and Merge Requests, and draft comments using AI Action Cards.
- Local trusted Root CA generator (`VyloServeRootCA`) with automatic Windows Trust Store registration for valid HTTPS `.local` domains.

### Customization & Self-Healing Platform
- **Native Splash Bootstrapper & 3-Tier Self-Healing**: DBeaver/JetBrains-style instant frameless splash startup with automatic orphan process cleanup, port conflict diagnostics, and configuration file integrity verification.
- 15 built-in color themes (VyloServe Dark/Light, Darcula, Solarized Dark/Light, High Contrast Dark/Light, Monokai, Dracula, Nord, Windows XP Luna Light, Windows XP Zune Dark, Catppuccin Mocha, Tokyo Night, Gruvbox Dark) with native Windows DWM titlebar color palette synchronization and quick theme search.
- English and Indonesian language support.
- Notification history panel (bell icon) with desktop notifications (`win11toast`) active when window is minimized or hidden in the tray.
- Modular Home Dashboard and safe single-instance management using Windows Named Pipe IPC.

### System Logs
- A centralized, real-time log panel covering every module — installs, service start/stop, errors.
- Live-tails the actual Apache and database log files (`error_log`, `access_log`, `db_startup.log`) into the same panel.
- Filter by log level or category, and view full log files without leaving the app.

### Tunnels (Zrok & Cloudflare Tunnel)
- Share a running Apache project, or any `localhost:<port>` address, to a public URL via open-source [zrok](https://zrok.io) or zero-config Cloudflare Quick Tunnels (`*.trycloudflare.com`).
- Dual view modes (Card View & Table View) with a searchable project selector.
- Run multiple shares at once, each stoppable independently from an Active Shares list.

### Auto-Updater
- Checks GitHub Releases automatically on startup, with a manual check available in Settings.
- Optional opt-in for pre-release (alpha/beta) builds.
- One-click background download with a progress bar, then a silent install on restart.

### AI Server Assistant (Local & Cloud Copilot)
- Context-aware Windows server assistant supporting **Google Gemini**, **Groq Cloud** (ultra-fast LPU inference), **OpenRouter** (DeepSeek, Claude, GPT-4o, and free models), and **Ollama** for 100% local, offline inference.
- **Smart System Context & RAG**: Real-time snapshot of Apache, PHP, databases, runtimes, PATH registration, active tunnels, and live errors coupled with semantic documentation retrieval (`DocRetriever`) from the built-in User Guide.
- **Human-In-The-Loop (HITL) Service Control**: Understands natural language requests (e.g., *"turn on Apache and MariaDB"* or *"stop PHP"*), generating safe action proposal cards for user confirmation before executing background service transitions.
- **Token Usage & Quota Monitor**: Tracks daily and weekly token consumption and request counts against provider free-tier limits right from the chat header, complete with contextual **Follow-up Suggestion Chips** for one-click troubleshooting.
- **Dual Interface Modes**: Switch seamlessly between a dedicated full-screen AI workspace and a global floating chat bubble accessible across all screens.
- **Empirical Tier Probing**: Dynamic model discovery that tests API keys across rate-limited free tiers and automatically selects the highest available tier without hardcoded model constraints.

### Developer Tools & Network Diagnostics
- **Mail Sandbox**: In-process catch-all SMTP server on port 1025. Inspect incoming emails from local applications with an isolated HTML sandbox, plain text, MIME headers, attachments, and one-click `.eml` export.
- **Webhook Inspector**: In-process HTTP webhook daemon on port 9000. Capture incoming payment gateway and Git webhooks, inspect JSON payloads, headers, query parameters, customize HTTP status responses, and generate instant cURL replay commands.
- **Port Manager**: Operating-system level TCP port scanner powered by `psutil`. Inspect listening ports, bound IPs, PIDs, and process names, with safe process termination guarded against core Windows processes.
- Markdown documentation viewer with OS directory picker, recursive folder tree, custom markdown rendering, outline/TOC jump, and local media preview.
- Base64 encode/decode for text and drag-and-drop files, featuring URL-safe mode, line wrapping (64/76/none), and direct binary decoding/download.
- URL encode/decode with a full URI structure breakdown.
- QR code generator supporting WiFi networks, vCard contacts, Email, SMS, and URL/plain text, complete with styling customization, logo embed, error correction, and SVG/PNG export.

### Developer Utilities Hub (100% Client-Side)
- **JSON Studio**: Collapsible tree viewer, syntax validator, minifier, 2/4-space formatter, JSONPath query evaluation, and preset templates.
- **JWT Debugger**: Three-part color-coded decoder (Header, Payload, Signature), real-time expiration countdown, and local HMAC-SHA256 signature verification.
- **Crypto Generator & Hasher**: Instant MD5, SHA-1, SHA-256, SHA-512 hashing, HMAC calculation, UUID v4 generator, and cryptographically secure random token & password generator.
- **Regex & Epoch Studio**: Interactive regex tester with live match highlighting and standard flags (`g`, `i`, `m`, `s`, `u`), alongside a bidirectional Unix epoch converter (seconds/milliseconds to human-readable date and vice versa).
- **Data Converter**: Lossless two-way format transformation between JSON, YAML, XML, and CSV.

## Documentation

This README covers what VyloServe does and how to install it. For anything about how it's built — architecture, backend/frontend internals, testing standards, or running it from source — see [`docs/index.md`](docs/index.md), the entry point to the full documentation set.

## Contributing

Issues and pull requests are welcome. Before opening one, please read [`docs/index.md`](docs/index.md) and [`docs/development_testing.md`](docs/development_testing.md) for the project's setup, testing, and coding standards.

## License

GPL-3.0 — see [LICENSE](LICENSE) for the full text.
