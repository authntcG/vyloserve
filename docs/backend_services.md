# Backend Services (Logika Python) — Dokumentasi Mendalam

> **Metodologi dokumen ini:** Setiap bagian di bawah ditulis berdasarkan audit langsung terhadap source code (`core/api.py`, `core/services/*.py`, `core/utils/*.py`, `main.py`), bukan asumsi dari dokumentasi sebelumnya. Setiap *workflow* (install, start, stop, dsb) disertai diagram Mermaid yang menggambarkan urutan langkah persis seperti yang terjadi di kode — termasuk percabangan error dan pemanggilan lintas-service. Bagian [§13](#13-known-issues--temuan-audit-backend) mendaftar semua ketidaksesuaian antara dokumentasi lama dan kode nyata yang ditemukan saat audit ini, termasuk **bug fungsional yang masih aktif**.
>
> Dokumen ini ditujukan untuk dibaca developer maupun AI Assistant. Setiap service dijelaskan secara *atomic* (satu tanggung jawab per bagian) dengan urutan: Dependency → State/Storage → API Publik → Workflow (diagram) → Helper Privat → Ketergantungan Lintas-Service.

---

## Daftar Isi

1. [Peta Dependency Antar Service](#1-peta-dependency-antar-service)
2. [`core/api.py` — Api Facade & Event Emitter](#2-coreapipy--api-facade--event-emitter)
3. [Lapisan Utilitas (`core/utils/`)](#3-lapisan-utilitas-coreutils)
4. [`ApacheManager` (`apache.py`)](#4-apachemanager-apachepy)
5. [`PhpManager` (`php.py`)](#5-phpmanager-phppy)
6. [`DatabaseManager` (`database.py`)](#6-databasemanager-databasepy)
7. [`ProjectManager` (`project.py`)](#7-projectmanager-projectpy)
8. [`RuntimesManager` (`runtimes_manager.py`)](#8-runtimesmanager-runtimes_managerpy)
9. [`GitManager` (`git_manager.py`)](#9-gitmanager-git_managerpy)
10. [`SslManager` (`ssl_manager.py`)](#10-sslmanager-ssl_managerpy)
11. [`DashboardManager` & `SettingsManager`](#11-dashboardmanager--settingsmanager)
12. [`main.py` — App Bootstrap & `AppLifecycle`](#12-mainpy--app-bootstrap--applifecycle)
13. [Known Issues — Temuan Audit Backend](#13-known-issues--temuan-audit-backend)

---

## 1. Peta Dependency Antar Service

Semua manager diinisialisasi di `Api.__init__()` dan menerima referensi ke `Api` itu sendiri (`self.api`), sehingga setiap manager bisa mengakses manager lain lewat `self.api.<nama_manager>`. Dependency **tidak dideklarasikan di constructor** — semua bersifat *lazy* (dicek dengan `hasattr(self.api, 'xxx')` saat method dipanggil), sehingga urutan inisialisasi di `Api.__init__()` tidak masalah, tapi ini juga berarti **tidak ada validasi startup** yang memastikan semua dependency benar-benar ada.

```mermaid
graph TD
    API[Api Facade<br/>core/api.py]

    API -->|owns| Apache[ApacheManager]
    API -->|owns| Php[PhpManager]
    API -->|owns| Database[DatabaseManager]
    API -->|owns| Project[ProjectManager]
    API -->|owns| Runtimes[RuntimesManager]
    API -->|owns| Git[GitManager]
    API -->|owns| Ssl[SslManager]
    API -->|owns| Dashboard[DashboardManager]
    API -->|owns| Settings[SettingsManager]

    Php -.->|"update_global_php_proxy(port)<br/>saat start_php/save_config/uninstall"| Apache
    Project -.->|"sync_apache_vhosts()<br/>saat create/update/delete project"| Apache
    Project -.->|"get_installed_php() via self.api<br/>resolve port PHP aktif"| Php
    Project -.->|"generate_domain_cert(domain)<br/>delete_domain_cert(domain)"| Ssl
    Apache -.->|"generate_domain_cert('localhost')<br/>saat update_global_php_proxy"| Ssl
    Ssl -.->|"get_status() — butuh openssl.exe<br/>&amp; openssl.cnf dari instalasi Apache"| Apache

    Database -.->|"TIDAK ada dependency ke service lain"| Database
    Runtimes -.->|"TIDAK ada dependency ke service lain"| Runtimes
    Git -.->|"TIDAK ada dependency ke service lain"| Git

    style Database fill:#1a3,color:#fff
    style Runtimes fill:#1a3,color:#fff
    style Git fill:#1a3,color:#fff
```

**Poin penting:**
- **`SslManager` ↔ `ApacheManager` saling bergantung** dua arah: Apache butuh Ssl untuk generate cert `localhost`, sementara Ssl butuh path `openssl.exe` dari instalasi Apache. Jika Apache belum terinstall, `SslManager` akan melempar `RuntimeError`, tapi karena semua pemanggilnya (`Apache`, `Project`) membungkusnya dalam `try/except`, kegagalan ini **selalu silent-downgrade ke HTTP-only** — tidak pernah muncul sebagai error ke UI.
- `DatabaseManager`, `RuntimesManager`, dan `GitManager` benar-benar independen — aman untuk ditest/dimodifikasi tanpa mempengaruhi service lain.
- `PhpManager` dan `ApacheManager` **saling bergantung erat** melalui port FastCGI proxy — lihat diagram di [§4.3](#43-workflow-start-server-dengan-handshake-php-proxy) dan [§5.2](#52-workflow-start_phpversion).

---

## 2. `core/api.py` — Api Facade & Event Emitter

`Api` adalah satu-satunya class yang diekspos ke `window.pywebview.api` di frontend. Semua fungsi JS masuk lewat sini, lalu didelegasikan ke manager yang sesuai.

### 2.1 Constructor
Menginisialisasi 9 manager (`self.apache`, `self.php`, `self.database`, `self.project`, `self.runtimes`, `self.git`, `self.ssl`, `self.dashboard`, `self.settings`), masing-masing menerima `self` (instance `Api`) sebagai referensi balik. `self._window = None` (di-set belakangan oleh `main.py` via `set_window()`). `self.quit_callback = None` (di-set oleh `main.py` agar `close_app()` bisa memicu pembersihan sebelum keluar — lihat [§13](#13-known-issues--temuan-audit-backend) untuk status nyata pembersihan ini).

### 2.2 Event Emitter — Mekanisme Inti Komunikasi Real-Time

```python
def emit_log(self, message: str, level: str = "info", args: dict = None):
    if self._window:
        source = self._resolve_event_source()
        detail = json.dumps({"message": message, "level": level, "args": args or {}, "source": source})
        self._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_log', {{detail: {detail} }}));")

def emit_progress(self, percent: int, text: str = "", args: dict = None):
    if self._window:
        source = self._resolve_event_source()
        detail = json.dumps({"percent": percent, "text": text, "args": args or {}, "source": source})
        self._window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_progress', {{detail: {detail} }}));")
```

- `json.dumps()` dipakai untuk membangun payload event → ini yang mencegah XSS/JS-injection saat men-embed string dinamis ke `evaluate_js()` (lihat standar security di `docs/development_testing.md`).
- **Kedua fungsi ini silent-no-op jika `self._window` belum di-set** — artinya jika `main.py` lupa memanggil `api.set_window(window)`, seluruh log & progress bar akan hilang tanpa error apapun. Ini pola debugging yang sudah benar didokumentasikan di `docs/ai_development_guide.md` §4.3.
- **`source`** diisi otomatis oleh `_resolve_event_source()` (memakai `inspect.currentframe()` untuk membaca nama class pemanggil dari stack frame, mis. `"ApacheManager"`) — pemanggil `_progress()`/`_log()` di tiap service **tidak perlu** mengisi field ini sendiri. Frontend memakai field ini untuk memfilter event yang bukan miliknya karena semua halaman selalu ter-*mount* bersamaan — lihat `docs/frontend_ui.md` §3.3.
- ⚠️ **Kontrak `percent`:** selalu angka **absolut 0-100** (bukan fraksi `0.0-1.0`), dan `percent >= 100`/`percent <= 0` **punya makna khusus di frontend** — ditafsirkan sebagai "proses benar-benar selesai" dan memicu auto-hide widget progress. Jangan panggil `_progress(100, ...)`/`emit_progress(100, ...)` untuk checkpoint di tengah alur multi-tahap; lihat §8.2 di bawah dan `docs/known_bugs.md` #16 & #18 untuk 2 bug nyata yang disebabkan pelanggaran kontrak ini.
- ⚠️ **Kontrak `message`/`text`:** SELALU translation key (`"backend.xxx.yyy"`), tidak pernah string literal — berlaku untuk `emit_log`/`emit_progress` maupun wrapper privat `_log()`/`_progress()` tiap service. **Setiap wrapper privat WAJIB menerima dan meneruskan parameter `args`** (signature: `def _log(self, msg: str, level: str = "info", args: dict = None)`), karena `emit_log`/`emit_progress` di atas sudah menyediakan slot `args` untuk interpolasi (`{{engine}}`, `{{version}}`, dst) — wrapper yang menelan/membuang `args` memaksa pemanggilnya menulis f-string mentah sebagai jalan pintas. Bug nyata: `RuntimesManager._emit_log()`/`_emit_progress()` awalnya tidak punya parameter `args` sama sekali, sehingga seluruh log deteksi instalasi eksternal Node/Python/Java/Go terkirim sebagai string Indonesia mentah walau bahasa aplikasi di-set English — lihat `docs/known_bugs.md` #19. Dicegah otomatis oleh `tests/test_i18n_keys.py`.

### 2.3 Endpoint Non-Delegasi Penting

| Endpoint | Perilaku |
|---|---|
| `close_app()` | Jika `self.quit_callback` di-set → panggil callback tersebut. Jika tidak → `os._exit(0)` langsung. **Lihat §13 untuk bug terkait fungsi ini.** |
| `browse_directory()` | Membuka native folder picker via `self._window.create_file_dialog(webview.FOLDER_DIALOG)`. |
| `start_service(id)` / `stop_service(id)` | Dispatcher generik dipakai oleh toggle switch di Sidebar & Dashboard — merutekan ke `apache`/`php`/`database` manager berdasarkan `id`. |
| `get_all_services_status()` | Menggabungkan `psutil.cpu_percent()` + `psutil.virtual_memory().percent` dengan status running tiap service — dipoll frontend tiap 2 detik. |

> ⚠️ Endpoint ini **tidak tercantum** di peta API lama `docs/ai_development_guide.md` §1 — lihat §13 poin 4–6 untuk daftar lengkap endpoint yang belum terdokumentasi.

---

## 3. Lapisan Utilitas (`core/utils/`)

### 3.1 `file_utils.py`

| Fungsi | Perilaku |
|---|---|
| `download_advanced(url, dest, log_cb, prog_cb)` | Kirim `HEAD` dulu untuk cek `Content-Length` & `Accept-Ranges`. Jika server mendukung *byte range* dan ukuran diketahui → `_download_multi_part()` (8 koneksi paralel, file di-*preallocate*, tiap thread menulis potongan byte-nya sendiri, progress digabung via `threading.Lock`). Jika tidak → `_download_single_stream()` (chunked 32KB). HTTP 404 dilempar ulang sebagai `RuntimeError` yang jelas. |
| `extract_archive(zip_path, dest, prog_cb)` | `.zip` → member-by-member (progress tiap 50 file). `.tar.gz` → `extractall()` sekali jalan (progress langsung loncat ke 80%, tidak granular). |
| `read_json(path, default_type=list)` | Baca JSON dengan aman. **Selalu mengembalikan tipe `default_type`** — jika file tidak ada/kosong/JSON tidak valid, ATAU jika isi file valid JSON tapi bertipe berbeda dari `default_type` (mis. file berisi string top-level padahal caller minta `dict`), otomatis fallback ke `default_type()` kosong. Lihat catatan kontrak di bawah. |
| `write_json(path, data)` | Tulis `data` sebagai JSON (`indent=4`), `os.makedirs` otomatis. Return `bool` sukses/gagal — **tidak validasi tipe `data`**, jadi caller tetap bertanggung jawab hanya mengirim `dict`/`list` yang sesuai konvensi file targetnya. |

> ✅ **Temuan audit (sudah diperbaiki):** dokumentasi versi lama mengklaim fungsi ini "mencegah *zip slip vulnerability*", padahal saat itu belum ada validasi path traversal apapun di `_extract_zip`/`_extract_tar_gz`. Sekarang sudah ditambahkan `_is_safe_extract_path()` — setiap member arsip divalidasi dengan `os.path.realpath()` sebelum diekstrak; member yang keluar dari direktori tujuan (mis. `../../evil.exe`) akan menggagalkan seluruh ekstraksi dengan `RuntimeError`. Detail di §13.

> ⚠️ **Kontrak tipe `read_json()`:** parameter `default_type` dulu **hanya** dipakai sebagai nilai fallback saat file tidak ada — bukan jaminan tipe hasil baca. Kalau file ADA dan isinya JSON valid tapi bukan `default_type` (mis. sisa string dari file lama/rusak/edit manual), fungsi lama meneruskan nilai itu apa adanya, sehingga caller yang langsung memanggil `.get()`/iterasi pada hasilnya (tanpa `isinstance` check sendiri) bisa crash. Sekarang `read_json()` sudah memvalidasi `isinstance(data, default_type)` setelah parsing — **hasilnya dijamin bertipe `default_type`**, jadi caller baru tidak perlu lagi menambahkan `isinstance` check sendiri untuk kasus ini. Detail insiden nyata di `docs/known_bugs.md` #17.

### 3.2 `system_utils.py`

| Fungsi | Perilaku |
|---|---|
| `get_project_root()` | Resolusi path aman baik mode `.py` (dev) maupun `.exe` (`sys.frozen`, PyInstaller). |
| `run_silent_command(cmd)` | Eksekusi sinkron tersembunyi (`CREATE_NO_WINDOW`). |
| `start_silent_process(cmd)` | Sama seperti di atas tapi asinkron (untuk daemon Apache/PHP/DB). |
| `check_port_in_use(port, host)` | Cek `socket.create_connection((host, port))` (IPv4) dulu; jika gagal **dan** host adalah `127.0.0.1`/`localhost`, fallback ke `AF_INET6` (`::1`). ✅ **Fix ini terverifikasi masih aktif dan benar** — lihat `docs/known_bugs.md` #1 (PostgreSQL IPv6 timeout). |

---

## 4. `ApacheManager` (`apache.py`)

### 4.1 Dependency & State
- **Constructor**: tidak butuh manager lain saat inisiasi — semua dependency (`self.api.project`, `self.api.ssl`) dicek lazy via `hasattr()` di dalam method.
- **State file**: `data/apache.json` → `{"active_version": "2.4.62"}`. Ada migrasi otomatis dari format lama `data/apache_active_version.txt` (dibaca sekali, ditulis ke JSON baru, file lama dihapus).

### 4.2 Ringkasan API Publik

| Method | Fungsi |
|---|---|
| `get_status()` | List versi terinstall di `bin/apache/`, resolve versi aktif (self-healing jika versi aktif tersimpan sudah tidak ada di disk). |
| `install_version(version, url, port)` | Download → extract → pindah folder → konfigurasi `httpd.conf` (lihat diagram §4.4). |
| `set_active_version(version)` | Ganti versi aktif → **trigger `project.sync_apache_vhosts()`** → restart jika sedang berjalan. |
| `start_server()` | Lihat diagram §4.3. |
| `stop_server()` | `taskkill /F /T /IM httpd.exe` (Windows). |
| `restart_server()` | `stop_server()` + sleep 1s + `start_server()`. |
| `update_global_php_proxy(port, restart=True)` | Menulis ulang `conf/extra/httpd-vyloserve-php.conf` agar proxy FastCGI menunjuk port PHP yang benar. Dipanggil oleh `PhpManager` setiap kali PHP start. |
| `uninstall(version)` | Hapus folder instalasi. |

### 4.3 Workflow: `start_server()` dengan Handshake PHP-Proxy

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant A as ApacheManager
    participant FS as File System (httpd.conf)
    participant P as ProjectManager
    participant OS as OS Process (httpd.exe)

    U->>A: start_server()
    A->>A: guard: sudah running? → error "already_running"
    A->>A: guard: belum terinstall? → error "not_installed"
    A->>FS: _verify_and_patch_httpd()<br/>(re-patch idempoten: DocumentRoot, proxy conf,<br/>regenerate php-proxy conf jika hilang)
    alt self.api.project tersedia
        A->>P: sync_apache_vhosts()
        P-->>A: (vhost conf ditulis ulang)
    end
    A->>OS: start_silent_process([httpd.exe])
    A->>A: sleep(1s)
    A->>OS: proc.poll()
    alt proc sudah exit
        A-->>U: {status: error, message: "backend.apache.port_in_use"}
    else proc masih hidup
        A-->>U: {status: success, message: "backend.apache.started", args: {pid}}
    end
```

> ✅ **Catatan (sudah diperbaiki):** `sync_apache_vhosts()` yang dipanggil di sini sebelumnya menulis ke folder yang salah (`con/extra` bukan `conf/extra`) — lihat §13 poin 1 dan §7.3. Sudah dikoreksi ke `conf/extra`, sehingga virtual host project kini ikut ter-*load* dengan benar saat Apache di-start.

### 4.4 Workflow: `install_version(version, url, port)`

```mermaid
flowchart TD
    Start([install_version dipanggil]) --> Guard{target_dir<br/>sudah ada?}
    Guard -- ya --> ErrExist[return error: already_installed]
    Guard -- tidak --> Log1[emit_log: download_start]
    Log1 --> DL[download_advanced ke zip_path<br/>emit_progress 0→60%]
    DL --> Log2[emit_log: extracting]
    Log2 --> Ext[extract_archive ke temp_extract_dir<br/>emit_progress 60→80%]
    Ext --> DelZip[hapus file zip]
    DelZip --> Move["_move_apache_extract()<br/>pindah folder Apache24/ ke target_dir<br/>(retry 5x, delay 2s jika dikunci OS/AV)"]
    Move --> MoveFail{gagal 5x?}
    MoveFail -- ya --> Raise[raise RuntimeError:<br/>Folder dikunci OS/Antivirus]
    MoveFail -- tidak --> Conf["_configure_httpd(target_dir, port)<br/>emit_progress 80%"]
    Conf --> Done[emit_progress 100%<br/>emit_log: install_success]
    Done --> Success([return status: success])

    Raise --> Rollback
    Conf -.exception.-> Rollback
    DL -.exception.-> Rollback
    Ext -.exception.-> Rollback
    Rollback["ROLLBACK PENUH:<br/>hapus zip + rmtree target_dir + rmtree temp_extract_dir<br/>emit_progress 0, message: install_cancelled"] --> Fail([return status: error])
```

`_configure_httpd()` melakukan regex-patch pada `httpd.conf` (Set `SRVROOT`, `Listen {port}`, `DocumentRoot`, aktifkan `mod_proxy`/`mod_proxy_fcgi`) lalu memanggil `update_global_php_proxy(9000, restart=False)` — port `9000` di sini adalah **asumsi hardcoded** sebagai port PHP default awal (akan di-overwrite begitu PHP benar-benar start di port aslinya, lihat §5.2).

### 4.5 Dependency Lintas-Service (Ringkasan)
- **Butuh** `ProjectManager.sync_apache_vhosts()` — saat start, saat ganti versi aktif.
- **Butuh** `SslManager.generate_domain_cert("localhost")` — saat `update_global_php_proxy()`, untuk blok HTTPS `*:443`. Dibungkus try/except; gagal = skip HTTPS diam-diam.
- **Dibutuhkan oleh** `PhpManager` (proxy port), `ProjectManager` (restart setelah CRUD project), `SslManager` (path `openssl.exe`).

---

## 5. `PhpManager` (`php.py`)

### 5.1 Dependency & State
- `self.processes = {}` — dictionary in-memory `version → Popen`. **Tidak dipersist ke disk**, artinya jika aplikasi VyloServe sendiri di-restart, ia kehilangan jejak proses `php-cgi.exe` yang sebelumnya dia jalankan (proses OS-nya sendiri bisa saja tetap hidup sebagai orphan).
- Port FastCGI disimpan sebagai komentar di dalam `php.ini` itu sendiri (bukan file JSON terpisah).

### 5.2 Workflow: `start_php(version)`

```mermaid
sequenceDiagram
    participant U as User
    participant Php as PhpManager
    participant Reg as Windows Registry
    participant FS as php.ini
    participant OS as php-cgi.exe
    participant Apache as ApacheManager

    U->>Php: start_php(version)
    Php->>Php: guard: sudah running di processes{}? → error
    Php->>Php: guard: binary tidak ada? → error
    Php->>Reg: toggle_global_path(target_dir, enable=True)
    Php->>FS: baca port dari php.ini (default 9000)
    Php->>FS: _verify_and_patch_ini()<br/>(paksa cgi.force_redirect=0, cgi.fix_pathinfo=1)
    Php->>OS: start_silent_process([php-cgi.exe, -b 127.0.0.1:port, -c ini_path])<br/>env: PHP_FCGI_MAX_REQUESTS=0
    Php->>Php: sleep(0.5s) → proc.poll()
    alt proc sudah exit
        Php-->>U: error "backend.php.cgi_failed"
    else proc hidup
        Php->>Apache: update_global_php_proxy(port)
        Note over Apache: Apache menulis ulang conf proxy<br/>agar mengarah ke port PHP yang baru start ini
        Php-->>U: success "backend.php.started"
    end
```

**Ini adalah handshake proxy PHP↔Apache** yang disebut di §4. Setiap kali PHP start di port manapun, ApacheManager langsung diberi tahu lewat panggilan langsung (bukan event), sehingga proxy FastCGI Apache selalu sinkron dengan port PHP yang benar-benar aktif.

### 5.3 Workflow: `toggle_global_path()` — Isolasi Multi-Versi di Registry PATH

Karena PHP mendukung banyak versi berjalan bersamaan, `toggle_global_path()` **selalu membersihkan dulu semua path yang berawalan `bin/php`** dari `HKCU\Environment\Path` sebelum (opsional) menambahkan versi yang baru — mencegah dua versi PHP saling menimpa di PATH sistem. Setelah menulis, ia broadcast `WM_SETTINGCHANGE` via `SendMessageTimeoutW` agar terminal baru langsung mengenali perubahan tanpa restart PC.

### 5.4 Ringkasan API Publik Lainnya

| Method | Fungsi |
|---|---|
| `install_version(version, filename, port)` | Download (dengan fallback URL untuk versi lama) → extract → tulis `php.ini` baru (port + `memory_limit=512M` + ekstensi dasar), lapor progress **92%** ("configuring") → `_install_composer()` (lapor **95%**) → **100%** ("installation_complete") hanya di titik ini, setelah Composer benar-benar terpasang. Progress 92% (bukan 100%) di tahap "configuring" itu sengaja — lihat catatan kontrak `percent` di §2.2 dan `docs/known_bugs.md` #18. |
| `stop_php(version)` | `taskkill /PID` → hapus dari `processes{}` → `toggle_global_path(enable=False)`. |
| `save_config(version, config, extensions)` | Rewrite `php.ini` baris-per-baris (`_update_ini_lines`, mempertahankan baris lain) → **jika Apache sedang berjalan, `restart_server()`**; jika ProjectManager ada, `sync_apache_vhosts()` (keduanya dibungkus bare `try/except: pass`). |
| `start_all()` / `stop_all()` | Baca `data/dashboard.json` → `selected_php` lewat `read_json(path, dict)` (dijamin `dict`, lihat §3.1) → `.get('selected_php', [])` (dipakai tombol "Start Selected" di Dashboard). Fallback ke versi terbaru terinstall jika belum ada preferensi tersimpan. |

### 5.5 ✅ Bug Ditemukan & Diperbaiki: Unbound Exception Variable

```python
# php.py — get_versions() — SEBELUM diperbaiki
except Exception:
    return {"status": "error", "message": str(e)}   # 'e' TIDAK terikat! → NameError
```
Sebelumnya, setiap kali fetch daftar versi PHP dari internet gagal (mis. tidak ada koneksi), alih-alih mengembalikan pesan error yang informatif, kode ini **melempar `NameError: name 'e' is not defined`** yang menutupi error asli. **Sudah diperbaiki** menjadi `except Exception as e:`. Bug identik ditemukan dan diperbaiki 2× lagi di `database.py` (§6.5).

---

## 6. `DatabaseManager` (`database.py`)

### 6.1 Dependency & State
- `bin_dir = bin/database/`, `config_path = data/databases.json` (list instance), `self.processes = {}` (in-memory, caveat sama seperti PHP).
- **Tidak bergantung pada service lain** — modul paling independen di codebase ini.

### 6.2 Workflow: `install_database(engine, version, url, port, root_pass)`

```mermaid
flowchart TD
    Start([install_database]) --> ComputeId[Hitung db_id, install_dir, data_dir]
    ComputeId --> CheckData{data_dir sudah<br/>berisi file?}
    CheckData -- ya --> ReuseData[is_existing_data = True<br/>SKIP init ulang data]
    CheckData -- tidak --> FreshData[is_existing_data = False]
    ReuseData --> GuardInstall
    FreshData --> GuardInstall{install_dir<br/>sudah ada?}
    GuardInstall -- ya --> ErrExist([return error: already_installed])
    GuardInstall -- tidak --> IsMySQL{engine == mysql?}
    IsMySQL -- ya --> ResolveUrl["_resolve_mariadb_url(version)<br/>(abaikan param url, scrape ulang<br/>archive.mariadb.org utk binary OS yang tepat)"]
    IsMySQL -- tidak --> DL
    ResolveUrl --> DL[download_advanced → extract_archive → hapus zip]
    DL --> Unwrap["_unwrap_single_subdir()<br/>flatten folder wrapper tar.gz"]
    Unwrap --> NeedInit{is_existing_data<br/>== False?}
    NeedInit -- ya --> Init["_init_database()<br/>MySQL: mysql_install_db.exe --datadir=<br/>Postgres: initdb.exe -U postgres --pwfile=pw.txt<br/>(pw.txt dihapus segera setelah dipakai)"]
    NeedInit -- tidak --> Register
    Init --> Register["_register_database()<br/>append entry ke databases.json"]
    Register --> Success([return status: success])

    ResolveUrl -.exception.-> Cleanup
    DL -.exception.-> Cleanup
    Init -.exception.-> Cleanup
    Cleanup["_cleanup_install_failure():<br/>hapus zip + rmtree install_dir<br/>rmtree data_dir HANYA JIKA is_existing_data == False<br/>(melindungi data user pada reinstall gagal)"] --> Fail([return status: error])
```

### 6.3 Workflow: `start_database(db_id)`

```mermaid
sequenceDiagram
    participant U as User
    participant D as DatabaseManager
    participant Log as data/{db_id}/db_startup.log
    participant OS as mysqld.exe / postgres.exe

    U->>D: start_database(db_id)
    D->>D: guard: port sudah dipakai? → error
    D->>D: _build_startup_cmd()<br/>(MySQL: --datadir --port | Postgres: -D datadir -p port)
    D->>Log: buka file log untuk redirect stdout/stderr
    D->>OS: subprocess.Popen(cmd, stdout=log_f, stderr=log_f)
    loop polling max 150x @ 0.1s (total 15s)
        D->>D: check_port_in_use(port)?
        alt port terbuka
            D-->>U: success
        else proc.poll() != None (crash)
            D->>Log: baca 250 karakter terakhir sbg pesan error
            D-->>U: error (isi log)
        end
    end
    D-->>U: error "timeout_starting" (jika 15s habis tanpa sinyal)
```

### 6.4 Workflow: `stop_database(db_id)` — Pola Kill-lalu-Graceful (Tidak Biasa)

```mermaid
flowchart LR
    Start([stop_database]) --> Kill["_kill_process()<br/>terminate() → wait 5s → kill() jika masih hidup"]
    Kill --> Check{port masih<br/>terbuka?}
    Check -- tidak --> Done([selesai, port sudah bebas])
    Check -- ya --> Graceful["_graceful_shutdown()<br/>Postgres: pg_ctl -D datadir stop<br/>MySQL: mysqladmin --port= shutdown"]
    Graceful --> Done2([selesai])
```

> **Catatan desain:** Urutan ini terbalik dari konvensi umum ("graceful dulu, baru force-kill jika gagal"). Di sini proses langsung di-*hard-kill*, dan command graceful hanya dipanggil **sebagai fallback kedua** bila port ternyata masih terbuka setelah kill. Ini bukan bug, tapi perilaku yang perlu diketahui developer karena bisa menyebabkan *unclean shutdown* pada database (risiko corruption pada kondisi tertentu) — pertimbangkan membalik urutan ini di masa depan jika ditemukan kasus data korup setelah stop.

### 6.5 ✅ Bug Ditemukan & Diperbaiki: Unbound Exception Variable (2×)
Pola identik dengan §5.5 ditemukan di `_fetch_mariadb_versions()` dan `open_path()` — keduanya sebelumnya punya `except Exception: return {..., "message": str(e)}` tanpa `as e`. Sudah diperbaiki menjadi `except Exception as e:` di keduanya.

### 6.6 Ringkasan API Publik Lainnya

| Method | Fungsi |
|---|---|
| `get_installed()` | Enrich status tiap instance secara paralel (`ThreadPoolExecutor`, 10 worker) — cek proses in-memory dulu, fallback ke `check_port_in_use()`. |
| `change_db_credentials(id, user, old, new)` | MySQL: `mysql.exe -e "ALTER USER..."`. Postgres: `psql.exe` + env `PGPASSWORD`. Non-zero exit → `RuntimeError` diparse jadi `{status: error, args: {err}}`. |
| `save_db_config(id, config)` | Patch `my.ini`/`postgresql.conf` baris-per-baris → **jika sedang jalan, stop lalu start ulang** agar config baru diterapkan. |

---

## 7. `ProjectManager` (`project.py`)

Modul paling kompleks — mengorkestrasi Composer, Apache vhost, Windows `hosts` file (UAC), dan SSL sekaligus.

### 7.1 Workflow Lengkap: `create_project(payload)`

```mermaid
sequenceDiagram
    participant U as User
    participant Pr as ProjectManager
    participant Comp as Composer/WP Installer
    participant PhpM as PhpManager (via Api)
    participant Ap as ApacheManager
    participant Ssl as SslManager
    participant Hosts as C:\Windows\...\hosts

    U->>Pr: create_project(payload)
    Pr->>Pr: guard: domain sudah dipakai? → error
    alt is_existing project
        Pr->>Pr: pakai document_root dari payload langsung
    else project baru
        Pr->>Comp: _install_new_framework()<br/>dispatch: laravel/codeigniter → Composer<br/>wordpress → download+extract<br/>raw → tulis index.php statis
        Comp-->>Pr: document_root hasil scaffold
    end
    Pr->>PhpM: self.api.get_installed_php()<br/>(cari port live utk php_version terpilih)
    PhpM-->>Pr: port aktif (atau fallback 9000)
    Pr->>Pr: append project ke data/projects.json
    Pr->>Ap: sync_apache_vhosts()
    Note over Ap,Ssl: _generate_vhost_block() di dalamnya<br/>juga memanggil ssl.generate_domain_cert(domain)<br/>(try/except — gagal = HTTP-only)
    Pr->>Hosts: sync_windows_hosts() → _write_hosts_with_uac()
    alt tulis langsung berhasil (app run as admin)
        Hosts-->>Pr: OK
    else PermissionError
        Hosts->>Hosts: ShellExecuteW(runas, cmd.exe, copy /Y ...)
        Note over Hosts: Munculkan dialog UAC Windows.<br/>User approve (>32) atau deny.
        Hosts-->>Pr: OK (approved) / soft-warning (denied)
    end
    alt Apache sedang berjalan
        Pr->>Ap: restart_server()
    end
    Pr-->>U: {status: success, message: ..., args: {hosts_warning?}}
```

### 7.2 `_install_composer_framework()` — Detail Sub-Alur Scaffold

```mermaid
flowchart TD
    A[emit_progress 20%: Mengonfigurasi PHP...] --> B["_ensure_composer_exists()<br/>download composer.phar jika belum ada"]
    B --> C["_determine_framework_package()<br/>Laravel → laravel/laravel:version<br/>CodeIgniter → codeigniter4/appstarter (PHP≥8.1)<br/>atau codeigniter/framework (CI3, PHP lama)"]
    C --> D[composer clear-cache — best effort]
    D --> E["_run_composer_create_project()<br/>Popen([php, composer.phar, create-project, ...])<br/>stream stdout, strip ANSI, progress 40→60%"]
    E --> F{exit code<br/>!= 0?}
    F -- ya --> G["_rollback_dir(): rmtree target_dir<br/>return error (150 char terakhir output composer)"]
    F -- tidak --> H[set policy.advisories.block=false — best effort]
    H --> I["_run_composer_update_with_retries()<br/>retry hingga 3x, hapus composer.lock antar percobaan<br/>delay 3s, progress 40→95%"]
    I --> J{gagal setelah<br/>3x percobaan?}
    J -- ya --> G
    J -- tidak --> K["_run_framework_post_install()<br/>Laravel: copy .env.example→.env + artisan key:generate<br/>CodeIgniter4: copy env→.env + set CI_ENVIRONMENT=development"]
    K --> L([return document_root])
```

### 7.3 ✅ Bug Kritis (Sudah Diperbaiki): `sync_apache_vhosts()` Sempat Menulis ke Folder yang Salah

```python
# project.py — sync_apache_vhosts() — SEBELUM diperbaiki
extra_dir = os.path.join(status["path"], 'con', 'extra')   # ❌ SALAH: harusnya 'conf'

# SESUDAH diperbaiki
extra_dir = os.path.join(status["path"], 'conf', 'extra')  # ✅ BENAR
```

```mermaid
flowchart LR
    subgraph "Sebelum diperbaiki (SALAH)"
        Pr1[ProjectManager.sync_apache_vhosts] -->|menulis ke| Wrong["{apache_dir}/con/extra/<br/>vyloserve-vhosts.conf ❌"]
    end
    subgraph "Sesudah diperbaiki (BENAR) — dibaca Apache saat start"
        HttpdConf["httpd.conf<br/>IncludeOptional conf/extra/*.conf"] -->|sekarang membaca| Right["{apache_dir}/conf/extra/<br/>vyloserve-vhosts.conf ✅"]
    end
    Wrong -.->|"dulu tidak pernah terbaca"| HttpdConf
```

**Dampak sebelum diperbaiki:** Virtual host yang dibuat lewat `create_project`/`update_project`/`delete_project`, atau saat ganti versi Apache aktif, kemungkinan tidak pernah benar-benar termuat oleh Apache karena ditulis ke folder yang berbeda dari yang di-*include* `httpd.conf`. `docs/known_bugs.md` versi lama sempat salah mengklaim bug jenis ini ("conf" vs "con") sudah diperbaiki di seluruh proyek, padahal regresi ini masih ada di `project.py`. **Sudah dikoreksi ulang** pada audit ini — lihat §13 dan `docs/known_bugs.md` #3.

### 7.4 `delete_project(id, delete_files)` — Urutan Rollback Aman

```mermaid
flowchart TD
    A[delete_project] --> B[ssl.delete_domain_cert domain]
    B --> C[hapus entry dari projects.json]
    C --> D[sync_windows_hosts]
    D --> E{hosts sync<br/>gagal/UAC ditolak?}
    E -- ya --> F[ROLLBACK: kembalikan entry ke projects.json]
    E -- tidak --> G[sync_apache_vhosts]
    G --> H{Apache berjalan?}
    H -- ya --> I[restart_server]
    H -- tidak --> J
    I --> J{delete_files == true?}
    J -- ya --> K["rmtree project root<br/>(strip trailing /public dulu)"]
    J -- tidak --> L([selesai])
    K --> L
```

### 7.5 Ketergantungan Lintas-Service
`ProjectManager` adalah **konsumen terbesar** service lain: `ApacheManager` (sync vhost + restart), `SslManager` (cert per-domain), dan `Api.get_installed_php()` (resolusi port PHP aktif). Ia juga satu-satunya modul yang menyentuh file sistem Windows di luar direktori aplikasi (`C:\Windows\System32\drivers\etc\hosts`), sehingga satu-satunya sumber UAC prompt di aplikasi ini.

---

## 8. `RuntimesManager` (`runtimes_manager.py`)

Mengelola 4 runtime independen: Node.js, Python, Java (JDK), Go. Tidak bergantung service lain.

### 8.1 Deteksi Instalasi Eksternal (3 Lapis)

```mermaid
flowchart TD
    Start([_check_external_installation]) --> L1["Layer 1: _check_via_where()<br/>jalankan `where <bin>`, exclude path bin/ milik VyloServe"]
    L1 --> F1{ditemukan?}
    F1 -- ya --> Found([return path eksternal])
    F1 -- tidak --> L2["Layer 2: _check_via_registry()<br/>baca HKLM &amp; HKCU \\Environment\\Path<br/>filter path milik VyloServe, shutil.which()"]
    L2 --> F2{ditemukan?}
    F2 -- ya --> Found
    F2 -- tidak --> L3["Layer 3: _check_via_env()<br/>fallback POSIX: cek $PATH langsung"]
    L3 --> F3{ditemukan?}
    F3 -- ya --> Found
    F3 -- tidak --> NotFound([return: tidak ada instalasi eksternal])
```

Hasil deteksi ini dipakai frontend untuk **mengunci toggle "Add to PATH"** jika runtime yang sama sudah terinstall secara native di sistem (mencegah konflik PATH) — lihat `docs/frontend_ui.md` §8.

### 8.2 Pola Install Generik (Node/Python/Java/Go)

```mermaid
flowchart LR
    A[emit_progress 5%: download] --> B[download_advanced → progress 5-60%]
    B --> C[extract_archive → progress 65-95%]
    C --> D{perlu rename<br/>folder hasil extract?}
    D -- "Node: node-vX-win-x64 → bin/node<br/>Java: jdk* → bin/java" --> E[rename folder]
    D -- "Python: embeddable zip sudah flat<br/>Go: zip sudah berisi root go/" --> F[skip rename]
    E --> G[finalize: progress 95-100%]
    F --> G
    G --> Done([selesai])
```

**Kekhususan per-engine:**
- **Node**: opsional jalankan `corepack.cmd enable` jika `enable_corepack=True` (dukungan Yarn/pnpm).
- **Python**: jika `install_pip=True` → patch file `._pth` (uncomment `import site`) → download `get-pip.py` → jalankan dengan env `SSL_CERT_FILE`/`REQUESTS_CA_BUNDLE` mengarah ke `certifi.where()` (Python embeddable tidak punya CA bundle bawaan) → hapus `get-pip.py`.
- **Java**: resolusi via Adoptium API (`api.adoptium.net/v3/binary/latest/...`).
- **Go**: jika versi diminta adalah string literal `"latest"`, resolusi dulu ke nomor versi nyata via `go.dev/dl/?mode=json`.

> ⚠️ **Kontrak `progress_cb` (penting, pernah jadi bug nyata):** callback `progress_cb`/`prog_cb` yang dikirim ke `download_advanced()`/`extract_archive()` (§3.1) selalu dipanggil dengan `pct` berupa **angka absolut 0-100** yang SUDAH dihitung internal oleh `file_utils.py` sendiri (mis. `10 + int(dl_percent * 0.5)` untuk unduhan, `65 + int((index/total)*15)` untuk ekstraksi ZIP) — **bukan** fraksi `0.0-1.0`. `_get_cbs(start_pct, end_pct)` di `RuntimesManager` **tidak mengalikan** `pct` dengan `span` (`start_pct + int(pct * span)` akan meluber ribuan persen, tepat itu yang terjadi di `docs/known_bugs.md` #16) — ia hanya meng-*clamp* `pct` ke `[start_pct, end_pct]` sebagai jaring pengaman. Rentang 5-60%/65-95% di diagram atas adalah **hasil clamp**, bukan hasil perkalian. Kalau menambah service baru yang memakai pola callback serupa, ikuti pola clamp ini, jangan pola kali-dengan-span.

### 8.3 PATH Toggle per Engine

| Engine | Path yang ditambahkan/dihapus | Ekstra |
|---|---|---|
| Node | `bin/node` | — |
| Python | `bin/python`, `bin/python/Scripts` | — |
| Java | `bin/java/bin` | **Juga set/hapus registry value `JAVA_HOME`** |
| Go | `bin/go/bin` | — |

Semua broadcast `WM_SETTINGCHANGE` setelah menulis registry (pola sama seperti `PhpManager.toggle_global_path`).

---

## 9. `GitManager` (`git_manager.py`)

Bentuk paling mirip `RuntimesManager`, dengan tambahan **lapis deteksi ke-4**: `_find_via_hardcoded()` — mengecek path instalasi umum (`%PROGRAMFILES%\Git\cmd\git.exe`, `%PROGRAMFILES(X86)%\...`, `%LOCALAPPDATA%\Programs\Git\cmd\git.exe`) sebagai upaya terakhir setelah `where` dan registry gagal.

**`install_git`**: mengunduh installer self-extracting `.7z.exe` dari rilis GitHub, lalu `_extract_sfx()` menjalankannya dengan flag `-y -o"{git_dir}"` (`shell=True`). ⚠️ **Tidak ada verifikasi checksum/signature** terhadap binary yang diunduh sebelum dieksekusi — pola risiko yang sama berlaku untuk semua unduhan binary di proyek ini (Apache, PHP, Node, Java, Go) — lihat §13.

**`get_git_config`/`set_git_config`**: wrapper `git config --global user.name/user.email`, dengan fallback ke `git` sistem jika PortableGit VyloServe belum terinstall.

---

## 10. `SslManager` (`ssl_manager.py`)

### 10.1 Dependency Kritis ke Apache
`_get_openssl_paths()` memanggil `self.api.apache.get_status()` dan **melempar `RuntimeError`** jika Apache belum terinstall — karena binary `openssl.exe` beserta `openssl.cnf` diambil dari dalam folder instalasi Apache, tidak ada OpenSSL independen.

### 10.2 Workflow: `generate_domain_cert(domain)`

```mermaid
sequenceDiagram
    participant Caller as ApacheManager / ProjectManager
    participant Ssl as SslManager
    participant OpenSSL as openssl.exe (dari bin/apache/)
    participant Store as Windows Trust Store

    Caller->>Ssl: generate_domain_cert(domain)
    Ssl->>Ssl: setup_root_ca() [idempoten]
    alt Root CA belum ada
        Ssl->>OpenSSL: genrsa + req -x509 -new -nodes<br/>-subj "/CN=VyloServe Local Root CA"
        Ssl->>Store: certutil -addstore -f "Root" (via UAC ShellExecuteW)
        Note over Store: User approve/deny dialog UAC.<br/>Deny = return False diam-diam.
    end
    alt cert domain sudah ada
        Ssl-->>Caller: return path existing (skip regenerasi)
    else belum ada
        Ssl->>OpenSSL: genrsa (domain key) + req (CSR)
        Ssl->>Ssl: tulis file .ext (SAN: DNS.1=domain, DNS.2=*.domain)
        Ssl->>OpenSSL: x509 -req -CA root.crt -CAkey root.key -CAcreateserial
        Ssl->>Ssl: hapus file CSR/.ext sementara
        Ssl-->>Caller: return (crt_path, key_path)
    end
```

Dipanggil oleh `ApacheManager.update_global_php_proxy()` (untuk `localhost`) dan `ProjectManager._generate_vhost_block()` (per domain project) — keduanya membungkus panggilan ini dalam `try/except` dan diam-diam turun ke HTTP-only jika gagal.

---

## 11. `DashboardManager` & `SettingsManager`

Keduanya CRUD sederhana tanpa efek samping OS (tidak ada subprocess/registry/network).

| | `DashboardManager` | `SettingsManager` |
|---|---|---|
| File state | `data/dashboard.json` | `data/settings.json` |
| Isi | Toggle tampilan (`apache`/`php`/`database`), array `selected_php`/`selected_database` (dibaca oleh `PhpManager`/`DatabaseManager` untuk fitur "Start Selected") | `language`, `theme` (dapat diperluas) |
| **Semantik `save_config`/`save_settings`** | ⚠️ **Overwrite total** — frontend wajib kirim objek config lengkap, bukan partial patch | **Merge** — membaca dulu isi lama, hanya menimpa key yang dikirim |

> Perbedaan semantik ini penting untuk developer frontend: mengirim `save_dashboard_config({apache: true})` saja akan **menghapus** key lain yang sebelumnya ada (`php`, `database`, `selected_php`, dst), sedangkan `save_app_settings({language: "id"})` aman dikirim parsial.

---

## 12. `main.py` — App Bootstrap & `AppLifecycle`

> ✅ **Update:** `main.py` sebelumnya punya coverage 0% karena seluruh logic exit (`perform_exit`, `on_closing`) terjebak sebagai closure di dalam `if __name__ == '__main__':`, sehingga tidak bisa di-import untuk ditest. Sudah di-refactor menjadi class `AppLifecycle` — lihat detail di bawah.

### 12.1 Alur Bootstrap
1. `main()` membuat instance `Api()`, lalu `AppLifecycle(api, IS_PRODUCTION)`.
2. `webview.create_window(...)` membuat window → `api.set_window(window)` **dan** `lifecycle.set_window(window)` (keduanya perlu tahu window: `api` untuk `emit_log`/`emit_progress`, `lifecycle` untuk hide/destroy).
3. `api.quit_callback = lifecycle.perform_exit` — inilah yang membuat `Api.close_app()` (dipanggil dari tombol Quit UI) benar-benar memicu cleanup.
4. `window.events.closing += lifecycle.on_closing` — dipanggil setiap kali user menekan tombol (X).
5. Jika `IS_PRODUCTION`, `setup_systray(lifecycle, icon_path)` dipanggil untuk mengaktifkan ikon System Tray.
6. `webview.start(...)` — blocking call, baru return saat window benar-benar ditutup.

### 12.2 `AppLifecycle` — Satu Sumber Kebenaran untuk Exit/Hide

```mermaid
flowchart TD
    A["Trigger exit:<br/>Tombol Quit UI (api.close_app)<br/>ATAU Tray 'Exit Engine'"] --> B["lifecycle.perform_exit()"]
    B --> C[apache.stop_server try/except]
    C --> D[php.stop_all try/except]
    D --> E[database.stop_all try/except]
    E --> F{tray_icon di-set?}
    F -- ya --> G[tray_icon.stop try/except]
    F -- tidak --> H
    G --> H{window di-set?}
    H -- ya --> I[window.destroy try/except]
    H -- tidak --> J
    I --> J[os._exit(0)]

    K["Tombol (X) window<br/>window.events.closing"] --> L["lifecycle.on_closing()"]
    L --> M{is_production?}
    M -- tidak --> N["is_real_exit=True<br/>return True (destroy window)"]
    M -- ya --> O{is_real_exit sudah True?<br/>(dari perform_exit sebelumnya)}
    O -- tidak --> P["window.hide()<br/>return False (batalkan destroy)"]
    O -- ya --> Q["return True (destroy window)"]
```

**Kedua jalur exit (tombol Quit UI dan menu Tray "Exit Engine") kini memanggil `perform_exit()` yang sama** — sebelumnya menu Tray punya jalur pintas terpisah yang melewatkan cleanup engine (lihat `docs/known_bugs.md` #15).

### 12.3 Kenapa Diekstrak Jadi Class
`AppLifecycle` menyimpan `api`, `window`, `tray_icon`, `is_real_exit` sebagai atribut instance (bukan variabel global `is_real_exit`/`global_tray_icon` + closure seperti sebelumnya). Ini membuatnya bisa diinstansiasi langsung di unit test dengan `MagicMock()` sebagai pengganti `api`/`window`/`tray_icon`, tanpa perlu menjalankan `pywebview`/`webview.start()` sungguhan. Lihat `tests/test_main.py` untuk cakupan penuh (bootstrap, exit, hide-to-tray, system tray).

---

## 13. Known Issues — Temuan Audit Backend

Tabel ini adalah hasil audit langsung terhadap kode per tanggal dokumen ini ditulis. Status diperbarui secara jujur — beberapa klaim "sudah fixed" di dokumentasi sebelumnya **terbukti salah** saat kode benar-benar dibaca ulang.

| # | Temuan | Lokasi | Severity | Status |
|---|---|---|---|---|
| 1 | Typo `conf`→`con` — `sync_apache_vhosts()` menulis vhost ke folder yang tidak di-*include* `httpd.conf` | `core/services/project.py` (`sync_apache_vhosts`) | 🔴 Kritis — bug fungsional | ✅ **Sudah diperbaiki** — path diganti ke `conf/extra` |
| 2 | Proses child tidak dimatikan saat Quit — `main.py` `perform_exit()` tidak memanggil `apache.stop_server()`/`php.stop_all()`/`database.stop_all()` sebelum `os._exit(0)` | `main.py` (`perform_exit`) | 🔴 Kritis — bug fungsional | ✅ **Sudah diperbaiki** — ketiga fungsi stop dipanggil (masing-masing try/except) sebelum exit |
| 3 | `except Exception:` tanpa `as e` padahal mereferensikan `str(e)` → `NameError` menutupi error asli | `php.py.get_versions()`, `database.py._fetch_mariadb_versions()`, `database.py.open_path()` | 🟡 Sedang | ✅ **Sudah diperbaiki** — ketiganya jadi `except Exception as e:` |
| 4 | Klaim "`extract_archive()` mencegah zip slip" tidak akurat — tidak ada validasi path traversal di kode | `core/utils/file_utils.py` | 🟡 Dokumentasi tidak akurat + hardening | ✅ **Sudah diperbaiki** — ditambahkan `_is_safe_extract_path()`, diterapkan ke `_extract_zip` & `_extract_tar_gz` |
| 5 | Tidak ada verifikasi checksum/signature pada binary yang diunduh (Apache, PHP, Node, Python, Java, Go, Git) | Semua `install_*`/`install_version` di `core/services/*.py` | 🟢 Rendah (semua URL fixed ke vendor resmi) | Belum diperbaiki — hardening opsional, lihat `docs/known_bugs.md` #8 untuk alasan tidak diotomasi sekarang |
| 6 | `PROJECT_NOT_LOADED_MSG` direferensikan tapi tidak pernah didefinisikan | `core/api.py` (`get_projects`, `delete_project`, dll) | 🟢 Rendah (dead code saat ini) | ✅ **Sudah diperbaiki** — konstanta didefinisikan + translation key ditambahkan ke `en`/`id` |
| 7 | Endpoint `close_app()`, `open_db_config_file()`, `open_db_dir()`, `get_available_python_versions()`, dll belum masuk peta API | Dokumentasi | 🟢 Gap dokumentasi | ✅ Ditambahkan ke `ai_development_guide.md` |
| 8 | Urutan `stop_database()` (hard-kill dulu, graceful-shutdown belakangan sebagai fallback) terbalik dari konvensi umum | `database.py.stop_database()` | 🟢 Perilaku desain, bukan bug | Dicatat, tidak diubah kecuali ada laporan data corruption |
| 9 | Event `vylo_progress` bocor lintas modul frontend (semua halaman selalu mounted, tidak ada filter sumber) | `core/api.py` + semua `menu/*/Main.tsx` yang listen `vylo_progress` | 🟡 Sedang — UX membingungkan | ✅ **Sudah diperbaiki** — `emit_log`/`emit_progress` auto-deteksi `source` via `inspect`, listener frontend memfilter berdasarkan `source` |
| 10 | Migrasi legacy `apache_active_version.txt` selalu gagal diam-diam di Windows (`os.remove()` dipanggil saat file masih terbuka → `PermissionError` tertelan) | `apache.py._get_active_version()` | 🟡 Sedang — fitur migrasi tidak pernah benar-benar jalan | ✅ **Sudah diperbaiki** — `os.remove()` dipindah ke luar blok `with` |
| 11 | `uninstall_go()` tidak punya `return` sama sekali (implisit `None`) — frontend salah menampilkan error walau sukses | `runtimes_manager.py.uninstall_go()` | 🟡 Sedang — bug fungsional UX | ✅ **Sudah diperbaiki** — ditambahkan `return {"status": "success"}` |
| 12 | `install_java()`/`install_go()` hanya menangkap `except OSError`, melewatkan `RuntimeError` yang dilempar sendiri di dalam try-nya → crash tidak tertangkap | `runtimes_manager.py` | 🔴 Bisa crash saat folder JDK tidak ditemukan setelah ekstrak | ✅ **Sudah diperbaiki** — diubah jadi `except Exception as e:`, konsisten dengan `install_node`/`install_python` |
| 13 | Menu Tray "Exit Engine" punya jalur exit terpisah yang melewatkan cleanup engine (Apache/PHP/Database) — bug #2 sebenarnya masih bisa terjadi lewat jalur ini | `main.py` (`setup_systray.on_exit_clicked`, sebelum refactor) | 🔴 Kritis — bug fungsional (zombie process via jalur lain) | ✅ **Sudah diperbaiki** — kini memanggil `lifecycle.perform_exit()` yang sama dengan tombol Quit UI, sekaligus bagian dari refactor `main.py` → `AppLifecycle` (§12) |
| 14 | `_get_cbs()`'s `download_cb` memperlakukan `pct` (absolut 0-100 dari `file_utils.py`) seolah fraksi `0.0-1.0`, mengalikannya dengan `span` → progress meluber ribuan persen saat unduhan/ekstraksi, lalu "melompat mundur" saat tahap berikutnya mengirim nilai tetap | `runtimes_manager.py._get_cbs()`, `git_manager.py.install_git()` (multiplier lebih kecil, gejala tersamar) | 🔴 Kritis — bug UX nyata, dilaporkan pengguna | ✅ **Sudah diperbaiki** — `download_cb` sekarang meng-*clamp* `pct` ke `[start_pct, end_pct]`, bukan mengalikan. Lihat §8.2 & `docs/known_bugs.md` #16 |
| 15 | `read_json(path, dict).get(...)` dipanggil langsung tanpa `isinstance` check di 2 tempat — crash `AttributeError: 'str' object has no attribute 'get'` jika file JSON valid tapi bukan objek | `php.py._get_preferred_versions()`, `database.py._get_preferred_dbs()` | 🔴 Kritis — crash tidak konsisten (tergantung isi file saat itu) | ✅ **Sudah diperbaiki** — root cause di `read_json()` sendiri (§3.1, sekarang menjamin tipe), plus `isinstance` guard eksplisit di kedua caller. Lihat `docs/known_bugs.md` #17 |
| 16 | Tahap "configuring" pada `install_version()` PHP melapor progress **100%** padahal Composer (tahap berikutnya) belum dipasang → melanggar kontrak `percent>=100 = selesai` (§2.2) → widget progress frontend menghilang mid-instalasi | `php.py.install_version()` | 🔴 Kritis — bug UX nyata, dilaporkan pengguna | ✅ **Sudah diperbaiki** — diganti jadi 92%; 100% dicadangkan khusus untuk `"backend.php.installation_complete"`. Lihat `docs/known_bugs.md` #18 |

> Lihat `docs/known_bugs.md` untuk detail lengkap tiap perbaikan (#3, #6–#18 di dokumen tersebut berkorespondensi dengan tabel di atas).
