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

## 7. Multi-Language & Tema (Dashboard)
- **i18n Frontend:** Antarmuka mendukung multi-bahasa (Inggris dan Indonesia) yang diterjemahkan langsung melalui frontend React.
- **Dashboard Modular:** Menyimpan preferensi pengguna mengenai layanan mana saja yang perlu ditampilkan di *Home Dashboard*.
