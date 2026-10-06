# Fitur Aplikasi (Features)

VyloServe dirancang sebagai alternatif yang jauh lebih cepat, estetik, dan ringan dibandingkan alat tradisional seperti XAMPP atau WAMP. Berikut adalah rincian fitur utama:

## 1. Web Server (Apache)
- **Instalasi Portable:** Mengunduh dan mengekstrak Apache secara portable di folder `bin/apache`.
- **Manajemen Port:** Mengonfigurasi `httpd.conf` secara otomatis agar berjalan di port yang ditentukan.
- **Smart Reverse Proxy:** Secara otomatis mengarahkan ekstensi `.php` ke *FastCGI proxy* yang dikelola oleh modul PHP.
- **Auto-Config:** Tidak memerlukan instalasi *service* Windows, berjalan secara langsung (*background process*).

## 2. Bahasa Pemrograman (PHP)
- **Multi-Version (Switcher):** Mendukung instalasi banyak versi PHP sekaligus secara portable. Pengguna bisa memilih versi aktif melalui UI.
- **Manajemen Ekstensi:** Memudahkan pengguna mengaktifkan/menonaktifkan ekstensi (`php_*.dll`) langsung dari UI tanpa perlu membuka `php.ini` manual.
- **Pengaturan Dinamis:** Dapat mengubah `memory_limit`, `upload_max_filesize`, dan variabel `php.ini` lainnya dari UI.

## 3. Database (MySQL/MariaDB & PostgreSQL)
- **Instalasi Dual-Engine:** Mendukung MariaDB (pengganti MySQL ringan) dan PostgreSQL.
- **Silent Start:** Menjalankan instance database melalui *daemon* tanpa menggunakan Windows Services. Membaca port secara kustom agar tidak bertabrakan dengan database sistem pengguna.
- **Auto-Password & Config:** Melakukan parsing otomatis terhadap `my.ini` dan `postgresql.conf` untuk menyesuaikan penggunaan memori (seperti `shared_buffers`).

## 4. Runtimes Manager
Mengelola instalasi engine pemrograman pihak ketiga. Path sistem (Windows Registry) akan disuntikkan secara otomatis.
- **Node.js:** Mendukung pengunduhan *Zip Portable* dari peladen resmi. Mendukung aktivasi otomatis untuk *Corepack* (Yarn & pnpm).
- **Python:** Mengunduh modul Embeddable Python, dilengkapi dengan injeksi *pip* (`get-pip.py`).
- **Java (JDK):** Mengunduh OpenJDK dari repositori Adoptium (Temurin).
- **Go:** Mengunduh *Go archive* dari peladen resmi Google.

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
- **10 Pilihan Tema:** Modal "Settings" (tab General) menyediakan 10 skema warna (VyloServe Dark/Light, Darcula, Solarized Dark/Light, High Contrast Dark/Light, Monokai, Dracula, Nord) yang tersimpan persisten dan ikut menentukan warna latar jendela saat aplikasi pertama kali dibuka (sebelum React sempat me-render apa pun).
- **Dashboard Modular:** Menyimpan preferensi pengguna mengenai layanan mana saja yang perlu ditampilkan di *Home Dashboard*.
- **Satu Instance Aplikasi (Single Instance):** Membuka VyloServe saat sudah ada instance yang berjalan tidak akan membuka window baru — aplikasi yang sudah berjalan otomatis dibawa ke depan (foreground) dan di-*restore* dari minimized, dideteksi lewat Windows Mutex.

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

## 10. Tunnels (Zrok) — Berbagi Project ke Publik
- **Instalasi Portable Zrok:** Mengunduh dan mengekstrak binary [zrok](https://zrok.io) (open-source tunneling by OpenZiti) secara portable di `bin/zrok`, dengan deteksi versi rilis langsung dari GitHub Releases.
- **Aktivasi Akun:** Menghubungkan instalasi zrok lokal ke akun zrok pengguna lewat token environment (`zrok enable <token>`).
- **Share Project atau Target Kustom:** Membuka tunnel publik untuk salah satu project Apache yang sudah terdaftar (otomatis mengarah ke port Apache aktif), atau ke target kustom (`localhost:<port>`) untuk servis non-Apache (mis. dev server Node.js).
- **Auto-Alias ke Virtual Host:** Saat share sebuah project VyloServe aktif, URL publik zrok otomatis disisipkan sebagai `ServerAlias` di konfigurasi Virtual Host Apache project tersebut, dan dibersihkan kembali otomatis saat share dihentikan.
- **Manajemen Multi-Share:** Mendukung beberapa tunnel aktif bersamaan, masing-masing bisa dihentikan independen dari daftar "Active Shares".
- Fitur ini tersedia penuh dan sudah terhubung ke UI (menu "Tunnels" di sidebar). Opsi "General Settings" pada dropdown kartu engine zrok (sebelumnya placeholder yang cuma menampilkan toast "not yet implemented") sudah **dihapus** — bukan diimplementasikan — karena modul ini diperkirakan tidak akan dipakai aktif dalam waktu dekat, jadi tidak ada gunanya mempertahankan tombol yang tidak berfungsi. Satu-satunya aksi di dropdown kartu engine sekarang hanya "Uninstall Zrok".

## 11. Developer Tools
Kumpulan utilitas ringan untuk produktivitas developer yang berjalan sepenuhnya di sisi klien (*100% client-side*) tanpa membebani backend:
- **Base64 Encode/Decode:** Mendukung konversi teks (UTF-8 safe) maupun file (melalui *drag & drop* atau *file picker*) menjadi format Base64 dan sebaliknya.
- **URL Encode/Decode:** Mengonversi string menjadi format URL-safe dan melakukan *parsing* URI lengkap (protocol, host, path, dan query).
- **QR Generator:** Membuat *QR Code* secara instan berdasarkan input teks atau URL, dengan fungsionalitas unduh gambar hasil *render*.

## 12. Histori Notifikasi & Notifikasi Native Windows
- **Ikon Lonceng Riwayat Toast:** Setiap notifikasi toast (sukses/error/peringatan/info) yang pernah muncul selama sesi aplikasi berjalan tercatat di panel riwayat, dibuka lewat ikon lonceng di footer Sidebar — bersampingan dengan tombol Settings saat sidebar diperluas, di atas indikator beban sistem (CPU) saat sidebar diciutkan. Badge menampilkan jumlah notifikasi belum dibaca (di-cap "9+"), otomatis ter-reset begitu panel dibuka.
- **Bersih per Sesi:** Riwayat HANYA mencakup notifikasi dari sesi aplikasi yang sedang berjalan (sejak terakhir dibuka) — tidak tersimpan permanen dan otomatis kosong lagi saat aplikasi di-restart. Pengguna juga bisa membersihkan riwayat kapan saja lewat tombol "Clear" di panel.
- **Notifikasi Native Windows:** Saat window VyloServe sedang di-*minimize*, tidak fokus, atau disembunyikan ke System Tray, toast yang muncul diteruskan juga sebagai notifikasi native Windows (Action Center) — supaya pengguna tetap tahu ada kejadian penting (instalasi gagal/selesai, dsb.) meski sedang tidak melihat aplikasi. Notifikasi native TIDAK muncul saat window sedang aktif dilihat, untuk menghindari gangguan ganda. Klik pada notifikasi native akan langsung membuka kembali (restore + focus) window VyloServe.
- **Dapat Dimatikan:** Modal "Settings" (tab General) menyediakan toggle "Desktop Notifications" (default aktif) untuk mematikan notifikasi native sepenuhnya tanpa mempengaruhi riwayat toast di dalam aplikasi.
- **System Tray Aktif di Mode Pengembangan:** Sejak fitur ini, System Tray (dan perilaku "sembunyi ke tray" saat tombol tutup ditekan) tidak lagi eksklusif untuk build production — aktif juga saat aplikasi dijalankan dari sumber (dev mode), memudahkan pengujian fitur tray/notifikasi tanpa perlu build `.exe` terlebih dahulu.
