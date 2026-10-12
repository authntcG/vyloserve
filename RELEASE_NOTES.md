# VyloServe v0.0.6-alpha — Release Notes

**Tanggal Rilis:** 12 Oktober 2026  
**Status Versi:** Alpha Pre-Release  
**Branch:** `ui-ux-treefiles-standarization-enhancement`  
**Platform Target:** Windows 10 / Windows 11 (64-bit)

---

## 🌟 Sorotan Utama Rilis (Release Highlights)

VyloServe versi `v0.0.6-alpha` membawa peningkatan besar pada pengalaman pengembang (*developer experience*), visualisasi dokumentasi proyek secara lokal, arsitektur tata letak antarmuka, serta stabilitas build production.

1. **Modul Baru — Markdown & Documentation Reader**: Pembaca dokumentasi Markdown lokal yang terintegrasi langsung di dalam aplikasi, dilengkapi navigasi *Folder TreeView* dan visualisasi diagram [Mermaid](https://mermaid.js.org/) yang interaktif.
2. **Arsitektur Layout — Vertical Split-Pane LogsPanel**: Tata letak panel log sistem kini menyatu di dalam aliran dokumen (*in-flow split-pane*) dengan kontrol *drag-to-resize* instan tanpa animasi lag, menggantikan mode floating overlay lama.
3. **Pembaruan Engine & Status Badges**: Deteksi otomatis dan alur pembaruan versi (*update flow*) untuk seluruh modul server (Apache, PHP, Database MySQL/MariaDB, Runtimes, Git, dan Tunnels) dengan proteksi *backup/rollback*.
4. **Optimasi Frontend Bundling (Rolldown / Vite 8)**: Reduksi ukuran chunk utama hingga ~42%, eliminasi total warning build, dan pemisahan vendor secara modular (*code-splitting*).
5. **Perbaikan Notifikasi Native Windows di Mode Production**: Resolusi path aset internal berbasis `sys._MEIPASS` untuk memastikan ikon status notifikasi (berhasil, gagal, warning, info) tampil sempurna pada versi executable `.exe`.

---

## 🚀 Fitur Baru (New Features)

### 📚 Markdown Documentation Reader (`tools/markdown-viewer`)
* **Folder Explorer TreeView**:
  * Membuka folder dokumentasi lokal secara rekursif melalui dialog pemilihan folder OS native.
  * Navigasi hierarki file dan sub-folder dengan tampilan pohon (*tree*) yang rapi dan ikon penanda jenis file.
  * Fitur pencarian cepat dan auto-expand/collapse folder.
* **Rich Markdown Renderer**:
  * Mendukung spesifikasi **GitHub Flavored Markdown (GFM)**: tabel, tasklist/checkbox, blockquote, inline code, dan syntax highlighting.
  * **Interlink Navigasi Dokumen**: Hyperlink antar dokumen Markdown lokal (`[link](./subfolder/doc.md)`) berpindah dokumen secara otomatis di dalam reader tanpa membuka browser eksternal.
  * **Safe Local Image Serving**: Mendukung penyajian gambar lokal (`![alt](./assets/img.png)`) yang disajikan aman melalui endpoint backend dengan proteksi *path traversal*.
* **Diagram Interaktif Mermaid**:
  * Mendukung ragam diagram: *Flowchart, Sequence Diagram, Class Diagram, State Diagram, ER Diagram, Gantt Chart, Git Graph, Pie Chart, User Journey, C4, Mindmap*, dan *Quadrant Chart*.
  * Dilengkapi kontrol **Zoom, Pan, & Reset View** menggunakan mouse drag dan tombol navigasi untuk diagram kompleks berskala besar.
* **Dual Theme Reader**:
  * Toggle tema bacaan (*Light / Dark Mode*) independen untuk kenyamanan membaca dokumen teknis.

### 🔄 Alur Pembaruan Versi Engine (Engine Update Flows)
* **Pendeteksian Versi Baru**: Pengecekan otomatis ketersediaan versi rilis stabil baru untuk:
  * Apache Server
  * PHP Instances
  * Database (MySQL & MariaDB)
  * Runtimes (Node.js, Python, Java JDK, Go)
  * Git Client
  * Tunnels (Zrok & Cloudflared)
* **Badge Indikator Pembaruan**: Menampilkan badge visual "Update Available" pada header card modul dan tabel instans.
* **Alur Upgrade Terproteksi**: Ekstraksi dan instalasi versi baru dengan pembuatan cadangan (*backup*) konfigurasi lama, serta *rollback* otomatis jika instalasi terganggu.

---

## 🎨 Peningkatan UI/UX & Desain Tata Letak

### 🪟 True Vertical Split-Pane Layout
* **In-Flow Layout**: LogsPanel kini menjadi pane bawah sejati dan bukan layer absolute mengambang (*floating*). Konten halaman utama secara otomatis menyesuaikan tingginya mengikuti ukuran panel log.
* **Zero-Lag Splitter Resize**: Mengganti transisi CSS global menjadi `transition-[margin]`, memungkinkan handle splitter di-drag secara real-time dan sinkron 1:1 mengikuti kursor mouse tanpa delay 300ms.
* **Kekangan Proporsi Layar**: Menetapkan batas aman di mana LogsPanel dapat diperbesar maksimal hingga 70% tinggi layar, menjamin section konten utama selalu memiliki ruang minimal 30%.
* **Scroll & Gap Optimization**: Memperbaiki posisi sticky TreeView (`top-4`) dan scrollbox independen pada layar 1024x768 sehingga tidak ada lagi rongga kosong atas atau bagian bawah yang terpotong.

---

## 🐛 Perbaikan Bug & Hardening (Bug Fixes & Security)

### 📦 Production Build & Asset Resolution
* **Notifikasi Native Windows pada PyInstaller (.exe)**:
  * Mengatasi masalah hilangnya ikon status notifikasi (sukses, gagal, peringatan) saat aplikasi dijalankan dalam bentuk `.exe` release.
  * Mengimplementasikan `get_resource_path()` di [`core/utils/system_utils.py`](file:///D:/Projects/Python/vyloserve/core/utils/system_utils.py) yang membaca dari `sys._MEIPASS` untuk lingkungan PyInstaller dan jatuh ke root proyek pada mode dev.
  * Memperbarui [`main.spec`](file:///D:/Projects/Python/vyloserve/main.spec) dan dokumentasi build [`docs/development_testing.md`](file:///D:/Projects/Python/vyloserve/docs/development_testing.md) untuk menyertakan seluruh aset `frontend/src/assets`.

### ⚡ Optimalisasi Vite & Rolldown Bundler
* **Eliminasi `[INEFFECTIVE_DYNAMIC_IMPORT]`**:
  * Mengganti dynamic import `import('./i18n')` pada [`frontend/src/App.tsx`](file:///D:/Projects/Python/vyloserve/frontend/src/App.tsx) dengan import statis untuk menyelaraskan dengan [`main.tsx`](file:///D:/Projects/Python/vyloserve/frontend/src/main.tsx).
* **Modular Code-Splitting**:
  * Mengonfigurasi `rolldownOptions.output.codeSplitting` pada [`frontend/vite.config.ts`](file:///D:/Projects/Python/vyloserve/frontend/vite.config.ts) dengan grup:
    * `vendor-react` (~238 kB)
    * `vendor-markdown` (~155 kB)
    * `vendor-qr` (~46 kB)
  * Memperkecil bundle utama `index.js` dari **1.049 kB** menjadi **608 kB** (reduksi ~42%).
  * Mengatur `chunkSizeWarningLimit: 1500` kB agar sesuai dengan pustaka engine ELK (1.46 MB) tanpa peringatan build.

### 🛡️ Proteksi Backend & Race-Conditions
* **Stale-Response Safeguards**: Menambahkan token/guard pembatalan request asinkron pada penggantian versi runtime agar respons jaringan lama yang lambat tidak menimpa seleksi engine terbaru pengguna.
* **Path Traversal Protection**: Memperketat validasi `os.path.realpath` pada pembacaan file dan gambar Markdown lokal.

---

## 🌐 Internasionalisasi (i18n)

* **100% Paritas Bahasa**: Kesetaraan penuh **1.184 keys** antara Bahasa Inggris ([`en/translation.json`](file:///D:/Projects/Python/vyloserve/frontend/src/locales/en/translation.json)) dan Bahasa Indonesia ([`id/translation.json`](file:///D:/Projects/Python/vyloserve/frontend/src/locales/id/translation.json)).
* **Zero Hardcoded Strings**: Seluruh string teks pada antarmuka pengguna (termasuk tombol, status, diagram fallback error, tooltip, dan pesan log backend) menggunakan translation key `t(...)` terstandarisasi.
* **Otomasi Pengujian Paritas**: Diverifikasi melalui pengujian unit backend [`test_i18n_keys.py`](file:///D:/Projects/Python/vyloserve/tests/test_i18n_keys.py) dan frontend [`i18n.test.ts`](file:///D:/Projects/Python/vyloserve/frontend/tests/i18n.test.ts).

---

## 🧪 Hasil Verifikasi & Pengujian Otomatis

Seluruh suite pengujian otomatis lulus 100% tanpa kegagalan:

| Lingkup Pengujian | Runner | Total Suite | Total Test Cases | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Services & Utils** | Pytest | 100% tests/ | **561 passed** | ✅ **PASSED** |
| **Frontend Components & Menus** | Vitest | 56 test files | **670 passed** | ✅ **PASSED** |
| **Paritas i18n Dua Arah** | Vitest & Pytest | 2 suites | 5 tests | ✅ **PASSED** |
| **Production Build (TS & Vite)** | TypeScript & Vite | Full build | **0 warnings, 0 errors** | ✅ **PASSED** |

---

## 📦 Panduan Build Rilis (Release Build Commands)

### 1. Build Frontend UI
```powershell
cd frontend
npm install
npm run build
cd ..
```

### 2. Build Windows Executable (.exe)
```powershell
# Opsi OneFile (Single .exe mandiri):
pyinstaller --noconsole --onefile --icon "frontend\src\assets\icons-nobg.ico" --add-data "frontend/dist;frontend/dist" --add-data "frontend/src/assets;frontend/src/assets" main.py

# Atau menggunakan main.spec:
pyinstaller main.spec
```
