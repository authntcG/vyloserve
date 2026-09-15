# Backend Services (Logika Python)

Logika backend ditempatkan pada folder `core/services/`. Masing-masing file bertanggung jawab penuh atas modul tertentu (Menerapkan prinsip *Single Responsibility*).

## 1. Modul Utilitas Global (`core/utils/`)
Utilitas ini digunakan oleh seluruh Service Manager.
*   **`system_utils.py`**:
    *   `get_project_root()`: Mengembalikan path dasar proyek secara aman baik dalam mode `.py` (Development) maupun mode `.exe` (Production PyInstaller).
    *   `run_silent_command(cmd)`: Menjalankan eksekusi Terminal secara tersembunyi (*synchronous*). Menggunakan `CREATE_NO_WINDOW` di OS Windows.
    *   `start_silent_process(cmd)`: Mirip dengan run_silent, namun untuk *service background* (*asynchronous*) seperti Daemon Apache/PHP.
    *   `check_port_in_use(port, host)`: Mengecek apakah sebuah port sedang dikunci oleh OS. Didukung dengan fallback spesifik IPv6 (`::1`) yang biasa terjadi pada localhost Windows 11.
*   **`file_utils.py`**:
    *   `download_advanced(url)`: Mengunduh file menggunakan `urllib` dengan *chunking* yang menghasilkan metrik *progress bar*.
    *   `extract_archive(zip_path)`: Mengekstrak format zip maupun tar secara aman (mencegah *zip slip vulnerability*).

## 2. Modul Manajer Inti (`core/services/`)

### `apache.py` (ApacheManager)
Mengatur siklus hidup Web Server Apache.
*   `start_server(port)`: Memulai proses `httpd.exe`.
*   `_verify_and_patch_httpd()`: Membaca dan melakukan substitusi RegEx (Regular Expression) ke dalam `httpd.conf` agar *DocumentRoot* dan *Proxy* mengarah ke folder yang sesuai (folder `/www`).
*   `update_global_php_proxy(port)`: Mengubah `httpd-vyloserve-php.conf` agar fitur Proxy-FCGI Apache menunjuk port PHP yang aktif.

### `php.py` (PhpManager)
Mengelola ekstensi dan versi PHP (*multi-versioning*).
*   `start_php(version)`: Memulai `php-cgi.exe` di port dinamis (berkisar antara port 9000). Karena versi bisa banyak, proses dikendalikan dalam kamus/dictionary `self.processes = {}`.
*   `_update_ini_lines(lines, config)`: Mengurai setiap baris dari file konfigurasi `php.ini` tanpa merusak komentar asli, lalu menimpa value untuk `memory_limit` dsb.

### `database.py` (DatabaseManager)
Mengelola mesin MySQL (MariaDB) dan PostgreSQL.
*   `start_server(engine, version)`: Memanggil Daemon spesifik. Meng-intercept pesan error start ke log `db_startup.log` di dalam direktori `data/` jika proses gagal (sehingga error OS bisa ditampilkan ke UI).
*   `_parse_postgres_config()`: Menulis dan membaca file konfigurasi PostgreSQL secara cerdas dengan mendeteksi baris (menghapus *inline comment*).
*   **Dependensi Kritis:** Database *Start* wajib menggunakan injeksi *Port Custom* lewat argumen CLI (seperti `-p 3306`) daripada mengandalkan `postgresql.conf` yang rawan diubah manual.

### `runtimes_manager.py` (RuntimesManager)
Mengelola bahasa pemrograman/engine yang membutuhkan injeksi ke Windows OS (Global).
*   `install_node(version)` / `install_python(version)`: Mengunduh arsip kompilasi resmi.
*   `_is_in_user_path()` / `toggle_user_path()`: Sangat krusial. Fungsi ini membuka `winreg` (Windows Registry API) `HKEY_CURRENT_USER\Environment`, lalu melakukan append/menghapus direktori `bin/` pada string `Path`. Kemudian mengirimkan sinyal `SendMessageTimeoutW` (Windows API) agar terminal cmd/Powershell mengenali path baru tanpa perlu restart PC.

### `project.py` (ProjectManager)
Pusat manajemen pembuatan framework PHP.
*   `create_project()`: Memicu CLI `composer` untuk membuat *scaffold* framework Laravel/CodeIgniter.
*   `_generate_vhost_block()`: Menciptakan direktif `<VirtualHost>` untuk Apache berdasarkan input domain pengguna, dibantu dengan sistem *Smart Routing* (otomatis membaca folder `/public` untuk keamanan server-side PHP).
*   `sync_windows_hosts()`: Menginjeksi domain lokal (misal `127.0.0.1 test.local`) ke dalam `C:\Windows\System32\drivers\etc\hosts`. Ini adalah satu-satunya fungsi di VyloServe yang memanggil *UAC Prompt* (layar izin Administrator Windows) via modul `ctypes`.

### `api.py` (Api Facade)
File pusat ini menginisialisasi semua Manager di atas dan mendaftarkannya sebagai atribut (misal `self.apache = ApacheManager(self)`). Seluruh fungsi JavaScript dari *frontend* diteruskan ke file ini, yang akan menyortirnya ke Manager yang relevan.
