# Panduan Pengguna Resmi & Pusat Pengetahuan VyloServe (Comprehensive User Guide & Atomic Knowledge Base)

Selamat datang di Panduan Pengguna Resmi dan Pusat Pengetahuan **VyloServe**. Dokumen ini disusun secara sistematis, atomik, dan mendalam (mencakup setiap tombol, kontrol form, alur kerja di balik layar, parameter konfigurasi, kondisi error, dan logika sistem) untuk dua tujuan utama:
1. **Bagi Pengguna Akhir (*End-User*)**: Sebagai buku manual operasional lengkap yang tidak membingungkan dan menjawab setiap pertanyaan penggunaan aplikasi.
2. **Bagi VyloServe AI Assistant (Developer Copilot / RAG)**: Sebagai basis data pengetahuan semantik (*ground-truth knowledge base*) berpresisi tinggi untuk memberikan rekomendasi navigasi, perbaikan error, dan konfigurasi tanpa halusinasi.

---

## Daftar Isi (Table of Contents)
1. [Pengenalan & Arsitektur Inti (Core Architecture)](#1-pengenalan--arsitektur-inti-core-architecture)
2. [Navigasi & Elemen Tata Letak Antarmuka (UI Layout & Controls)](#2-navigasi--elemen-tata-letak-antarmuka-ui-layout--controls)
3. [Panduan Operasional & Tutorial Lengkap Modul Server (Atomic Guides)](#3-panduan-operasional--tutorial-lengkap-modul-server-atomic-guides)
   - [3.1 Web Server (Apache Lounge x64)](#31-web-server-apache-lounge-x64)
   - [3.2 Bahasa Pemrograman (PHP FastCGI Engine)](#32-bahasa-pemrograman-php-fastcgi-engine)
   - [3.3 Layanan Database (MariaDB & PostgreSQL)](#33-layanan-database-mariadb--postgresql)
   - [3.4 Manajer Runtimes (Node.js, Python, Java, Go)](#34-manajer-runtimes-nodejs-python-java-go)
   - [3.5 Manajer Proyek & Virtual Host Otomatis (Project Manager)](#35-manajer-proyek--virtual-host-otomatis-project-manager)
   - [3.6 Git Manager & Otoritas Sertifikat SSL Lokal (Git & Root CA)](#36-git-manager--otoritas-sertifikat-ssl-lokal-git--root-ca)
   - [3.7 Tunnel Publik Instan (Cloudflare & Zrok)](#37-tunnel-publik-instan-cloudflare--zrok)
   - [3.8 Utilitas Pengembang (Developer Tools)](#38-utilitas-pengembang-developer-tools)
   - [3.9 AI Assistant Copilot & In-App RAG Retriever](#39-ai-assistant-copilot--in-app-rag-retriever)
   - [3.10 Pengaturan Sistem & Kustomisasi (Settings & Preferences)](#310-pengaturan-sistem--kustomisasi-settings--preferences)
4. [Kamus Kode Error & Log Sistem Lengkap (Exhaustive Error Dictionary)](#4-kamus-kode-error--log-sistem-lengkap-exhaustive-error-dictionary)
5. [Panduan Pemecahan Masalah Langkah-demi-Langkah (Step-by-Step Troubleshooting)](#5-panduan-pemecahan-masalah-langkah-demi-langkah-step-by-step-troubleshooting)
6. [Tanya Jawab Umum Komprehensif (FAQ)](#6-tanya-jawab-umum-komprehensif-faq)
7. [Glosarium Istilah Teknis (Glossary)](#7-glosarium-istilah-teknis-glossary)

---

<!-- section: getting-started, module: general, tags: [persyaratan, arsitektur, webview2, vcredist, single-instance, tray, ipc, named-pipe, mutex, portable, migrasi, filosofi] -->
## 1. Pengenalan & Arsitektur Inti (Core Architecture)

### 1.1 Apa itu VyloServe?
**VyloServe** adalah perangkat lunak desktop modern untuk sistem operasi Microsoft Windows yang dirancang khusus untuk mengelola lingkungan pengembangan server lokal (*local development environment*). VyloServe dibangun dari nol untuk mengatasi kelemahan perangkat lunak tradisional (seperti XAMPP, WAMP, atau Laragon) dengan menghadirkan pengalaman pengguna modern, cepat, dan terisolasi.

**Keunggulan Utama VyloServe**:
- **100% Portabel & Mandiri**: Seluruh biner server (Apache, PHP, MariaDB, PostgreSQL, Node.js, Python, Java, Go, Git) terisolasi di dalam direktori `bin/` tanpa memasang Windows Services yang berjalan diam-diam saat komputer menyala, dan tanpa mengotori Windows Registry secara permanen.
- **Arsitektur Hibrida Modern**: Backend berbasis **Python 3** yang bertugas mengeksekusi perintah tingkat sistem operasi dengan aman (sanitasi argumen shlex, proteksi path traversal, non-blocking asynchronous execution) dipadukan dengan frontend berbasis **React 18 + TypeScript + Vite + Tailwind CSS** di dalam wrapper desktop WebView2.
- **Multi-Versi Dinamis Simultan**: Mampu mengunduh, mengonfigurasi, dan menjalankan beberapa versi PHP dan mesin Database secara bersamaan dengan port FastCGI/TCP independen.
- **AI Server Copilot Terpadu**: Dilengkapi asisten AI cerdas berbasis *In-App Retrieval-Augmented Generation (RAG)* yang membaca dokumentasi ini secara semantik untuk memecahkan error, merekomendasikan konfigurasi, dan mengontrol layanan server secara aman lewat konfirmasi persetujuan pengguna (*Human-in-the-Loop*).

### 1.2 Tabel Perbandingan: VyloServe vs XAMPP vs Laragon

| Fitur / Parameter | VyloServe | XAMPP | Laragon |
|---|---|---|---|
| **Teknologi UI** | Modern Desktop (React 18 + Tailwind CSS + DWM Sync) | Antarmuka Klasik C++ WinForms | GUI Tradisional Delphi/Pascal |
| **Portabilitas Biner** | 100% Portabel (folder `bin/`, tanpa service Windows) | Menginstal Windows Services permanen | Portabel parsial di folder `bin/` |
| **Multi-PHP Simultan** | ✅ Ya (port FastCGI berbeda per instance) | ❌ Tidak (hanya 1 versi per instalasi) | ⚠️ Terbatas (harus switch bergantian) |
| **Dukungan PostgreSQL** | ✅ Ya (Dual Engine: MariaDB & PostgreSQL) | ❌ Tidak (hanya MySQL/MariaDB) | ✅ Ya (manual via menu) |
| **Public Tunnels** | ✅ Terpadu (Cloudflare Quick Tunnel & Zrok Share) | ❌ Perlu tool luar (ngrok terpisah) | ⚠️ Tersedia ngrok bawaan |
| **AI Assistant / Copilot** | ✅ Ya (Streaming LLM, RAG Dokumen, HITL Action) | ❌ Tidak ada | ❌ Tidak ada |
| **Local HTTPS SSL CA** | ✅ Otomatis (Root CA terdaftar ke Windows Store) | ⚠️ Manual via script OpenSSL | ✅ Otomatis via mkcert |
| **Manajemen Runtimes** | ✅ Lengkap (Node.js, Python, Java, Go + Corepack) | ❌ Terbatas | ⚠️ Terbatas pada Node/Python |
| **Tema & Tampilan** | ✅ 10 Tema + Sinkronisasi DWM Titlebar Native | ❌ Tampilan kaku abu-abu | ❌ Tampilan tetap standar |

### 1.3 Persyaratan Sistem Operasi (System Prerequisites)
Sebelum menjalankan atau menginstal modul di VyloServe, pastikan sistem komputer memenuhi spesifikasi berikut:
1. **Sistem Operasi Windows**: Windows 10 (versi 1809 atau lebih baru) atau Windows 11, arsitektur **64-bit (x64)**.
2. **Microsoft Edge WebView2 Runtime**: Komponen resmi Microsoft untuk merender aplikasi desktop berbasis web modern. Sudah terpasang secara bawaan di Windows 11 dan update terbaru Windows 10. Jika belum ada, VyloServe akan memberikan prompt tautan unduhan resmi dari Microsoft.
3. **Microsoft Visual C++ Redistributable (2015–2022 x64)**: Paket pustaka runtime C++ yang mutlak diperlukan oleh biner ApacheLounge, PHP Windows, dan MariaDB. Pastikan versi 64-bit (`vc_redist.x64.exe`) terpasang agar biner tidak gagal dijalankan dengan pesan error missing `.dll`.
4. **Port Jaringan Fisik Bebas**:
   - Port `80` (HTTP default) & `443` (HTTPS default).
   - Port `3306` (MariaDB default) & `5432` (PostgreSQL default).
   - Port `9000`, `9001`, dst. (PHP FastCGI default).

### 1.4 Mode Single-Instance, Named Pipe IPC, & System Tray
- **Isolasi Mutex Single-Instance**: VyloServe menggunakan Windows Mutex (`VyloServe_App_Mutex_v1` untuk mode produksi dan `VyloServe_Dev_App_Mutex_v1` untuk mode dev). Jika pengguna mencoba membuka VyloServe saat aplikasi sudah berjalan di latar belakang:
  - Instance kedua tidak akan membuat jendela duplikat.
  - Instance kedua mengirimkan sinyal IPC melalui **Windows Named Pipe** (`\\.\pipe\VyloServe_IPC_v1`) ke instance utama.
  - Instance utama secara otomatis menampilkan kembali jendelanya (*restore & bring to front*) secara aman tanpa risiko crash.
- **Perilaku Tombol Tutup (X) & System Tray (`ENABLE_TRAY`)**:
  - Menekan tombol (X) di titlebar jendela **TIDAK** mematikan server lokal Anda, melainkan meminimalisir aplikasi ke **System Tray** (area notifikasi di sebelah jam Windows).
  - Server Apache, PHP, dan Database tetap berjalan di latar belakang sehingga website proyek Anda tetap aktif dan dapat diakses.
- **Cara Keluar Total (*Quit Application*)**:
  - Klik kanan ikon VyloServe di System Tray, lalu klik **Quit**, ATAU
  - Buka menu **Settings** -> tab **General** -> scroll ke bagian **Danger Zone** -> klik tombol merah **Exit Application**.
  - Saat keluar total, VyloServe memanggil rutinitas shutdown untuk mematikan semua proses anak (`httpd.exe`, `php-cgi.exe`, `mysqld.exe`, `postgres.exe`) agar tidak ada proses gantung (*zombie process*).

---

<!-- section: ui-navigation, module: general, tags: [ui, sidebar, header, dark-mode, theme, floating-widget, fab, log-viewer, toast, dwm, titlebar] -->
## 2. Navigasi & Elemen Tata Letak Antarmuka (UI Layout & Controls)

Antarmuka pengguna VyloServe dibagi menjadi 4 komponen tata letak utama yang responsif:

```text
+-----------------------------------------------------------------------------------+
|  [Logo VyloServe]   Header: Status Ringkas, Quick Actions, Jam Sistem             |
+-------------------+---------------------------------------------------------------+
| SIDEBAR NAVIGASI  | AREA KERJA UTAMA (PAGE CONTENT)                               |
|                   |                                                               |
| [Quick Search...] | [PageHeader: Judul Modul, Versi Aktif, Tombol Aksi Utama]     |
|                   |                                                               |
| -- SERVICES --    | [Kartu Kontrol Status & Statistik Port]                       |
| * Dashboard       | [Tabel / Grid Data / Daftar Instance Server]                  |
| * Apache Server   | [Formulir / Wizard Konfigurasi]                               |
| * PHP FastCGI     |                                                               |
| * Database        |                                                               |
| * Runtimes        |                                                               |
|                   +---------------------------------------------------------------+
| -- TOOLS --       | TERMINAL & SYSTEM LOG VIEWER (Collapsible)                    |
| * Git Manager     | [Filter: All | Info | Warning | Error] [Clear Logs]           |
| * Tunnels         | > 11:45:02 [INFO] Apache daemon started on port 80 (PID 4120) |
| * Markdown Viewer | > 11:45:03 [SUCCESS] PHP FastCGI listening at 127.0.0.1:9000  |
| * AI Assistant    +---------------------------------------------------------------+
|                   |                                       [ (🤖) FAB AI Melayang] |
| -- FOOTER --      +---------------------------------------------------------------+
| [Settings] [Toast History] [CPU Load %]                                           |
+-----------------------------------------------------------------------------------+
```

### 2.1 Sidebar Navigasi (Sisi Kiri)
- **Tombol Collapse / Expand**: Ikon panah di pojok atas sidebar untuk mengecilkan sidebar menjadi mode ikon mini (*compact*) atau memperlebarnya kembali.
- **Pencarian Cepat Menu (*Quick Search Filter*)**: Kolom input pencarian instan. Mengetik nama modul atau kata kunci (misal: "php", "sql", "ssl", "tunnel", "git") akan menyaring daftar menu secara *real-time*.
- **Kelompok Services**:
  - `Dashboard`: Tampilan terpadu seluruh server, sakelar *Master Switch* (Start All / Stop All), daftar project, dan monitoring port.
  - `Apache Server`: Kontrol web server Apache, virtual host, dan rilis biner.
  - `PHP FastCGI`: Daftar versi PHP terpasang, switcher versi global, alokasi port, dan editor ekstensi `php.ini`.
  - `Database`: Manajer multi-instance MariaDB dan PostgreSQL, port, dan reset kata sandi root.
  - `Runtimes`: Manajer lingkungan eksekusi bahasa (Node.js, Python, Java, Go) dan deteksi instalasi eksternal.
- **Kelompok Tools**:
  - `Git Manager`: Version control, konfigurasi identitas global, inisialisasi repo, kloning remote, dan Root SSL CA.
  - `Tunnels`: Publikasi localhost via Cloudflare Tunnel atau Zrok Share.
  - `Markdown Viewer`: Pembaca dokumentasi offline dengan navigasi folder tree rekursif dan penampil gambar base64.
  - `AI Assistant`: Halaman percakapan penuh dengan Copilot developer, selector model, dan kartu aksi server.
- **Footer Sidebar**:
  - Ikon Gir (**Settings**): Membuka modal pengaturan preferensi aplikasi (General, Theming, AI, Updates, Logs).
  - Ikon Lonceng (**NotificationBell**): Menampilkan riwayat notifikasi toast yang pernah muncul selama sesi aplikasi aktif dengan badge angka belum dibaca.
  - **CPU Load Indicator**: Bar grafis pemakaian prosesor komputer secara *real-time*.

### 2.2 Terminal Log Viewer Terpadu (Sisi Bawah)
- **Real-Time Log Stream**: Backend Python menembakkan event `vylo_log` secara live ke panel ini.
- **Filter Severity Level**:
  - `All`: Menampilkan seluruh baris log.
  - `Info` (Biru): Informasi alur proses normal.
  - `Success` (Hijau): Operasi berhasil dilakukan.
  - `Warning` (Kuning): Peringatan non-fatal atau port busy.
  - `Error` (Merah): Kegagalan operasi atau crash biner.
- **Kategori Log (Source Filter)**:
  - `System Logs`: Log internal VyloServe (ekstraksi, konfigurasi, IPC, UAC).
  - `ApacheFileLog`: Baris baru yang otomatis dibaca (*live-tail*) dari `logs/error_log` dan `logs/access_log`.
  - `DatabaseFileLog`: Baris baru dari log startup mesin database (`db_startup.log` atau `.err`).

### 2.3 Widget AI Melayang (Floating Action Button / FAB)
- Terletak di pojok kanan bawah jendela aplikasi dan dapat diakses dari halaman modul mana pun.
- **Draggable**: Dapat diklik dan digeser bebas ke posisi mana pun di tepi layar. Posisi tersimpan otomatis di `localStorage`.
- **Context-Aware**: Mengklik FAB membuka modal percakapan mini yang otomatis menyertakan konteks modul layar yang sedang aktif (misalnya layar `database` atau `apache`) dan log error terbaru ke dalam pertanyaan pengguna.

---

<!-- section: apache, module: apache, tags: [apache, httpd, web-server, port-80, virtualhost, ssl, error-log, access-log, in-place-update, tutorial-apache, instal-apache, start-apache, httpd-conf, smart-routing, public-dir] -->
## 3. Panduan Operasional & Tutorial Lengkap Modul Server (Atomic Guides)

### 3.1 Web Server (Apache Lounge x64)

#### A. Tutorial Memulai Apache dari Nol (Instalasi Pertama Kali)
Jika Apache belum terpasang di komputer Anda, kartu Apache akan menampilkan wizard instalasi (`InstallWizard`):
1. Masuk ke menu **Apache** dari sidebar.
2. Periksa kartu **Detected System**: Sistem akan menampilkan status deteksi OS (misalnya *Windows Win64 - Compatible*).
3. **Pilih Versi Apache**:
   - Klik dropdown **Target Apache Version**.
   - Sistem secara otomatis mengambil rilis stabil terbaru dari ApacheLounge (misal `2.4.68 Win64 - Latest Stable`).
4. **Tentukan Port Listening Awal**:
   - Kolom **HTTP Port**: Default `80`. Jika port 80 Anda sudah terpakai oleh IIS/Skype, ganti ke `8080` atau `8888`.
   - Kolom **HTTPS Port**: Default `443`.
5. Klik tombol biru **Install Apache**:
   - VyloServe mengunduh paket ZIP dari server ApacheLounge (`download_advanced`).
   - Ekstrak biner ke direktori `bin/apache/<version>/`.
   - Menjalankan rutinitas internal `_configure_httpd()`:
     - Mengatur path `Define SRVROOT "..."`.
     - Mengatur port `Listen <port>`.
     - Mengaktifkan modul otomatis: `mod_proxy.so`, `mod_proxy_fcgi.so`, `mod_rewrite.so`, `mod_vhost_alias.so`, `mod_ssl.so`, `mod_socache_shmcb.so`.
     - Menyertakan file konfigurasi dinamis: `IncludeOptional conf/extra/httpd-vyloserve-php.conf` dan `IncludeOptional conf/extra/vyloserve-vhosts.conf`.
     - Mengatur DocumentRoot default ke direktori `www/`.
     - Membuat file template awal `www/index.php` dan `www/phpinfo.php`.
   - Menandai versi tersebut sebagai aktif di `data/apache.json`.
   - Status berubah menjadi **Stopped (Installed)** dan tombol **Start Server** kini aktif.

#### B. Menjalankan, Mematikan, & Me-restart Apache
- **Menyalakan Server (Start)**:
  - Klik tombol hijau **Start Server**.
  - Backend memverifikasi bahwa port tidak bentrok, lalu mengeksekusi biner `bin/apache/<version>/bin/httpd.exe` sebagai silent background process.
  - Lencana status berubah menjadi hijau **Running** disertai nomor PID proses Windows.
- **Membuka Halaman Web Utama (Open Web)**:
  - Klik tombol **Open Web** (ikon bola dunia). Browser default Windows Anda akan terbuka mengarah ke `http://localhost:<http_port>`. Anda akan melihat halaman penyambutan VyloServe (*"VyloServe is Running!"*).
- **Mematikan Server (Stop)**:
  - Klik tombol merah **Stop Server**. Backend mengeksekusi perintah Windows `taskkill /F /T /IM httpd.exe`. Lencana status berubah menjadi **Stopped**.
- **Me-restart Server (Restart)**:
  - Klik tombol panah melingkar **Restart**. Server dimatikan, diberi jeda 1 detik untuk pelepasan port TCP oleh OS, lalu dinyalakan kembali.

#### C. Smart Routing Otomatis ke Direktori `/public`
VyloServe menerapkan fitur *Smart Routing* cerdas:
- Jika di dalam folder `www/` terdapat subfolder bernama `public` (misalnya Anda meletakkan struktur project Laravel langsung di root web), Apache tidak akan menyajikan root folder yang mengekspos file `.env`.
- VyloServe secara otomatis mengarahkan `DocumentRoot` ke subfolder `www/public` dan mencatat log `backend.apache.smart_routing_active`.

#### D. In-Place Update Versi Apache
- Ketika rilis Apache baru terdeteksi di internet, tombol aksi di kartu Apache akan memunculkan menu **Update to {versi_baru}**.
- Mengklik opsi tersebut akan mengunduh versi baru, mengekstraknya, **menyalin seluruh konfigurasi `conf/` dari versi lama ke versi baru secara otomatis**, mengarahkan versi aktif ke versi baru, dan menghapus folder versi lama tanpa menghilangkan file website Anda.

---

<!-- section: php, module: php, tags: [php, fastcgi, php-switcher, extensions, php-ini, memory-limit, upload-max-filesize, composer, tutorial-php, instal-php, xdebug, multi-version] -->
### 3.2 Bahasa Pemrograman (PHP FastCGI Engine)

#### A. Tutorial Menambah Versi PHP Baru (New PHP Instance)
1. Buka menu **PHP FastCGI** dari sidebar.
2. Klik tombol **New Instance / Install PHP** di pojok kanan atas.
3. Form modal pembuatan instance akan terbuka:
   - **Target Version**: Pilih versi rilis resmi yang tersedia (misal `PHP 8.3.16`, `PHP 8.4.2`, atau `PHP 7.4.33`). VyloServe mengambil daftar ini langsung dari peladen resmi `windows.php.net`.
   - **FastCGI Port**: Port TCP lokal tempat `php-cgi.exe` akan menerima koneksi.
     - Versi pertama otomatis disarankan pada port `9000`.
     - Versi kedua disarankan pada port `9001`, versi ketiga `9002`, dst.
4. Klik tombol **Install Version**:
   - Backend mengunduh arsip ZIP Thread-Safe x64 dari `windows.php.net/downloads/releases/` (atau dari folder `/archives/` jika versi lama).
   - Arsip diekstrak ke dalam folder `bin/php/<version>/`.
   - File konfigurasi `php.ini` dibuat otomatis dengan parameter esensial:
     - `; vyloserve_port = <port>` (disimpan di header konfigurasi).
     - `memory_limit = 512M`
     - `fastcgi.logging = 0`
     - `cgi.force_redirect = 0`
     - `cgi.fix_pathinfo = 1`
     - `extension_dir = "ext"`
     - Ekstensi default aktif: `extension=curl` dan `extension=mbstring`.
   - **Instalasi Otomatis Composer**: Sistem mengunduh `composer.phar` terbaru dari `getcomposer.org`, meletakkannya di folder PHP tersebut, dan membuatkan skrip eksekusi Windows `composer.bat` (`@ECHO OFF php "%~dp0composer.phar" %*`).
   - Kartu versi PHP baru akan muncul pada daftar instance.

#### B. Menjalankan & Mengaitkan PHP ke Apache
- **Start PHP FastCGI**:
  - Klik tombol **Start** pada kartu versi PHP yang ingin dijalankan.
  - Backend mengeksekusi:
    ```cmd
    php-cgi.exe -b 127.0.0.1:<port> -c php.ini
    ```
    dengan environment variable `PHP_FCGI_MAX_REQUESTS=0` (mencegah proses FastCGI mati otomatis setelah melayani sejumlah request tertentu).
  - **Sinkronisasi Otomatis Apache**: VyloServe secara otomatis memperbarui file `bin/apache/<version>/conf/extra/httpd-vyloserve-php.conf` untuk mengarahkan proxy global localhost ke port FastCGI yang baru saja dinyalakan:
    ```apache
    <FilesMatch "\.php$">
        SetHandler "proxy:fcgi://127.0.0.1:<port>/"
    </FilesMatch>
    ```
- **Pemberian Global Windows PATH (`toggle_global_path`)**:
  - Saat versi PHP dijalankan, folder instalasinya otomatis dimasukkan ke dalam `HKCU\Environment\Path` Windows.
  - Sinyal Windows `WM_SETTINGCHANGE` dibroadcast ke seluruh sistem operasi.
  - Hasil: Jika Anda membuka Command Prompt (CMD) atau PowerShell di komputer Anda dan mengetik `php -v` atau `composer -v`, sistem akan langsung mengenali perintah tersebut dan mengarah ke versi PHP aktif VyloServe!

#### C. Mengelola Ekstensi & Konfigurasi Direktif `php.ini`
1. Klik tombol **Settings** (ikon gir) pada kartu versi PHP yang bersangkutan.
2. Modal **PHP Configuration Manager** terbuka:
   - **Tab Directives**:
     - `Port`: Mengubah FastCGI listening port.
     - `Memory Limit`: Mengubah batas RAM skrip (misal: `256M`, `512M`, `1024M`, atau `-1`).
     - `Max Execution Time`: Batas waktu timeout eksekusi (detik, misal: `120` atau `300`).
     - `Upload Max Filesize` & `Post Max Size`: Batas maksimum upload file (misal: `64M` atau `128M`).
   - **Tab Extensions**:
     - Daftar seluruh file `php_*.dll` yang tersedia di dalam subfolder `ext/`.
     - Berikan centang untuk mengaktifkan, hilangkan centang untuk mematikan. Ekstensi populer meliputi: `pdo_mysql`, `pdo_pgsql`, `openssl`, `curl`, `mbstring`, `fileinfo`, `gd`, `intl`, `zip`, `soap`, `sqlite3`, `sodium`, `exif`.
3. Klik tombol **Save Configuration**:
   - File `php.ini` diperbarui.
   - Jika PHP sedang berjalan, server Apache dan proses FastCGI otomatis di-reload agar konfigurasi baru langsung berlaku tanpa perlu restart manual.

---

<!-- section: database, module: database, tags: [database, mysql, mariadb, postgresql, port-3306, port-5432, root-password, adminer, phpmyadmin, backup, tutorial-database, datadir, mysql-install-db, initdb] -->
### 3.3 Layanan Database (MariaDB & PostgreSQL)

#### A. Tutorial Menambah Instance Database Baru (MariaDB atau PostgreSQL)
1. Buka menu **Database** dari sidebar.
2. Klik tombol **New Instance** di pojok kanan atas.
3. Form modal penambahan instance akan muncul:
   - **Engine**: Pilih antara `MariaDB` (MySQL compatible) atau `PostgreSQL`.
   - **Version**: Pilih nomor versi rilis yang tersedia (misal: MariaDB `11.4.4`, `10.11.10` atau PostgreSQL `16.4`, `15.8`). Daftar diambil dari arsip resmi `archive.mariadb.org` atau EnterpriseDB binaries.
   - **Listening Port**:
     - MariaDB default: `3306` (atau `3307`, `3308` jika Anda memiliki MySQL lain).
     - PostgreSQL default: `5432` (atau `5433`).
   - **Root / Superuser Password**: Tentukan kata sandi awal user administratif (`root` pada MariaDB atau `postgres` pada PostgreSQL). Default: `root` jika dikosongkan.
4. Klik tombol **Install Database**:
   - Arsip biner diunduh ke `bin/database/<db_id>.zip` dan diekstrak ke folder `bin/database/<db_id>/`.
   - **Inisialisasi Cluster Data Mandiri (`dataDir`)**:
     - Direktori penyimpanan data dibuat di `data/<db_id>/`.
     - Jika MariaDB: Backend menjalankan perintah inisialisasi:
       ```cmd
       mysql_install_db.exe --datadir=data/<db_id>
       ```
     - Jika PostgreSQL: Backend menulis password sementara dan mengeksekusi:
       ```cmd
       initdb.exe -D data/<db_id> -U postgres --pwfile=pw.txt --encoding=UTF8
       ```
   - Metadata instance dicatat ke dalam `data/databases.json`.
   - Selesai! Instance database baru siap dijalankan.

#### B. Menjalankan & Memantau Database
- **Menyalakan (Start)**:
  - Klik tombol hijau **Start** pada kartu database.
  - MariaDB dijalankan dengan perintah: `mysqld.exe --datadir=... --port=...`.
  - PostgreSQL dijalankan dengan perintah: `postgres.exe -D ... -p ...`.
  - Output proses dicatat ke dalam file `data/<db_id>/db_startup.log`.
  - Sistem melakukan polling selama 15 detik sampai port database terkonfirmasi `LISTENING` di OS.
  - Lencana status berubah menjadi hijau **Running**.
- **Mematikan (Stop)**:
  - Klik tombol merah **Stop**. Sistem mengirim sinyal graceful shutdown (`mysqladmin.exe -u root shutdown` atau `pg_ctl.exe stop`) lalu mematikan proses background.

#### C. Mengubah Kata Sandi Administratif (Change Root Password)
1. Pastikan instance database dalam status **Running**.
2. Klik tombol opsi (menu titik tiga / burger) pada kartu database, lalu klik **Change Password**.
3. Masukkan **Old Password** (kata sandi lama) dan **New Password** (kata sandi baru).
4. Klik **Update Password**:
   - Jika MariaDB: Dieksekusi query SQL `ALTER USER 'username'@'localhost' IDENTIFIED BY 'new_password'; FLUSH PRIVILEGES;`.
   - Jika PostgreSQL: Dieksekusi perintah psql `ALTER ROLE "username" WITH PASSWORD 'new_password';`.
   - Pesan toast sukses akan mengonfirmasi pembaruan kredensial.

#### D. Update Engine Database dengan Auto-Backup Data
- Jika tersedia versi patch/minor terbaru, muncul opsi **Update to {versi}** di menu kartu database.
- Terdapat 2 tahap konfirmasi berurutan:
  1. Konfirmasi persetujuan update ke versi target.
  2. Pilihan opsional mencadangkan (*backup*) direktori data `data/<db_id>/` sebelum proses pembaruan.
- Jika terjadi error saat ekstraksi biner baru, sistem otomatis melakukan *rollback* ke versi biner lama sehingga data Anda tetap utuh.

---

<!-- section: runtimes, module: runtimes, tags: [runtimes, nodejs, python, java, go, npm, pip, yarn, pnpm, corepack, external-detection, path, tutorial-runtimes, venv, adoptium, external-scan] -->
### 3.4 Manajer Runtimes (Node.js, Python, Java, Go)

Modul Runtimes memungkinkan pengembang mengisolasi toolchain pemrograman tanpa perlu installer global yang merusak sistem.

#### A. Runtimes yang Didukung & Fitur Spesifik
1. **Node.js**:
   - Pilihan rilis LTS (Long Term Support) atau Current dari repositori resmi `nodejs.org`.
   - **Opsi Corepack**: Pilihan checkbox untuk langsung mengaktifkan `corepack enable` (mendukung `pnpm` dan `yarn` tanpa instalasi npm global tambahan).
2. **Python**:
   - Rilis embeddable mandiri Windows dari `python.org`.
   - **Injeksi Pip & Site-Packages**: Secara bawaan, rilis embeddable Python mematikan impor paket eksternal. VyloServe secara otomatis:
     - Mengedit file `python*._pth` untuk mengaktifkan baris `import site` dan `Lib\site-packages`.
     - Mengunduh skrip `get-pip.py`.
     - Menginstal `pip` menggunakan sertifikat CA terpercaya dari pustaka `certifi`.
     - Menyediakan pip yang siap digunakan untuk `pip install virtualenv` atau instalasi pustaka lainnya.
3. **Java (OpenJDK)**:
   - Rilis JDK resmi Eclipse Temurin dari Adoptium API (`api.adoptium.net`).
   - Menyediakan `javac` dan `java.exe` lengkap untuk pengembangan backend berbasis Spring Boot atau Android SDK.
   - Mengatur environment variable `JAVA_HOME` ke direktori instalasi saat diaktifkan.
4. **Go (Golang)**:
   - Rilis binary resmi Windows AMD64 dari `go.dev/dl/`.
   - Menyediakan toolchain `go build`, `go run`, dan `go mod`.

#### B. Fitur Deteksi Instalasi Eksternal (External Detection Layer)
VyloServe melakukan pemindaian 3 lapis saat halaman Runtimes dibuka:
1. Memeriksa perintah `where <engine>`.
2. Memeriksa kunci registry Windows (`HKLM` dan `HKCU\Environment\Path`).
3. Memeriksa variabel lingkungan sistem.

Jika runtime tersebut sudah terinstal di komputer pengguna di luar VyloServe:
- Lencana peringatan **External Installation Detected** akan muncul beserta path lokasinya (misal: `C:\Program Files\nodejs\node.exe`).
- Tombol **Register to PATH** akan dinonaktifkan demi mencegah rusaknya konfigurasi toolchain bawaan Windows Anda. Anda tetap dapat menggunakan versi portabel VyloServe di dalam workspace proyek.

---

<!-- section: project, module: project, tags: [project-manager, vhost, virtual-host, local-domain, hosts-file, uac, ssl-cert, laravel, codeigniter, wordpress, tutorial-project, new-project, fresh-install, link-existing, raw-php, ssl-local] -->
### 3.5 Manajer Proyek & Virtual Host Otomatis (Project Manager)

Modul Project Manager (terletak di halaman Apache) adalah jantung pengembangan web di VyloServe yang mengotomatiskan scaffolding framework, konfigurasi Virtual Host, registrasi domain lokal di Windows hosts, dan pembuatan sertifikat SSL.

#### A. Tutorial Membuat Proyek Baru (Mode: Fresh Install)
Gunakan mode ini jika Anda ingin memulai website atau aplikasi baru dari awal menggunakan framework:

```text
[ Form New Project: Fresh Install ]
1. Setup Mode        : (•) 🚀 Fresh Install    ( ) 🔗 Link Existing
2. Project Name      : [ toko-online           ] -> Domain otomatis: toko-online
3. PHP Version       : [ PHP 8.3.16 (Port 9000) \/]
4. Framework         : [ Laravel                \/] (Laravel / CodeIgniter / WordPress / Raw)
5. Workspace Location: [ D:\Projects\Web        ] [Browse...]
6. Advanced Settings : [v] (Klik untuk membuka opsi domain kustom & versi framework)
   - Domain Ext      : [.test   ] (Pilihan: .test, .local, .internal, dll)
   - Specific Version: [ 11.*   ] (Opsional: tag versi framework spesifik)
```

**Langkah-langkah Eksekusi**:
1. Klik tombol **New Project** di halaman Apache.
2. Pastikan tombol segmen atas berada di posisi **🚀 Fresh Install**.
3. Masukkan **Project Name** (misal: `toko-online`). Kolom domain akan otomatis terisi format slug `toko-online`.
4. Pilih **PHP Version** yang kompatibel dengan framework pilihan Anda.
5. Pilih **Framework to Install**:
   - `Laravel`: Menjalankan Composer create-project.
   - `CodeIgniter`: Menyiapkan struktur CodeIgniter 4 (atau CI3 jika menggunakan PHP 7.x).
   - `WordPress`: Mengunduh rilis resmi WordPress terbaru.
   - `Raw`: Membuat proyek PHP dasar berisi file `index.php`.
6. Tentukan **Workspace Location** (folder induk tempat project akan diletakkan). Folder akhir proyek Anda akan menjadi `D:\Projects\Web\toko-online`. Lokasi ini otomatis tersimpan untuk proyek-proyek berikutnya.
7. *(Opsional)* Buka **Advanced Settings** untuk mengganti ekstensi domain (misal menjadi `.test` atau `.local`) atau menentukan versi spesifik framework.
8. Klik tombol **Create Project**:
   - Progress bar akan muncul menampilkan tahapan:
     - 10%: Menyiapkan konfigurasi.
     - 20%: Menyiapkan environment PHP & Composer.
     - 40%–60%: Mengunduh paket framework via Composer atau ZIP WordPress.
     - 60%–95%: Menjalankan instalasi dependensi vendor.
     - 100%: Menjalankan post-install hook:
       - Pada Laravel: otomatis menyalin `.env.example` menjadi `.env` dan mengeksekusi `php artisan key:generate`.
       - Pada CodeIgniter: otomatis menyalin `env` menjadi `.env` dan menyetel `CI_ENVIRONMENT = development`.
   - **Pembuatan Virtual Host Otomatis**: Backend membuat file konfigurasi Apache di `bin/apache/<version>/conf/extra/vyloserve-vhosts.conf`.
   - **Penerbitan Sertifikat SSL**: Backend menandatangani sertifikat SSL untuk domain `toko-online.test` menggunakan Root CA VyloServe.
   - **Injeksi Windows Hosts & UAC Elevation**:
     - Sistem menuliskan baris `127.0.0.1 toko-online.test` ke `C:\Windows\System32\drivers\etc\hosts`.
     - Dialog keamanan Windows UAC (*User Account Control*) akan muncul sekali di layar. Klik **Yes / Ya**.
   - Apache me-restart konfigurasinya secara otomatis.
   - Kartu proyek baru Anda muncul di daftar dengan tombol **Open Web** dan badge status domain **Synced (Hijau)**!

#### B. Tutorial Menghubungkan Proyek yang Sudah Ada (Mode: Link Existing)
Gunakan mode ini jika Anda sudah memiliki folder proyek website di komputer Anda (misal hasil clone dari Git atau proyek dari folder lama):
1. Klik tombol **New Project** di halaman Apache.
2. Alihkan tombol segmen atas ke posisi **🔗 Link Existing**.
3. Masukkan **Project Name** dan tentukan **PHP Version** yang digunakan proyek tersebut.
4. Pada kolom **Project Directory**, klik tombol **Browse** dan pilih folder proyek Anda di komputer.
5. **Auto-Detection Engine**:
   - VyloServe memindai struktur file folder tersebut secara otomatis:
     - Jika terdeteksi file `artisan` dan `composer.json` berisi `laravel/framework` -> terdeteksi sebagai **Laravel**, dan DocumentRoot secara otomatis diarahkan ke subfolder `public/`.
     - Jika terdeteksi file `spark` dan `public` -> terdeteksi sebagai **CodeIgniter**, DocumentRoot diarahkan ke `public/`.
     - Jika terdeteksi file `wp-config-sample.php` atau folder `wp-admin` -> terdeteksi sebagai **WordPress**, DocumentRoot disetel di root folder.
6. Klik **Create Project**. Sistem langsung membuatkan Virtual Host, sertifikat SSL, dan menyinkronkan domain ke file hosts tanpa perlu instalasi ulang!

#### C. Pengaturan & Penghapusan Proyek (Project Settings & Deletion)
- **Tombol Aksi pada Kartu Proyek**:
  - `Open Web` (Ikon Browser): Membuka browser langsung ke domain `http://namaproyek.test` atau `https://namaproyek.test`.
  - `Open Folder` (Ikon Folder): Membuka Windows File Explorer langsung ke direktori proyek.
  - `Settings` (Ikon Gir): Membuka modal pengaturan proyek untuk mengganti nama atau mengganti versi PHP proyek tersebut secara dinamis.
  - `Retry Sync Hosts` (Muncul jika UAC ditolak sebelumnya): Mencoba kembali menyuntikkan domain ke file `hosts` Windows.
- **Menghapus Proyek (Delete Project)**:
  - Klik ikon tong sampah pada kartu proyek.
  - Dialog konfirmasi akan menanyakan opsi:
    - *Hapus dari Virtual Host saja*: Menghapus vhost, domain di hosts, dan sertifikat SSL; file proyek fisik di harddisk tetap aman.
    - *Hapus Bersama File Fisik* (centang checkbox): Menghapus seluruh folder proyek fisik dari harddisk Anda secara permanen.

---

<!-- section: git-ssl, module: git, tags: [git, ssl, root-ca, openssl, credentials, terminal, portable-git, tutorial-git, tutorial-ssl, certutil, windows-store, clone-repo, commit, https-local] -->
### 3.6 Git Manager & Otoritas Sertifikat SSL Lokal (Git & Root CA)

#### A. VyloServe Local Root Certificate Authority (SSL Root CA)
Secara bawaan, sertifikat SSL lokal yang dibuat sendiri (*self-signed certificate*) akan memunculkan tanda silang merah atau peringatan *"Your connection is not private"* di browser. VyloServe mengatasi ini dengan arsitektur **Local Root CA**:
1. Buka menu **Git & SSL Manager** di sidebar.
2. Klik tombol **Generate & Install Root CA**:
   - Menggunakan OpenSSL bawaan Apache (`bin/apache/<version>/bin/openssl.exe`).
   - Membuat pasangan kunci `VyloServeRootCA.key` dan sertifikat `VyloServeRootCA.crt` (masa berlaku 10 tahun / 3650 hari) di direktori `data/ssl/`.
   - Menjalankan perintah Windows dengan elevasi administratif UAC:
     ```cmd
     certutil -addstore -f "Root" "data\ssl\VyloServeRootCA.crt"
     ```
   - Sertifikat Root CA terdaftar resmi ke dalam **Windows Trusted Root Certification Authorities Store**.
3. **Hasil Akhir**:
   - Setiap kali Anda membuat virtual host baru (misal: `toko-online.test`), VyloServe otomatis menerbitkan sertifikat domain dengan Subject Alternative Names (`DNS.1 = toko-online.test`, `DNS.2 = *.toko-online.test`) yang ditandatangani oleh Root CA ini.
   - Saat Anda membuka `https://toko-online.test` di Google Chrome, Microsoft Edge, atau browser Windows lainnya, koneksi HTTPS menampilkan ikon gembok aman hijau tanpa peringatan keamanan!

#### B. Portable Git Manager
- Jika komputer Anda belum terpasang Git, VyloServe menyediakan modul Git portabel yang diunduh langsung dari repositori Git for Windows.
- **Fitur Git di Antarmuka**:
  - Konfigurasi identitas global (`git config --global user.name` dan `user.email`).
  - Kloning repositori remote via URL HTTPS atau SSH.
  - Status working tree (file modified, staged, untracked).
  - Melakukan staging (`git add`) dan commit (`git commit -m "pesan"`).

---

<!-- section: tunnels, module: tunnels, tags: [tunnels, cloudflare, zrok, public-url, share, trycloudflare, remote-access, reverse-proxy, tutorial-tunnels, webhook-testing, remote-demo] -->
### 3.7 Tunnel Publik Instan (Cloudflare & Zrok)

Fitur Tunnels memungkinkan website lokal di komputer Anda diakses oleh klien, rekan tim, atau layanan webhook (seperti Midtrans, Stripe, GitHub Webhooks) dari seluruh dunia tanpa perlu IP publik statis atau konfigurasi port-forwarding router WiFi.

#### A. Cloudflare Tunnel (Quick Tunnel - Tanpa Akun)
1. Buka menu **Tunnels** dari sidebar.
2. Jika biner `cloudflared.exe` belum terpasang, klik tombol **Install Cloudflare**.
3. Pada tab **Cloudflare**, tentukan mode berbagi:
   - **Share Registered Project**: Pilih salah satu proyek Apache yang terdaftar di VyloServe (misal: `toko-online.test`). Sistem otomatis membaca port HTTP yang digunakan.
   - **Share Custom Target**: Masukkan sembarang target lokal (misal: `localhost:3000` untuk aplikasi React/Next.js).
4. Klik tombol hijau **Start Tunnel**:
   - Backend menjalankan `cloudflared.exe tunnel --url http://127.0.0.1:<port>`.
   - Log proses dipindai secara real-time untuk mengekstrak URL publik sementara.
   - URL publik berformat `https://<kata-acak>.trycloudflare.com` akan muncul di kartu tunnel aktif.
   - Tombol **Copy URL** siap disalin dan dibagikan.
   - Pada mode proyek terdaftar, domain tunnel tersebut secara otomatis ditambahkan sebagai `ServerAlias` di Virtual Host Apache!

#### B. Zrok Tunnel (OpenZiti - Berautentikasi & Cepat)
1. Daftar akun gratis di [zrok.io](https://zrok.io) untuk mendapatkan token aktivasi akun Anda.
2. Pada tab **Zrok** di VyloServe, masukkan token Anda ke kolom **Enable Token** lalu klik **Activate Zrok**.
3. Pilih proyek atau target localhost yang ingin dibagikan.
4. Klik **Start Share**:
   - Backend mengeksekusi `zrok.exe share public http://localhost:<port> --headless`.
   - URL publik aman berformat `https://<id>.shares.zrok.io` muncul di antarmuka.

#### C. Menghentikan Tunnel
- Seluruh tunnel yang sedang aktif tercantum pada daftar **Active Tunnels**.
- Cukup klik tombol merah **Stop** untuk menutup tunnel dan mematikan akses publik seketika.

---

<!-- section: dev-tools, module: tools, tags: [qr-code, base64, url-encode, markdown-viewer, documentation, utilities, tutorial-tools] -->
### 3.8 Utilitas Pengembang (Developer Tools)

VyloServe menyediakan alat-alat bantu produktivitas harian yang berjalan instan di komputer lokal Anda:
1. **Markdown Documentation Viewer**:
   - Arahkan ke folder dokumentasi proyek Anda untuk menjelajahi file `.md` dalam bentuk hierarki pohon (*tree view*).
   - Menyaring direktori yang tidak relevan secara cerdas (mengabaikan `node_modules`, `.git`, `.venv`).
   - Render GFM lengkap: tabel, task list checkbox, syntax highlighting kode, badge, serta konversi gambar lokal ke base64 agar tampil sempurna tanpa server web eksternal.
2. **QR Code Generator**:
   - Masukkan teks, tautan URL, atau konfigurasi Wi-Fi (SSID & Password).
   - Menghasilkan gambar QR code berkualitas tinggi yang dapat diunduh dalam format raster **PNG** atau vektor resolusi tak terbatas **SVG**.
3. **Base64 Converter**:
   - Mode Teks: Konversi string teks ke Base64 dan sebaliknya dengan penanganan enkripsi UTF-8 yang kebal terhadap karakter aksen/emoji.
   - Mode File: Drag-and-drop file gambar, dokumen PDF, atau arsip untuk mengubahnya menjadi Base64 Data URI siap pakai untuk CSS/HTML.
4. **URL Encoder / Decoder**:
   - Melakukan encoding/decoding karakter URL khusus (`%20`, `%2F`, dll.) dan membedah komponen URL (protokol, host, pathname, query parameters).

---

<!-- section: ai, module: ai, tags: [ai, copilot, gemini, groq, openrouter, ollama, free-tier, pro-tier, streaming, fab, tutorial-ai, setup-gemini, setup-groq, setup-openrouter, setup-ollama, model-selection, rag-knowledge, action-card, hitl, service-control, token-usage, quota, follow-up-suggestions] -->
### 3.9 AI Assistant Copilot & In-App RAG Retriever

VyloServe dilengkapi dengan asisten pengembang cerdas (*In-App Copilot*) yang terhubung langsung dengan basis pengetahuan dokumentasi ini dan inventaris sistem server lokal.

#### A. Tutorial Konfigurasi AI Provider & API Key
1. Masuk ke menu **Settings** (ikon gir di footer sidebar), lalu pilih tab **AI**.
2. **Pilih AI Provider**:
   - **Google Gemini**: Menggunakan API dari Google AI Studio. Sangat direkomendasikan karena menyediakan kuota Free Tier melimpah (15 RPM / 1 juta token per hari).
   - **Groq Cloud**: Inferensi ultra-cepat berbasis chip LPU (Llama 3.3 70B Versatile).
   - **OpenRouter**: Akses ke ratusan model open-source gratis (`:free`) dan berbayar.
   - **Ollama**: Server AI lokal offline di port `11434` (100% privasi tanpa internet).
3. **Masukkan API Key**:
   - Jika belum memiliki kunci, klik tombol **Get Free Key** di samping label untuk membuka halaman konsol resmi penyedia.
   - Tempelkan kunci API ke kolom input.
4. **Deteksi Otomatis Tingkat Akun (Account Tier Detection)**:
   - Sistem melakukan pengecekan non-intrusif ke endpoint provider secara empiris:
     - Google Gemini: Mengirim ping inferensi ultra-ringan ke model Pro untuk mendeteksi batas kuota `limit: 0` (Free Tier) vs respons HTTP 200 (Pro).
     - OpenRouter: Mengonsumsi endpoint `/api/v1/auth/key` untuk membaca saldo dan tipe tier akun.
     - Groq: Memvalidasi endpoint `/openai/v1/models`.
     - Ollama: Memvalidasi ketersediaan endpoint lokal `/api/tags`.
   - Lencana status akun akan terverifikasi secara real-time:
     - 🟢 `[Free Tier]`: Terdeteksi akun gratis yang valid.
     - 🟡 `[Pro / Pay-As-You-Go]`: Terdeteksi akun berbayar dengan batas kuota tinggi.
     - 🔵 `[Local Offline]`: Terdeteksi Ollama lokal aktif.
     - 🔴 `[Invalid API Key]`: Kunci tidak valid atau ditolak.
5. **Pilih Model AI**:
   - Dropdown model akan terisi otomatis berdasarkan hasil deteksi tingkat akun Anda.
   - **Pada Akun Free Tier**: Dropdown hanya menampilkan model gratis stabil (misal: `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `llama-3.3-70b-versatile`). Model kadaluwarsa (404) dan model berbayar otomatis disaring agar Anda tidak mengalami error kuota `HTTP 429`.
   - **Pada Akun Pro**: Menampilkan model penalaran tingkat lanjut (seperti `gemini-3.1-pro-preview`, Claude 3.5 Sonnet, GPT-4o).
6. **Uji Koneksi (Test Connection)**:
   - Klik tombol **Test Connection** untuk memverifikasi kelancaran inferensi dan latensi jaringan.
7. Klik **Save Settings**.

#### B. Cara Kerja In-App Knowledge Retriever (RAG)
Saat Anda bertanya kepada AI Assistant (baik melalui halaman percakapan penuh maupun tombol melayang FAB):
1. Backend Python membaca pertanyaan pengguna dan mendeteksi modul halaman yang sedang Anda buka (`active_screen`).
2. Modul `DocRetriever` memindai file dokumentasi resmi ini (`docs/user_guide.md`) secara in-memory.
3. Potongan informasi (*knowledge snippet*) yang paling relevan (misalnya penjelasan tombol tertentu atau solusi kode error yang sedang Anda alami) diekstrak dan disuntikkan ke dalam prompt LLM.
4. AI Assistant menjawab pertanyaan Anda dengan akurasi 100% presisi sesuai tombol, nama modul, dan fitur yang benar-benar ada di VyloServe tanpa berhalusinasi, lengkap dengan sitasi sumber berkas.

#### C. Kontrol Layanan Server & Proposal Tindakan (Human-in-the-Loop Action Cards)
AI Assistant memiliki hak akses untuk membantu Anda mengelola layanan server, namun **selalu berada di bawah persetujuan Anda**:
1. Jika Anda meminta perintah seperti:
   - *"Tolong hidupkan server apache"*
   - *"Matikan semua service"*
   - *"Restart Apache 2.4.58"*
2. AI tidak langsung mengubah status sistem secara sepihak, melainkan menyertakan **Kartu Proposal Aksi (`AiActionCard`)** di bawah pesan penjelasannya:
   - Menampilkan nama layanan, ikon modul, tipe aksi (`Start`, `Stop`, `Restart`), dan versi target.
   - Menyediakan tombol `[Konfirmasi & Jalankan]` dan `[Batalkan]`.
3. Mengklik `[Konfirmasi & Jalankan]`:
   - Sistem memanggil API backend terverifikasi.
   - Status kartu berubah menjadi hijau (*Success*) dan event `service_status_changed` disinkronkan ke seluruh modul (Dashboard, Sidebar, Apache, PHP, Database).
4. Status aksi tersimpan persisten secara dual-layer (`data/ai_action_states.json` di disk dan `localStorage` di UI) sehingga status tombol tidak reset jika Anda menutup bubble atau merestart aplikasi.

#### D. Pemantauan Penggunaan Token & Kuota (Usage & Quota Monitor)
1. Di bagian header **AI Assistant** maupun jendela melayang **Quick AI Copilot**, terdapat lencana interaktif **Token Usage (`AiUsageBadge`)**.
2. Klik lencana tersebut untuk membuka popover statistik pemakaian API Key Anda:
   - **Penggunaan Hari Ini (Daily Usage)**: Jumlah token (*prompt + completion*) dan jumlah request hari ini beserta progress bar terhadap estimasi kuota harian provider.
   - **Akumulasi 7 Hari Terakhir (7-Day Rolling Window)**: Total pemakaian token dan request selama seminggu terakhir.
   - **Sisa Kuota Real-Time (Provider Live Limits)**: Menampilkan sisa kuota request/token langsung dari header HTTP provider (Groq RateLimit) atau saldo kredit akun (OpenRouter).
   - **Reset Usage Counter**: Tombol untuk mengosongkan pencatat pemakaian lokal (`data/ai_usage.json`) kapan saja.

#### E. Rekomendasi Pertanyaan Lanjutan (Follow-up Suggestions)
1. Setiap kali AI selesai menjawab pertanyaan Anda, sistem secara cerdas menghasilkan **2–3 chip rekomendasi pertanyaan lanjutan (`AiSuggestionChips`)** tepat di atas kolom input pesan.
2. Anda memiliki dua opsi interaksi pada setiap chip rekomendasi:
   - **Klik teks chip**: Langsung mengirimkan pertanyaan lanjutan tersebut ke AI Assistant dengan satu klik.
   - **Klik ikon pensil (*Edit*) di kanan chip**: Menyalin teks pertanyaan ke dalam kolom input agar Anda dapat memodifikasi atau menambahkan detail sebelum mengirimkannya.

---

<!-- section: settings, module: settings, tags: [settings, theme, dwm, titlebar, language, i18n, native-notifications, toast, auto-updater, tutorial-settings, ganti-tema] -->
### 3.10 Pengaturan Sistem & Kustomisasi (Settings & Preferences)

Buka menu **Settings** di footer sidebar untuk mengonfigurasi preferensi aplikasi:
1. **Bahasa Antarmuka (Language)**:
   - Pilih antara **Bahasa Indonesia** atau **English (US)**. Seluruh label tombol, pesan notifikasi toast, dan panduan dialog akan berubah seketika tanpa perlu restart.
2. **Pilihan Tema Warna (Theming Engine)**:
   - Tersedia 10 preset tema profesional:
     - Gelap: *VyloServe Dark* (Default), *Darcula*, *Solarized Dark*, *High Contrast Dark*, *Monokai*, *Dracula*, *Nord*.
     - Terang: *VyloServe Light*, *Solarized Light*, *High Contrast Light*.
   - **Sinkronisasi DWM Windows Titlebar**: Mengubah tema otomatis mengubah warna latar dan warna teks pada titlebar jendela native Windows via Windows Desktop Window Manager (DWM).
3. **Notifikasi Native Windows**:
   - Mengaktifkan pengiriman notifikasi ke *Windows 10/11 Action Center*.
   - Notifikasi native otomatis digerbang hanya saat jendela aplikasi sedang diminimalkan atau disembunyikan di tray, sehingga tidak menduplikasi toast di layar kerja aktif Anda.
4. **Pembaruan Aplikasi Otomatis (Auto-Updater)**:
   - Menampilkan versi aplikasi Anda saat ini.
   - Pilihan checkbox **Opt-in Pre-release** untuk mencoba versi uji coba lebih awal.
   - Tombol **Check for Updates**: Memeriksa rilis GitHub resmi terbaru dan menyajikan unduhan otomatis satu klik di latar belakang.

---

<!-- section: error-codes, module: errors, tags: [error-code, os-10048, ah00072, ah00015, 403-forbidden, 502-bad-gateway, php-error, 1045-access-denied, 2002-cant-connect, http-404, http-429, uac-denied, kamus-error, error-log, php-cgi-1, memory-limit] -->
## 4. Kamus Kode Error & Log Sistem Lengkap (Exhaustive Error Dictionary)

Tabel berikut merangkum seluruh kode error umum yang sering dijumpai dalam pengoperasian server lokal, penyebab teknisnya, dan tombol/langkah solusinya di VyloServe:

| Kode Error / Cuplikan Pesan Log | Lokasi / Modul | Penyebab Teknis Utama | Solusi Atomik di VyloServe |
| :--- | :--- | :--- | :--- |
| `(OS 10048) make_sock: could not bind to address 0.0.0.0:80` | **Apache** (`logs/error_log` & Panel Log) | Port `80` telah digunakan oleh proses lain di Windows (biasanya IIS, Skype, atau *World Wide Web Publishing Service*). | Buka menu **Apache** -> klik ikon **Settings** -> ubah **HTTP Port** dari `80` menjadi `8080` -> Klik Simpan -> Klik **Start Server**. |
| `AH00072: make_sock: could not bind to address [::]:80` | **Apache** (`logs/error_log`) | Binding IPv6 pada port 80 gagal karena port terikat proses lain. | Ubah port HTTP Apache ke `8080` atau matikan layanan IIS melalui perintah Windows `net stop w3svc`. |
| `AH00558: Could not reliably determine the server's fully qualified domain name` | **Apache** (`logs/error_log`) | Apache tidak menemukan direktif `ServerName` global yang valid. | *Normal / Non-fatal*. VyloServe secara otomatis menyuntikkan `ServerName localhost` ke dalam `httpd.conf` pada setiap preflight. |
| `403 Forbidden: You don't have permission to access this resource` | **Browser / Apache** | File index (`index.php`/`index.html`) tidak ditemukan di folder DocumentRoot, atau konfigurasi direktori memblokir akses. | 1. Pastikan folder memiliki file `index.php` atau `index.html`.<br>2. Pada proyek Laravel, pastikan DocumentRoot diarahkan ke folder `/public`. |
| `502 Bad Gateway / Proxy Error: Could not connect to remote machine` | **Browser / Apache** | Apache mencoba meneruskan request `.php` ke FastCGI (`127.0.0.1:9000`), tetapi proses PHP FastCGI sedang mati atau crash. | Buka menu **PHP FastCGI** di sidebar -> pastikan instance versi PHP yang bersangkutan berada dalam status hijau **Running**. |
| `php-cgi.exe exited with code 1` | **PHP FastCGI** (Panel Log) | Ekstensi `.dll` PHP yang diaktifkan crash saat inisialisasi, atau terdapat dependensi VC++ Runtime yang hilang. | Buka menu **PHP** -> klik **Settings** -> nonaktifkan ekstensi yang baru saja dicentang -> pastikan VCRedist 2015–2022 x64 terinstal di Windows. |
| `Fatal error: Allowed memory size of X bytes exhausted` | **PHP Runtime** (Layar Browser) | Eksekusi skrip melebihi batas alokasi RAM yang diatur pada direktif `memory_limit` di `php.ini`. | Buka menu **PHP** -> klik **Settings** -> ubah **Memory Limit** menjadi `512M` atau `1024M` -> Simpan konfigurasi. |
| `Maximum execution time of N seconds exceeded` | **PHP Runtime** (Layar Browser) | Skrip PHP berjalan melebihi batas waktu (sering terjadi saat upload file besar atau seed database). | Buka menu **PHP** -> klik **Settings** -> naikkan nilai **Max Execution Time** menjadi `300` detik -> Simpan konfigurasi. |
| `HY000 [2002] Can't connect to MySQL server on '127.0.0.1'` | **Database MariaDB** | Mesin database MariaDB belum dinyalakan atau port 3306 tidak merespons. | Buka menu **Database** -> klik tombol **Start** pada instance MariaDB Anda. |
| `1045 Access denied for user 'root'@'localhost'` | **Database MariaDB** | Kata sandi user `root` yang dimasukkan pada konfigurasi aplikasi website salah. | Buka menu **Database** -> klik menu burger pada kartu instance -> pilih **Change Password** untuk menyetel ulang kata sandi root. |
| `FATAL: lock file "postmaster.pid" already exists` | **Database PostgreSQL** (`db_startup.log`) | PostgreSQL crash atau komputer mati mendadak saat PostgreSQL berjalan, meninggalkan file kunci PID lama. | Buka folder data PostgreSQL (`data/postgres_<ver>/`), hapus file bernama `postmaster.pid`, lalu klik **Start** kembali di VyloServe. |
| `UAC Elevation Denied / Permission Denied hosts` | **Project Manager** (Toast Warning) | Pengguna menolak (*klik No*) pada dialog User Account Control (UAC) Windows saat registrasi domain lokal. | Pada kartu proyek di Project Manager, klik tombol kuning **Retry Sync Hosts** dan klik **Yes** saat popup UAC Windows muncul. |
| `HTTP 404: Model is no longer available (discontinued)` | **AI Assistant** | Model AI lama telah dinonaktifkan permanen oleh penyedia API (misal model lama `gemini-2.0-flash`). | Buka menu **Settings -> AI** -> pilih model rilis terkini seperti `gemini-3.5-flash-lite` atau `gemini-3.8-flash`. |
| `HTTP 429: Resource has been exhausted (rate limit / quota 0)` | **AI Assistant** | Akun Free Tier mencoba memanggil model Pro berbayar, atau batas limit harian tercapai. | Buka **Settings -> AI** -> ganti model ke varian Free Tier yang valid (`gemini-3.5-flash-lite` atau Groq `llama-3.3-70b-versatile`). |
| `HTTP 401 / 403: API key not valid` | **AI Assistant** | Kunci API salah ketik, kadaluwarsa, atau hak aksesnya dinonaktifkan di konsol penyedia. | Buka **Settings -> AI** -> klik tombol **Get Free Key** -> buat API key baru -> tempelkan dan simpan di VyloServe. |
| `Ollama Offline / Connection Refused (11434)` | **AI Assistant** | Layanan server Ollama lokal belum dijalankan di komputer pengguna. | Buka command prompt Windows, ketik perintah `ollama serve` untuk menyalakan engine Ollama di latar belakang. |
| `cloudflared.exe: url_not_found` | **Tunnels (Cloudflare)** | Cloudflare tunnel gagal mendapatkan rute publik karena firewall memblokir UDP/QUIC atau DNS lokal bermasalah. | Buka menu **Tunnels** -> klik **Stop Tunnel** -> pastikan koneksi internet aktif -> klik **Start Tunnel** kembali. |
| `zrok: unauthorized environment` | **Tunnels (Zrok)** | Token akun zrok belum dimasukkan atau telah di-revoke dari konsol zrok.io. | Buka tab **Zrok** di menu Tunnels -> klik **Disable Zrok** -> masukkan token baru yang valid dari web zrok.io -> klik **Activate Zrok**. |

---

<!-- section: troubleshooting, module: troubleshooting, tags: [troubleshooting, solusi, kendala, port-conflict, crash, permission, solusi-lengkap, checklist, apache-troubleshoot, database-troubleshoot, vhost-troubleshoot, ssl-troubleshoot] -->
## 5. Panduan Pemecahan Masalah Langkah-demi-Langkah (Step-by-Step Troubleshooting)

### 5.1 Apache Tidak Mau Menyala (Checklist 4 Langkah)
1. **Langkah 1: Periksa Port Conflict di Windows**:
   - Buka Command Prompt (CMD), jalankan perintah:
     ```cmd
     netstat -ano | findstr :80
     ```
   - Jika terdapat baris berstatus `LISTENING`, perhatikan angka PID di ujung kanan. Buka Task Manager Windows -> tab Details -> cari proses dengan PID tersebut (biasanya `w3wp.exe` atau `Skype.exe`).
   - Solusi di VyloServe: Buka **Apache -> Settings**, ganti HTTP port menjadi `8080`.
2. **Langkah 2: Periksa Error Log Apache**:
   - Pada kartu Apache, klik tombol **View Logs** -> tab **Error Log**. Periksa apakah ada kesalahan sintaks atau direktif path yang salah.
3. **Langkah 3: Periksa VCRedist**:
   - Pastikan komputer Anda terpasang paket *Visual C++ Redistributable 2015-2022 (x64)*.
4. **Langkah 4: Jalankan Preflight**:
   - Matikan Apache dan nyalakan kembali. VyloServe akan secara otomatis memvalidasi file `httpd.conf` Anda.

### 5.2 Domain Virtual Host `.test` Tidak Bisa Diakses di Browser
1. **Periksa File Hosts Windows**:
   - Buka file `C:\Windows\System32\drivers\etc\hosts` menggunakan Notepad.
   - Pastikan terdapat blok konfigurasi berikut:
     ```text
     # --- BEGIN VYLOSERVE HOSTS ---
     127.0.0.1 namaproyek.test
     # --- END VYLOSERVE HOSTS ---
     ```
   - Jika tidak ada, buka kartu proyek di VyloServe dan klik tombol **Retry Sync Hosts**.
2. **Peringatan Sertifikat SSL di Browser**:
   - Jika browser menampilkan peringatan keamanan, buka menu **Git & SSL Manager** di VyloServe dan klik tombol **Generate & Install Root CA** untuk memasang sertifikat root ke Windows Certificate Store.
3. **Bersihkan DNS Cache Windows**:
   - Buka CMD Windows, jalankan:
     ```cmd
     ipconfig /flushdns
     ```

### 5.3 Database MariaDB / MySQL Crash saat Dinyalakan
1. **Periksa Port 3306**:
   - Pastikan tidak ada service MySQL lama (dari XAMPP atau Windows Service) yang sedang aktif di port 3306.
2. **Periksa Startup Log**:
   - Klik menu opsi pada kartu database -> klik **Startup Log**.
   - Jika terdapat pesan `InnoDB: Operating system error number 32`, folder data sedang terkunci oleh proses lain atau antivirus. Restart komputer Anda atau matikan proses `mysqld.exe` gantung via Task Manager.

---

<!-- section: faq, module: faq, tags: [faq, tanya-jawab, migrasi-xampp, migrasi-laragon, lokasi-file, portabel] -->
## 6. Tanya Jawab Umum Komprehensif (FAQ)

**T: Apakah saya harus menghapus (*uninstall*) XAMPP atau Laragon sebelum menggunakan VyloServe?**  
J: **Tidak perlu**. VyloServe bersifat 100% mandiri dan portabel. Anda hanya perlu memastikan bahwa Apache dan MySQL milik XAMPP/Laragon dalam kondisi *Stop* (mati) agar port `80` dan `3306` tidak bertabrakan saat VyloServe dinyalakan.

**T: Di mana lokasi folder penyimpanan file-file server VyloServe?**  
J: Seluruh komponen disimpan rapi di dalam subfolder aplikasi:
- Biner server: `bin/apache/`, `bin/php/`, `bin/database/`, `bin/runtimes/`, `bin/tunnels/`.
- Data database: `data/<db_id>/`.
- Konfigurasi aplikasi: `data/settings.json`, `data/projects.json`, `data/databases.json`.
- Riwayat AI, Action States & Pemakaian Token: `data/ai_chat_history.json`, `data/ai_action_states.json`, `data/ai_usage.json`.
- Root web default: `www/`.

**T: Apakah saya bisa memindahkan folder instalasi VyloServe ke drive lain (misal dari C: ke D:)?**  
J: **Bisa**. Karena bersifat portabel, Anda dapat memindahkan folder VyloServe. Saat Apache pertama kali dinyalakan di lokasi baru, VyloServe akan otomatis memperbarui variabel `SRVROOT` di file `httpd.conf` agar sesuai dengan path drive baru Anda.

**T: Mengapa saya selalu dimintai izin Administrator (UAC) saat membuat proyek baru?**  
J: File pemetaan domain Windows (`C:\Windows\System32\drivers\etc\hosts`) adalah file sistem terlindungi. Demi keamanan, Windows mewajibkan persetujuan UAC sekali setiap kali aplikasi menyunting file tersebut untuk mendaftarkan domain lokal baru Anda.

**T: Apakah AI Assistant Copilot menyimpan kode atau data pribadi saya?**  
J: **Tidak**. Riwayat percakapan disimpan secara lokal di komputer Anda pada file `data/ai_chat_history.json`. Kunci API Anda disimpan di lokal. Jika Anda memilih menggunakan Ollama, seluruh pemrosesan AI berjalan 100% offline di mesin Anda tanpa koneksi internet sama sekali.

---

<!-- section: glossary, module: glossary, tags: [glosarium, definisi, fastcgi, vhost, named-pipe, dwm, uac, lpu, sse, root-ca, hitl] -->
## 7. Glosarium Istilah Teknis (Glossary)

- **DocumentRoot**: Direktori root pada sistem file tempat file-file web publik (HTML, skrip PHP, stylesheet CSS, gambar) yang dapat diakses oleh browser klien diletakkan.
- **FastCGI**: Protokol biner terbuka yang menghubungkan web server (seperti Apache) dengan engine eksekusi bahasa (seperti `php-cgi.exe`) secara persisten tanpa perlu membuat proses OS baru dari awal pada setiap request HTTP.
- **Human-in-the-Loop (HITL)**: Pola desain interaksi AI di mana tindakan tingkat sistem (seperti menyalakan atau mematikan layanan server) hanya diusulkan dalam bentuk kartu proposal dan membutuhkan klik konfirmasi eksplisit dari pengguna sebelum dieksekusi.
- **In-Place Update**: Mekanisme pembaruan biner server secara langsung di mana versi baru dipasang dan konfigurasi versi lama disalin secara otomatis tanpa menghapus data atau website pengguna.
- **LPU (Language Processing Unit)**: Mikroarsitektur akselerator hardware inferensi AI khusus yang dikembangkan oleh Groq untuk menghasilkan respons model bahasa besar dengan latensi sangat rendah.
- **Named Pipe**: Mekanisme komunikasi antar-proses (*Inter-Process Communication / IPC*) pada sistem operasi Windows yang memungkinkan instance aplikasi berkomunikasi secara aman dan cepat melalui handle berkas virtual (`\\.\pipe\...`).
- **PHP Switcher**: Fitur yang memungkinkan pengembang mengubah versi PHP yang aktif melayani web server secara instan melalui penyuntingan konfigurasi proxy Apache tanpa restart OS.
- **Root Certificate Authority (Root CA)**: Otoritas sertifikat tingkat puncak yang diinstal ke dalam Windows Trusted Root Store untuk memvalidasi dan memercayai sertifikat HTTPS domain lokal tanpa peringatan keamanan di browser.
- **Server-Sent Events (SSE)**: Standar komunikasi satu arah di mana server web dapat mengalirkan (*streaming*) data teks secara real-time ke browser (digunakan pada fitur streaming respon AI Assistant).
- **Smart Routing**: Kemampuan VyloServe mendeteksi subfolder `public/` pada framework modern (seperti Laravel dan CodeIgniter) dan secara otomatis mengarahkan DocumentRoot web server ke folder tersebut.
- **User Account Control (UAC)**: Fitur keamanan bawaan Microsoft Windows yang mencegah modifikasi file sistem penting tanpa izin eksplisit dari pengguna komputer.
- **Virtual Host (VHost)**: Konfigurasi server web Apache yang memungkinkan beberapa nama domain lokal berbeda (misal: `toko.test`, `blog.test`, `api.test`) berjalan secara independen pada satu instance server fisik yang sama.
