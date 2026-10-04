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
- Install Node.js (portable, with Corepack/Yarn/pnpm support), Python (embeddable distribution with pip), Java (OpenJDK/Temurin), and Go.
- Automatically registers each runtime to your system PATH.

### Project Manager
- One-click scaffolding for PHP projects (Laravel, CodeIgniter 4, and more) via a bundled Composer.
- Auto-creates an Apache virtual host with a `.local` domain for every project.
- Auto-registers the domain in your Windows `hosts` file (with an admin-elevation prompt when needed).

### Git & SSL
- Portable Git install, integrated with a built-in terminal.
- Generates a local trusted Root CA, so your `.local` domains get a valid HTTPS lock in the browser.

### Customization
- 10 built-in color themes (VyloServe Dark/Light, Darcula, Solarized Dark/Light, High Contrast Dark/Light, Monokai, Dracula, Nord).
- English and Indonesian language support.
- Choose which services show up on your dashboard.
- Launching VyloServe while it's already running brings the existing window to the front instead of opening a duplicate.

### System Logs
- A centralized, real-time log panel covering every module — installs, service start/stop, errors.
- Live-tails the actual Apache and database log files (`error_log`, `access_log`, `db_startup.log`) into the same panel.
- Filter by log level or category, and view full log files without leaving the app.

### Tunnels (Zrok)
- Share a running Apache project, or any `localhost:<port>` address, to a public URL.
- Run multiple shares at once, each stoppable independently from an Active Shares list.

### Auto-Updater
- Checks GitHub Releases automatically on startup, with a manual check available in Settings.
- Optional opt-in for pre-release (alpha/beta) builds.
- One-click background download with a progress bar, then a silent install on restart.

### Developer Tools
- Base64 encode/decode, for text and drag-and-drop files.
- URL encode/decode with a full URI structure breakdown.
- QR code generator with image download.

## Documentation

This README covers what VyloServe does and how to install it. For anything about how it's built — architecture, backend/frontend internals, testing standards, or running it from source — see [`docs/index.md`](docs/index.md), the entry point to the full documentation set.

## Contributing

Issues and pull requests are welcome. Before opening one, please read [`docs/index.md`](docs/index.md) and [`docs/development_testing.md`](docs/development_testing.md) for the project's setup, testing, and coding standards.

## License

GPL-3.0 — see [LICENSE](LICENSE) for the full text.
