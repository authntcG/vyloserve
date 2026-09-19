# VyloServe Documentation

Selamat datang di Dokumentasi Resmi **VyloServe**.
VyloServe adalah aplikasi desktop pengelola server lokal (mirip XAMPP/Laragon) yang mengatur modul seperti Apache, PHP, Database, serta berbagai Runtimes (Node.js, Python, Java, Go). Aplikasi ini dibuat menggunakan Python untuk backend (menjalankan command tingkat OS) dan React untuk antarmuka pengguna (UI) modern.

Dokumentasi ini telah dipecah menjadi beberapa modul spesifik agar lebih mudah dibaca dan dikelola, baik oleh manusia maupun AI (seperti Gemini).

## Persyaratan Sistem (System Requirements)
Target spesifikasi untuk menjalankan aplikasi VyloServe secara optimal:
- **Sistem Operasi**: Windows 10 versi 1709 (Bare minimum) / Disarankan & ditest pada Windows 10 versi 1809 atau lebih baru.
- **WebView2 Runtime**: Microsoft Edge Web Runtime (Untuk me-render GUI dari PyWebView).
- **VCRedist**: Visual C++ Redistributable (Dibutuhkan oleh beberapa web engine seperti PHP/Apache).

## Daftar Isi (Table of Contents)

1. [Fitur Aplikasi (Features)](features.md)
   Penjelasan mendetail mengenai semua fitur yang dimiliki oleh VyloServe (Apache, PHP, Database, Runtimes, Project Manager, dsb).
2. [Struktur Proyek (Project Structure)](project_structure.md)
   Penjelasan *Project Tree* dan struktur direktori aplikasi (Backend dan Frontend).
3. [Arsitektur & Alur Aplikasi (Architecture & Flow)](architecture_and_flow.md)
   Penjelasan tentang bagaimana Backend Python berkomunikasi dengan Frontend React melalui PyWebView, serta alur eksekusi algoritma utama.
4. [Backend Services & Fungsi (Backend Logic)](backend_services.md)
   Daftar mendalam tentang kelas, fungsi, dan dependensi antar layanan di backend (Modul Core).
5. [Frontend & Antarmuka (Frontend UI)](frontend_ui.md)
   Panduan mengenai komponen React, integrasi i18n (multi-bahasa), dan struktur presentasi visual.
6. [Pengujian & Pengembangan (Development & Testing)](development_testing.md)
   Panduan mengenai cara melakukan setup proyek, unit testing menggunakan Pytest (beserta **standar wajib test per fitur baru**), panduan Clean Code & DRY, standar Security (validasi input, path traversal, XSS prevention), dan proses build executable.
7. [Bugs & Limitasi Diketahui (Known Bugs)](known_bugs.md)
   Daftar *bug* yang pernah ditemukan (beserta resolusinya) dan batasan-batasan teknis dari aplikasi (misal: IPv6 localhost, masalah UAC).
8. [🤖 Panduan Pengembangan untuk AI (AI Development Guide)](ai_development_guide.md)
   **Bacaan wajib untuk Asisten AI.** Berisi: Peta lengkap semua endpoint API Backend↔Frontend, lokasi & format data JSON, pola debugging step-by-step, template implementasi fitur baru, panduan troubleshooting frontend, dependency antar service, dan checklist *Definition of Done*.

---
> **Catatan AI:** 
> Referensi dasar untuk asisten AI telah dikonfigurasi di file `AGENTS.md` pada root direktori. `AGENTS.md` mengikuti standar terbuka [agents.md](https://agents.md) yang didukung lintas-vendor (Claude Code, OpenAI Codex CLI, Cursor, Amp, Jules, dll), sehingga otomatis terbaca lebih dulu oleh model AI apa pun yang membuka proyek ini — berfungsi sebagai gerbang masuk (*entrypoint*) instruksi yang mengarahkan AI untuk membaca seluruh dokumentasi di folder `docs/` ini.
> 
> **Urutan Bacaan yang Direkomendasikan untuk AI:**
> 1. `AGENTS.md` (aturan & arsitektur dasar)
> 2. `docs/ai_development_guide.md` (peta API + pola kerja)
> 3. `docs/development_testing.md` (standar test + security)
> 4. Dokumen spesifik sesuai modul yang dikerjakan

