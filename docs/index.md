# VyloServe Documentation

Selamat datang di Dokumentasi Resmi **VyloServe**.
VyloServe adalah aplikasi desktop pengelola server lokal (mirip XAMPP/Laragon) yang mengatur modul seperti Apache, PHP, Database, serta berbagai Runtimes (Node.js, Python, Java, Go). Aplikasi ini dibuat menggunakan Python untuk backend (menjalankan command tingkat OS) dan React untuk antarmuka pengguna (UI) modern.

Dokumentasi ini telah dipecah menjadi beberapa modul spesifik agar lebih mudah dibaca dan dikelola, baik oleh manusia maupun AI Assistant apa pun (Claude Code, OpenAI Codex CLI, Cursor, Gemini, dsb).

## Persyaratan Sistem (System Requirements)
Target spesifikasi untuk menjalankan aplikasi VyloServe secara optimal:
- **Sistem Operasi**: Windows 10 versi 1709 (Bare minimum) / Disarankan & ditest pada Windows 10 versi 1809 atau lebih baru.
- **WebView2 Runtime**: Microsoft Edge Web Runtime (Untuk me-render GUI dari PyWebView).
- **VCRedist**: Visual C++ Redistributable (Dibutuhkan oleh beberapa web engine seperti PHP/Apache).

## Daftar Isi (Table of Contents)

1. [Fitur Aplikasi (Features)](features.md)
   Penjelasan mendetail mengenai semua fitur yang dimiliki oleh VyloServe: Server Apache, PHP, Database (MariaDB, PostgreSQL, Redis dengan visualisasi stats), Runtimes multi-versi, Projects Hub 5 runtime (dengan App Logs real-time, Visual .Env Editor, SSL Hosts), Developer Terminal, Developer Tools (AI Copilot, Tunnels, Markdown Viewer, Mail Sandbox, Webhook Inspector, Port Manager, QR Generator, Base64/URL), Developer Utilities (JSON Studio, JWT Debugger, Crypto Generator, Regex & Epoch Studio, Data Converter), Integrasi GitLab CLI (`glab`), 15 Preset Tema DWM, Native Splash Bootstrapper 3-Tier Health Check, Single-Instance IPC, dsb.
2. [Struktur Proyek (Project Structure)](project_structure.md)
   Penjelasan *Project Tree* dan struktur direktori aplikasi lengkap (Backend Core Services, Core Utils, Frontend Components, Tools, Utilities, dan Test Suites).
3. [Arsitektur & Alur Aplikasi (Architecture & Flow)](architecture_and_flow.md)
   Penjelasan tentang bagaimana Backend Python berkomunikasi dengan Frontend React melalui PyWebView, alur startup Native Splash Bootstrapper dengan 3-Tier Health Self-Healing, In-process Async Daemons (SMTP & Webhook), alur eksekusi PTY/CLI streaming Terminal, GitLab Multi-Host VPN Circuit Breaker, dan Windows Named Pipe single-instance IPC.
4. [Backend Services & Fungsi (Backend Logic)](backend_services.md)
   Daftar mendalam tentang kelas, fungsi, dan dependensi antar layanan di backend: Apache, PHP, Database (MySQL/PG/Redis), Project, Runtimes, Git, GitLab Manager (`glab`), Health Manager, Mail Sandbox, Webhook Inspector, Port Manager, Crypto Tools, SSL, Settings, Updater, Tunnels, Markdown Viewer, AI Assistant, Terminal Manager, dan Splash Window Bootstrapper.
5. [Frontend & Antarmuka (Frontend UI)](frontend_ui.md)
   Panduan mengenai arsitektur React, modularitas view ganda (Card & Table View via `<DataTable>`), direktori `src/menu/utilities/`, modul tools baru, sub-komponen project modals (App Logs, Env Editor, SSL Hosts), komponen bersama `<Input>` & `<TableActionMenu>`, integrasi i18n, sistem 15 tema DWM, dan struktur presentasi visual.
6. [Pengujian & Pengembangan (Development & Testing)](development_testing.md)
   Panduan mengenai setup proyek, unit testing menggunakan Pytest (dengan autouse fixture safeguard Windows Registry & isolasi file pengguna host) & Vitest, standar isolasi test, SonarQube Quality Gate (cakupan coverage ~89.5% & zero-tolerance temuan baru), spesifikasi PyInstaller packaging (`main.spec`), panduan Clean Code & DRY, serta standar Security.
7. [Bugs & Limitasi Diketahui (Known Bugs)](known_bugs.md)
   Daftar komprehensif *bug* yang pernah ditemukan beserta root cause & resolusinya (termasuk kasus #1 hingga #112), serta batasan-batasan teknis aplikasi.
8. [🤖 Panduan Pengembangan untuk AI (AI Development Guide)](ai_development_guide.md)
   **Bacaan wajib untuk Asisten AI.** Berisi: Peta lengkap seluruh endpoint API Backend↔Frontend (termasuk Terminal, Dev Server, Multi-Version Runtimes, GitLab, Mail Sandbox, Webhook Inspector, Port Manager, Crypto Tools, dan Health Bootstrapper), lokasi & format data JSON, pola debugging step-by-step, template implementasi fitur baru, panduan troubleshooting frontend, dependency antar service, dan checklist *Definition of Done*.
9. [🎨 Panduan Konsistensi UI (UI Consistency Guide)](ui_consistency_guide.md)
   **Bacaan wajib sebelum menulis/mengubah UI apa pun.** Aturan warna theme-aware vs statis, spesifikasi komponen bersama (`Button`, `ToggleSwitch`, `Select`, `Input`, `ServiceToggleButton`, `DataTable`, `FilterChips`, `ViewModeToggle`, `InstalledBadge`, `TableActionMenu`), harmonisasi Level 1 & Level 2 Card-Table, dan status migrasi.
10. [🔁 Playbook Kerja (Dev Workflow Playbook)](dev_workflow_playbook.md)
    **Bacaan wajib sebelum menyerahkan perubahan apa pun.** Urutan command verifikasi presisi (tsc/vitest/eslint/pytest), peta "dokumen mana untuk perubahan apa", cara membuktikan regresi-sendiri vs pra-eksisting, dan teknik debugging sistematis untuk test yang gagal membingungkan. Di-*force-load* otomatis untuk Gemini CLI lewat `@import` di `GEMINI.md`; untuk asisten lain dibaca lewat pointer di `.claude/skills/vyloserve-dev-workflow/SKILL.md` atau langsung dari sini.
11. [📘 Panduan Pengguna & Basis Pengetahuan (User Guide & Knowledge Base)](user_guide.md)
    **Panduan lengkap penggunaan aplikasi untuk end-user dan basis data pengetahuan AI.** Mencakup petunjuk mendalam semua fitur, opsi tombol, FAQ per modul, panduan penggunaan 8 tools & utilities baru, integrasi GitLab CLI, troubleshooting teruji, serta glosarium istilah teknis.
12. [🎨 Sistem Desain & Mockup Stitch (VyloServe Design System)](../design.md)
    Spesifikasi token desain (YAML Front Matter), aturan komponen atomik, template HTML Tailwind copy-paste ready, dan prompt blueprint untuk pembuatan mockup di Google Stitch (`stitch.withgoogle.com`).
13. [🐧 Backlog Enhancement Linux (Linux Enhancements Backlog)](linux_enhancements_backlog.md)
    **Panduan teknis dan backlog implementasi fitur khusus Linux.** Menganalisis alur kerja CLI developer di Linux (bentrok permission/chown/chmod, batasan privileged port 80/443 via `setcap`, resolusi bentrok service systemd, Wildcard DNS `*.test` via `systemd-resolved`, Universal Root CA untuk Chrome/Firefox NSS DB, project worker daemon supervisor, dan visual cron scheduler).
14. [🦊 Integrasi GitLab CLI (glab Integration)](backlog_glab_integration.md)
    **Dokumentasi dan spesifikasi implementasi integrasi GitLab CLI (`glab`).** Siklus hidup biner portable `glab` (Windows & Linux), autentikasi token PAT multi-host yang aman, isolasi VPN, dan integrasi AI Assistant untuk interaksi issue, merge request, serta posting komentar terverifikasi (*Human-in-the-Loop*).

---
> **Catatan AI:** 
> Referensi dasar untuk asisten AI telah dikonfigurasi di file `AGENTS.md` pada root direktori. `AGENTS.md` mengikuti standar terbuka [agents.md](https://agents.md) yang didukung lintas-vendor (Claude Code, OpenAI Codex CLI, Cursor, Amp, Jules, dll), sehingga otomatis terbaca lebih dulu oleh model AI apa pun yang membuka proyek ini — berfungsi sebagai gerbang masuk (*entrypoint*) instruksi yang mengarahkan AI untuk membaca seluruh dokumentasi di folder `docs/` ini.
> 
> **Urutan Bacaan yang Direkomendasikan untuk AI:**
> 1. `AGENTS.md` (aturan & arsitektur dasar)
> 2. `docs/ai_development_guide.md` (peta API + pola kerja)
> 3. `docs/development_testing.md` (standar test + security)
> 4. Dokumen spesifik sesuai modul yang dikerjakan
>
> **Jaring pengaman untuk tool yang belum mendukung standar `agents.md` secara native:** repositori ini juga menyediakan file "pointer" tipis di root/`.github/` (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursorrules`, `.windsurfrules`) yang isinya **hanya** mengarahkan balik ke `AGENTS.md` — bukan duplikasi aturan. Ini memastikan AI Assistant apa pun (termasuk yang secara default mencari nama file konvensinya sendiri, bukan `AGENTS.md`) tidak pernah "berjalan buta" tanpa membaca aturan projek ini lebih dulu. Kalau menambah dukungan untuk tool AI baru di masa depan, cek dulu apakah tool tersebut sudah mendukung standar `agents.md`; jika belum, tambahkan pointer tipis serupa alih-alih menyalin ulang isi `AGENTS.md`.

