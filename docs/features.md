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
Mengelola instalasi engine pemrograman pihak ketiga dengan arsitektur multi-versi simultan dan kontrol orkestrasi PATH terpusat (**`RuntimePathHub`**).
- **Multi-Version Concurrency:** Mendukung pengunduhan, pemasangan, dan penyimpanan beberapa versi sekaligus secara mandiri untuk masing-masing engine (Node.js, Python, Java, Go).
- **Centralized `RuntimePathHub`:** Panel orkestrasi di atas inventori versi yang menyediakan:
  - Toggle tunggal pendaftaran Windows System PATH (`HKCU\Environment\Path`) per engine.
  - Dropdown pemilih versi aktif sistem (*1-click active version switcher*).
  - Peringatan kontekstual terintegrasi di dalam kartu (*in-card contextual alert*, `data-testid="path-hub-external-alert"`) bila biner native OS terdeteksi di luar VyloServe — mengunci toggle PATH untuk mencegah benturan prioritas binary (*path shadowing*).
- **Tata Letak Kartu Simetris (100% Symmetric Cards):** Setiap kartu versi terpasang memiliki geometri identik dengan dua aksi utama standar (*Open Folder* dan *Open in Terminal*) serta menu dropdown burger untuk aksi sekunder (*Set as Active*, *Deactivate*, *Update*, *Uninstall*). Mendukung pula mode **Table View** berdensitas tinggi via `<DataTable>`.
- **Node.js:** Mendukung pengunduhan *Zip Portable* dari peladen resmi Node.js. Mendukung aktivasi otomatis untuk *Corepack* (Yarn & pnpm).
- **Python:** Mengunduh modul Embeddable Python resmi, dilengkapi dengan injeksi instalasi *pip* otomatis (`get-pip.py`).
- **Java (JDK):** Mengunduh OpenJDK siap pakai dari repositori resmi Adoptium (Eclipse Temurin).
- **Go:** Mengunduh arsip biner resmi `windows/amd64` dari peladen Google, dengan penanganan ekstraksi root folder otomatis ke direktori bin versi.

## 5. Projects Hub (Manajer Proyek Multi-Runtime)
Modul independen di navigasi utama untuk mengelola siklus hidup proyek web dan aplikasi multi-runtime secara terpadu:
- **Dukungan Multi-Runtime Scaffolding:**
  - **PHP:** Laravel, CodeIgniter 3, CodeIgniter 4, WordPress, dan Raw PHP (terintegrasi dengan Composer ter-embed).
  - **Node.js:** Next.js, React (Vite), dan Express.js (menggunakan npx/npm dari runtime aktif).
  - **Python:** FastAPI, Flask, dan Django (dengan dukungan virtual environment / venv opsional).
  - **Go:** Gin, Fiber, dan Standard HTTP server.
  - **Java:** Spring Boot starter web application.
- **Auto Virtual Host & Reverse Proxy:** Membuat konfigurasi Virtual Host Apache (`<VirtualHost>`) secara instan dengan domain `.local` (misal: `toko.local`), otomatis memetakan port reverse proxy dan websocket proxy (`ws://`) untuk proyek non-PHP ke dev server lokal masing-masing.
- **Auto Windows Hosts:** Melakukan injeksi domain lokal ke file `C:\Windows\System32\drivers\etc\hosts` secara aman dengan elevasi Administrator (UAC).
- **Dev Server Process Manager:** Menjalankan, memantau, dan menghentikan proses server pengembangan latar belakang (*dev server*) per proyek secara independen, lengkap dengan dialog live log streaming (`get_project_server_logs`).
- **Modal Terminal CLI Interaktif (`ProjectCliInstallModal`):** Menyediakan terminal berbasis `xterm.js` dengan streaming PTY dua arah saat instalasi framework meminta interaksi tanya-jawab CLI (seperti setup Next.js atau Vite) sehingga proses tidak pernah hang di latar belakang.
- **Tampilan Ganda (Card View & Table View):** Fleksibilitas visual dengan opsi kerapatan tabel (*compact*, *normal*, *relaxed*) dan filter chip runtime.

## 6. Git Version Control & Local SSL CA
- **Portable Git:** Menginstal Git secara *portable*, dilengkapi pengaturan identitas global (`git config --global user.name` dan `user.email`) langsung dari antarmuka.
- **Penyelarasan Status & Alert Native OS:** Kartu Git Core System menampilkan status badge adaptif (`Native OS`, `PATH Active`, `Isolated`) dan kotak alert kontekstual in-card (`data-testid="git-external-alert"`) bila Git native Windows terdeteksi, mengunci toggle registrasi PATH untuk menjaga integritas environment pengguna.
- **Local SSL CA:** Membuat Root Certificate Authority (CA) khusus untuk VyloServe (`VyloServeRootCA`) menggunakan OpenSSL (bawaan Apache), dan mendaftarkannya ke *Windows Trust Store* sehingga domain `.local` mendapatkan sertifikat HTTPS valid ("gembok hijau") di peramban web.

## 7. Multi-Language, 15 Tema & Single-Instance IPC
- **i18n Frontend-Driven:** Antarmuka mendukung multi-bahasa (Inggris dan Indonesia) secara simetris di seluruh komponen UI dan log sistem.
- **15 Pilihan Tema & Sinkronisasi DWM Native Titlebar:** Menyediakan 15 skema warna (VyloServe Dark/Light, Darcula, Solarized Dark/Light, High Contrast Dark/Light, Monokai, Dracula, Nord, Windows XP Luna Light, Windows XP Zune Dark, Catppuccin Mocha, Tokyo Night, dan Gruvbox Dark) dengan filter pencarian instan pada modal Settings. Palet tema otomatis disinkronkan ke caption dan text titlebar native Windows via API DWM (`DwmSetWindowAttribute`).
- **Dashboard Modular:** Menyimpan preferensi pengguna mengenai layanan mana saja yang perlu ditampilkan di *Home Dashboard*.
- **Satu Instance Aplikasi Terisolasi & Named Pipe IPC:** Membuka VyloServe saat sudah ada instance yang berjalan tidak akan membuka window baru, melainkan membawa jendela yang sedang aktif ke depan melalui **Windows Named Pipe IPC** (`\\.\pipe\VyloServe_IPC_v1` / `\\.\pipe\VyloServe_Dev_IPC_v1`) secara thread-safe tanpa tabrakan antara mode produksi dan development.

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
- **Tampilan Ganda (Card & Table View):** Fleksibilitas visual dengan opsi beralih antara Card View informatif dan Table View via `<ViewModeToggle>`, dilengkapi dropdown pemilih proyek yang dapat dicari (*searchable project selector*) dan indikator zero-state bila proyek tidak ditemukan.
- **Cloudflare Quick Tunnels:** Membuka tunnel publik instan (`*.trycloudflare.com`) tanpa memerlukan token akun atau login.
- **Aktivasi Akun Zrok:** Menghubungkan instalasi zrok lokal ke akun zrok pengguna lewat token environment (`zrok enable <token>`).
- **Share Project atau Target Kustom:** Membuka tunnel publik untuk salah satu project Apache yang sudah terdaftar (otomatis mengarah ke port Apache aktif), atau ke target kustom (`localhost:<port>`) untuk servis non-Apache (mis. dev server Node.js).
- **Auto-Alias ke Virtual Host:** Saat share sebuah project VyloServe aktif, URL publik zrok otomatis disisipkan sebagai `ServerAlias` di konfigurasi Virtual Host Apache project tersebut, dan dibersihkan kembali otomatis saat share dihentikan.
- **Manajemen Multi-Share:** Mendukung beberapa tunnel aktif bersamaan, masing-masing bisa dihentikan independen dari daftar "Active Shares". UI menggunakan subkomponen terisolasi `InstallTunnel.tsx` untuk kemudahan instalasi engine.

## 11. Developer Tools (Unified Utility Workspace)
Kumpulan utilitas pengembang modern dengan tata letak visual terpadu (12-column responsive layout, 7:5 split desktop, dan tab bar standar `<Tabs>`):
- **Markdown Documentation Viewer:** Penampil dokumentasi Markdown lokal interaktif dengan navigasi pohon berkas pintar:
  - *Folder Picker & Recent History:* Terintegrasi dengan OS Folder Picker dan riwayat folder terakhir (*Recent Folders*) di `localStorage` untuk pembukaan instan 1-klik.
  - *Tree Search/Filter:* Kotak pencarian instan pada `FolderTreeView` yang memfilter node berkas secara rekursif dan membuka folder yang relevan secara otomatis.
  - *Outline / Table of Contents (TOC):* Ekstraksi heading dinamis (`#`, `##`, `###`) menjadi daftar isi interaktif yang mendukung *smooth scrolling jump* ke jangkar judul.
  - *Reading Statistics & Global Theming:* Menampilkan penghitung jumlah kata (*word count*) dan estimasi durasi membaca (*reading time*), serta sinkronisasi otomatis dengan 15 sistem tema VyloServe melalui MutationObserver tanpa bentrok mode lokal.
  - *Keamanan Path Traversal:* Proteksi backend `_is_safe_path` dengan validasi `os.path.commonpath` untuk mencegah pembacaan berkas arbitrer di luar direktori root aktif.
- **Base64 Encode/Decode:** Utilitas konversi Base64 tangguh dengan penanganan UTF-8 penuh:
  - *Universal Dual-Input Area:* Antarmuka pengetikan teks serbaguna terintegrasi dengan zona unggah berkas kompak (`CompactFileDropzone`) tanpa perlu modal atau toggle terpisah. Pengguna dapat mengetik teks biasa maupun menyeret/memilih berkas langsung di mode Encode maupun Decode.
  - *URL-Safe RFC 4648:* Mode encoding aman URL (karakter `+` dan `/` diganti dengan `-` dan `_`, serta pembersihan/pemulihan padding otomatis).
  - *Line Wrapping:* Pilihan pemotongan baris tanpa wrap, standar MIME 64 karakter, atau 76 karakter langsung di toolbar kartu input.
  - *Binary File Download:* Mendukung decoding string Base64 langsung menjadi berkas biner dan menyimpannya ke disk melalui bridge desktop `save_base64_file` atau browser blob.
  - *Toolbar Aksi Cepat:* Tombol Sample, Paste, dan Clear terpadu untuk alur kerja cepat.
- **URL Encode/Decode:** Utilitas manipulasi URL dan query string interaktif:
  - *Encoding Scope:* Pemilih mode antara encoding komponen tunggal (`encodeURIComponent`) dan URI lengkap (`encodeURI`).
  - *Space Encoding:* Dukungan format spasi standar `%20` maupun format form/query `+`.
  - *Interactive Query Parameters Table:* Editor tabel parameter dua arah (two-way live binding) yang memungkinkan penambahan, pengeditan langsung kunci/nilai parameter, dan penghapusan parameter dengan sinkronisasi URL instan.
  - *Toolbar & Parsing Statistik:* Toolbar aksi cepat (Sample, Paste, Clear, Copy) dan pengurai bagian URI (skema, host, port, path, query, hash fragment).
- **Custom QR Generator:** Pembuat kode QR dinamis dengan kustomisasi visual tinggi:
  - *Simplified 3-Tab Structure (Hick's Law):* Penataan menu yang disederhanakan dari 6 tab terfragmentasi menjadi 3 kategori intuitif: **Teks / URL** (dengan deteksi otomatis awalan protokol URL), **Wi-Fi**, dan **Kontak & Pesan** (dengan pemilih sub-pill untuk format vCard 3.0, Email, dan SMS).
  - *Unified Appearance & Logo Card:* Menggabungkan pengaturan pola dot, bentuk sudut, koreksi error (ECC), margin, resolusi, serta penyisipan logo kustom (`CompactFileDropzone`) dalam satu kartu seimbang 2 kolom, mengeliminasi kelelahan scroll vertikal.
  - *Copy Image to Clipboard:* Kemampuan menyalin gambar PNG hasil render langsung ke papan klip sistem tanpa harus mengunduh berkas terlebih dahulu.
  - *Error Correction Level (ECC):* Pemilih tingkat koreksi error (`L` 7%, `M` 15%, `Q` 25%, `H` 30% - ideal untuk penyisipan logo).
  - *Visual Styling & Logo:* Kustomisasi pola dot (square, rounded, dots, classy), sudut, warna kustom, margin, resolusi piksel, dan penyisipan logo kustom dengan skala responsif.
  - *A11y Compliant:* Pemenuhan standar aksesibilitas 100% pada semua kontrol input melalui relasi `<FieldLabel htmlFor="...">` dan `<input id="...">`.

## 12. Histori Notifikasi & Notifikasi Native Windows
- **Ikon Lonceng Riwayat Toast:** Setiap notifikasi toast (sukses/error/peringatan/info) yang pernah muncul selama sesi aplikasi berjalan tercatat di panel riwayat, dibuka lewat ikon lonceng di footer Sidebar — bersampingan dengan tombol Settings saat sidebar diperluas, di atas indikator beban sistem (CPU) saat sidebar diciutkan. Badge menampilkan jumlah notifikasi belum dibaca (di-cap "9+"), otomatis ter-reset begitu panel dibuka.
- **Bersih per Sesi:** Riwayat HANYA mencakup notifikasi dari sesi aplikasi yang sedang berjalan (sejak terakhir dibuka) — tidak tersimpan permanen dan otomatis kosong lagi saat aplikasi di-restart. Pengguna juga bisa membersihkan riwayat kapan saja lewat tombol "Clear" di panel.
- **Notifikasi Native Windows:** Saat window VyloServe sedang di-*minimize*, tidak fokus, atau disembunyikan ke System Tray, toast yang muncul diteruskan juga sebagai notifikasi native Windows (Action Center) — supaya pengguna tetap tahu ada kejadian penting (instalasi gagal/selesai, dsb.) meski sedang tidak melihat aplikasi. Notifikasi native TIDAK muncul saat window sedang aktif dilihat, untuk menghindari gangguan ganda. Klik pada notifikasi native akan langsung membuka kembali (restore + focus) window VyloServe.
- **Dapat Dimatikan:** Modal "Settings" (tab General) menyediakan toggle "Desktop Notifications" (default aktif) untuk mematikan notifikasi native sepenuhnya tanpa mempengaruhi riwayat toast di dalam aplikasi.
- **System Tray Aktif di Mode Pengembangan:** Sejak fitur ini, System Tray (dan perilaku "sembunyi ke tray" saat tombol tutup ditekan) tidak lagi eksklusif untuk build production — aktif juga saat aplikasi dijalankan dari sumber (dev mode), memudahkan pengujian fitur tray/notifikasi tanpa perlu build `.exe` terlebih dahulu.

## 13. AI Server Assistant (Local & Cloud Copilot)
- **Dukungan Multi-Provider (Cloud & Offline Local):** Terintegrasi langsung dengan **Google Gemini** (Google AI Studio), **Groq Cloud** (inferensi LPU ultra-cepat), **OpenRouter** (ratusan model cloud & free-tier), serta **Ollama** untuk inferensi lokal 100% offline, privat, dan tanpa internet.
- **Dynamic Model Discovery & Empirical Tier Probing:** Penemuan daftar model otomatis dari endpoint provider (`v1beta/models` Gemini, `openai/v1/models` Groq, `/api/v1/models` OpenRouter, atau `/api/tags` Ollama). Aplikasi melakukan *empirical probing* untuk mendeteksi status akun (*Free Tier* vs *Pro / Pay-As-You-Go*) dan limit kuota HTTP 429 secara langsung, lalu menyaring daftar model agar selalu kompatibel dengan tier akun pengguna.
- **Pemantauan Penggunaan Token & Kuota (Daily & Weekly Usage Tracker):** Mencatat pemakaian token (`prompt`, `completion`, `total`) dan jumlah request secara otomatis ke `data/ai_usage.json`. Menyediakan lencana indikator penggunaan di header chat dengan popover rincian kuota **Hari Ini** dan **7 Hari Terakhir** beserta persentase bar terhadap batas *Free Tier* masing-masing provider.
- **Rekomendasi Pertanyaan Lanjutan Kontekstual (Follow-up Suggestion Chips):** Di akhir setiap respons, AI secara cerdas menyarankan 2–3 pertanyaan atau langkah diagnostik lanjutan yang relevan dalam bentuk tombol chip satu-klik tepat di atas kolom input pesan.
- **Smart System Context & Diagnostic Injection:** Setiap prompt pengguna secara otomatis diperkaya dengan status kesehatan dan topologi server lokal real-time: status aktif/port Apache, versi aktif PHP, status & port database (MariaDB & PostgreSQL), status modul Runtimes (Node.js, Python, Java, Go) beserta status registrasi PATH-nya, status Git portable vs PATH native, daftar Public Tunnels yang sedang aktif berbagi port/project, serta error log sistem terkini.
- **Retrieval-Augmented Generation (RAG) via `DocRetriever`:** Backend mengurai dan mengindeks file dokumentasi panduan pengguna (`docs/user_guide.md`) ke dalam struktur memori secara otomatis. Sistem mencocokkan kata kunci kueri pengguna dengan tag, nama modul, judul, dan isi seksi menggunakan algoritma pembobotan relevansi frekuensi kata (BM25-lite) untuk menyuntikkan konteks dokumentasi resmi ke LLM. UI menampilkan kartu akordeon sumber dokumentasi (*Sources References*) yang dapat diperluas untuk transparansi jawaban.
- **Human-In-The-Loop (HITL) Service Control:** AI mampu mengenali niat operasional server pengguna (seperti *"hidupkan apache dan database"*, *"restart web server"*, atau *"stop php"*). Alih-alih mengeksekusi perintah secara diam-diam, AI merespons dengan kartu proposal aksi terstruktur (*Action Proposal Card*). Pengguna memegang kendali penuh untuk meninjau dan menekan tombol **"Confirm & Execute"**.
- **Dual-Layer Action State Persistence:** Status tombol aksi (`idle` -> `executing` -> `executed` / `failed`) diamankan secara berlapis: status in-memory disinkronkan ke state frontend, dan sekaligus ditulis langsung ke disk (`data/ai_action_states.json`). Saat pengguna berpindah menu navigasi, menutup widget bubble, atau bahkan me-restart aplikasi VyloServe, riwayat kartu aksi tetap mengingat status eksekusinya dan mencegah eksekusi ganda yang tidak disengaja.
- **Dual Interface Modes & Isolated Input Performance:** Pengguna dapat berinteraksi melalui halaman utama terdedikasi (*AI Assistant Page*) atau melalui tombol gelembung melayang (*Floating Chat Bubble*) yang persisten di pojok kanan bawah seluruh menu. Kolom input pesan (`AiChatInput`) terisolasi dari state daftar pesan yang di-memoize (`AiChatMessage`), menjamin pengetikan bebas lag dan layout anti-lompat selama streaming berlangsung.
- **Real-Time SSE Streaming:** Streaming token respons asinkron menggunakan Server-Sent Events (SSE) di background thread Python (`vylo_ai_chunk`), memberikan efek pengetikan halus dengan latensi minimal dan penanganan kesalahan terperinci untuk kuota habis (HTTP 429), kunci tidak valid (HTTP 401), atau server lokal Ollama mati.

## 14. Developer Terminal (Multi-Tab & Environment Scoping)
Terminal terintegrasi di dalam aplikasi desktop yang dirancang khusus untuk kenyamanan alur kerja pengembangan web lokal:
- **Arsitektur Multi-Tab Berbasis `xterm.js`:** Menjalankan beberapa sesi terminal secara independen dalam tab-tab terisolasi, lengkap dengan shortcut keyboard penambahan tab baru (`+`), penutupan tab, dan pembersihan buffer konsol (*clear*).
- **Dukungan Ragam Shell:** Mendukung shell bawaan Windows PowerShell, Command Prompt (CMD), Git Bash (termasuk deteksi instalasi PortableGit internal), serta opsi shell kustom yang dapat diatur sebagai profil default.
- **Environment Scoping & Saved Presets:** Memungkinkan pembukaan sesi terminal yang disuntikkan (*scoped environment*) direktori bin dari versi tertentu (PHP, Node.js, Python, Java, Go, atau Git) ke variabel PATH sesi terminal tersebut secara instan tanpa memodifikasi registry Windows PATH sistem. Konfigurasi scoping ini dapat disimpan sebagai Preset tersimpan (*Saved Presets*) untuk digunakan kembali dengan 1-klik.
- **Pelacakan CWD Real-Time:** Memantau direktori kerja aktif (*Current Working Directory*) sesi terminal di latar belakang, memungkinkan penamaan tab yang dinamis dan penyelarasan konteks direktori secara otomatis.
- **Kustomisasi Tampilan & Perilaku:** Dialog pengaturan terminal (`TerminalSettingsModal`) menyediakan konfigurasi font family, ukuran font, gaya kursor (*block*, *underline*, *bar*), kedipan kursor (*cursor blink*), ukuran buffer scrollback, dan opsi salin otomatis saat seleksi teks (*copy on select*).
- **Integrasi Pintasan Lintas-Modul:** Tombol "Open in Terminal" dari modul Projects Hub, Runtimes, dan Apache secara cerdas mengarahkan pengguna ke Developer Terminal dan langsung membuka sesi di direktori proyek atau runtime yang bersangkutan.

