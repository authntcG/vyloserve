# Fitur Aplikasi (Features)

VyloServe dirancang sebagai alternatif yang jauh lebih cepat, estetik, dan ringan dibandingkan alat tradisional seperti XAMPP atau WAMP. Berikut adalah rincian fitur utama:

## 1. Web Server (Apache)
- **Instalasi Portable:** Mengunduh dan mengekstrak Apache secara portable di folder `bin/apache`.
- **Manajemen Port:** Mengonfigurasi `httpd.conf` secara otomatis agar berjalan di port yang ditentukan.
- **Smart Reverse Proxy:** Secara otomatis mengarahkan ekstensi `.php` ke *FastCGI proxy* yang dikelola oleh modul PHP.
- **Auto-Config:** Tidak memerlukan instalasi *service* Windows, berjalan secara langsung (*background process*).
- **Cek & Update Versi (In-Place Update Flow):** Versi Apache aktif dicek otomatis terhadap versi rilis terbaru. Jika versi baru tersedia, kartu Apache menampilkan opsi "Update to {versi}" di menu dropdown burger. Mengklik opsi ini membuka dialog konfirmasi (`useAlert().confirm`) untuk memastikan pengguna bersedia memperbarui ke versi tujuan. Jika disetujui, pembaruan berjalan dengan widget progress terminimalisasi (`BackgroundProgressWidget`). Mengklik tombol maximize pada widget tersebut akan mengembalikan dialog wizard penuh (`InstallWizard`) dengan versi tujuan yang otomatis terpilih pada dropdown versi.

## 2. Bahasa Pemrograman (PHP)
- **Multi-Version (Switcher):** Mendukung instalasi banyak versi PHP sekaligus secara portable. Pengguna bisa memilih versi aktif melalui UI.
- **Manajemen Ekstensi:** Memudahkan pengguna mengaktifkan/menonaktifkan ekstensi (`php_*.dll`) langsung dari UI tanpa perlu membuka `php.ini` manual.
- **Pengaturan Dinamis:** Dapat mengubah `memory_limit`, `upload_max_filesize`, dan variabel `php.ini` lainnya dari UI.
- **Cek & Update Versi (Patch):** Instance PHP yang terinstal dicek otomatis di latar belakang terhadap versi patch terbaru pada baris major.minor yang sama (mis. 8.2.x terbaru, bukan loncat ke 8.3). Kalau ada, kartu instance mendapat badge kecil "Update" di sebelah namanya dan opsi "Update to {versi}" muncul di menu "..." — pola referensi yang kemudian ditiru modul Database (lihat §3). Beda dengan Database, update PHP hanya satu langkah konfirmasi (tanpa opsi backup, karena `update_php()` backend tidak punya kemampuan itu).

## 3. Database (MySQL/MariaDB & PostgreSQL)
- **Instalasi Dual-Engine:** Mendukung MariaDB (pengganti MySQL ringan) dan PostgreSQL.
- **Silent Start:** Menjalankan instance database melalui *daemon* tanpa menggunakan Windows Services. Membaca port secara kustom agar tidak bertabrakan dengan database sistem pengguna.
- **Auto-Password & Config:** Melakukan parsing otomatis terhadap `my.ini` dan `postgresql.conf` untuk menyesuaikan penggunaan memori (seperti `shared_buffers`).
- **Cek & Update Versi Engine:** Setiap instance database yang terinstal dicek otomatis di latar belakang terhadap versi terbaru yang tersedia untuk engine-nya (sekali per engine unik, bukan per-instance, dibandingkan secara semantik lewat `compareVersions()` agar versi yang sudah lebih baru dari hasil cek tidak keliru ditandai "ada update"). Kalau ada versi lebih baru, kartu instance terkait mendapat badge kecil "Update" di sebelah namanya dan opsi "Update to {versi}" muncul di menu "..." — pola yang sama persis dengan modul PHP. Alur update terdiri dari dua konfirmasi berurutan — (1) konfirmasi update ke versi target, (2) pilihan opsional membuat cadangan (*backup*) direktori data sebelum memperbarui (langkah ini khusus Database, PHP tidak punya ini) — lalu dijalankan dengan progress bar real-time dan *auto-rollback* otomatis ke versi sebelumnya kalau proses update gagal di tengah jalan.

## 4. Runtimes Manager
Mengelola instalasi engine pemrograman pihak ketiga. Path sistem (Windows Registry) akan disuntikkan secara otomatis.
- **Node.js:** Mendukung pengunduhan *Zip Portable* dari peladen resmi. Mendukung aktivasi otomatis untuk *Corepack* (Yarn & pnpm).
- **Python:** Mengunduh modul Embeddable Python, dilengkapi dengan injeksi *pip* (`get-pip.py`).
- **Java (JDK):** Mengunduh OpenJDK dari repositori Adoptium (Temurin).
- **Go:** Mengunduh *Go archive* dari peladen resmi Google.
- **Deteksi Instalasi Eksternal:** Kalau sebuah engine (Node/Python/Java/Go) sudah terpasang secara global di sistem pengguna di luar VyloServe, UI menampilkan badge peringatan di tab engine terkait dan mengunci toggle "Register to PATH" (mencegah dua instalasi engine yang sama bentrok memperebutkan variabel PATH sistem) — pengguna tetap bisa menginstal versi portable VyloServe-nya, hanya saja tidak bisa didaftarkan ke PATH selama instalasi eksternal itu ada.

## 5. Project Manager
- **Composer Integration:** Dapat menciptakan proyek PHP (seperti Laravel, CodeIgniter 4) secara otomatis melalui UI menggunakan Composer (yang telah di-embed).
- **Auto Virtual Host:** Membuat konfigurasi Virtual Host Apache (`<VirtualHost>`) secara instan dengan domain `.local` (misal: `test.local`).
- **Auto Windows Hosts:** Melakukan injeksi domain lokal ke file `C:\Windows\System32\drivers\etc\hosts` (memerlukan elevasi UAC/Administrator).
- **Smart Routing (Public Folder):** Mendeteksi secara cerdas jika framework menggunakan folder `public` sebagai *document root* (seperti pada Laravel).

## 6. Git & SSL Manager
- **Portable Git:** Menginstal Git secara *portable* dan menghubungkannya dengan Terminal.
- **Local SSL CA:** Membuat Root Certificate Authority (CA) khusus untuk VyloServe (`VyloServeRootCA`) menggunakan OpenSSL (bawaan Apache), dan mendaftarkannya ke *Windows Trust Store* sehingga domain `.local` mendapatkan sertifikat HTTPS "hijau" (Secure).

## 7. Multi-Language, Tema & Aplikasi Satu-Instance
- **i18n Frontend:** Antarmuka mendukung multi-bahasa (Inggris dan Indonesia) yang diterjemahkan langsung melalui frontend React.
- **10 Pilihan Tema & Sinkronisasi DWM Native Titlebar:** Modal "Settings" (tab General) menyediakan 10 skema warna (VyloServe Dark/Light, Darcula, Solarized Dark/Light, High Contrast Dark/Light, Monokai, Dracula, Nord) yang tersimpan persisten. Selain mengatur warna background awal dan kelas tema CSS, palet tema otomatis disinkronkan ke titlebar native Windows lewat DWM API (`DwmSetWindowAttribute` caption & text color) sehingga warna bar jendela menyatu mulus dengan UI tema.
- **Dashboard Modular:** Menyimpan preferensi pengguna mengenai layanan mana saja yang perlu ditampilkan di *Home Dashboard*.
- **Satu Instance Aplikasi Terisolasi & Named Pipe IPC:** Membuka VyloServe saat sudah ada instance yang berjalan tidak akan membuka window baru. Aplikasi memisahkan lingkungan secara bersih antara Production dan Development (Mutex terpisah `VyloServe_App_Mutex_v1` vs `VyloServe_Dev_App_Mutex_v1`, judul window `"VyloServe"` vs `"VyloServe (Development)"`, dan AppUserModelID terpisah). Restorasi window dilakukan lewat **Windows Named Pipe IPC** (`\\.\pipe\VyloServe_IPC_v1` / `\\.\pipe\VyloServe_Dev_IPC_v1`), di mana instance baru mengirim perintah `"SHOW"` dan instance utama membawanya ke depan secara thread-safe via WinForms UI thread — mencegah crash aplikasi saat window sedang diminimize atau disembunyikan di system tray.

## 8. System Logs — Panel Log Real-Time & Pembacaan File Log
- **Panel Log Terpusat:** Panel log di bagian bawah aplikasi menampilkan event real-time dari seluruh modul (instalasi, start/stop servis, error) selama aplikasi berjalan.
- **Live Tail File Log:** Selain event dari kode, VyloServe juga memantau berkala (setiap ±2 detik) file log asli Apache (`error_log`/`access_log`) dan Database (`db_startup.log`, serta `.err` native MySQL/MariaDB) selama servisnya berjalan, dan menyalurkan baris barunya langsung ke panel log yang sama — tanpa perlu membuka file secara manual.
- **Filter Level & Kategori (Atomic):** Modal "Settings" (tab Logs) memungkinkan pengguna menyalakan/mematikan log per level (Info/Warning/Error/Success) maupun per kategori modul. Apache dan Database masing-masing punya **dua kategori independen** — "Log Sistem" (pesan instal/start/stop/error) dan "Log File" (baris dari file log asli) — sehingga bisa dimatikan terpisah sesuai kebutuhan.
- **Lihat Isi File Log Langsung di Aplikasi:** Halaman Settings Apache (tombol "Error Log"/"Access Log") dan dropdown kartu instance Database (tombol "Startup Log"/"Native Log") membuka modal yang menampilkan isi (tail) file log terkait langsung di dalam aplikasi, tanpa perlu Notepad/editor eksternal.

## 9. Auto-Updater
- **Cek Otomatis:** Memeriksa rilis terbaru dari GitHub Releases secara otomatis di setiap startup aplikasi, dan menawarkan pengecekan manual kapan saja lewat modal "Settings" (tab Updates).
- **Notifikasi Update Available:** Kalau ada versi baru saat startup, muncul alert ringan (bukan langsung membuka modal Settings penuh) berisi judul versi + catatan perubahan (changelog) mentah dari rilis GitHub, dengan tombol "Update" dan "Close". Menekan "Update" langsung membuka tab Settings → Updates **dan** otomatis memulai unduhan di latar belakang; menekan "Close" hanya menutup notifikasi tanpa aksi lanjutan (bisa dicek manual kapan saja lewat "Check for Updates").
- **Opsi Pre-release:** Pengguna dapat memilih menerima versi *alpha*/*beta* lebih awal lewat toggle "Terima Pembaruan Pre-release" — default hanya rilis stabil.
- **Download & Instal Satu Klik:** Mengunduh installer (`.exe`) di latar belakang dengan progress bar real-time (bisa ditutup modalnya, unduhan tetap berlanjut), lalu menjalankan installer Inno Setup mode silent (`/SILENT /SUPPRESSMSGBOXES`) yang otomatis menggantikan versi lama.

## 10. Tunnels (Zrok & Cloudflare Tunnel) — Berbagi Project ke Publik
- **Dukungan Dual-Engine:** Mendukung open-source [zrok](https://zrok.io) (OpenZiti) dan **Cloudflare Tunnel** (`cloudflared`).
- **Instalasi Portable:** Mengunduh dan mengekstrak binary portable ke folder `bin/tunnels/<engine>/` dengan deteksi rilis otomatis dari GitHub API.
- **Cloudflare Quick Tunnels:** Membuka tunnel publik instan (`*.trycloudflare.com`) tanpa memerlukan token akun atau login.
- **Aktivasi Akun Zrok:** Menghubungkan instalasi zrok lokal ke akun zrok pengguna lewat token environment (`zrok enable <token>`).
- **Share Project atau Target Kustom:** Membuka tunnel publik untuk salah satu project Apache yang sudah terdaftar (otomatis mengarah ke port Apache aktif), atau ke target kustom (`localhost:<port>`) untuk servis non-Apache (mis. dev server Node.js).
- **Auto-Alias ke Virtual Host:** Saat share sebuah project VyloServe aktif, URL publik zrok otomatis disisipkan sebagai `ServerAlias` di konfigurasi Virtual Host Apache project tersebut, dan dibersihkan kembali otomatis saat share dihentikan.
- **Manajemen Multi-Share:** Mendukung beberapa tunnel aktif bersamaan, masing-masing bisa dihentikan independen dari daftar "Active Shares". UI menggunakan subkomponen terisolasi `InstallTunnel.tsx` untuk kemudahan instalasi engine.

## 11. Developer Tools
Kumpulan utilitas ringan untuk produktivitas developer yang berjalan sepenuhnya di sisi klien (*100% client-side*) dan hybrid backend:
- **Markdown Documentation Viewer:** Penampil dokumentasi Markdown lokal interaktif. Memiliki pemilih folder OS (OS Folder Picker), navigasi pohon folder rekursif (`FolderTreeView`) yang otomatis memfilter direktori tanpa markdown dan mengabaikan `node_modules`/`.git`, pembaca dan renderer konten markdown (`MarkdownRenderer`) dengan dukungan tabel GFM dan syntax highlighting blok kode, serta konversi file gambar lokal menjadi Base64 URI data otomatis.
- **Base64 Encode/Decode:** Mendukung konversi teks (UTF-8 safe) maupun file (melalui *drag & drop* atau *file picker*) menjadi format Base64 dan sebaliknya.
- **URL Encode/Decode:** Mengonversi string menjadi format URL-safe dan melakukan *parsing* URI lengkap (protocol, host, path, dan query).
- **QR Generator:** Membuat *QR Code* secara instan berdasarkan input teks atau URL, dengan fungsionalitas unduh gambar hasil *render*.

## 12. Histori Notifikasi & Notifikasi Native Windows
- **Ikon Lonceng Riwayat Toast:** Setiap notifikasi toast (sukses/error/peringatan/info) yang pernah muncul selama sesi aplikasi berjalan tercatat di panel riwayat, dibuka lewat ikon lonceng di footer Sidebar — bersampingan dengan tombol Settings saat sidebar diperluas, di atas indikator beban sistem (CPU) saat sidebar diciutkan. Badge menampilkan jumlah notifikasi belum dibaca (di-cap "9+"), otomatis ter-reset begitu panel dibuka.
- **Bersih per Sesi:** Riwayat HANYA mencakup notifikasi dari sesi aplikasi yang sedang berjalan (sejak terakhir dibuka) — tidak tersimpan permanen dan otomatis kosong lagi saat aplikasi di-restart. Pengguna juga bisa membersihkan riwayat kapan saja lewat tombol "Clear" di panel.
- **Notifikasi Native Windows:** Saat window VyloServe sedang di-*minimize*, tidak fokus, atau disembunyikan ke System Tray, toast yang muncul diteruskan juga sebagai notifikasi native Windows (Action Center) — supaya pengguna tetap tahu ada kejadian penting (instalasi gagal/selesai, dsb.) meski sedang tidak melihat aplikasi. Notifikasi native TIDAK muncul saat window sedang aktif dilihat, untuk menghindari gangguan ganda. Klik pada notifikasi native akan langsung membuka kembali (restore + focus) window VyloServe.
- **Dapat Dimatikan:** Modal "Settings" (tab General) menyediakan toggle "Desktop Notifications" (default aktif) untuk mematikan notifikasi native sepenuhnya tanpa mempengaruhi riwayat toast di dalam aplikasi.
- **System Tray Aktif di Mode Pengembangan:** Sejak fitur ini, System Tray (dan perilaku "sembunyi ke tray" saat tombol tutup ditekan) tidak lagi eksklusif untuk build production — aktif juga saat aplikasi dijalankan dari sumber (dev mode), memudahkan pengujian fitur tray/notifikasi tanpa perlu build `.exe` terlebih dahulu.
