# VyloServe - Project Context & AI Guidelines

## 📌 Project Overview
**VyloServe** adalah aplikasi desktop pengelola server lokal (mirip XAMPP/Laragon) yang mengatur modul seperti Apache, PHP, Database, serta berbagai Runtimes (Node.js, Python, Java, Go). Aplikasi ini dibuat menggunakan Python untuk backend (menjalankan command tingkat OS) dan React untuk antarmuka pengguna (UI) modern.

## 🛠️ Tech Stack
- **Backend:** Python 3, `pywebview` (untuk Desktop GUI wrapper), `pystray` (untuk System Tray), psutil.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, `i18next` (untuk multi-bahasa).

## 📁 Struktur Folder Utama
```text
vyloserve/
├── core/                   # Logika Backend Python
│   ├── api.py              # Router/Facade API utama yang menjembatani React & Python
│   ├── utils/              # Helper untuk proses eksekusi OS, regex, file system
│   └── services/           # Modul Manager spesifik (Single Responsibility Principle)
│       ├── apache.py, php.py, database.py, runtimes_manager.py
│       └── project.py, git_manager.py, ssl_manager.py, dashboard.py
├── frontend/               # Kode React UI
│   ├── src/
│   │   ├── components/     # Reusable UI (Modal.tsx, PageHeader.tsx, dll)
│   │   ├── locales/        # File terjemahan JSON (en & id)
│   │   ├── menu/           # Halaman/Menu utama berdasarkan modul (apache, php, database, dll)
│   │   └── App.tsx         # Routing & Layout Utama
└── main.py                 # Entrypoint aplikasi (Setup window, Pywebview, & System Tray)
```

## 🏗️ Arsitektur & Komunikasi (Python ↔ React)
1. **Fungsi Panggilan (React -> Python):**
   React memanggil fungsi backend menggunakan objek global yang diekspos oleh Pywebview:
   ```javascript
   const api = (window as any).pywebview.api;
   const response = await api.start_apache_server();
   ```
2. **Event Emitter (Python -> React):**
   Backend tidak mereturn progress bar, melainkan *menembakkan* event kustom (`vylo_log` dan `vylo_progress`) ke *window* UI secara *real-time*.
   ```python
   self.api.emit_log("backend.apache.starting", "info")
   self.api.emit_progress(50, "Mengekstrak file...")
   ```

## 🌐 Arsitektur Multi-Bahasa (i18n)
VyloServe menerapkan standar **Frontend-Driven i18n (Opsi 1)**.
- **Backend Python DILARANG mengembalikan pesan *hardcode*** (contoh: `"Aplikasi berhasil dijalankan"`).
- Backend **WAJIB** mengembalikan **Translation Key** beserta argumen opsional:
  ```python
  # BENAR (Dalam Python)
  return {"status": "success", "message": "backend.project.install_success", "args": {"framework": "Laravel"}}
  ```
- Frontend React menangkap kunci tersebut, lalu menerjemahkannya di UI secara otomatis:
  ```typescript
  // BENAR (Dalam React)
  showToast(t(res.message || '', res.args || {}) as string, res.status);
  ```

### 🚨 WAJIB: Translation Key Tidak Boleh Menyusul Belakangan
Setiap kali menambah **fitur baru, komponen UI baru, atau mengubah teks yang tampil ke pengguna** (baik translation key `backend.*` dari Python maupun key `ui.*`/`components.*`/dsb yang dipakai langsung di TSX), key barunya **WAJIB** ditambahkan ke **KEDUA** file locale — `frontend/src/locales/en/translation.json` **DAN** `frontend/src/locales/id/translation.json` — di commit/PR yang sama, bukan sebagai follow-up terpisah.
- **DILARANG** menyerahkan fitur dengan translation key yang hanya ada di salah satu bahasa (i18next akan fallback menampilkan key mentah seperti `"backend.apache.new_feature"` apa adanya ke pengguna jika key tidak ditemukan — ini bug yang mudah lolos karena aplikasi tidak crash, hanya terlihat "aneh").
- Sebelum menandai fitur selesai, jalankan pengecekan cepat: cari key baru yang kamu tambahkan di salah satu file locale, lalu pastikan key yang sama persis ada di file locale satunya.
- Ini konsisten dengan checklist *Definition of Done* di `docs/ai_development_guide.md` §8 (bagian Frontend) — jangan hanya dibaca, benar-benar dicentang sebelum serah terima.

## 📜 Coding Standards & Golden Rules untuk AI

### UI & Komponen (Frontend)
1. **Konsep DRY (Don't Repeat Yourself) di UI:**
   Selalu periksa `frontend/src/components/` sebelum membuat UI baru. 
   - Gunakan `<Modal>` untuk popup, jangan membuat layer absolute baru.
   - Gunakan `<PageHeader>` untuk judul halaman module.
   - Gunakan `<BackgroundProgressWidget>` untuk menangkap log loading dari OS.
2. **Golden Standard UI:**
   Modul **Apache** dan **PHP** (`frontend/src/menu/apache/Main.tsx` dll) adalah standar emas (*golden standard*) tampilan dan integrasi *Toast* dan i18n di aplikasi ini. Jika membuat modul baru, ikuti struktur mereka.
3. **Graceful Exit:**
   Penutupan aplikasi dikendalikan oleh variabel global `is_real_exit` di `main.py`. Menekan (X) pada window hanya akan menyembunyikan aplikasi ke System Tray (jika `IS_PRODUCTION=True`). Perintah mematikan total hanya lewat `api.close_app()` atau menu di System Tray.
4. **Patching UI Component Props:**
   Ketika melakukan patch/edit terhadap React Hooks (*useEffect*, *useContext*, *useTranslation*), deklarasikan di baris paling atas fungsi komponen untuk mencegah pelanggaran urutan aturan eksekusi Hooks bawaan React.

### 🧹 Clean Code & DRY (Backend & Frontend)
5. **Fungsi Tunggal, Tanggung Jawab Tunggal (SRP):**
   - Setiap fungsi Python harus memiliki **satu tujuan yang jelas**. Jika sebuah fungsi panjangnya melebihi 40 baris atau memiliki lebih dari 2 tingkat indentasi *nested*, pertimbangkan untuk memecahnya.
   - Ekstrak logika yang berulang ke fungsi *helper* atau *private method* (prefix `_`).
   - Di frontend React, pisahkan logika bisnis dari logika presentasi (gunakan custom hooks jika diperlukan).
6. **Naming Convention:**
   - **Python (Backend):** Gunakan `snake_case` untuk variabel dan fungsi, `PascalCase` untuk kelas.
   - **TypeScript (Frontend):** Gunakan `camelCase` untuk variabel/fungsi, `PascalCase` untuk komponen React dan tipe/interface.
   - Hindari singkatan yang tidak jelas (`mgr`, `tmp`, `d`). Gunakan nama yang *self-documenting* (`manager`, `temp_dir`, `database`).
7. **Hindari Magic Number & Magic String:**
   - Ekstrak nilai konstan ke variabel bernama (`MAX_RETRY = 5`, `DEFAULT_PORT = 80`).
   - Jangan hardcode path, port, atau konfigurasi langsung di dalam logika fungsi.
8. **Komentar Kontekstual, Bukan Komentar Deskriptif:**
   - Tulis komentar yang menjelaskan **MENGAPA**, bukan **APA** (kode sudah cukup menjelaskan *apa*).
   - Hapus kode yang di-*comment-out* — gunakan Git untuk histori perubahan.

### 🔒 Security (Keamanan)
9. **Validasi Input dari Frontend:**
   - Setiap argumen yang diterima fungsi backend di `core/api.py` dari panggilan JavaScript **WAJIB** divalidasi tipe dan nilainya sebelum diproses lebih lanjut.
   - Jangan pernah langsung menggunakan string dari frontend sebagai bagian dari *shell command* (rentan **Command Injection**).
   - Gunakan `shlex.quote()` atau passing argumen sebagai *list* ke `subprocess` (bukan string).
10. **Proteksi Path Traversal:**
    - Setiap kali backend menerima *path* dari input user, gunakan `os.path.realpath()` / `os.path.abspath()` dan validasi bahwa path tersebut berada di dalam direktori yang diizinkan (misal: `bin/`, `www/`, `data/`).
    - **Contoh BENAR:**
      ```python
      safe_root = os.path.realpath(self.base_dir)
      target = os.path.realpath(os.path.join(self.base_dir, user_input))
      if not target.startswith(safe_root):
          return {"status": "error", "message": "backend.error.path_traversal"}
      ```
11. **Tidak Menyimpan Kredensial di Kode:**
    - Password, token, atau kunci sensitif **DILARANG** di-*hardcode* dalam source code.
    - Gunakan file konfigurasi di `data/` yang sudah masuk `.gitignore`.
12. **Sanitasi Output ke JavaScript (XSS Prevention):**
    - Saat menggunakan `window.evaluate_js()` di backend Python, pastikan nilai dinamis di dalam string JS di-*escape* dengan benar untuk mencegah injeksi skrip.
    - Gunakan `json.dumps()` untuk mengonversi data Python ke format aman sebelum disisipkan ke JS.
    - **Contoh BENAR:**
      ```python
      import json
      safe_msg = json.dumps(message_key)  # Handles quotes & special chars
      self.window.evaluate_js(f"window.dispatchEvent(new CustomEvent('vylo_log', {{detail: {safe_msg}}}))")
      ```

### 🧪 Unit Testing (Wajib untuk Setiap Fitur Baru)
13. **Test Wajib untuk Setiap Fitur:**
    - Setiap fungsi publik baru di `core/services/` atau `core/utils/` **WAJIB** disertai *unit test* di folder `tests/`.
    - Setiap perubahan logika signifikan pada fungsi yang sudah ada juga **WAJIB** memiliki test yang meng-cover perubahan tersebut.
14. **Struktur Test yang Wajib Dicover:**
    - ✅ **Happy path:** Skenario berhasil (input valid, output sesuai).
    - ✅ **Edge case:** Input kosong, nilai batas, tipe data salah.
    - ✅ **Error path:** Simulasi kegagalan OS (file tidak ada, port ditolak, proses crash).
    - ✅ **Mock wajib:** Semua operasi OS (*subprocess*, *registry*, *urllib*, *file I/O*) HARUS di-mock.
15. **Lokasi & Penamaan Test:**
    - Test untuk `core/services/xxx.py` → `tests/test_services/test_xxx.py`
    - Test untuk `core/utils/xxx.py` → `tests/test_utils/test_xxx.py`
    - Nama fungsi test harus deskriptif: `test_start_server_success()`, `test_start_server_port_already_in_use()`.
16. **Menjalankan Test sebelum Serah Terima:**
    - Pastikan `python -m pytest tests/ --cov=. --cov-report=xml` berjalan **tanpa error** sebelum menyerahkan perubahan.
17. **Patch Target Harus Presisi (Pelajaran dari Audit Coverage Backend):**
    - Saat mock dengan `@patch(...)`, selalu patch **path modul spesifik tempat fungsi itu dipakai** (contoh: `core.services.apache.os.path.exists`), **BUKAN** `os.path.exists` global secara serampangan tanpa mengecek apakah target-nya benar.
    - Patch yang salah sasaran membuat test "lulus" padahal tidak menguji apa-apa — ini persis penyebab bug typo `conf`/`con` di `sync_apache_vhosts()` lolos ke production selama berbulan-bulan tanpa terdeteksi (lihat `docs/known_bugs.md` #3).
18. **Assert Perilaku Nyata, Bukan Sekadar "Dipanggil":**
    - `mock.assert_called_once()` saja **tidak cukup**. Assert juga **argumen persis** (`call_args`) dan **return value/state akhir** yang benar-benar dihasilkan.
    - Untuk fungsi yang menulis path/file, assert path lengkap yang sebenarnya dipakai (`os.path.join(...)` yang sama), bukan hanya "makedirs terpanggil".
19. **Validasi Regression Test dengan Sengaja Merusak Kode:**
    - Untuk test yang khusus dibuat menjaga sebuah bug fix (regression test), **wajib divalidasi dulu**: sengaja kembalikan kode ke versi buggy → jalankan test → **harus GAGAL** → kembalikan lagi ke versi fix → jalankan test → **harus LULUS**. Jangan percaya test hanya dari lulus sekali di kode yang sudah benar.
20. **Jangan Kejar Coverage 100% secara Buta:**
    - Blok `except Exception: pass` yang sifatnya *best-effort swallow* murni (tanpa perbedaan perilaku yang bisa diverifikasi) **boleh dibiarkan tidak ter-cover** — menulis test untuknya hanya menaikkan angka tanpa nilai regresi nyata ("test palsu").
    - Prioritaskan cakupan pada fungsi dengan logika bercabang nyata, alur error yang punya pesan/state berbeda, dan kode yang baru saja diperbaiki bug-nya.
21. **Selesai Menambah Test ≠ Selesai — Verifikasi ke SonarQube:**
    - Setelah menambah/mengubah test, jalankan ulang suite penuh + coverage, **lalu** minta scan SonarQube dijalankan (atau jalankan sendiri jika diizinkan) untuk memastikan **tidak ada temuan baru** (bug/code smell) dari test yang ditulis, sebelum menyerahkan pekerjaan sebagai selesai.
22. **Entrypoint Aplikasi Harus Tetap Testable:**
    - Logika penting (exit handler, lifecycle window, dsb.) di `main.py` **DILARANG** ditulis sebagai closure di dalam `if __name__ == '__main__':` — itu membuatnya mustahil di-import dan ditest (`pytest` mengimpor modul sebagai `main`, bukan `__main__`, sehingga blok itu tidak pernah jalan).
    - Gunakan class/fungsi level-modul yang menerima dependency (`api`, `window`, dsb.) sebagai parameter/atribut, lalu `if __name__ == '__main__': main()` cukup memanggil wiring-nya. Lihat `main.py` (class `AppLifecycle`) sebagai contoh pola yang benar.

---
*File ini dirancang khusus untuk dibaca oleh AI Assistant (Gemini) untuk langsung memahami ekosistem VyloServe tanpa perlu menganalisa ulang seluruh repositori secara manual dari awal setiap memulai percakapan atau sesi baru.*

## 📖 Dokumentasi Ekstensif & Urutan Bacaan untuk AI

Untuk orientasi cepat dan pengembangan yang efektif, ikuti **urutan bacaan** berikut:

1. **`GEMINI.md`** (file ini) — Aturan dasar, arsitektur, coding standards ✅
2. **[`docs/ai_development_guide.md`](docs/ai_development_guide.md)** — **WAJIB DIBACA KEDUA.** Berisi: Peta lengkap semua endpoint API Backend↔Frontend, lokasi data JSON, pola debugging, template implementasi fitur, troubleshooting guide, dependency antar service, dan checklist *Definition of Done*.
3. **[`docs/development_testing.md`](docs/development_testing.md)** — Standar unit test, clean code, security, dan perintah SonarQube scan yang benar.
4. **[`docs/index.md`](docs/index.md)** — Pintu masuk ke semua dokumentasi mendalam lainnya (fitur, arsitektur, known bugs).

## 🛑 Aturan Strict (Wajib Dipatuhi)
1. **DILARANG** melakukan `git commit` tanpa persetujuan eksplisit dari pengguna.
2. **DILARANG** menjalankan command scan ulang SonarQube secara sembarangan (selalu baca spesifikasi command dari knowledge atau tanyakan pengguna).
3. **WAJIB** menghapus kembali (clean up) file-file *scratch/generator* yang dibuat secara dinamis oleh AI untuk keperluan perbaikan atau generate skrip sementara (seperti `gen_test_*.py`, `parse_*.py`) segera setelah selesai digunakan agar tidak menjadi sampah di dalam repositori.
