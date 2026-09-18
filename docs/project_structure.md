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
│       └── settings.py         # Menyimpan Preferensi Aplikasi (Bahasa, Tema)
├── frontend/                   # Repositori UI berbasis React (Vite + TS)
│   ├── src/
│   │   ├── components/         # Komponen UI Reusable, struktur FLAT (Modal, Card, PageHeader, dll — TIDAK ada subfolder ui/)
│   │   ├── locales/            # Berkas i18n JSON untuk bahasa (en, id)
│   │   ├── menu/                # Halaman utama aplikasi: apache/ (termasuk CRUD Project & Virtual Host,
│   │   │                        # TIDAK ada folder project/ terpisah), php/, database/, dashboard/, runtimes/, tools/
│   │   ├── utils/               # Helper murni lintas-halaman (BUKAN komponen React) — lihat docs/frontend_ui.md §1
│   │   │   ├── a11y.ts          # onEnterOrSpace() — keyboard support (Enter/Space) utk elemen non-native
│   │   │   └── progress.ts      # clampPercent() — clamp nilai progress vylo_progress ke [0, 100]
│   │   ├── i18n.ts             # Konfigurasi react-i18next (TIDAK ada folder contexts/)
│   │   └── App.tsx             # Routing MANUAL via useState (BUKAN React Router) — lihat docs/frontend_ui.md §2
│   ├── package.json            # Daftar dependensi Frontend (React, Tailwind, i18next)
│   └── vite.config.ts          # Konfigurasi bundler Vite
├── tests/                      # Folder Unit Test (Pytest)
│   ├── test_utils/             # Pengujian modul utils
│   └── test_services/          # Pengujian layanan utama (Mocks heavily applied)
├── bin/                        # (Ter-Generate) Folder instalasi engine (Apache, PHP, Node)
├── data/                       # (Ter-Generate) Folder konfigurasi aplikasi, SSL, & logs
├── tmp/                        # (Ter-Generate) Direktori sementara untuk unduhan (.zip)
├── www/                        # (Ter-Generate) Direktori utama penyimpan proyek Web
├── main.py                     # Entrypoint aplikasi (PyWebView & System Tray)
├── requirements.txt            # Dependensi Python
└── AGENTS.md                   # Instruksi dasar untuk AI Assistant (standar agents.md, lintas-vendor)
```

## Penjelasan Direktori *Generate*
Direktori-direktori berikut tidak disimpan di Git (di-ignore), namun akan terbuat secara otomatis saat aplikasi dijalankan dan digunakan oleh pengguna:
*   `bin/`: Seluruh binary executable dari layanan (Apache, PHP, dsb) akan diletakkan di sini. Aplikasi VyloServe bersifat mandiri dan *portable*, tidak bergantung pada instalasi C:/Program Files.
*   `data/`: Menyimpan konfigurasi state dalam bentuk JSON (seperti `apache.json`, `settings.json`, `dashboard.json`), serta kunci SSL (`VyloServeRootCA.key`).
*   `tmp/`: Digunakan oleh Backend untuk meletakkan file tarball/zip saat sedang proses pengunduhan, sebelum di ekstrak ke `bin/`.
*   `www/`: Direktori *Document Root* global. Di sinilah proyek-proyek seperti Laravel atau CodeIgniter akan diletakkan.
