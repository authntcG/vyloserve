# 🚀 VyloServe - Dokumentasi Resmi Proyek

**VyloServe** adalah manajer lingkungan server web lokal (*Local Web Development Environment*) modern tingkat *enterprise* yang dirancang sebagai alternatif yang jauh lebih cepat, estetik, dan ringan dibandingkan alat tradisional seperti XAMPP, WAMP, atau Laragon. 

Dokumentasi ini berisi informasi mendalam mengenai struktur, inisialisasi, alur kerja kode, serta panduan untuk pengembangan (*development*).

---

## 📋 1. Persyaratan Sistem (*System Requirements*)

Untuk menjalankan dan mengembangkan VyloServe, sistem Anda membutuhkan perangkat lunak berikut:

*   **Sistem Operasi**: Windows 10 atau 11 (64-bit) sangat direkomendasikan karena aplikasi ini dirancang khusus untuk memanfaatkan manajemen proses (seperti Apache/PHP) di ekosistem Windows.
*   **Python**: Versi `3.9` atau yang lebih baru (untuk *backend* utama).
*   **Node.js**: Versi `16.x` atau yang lebih baru (beserta `npm` atau `yarn` untuk pengembangan *frontend* React).
*   **WebView2 Runtime**: Secara umum sudah tertanam (built-in) pada Windows 10/11 versi terbaru. Dibutuhkan oleh `pywebview` untuk me-render aplikasi *desktop*.
*   **Git**: Untuk operasi manajer Git bawaan yang ada di dalam alat VyloServe.

---

## 🛠️ 2. Cara Inisialisasi dan Menjalankan di Lokal (*Local Setup*)

Aplikasi ini dipisah menjadi dua bagian (*Backend* dan *Frontend*) yang harus dijalankan secara paralel saat fase *development*.

### A. Persiapan Frontend (React + Vite)
Buka terminal baru dan arahkan ke direktori proyek, lalu jalankan perintah berikut:
```bash
cd frontend
npm install
npm run dev
```
*Vite akan menjalankan frontend server di `http://localhost:5173`. Biarkan terminal ini tetap berjalan.*

### B. Persiapan Backend (Python)
Buka terminal kedua di akar (root) direktori proyek:
```bash
pip install -r requirements.txt
python main.py
```
*Pastikan variabel `IS_PRODUCTION = False` di dalam `main.py` agar aplikasi merujuk ke URL `http://localhost:5173` alih-alih mencoba mencari file kompilasi (`dist`).*

---

## 📂 3. Struktur Direktori Proyek (*Directory Tree*)

Di bawah ini adalah struktur direktori lengkap dan bersih (tanpa *folder caching* atau `node_modules`):

```text
vyloserve/
├── .gitignore                      # Aturan pengecualian file/folder untuk Git
├── LICENSE                         # Lisensi proyek (MIT License)
├── README.md                       # Dokumentasi singkat di repo Git
├── main.py                         # Entry point (file utama) Python & inisialisasi PyWebView
├── main.spec                       # File konfigurasi build PyInstaller (untuk kompilasi ke .exe)
├── package-lock.json               # Lockfile untuk dependensi NPM eksternal (root)
├── requirements.txt                # Daftar dependensi library Python
│
├── bin/                            # (Direktori) Tempat binary/executable (Apache, PHP, Node) di-install
├── data/                           # (Direktori) Penyimpanan state JSON, preferensi, dan konfigurasi persisten
├── www/                            # (Direktori) Root folder web default untuk localhost & virtual hosts
│
├── core/                           # 🧠 BACKEND (Python) - Logika sistem & operasi OS
│   ├── api.py                      # Bridge API utama penghubung fungsi Python ke Frontend (React)
│   ├── services/                   # Pengendali modul (Business Logic)
│   │   ├── apache.py               # Logika manajemen server Apache & Virtual Host
│   │   ├── dashboard.py            # Logika polling data dashboard (CPU, Memori, Status OS)
│   │   ├── database.py             # Logika manajemen service MariaDB/MySQL
│   │   ├── git_manager.py          # Logika manajemen operasi Git lokal
│   │   ├── php.py                  # Logika manipulasi PHP FastCGI & konfigurasi php.ini
│   │   ├── project.py              # Logika pembuatan scaffolding proyek baru
│   │   ├── runtimes_manager.py     # Logika instalasi Runtime tambahan (Node, Python, dll)
│   │   └── ssl_manager.py          # Logika generasi otomatis local SSL Certificate
│   └── utils/                      # Helper & Utilities sistem
│       ├── file_utils.py           # Utilitas manipulasi path dan file lokal
│       └── system_utils.py         # Utilitas OS (registry, shortcut, deteksi arsitektur OS)
│
└── frontend/                       # 🎨 FRONTEND (React + Vite + TypeScript) - Antarmuka Aplikasi
    ├── index.html                  # Titik masuk HTML untuk React app
    ├── package.json                # Daftar dependensi React & konfigurasi npm scripts
    ├── vite.config.ts              # Konfigurasi bundler Vite
    ├── tsconfig.*.json             # Konfigurasi transpiler TypeScript (App, Node)
    │
    ├── public/                     # Aset publik statis (Favicon & SVG global)
    │   └── ...
    │
    └── src/                        # Kode sumber (Source Code) React
        ├── main.tsx                # Entry point utama React & Provider DOM
        ├── App.tsx                 # Root Component (Router & Layout Container Utama)
        ├── App.css, index.css      # Styling dasar React & Tailwind
        │
        ├── assets/                 # Aset gambar, ikon, dan logo branding internal aplikasi
        │
        ├── components/             # Reusable UI Components (Komponen blok pembangun antarmuka)
        │   ├── AppInterceptor.tsx  # Memblokir interaksi ala browser (klik kanan, reload)
        │   ├── Sidebar.tsx         # Komponen menu navigasi di sisi kiri layar
        │   ├── Modal.tsx           # Kerangka dasar Pop-up modal
        │   ├── LogsPanel.tsx       # UI panel interaktif pembacaan log server
        │   └── ... 
        │
        └── menu/                   # Tampilan Utama Berdasarkan Halaman (Views / Pages)
            ├── dashboard/          # Halaman Dashboard Inti
            ├── apache/             # Halaman manajemen Apache & Virtual Host
            ├── php/                # Halaman manajemen PHP (Multi-Version)
            ├── database/           # Halaman manajemen MariaDB/MySQL
            ├── runtimes/           # Halaman manajemen penginstalan bahasa pemrograman
            └── tools/              # Alat-alat bantu (Developer Tools spt: Encode, Git, QR)
```

---

## ⚙️ 4. Penggunaan Fitur & Proses di Sisi Kode

Aplikasi ini menggunakan teknologi **jembatan antarproses (bridge)** melalui PyWebView. Semua interaksi pengguna yang membutuhkan eksekusi sistem operasi akan dilempar dari *Frontend* (React) ke *Backend* (Python via `core/api.py`).

### 🌳 Alur Kerja Sistem (System Workflow Tree)

```text
[Interaksi Pengguna (React UI)] 
       │
       ├─> (Pemanggilan Fungsi JavaScript: window.pywebview.api.fungsi_x())
       │
       ▼
[Jembatan PyWebView / core/api.py] ──> Menerima request & meneruskan ke Service Module
       │
       ├──> [Modul Apache (services/apache.py)] 
       │      ├─> Baca/Tulis file httpd.conf
       │      ├─> Tambahkan routing 127.0.0.1 ke file C:\Windows\System32\drivers\etc\hosts
       │      └─> Restart Apache via shell command
       │
       ├──> [Modul PHP (services/php.py)]
       │      ├─> Temukan port FastCGI yang kosong (misal: 9001)
       │      ├─> Tulis ulang php.ini untuk ekstensi
       │      └─> Binding PHP ke Virtual Host Apache via ProxyPass
       │
       ├──> [Modul Database (services/database.py)]
       │      ├─> Setup path MariaDB/MySQL
       │      ├─> Ganti password root via command line (mysqladmin)
       │      └─> Start/Stop service mysqld
       │
       ├──> [Modul Runtimes (services/runtimes_manager.py)]
       │      └─> Download file & eksekusi installer silent (Node.js, Go, Python)
       │
       └──> [Modul OS & Dashboard (services/dashboard.py)]
              └─> Looping polling CPU/Memori via psutil ──> Kirim JSON balik ke React
```

### 📋 Rincian Fungsionalitas Modul

#### A. Smart Dashboard (Pemantauan Sistem)
- **Fungsi**: Memantau kesehatan sistem PC (CPU, RAM) dan status dari servis yang berjalan (Apache, PHP, Database).
- **Di Balik Layar**: *Backend* Python (`core/services/dashboard.py`) berjalan menggunakan `psutil` dalam metode asinkron/looping untuk mengirimkan pembaruan data per sekian milidetik. *Frontend* React menangkap data tersebut dan merendernya dalam grafik SVG tanpa membebani memori UI utama.

#### B. Manajemen Apache & Virtual Host
- **Fungsi**: Memfasilitasi pengguna untuk mendaftarkan domain lokal (misal: `proyekku.test`), mengatur root direktori, dan mengganti versi Apache.
- **Di Balik Layar**: 
  1. *Frontend* mengirim parameter (*domain path*, direktori lokal) ke API Python.
  2. *Backend* (`core/services/apache.py`) menginjeksikan blok `<VirtualHost>` baru di dalam file konfigurasi Apache (`httpd.conf` atau direktori *vhosts*).
  3. Menggunakan hak akses administrator (*elevated privileges*), Python memodifikasi file `hosts` bawaan Windows untuk mengalihkan rute domain lokal ke `127.0.0.1`.
  4. Aplikasi merestart proses biner Apache (mengeksekusi `httpd.exe`) agar perubahan dapat dibaca.

#### C. Manajemen Multi-Versi PHP (FastCGI)
- **Fungsi**: Kemampuan menjalankan proyek yang berbeda dengan versi PHP yang berbeda secara simultan (misal: Proyek A pakai PHP 7.4, Proyek B pakai PHP 8.2).
- **Di Balik Layar**:
  1. *Backend* mengeksekusi versi PHP yang dipilih sebagai proses FastCGI (menggunakan `php-cgi.exe`).
  2. Modul (`core/services/php.py`) memberikan masing-masing versi *port* unik, seperti `9000` untuk PHP 8.2 dan `9001` untuk PHP 7.4, agar tidak saling tabrak.
  3. Di dalam konfigurasi Virtual Host Apache, fungsi proxy diaktifkan (`ProxyPassMatch`) untuk mengarahkan trafik skrip `.php` ke *port* FastCGI yang bersangkutan secara otomatis.

#### D. Manajemen Database (MariaDB/MySQL)
- **Fungsi**: Modul untuk menyalakan atau mematikan layanan basis data dan fitur manajemen instalasi (termasuk mengganti password `root`).
- **Di Balik Layar**: *Backend* berinteraksi langsung dengan *binary* MySQL (`mysqld.exe`). Untuk fitur penggantian password `root`, Python mengeksekusi perintah otentikasi CLI bawaan `mysqladmin` secara di belakang layar (*silent command execution*).

#### E. Pengelola Runtime Lingkungan
- **Fungsi**: Memudahkan developer untuk menginstal *environment* lain secara terpusat (Python, Node.js, Java, Go).
- **Di Balik Layar**: Python mengeksekusi *downloader* (via `requests`) dan menjalankan instalasi instalator sistem atau menguraikan *zip/tar* ke folder `./bin/runtimes/` di dalam struktur aplikasi. 

#### F. Developer Tools (Alat Bantu Developer)
- **Fungsi**: Menawarkan kemudahan *in-app* seperti *Encode/Decode Base64/URL*, Pembuat QR Code, dan Manajemen Repositori Git.
- **Di Balik Layar**: Proses *encode/decode* dan manipulasi teks ringan ditangani di sisi *Frontend* (JavaScript) untuk performa maksimum instan. Sedangkan fungsionalitas Git dikomunikasikan ke modul `core/services/git_manager.py` yang mengeksekusi binari `git.exe` secara interaktif.

#### G. Manajemen Siklus Hidup (System Tray & Latar Belakang)
- **Fungsi**: Aplikasi dapat diminimalkan menjadi *background worker* tanpa membuat server mati.
- **Di Balik Layar**: Saat pengguna menekan "Close / X" di OS Windows, *listener* pada `main.py` akan menghadang proses terminasi (`window.events.closing`). Jika dalam mode *Production*, aplikasi menggunakan *library* `pystray` untuk sekadar menyembunyikan antarmuka UI (`window.hide()`), namun membiarkan servis Python dan Apache terus menyala dan muncul sebagai ikon kecil di Taskbar Windows (System Tray).

---

## 💡 5. Petunjuk Pengembangan (*Development Hints*)

Berikut adalah tips dan trik yang berguna ketika mengembangkan fitur baru pada VyloServe:

1. **Flag IS_PRODUCTION**
   - Di dalam `main.py`, terdapat variabel `IS_PRODUCTION`.
   - **Set `False`** saat mode pengembangan (*development*). Mode ini mematikan System Tray (memudahkan penutupan instan aplikasi) dan memaksa *WebView* membaca URL dari `http://localhost:5173`.
   - **Set `True`** ketika ingin mengemas (*build*) aplikasi menjadi bentuk `.exe`. Mode ini mengaktifkan System Tray, mencegah "X" menutup aplikasi sepenuhnya, dan mengarah ke file di dalam `/frontend/dist`.

2. **Gunakan Developer Tools (Inspect Element)**
   - Saat `IS_PRODUCTION = False`, `pywebview` akan mengizinkan pembukaan Developer Tools Chromium. Anda dapat menggunakannya sama seperti Anda melakukan *debug* di Google Chrome biasa (berguna untuk melihat *error* React atau melihat respons panggilan API).

3. **Membangun Rilis Produksi (Build to EXE)**
   - Jika *Frontend* sudah selesai dikembangkan, jalankan:
     ```bash
     cd frontend
     npm run build
     ```
   - Lalu, kompilasi *Backend* Python beserta *build* React menjadi satu file biner yang berdiri sendiri menggunakan `PyInstaller`:
     ```bash
     pyinstaller main.spec
     ```
   - Hasil (file `.exe`) akan muncul di dalam direktori `dist/`.

4. **Koneksi `window.pywebview`**
   - Komunikasi React ke Python bertumpu pada `window.pywebview.api`. Pastikan tipe data yang dikirim dan diterima (seperti Dictionary Python ke JSON Object JavaScript) berstruktur rapi agar tidak terjadi galat *(error parsing)*.

5. **Modifikasi Native UX**
   - File `src/components/AppInterceptor.tsx` adalah kunci UI yang terasa *native*. Jika Anda butuh fitur klik kanan di area tertentu, Anda harus membuat pendaftaran dan pengecualian logika di komponen tersebut.
