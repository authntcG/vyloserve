# Pengujian & Pengembangan (Development & Testing)

Panduan teknis untuk para kontributor atau Asisten AI yang hendak melanjutkan pengembangan, melakukan inspeksi kualitas kode, atau merilis aplikasi ini ke publik (Build Production).

## 1. Lingkungan Pengembangan (*Development Environment*)
Aplikasi ini berjalan dengan dua server terpisah (Python dan Vite) yang harus dijalankan bersamaan saat fase pengembangan.

**Set Mode Development:**
Pastikan variabel `IS_PRODUCTION` di dalam `main.py` diatur ke `False`:
```python
# Di dalam main.py
IS_PRODUCTION = False 
```

**Menjalankan Script (Run Script):**
1.  **Frontend (React/Vite):**
    Buka terminal dan jalankan server *development* frontend:
    ```powershell
    cd frontend
    npm run dev
    ```
2.  **Backend (Python):**
    Di terminal terpisah, jalankan entrypoint Python:
    ```powershell
    python main.py
    ```
    *Catatan: Karena `IS_PRODUCTION = False`, PyWebView akan meload `http://localhost:5173` dari Vite, sehingga fitur Hot-Reload (HMR) frontend akan aktif di dalam jendela aplikasi desktop.*

## 2. Pengujian Unit (Unit Testing dengan Pytest)
VyloServe terintegrasi sangat dalam dengan sistem operasi Windows (membongkar registry, mengatur system PATH, membuat subprocess OS). Menjalankan unit test **TIDAK BOLEH** sampai merusak instalasi pengguna! 

### Prinsip & Kewajiban Testing
- Semua command OS (Subprocess), pengunduhan file (urllib), dan Registry edit (winreg) wajib dilakukan **Patching/Mocking**. 
- Tidak ada file dummy sembarangan yang diturunkan ke disk selain di folder `tmp_path` bawaan pytest.
- Gunakan *Fixture Mock API* (`mock_api` dalam file `tests/conftest.py`) saat menginisiasi Manager agar aplikasi tidak error mencari referensi *Pywebview bridge*.
- **Setiap fitur atau fungsi publik baru WAJIB disertai unit test.** Tidak ada pengecualian.
- ⚠️ **Heuristik deteksi mock yang lolos:** kalau satu file/fungsi test tiba-tiba jauh lebih lambat dari biasanya (detik → puluhan detik), curigai ada panggilan jaringan/subprocess/file-system nyata yang lolos dari mock — **jangan** anggap itu cuma "mesin sedang lambat". Ini persis bagaimana ditemukan bahwa `test_php_install_version` diam-diam mengunduh `composer.phar` sungguhan dari internet tiap kali dijalankan (`_install_composer()` tidak di-mock) — durasi suite yang tidak wajar adalah sinyalnya, bukan assertion yang gagal (test itu tetap "lulus").

### Skenario Test yang Wajib Dicover per Fungsi
Setiap test suite untuk sebuah fungsi *setidaknya* harus mencakup:

| Skenario | Keterangan |
|----------|------------|
| ✅ **Happy Path** | Input valid → output/return sesuai ekspektasi |
| ✅ **Edge Case** | Input kosong `""`, `None`, nilai di batas minimum/maksimum |
| ✅ **Error Path** | Simulasi kegagalan OS: file tidak ditemukan, port ditolak, subprocess crash |
| ✅ **Security Path** | Input mengandung karakter berbahaya (`../`, `;`, `&&`), validasi ditolak |

### Struktur & Penamaan Test
```
tests/
├── conftest.py                           # Fixture global (mock_api, dll)
├── test_i18n_keys.py                     # Regresi: setiap key "backend.*" di core/ WAJIB
│                                          #   terdaftar di locales/en DAN locales/id (lihat
│                                          #   docs/known_bugs.md #19) — jalankan sebelum
│                                          #   serah terima fitur apa pun yang menambah/
│                                          #   mengubah pesan backend (message/log/progress)
├── test_services/
│   ├── test_apache.py                    # Unit test untuk core/services/apache.py
│   ├── test_api.py                       # Unit test untuk core/api.py (Facade/Router)
│   ├── test_database.py                  # Unit test untuk core/services/database.py
│   ├── test_database_parser.py           # Unit test parsing config (my.ini/postgresql.conf)
│   ├── test_php.py                       # Unit test untuk core/services/php.py
│   ├── test_php_parser.py                # Unit test parsing php.ini
│   ├── test_project_logic.py             # Unit test untuk core/services/project.py
│   ├── test_project_uac.py               # Unit test UAC hosts injection
│   ├── test_git_manager.py               # Unit test untuk core/services/git_manager.py
│   ├── test_ssl_manager.py               # Unit test untuk core/services/ssl_manager.py
│   ├── test_dashboard.py                 # Unit test untuk core/services/dashboard.py
│   ├── test_settings.py                  # Unit test untuk core/services/settings.py
│   ├── test_runtimes_manager.py          # Unit test untuk core/services/runtimes_manager.py
│   ├── test_service_lifecycles.py        # Unit test orkestrasi start/stop antar service
│   └── test_<nama_service>.py            # Pola: test_<nama_file_source>.py
└── test_utils/
    ├── test_file_utils.py                # Unit test untuk core/utils/file_utils.py
    └── test_system_utils.py              # Unit test untuk core/utils/system_utils.py
```

**Konvensi Penamaan Fungsi Test (Wajib Deskriptif):**
```python
# BENAR — jelas skenario apa yang diuji
def test_start_server_success_returns_correct_status():
def test_start_server_port_already_in_use_returns_error():
def test_install_version_path_traversal_rejected():
def test_read_json_file_not_found_returns_empty_dict():

# SALAH — terlalu generik
def test_start():
def test_install():
```

**Template Dasar Unit Test (Wajib Diikuti):**
```python
import pytest
from unittest.mock import MagicMock, patch

@pytest.fixture
def mock_api():
    return MagicMock()

class TestApacheManagerStartServer:
    """Menguji skenario ApacheManager.start_server()"""

    def test_start_server_success(self, mock_api):
        """Happy path: server berhasil dijalankan, return status success."""
        with patch('core.utils.system_utils.start_silent_process') as mock_proc, \
             patch('core.utils.file_utils.read_json', return_value={'active_version': '2.4.62'}):
            mock_proc.return_value = MagicMock()
            manager = ApacheManager(mock_api)
            result = manager.start_server(port=80)
        assert result['status'] == 'success'

    def test_start_server_port_in_use_returns_error(self, mock_api):
        """Error path: port sudah dipakai, return status error."""
        with patch('core.utils.system_utils.check_port_in_use', return_value=True):
            manager = ApacheManager(mock_api)
            result = manager.start_server(port=80)
        assert result['status'] == 'error'
```

### Cara Menjalankan Pengujian
```powershell
# Menjalankan seluruh test dengan coverage report (XML untuk SonarQube)
python -m pytest tests/ --cov=. --cov-report=xml

# Menjalankan spesifik file dengan log verbosity
python -m pytest tests/test_services/test_apache.py -v

# Menjalankan test dengan filter nama fungsi tertentu
python -m pytest tests/ -k "test_start_server" -v
```

### Praktik Wajib Tambahan (Pelajaran dari Audit Coverage Backend)

Bagian ini berisi pelajaran konkret dari sesi audit coverage backend besar-besaran (coverage `core/` naik dari 82% → 98%, menemukan & memperbaiki 6 bug nyata di produksi). Ikuti praktik ini agar hasil kerja test berikutnya berkualitas tinggi, bukan sekadar mengejar angka.

**1. Patch target HARUS presisi — ini penyebab bug paling berbahaya lolos ke production.**
```python
# SALAH — mem-patch os.path.exists secara global tanpa memastikan
# ini benar-benar attribute yang dipakai oleh modul yang ditest
@patch('os.path.exists', return_value=True)
def test_sesuatu(mock_exists, manager): ...

# BENAR — patch persis di namespace modul yang mengimpor & memakainya
@patch('core.services.project.os.path.exists', return_value=True)
def test_sesuatu(mock_exists, manager): ...
```
Kasus nyata: unit test lama untuk `sync_apache_vhosts()` mem-mock `os.makedirs` tanpa pernah mengecek **path** yang dikirim ke situ. Akibatnya, typo `conf` → `con` di kode produksi lolos tanpa terdeteksi selama berbulan-bulan (lihat `docs/known_bugs.md` #3). Test yang "hijau" tidak berarti test itu benar-benar menguji sesuatu.

**2. Assert perilaku nyata (argumen persis, return value, state akhir) — bukan hanya `assert_called()`.**
```python
# LEMAH — cuma tahu fungsinya "dipanggil", tidak tahu dengan argumen benar atau tidak
mock_makedirs.assert_called_once()

# KUAT — memvalidasi path/argumen yang SEBENARNYA dikirim
mock_makedirs.assert_called_once_with(os.path.join('apache_path', 'conf', 'extra'))
```

**3. Validasi regression test dengan sengaja merusak kode dulu.**
Untuk test yang dibuat khusus menjaga sebuah bug fix, jangan berhenti setelah test itu lulus sekali. Wajib:
1. Sengaja kembalikan baris kode ke versi buggy.
2. Jalankan test → **harus gagal**.
3. Kembalikan lagi ke versi fix.
4. Jalankan test → **harus lulus**.

Ini satu-satunya cara memastikan test benar-benar mendeteksi regresi, bukan cuma "lulus karena tidak menguji apa-apa yang relevan".

**4. Jangan mengejar coverage 100% secara buta.**
Blok `except Exception: pass` yang sifatnya *best-effort swallow* murni (tanpa cabang perilaku yang bisa diverifikasi berbeda) boleh dibiarkan tidak ter-cover. Menulis test untuk itu hanya menaikkan angka tanpa nilai regresi — prioritaskan logika bercabang nyata, alur error dengan pesan/state berbeda, dan kode yang baru diperbaiki bug-nya.

**5. Entrypoint aplikasi (`main.py`) harus tetap testable.**
Jangan taruh logika penting sebagai closure di dalam `if __name__ == '__main__':` — blok itu tidak pernah jalan saat `pytest` mengimpor modulnya (karena `__name__` saat itu adalah `"main"`, bukan `"__main__"`). Ekstrak ke class/fungsi level-modul yang menerima dependency lewat parameter (lihat class `AppLifecycle` di `main.py` sebagai contoh).

**6. Selesai menambah test bukan berarti selesai — verifikasi ke SonarQube.**
Setelah menambah/mengubah test: jalankan ulang suite penuh + coverage, lalu pastikan hasil scan SonarQube menunjukkan **0 temuan baru** (bug/code smell) akibat test yang baru ditulis, sebelum menyerahkan pekerjaan sebagai selesai.

## 3. Pengujian Unit Frontend (Unit Testing dengan Vitest)

Frontend (`frontend/`) memakai **Vitest + React Testing Library**, bukan Jest — proyek ini berbasis Vite, dan Vitest berbagi config langsung dengan `vite.config.ts` (tidak perlu setup Babel/webpack terpisah), native ESM, dan API-nya kompatibel Jest.

### 3.1 Struktur & Lokasi Test
Berbeda dari kebiasaan umum React (`Component.test.tsx` di sebelah `Component.tsx`), proyek ini **mengikuti pola folder `tests/` terpisah** yang sama seperti backend Python, supaya konsisten satu proyek:
```
frontend/
├── tests/
│   ├── setup.ts                      # Global setup: mock react-i18next, jest-dom matchers, jsdom polyfills
│   ├── test-utils.tsx                # Helper bersama: mockPywebviewApi(), renderWithToast(), re-export RTL
│   ├── i18n.test.ts                  # Smoke test untuk src/i18n.ts asli (vi.unmock react-i18next)
│   ├── components/                   # Mirror src/components/*.tsx
│   └── menu/                         # Mirror src/menu/**/*.tsx (apache/, php/, database/, runtimes/, dashboard/, tools/)
├── tsconfig.test.json                # tsconfig khusus untuk src/ + tests/ (types vitest/globals, testing-library)
└── vite.config.ts                    # blok `test: {...}` + `coverage: {...}` di sini
```
Pola: `tests/<mirror-struktur-src>/<NamaKomponen>.test.tsx`.

Helper bersama ada di `tests/test-utils.tsx` (re-export semua dari `@testing-library/react` ditambah `mockPywebviewApi()` dan `renderWithToast()`) — **selalu pakai helper ini, jangan tulis ulang boilerplate mock `window.pywebview.api` atau `<ToastProvider>` wrapper di tiap file test**. Untuk sekelompok komponen yang bentuknya identik (mis. empat form `InstallGo/Java/Node/Python.tsx` yang sama-sama forwardRef + `submit()` + fetch-versions-on-mount), buat SATU factory function bersama (lihat `tests/menu/runtimes/installRuntimeTestKit.tsx`) lalu panggil dari tiap file test dengan config berbeda, dan gunakan `it.each`/`describe.each` untuk variasi data (lihat `tests/menu/database/Settings.test.tsx` untuk field MySQL/PostgreSQL, atau `tests/menu/runtimes/Main.test.tsx` untuk keempat engine). Pola ini WAJIB diikuti untuk suite test baru — proyek ini menjaga *new code duplication* SonarQube di bawah 3%, dan test suite yang tidak DRY adalah kontributor terbesar untuk duplication findings.

Per audit test coverage (2026), seluruh `src/**/*.{ts,tsx}` frontend punya coverage statement **>95%** (~460 test case di 39 file test) — jalankan `npm run test:coverage` untuk laporan terbaru per file. Beberapa baris tetap sengaja tidak dicover karena secara nyata *unreachable* lewat UI (mis. validasi `if (!x) return` di dalam handler yang tombol pemicunya sendiri sudah `disabled` oleh kondisi yang sama — pola berulang yang ditemukan di banyak form Modal proyek ini; lihat commit history test untuk contoh).

### 3.2 Mock `react-i18next` Secara Global
`tests/setup.ts` men-mock `useTranslation()` secara global untuk SEMUA test — `t(key, fallback)` mengembalikan `fallback` apa adanya (dengan interpolasi `{{var}}` sederhana), `t(key)` tanpa fallback mengembalikan `key` literal. Ini **disengaja**: test komponen tidak boleh ikut gagal kalau teks terjemahan di `locales/*.json` berubah — itu tanggung jawab `tests/test_i18n_keys.py` (backend) dan review manual, bukan test komponen. Kalau sebuah test benar-benar perlu memverifikasi teks terjemahan asli, override mock global ini per-file dengan `vi.mock('react-i18next', ...)` di file test yang bersangkutan.

### 3.3 Mock `window.pywebview.api`
Komponen manapun yang memanggil `window.pywebview.api.*` (hampir semua komponen halaman) **wajib** di-mock di setiap test — pakai helper `mockPywebviewApi()` dari `tests/test-utils.tsx` (lihat §3.1), bukan menulis ulang `(window as any).pywebview = {...}` manual di tiap file.

### 3.4 Cara Menjalankan
```powershell
npm run test            # sekali jalan (CI-friendly)
npm run test:watch      # mode watch untuk development
npm run test:coverage   # dengan coverage report (@vitest/coverage-v8) -- juga menghasilkan coverage/lcov.info untuk SonarQube, lihat §6
```

### 3.5 🚨 WAJIB: Cara Type-Check Frontend yang BENAR — `tsc -b`, BUKAN `tsc --noEmit -p tsconfig.json`
`frontend/tsconfig.json` adalah **file "solution"** (`{"files": [], "references": [...]}`) — gaya bawaan template Vite React-TS untuk memisahkan config app (`tsconfig.app.json`), Node (`tsconfig.node.json`), dan sekarang test (`tsconfig.test.json`). Ini bukan bug, tapi implikasinya kritis:

- **`tsc --noEmit -p tsconfig.json` (TANPA flag `-b`) adalah PERINTAH YANG VAKUM** — karena `files: []` dan tidak ada `include` langsung, TypeScript tidak benar-benar men-type-check APA PUN. Perintah ini **selalu exit 0**, bahkan kalau ada error nyata di `src/`. Ini bukan teori: pernah kejadian nyata satu sesi penuh di mana perintah ini dijalankan berulang kali setelah setiap perubahan dan selalu melaporkan "bersih", padahal ada **16 error TypeScript sungguhan** (union return type `t()` dari react-i18next yang tidak otomatis assignable ke `string`, butuh `as string`) yang baru ketahuan belakangan setelah `tsconfig.test.json` ditambahkan dan seseorang **kebetulan** memakai `tsc -b` untuk keperluan lain.
- **WAJIB pakai salah satu dari ini untuk type-check yang benar-benar berjalan:**
  ```powershell
  npx tsc -b                      # build semua project reference (app + node + test) dari root
  npx tsc -b tsconfig.test.json   # cuma project test (mencakup src + tests, lebih cepat untuk iterasi)
  ```
  `-b` (build mode) itulah yang membuat TypeScript benar-benar menelusuri `references` dan men-check tiap project di dalamnya. Tanpa `-b`, TypeScript memperlakukan file solution seolah tidak ada isinya.
- Kalau butuh clean re-check (build cache TS kadang menyembunyikan error yang sudah pernah lolos), hapus dulu `*.tsbuildinfo`:
  ```powershell
  Remove-Item node_modules/.tmp/*.tsbuildinfo -ErrorAction SilentlyContinue
  npx tsc -b
  ```

### 3.6 jsdom Tidak Mengimplementasikan `Element.prototype.scrollIntoView`
Beberapa komponen (semua form "NewInstance" Apache/PHP/Database, dan komponen serupa) memanggil `bottomRef.current?.scrollIntoView(...)` lewat `setTimeout(..., 100)` saat `isInstalling` bernilai `true`, untuk auto-scroll ke progress bar. jsdom **tidak** mengimplementasikan `scrollIntoView` sama sekali (lihat [jsdom/jsdom#1695](https://github.com/jsdom/jsdom/issues/1695)) — tanpa stub, timer tsb melempar `TypeError: scrollIntoView is not a function` **setelah** test yang memicunya sudah selesai (karena `setTimeout` 100ms itu), muncul sebagai *unhandled exception* yang membingungkan pada test lain yang kebetulan berjalan berikutnya.

Solusinya: `tests/setup.ts` men-stub `Element.prototype.scrollIntoView` sebagai no-op secara global (bukan per test file), supaya semua test yang secara tidak langsung memicu efek auto-scroll ini tetap aman.

## 4. Standar Clean Code & DRY

Setiap kontribusi kode (backend maupun frontend) wajib memenuhi standar berikut sebelum diserahkan.

### Backend (Python)

**Single Responsibility — Satu Fungsi, Satu Tujuan:**
- Fungsi yang melebihi **40 baris** atau memiliki *nesting* lebih dari **2 level** harus dipecah menjadi *private helper method* (prefix `_`).
- Konstanta atau nilai yang diulang lebih dari sekali wajib diekstrak:
  ```python
  # SALAH
  def install(self):
      for _ in range(5):  # magic number
          ...

  # BENAR
  MAX_INSTALL_RETRY = 5
  def install(self):
      for _ in range(MAX_INSTALL_RETRY):
          ...
  ```

**DRY — Jangan Duplikasi Logika:**
- Jika blok logika yang sama muncul di dua tempat atau lebih, ekstrak ke fungsi utilitas di `core/utils/`.
- Sebelum menulis fungsi baru, cek apakah sudah ada di `system_utils.py` atau `file_utils.py`.

**Naming Convention:**
| Konteks | Konvensi | Contoh |
|---------|----------|--------|
| Variabel & fungsi | `snake_case` | `get_active_version()`, `base_dir` |
| Kelas | `PascalCase` | `ApacheManager`, `DatabaseManager` |
| Konstanta module | `UPPER_SNAKE_CASE` | `DEFAULT_PORT = 80` |
| Private method | prefix `_` | `_parse_config()`, `_validate_path()` |

### Frontend (TypeScript / React)

**Pemisahan Logika & Presentasi:**
- Logika bisnis (pemanggilan API, transformasi data) harus dipisah ke dalam *custom hook* (`useXxx`) dan **tidak** ditulis langsung di dalam JSX.
- Komponen harus menerima data via `props`, bukan mengambil data sendiri (kecuali pada komponen halaman utama).

**DRY di Komponen:**
- Sebelum membuat komponen baru, cek `frontend/src/components/` terlebih dahulu.
- Gunakan `<PageHeader>`, `<Modal>`, `<Badge>`, `<BackgroundProgressWidget>` yang sudah ada.

**Naming Convention:**
| Konteks | Konvensi | Contoh |
|---------|----------|--------|
| Variabel & fungsi | `camelCase` | `isLoading`, `handleInstall()` |
| Komponen React | `PascalCase` | `ApacheMain`, `DatabaseSettings` |
| Tipe / Interface | `PascalCase` | `ApiResponse`, `ProjectConfig` |
| Custom Hook | prefix `use` | `useApacheStatus()` |

## 5. Standar Security

Setiap pengembangan fitur baru **WAJIB** mempertimbangkan aspek keamanan berikut:

### Backend Security

**1. Validasi Input (Wajib di `core/api.py`):**
Seluruh argumen yang berasal dari frontend harus divalidasi sebelum diteruskan ke service:
```python
def install_apache(self, version: str, port: int) -> dict:
    # Validasi tipe
    if not isinstance(version, str) or not isinstance(port, int):
        return {"status": "error", "message": "backend.error.invalid_input"}
    # Validasi nilai
    if not version.strip() or port < 1 or port > 65535:
        return {"status": "error", "message": "backend.error.invalid_input"}
    return self.apache.install_version(version, port)
```

**2. Proteksi Path Traversal (Wajib untuk semua path dari user):**
```python
def _validate_safe_path(self, user_input: str, base_dir: str) -> str | None:
    """Validasi bahwa path tidak keluar dari direktori yang diizinkan."""
    safe_root = os.path.realpath(base_dir)
    target = os.path.realpath(os.path.join(base_dir, user_input))
    if not target.startswith(safe_root + os.sep):
        return None  # Path traversal terdeteksi
    return target
```

**3. Subprocess — Selalu Gunakan List, Bukan String:**
```python
# SALAH — rentan Command Injection
subprocess.run(f"httpd -k start -p {port}", shell=True)

# BENAR — argumen dipisah, tidak ada shell interpolation
subprocess.run(["httpd.exe", "-k", "start", "-p", str(port)], ...)
```

**4. Sanitasi Output ke JavaScript (XSS Prevention):**
```python
import json

# SALAH — raw string bisa berisi karakter berbahaya
self.window.evaluate_js(f"notify('{message}')")

# BENAR — json.dumps otomatis meng-escape quote & karakter khusus
safe = json.dumps(message)
self.window.evaluate_js(f"notify({safe})")
```

**5. Kredensial Tidak Boleh di Kode:**
- Password database, token API, atau kunci SSL **DILARANG** ditulis hardcode.
- Simpan di `data/settings.json` (yang ada di `.gitignore`).

### Frontend Security

**1. Hindari `dangerouslySetInnerHTML`:**
Jangan pernah merender konten HTML mentah yang berasal dari backend atau input pengguna.

**2. Validasi Sisi Client untuk UX, Bukan untuk Security:**
Validasi di frontend hanya untuk pengalaman pengguna (tampilkan pesan error cepat). Validasi sesungguhnya **wajib** ada di backend.

**3. Jangan Expose Token/Secret di Environment Frontend:**
File `.env` di `frontend/` tidak boleh berisi data sensitif karena akan di-bundle ke dalam JS yang dapat dibaca siapapun.

## 6. Analisis Kualitas Kode (SonarQube Scan)
Untuk memonitor *Cognitive Complexity*, *Code Smells*, dan *Bugs*, kita menggunakan SonarQube Scanner.
Jalankan perintah ini di root direktori proyek. Pastikan SonarQube berjalan di `http://127.0.0.1:9000`.


> **Keamanan Token:** JANGAN PERNAH menuliskan token SonarQube asli di dalam dokumen ini atau file manapun yang ter-*commit* ke Git. Simpan token di *environment variable* lokal (misal `SONAR_TOKEN`) dan referensikan lewat `%SONAR_TOKEN%` (PowerShell: `$env:SONAR_TOKEN`), atau di file `.env` yang sudah masuk `.gitignore`. Jika token pernah ter-*commit* (seperti riwayat sebelumnya di file ini), token tersebut **wajib di-revoke/regenerate** di dashboard SonarQube karena dianggap bocor secara permanen di histori Git.

**Frontend Sonar Scan:**
*(Sebelum scan, WAJIB regenerate coverage report dulu — `sonar.javascript.lcov.reportPaths` di bawah membaca file statis `coverage/lcov.info`, SonarQube tidak menjalankan Vitest sendiri.)*
```powershell
cd frontend
npm run test:coverage
sonar-scanner.bat -D"sonar.projectKey=vyloserve-fe" -D"sonar.sources=src" -D"sonar.tests=tests" -D"sonar.host.url=http://127.0.0.1:9000" -D"sonar.token=%SONAR_TOKEN_FE%" -D"sonar.javascript.lcov.reportPaths=coverage/lcov.info"
```
Detail parameter (dibanding perintah lama yang cuma `sonar.sources=.` tanpa `sonar.tests`/coverage — riwayat sebelumnya, semua file di `frontend/tests/` ikut ter-scan sebagai *source code* biasa, bukan test code, sehingga ikut membebani metrik *new code duplication*):
- `sonar.sources=src` — cakupan source code dipersempit ke `frontend/src/` saja (konsisten dengan pola backend: `sonar.sources=core,main.py`), bukan seluruh `frontend/` (yang sebelumnya turut men-scan `tests/`, config root, dsb).
- `sonar.tests=tests` — mengklasifikasikan `frontend/tests/**` sebagai *test code*, terpisah dari metrik duplication/code-smell *source* utama.
- `sonar.javascript.lcov.reportPaths=coverage/lcov.info` — mengimpor hasil coverage Vitest (`npm run test:coverage`, reporter `lcov` di `vite.config.ts`) supaya persentase *Coverage* di dashboard SonarQube frontend terisi (sebelumnya selalu 0%/kosong karena tidak ada laporan yang diimpor).

**Backend Sonar Scan:**
*(Memiliki exclusions agar tidak meng-scan frontend, bin, file cache, dan library yang digenerate).*
```powershell
sonar-scanner.bat -D"sonar.projectKey=vyloserve-be" -D"sonar.sources=core,main.py" -D"sonar.tests=tests" -D"sonar.host.url=http://127.0.0.1:9000" -D"sonar.token=%SONAR_TOKEN_BE%" -D"sonar.exclusions=frontend/**,bin/**,build/**,data/**,dist/**,docs/**,www/**,**/__pycache__/**,**/*.pyc,.coverage" -D"sonar.test.exclusions=**/__pycache__/**,**/*.pyc" -D"sonar.python.version=3.10" -D"sonar.scm.disabled=true" -D"sonar.python.coverage.reportPaths=coverage.xml"
```

## 7. Proses Kompilasi Produksi (Build Project)
Untuk membuat aplikasi mandiri (Standalone Windows Executable `.exe`) yang bisa didistribusikan ke pengguna akhir:

> **PERINGATAN (REMEMBER):**
> Anda **WAJIB** mengubah kembali variabel `IS_PRODUCTION = True` pada `main.py` sebelum melakukan *build*. Jika tidak, aplikasi *compiled* akan mencoba mencari Vite server (`localhost:5173`) dan gagal dibuka (blank screen).

**Langkah 1: Build Frontend**
Kompilasi kode React TypeScript menjadi JavaScript statis:
```powershell
cd frontend
npm run build
```
*(File hasil kompilasi akan diletakkan di `frontend/dist`)*.

**Langkah 2: Build Backend (PyInstaller)**
Kembali ke root proyek. Gunakan `--noconsole` agar terminal CMD latar belakang disembunyikan.

*   **Opsi A (OneDir / Standar - Lebih Cepat Dimuat):**
    ```powershell
    pyinstaller --noconsole --add-data "frontend/dist;frontend/dist" --add-data "frontend/src/assets/icons-nobg.ico;frontend/src/assets" main.py
    ```
*   **Opsi B (OneFile - Hanya 1 file `.exe` rapi, namun booting agak lambat):**
    ```powershell
    pyinstaller --noconsole --onefile --icon "frontend\src\assets\icons-nobg.ico" --add-data "frontend/dist;frontend/dist" --add-data "frontend/src/assets/icons-nobg.ico;frontend/src/assets" main.py
    ```

*(Catatan: pastikan fungsi `sys.frozen` telah dikelola dengan baik pada kode `system_utils.py` agar direktori Root tetap terlacak saat dalam bentuk compiled `.exe`).*
