# Panduan Pengembangan untuk AI (AI Development Guide)

> Dokumen ini adalah referensi **khusus untuk Asisten AI** yang mengerjakan VyloServe.
> Tujuannya: Mempersingkat waktu orientasi, mempercepat debugging, dan memastikan implementasi fitur baru konsisten dengan pola yang sudah ada.

---

## 1. Peta Lengkap API Backend ↔ Frontend

### Cara Membaca Tabel Ini
- **Endpoint (JS)**: Nama fungsi yang dipanggil dari React via `window.pywebview.api.<nama>()`
- **Handler Python**: Fungsi di `core/api.py` yang menerimanya
- **Delegasi ke**: Manager spesifik yang menjalankan logika sesungguhnya

### Apache Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_available_apache()` | `get_available_apache()` | `apache.get_available_versions()` |
| `install_apache(version, url, port)` | `install_apache()` | `apache.install_version()` |
| `get_apache_status()` | `get_apache_status()` | `apache.get_status()` |
| `start_apache_server()` | `start_apache_server()` | `apache.start_server()` |
| `stop_apache_server()` | `stop_apache_server()` | `apache.stop_server()` |
| `uninstall_apache()` | `uninstall_apache()` | `apache.uninstall()` |
| `get_apache_installed_versions()` | `get_apache_installed_versions()` | `apache.get_installed_versions()` |
| `set_apache_active_version(ver)` | `set_apache_active_version()` | `apache.set_active_version()` |
| `open_apache_file(type)` | `open_apache_file()` | `apache.open_apache_file()` |
| `open_apache_directory()` | `open_apache_directory()` | `apache.open_directory()` |
| `open_apache_config()` | `open_apache_config()` | `apache.open_config()` |

### PHP Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_php_versions()` | `get_php_versions()` | `php.get_versions()` |
| `install_php(ver, filename, port)` | `install_php()` | `php.install_version()` |
| `get_installed_php()` | `get_installed_php()` | `php.get_installed_instances()` |
| `get_php_config(ver)` | `get_php_config()` | `php.get_config()` |
| `save_php_config(ver, cfg, ext)` | `save_php_config()` | `php.save_config()` |
| `start_php(ver)` | `start_php()` | `php.start_php()` |
| `stop_php(ver)` | `stop_php()` | `php.stop_php()` |
| `uninstall_php(ver)` | `uninstall_php()` | `php.uninstall_version()` |
| `open_php_ini(ver)` | `open_php_ini()` | `php.open_path(is_file=True)` |
| `open_php_dir(ver)` | `open_php_dir()` | `php.open_path(is_file=False)` |

### Database Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_installed_databases()` | `get_installed_databases()` | `database.get_installed()` |
| `get_available_databases(engine)` | `get_available_databases()` | `database.get_available_versions()` |
| `install_database(engine,ver,url,port,pass)` | `install_database()` | `database.install_database()` |
| `uninstall_database(id, del_data)` | `uninstall_database()` | `database.uninstall_database()` |
| `start_database(id)` | `start_database()` | `database.start_database()` |
| `stop_database(id)` | `stop_database()` | `database.stop_database()` |
| `get_db_config(id)` | `get_db_config()` | `database.get_db_config()` |
| `save_db_config(id, cfg)` | `save_db_config()` | `database.save_db_config()` |
| `change_db_credentials(id,user,old,new)` | `change_db_credentials()` | `database.change_db_credentials()` |
| `check_port_in_use(port)` | `check_port_in_use()` | `database.is_port_in_use()` |
| `open_db_config_file(db_id)` | `open_db_config_file()` | `database.open_path(is_file=True)` |
| `open_db_dir(db_id)` | `open_db_dir()` | `database.open_path(is_file=False)` |

### Runtimes Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_node_status()` | `get_node_status()` | `runtimes_manager.get_node_status()` |
| `install_node(mode, corepack)` | `install_node()` | `runtimes_manager.install_node()` |
| `uninstall_node()` | `uninstall_node()` | `runtimes_manager.uninstall_node()` |
| `get_available_node_versions()` | `get_available_node_versions()` | `runtimes_manager.get_available_node_versions()` |
| `get_python_status()` | `get_python_status()` | `runtimes_manager.get_python_status()` |
| `install_python(minor, pip)` | `install_python()` | `runtimes_manager.install_python()` |
| `uninstall_python()` | `uninstall_python()` | `runtimes_manager.uninstall_python()` |
| `get_java_status()` | `get_java_status()` | `runtimes_manager.get_java_status()` |
| `install_java(ver)` | `install_java()` | `runtimes_manager.install_java()` |
| `uninstall_java()` | `uninstall_java()` | `runtimes_manager.uninstall_java()` |
| `get_go_status()` | `get_go_status()` | `runtimes_manager.get_go_status()` |
| `install_go(ver)` | `install_go()` | `runtimes_manager.install_go()` |
| `uninstall_go()` | `uninstall_go()` | `runtimes_manager.uninstall_go()` |
| `toggle_global_path(engine, enable)` | `toggle_global_path()` | `runtimes_manager.toggle_user_path()` |
| `get_available_python_versions()` | `get_available_python_versions()` | `runtimes_manager.get_available_python_versions()` |
| `get_available_java_versions()` | `get_available_java_versions()` | `runtimes_manager.get_available_java_versions()` |
| `get_available_go_versions()` | `get_available_go_versions()` | `runtimes_manager.get_available_go_versions()` |

### Project & Git Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_projects()` | `get_projects()` | `project.get_projects()` |
| `create_project(payload)` | `create_project()` | `project.create_project()` |
| `update_project(payload)` | `update_project()` | `project.update_project()` |
| `delete_project(id, del_files)` | `delete_project()` | `project.delete_project()` |
| `detect_framework(dir)` | `detect_framework()` | `project.detect_framework()` |
| `retry_sync_host(id)` | `retry_sync_host()` | `project.retry_sync_host()` |
| `open_in_explorer(path)` | `open_in_explorer()` | `project.open_in_explorer()` |
| `get_git_status()` | `get_git_status()` | `git_manager.get_git_status()` |
| `install_git(url, file, ver)` | `install_git()` | `git_manager.install_git()` |
| `uninstall_git()` | `uninstall_git()` | `git_manager.uninstall_git()` |
| `toggle_git_path(enable)` | `toggle_git_path()` | `git_manager.toggle_user_path()` |
| `get_git_config()` | `get_git_config()` | `git_manager.get_git_config()` |
| `set_git_config(name, email)` | `set_git_config()` | `git_manager.set_git_config()` |

### System & Utility Endpoints
| Endpoint (JS) | Handler Python | Delegasi ke |
|--------------|----------------|-------------|
| `get_all_services_status()` | `get_all_services_status()` | `apache/php/database + psutil` |
| `start_service(id)` | `start_service()` | Dispatch ke manager |
| `stop_service(id)` | `stop_service()` | Dispatch ke manager |
| `get_dashboard_config()` | `get_dashboard_config()` | `dashboard.get_config()` |
| `save_dashboard_config(data)` | `save_dashboard_config()` | `dashboard.save_config()` |
| `get_app_settings()` | `get_app_settings()` | `settings.get_settings()` |
| `save_app_settings(data)` | `save_app_settings()` | `settings.save_settings()` |
| `browse_directory()` | `browse_directory()` | `window.create_file_dialog()` |
| `open_browser(url)` | `open_browser()` | `webbrowser.open()` |
| `test_connection(data)` | `test_connection()` | Return ping |
| `close_app()` | `close_app()` | `quit_callback()` (jika di-set `main.py`) atau `os._exit(0)` langsung — lihat `docs/known_bugs.md` #6 untuk isu cleanup proses child |

---

## 2. Peta File & Tanggung Jawab

### Backend Files
| File | Ukuran | Tanggung Jawab |
|------|--------|----------------|
| `core/api.py` | ~361 baris | Facade/Router — meneruskan semua panggilan JS ke manager |
| `core/services/apache.py` | ~448 baris | Instalasi, konfigurasi, dan lifecycle httpd.exe |
| `core/services/php.py` | ~392 baris | Multi-version PHP-CGI, extensions, php.ini management |
| `core/services/database.py` | ~608 baris | MySQL/MariaDB dan PostgreSQL daemon management |
| `core/services/project.py` | ~488 baris | VirtualHost, Composer, UAC hosts injection |
| `core/services/runtimes_manager.py` | ~758 baris | Node, Python, Java, Go — Windows Registry PATH injection |
| `core/services/git_manager.py` | ~363 baris | PortableGit installer dan PATH management |
| `core/services/ssl_manager.py` | ~101 baris | Root CA generation via OpenSSL |
| `core/services/dashboard.py` | ~65 baris | CRUD konfigurasi dashboard (JSON) |
| `core/services/settings.py` | ~62 baris | CRUD preferensi aplikasi (bahasa, tema) |
| `core/utils/file_utils.py` | ~188 baris | JSON I/O, download multi-part, ekstraksi ZIP/TAR |
| `core/utils/system_utils.py` | - | subprocess silent, port checker, path resolver |
| `main.py` | - | Entrypoint: PyWebView window + System Tray setup |

### Frontend Files (Halaman Utama)
| File | Ukuran | Konten |
|------|--------|--------|
| `menu/dashboard/Main.tsx` | ~740 baris | ⚠️ File terbesar — Dashboard cards, hardware monitor |
| `menu/runtimes/Main.tsx` | ~505 baris | Runtime cards (Node, Python, Java, Go) |
| `menu/tools/git/Main.tsx` | ~432 baris | Git manager UI |
| `menu/apache/Main.tsx` | ~391 baris | Apache server UI (Golden Standard) |
| `menu/apache/NewProject.tsx` | ~346 baris | Form buat proyek baru |
| `menu/database/Main.tsx` | ~307+ baris | Database instance cards |

---

## 3. Data Storage — Lokasi & Format JSON

Semua state aplikasi disimpan di folder `data/` (di-ignore git). Format **selalu JSON**.

| File JSON | Isi | Dibaca oleh |
|-----------|-----|-------------|
| `data/apache.json` | `{"active_version": "2.4.62", "port": 80}` | `ApacheManager` |
| `data/database.json` | List of database instances `[{id, engine, version, port}]` | `DatabaseManager` |
| `data/settings.json` | `{"language": "en", "default_apache_install_location": "", "system_log_levels": null, "system_log_sources": null}` — preferensi UI generik, mudah diperluas lewat `default_config` di `SettingsManager.get_settings()`. `system_log_*`: `null` = belum dikustomisasi (tampilkan semua), array APAPUN (termasuk `[]`) = daftar eksplisit tersimpan — **jangan** pakai `[]` sebagai default, itu bug lama yang bikin "uncheck semua lalu Save" terlihat gagal tersimpan (lihat `docs/known_bugs.md` #26). JANGAN pakai `localStorage` browser untuk apa pun yang perlu bertahan antar sesi (lihat `docs/known_bugs.md` #24) | `SettingsManager` |
| `data/dashboard.json` | Toggle config mana service yang tampil | `DashboardManager` |
| `data/db_startup.log` | Error log saat daemon DB gagal start | `DatabaseManager` |
| `data/VyloServeRootCA.key` | SSL private key | `SslManager` |

> **Catatan AI:** Gunakan `core/utils/file_utils.read_json(path, dict)` untuk membaca. Jangan buka manual dengan `open()`.

---

## 4. Pola Debugging (Debugging Patterns)

### 4.1 Backend Crash — Langkah Diagnosis

```
GEJALA: Frontend stuck / tidak ada response dari api.xxx()

LANGKAH:
1. Cek apakah ada Exception Python yang tidak tertangkap
   → Search: grep -r "except Exception: pass" core/
   → Pattern berbahaya — pastikan exception di-log minimal

2. Verifikasi data JSON tidak korup
   → Cek apakah file di data/ valid JSON
   → Test: python -c "import json; json.load(open('data/apache.json'))"

3. Cek apakah Manager berhasil diinisiasi
   → Tambahkan print sementara di core/api.py __init__

4. Verifikasi path executable ada
   → Cek os.path.exists(exe_path) sebelum subprocess.run
```

### 4.2 Frontend Tidak Menerima Response

```
GEJALA: Tombol diklik, tidak ada Toast/perubahan UI

LANGKAH:
1. Cek apakah pywebview API sudah siap
   → Di App.tsx, isApiReady harus True sebelum memanggil API
   → Event: window.addEventListener('pywebviewready', ...)

2. Verifikasi nama fungsi di frontend cocok dengan nama di api.py
   → Contoh SALAH: api.startApache() vs api.start_apache_server()

3. Cek apakah response backend dihandle dengan benar
   → Backend WAJIB return dict {"status": "success/error", "message": "..."}
   → Frontend harus cek res.status sebelum res.message

4. Cek apakah event vylo_log sampai ke frontend
   → Buka browser DevTools (jika IS_PRODUCTION=False)
   → Cek console.error / Network tab
```

### 4.3 Event Emitter Tidak Berjalan

```
GEJALA: Progress bar / log panel tidak muncul saat instalasi

PENYEBAB UMUM:
- self.api._window belum di-set (set_window() belum dipanggil)
- Backend memanggil emit_log() dari thread berbeda tanpa GIL lock

SOLUSI:
1. Pastikan main.py memanggil api.set_window(window) setelah window dibuat
2. Gunakan try-except di emit_log() untuk mencegah crash silent

CONTOH GUARD YANG BENAR:
def emit_log(self, message, level="info", args=None):
    if not self._window:
        return  # Silent skip — window belum siap
    try:
        detail = json.dumps({"message": message, "level": level, "args": args or {}})
        self._window.evaluate_js(...)
    except Exception:
        pass  # Window mungkin sudah tertutup
```

### 4.4 Windows PATH / Registry Tidak Terupdate

```
GEJALA: Node/Python/Go terinstall tapi tidak terdeteksi di terminal baru

PENYEBAB:
- toggle_user_path() berhasil write registry tapi signal broadcast gagal

DIAGNOSIS:
1. Verifikasi key registry:
   reg query "HKCU\Environment" /v Path

2. Pastikan SendMessageTimeoutW dipanggil setelah update:
   ctypes.windll.user32.SendMessageTimeoutW(
       0xFFFF, 0x001A, 0, "Environment", 0x0002, 5000, None
   )

3. Cek apakah antivirus memblokir winreg write
```

### 4.5 Database Timeout Saat Start

```
GEJALA: "Timeout waiting for database to start" padahal DB sebenarnya hidup

PENYEBAB TERVERIFIKASI (Known Bug #1):
- Windows 11 modern: PostgreSQL bind ke ::1 (IPv6), bukan 127.0.0.1 (IPv4)
- check_port_in_use() hanya cek IPv4

SOLUSI YANG SUDAH ADA:
- system_utils.py check_port_in_use() sudah punya fallback IPv6
- Jika bug muncul lagi, cek apakah fallback masih aktif

DIAGNOSIS MANUAL:
netstat -an | findstr ":5432"
```

---

## 5. Pola Implementasi Fitur Baru (Implementation Patterns)

### 5.1 Template: Menambah Endpoint Backend Baru

```python
# Langkah 1: Tambahkan fungsi di core/services/your_service.py
class YourManager:
    def new_feature(self, param: str) -> dict:
        """Deskripsi singkat fungsi ini."""
        # Validasi input
        if not param or not isinstance(param, str):
            return {"status": "error", "message": "backend.error.invalid_input"}
        
        # Logika utama
        self.api.emit_log("backend.your_service.doing_something", "info")
        try:
            # ... logika
            return {"status": "success", "message": "backend.your_service.done"}
        except RuntimeError as e:
            # JANGAN "message": str(e) — itu string mentah, tidak diterjemahkan.
            # Selalu key + args, gunakan key generik jika belum ada key spesifik.
            return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}

# Langkah 2: Daftarkan di core/api.py
def your_new_endpoint(self, param: str) -> dict:
    return self.your_service.new_feature(param)

# Langkah 3: Tambahkan translation key di frontend/src/locales/en/translation.json
# "your_service": { "doing_something": "Processing...", "done": "Done!" }

# Langkah 4: Buat unit test di tests/test_services/test_your_service.py
```

### 5.2 Template: Memanggil Backend dari Frontend

```typescript
// Pattern standar (sesuai Golden Standard Apache/PHP)
const handleNewFeature = async () => {
    if (!isApiReady) return;
    const api = window.pywebview?.api;
    setIsLoading(true);
    try {
        const res = await api.your_new_endpoint(param);
        if (res?.status === 'success') {
            showToast(t(res.message), 'success');
            // refresh data jika perlu
            await loadData();
        } else {
            showToast(t(res?.message || 'common.error'), 'error');
        }
    } catch (err) {
        console.error(err);
        showToast(t('common.error'), 'error');
    } finally {
        setIsLoading(false);
    }
};
```

### 5.3 Template: Long-Running Task (Instalasi)

```python
# Backend: Gunakan emit_log + emit_progress, JANGAN blocking return
def install_something(self, version: str) -> dict:
    try:
        self.api.emit_progress(0, "backend.common.starting")
        
        # Step 1 — Download
        self.api.emit_log("backend.x.downloading", "info", {"version": version})
        self.api.emit_progress(10, "backend.common.downloading")
        download_advanced(url, dest, log_cb=self.api.emit_log, progress_cb=self.api.emit_progress)
        
        # Step 2 — Extract
        self.api.emit_progress(65, "backend.common.extracting")
        extract_archive(zip_path, dest_dir, progress_cb=self.api.emit_progress)
        
        # Step 3 — Configure
        self.api.emit_progress(85, "backend.common.configuring")
        # ... konfigurasi
        
        self.api.emit_progress(100, "backend.common.done")
        return {"status": "success", "message": "backend.x.installed"}
    except RuntimeError as e:
        # Sama seperti §5.1: key + args, bukan str(e) mentah.
        return {"status": "error", "message": "backend.error.unexpected", "args": {"e": str(e)}}
```

```typescript
// Frontend: Dengarkan event dari BackgroundProgressWidget
// Komponen ini sudah mendengarkan 'vylo_progress' dan 'vylo_log' secara global
// Cukup panggil API — progress bar muncul otomatis
const handleInstall = async () => {
    const res = await api.install_something(version);
    // BackgroundProgressWidget menampilkan progress secara realtime
    if (res.status === 'success') showToast(t(res.message), 'success');
};
```

---

## 6. Panduan Troubleshooting Frontend

### 6.1 Komponen React Tidak Re-render Setelah API Call

```
PENYEBAB: State tidak diupdate setelah response

SOLUSI:
- Pastikan ada await loadData() atau setState() setelah API call sukses
- Jika menggunakan useEffect dependency, pastikan dependency list benar
- Jangan mutasi state secara langsung (gunakan spread: {...prev, key: val})
```

### 6.2 Hook Order Violation (React Error)

```
ERROR: "Rendered more hooks than during the previous render"

PENYEBAB:
- Hook dipanggil di dalam conditional atau setelah early return

SOLUSI (Aturan #4 AGENTS.md):
- SELALU deklarasikan SEMUA hooks di bagian paling atas fungsi komponen
- Baru kemudian lakukan conditional check

// SALAH
if (!isReady) return <Loading />;
const { t } = useTranslation(); // Hook setelah early return!

// BENAR
const { t } = useTranslation(); // Semua hooks di atas
if (!isReady) return <Loading />;
```

### 6.3 Translation Key Tidak Ditemukan (Tampil sebagai Key)

```
GEJALA: UI/Log Panel menampilkan "backend.apache.started" bukan teks terjemahan,
        atau menampilkan teks Bahasa Indonesia mentah walau bahasa aplikasi = English.

LANGKAH:
1. Jalankan `python -m pytest tests/test_i18n_keys.py -v` — test ini otomatis
   memindai semua literal "backend.xxx.yyy" di core/ dan menandai key yang
   tidak terdaftar di salah satu/kedua file locale (typo, atau lupa ditambahkan).
2. Jika testnya LULUS tapi bug tetap muncul: kemungkinan besar kode masih
   mengirim STRING MENTAH (bukan key sama sekali), bukan key yang salah nama —
   test di atas hanya menangkap key yang SUDAH berupa string "backend.*", bukan
   f-string/literal biasa. Grep manual: cari `self._log(f"`, `self._emit_log(f"`,
   `self._progress(`, `self.api.emit_log(f"` di service terkait — semua argumen
   msg/text WAJIB "backend.xxx.yyy", tidak boleh f-string atau .format().
3. Cek apakah key sudah ada di en/translation.json dan id/translation.json
4. Verifikasi namespace: pastikan key tidak salah prefix
   - "backend.xxx" = key yang dikembalikan backend → diterjemahkan di frontend
   - "ui.xxx" = key UI yang digunakan langsung di komponen TSX
5. Pastikan i18n sudah diinisialisasi di main.tsx sebelum render
6. Jika wrapper `_log()`/`_progress()` service tersebut baru dibuat, pastikan
   signature-nya menerima & meneruskan `args` (lihat `docs/backend_services.md` §2.2)
   — wrapper yang membuang `args` sering jadi alasan developer menyerah dan
   menulis f-string mentah alih-alih key + args.
```

### 6.4 `pywebview.api` Undefined

```
GEJALA: "Cannot read properties of undefined (reading 'start_apache_server')"

PENYEBAB: API dipanggil sebelum bridge PyWebView siap

SOLUSI:
- Gunakan guard: if (!isApiReady) return;
- isApiReady di-set True oleh App.tsx saat event 'pywebviewready' diterima
- Jangan panggil api di dalam useEffect tanpa dependency [isApiReady]
```

---

## 7. Konteks Dependency Antar Service

Beberapa service memiliki ketergantungan yang wajib diketahui:

```
PhpManager
 └── Memanggil ApacheManager.update_global_php_proxy(port) setiap start_php()/save_config()/uninstall()
 └── TIDAK menyimpan port di JSON — port dibaca dari komentar di dalam php.ini itu sendiri

ApacheManager
 └── Memanggil ProjectManager.sync_apache_vhosts() saat start_server()/set_active_version()
 └── Memanggil SslManager.generate_domain_cert("localhost") saat update_global_php_proxy() (try/except, silent HTTP-only jika gagal)
 └── Membaca/menulis: data/apache.json

ProjectManager
 └── Memanggil ApacheManager.sync_apache_vhosts() + restart_server() setiap create/update/delete project
 └── Memanggil SslManager.generate_domain_cert(domain)/delete_domain_cert(domain) per project
 └── Memanggil Api.get_installed_php() untuk resolusi port PHP aktif (lintas-facade, bukan langsung ke PhpManager)
 └── Menulis ke: C:/Windows/System32/drivers/etc/hosts (UAC!)
 └── Membaca/menulis: data/projects.json

SslManager
 └── Membutuhkan ApacheManager → get_status() untuk path openssl.exe & openssl.cnf (RuntimeError jika Apache belum terinstall)
 └── Menulis ke Windows Trust Store via certutil.exe (UAC!)
 └── Dipanggil OLEH ApacheManager dan ProjectManager (lihat di atas) — relasi SIRKULER dengan ApacheManager

DatabaseManager
 └── TIDAK bergantung service lain
 └── Membaca/menulis: data/databases.json

RuntimesManager / GitManager
 └── Menulis ke Windows Registry: HKCU\Environment\Path (+ JAVA_HOME khusus Java)
 └── TIDAK bergantung service lain
```

> Diagram lengkap (graph TD) dependency di atas tersedia di `docs/backend_services.md` §1.

---

## 8. Checklist Serah Terima Fitur (Definition of Done)

Sebelum menyerahkan perubahan, pastikan seluruh checklist ini terpenuhi:

### Backend
- [ ] Fungsi publik baru memiliki docstring yang menjelaskan tujuan dan return value
- [ ] Semua input dari frontend divalidasi tipe dan nilainya di `api.py`
- [ ] Return value selalu `{"status": "success/error", "message": "translation.key"}`
- [ ] Tidak ada hardcoded path (gunakan `get_project_root()`)
- [ ] Tidak ada hardcoded pesan string — **berlaku juga untuk log/progress internal**
      (`self._log(...)`, `self._progress(...)`, `self.api.emit_log(...)`,
      `self.api.emit_progress(...)`), bukan cuma field `"message"` return value
- [ ] `except Exception as e: return {"message": str(e)}` **DILARANG** — pakai
      `"message": "backend.error.unexpected", "args": {"e": str(e)}` atau key spesifik
- [ ] Jika membuat/mengubah wrapper `_log()`/`_progress()` di service, signature-nya
      menerima & meneruskan `args: dict = None` ke `self.api.emit_log/emit_progress`
- [ ] Subprocess menggunakan list argument, bukan string
- [ ] Unit test tersedia dan cover: happy path, edge case, error path
- [ ] `python -m pytest tests/ --cov=. --cov-report=xml` lulus tanpa error
- [ ] `python -m pytest tests/test_i18n_keys.py` lulus (key `backend.*` baru terdaftar di KEDUA locale)

### Frontend
- [ ] Semua hooks dideklarasikan di bagian paling atas komponen
- [ ] Teks yang ditampilkan ke user menggunakan `t('...')` (bukan hardcoded)
- [ ] Translation key baru ditambahkan ke `en/translation.json` DAN `id/translation.json`
- [ ] Loading state (`isLoading`) ditangani dengan benar (disable tombol saat loading)
- [ ] Error dari backend ditangkap dan ditampilkan via `showToast`
- [ ] Tidak ada `dangerouslySetInnerHTML` yang memuat konten dinamis dari backend
- [ ] Unit test Vitest tersedia untuk komponen baru/yang berubah signifikan — lihat `docs/development_testing.md` §3
- [ ] Test baru pakai helper bersama `tests/test-utils.tsx` dan `it.each`/`describe.each` untuk variasi data, BUKAN copy-paste blok test yang mirip antar file (lihat `docs/development_testing.md` §3.1) — proyek ini menjaga *new code duplication* SonarQube di bawah 3%
- [ ] `npm run test` (di `frontend/`) lulus tanpa error
- [ ] `npm run test:coverage` tidak menurunkan coverage statement keseluruhan di bawah 95%
- [ ] **`npx tsc -b` (BUKAN `tsc --noEmit -p tsconfig.json`, lihat `docs/development_testing.md` §3.5) lulus tanpa error** — perintah tanpa `-b` vakum/tidak benar-benar men-type-check apa pun di project ini

### Umum
- [ ] Tidak ada file scratch/generator yang tertinggal (gen_*.py, parse_*.py, check_*.py)
- [ ] Tidak ada `git commit` yang dilakukan sebelum mendapat persetujuan eksplisit
