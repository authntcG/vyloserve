# Playbook Kerja: Verifikasi, Sinkronisasi Dokumentasi & Debugging

Repo ini punya disiplin ketat soal testing, sinkronisasi dokumentasi, dan validasi regresi — `AGENTS.md` menyatakan ATURANNYA, dokumen ini memberi PROSEDUR konkret untuk menjalankannya tanpa lupa satu langkah, disusun dari sesi kerja nyata di mana melewatkan satu langkah ini pernah menyebabkan regresi sungguhan atau dokumentasi basi.

**Berlaku untuk AI assistant mana pun yang bekerja di repo ini** (Claude Code, Gemini CLI, Cursor, Copilot, dsb.) — baca `AGENTS.md` dulu kalau belum (aturan dasar: i18n, theming, security, struktur). Dokumen ini TIDAK mengulang isinya — di bawah ini hanya merujuk nomor aturan yang relevan.

**Kapan dipakai:** SETIAP perubahan kode di repo ini — fitur baru, bug fix, refactor, bahkan tweak kecil sekalipun. Bukan cuma untuk fitur besar; berlaku juga untuk perbaikan kecil dan perubahan dokumentasi sendiri karena peta sinkronisasi di §2 tetap relevan.

## 1. Sebelum bilang "selesai": jalankan urutan verifikasi lengkap

Jangan percaya "kelihatannya sudah benar" — jalankan semuanya, bahkan untuk perubahan yang terasa kecil. Regresi paling berbahaya justru muncul dari perubahan yang "cuma satu baris".

**Kalau yang disentuh ada di `frontend/`:**
```bash
cd frontend
./node_modules/.bin/tsc -b        # BUKAN `tsc --noEmit` -- itu no-op di proyek ini, tidak benar-benar mengecek apa pun
npx vitest run                     # jalankan 2x berturut-turut kalau ada test yang menyentuh timer/focus/event window --
                                    # lihat §3 soal kenapa test seperti ini rawan flaky-antar-test
npx eslint src
```

**Kalau yang disentuh ada di `core/`, `main.py`, atau `tests/`:**
```bash
python -m pytest tests/ -q
```

**Sebelum serah terima penuh**, jalankan KEDUANYA meski perubahan "hanya" di satu sisi — perubahan backend bisa mempengaruhi kontrak yang dibaca frontend (dan sebaliknya), dan AGENTS.md Rule #18 mewajibkan `python -m pytest tests/ --cov=. --cov-report=xml` lulus tanpa error sebelum serah terima.

### Membaca angka ESLint dengan benar
Angka total `eslint src` HAMPIR SELALU bukan nol di repo ini (ada baseline pelanggaran lama yang diterima, mis. pola `t: any` untuk prop fungsi translasi). Jangan panik melihat angka bukan-nol — yang penting adalah **delta**, bukan angka absolut:

1. Catat angka total SEBELUM mulai (atau cek lagi di akhir dan curigai file mana yang kontribusi).
2. Kalau total naik, isolasi penyebabnya dengan `npx eslint <file-spesifik>` satu per satu pada file yang kamu ubah.
3. Kalau masih ragu apakah suatu temuan itu baru atau sudah ada sebelum kamu mulai, pakai **git stash satu file** (bukan seluruh working tree — working tree di repo ini sering punya banyak perubahan lain yang sedang berjalan, jangan ganggu itu):
   ```bash
   git stash push -- path/to/file/yang/diubah.tsx
   npx eslint path/to/file/yang/diubah.tsx   # ini angka BASELINE, sebelum perubahanmu
   git stash pop
   ```
   Teknik yang sama persis berlaku untuk mengisolasi apakah sebuah test FAIL itu regresi dari perubahanmu atau sudah flaky/gagal duluan — stash satu file, jalankan test, lihat apakah tetap gagal.

## 2. Peta sinkronisasi dokumentasi — dokumen mana untuk perubahan apa

AGENTS.md Rule #5 bilang "wajib update docs di turn yang sama" tapi tidak merinci dokumen mana untuk kasus apa. Ini peta konkretnya (hasil audit nyata terhadap isi tiap dokumen, bukan tebakan dari judul filenya):

| Jenis perubahan | Dokumen yang WAJIB dicek | Apa yang ditambahkan |
|---|---|---|
| Bug ditemukan & diperbaiki (root cause tidak jelas dari kode saja) | `docs/known_bugs.md` | Entri baru bernomor urut: **Deskripsi → Penyebab (Root Cause) → Solusi (Fixed)** → **Pelajaran untuk ke depannya**. Cek nomor entri terakhir dulu (`grep -c "^## " docs/known_bugs.md`) sebelum menulis nomor baru. |
| Komponen React bersama baru/diperluas (`components/*.tsx`) | `docs/ui_consistency_guide.md` | Section baru dengan contoh `tsx`, tabel props, dan daftar "BUKAN domain komponen ini" kalau ada pola serupa yang SENGAJA tidak dikonsolidasi. |
| Event `CustomEvent` baru di `window` (pola `vylo_xxx`) | `docs/frontend_ui.md` §5.1 | Baris baru di tabel event + node baru di diagram mermaid (emitter → event → listener). |
| Kontrak/pola baru yang lintas-komponen (mis. "fungsi X dari Context harus stabil referensinya") | `docs/frontend_ui.md` | Subsection baru dengan contoh BENAR/SALAH — lihat §5.5 sebagai contoh format. |
| Perubahan ke `main.py`/`AppLifecycle`/bootstrap backend | `docs/backend_services.md` §14 | Perbarui diagram mermaid & narasi alur yang terpengaruh — cek dulu apakah ada kalimat lama yang jadi SALAH SECARA FAKTUAL (bukan cuma kurang lengkap) akibat perubahanmu, itu prioritas tertinggi untuk diperbaiki. |
| Endpoint `Api` baru yang dipanggil dari JS | `docs/ai_development_guide.md` §1 | Baris baru di tabel endpoint yang sesuai (System & Utility / dsb). Kalau method BUKAN endpoint JS (dipanggil internal dari `main.py`/push ke frontend), tambahkan sebagai catatan terpisah, bukan di tabel endpoint — supaya tidak menyesatkan. |
| Field baru di `default_config` (`core/services/settings.py`) | `docs/ai_development_guide.md` (tabel ukuran file §2), `docs/project_structure.md` (deskripsi `settings.py` di file tree) | Tambahkan nama field ke daftar singkat yang sudah ada — jangan biarkan daftar itu basi. |
| Checklist Definition-of-Done perlu aturan baru (pola bug yang mudah terulang) | `docs/ai_development_guide.md` §8 | Baris checklist baru, kutip entri `known_bugs.md` terkait sebagai bukti kenapa aturan ini perlu ada. |
| File/direktori baru di level struktural (`frontend/src/hooks/`, dll) | `docs/project_structure.md` | Baris baru di file tree literal — ini gampang kelewat karena tidak "terasa" seperti dokumentasi fitur. |
| Fitur baru yang terlihat pengguna (bukan detail implementasi) | `docs/features.md` | Section baru bernomor (`## 12. ...`) dengan bullet point gaya yang sama dengan section lain. |
| Angka statistik test (`~N test case di M file`) | `docs/development_testing.md` | Perbarui ke angka aktual (`npx vitest run` / `python -m pytest tests/ -q` keluarannya persis menyebut jumlah). |

**Setelah edit dokumentasi apa pun**, sanity-check encoding (AGENTS.md Rule #30 — PowerShell bisa merusak karakter non-ASCII diam-diam):
```bash
grep -rlP '[\x00-\x08\x0b\x0c\x0e-\x1f]' docs/*.md
```
Tidak ada output = bersih. Ada output = ada byte kontrol aneh yang harus diperbaiki sebelum lanjut.

**Cara cepat cek dokumen mana yang BENAR-BENAR perlu disentuh** (jangan asumsi dari tabel di atas saja kalau perubahannya besar/menyebar): kalau alatmu mendukung sub-agent/sub-task paralel, pakai satu untuk membaca seluruh file `docs/*.md` dan melaporkan NEEDS UPDATE / NO CHANGE per file dengan lokasi persis — lebih murah dan lebih teliti daripada menebak sendiri, dan terbukti menemukan satu pernyataan yang sudah SALAH SECARA FAKTUAL (bukan cuma kurang lengkap) yang tidak akan ketemu dari sekadar menyusuri tabel di atas. Kalau tidak ada sub-agent, baca sendiri satu per satu — jangan dilewati.

## 3. Mengisolasi "ini regresi dari perubahanku, atau memang sudah begitu?"

Sebelum melaporkan sebuah temuan sebagai "bug baru akibat perubahan saya" atau menulis entri `known_bugs.md` yang menyalahkan perubahan terbaru, **buktikan dulu** — jangan asumsi dari urutan waktu saja:

```bash
git log --oneline -5 -- path/to/file.py      # kapan file ini terakhir berubah, dan oleh commit apa
git blame -L <baris>,<baris> path/to/file.py  # baris spesifik ini berasal dari commit mana
git stash push -- path/to/file.py && <jalankan test/lint> && git stash pop  # baseline SEBELUM perubahanmu
```

Kalau ternyata bug itu sudah ada di commit sebelum sesi kerjamu dimulai, itu **pra-eksisting** — catat sejujurnya di `known_bugs.md` sebagai temuan terpisah (bukan "regresi dari fitur X"), karena nanti itu jadi penting untuk forensik kalau ada yang bertanya "ini mulai kapan". Jangan overclaim BUKAN pra-eksisting demi terlihat tidak menyebabkan masalah, dan jangan overclaim PRA-EKSISTING demi menutupi regresi asli — buktikan lewat command di atas.

## 4. Debugging yang membingungkan: reproduksi dulu, baru berteori

Kalau sebuah test gagal dengan cara yang tidak masuk akal (lulus sendirian, gagal saat dijalankan bersama file lain; gagal dengan pesan yang sepertinya tidak berhubungan dengan perubahanmu), JANGAN langsung menebak-nebak fix dan coba-coba sampai lulus. Isolasi dulu secara sistematis:

1. **Jalankan file test itu SENDIRIAN** vs **sebagai bagian suite penuh** — kalau hasilnya beda, itu petunjuk kuat ada *state leakage* antar-test (listener global yang tidak di-cleanup, mock yang tidak di-reset, dsb.), bukan bug logika di komponen yang kamu ubah.
2. **Bisection**: pakai `-t "<nama test>"` (vitest) atau `::test_name` (pytest) untuk menjalankan subset test satu per satu, mempersempit test MANA yang mencemari test lain.
3. **Tambahkan `console.log`/`print` debug SEMENTARA** langsung di titik yang dicurigai (termasuk `new Error().stack` di JS untuk lihat siapa pemanggil sebenarnya) — lebih cepat dan lebih pasti daripada menebak dari luar. Hapus lagi semua debug output ini sebelum selesai (AGENTS.md Rule #3 soal bersih-bersih file scratch berlaku juga untuk baris debug sementara di file produksi).
4. **Kalau akar masalahnya ada di LIBRARY pihak ketiga** (jsdom, win11toast, pywebview, dsb.) dan perilakunya tidak jelas dari dokumentasi, **baca source code-nya langsung** — cari lokasi file terpasang (`python -c "import X, inspect; print(inspect.getsourcefile(X))"` untuk Python, atau `node_modules/<pkg>/...` untuk Node) dan `grep`/baca fungsi yang relevan. Ini lebih cepat dan lebih akurat daripada mencoba banyak kemungkinan fix secara trial-and-error.
5. Begitu akar masalah ketemu dan diperbaiki, **validasi fix-nya** sesuai AGENTS.md Rule #21 (sengaja rusak lagi → test harus gagal dengan pesan yang sama dengan laporan awal → kembalikan fix → test harus lulus lagi) sebelum lanjut.

## 5. Regression test: tulis DAN validasi, bukan cuma tulis

AGENTS.md Rule #21 sudah mewajibkan ini — poin tambahan dari pengalaman nyata: kalau regression test-nya menguji sebuah *closure*/callback lokal (bukan method publik di class), panggil closure-nya LANGSUNG dengan argumen yang sama persis seperti pemanggil aslinya (bukan cuma `mock.assert_called_once()` terhadap fungsi yang membungkusnya) — test yang hanya mengecek "fungsi pembungkusnya terpanggil" tidak akan pernah menangkap bug signature/arity di closure yang dibungkusnya sendiri, karena closure itu di-mock total di level yang lebih tinggi.
