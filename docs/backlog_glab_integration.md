# Backlog & Dokumentasi Implementasi Integrasi GitLab CLI (`glab`) untuk AI Assistant

> **STATUS: IMPLEMENTED (SELESAI & PRODUCTION READY)**  
> Fitur integrasi GitLab CLI (`glab`) telah diimplementasikan secara penuh pada modul Git & AI Assistant VyloServe, mencakup manajemen biner portable, multi-host PAT/SSH, VPN probing circuit breaker, kartu aksi AI Human-in-the-Loop, dan test suite komprehensif.

Dokumen ini disusun sebagai spesifikasi teknis dan catatan implementasi resmi (*Authoritative Implementation Reference*) untuk integrasi **GitLab CLI (`glab`)** ke dalam ekosistem **VyloServe**. Integrasi ini bertujuan untuk memberikan kemampuan bagi **AI Assistant** di VyloServe agar dapat berinteraksi langsung dengan repositori GitLab lokal maupun remote, membaca konteks issue/merge request, dan melakukan posting komentar atau pembuatan issue secara terverifikasi (*Human-in-the-Loop*).

---

## 1. Latar Belakang & Nilai Manfaat (Business & Technical Value)

Selama proses pengembangan aplikasi, developer sering kali berpindah antara editor kode, server dashboard lokal (VyloServe), dan antarmuka web GitLab untuk:
1. Membaca deskripsi bug/issue yang dilaporkan oleh QA atau pengguna.
2. Meminta bantuan AI untuk menganalisis akar masalah bug tersebut berdasarkan log server lokal.
3. Menuliskan kembali hasil analisis, solusi perbaikan, atau nomor commit ke komentar issue di GitLab.

Dengan mengintegrasikan **GitLab CLI (`glab`)** secara native di backend Python VyloServe:
- **Zero-Context Switching:** Developer dapat menyelesaikan alur kerja perbaikan bug langsung dari antarmuka VyloServe.
- **AI-Powered Collaboration:** AI Assistant dapat mengambil data issue (`glab issue view`), menganalisis log/kode lokal, menyusun draf komentar teknis, dan mengirimkannya ke GitLab issue/MR setelah disetujui developer melalui kartu konfirmasi 1-klik.
- **Multi-Platform & Portable:** Biner `glab` dikelola secara mandiri (*portable*) di folder `bin/glab/` pada Windows dan Linux, serta mendukung deteksi biner eksternal yang sudah terpasang di sistem operasi.
- **Dukungan GitLab.com & Self-Hosted:** Fleksibel untuk GitLab Cloud resmi maupun instans privat GitLab Community/Enterprise Edition di jaringan lokal kantor.

---

## 2. Framework Analisis Multi-Dimensi (`AGENTS.md` Rule 35)

Setiap item backlog pada integrasi ini wajib mematuhi 4 pilar arsitektur VyloServe:

```mermaid
flowchart TD
    subgraph MultiDimensionalFramework["Framework Analisis Multi-Dimensi (AGENTS.md)"]
        HCI["1. UI/UX & Ergonomi Desktop HCI<br/>- Status integrasi visual (Versi, PATH, Auth)<br/>- Action Card interaktif di chat AI<br/>- One-Click installer dengan progress bar<br/>- Preview Markdown komentar sebelum kirim"]
        Heuristics["2. Usability & Heuristik (Nielsen)<br/>- Human-in-the-Loop (Tanpa submit otomatis)<br/>- Error Prevention (Validasi PAT & remote URL)<br/>- Flexibility (GitLab.com vs Self-Hosted)<br/>- Graceful Recovery & i18n Translation Keys"]
        Security["3. Defensive Security Engineering<br/>- Anti-Command Injection (subprocess list)<br/>- Proteksi Token (Penyimpanan data/ terisolasi)<br/>- Pencegahan Process Snooping (Token via env/stdin)<br/>- Izin file 0600 di Linux"]
        CleanCode["4. Clean Code, DRY & Testing<br/>- Service terdedikasi (GitLabManager di core/services/)<br/>- Wrapper _log & _progress patuh kontrak i18n<br/>- Pytest komprehensif dengan mock OS/subprocess<br/>- Paritas i18n 100% (en & id)"]
    end
```

---

## 3. Arsitektur Teknis Sistem

### 3.1 Diagram Interaksi Komponen

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (User)
    participant UI as React Frontend (AiChat & Settings)
    participant API as Python API Router (core/api.py)
    participant GLM as GitLabManager (core/services/gitlab_manager.py)
    participant GLAB as GitLab CLI Binary (bin/glab/glab)
    participant GLServer as GitLab Server (GitLab.com / Self-Hosted)

    Note over Dev,UI: Skenario: AI Assistant merekomendasikan solusi & posting komentar
    Dev->>UI: "Analisis log error ini dan beri update ke GitLab Issue #42"
    UI->>API: chat_with_ai(message, history)
    API->>GLM: get_issue_context("42")
    GLM->>GLAB: glab issue view 42 --json
    GLAB->>GLServer: API Request (Auth: GITLAB_TOKEN)
    GLServer-->>GLAB: Return Issue Data
    GLAB-->>GLM: JSON stdout
    GLM-->>API: Issue Details & Comments
    API-->>UI: AI Response + Action Card (vylo_action: comment_issue)
    
    Note over Dev,UI: Human-in-the-Loop Safeguard
    UI->>Dev: Render kartu konfirmasi dengan draf komentar Markdown
    Dev->>UI: Klik tombol "Kirim Komentar ke Issue #42"
    UI->>API: execute_gitlab_action("comment_issue", repo, "42", comment_text)
    API->>GLM: comment_issue(repo, "42", comment_text)
    GLM->>GLAB: glab issue note 42 -m "..." -R repo (Token via env)
    GLAB->>GLServer: POST /projects/:id/issues/42/notes
    GLServer-->>GLAB: Success (HTTP 201)
    GLAB-->>GLM: Note created
    GLM-->>API: Status Success + Web URL
    API-->>UI: Toast Notification & Updated Action Card (Completed)
```

### 3.2 Struktur File & Direktori Baru
```text
vyloserve/
├── bin/
│   └── glab/                     # Lokasi biner portable (diabaikan git)
│       ├── glab.exe              # Windows binary
│       └── glab                  # Linux binary (chmod +x)
├── data/
│   └── gitlab.json               # Konfigurasi host, user, dan token terisolasi (chmod 0600 di Linux)
├── core/
│   ├── api.py                    # Registrasi route API glab_* ke frontend
│   └── services/
│       ├── gitlab_manager.py     # Layanan utama siklus hidup & operasi GitLab CLI
│       └── ai_assistant.py       # Penambahan skema vylo_action 'gitlab' & retrieval context
├── frontend/src/
│   ├── components/
│   │   └── ai/
│   │       └── GitLabActionCard.tsx # Kartu konfirmasi interaktif di chat AI
│   ├── menu/
│   │   └── git/
│   │       └── GitLabIntegrationTab.tsx # UI status glab, installer, & form login PAT
│   └── locales/
│       ├── en/translation.json   # Kunci terjemahan bahasa Inggris
│       └── id/translation.json   # Kunci terjemahan bahasa Indonesia
└── tests/
    └── test_services/
        └── test_gitlab_manager.py # Suite unit test Python untuk GitLabManager
```

---

## 4. Rincian Daftar Backlog Fitur (Epics & Tasks)

### 🌟 EPIC 1: Pengelolaan Siklus Hidup Biner `glab` (Lifecycle & Binary Management)

Modul ini bertanggung jawab untuk mendeteksi, mengunduh, mengekstrak, dan memperbarui biner resmi GitLab CLI lintas-platform.

#### 📋 Task 1.1: Deteksi Biner Multi-Platform & Status Check
- **Deskripsi:** Mendeteksi apakah `glab` tersedia di VyloServe (`bin/glab/`) atau di system PATH (`where glab` di Windows, `which glab` di Linux).
- **Spesifikasi:**
  - Fungsi: `GitLabManager.get_glab_status() -> dict`
  - Mengembalikan informasi:
    ```json
    {
      "installed": true,
      "version": "1.45.0",
      "path": "D:/Projects/Python/vyloserve/bin/glab/glab.exe",
      "is_external": false,
      "authenticated": true,
      "host": "gitlab.com",
      "username": "developer_username"
    }
    ```
  - Defensive execution: Jalankan perintah `--version` menggunakan `run_silent_command` tanpa jendela terminal pop-up.

#### 📋 Task 1.2: One-Click Downloader & Installer dari Rilis Resmi GitLab
- **Deskripsi:** Mengunduh biner `glab` versi stabil terbaru langsung dari rilis resmi GitLab CLI.
- **Spesifikasi:**
  - Endpoint metadata rilis: `https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases`.
  - Target aset otomatis berdasarkan platform:
    - **Windows (x64):** `glab_{version}_windows_x86_64.zip`
    - **Linux (x64):** `glab_{version}_linux_x86_64.tar.gz`
  - Menggunakan helper `download_advanced` di `core/utils/file_utils.py` dengan kalkulasi persentase `emit_progress(pct, "backend.gitlab.downloading")`.
  - Ekstraksi biner ke direktori `bin/glab/` menggunakan `extract_archive`.
  - **Linux Specific:** Otomatis memberikan hak eksekusi `os.chmod(glab_path, 0o755)`.
  - **Cancellation Support:** Terdaftar ke `InstallationManager` sehingga unduhan dapat dibatalkan sewaktu-waktu oleh pengguna tanpa file korup.

#### 📋 Task 1.3: Uninstall & Cleanup Biner
- **Deskripsi:** Fitur untuk menghapus biner lokal `bin/glab/` tanpa merusak konfigurasi token atau menyentuh biner eksternal sistem.

---

### 🔐 EPIC 2: Autentikasi & Manajemen Kredensial Multi-Host

Mengatur sesi autentikasi pengguna secara aman, baik untuk GitLab.com maupun instans Self-Hosted GitLab.

#### 📋 Task 2.1: Penyimpanan Kredensial Terenkripsi/Terisolasi (`data/gitlab.json`)
- **Deskripsi:** Menyimpan informasi host dan token Personal Access Token (PAT) di file `data/gitlab.json`.
- **Standar Keamanan:**
  - File `data/gitlab.json` wajib masuk `.gitignore`.
  - Di Linux, hak akses file wajib diatur `0600` (`chmod 600`) agar hanya user aktif yang dapat membaca isi file.
  - Skema data:
    ```json
    {
      "default_host": "gitlab.com",
      "instances": {
        "gitlab.com": {
          "token": "glpat-xxxxxxxxxxxxxxxxxxxx",
          "username": "developer",
          "auth_type": "pat",
          "updated_at": 1730900000
        }
      }
    }
    ```

#### 📋 Task 2.2: Autentikasi Aman Tanpa Process Snooping
- **Deskripsi:** Menghubungkan sesi `glab` dengan akun pengguna.
- **Standar Keamanan (Defensive Security):**
  - **DILARANG** mengoper token lewat argumen baris perintah (`--token glpat-...`) karena token dapat dibaca oleh proses lain melalui `ps aux` atau Process Explorer di sistem multi-user.
  - **WAJIB** menyuplai token melalui Environment Variable terisolasi pada child process:
    ```python
    env = os.environ.copy()
    env["GITLAB_TOKEN"] = token
    env["GITLAB_HOST"] = host
    subprocess.run([glab_bin, "auth", "status", "--hostname", host], env=env, ...)
    ```
  - Menyediakan verifikasi status auth via `glab auth status`.

#### 📋 Task 2.3: Support Self-Hosted GitLab Instance
- **Deskripsi:** Memungkinkan pengguna memasukkan custom hostname/URL (contoh: `gitlab.perusahaan.co.id`) serta custom port jika instans internal berjalan di port non-standar.

---

### 🤖 EPIC 3: Integrasi AI Assistant (Action Engine & Context Retriever)

Inti fitur yang memungkinkan bot AI membaca konteks issue/MR dan mem-posting komentar dengan persetujuan developer.

#### 📋 Task 3.1: Deteksi Repositori GitLab Aktif dari Proyek Lokal
- **Deskripsi:** AI Assistant memeriksa direktori proyek aktif untuk mendeteksi apakah remote origin mengarah ke GitLab.
- **Implementasi:**
  - Eksekusi `git remote get-url origin` di root proyek.
  - Parse regex untuk remote HTTPS (`https://gitlab.com/owner/repo.git`) maupun SSH (`git@gitlab.com:owner/repo.git`).
  - Menghasilkan namespace proyek: `owner/repo` dan host target.

#### 📋 Task 3.2: Retrieval Konteks Issue & MR untuk AI (`DocRetriever` Extension)
- **Deskripsi:** Saat developer berdiskusi dengan AI ("Bagaimana status issue #12?"), AI dapat membaca detail issue untuk dimasukkan ke konteks percakapan.
- **Implementasi:**
  - Backend memanggil `glab issue view <id> -R <repo>` atau `glab mr view <id> -R <repo>`.
  - Mengambil judul, deskripsi, label, dan 5 komentar diskusi terakhir untuk disuntikkan ke prompt konteks AI Assistant.

#### 📋 Task 3.3: Perluasan Skema `vylo_action` untuk GitLab di `ai_assistant.py`
- **Deskripsi:** Memperbarui `DEFAULT_SYSTEM_INSTRUCTION` agar AI mengenali blok aksi `gitlab`.
- **Format JSON Action:**
  ```json
  ```vylo_action
  {
    "service": "gitlab",
    "action": "comment_issue" | "comment_mr" | "create_issue",
    "target": "42",
    "params": {
      "repo": "organization/project-name",
      "comment": "Hasil analisis: error disebabkan oleh race condition pada koneksi database. Perbaikan telah diimplementasikan pada commit abc1234."
    },
    "label": "Kirim Komentar ke Issue #42"
  }
  ```
  ```

#### 📋 Task 3.4: Komponen UI `GitLabActionCard` (Human-in-the-Loop)
- **Deskripsi:** Frontend me-render kartu interaktif pada pesan chat AI yang berisi:
  - Header kartu: Ikon GitLab, nomor issue target, dan nama repositori.
  - Textarea / Preview Markdown: Menampilkan isi komentar yang disusun oleh AI, dengan tombol opsi "Edit Komentar" sebelum dikirim.
  - Tombol aksi utama: **"Kirim Komentar"** (memanggil backend) dan tombol **"Batal"**.
  - Status feedback: Berubah menjadi badge hijau "Terkirim" beserta link langsung ke komentar di GitLab web browser setelah sukses.

#### 📋 Task 3.5: Eksekutor Backend Aman untuk Aksi GitLab
- **Deskripsi:** `GitLabManager.execute_action(service, action, target, params)`
  - Menjalankan perintah posting komentar:
    `glab issue note <target> -R <repo> -m <comment>`
    atau
    `glab mr note <target> -R <repo> -m <comment>`
  - Mencegah *Command Injection* dengan meneruskan komentar sebagai argumen list utuh, bukan lewat string concatanation atau shell.

---

### 🎨 EPIC 4: Antarmuka Pengguna & Integrasi Multi-Bahasa (Frontend & i18n)

Menghadirkan antarmuka pengelolaan integrasi GitLab yang intuitif dan serasi dengan 15 tema VyloServe.

#### 📋 Task 4.1: Tab Integrasi GitLab di Modul Git atau Settings
- **Deskripsi:** Halaman/tab untuk mengelola GitLab:
  - Status kartu biner `glab` (terpasang, versi, lokasi biner, tombol unduh/perbarui).
  - Status koneksi akun (Avatar/Username, Host URL, status token, tombol Re-Auth / Logout).
  - Form dialog login PAT: Input Host, Personal Access Token, dan panduan scope yang dibutuhkan (`api`, `read_user`, `write_repository`).
  - Widget daftar 5 issue terbuka terbaru pada repo aktif dengan tombol filter.

#### 📋 Task 4.2: Paritas Kunci Terjemahan (i18n Parity `en` & `id`)
- **Deskripsi:** Seluruh teks UI, log real-time, progress bar, dan pesan error backend wajib menggunakan translation keys dan terdaftar di kedua file:
  - `frontend/src/locales/en/translation.json`
  - `frontend/src/locales/id/translation.json`
- **Katalog Kunci Baru (Contoh):**
  - `backend.gitlab.downloading`: "Mengunduh GitLab CLI..." / "Downloading GitLab CLI..."
  - `backend.gitlab.extracting`: "Mengekstrak biner GitLab CLI..." / "Extracting GitLab CLI binary..."
  - `backend.gitlab.install_success`: "GitLab CLI berhasil dipasang!" / "GitLab CLI installed successfully!"
  - `backend.gitlab.auth_success`: "Berhasil terhubung ke akun GitLab {{user}}" / "Successfully connected to GitLab account {{user}}"
  - `backend.gitlab.comment_success`: "Komentar berhasil dikirim ke GitLab Issue #{{id}}" / "Comment successfully posted to GitLab Issue #{{id}}"
  - `tools.gitlab.title`: "Integrasi GitLab" / "GitLab Integration"
  - `tools.gitlab.token_hint`: "Buat Personal Access Token dengan scope 'api' di GitLab" / "Create a Personal Access Token with 'api' scope in GitLab"

---

### 🧪 EPIC 5: Pengujian, Keamanan & Quality Assurance

Memastikan seluruh fungsionalitas baru lulus pengujian ketat dan tidak menurunkan Quality Gate SonarQube.

#### 📋 Task 5.1: Backend Pytest Suite (`tests/test_services/test_gitlab_manager.py`)
- **Cakupan Pengujian:**
  - ✅ Deteksi biner (lokal ada, sistem ada, keduanya tidak ada).
  - ✅ Alur download dan ekstraksi sukses (mock `urllib` dan `extract_archive`).
  - ✅ Pembatalan instalasi di tengah jalan (simulasi `OperationCancelledError`).
  - ✅ Skenario login berhasil dan gagal (token salah/kedaluwarsa).
  - ✅ Eksekusi posting komentar issue dan MR dengan argumen aman.
  - ✅ Penanganan error jaringan dan respons non-zero dari CLI `glab`.

#### 📋 Task 5.2: Frontend Vitest Suite
- **Cakupan Pengujian:**
  - ✅ Rendering kartu `GitLabActionCard` di chat AI.
  - ✅ Interaksi klik "Kirim Komentar" dan perubahan status loading.
  - ✅ Verifikasi paritas i18n melalui `frontend/tests/i18n.test.ts`.

#### 📋 Task 5.3: Defensive Security & Anti-Injection Audit
- Verifikasi seluruh pemanggilan subprocess tidak menggunakan `shell=True`.
- Verifikasi token tidak pernah dicetak pada log aplikasi atau event `vylo_log`.

---

## 5. Rencana Tahapan Eksekusi (Implementation Roadmap)

Untuk mempermudah pengerjaan dan menjaga stabilitas kode, implementasi dibagi menjadi 4 Batch terstruktur:

```mermaid
flowchart LR
    Batch1["Batch 1: Core Service & Biner<br/>(GitLabManager, Downloader, Status Check)"] --> Batch2["Batch 2: Auth & Config Manager<br/>(data/gitlab.json, Token Env Injection)"]
    Batch2 --> Batch3["Batch 3: AI Assistant Integration<br/>(Action Schema, GitLabActionCard, Human-in-the-Loop)"]
    Batch3 --> Batch4["Batch 4: Frontend UI, i18n & Test Suite<br/>(GitLab Tab, Pytest, Vitest Parity)"]
```

| Batch | Fokus Pengerjaan | Target Deliverable | Estimasi |
| :--- | :--- | :--- | :--- |
| **Batch 1** | Lifecycle Biner `glab` | `core/services/gitlab_manager.py` (download, extract, status check, cancel) | 1 Sesi |
| **Batch 2** | Autentikasi & Config | Penyimpanan `data/gitlab.json`, method auth status & login aman via env | 1 Sesi |
| **Batch 3** | AI Action Engine | Schema `vylo_action` gitlab di `ai_assistant.py` & kartu konfirmasi di chat AI | 1 Sesi |
| **Batch 4** | UI Settings & Tests | Tab GitLab di frontend, paritas i18n `en`/`id`, dan test suite lengkap | 1 Sesi |

---

## 6. Definisi Selesai (Definition of Done) - 100% TERVERIFIKASI

Status verifikasi implementasi:
- [x] Biner `glab` dapat diunduh dan diekstrak secara otomatis pada Windows (`.zip`) dan Linux (`.tar.gz`).
- [x] Biner eksternal yang sudah ada di OS dapat dideteksi dan digunakan tanpa perlu instalasi ulang.
- [x] Token GitLab tidak pernah terekspos di baris perintah proses OS (`ps`) atau di file log.
- [x] AI Assistant dapat membaca data issue dan menghasilkan kartu aksi konfirmasi komentar di chat.
- [x] Komentar issue/MR hanya dikirim setelah pengguna mengklik tombol konfirmasi pada kartu aksi.
- [x] Seluruh kunci terjemahan tersedia di `frontend/src/locales/en/translation.json` dan `frontend/src/locales/id/translation.json`.
- [x] Seluruh test di `tests/test_services/test_gitlab_manager.py` dan `frontend/tests/` lulus 100%.
- [x] `npm run build` sukses tanpa error TypeScript.

### Ringkasan File Implementasi:
- **Backend Service:** `core/services/gitlab_manager.py` (didukung oleh `core/api.py` dan `core/services/ai_assistant.py`)
- **Frontend Tab & Components:** `frontend/src/menu/git/GitLabIntegrationTab.tsx`, `frontend/src/components/GitLabActionCard.tsx`
- **Penyimpanan Konfigurasi:** `data/gitlab.json`
- **Unit Test Backend:** `tests/test_services/test_gitlab_manager.py` (100% coverage, mock OS subprocess)
- **Unit Test Frontend:** `frontend/tests/menu/git/GitLabIntegrationTab.test.tsx`, `frontend/tests/i18n.test.ts`
