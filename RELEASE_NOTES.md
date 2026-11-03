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
