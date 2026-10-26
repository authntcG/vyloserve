<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="frontend/src/assets/brand-dark.png">
  <img alt="VyloServe" src="frontend/src/assets/brand-nobg.png" width="360">
</picture>

**A one-click local web server manager for Windows.**

[![Latest Release](https://img.shields.io/github/v/release/authntcG/vyloserve?label=latest%20release&style=flat-square)](https://github.com/authntcG/vyloserve/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&style=flat-square)

[Download](#download--installation) • [Features](#features) • [Documentation](#documentation)

</div>

## What is VyloServe?

VyloServe runs Apache, PHP, MySQL/MariaDB, and PostgreSQL on your own Windows machine — without installing Windows Services, editing config files by hand, or juggling separate installers for each piece. Everything is controlled from one dashboard: start and stop services, switch PHP versions, create virtual hosts, install language runtimes, and more.

It's built for web developers who want the convenience of tools like XAMPP or Laragon, with a native desktop app (Python + pywebview) instead of a browser-based control panel.

## Download & Installation

Get the latest build from the [Releases page](https://github.com/authntcG/vyloserve/releases/latest). Each release ships two options:

- **`VyloServe_Setup_vX.X.X.exe`** — standard installer, adds VyloServe to your Start Menu.
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

### Database (MariaDB & PostgreSQL)
- Install MariaDB (MySQL-compatible) or PostgreSQL, independently or side by side.
- Runs silently in the background without Windows Services, and avoids port conflicts with any database already on your machine.
- Auto-tunes memory settings on install.

### Runtimes Manager
- Multi-version concurrency per engine: install and manage multiple versions of Node.js (with Corepack), Python (embeddable with pip), Java (Adoptium Temurin JDK), and Go (official portable binary).
- Centralized `RuntimePathHub`: single-toggle Windows System PATH management per engine, 1-click active version switcher, and in-card native OS detection preventing priority conflicts.
- Dual layout modes: 100% symmetric inventory cards with standard quick actions (Open Folder, Open Terminal) and high-density Table View.

### Projects Hub
- Dedicated top-level project manager supporting multi-runtime framework scaffolding: PHP (Laravel, CodeIgniter 3/4, WordPress, Raw), Node.js (Next.js, Vite/React, Express), Python (FastAPI, Flask, Django), Go (Gin, Fiber, Standard HTTP), and Java (Spring Boot).
- Automated Apache Virtual Hosts (`.local` domains) with reverse proxy port allocation and WebSocket proxy support.
- Automated Windows `hosts` file synchronization (with UAC elevation prompt).
- Integrated Dev Server process manager with live background log tailing.
- Interactive CLI installation modal with real-time bidirectional terminal streaming (PTY/stdin/stdout) for frameworks requiring interactive prompt answers.

### Developer Terminal
- Integrated multi-tab developer terminal powered by `xterm.js` with real-time bidirectional backend subprocess streaming.
- Shell profile support: PowerShell, Command Prompt (CMD), Git Bash, and custom shells.
- Environment Presets & Scoping: launch isolated shell sessions injecting specific PHP, Node, Python, Java, Go, or Git paths into session PATH without modifying Windows global PATH.
- Real-time current working directory (CWD) detection and terminal appearance customization (font family, size, cursor style, blinking, scrollback).

### Git & SSL
- Portable Git installation with aligned in-card native OS warning, adaptive status badges (`Native OS`, `PATH Active`, `Isolated`), toggle lockout, and global git configuration (`user.name`, `user.email`).
- Local trusted Root CA generator (`VyloServeRootCA`) with automatic Windows Trust Store registration for valid HTTPS `.local` domains.

### Customization
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

### Developer Tools
- Markdown documentation viewer with OS directory picker, recursive folder tree, custom markdown rendering, and local media preview.
- Base64 encode/decode, for text and drag-and-drop files.
- URL encode/decode with a full URI structure breakdown.
- QR code generator with image download.

## Documentation

This README covers what VyloServe does and how to install it. For anything about how it's built — architecture, backend/frontend internals, testing standards, or running it from source — see [`docs/index.md`](docs/index.md), the entry point to the full documentation set.

## Contributing

Issues and pull requests are welcome. Before opening one, please read [`docs/index.md`](docs/index.md) and [`docs/development_testing.md`](docs/development_testing.md) for the project's setup, testing, and coding standards.

## License

GPL-3.0 — see [LICENSE](LICENSE) for the full text.
