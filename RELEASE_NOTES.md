# VyloServe v0.0.8-alpha

Rilis **v0.0.8-alpha** menghadirkan pembaruan besar pada platform fondasi, diagnostik sistem jaringan, dan utilitas pengembang VyloServe:
- Pusat Utilitas Pengembang Mandiri (**Developer Utilities Hub**) dengan 5 alat baru berkecepatan tinggi yang beroperasi 100% offline di sisi klien.
- **Native Splash Bootstrapper & 3-Tier Self-Healing System** bergaya IDE profesional (DBeaver/JetBrains) yang memulihkan konfigurasi secara otomatis sejak startup awal.
- Rangkaian alat pengujian jaringan dan diagnostik sistem tingkat lanjut (**Mail Sandbox**, **Webhook Inspector**, dan **Port Manager**).
- Integrasi penuh **GitLab CLI (`glab`)** untuk kolaborasi tim enterprise dan AI Assistant dengan Human-in-the-Loop Action Cards.
- Pembaruan identitas visual **Frosted Matte Glass 3D** yang modern tanpa efek glossy buatan.
- Pemantau statistik live Redis (`RedisStatsWidget`), dialog editor `.env` dengan visual diffing & secret masking, serta penampil log aplikasi pada Projects Hub.
- Komponen bersama baru (`<Input>`, `<TableActionMenu>`, dan peningkatan `<FilterChips>`).
- Standarisasi packaging produksi PyInstaller deklaratif via `main.spec`, penyertakan locale bilingual, dan resolusi runtime path `get_resource_path()`.

---

### Fitur Baru: Developer Utilities Hub (100% Client-Side & Offline-First)

Menu navigasi baru **Utilities** menghadirkan lima utilitas pengembang harian berkecepatan instan tanpa dependensi jaringan:
- **JSON Studio:** Editor teks dan penampil hierarki pohon (*collapsible tree view*) interaktif berdampingan, validasi sintaks seketika dengan deteksi baris/kolom galat, pemformat indentasi (2 atau 4 spasi), pemadatan (*minify*), evaluasi kueri JSONPath (contoh: `$.data[*].id`), dan pemuatan template contoh siap pakai.
- **JWT Debugger:** Pembongkar JSON Web Token dengan visual segmentasi 3 warna (Header, Payload, Signature), pelacak status kedaluwarsa waktu nyata (`exp`, `nbf`, `iat`) dengan hitung mundur waktu relatif, serta verifikasi tanda tangan HMAC-SHA256 offline menggunakan secret key lokal.
- **Crypto Generator & Hasher:** Kalkulator hash multi-algoritma (MD5, SHA-1, SHA-256, SHA-512) dengan pilihan format huruf besar/kecil, komputasi kriptografi HMAC dengan kunci rahasia, pembangkit UUID v4 universal (tunggal maupun massal), dan pembuat kata sandi / token acak berentropi tinggi.
- **Regex & Epoch Studio:** Penguji ekspresi reguler interaktif dengan penyorotan kecocokan visual secara langsung saat mengetik, dukungan bendera regex (`g`, `i`, `m`, `s`, `u`), dan tabel grup tangkapan (*capture groups*); terintegrasi dengan konverter waktu Unix Epoch dua arah (milidetik/detik ke tanggal lokal/UTC dan sebaliknya).
- **Data Converter:** Transformasi struktur data dua arah tanpa kehilangan informasi (*lossless conversion*) antara format **JSON**, **YAML**, **XML**, dan **CSV** dengan penanganan indentasi dan pemisah kolom.

---

### Fitur Baru: Native Splash Bootstrapper & 3-Tier Self-Healing System

Inisialisasi startup aplikasi tingkat profesional yang menjamin sistem menyala dalam kondisi stabil dan siap pakai:
- **Instant Native Frameless Splash Window:** Jendela native Windows instan yang langsung muncul dalam milidetik sebelum engine berat WebView2 dimuat, menampilkan logo frosted matte 3D, versi aplikasi, teks status dwibahasa, progress bar halus, dan sinkronisasi warna latar dengan 15 preset tema aktif pengguna.
- **3-Tier Self-Healing Pipeline:**
  - *Tier 1 (Orphan Process Cleanup):* Memindai dan mematikan proses zombie latar belakang sisa crash (`httpd.exe`, `php-cgi.exe`, `mysqld.exe`, `postgres.exe`, `redis-server.exe`, `cloudflared.exe`, `zrok.exe`, `glab.exe`).
  - *Tier 2 (Port Conflict Preflight):* Mendeteksi dini apakah port default layanan sedang diduduki aplikasi eksternal (seperti IIS atau Skype) dan memberikan laporan diagnostik proaktif.
  - *Tier 3 (Configuration Integrity Check):* Memeriksa validitas file konfigurasi JSON (`settings.json`, `projects.json`, `databases.json`, `gitlab.json`), membuat cadangan `.bak` otomatis bila korup, dan memulihkan template default yang bersih.
- **Smooth Handshake:** Jendela splash ditutup secara mulus tanpa kedip setelah frontend React mengirimkan sinyal kesiapan `vylo_app_ready`.

---

### Fitur Baru: Alat Pengujian Jaringan & Diagnostik Sistem

Tiga alat pengembang baru yang terintegrasi langsung di menu Tools:
- **Mail Sandbox (Port 1025):** Server catch-all SMTP internal asinkron untuk menangkap seluruh email keluar dari aplikasi web lokal (Laravel, WordPress, Symfony, Node.js) tanpa pernah mengirimkannya ke internet nyata. Dilengkapi antarmuka pratinjau lengkap (HTML sandbox terisolasi, Plain Text, header MIME lengkap, dan unduh berkas lampiran), ekspor satu-klik ke format standar `.eml`, serta tombol pembersihan kotak masuk.
- **Webhook Inspector (Port 9000):** Daemon HTTP internal untuk menangkap dan menguji kiriman payload webhook dari payment gateway (Midtrans, Xendit, Stripe) atau Git provider. Mencatat metode HTTP, header, payload JSON/form data ber-syntax highlight, status code respons yang dapat dikonfigurasi (`200`, `400`, `500`), serta generator perintah cURL satu-klik untuk replikasi request di terminal.
- **Port Manager & Safe Process Killer:** Pemindai port TCP aktif tingkat sistem operasi Windows (`psutil`) dengan tampilan tabel berdensitas tinggi (`<DataTable>`), menyajikan nomor port, status koneksi (`LISTENING`/`ESTABLISHED`), PID, nama executable (`.exe`), jalur aplikasi, filter pencarian cepat, dan aksi penghentian proses aman dengan konfirmasi alert modal.

---

### Fitur Baru: Integrasi GitLab CLI (`glab`) Terpadu

Tab integrasi terdedikasi pada modul Git untuk kolaborasi alur kerja GitLab:
- **Biner Portable Mandiri:** Deteksi biner OS dan wizard pengunduhan biner resmi `glab.exe` portable ke folder `bin/glab/`.
- **Dukungan Multi-Host & Dual Auth:** Menghubungkan akun publik `gitlab.com` dan server *Self-Hosted GitLab* privat menggunakan Personal Access Token (PAT) serta opsi protokol kloning default SSH/HTTPS.
- **VPN Probing Circuit Breaker (`requires_vpn`):** Pengecekan socket TCP non-blocking ke port 443 host target dengan timeout 2 detik untuk mendeteksi ketersediaan VPN kantor dan mencegah freeze antarmuka saat VPN terputus.
- **Issues & Merge Requests Viewer:** Menjelajah daftar issue dan MR aktif, label, dan assignee langsung dari antarmuka desktop.
- **AI Copilot Action Cards:** AI Assistant mampu menyusun draf ringkasan solusi issue atau komentar review MR, yang hanya dikirimkan setelah konfirmasi persetujuan pengguna (*Human-in-the-Loop*).

---

### Identitas Visual: Desain Ikon Frosted Matte Glass 3D

- **Penyempurnaan Ikon Golden Standard:** Ikon aplikasi diperbarui mengikuti estetika *splash-hero* dengan efek *frosted glass* bertekstur modern, bayangan lembut, dan bebas dari pantulan glossy berlebih.
- **Aset Grafis Multi-Resolusi:** Pembaruan menyeluruh pada aset `icons.ico` (resolusi multi-layer 16x16, 32x32, 48x48, 64x64, 128x128, dan 256x256), `icons.png`, `icons-nobg.png`, serta varian brand `brand-dark.png`, `brand-nav.png`, dan `brand-nobg.png`.

---

### Peningkatan Projects Hub & Database

- **Application Logs Viewer (`ProjectAppLogsModal`):** Penampil log runtime aplikasi (file log framework seperti `laravel.log`, console logs) dengan auto-tailing, filter level log (Info, Warning, Error), pencarian teks bebas, dan tombol ekspor.
- **Environment (.env) Editor Cerdas (`ProjectEnvModal`):** Editor variabel lingkungan terintegrasi dengan proteksi masking kata sandi/kunci sensitif, fitur perbandingan visual (*visual diffing*) sebelum menyimpan perubahan, dan auto-backup berkas `.env.bak`.
- **Custom SSL Hosts Manager (`ProjectSslHostsModal`):** Fleksibilitas untuk menambahkan domain alias tambahan atau subdomain kustom pada Virtual Host proyek, otomatis memperbarui sertifikat SSL SAN dan entri file hosts Windows.
- **Redis Live Stats & Monitoring Widget (`RedisStatsWidget`):** Dashboard statistik interaktif untuk instance Redis aktif, menyajikan pemantauan penggunaan memori RAM (`used_memory_human` / `maxmemory`), jumlah koneksi klien aktif, rasio hits/miss keyspace, uptime, dan tombol *Ping Test* real-time dengan latensi milidetik.

---

### Komponen Bersama & Ergonomi UI

- **Komponen Primitif `<Input>`:** Komponen input kontrol tema-aware yang menyatukan styling focus ring, padding, slot ikon kiri/kanan, tombol clear, font monospace, dan kepatuhan a11y `htmlFor`/`id` binding.
- **Komponen `<TableActionMenu>`:** Menu dropdown popover terpadu untuk baris tabel (`<DataTable>`), mengeliminasi masalah pemotongan popover pada batas kontainer tabel.
- **Peningkatan `<FilterChips>`:** Mendukung pergeseran horizontal menggunakan roda mouse vertikal desktop (`onWheel`), gradasi transisi lembut tepi (*edge fade mask*), tombol panah navigasi, dan auto-scroll chip terpilih ke area pandang.

---

### Keandalan Packaging: PyInstaller `main.spec` & Resolusi Path Runtime

- **Standarisasi Kontrak Packaging:** Seluruh konfigurasi bundling produksi dipusatkan deklaratif di dalam `main.spec`, menyertakan bundle frontend dist, aset gambar, serta direktori translasi bilingual `frontend/src/locales/`.
- **Runtime Path Resolution (`get_resource_path`):** Fungsi backend yang membaca aset statis dan locale kini mendeteksi `sys._MEIPASS` secara transparan saat aplikasi dijalankan dalam mode compiled `.exe`.
- **Eliminasi False-Positive GitLab Check:** Logika startup health check kini membedakan modul yang belum pernah dipasang pengguna dari modul yang benar-benar rusak, mengeliminasi pop-up peringatan keliru saat membuka aplikasi.

---

# VyloServe v0.0.7-beta

Rilis **v0.0.7-beta** menandai lompatan besar dalam evolusi VyloServe dari tahap alpha menuju platform pengelola server lokal yang matang, tangguh, dan lengkap. Pembaruan ini menghadirkan Developer Terminal multi-tab berbasis Windows ConPTY bawaan, dukungan mesin database Redis serta Database Schema Manager terpadu, Pusat Proyek Multi-Runtime (PHP, Node.js, Python, Go, Java), rangkaian Utilitas Pengembang baru (QR Code Generator & Base64 Converter tingkat lanjut), mekanisme pembatalan instalasi aman dengan auto-rollback, 15 preset tema warna dengan sinkronisasi titlebar native Windows DWM, serta peningkatan ketahanan jaringan mode offline.

---

### Fitur Baru: Developer Terminal Terpadu (Windows ConPTY)

Terminal konsol pengembang langsung di dalam aplikasi untuk menjalankan perintah pengembangan tanpa membuka jendela CMD atau PowerShell eksternal:
- **Dukungan Shell Lengkap:** Menjalankan PowerShell, Command Prompt (CMD), dan Git Bash secara native menggunakan subsistem Windows ConPTY (`xterm.js` dengan warna 24-bit ANSI).
- **Multi-Tab & Workspace Tab Groups:** Buka banyak tab secara bersamaan, atur tata letak alur kerja, dan simpan susunan tab favorit ke dalam Workspace untuk dipulihkan kembali kapan saja dengan satu klik.
- **Scoped Environment:** Jalankan perintah runtime (`node`, `python`, `go`, `java`, `composer`) secara langsung di terminal tanpa harus mendaftarkannya ke PATH Windows global komputer Anda.
- **Preset Sesi Tersimpan:** Buat dan simpan konfigurasi sesi kustom lengkap dengan folder awal kerja, variabel lingkungan, dan perintah otomatis (misal: `npm run dev`).
- **Kustomisasi Tampilan Penuh:** Pengaturan font monospace (Cascadia Code, JetBrains Mono, Fira Code), ukuran teks, gaya kursor, kedipan animasi, dan batas riwayat scrollback.

---

### Fitur Baru: Dukungan Redis & Database Schema Manager

Peningkatan modul Database menjadi Triple-Engine terpadu:
- **Mesin In-Memory Redis (Port 6379):** Dukungan penuh biner Windows native Redis untuk caching sesi, caching query, dan antrean job (job queues) dengan konfigurasi otomatis persistensi AOF.
- **Database Schema Manager Terpadu:** Kelola skema/database MariaDB dan PostgreSQL langsung lewat GUI antarmuka:
  - Melihat daftar seluruh skema aktif beserta ukuran disk dan collation.
  - Membuat skema baru dengan pemilihan Character Set (`utf8mb4`/`utf8`) dan Collation secara aman.
  - Menghapus skema uji coba dengan konfirmasi protektif dua tahap serta proteksi mutlak untuk skema sistem bawaan (`mysql`, `information_schema`, `postgres`).
- **Optimalisasi Pemuatan Versi MariaDB:** Dilengkapi cache memori pintar (24 jam) dan timeout otomatis, mengeliminasi latensi lama saat membuka wizard instalasi database.

---

### Fitur Baru: Utilitas Pengembang (Developer Tools)

- **QR Code Generator Komprehensif:**
  - 5 Mode Data: Tautan URL/Teks Bebas, Jaringan Wi-Fi (SSID, WPA/WPA2/WEP, Hidden Network), Kontak Digital vCard, Draf Email, dan SMS Instan.
  - Kustomisasi Visual: Pilihan warna titik dan latar belakang, Error Correction Level (L/M/Q/H), serta penyematan logo kustom di tengah QR code.
  - Ekspor Fleksibel: Unduh instan dalam format vektor tajam **SVG** (cocok untuk cetak/desain) atau raster resolusi tinggi **PNG**, serta tombol salin ke clipboard.
- **Base64 Converter Tingkat Lanjut:**
  - Konversi dua arah (Encode/Decode) untuk teks maupun file biner (gambar, dokumen PDF, audio, arsip).
  - Pilihan pemecahan baris otomatis (*Line Wrapping*): standar RFC 2045 (64 karakter), RFC 4880 (76 karakter), atau format kontinu tanpa jeda.
  - Fitur unduh file biner hasil decode langsung ke disk lokal dengan dialog penyimpanan native atau fallback browser blob.

---

### Peningkatan Projects Hub & Multi-Runtime Frameworks

- **Manajemen Proyek Multi-Runtime:** Pembuatan dan penautan proyek kini mencakup 5 ekosistem bahasa pemrograman utama: PHP (Laravel, CodeIgniter 4, WordPress, Raw PHP), Node.js (Vite, Next.js, Express), Python (FastAPI, Flask, Django), Go, dan Java.
- **Kontrol Lifecycle Dev Server Mandiri:** Tombol Start/Stop dev server langsung pada kartu proyek, disertai modal streaming log proses secara *real-time*.
- **Reverse Proxy Apache Otomatis:** Permintaan browser ke domain lokal `https://proyek.test` diteruskan secara transparan ke port dev server lokal dengan sertifikat SSL Root CA tanpa peringatan keamanan.

---

### Ketahanan Sistem: Pembatalan Aman & Mode Offline

- **Pembatalan Instalasi & Auto-Rollback Atomik:** Pengguna kini dapat membatalkan proses instalasi modul yang sedang berjalan kapan saja. Sistem secara otomatis menghentikan proses, membersihkan file arsip sementara (`.tmp`), menghapus folder ekstraksi parsial, dan merestorasi status konfigurasi tanpa meninggalkan file korup di disk.
- **Deteksi Koneksi Internet & Smart Offline Barrier:** Banner peringatan ramah saat koneksi terputus dengan tombol *Retry*, serta pemisahan cerdas antara fitur yang memerlukan jaringan luar dan fitur lokal (penautan proyek lokal dan template mentah tetap dapat digunakan 100% tanpa internet).
- **Pencegahan Bentrok Port Development (`55173`):** Server dev Vite dipindahkan ke port khusus terisolasi `55173`, mencegah tabrakan port dengan proyek web pengguna yang menggunakan port standar `5173` atau `3000`.

---

### Tampilan & Ergonomi Desktop: 15 Tema Warna & DWM Native Titlebar

- **15 Preset Tema Profesional:** Pilihan 10 tema gelap (*VyloServe Dark*, *Darcula*, *Solarized Dark*, *High Contrast Dark*, *Monokai*, *Dracula*, *Nord*, *Catppuccin Mocha*, *Tokyo Night*, *Gruvbox Dark*, *Windows XP Zune Dark*) dan 5 tema terang (*VyloServe Light*, *Solarized Light*, *High Contrast Light*, *Windows XP Luna Light*).
- **Sinkronisasi DWM Windows Titlebar Native:** Mengubah tema otomatis mengubah warna caption dan teks pada titlebar jendela native Windows via Desktop Window Manager (DWM).
- **Layout Desktop Penuh (`w-full`):** Menghilangkan pembatas sempit buatan agar antarmuka memanfaatkan ruang monitor desktop secara maksimal dan ergonomis.

---

### Perbaikan Kualitas, Stabilitas & Keamanan

- **Zero-Tolerance Quality Gate SonarQube:** 0 Bugs, 0 Vulnerabilities, 0 Security Hotspots, dan 0 Code Smells di seluruh basis kode backend dan frontend.
- **Pencegahan Kerentanan ReDoS:** Mengganti regex parsing konfigurasi yang berisiko *catastrophic backtracking* dengan metode string deterministik.
- **Otomasi Izin Microsoft Edge WebView2:** Mengeliminasi popup izin clipboard browser native Edge (*localhost wants to see clipboard*), memberikan pengalaman desktop native yang mulus.
- **Single-Instance IPC Windows Named Pipe:** Memastikan pemanggilan ulang jendela aplikasi dari System Tray berjalan stabil tanpa risiko crash antar-proses.
- **Isolasi Mutlak Test Suite:** Pengujian unit terisolasi sepenuhnya di memori dan direktori temporer, menjamin konfigurasi dan binary runtime riil pengembang tidak termutasi atau terhapus saat test dijalankan.
- **Cakupan Pengujian Komprehensif:** 975 pengujian unit frontend (95 file test Vitest) dan 874 item pengujian backend (27 file test Pytest) dengan tingkat kelulusan 100%.
