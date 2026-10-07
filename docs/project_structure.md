# Struktur Proyek (Project Tree)

Aplikasi VyloServe menggunakan struktur *monorepo* sederhana di mana Backend (Python) dan Frontend (React) berada dalam satu direktori yang sama.

```text
vyloserve/
├── core/                       # Logika Utama Backend Python
│   ├── api.py                  # Router / Facade API yang menjembatani React (PyWebView)
│   ├── utils/                  # Skrip utilitas yang bersifat global (tidak spesifik domain)
│   │   ├── file_utils.py       # Manipulasi JSON, Unduhan file, Ekstraksi arsip (ZIP/TAR)
│   │   └── system_utils.py     # Pengecekan Port, Subprocess silent (OS CMD)
│   └── services/               # Manajer Domain Spesifik (Menerapkan Single Responsibility)
│       ├── apache.py           # Logika Web Server Apache
│       ├── php.py              # Logika instalasi & ekstensi PHP
│       ├── database.py         # Logika MySQL/PostgreSQL
│       ├── runtimes_manager.py # Logika Node.js, Python, Java, Go, dan Windows Registry
│       ├── project.py          # Logika pembuatan Virtual Host, UAC Hosts, dan Composer
│       ├── git_manager.py      # Instalasi PortableGit
│       ├── ssl_manager.py      # Pembuatan Certificate Authority (CA) lokal
│       ├── dashboard.py        # Menyimpan Status Toggle UI Dashboard
│       ├── settings.py         # Menyimpan Preferensi Aplikasi (Bahasa, Tema, filter log, opsi update, notifikasi desktop)
│       ├── updater.py          # Auto-Updater: cek/unduh/pasang rilis baru dari GitHub Releases
│       └── tunnels.py          # Logika tunnel (zrok) — instal binary & expose port lokal ke URL publik
├── frontend/                   # Repositori UI berbasis React (Vite + TS)
│   ├── src/
│   │   ├── components/         # Komponen UI Reusable, struktur FLAT (Modal, Card, PageHeader, dll — TIDAK ada subfolder ui/)
│   │   │                       # Termasuk DUA context provider terpisah: ToastContext (notifikasi sekilas/auto-dismiss,
│   │   │                       # juga menyimpan histori toast session-only utk NotificationBell) dan AlertContext
│   │   │                       # (dialog alert()/confirm() modal, menggantikan window.alert/confirm native).
│   │   │                       # NotificationBell.tsx: ikon lonceng+badge unread di Sidebar, panel histori toast,
│   │   │                       # terintegrasi notifikasi native Windows — lihat docs/known_bugs.md #45/#46
│   │   ├── locales/            # Berkas i18n JSON untuk bahasa (en, id)
│   │   ├── menu/                # Halaman utama aplikasi: apache/ (termasuk CRUD Project & Virtual Host,
│   │   │                        # TIDAK ada folder project/ terpisah), php/, database/, dashboard/, runtimes/,
│   │   │                        # tools/ (git/, qr-generator/, base64-encode-decode/, url-encode-decode/, tunnels/, settings/)
│   │   ├── utils/               # Helper murni lintas-halaman (BUKAN komponen React) — lihat docs/frontend_ui.md §1
│   │   │   ├── a11y.ts          # onEnterOrSpace() — keyboard support (Enter/Space) utk elemen non-native
│   │   │   ├── progress.ts      # clampPercent() — clamp nilai progress vylo_progress ke [0, 100]
│   │   │   └── version.ts       # compareVersions() — bandingkan versi semantik (bukan string !=), dipakai PHP & Database
│   │   ├── hooks/               # Custom React hooks lintas-komponen (BUKAN komponen React, nol JSX)
│   │   │   └── useWindowPresence.ts # Deteksi fokus/minimize/hidden-ke-tray window — lihat docs/frontend_ui.md §5.1
│   │   ├── i18n.ts             # Konfigurasi react-i18next (TIDAK ada folder contexts/)
│   │   └── App.tsx             # Routing MANUAL via useState (BUKAN React Router) — lihat docs/frontend_ui.md §2
│   ├── package.json            # Daftar dependensi Frontend (React, Tailwind, i18next)
│   └── vite.config.ts          # Konfigurasi bundler Vite
├── tests/                      # Folder Unit Test (Pytest)
│   ├── test_utils/             # Pengujian modul utils
│   └── test_services/          # Pengujian layanan utama (Mocks heavily applied)
├── bin/                        # (Ter-Generate) Folder instalasi engine (Apache, PHP, Node) — arsip unduhan (.zip)
│                               # juga diunduh LANGSUNG ke subfolder bin/<service>/ masing-masing, BUKAN ke direktori
│                               # temp terpisah (tidak ada folder tmp/ — tiap service pakai bin_dir/base_dir sendiri)
├── data/                       # (Ter-Generate) Folder konfigurasi aplikasi, SSL, & logs
├── www/                        # (Ter-Generate) Direktori utama penyimpan proyek Web
├── main.py                     # Entrypoint aplikasi (PyWebView & System Tray)
├── requirements.txt            # Dependensi Python
└── AGENTS.md                   # Instruksi dasar untuk AI Assistant (standar agents.md, lintas-vendor)
```

## Penjelasan Direktori *Generate*
Direktori-direktori berikut tidak disimpan di Git (di-ignore), namun akan terbuat secara otomatis saat aplikasi dijalankan dan digunakan oleh pengguna:
*   `bin/`: Seluruh binary executable dari layanan (Apache, PHP, dsb) akan diletakkan di sini. Aplikasi VyloServe bersifat mandiri dan *portable*, tidak bergantung pada instalasi C:/Program Files. Arsip unduhan (`.zip`/`.tar.gz`) juga diunduh LANGSUNG ke subfolder service-nya sendiri di sini (mis. `bin/database/<db_id>.zip`) sebelum diekstrak ke tempat yang sama — tidak ada direktori temp terpisah.
*   `data/`: Menyimpan konfigurasi state dalam bentuk JSON (seperti `apache.json`, `settings.json`, `dashboard.json`), serta kunci SSL (`VyloServeRootCA.key`).
*   `www/`: Direktori *Document Root* global. Di sinilah proyek-proyek seperti Laravel atau CodeIgniter akan diletakkan.
