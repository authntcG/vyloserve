# Panduan Konsistensi UI (UI Consistency Guide)

Dokumen ini adalah rujukan tunggal untuk aturan konsistensi visual & komponen bersama di frontend VyloServe. Ditulis untuk developer maupun AI assistant — **baca ini SEBELUM menulis markup UI baru**, khususnya sebelum membuat button, toggle, atau dropdown dari nol.

**Latar belakang:** audit menyeluruh (Oktober 2026) menemukan inkonsistensi coloring/desain nyata di seluruh aplikasi — bukan cuma kosmetik, tapi bug fungsional (warna hardcoded yang tidak ikut berubah saat user ganti tema) dan duplikasi kode besar (21 implementasi dropdown berbeda, 6 lokasi toggle switch disalin manual, dst.). Dokumen ini adalah hasil dari perbaikan Fase 1 audit tersebut. Lihat `docs/known_bugs.md` untuk detail insiden & root cause lengkap.

## 1. Aturan Warna: Theme-Aware vs Statis

VyloServe punya 10 tema (lihat `docs/frontend_ui.md` §2.1). Sebagian token warna Tailwind **mengikuti tema aktif** (berubah per `[data-theme]`), sebagian lagi **selalu sama** di semua tema. Salah memilih di antara keduanya adalah sumber #1 bug inkonsistensi yang ditemukan audit.

### Token yang THEME-AWARE (ikut berubah per tema)
Didefinisikan via CSS custom property `var(--theme-X, fallback)` di `frontend/src/index.css`. **Ini daftar LENGKAP shade yang benar-benar punya `--theme-*` — shade lain di family yang sama (mis. `emerald-100`, `amber-800`) TIDAK ter-cover sama sekali, meskipun "secara keluarga" terlihat seperti sudah theme-aware:**
- `bg-primary` / `text-primary` / `border-primary` (+ varian opacity: `bg-primary/10`, `/20`, `/90`, dst.)
- `bg-slate-50` sampai `bg-slate-950` (dan `text-slate-*`, `border-slate-*`) — **satu-satunya family yang covered PENUH di semua 11 shade**
- `emerald-400`, `emerald-500`, `emerald-600` SAJA (`bg-*`/`text-*`/`border-*`) — shade lain (`emerald-50/100/200/300/700/800/900/950`) adalah stok Tailwind biasa
- `amber-500`, `amber-600` SAJA (`bg-*`/`text-*`/`border-*`) — ditambahkan saat audit Fase 1 (sebelumnya statis, menyebabkan asimetri dengan emerald di tombol Start/Stop). Shade lain (`amber-50/100/200/300/400/700/800/900/950`) adalah stok Tailwind biasa.

**Butuh shade yang lebih terang/gelap dari yang di-cover (mis. background tint untuk badge/kotak info)?** JANGAN pakai shade lain dari family yang sama (mis. `bg-emerald-100` untuk tint lembut) — pakai **opacity modifier di atas shade yang SUDAH covered**: `bg-emerald-500/10`, `dark:bg-emerald-500/20`, `border-amber-500/20`, dst. Lihat "Aturan Hover" di bawah untuk penjelasan lengkap kenapa pola ini selalu benar di 10 tema sekaligus tanpa perlu CSS variable baru. Bug nyata dari pelanggaran aturan ini: badge status "Installed" di `Card.tsx` (`bg-emerald-100 ... dark:bg-emerald-900/30`) cuma SEBAGIAN theme-aware — teks dark-mode ikut tema tapi background tetap stok, menyebabkan clash visual nyata di tema Solarized (`--theme-emerald-500` di tema itu adalah BIRU). Lihat `docs/known_bugs.md` #42 untuk daftar lengkap ~15 lokasi lain dengan bug serupa yang sudah diperbaiki.

### Token yang SENGAJA STATIS (sama di semua tema)
- **`red-*` (semua shade)** — dipakai untuk apa pun yang bersifat destruktif/danger. **Ini keputusan desain yang disengaja, bukan bug**: merah harus konsisten lintas tema supaya user bisa mengenali "aksi berbahaya" tanpa perlu belajar ulang asosiasi warna per tema. Jangan tambahkan `--theme-red-*` tanpa alasan kuat.
- `blue-*`, selain lewat token `primary` — kalau butuh warna "accent/primary", **selalu pakai `bg-primary`, JANGAN pernah tulis literal `bg-blue-600` dkk.**

### Aturan Hover
**Jangan pernah** pasangkan token theme-aware dengan hover hardcoded dari palet Tailwind lain. Contoh bug nyata yang diperbaiki saat audit ini: `bg-primary hover:bg-blue-600` — base-nya ikut tema, tapi hover-nya SELALU biru stok Tailwind di tema manapun.

**Pola yang benar:** pakai varian opacity dari token yang sama.
```
bg-primary hover:bg-primary/90        ✅ benar
bg-emerald-600 hover:bg-emerald-600/90 ✅ benar
bg-primary hover:bg-blue-600           ❌ salah (hover tidak ikut tema)
bg-emerald-600 hover:bg-emerald-700    ❌ salah (emerald-700 tidak punya --theme-var)
```
Ini juga berarti kamu **tidak perlu nambah CSS variable baru** tiap kali butuh shade "hover" — opacity di atas token yang sama selalu benar di 10 tema sekaligus, tanpa pengecualian yang perlu diingat.

**Aturan sama berlaku untuk highlight "item terpilih/aktif" dan background tint badge/kotak info**, bukan cuma hover. Bug nyata yang ditemukan dari smoke test manual (lihat `docs/known_bugs.md` #41): baris opsi terpilih di `<Select>` memakai `bg-blue-50 dark:bg-blue-900/30 ... dark:text-blue-400` — base warnanya hardcoded biru stok Tailwind, bukan `bg-primary`, jadi highlight-nya SELALU biru di tema manapun alih-alih mengikuti warna aksen tema aktif. Pola yang benar untuk highlight "terpilih/aktif" (dipakai `<Select>`, tab sidebar `SettingsModals.tsx`, chip dashboard, dan `<InfoBox>` di bawah): `bg-primary/10 dark:bg-primary/20 text-primary` — `text-primary` TIDAK perlu varian `dark:` terpisah karena `--theme-primary` sendiri sudah di-switch lewat atribut `[data-theme]`, bukan lewat strategi dark-mode Tailwind.

**Fase 4 (Oktober 2026, lihat `docs/known_bugs.md` #42)** menuntaskan audit penuh pola ini ke seluruh aplikasi: 81 kemunculan `bg-blue-*`/`text-blue-*` hardcoded di 21 file + badge emerald/amber yang cuma sebagian theme-aware (`Card.tsx`, `OsCompatibilityCard.tsx`, update-checker `SettingsModals.tsx`, dan ~10 lokasi lain) semuanya sudah dikonversi ke pola opacity-of-covered-shade di atas. Kalau menambah UI baru dengan background tint/badge/notice box, pakai pola ini SEJAK AWAL — jangan tunggu ditemukan di audit berikutnya.

## 2. Komponen Bersama — Pakai Ini, Jangan Tulis Ulang

Semua ada di `frontend/src/components/`. Test masing-masing ada di `frontend/tests/components/`.

### `<Button>` (`Button.tsx`)
```tsx
import Button from '../../components/Button';

<Button variant="primary" icon="download" onClick={handleInstall}>
    {t('apache.install_update')}
</Button>
```
| Prop | Nilai | Default |
|---|---|---|
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` \| `danger-ghost` | `primary` |
| `size` | `sm` \| `md` \| `icon` | `md` |
| `loading` | `boolean` — paksa disabled, tampilkan spinner, `children` TETAP tampil (tidak di-swap jadi teks loading) | `false` |
| `icon` | nama ikon Material Symbols, dirender sebelum `children` | — |
| `className` | **layout only** (`flex-1`, `shadow-sm`, `mt-4`) — JANGAN override warna/ukuran lewat sini | — |

**Kapan pakai variant apa:**
- `primary` — aksi utama halaman ("Install", "Add Version", "Save").
- `secondary` — aksi netral/batal (tombol Cancel di Modal).
- `ghost` — aksi tersier tanpa border/background (link-style).
- `danger` — aksi destruktif dengan fill solid (konfirmasi hapus).
- `danger-ghost` — aksi destruktif tanpa fill (menu item "Uninstall" di dropdown, link "Disable").

**Yang BUKAN domain `<Button>`:** tombol Start/Stop service (warna berubah berdasar state `isRunning`, bukan intent statis) — pakai `<ServiceToggleButton>` di bawah.

### `<ServiceToggleButton>` (`ServiceToggleButton.tsx`)
```tsx
<ServiceToggleButton
    isRunning={isRunning}
    isToggling={isToggling}
    onClick={handleToggle}
    labels={{ start: t('apache.start_server'), stop: t('apache.stop_server'), starting: t('apache.starting'), stopping: t('apache.stopping') }}
/>
```
Satu komponen untuk pola "tombol yang warnanya+ikon+labelnya berganti antara Start (emerald) dan Stop (amber)". `labels` WAJIB string sudah di-translate oleh caller (tiap modul punya i18n key sendiri). Kalau modul tidak punya label transisi "Starting.../Stopping..." terpisah (mis. Database), reuse label start/stop yang sama untuk keempat slot — jangan mengarang key baru hanya demi mengisi prop.

**Pola "tombol status install" (bukan `<ServiceToggleButton>`, bukan `<Button>`):** Tunnels (`InstallHeaderButton`), Runtimes (`RuntimesHeaderActions`), dan Git (`GitInstallButton`) masing-masing punya komponen presentational LOKAL (sengaja tidak diekstrak jadi komponen bersama — lihat `docs/known_bugs.md` #43) untuk tombol header yang SELALU dirender, warna/ikon/label berganti antara "Install" (`bg-primary`) dan "Installed" (`bg-emerald-500 hover:bg-emerald-600 disabled:opacity-100 disabled:cursor-default border-transparent`, ikon `check_circle`, `disabled`). Kalau modul kelima butuh pola sama, pertimbangkan ekstraksi ke komponen bersama alih-alih komponen lokal keempat yang nyaris identik.

### `<ToggleSwitch>` (`ToggleSwitch.tsx`)
```tsx
<ToggleSwitch checked={enabled} onChange={setEnabled} label={t('settings.receive_prerelease')} />
```
| Prop | Keterangan |
|---|---|
| `checked`, `onChange(checked: boolean)` | standar, controlled |
| `label` | **wajib** — jadi `aria-label`, toggle tidak punya teks visual sendiri |
| `tone` | `'primary'` (default, untuk preferensi biasa) atau `'status'` (emerald, KHUSUS indikator status live seperti service running — lihat `Sidebar.tsx`) |
| `onClick` | escape hatch opsional untuk kasus `checked` dikontrol dari polling eksternal (bukan dari toggle itu sendiri) — lihat `Sidebar.tsx` untuk contoh nyata (perlu `preventDefault`/`stopPropagation` sebelum state eksternal sempat sinkron ulang) |
| `size` | `'md'` (default, `w-9 h-5`) atau `'sm'` (`w-7 h-4`, untuk konteks padat mis. grid chip ekstensi PHP) |
| `interactive` | `true` (default) atau `false` — tambahkan `pointer-events-none` pada toggle untuk kasus MURNI DEKORATIF, klik sebenarnya ditangani elemen pembungkus di luar (mis. `<button>` yang membungkus seluruh baris) — lihat `php/Settings.tsx` |

**Satu lokasi yang SENGAJA TIDAK dimigrasikan ke komponen ini** (bukan terlewat, tapi pola interaksinya genuinely berbeda):
- `SettingsModals.tsx` toggle pre-release updates — pakai `role="switch"` native (`<button role="switch" aria-checked>`), bukan `<input type="checkbox">`. Pola ini sebenarnya lebih sesuai ARIA untuk sebuah "switch" murni, jadi tidak dipaksa diseragamkan ke pola checkbox `ToggleSwitch`.

### `<Select>` (`Select.tsx`)
```tsx
<Select
    options={versions.map(v => ({ value: v.version, label: v.name }))}
    value={selectedVersion || null}
    onChange={setSelectedVersion}
    placeholder={t('database.select_version')}
    searchable          // default true, set false kalau opsinya sedikit & search tidak perlu
    loading={isFetching}
    loadingText={t('database.retrieving_versions')}
    errorText={versions.length === 0 ? t('database.failed_to_fetch') : undefined}
/>
```
Dropdown generik — menggantikan baik combobox custom (dengan search) maupun `<select>` native polos. `searchable={false}` untuk kasus opsi sedikit (2-3 item) yang tidak butuh kotak pencarian.

| Prop | Keterangan |
|---|---|
| `options` | `{value, label, sublabel?, disabled?}[]` — `sublabel` dirender `label (sublabel)`, dipakai mis. untuk nama project di samping domainnya. `disabled` untuk opsi terlihat tapi tidak bisa dipilih (mis. "Node.js — segera hadir" di Apache New Project) |
| `searchable` | default `true` |
| `filterFn(option, query)` | default: cocokkan `label` saja (case-insensitive substring). Override kalau perlu cocokkan field lain juga (lihat `tools/tunnels/Main.tsx` yang mencocokkan domain DAN nama project sekaligus) |
| `loading` + `loadingText` | state "sedang fetch opsi" |
| `errorText` | BEDA dari `emptyText` — dipakai saat daftar opsi GAGAL dimuat (trigger ikut disabled + tampilkan pesan ini), bukan sekadar hasil pencarian kosong |
| `emptyText` | tampil di dalam panel saat hasil pencarian kosong |
| `displayLimit` + `truncatedText` | batasi jumlah opsi yang ditampilkan saat tidak sedang mencari (mis. "20 rilis terbaru saja"), dengan catatan footer custom |
| `label` | label visual KECIL (`text-sm font-medium`) di atas trigger, otomatis terasosiasi via `htmlFor`/`id` — **accessible name trigger ikut berubah jadi teks label ini**, bukan teks opsi terpilih |
| `id` | id eksplisit untuk trigger, dipakai kalau caller sudah punya `<label htmlFor>` sendiri dengan styling berbeda (mis. heading section besar seperti theme picker di Settings) alih-alih prop `label` di atas |

**Keyboard:** Arrow Up/Down navigasi highlight (melompati opsi `disabled`), Enter pilih, Escape tutup + kembalikan fokus ke trigger — perbaikan dari combobox lama yang cuma dukung klik/Enter-per-baris.

**Trade-off yang disengaja:** `searchable={false}` TETAP memakai markup custom (bukan `<select>` native), jadi kehilangan native OS picker di mobile. Ini keputusan produk yang sudah dikonfirmasi — demi satu komponen konsisten penuh di semua dropdown aplikasi (lihat §3 "Fase 2" di bawah untuk status migrasi — per Oktober 2026 migrasi ini sudah tuntas 100%).

**Panel dropdown dirender lewat React Portal ke `document.body`** (bukan sebagai anak DOM dari trigger-nya), posisi dihitung manual dari `getBoundingClientRect()` trigger. Ini supaya panel TIDAK ikut terpotong oleh ancestor manapun yang punya `overflow-hidden`/`overflow-y-auto` (mis. body `Modal.tsx` yang scrollable — lihat `docs/known_bugs.md` #41). Scroll pada ancestor manapun saat panel terbuka akan MENUTUP panel (bukan reposisi berkelanjutan) — proyek ini tidak punya dependency positioning library, jadi close-on-scroll dipilih sebagai pendekatan paling sederhana yang masih benar. Kalau menambah fitur baru ke `Select.tsx` yang menyentuh keyboard handling, ingat panel & trigger kini jadi SIBLING di React tree (bukan parent-child) sejak portal ini ditambahkan — `handleKeyDown` harus tetap dipasang di KEDUANYA agar event dari search input/option row tetap tertangani (event React tetap bubble lewat React tree meski portal, bukan DOM tree, jadi ini aman — tapi deteksi klik-di-luar native (`document.addEventListener('mousedown', ...)`) beroperasi di DOM tree, jadi HARUS mengecek baik `containerRef` maupun `panelRef`).

### `<ProgressBar>` (`ProgressBar.tsx`)
```tsx
<ProgressBar percent={progress.percent} />
```
Track+fill progress bar standar (`h-2`, `bg-primary` fill, `rounded-full`). Dipakai di `BackgroundProgressWidget` (internal) dan semua install wizard (Apache/PHP/Database/Runtimes/Git/Tunnels/Settings update). Props cuma `percent: number` dan `className?` (layout-only, mis. ganti lebar wrapper). Kalau butuh varian "card" dengan label+track (lihat `GitProgressCard` di `tools/git/Main.tsx`), bungkus `<ProgressBar>` di komponen lokal — jangan tulis ulang track+fill-nya.

### `<OsCompatibilityCard>` (`OsCompatibilityCard.tsx`)
```tsx
<OsCompatibilityCard
    icon="desktop_windows"
    detectedLabel={t('apache.detected_os')}
    osName={osInfo.name}
    arch={osInfo.arch}
    compatibleLabel={t('apache.compatible')}
/>
```
Satu komponen untuk kartu "OS terdeteksi + badge compatible" yang sebelumnya disalin verbatim ~16 baris × 3 di install wizard Apache/PHP/Database.

### `<Tabs>` (`Tabs.tsx`)
```tsx
<Tabs
    tabs={[
        { value: 'all', label: t('database.all_instances') },
        { value: 'mysql', label: t('database.mysql_mariadb'), badgeColorClass: 'bg-emerald-500' },
    ]}
    value={activeTab}
    onChange={setActiveTab}
/>
```
Tab bar gaya underline (border-bottom aktif + `text-primary`). `badgeColorClass` opsional menambah dot kecil setelah label (mis. indikator "ada versi terinstal" di Runtimes). Generik atas `T extends string` supaya `value`/`onChange` type-safe sesuai union tab milik caller.

**BUKAN domain `<Tabs>`** (pola berbeda secara sengaja, jangan dipaksa diseragamkan):
- Segmented control pill (mis. `ShareModeButton` di Tunnels) — bukan navigasi antar-view, tapi pemilih mode tunggal dengan visual pill penuh.
- Toggle mode chip individual (mis. Text/File di Base64) — dua tombol independen, bukan grup tab dengan satu active state yang saling eksklusif secara visual underline.
- Vertical tabs di Settings — orientasi & struktur layoutnya beda signifikan, belum diaudit untuk ekstraksi.

### `<FieldLabel>` (`FieldLabel.tsx`)
```tsx
<FieldLabel htmlFor="db-port" size="xs">{t('database.port')}</FieldLabel>

{/* Varian label+nilai (slider, dsb) -- children bebas, bukan cuma string */}
<FieldLabel size="xs" tone="eyebrow" className="flex justify-between">
    <span>{t('tools.qr.resolution')}</span>
    <span className="font-mono text-primary">{size}px</span>
</FieldLabel>
```
| Prop | Nilai | Default |
|---|---|---|
| `size` | `sm` \| `xs` | `sm` |
| `tone` | `default` (slate-700/300) \| `muted` (slate-600/400) \| `subtle` (slate-500, tanpa varian dark) \| `eyebrow` (slate-500 + uppercase) \| `primary` (warna brand) | `default` |
| `htmlFor` | sama seperti `<label htmlFor>` native | — |
| `visuallyHidden` | render `sr-only` (tetap terbaca screen reader) — untuk field yang labelnya sudah tersirat dari context visual sekitar | `false` |
| `className` | **layout only** (mis. `flex justify-between` untuk baris label+nilai) — JANGAN override warna/ukuran lewat sini | — |

Sebelumnya 9 varian className nyaris identik (beda cuma ukuran/shade warna, bukan perbedaan desain yang disengaja) disalin manual di ~20 file. `Select.tsx` sendiri sekarang memakai `<FieldLabel>` untuk prop `label`-nya, bukan lagi markup inline.

**BUKAN domain `<FieldLabel>`** (pola berbeda secara sengaja):
- Heading ikon+teks di atas sekelompok field (`text-slate-900 dark:text-white flex items-center gap-2`, mis. "Target PHP Version" di `php/NewInstance.tsx`/`apache/InstallWizard.tsx`) — ini heading section, bukan label satu field.
- Heading besar yang kebetulan punya `htmlFor` (`block text-lg font-semibold ... mb-1`, mis. "Theme" di `SettingsModals.tsx`) — tetap heading visual, pakai `id` eksplisit `<Select>` (lihat di atas), bukan `<FieldLabel>`.
- Label yang membungkus checkbox/radio/toggle "card" (border+background+hover, mis. pilihan bahasa di Settings, opsi install pip/npm) — pola berbeda (option-card), bukan teks label murni.

### `<InfoBox>` (`InfoBox.tsx`)
```tsx
{/* Mode flat-text (tanpa title) -- children langsung ikut warna accent tone */}
<InfoBox tone="danger" icon="error">
    <strong>{t('php.port_conflict')}</strong> {t('php.port_used_desc_1')}{port}.
</InfoBox>

{/* Mode title+description -- title bold+accent, body/children warna netral (mutedBody).
    children boleh berisi elemen interaktif tambahan (input, button) di bawah deskripsi. */}
<InfoBox tone="warning" icon="folder_special" title={t('apache.workspace_required')}>
    <span>{t('apache.workspace_desc')}</span>
    <div className="flex gap-2">...input + tombol browse...</div>
</InfoBox>
```
| Prop | Nilai | Default |
|---|---|---|
| `tone` | `info` (primary-based) \| `warning` (amber-500/600-based) \| `danger` (merah statis) | `info` |
| `icon` | nama Material Symbols | wajib |
| `title` | ADA -> mode title+description. TIDAK ADA -> mode flat-text | — |
| `children` | body teks (JSX bebas) + elemen interaktif tambahan di mode title+description | wajib |
| `className` | layout only | — |

Sebelumnya 9+ kotak info/warning/danger nyaris identik (padding+border+rounded+ikon+teks) disalin manual di 11 file, termasuk tone "info" yang hardcoded `bg-blue-*` (bukan theme-aware). Konsolidasi ini sekaligus menyederhanakan nuansa: tone `danger` tetap dua-shade merah untuk body-nya (red tidak punya kendala tema), tapi tone `info`/`warning` memakai 1 accent class untuk judul+body-flat dan slate netral untuk deskripsi (karena hanya 1 shade amber/primary yang theme-aware, tidak 2 seperti desain asli beberapa instance lama).

**BUKAN domain `<InfoBox>`** (pola berbeda secara sengaja, lihat `docs/known_bugs.md` #42):
- Chip deteksi inline single-line (ikon 16px, `rounded-md`, mis. deteksi framework di `apache/NewProject.tsx`) — beda skala/tujuan dari notice box persisten.
- Suggestion row data-driven di `dashboard/Main.tsx` (ikon 24px, `rounded-xl`, `p-4`, sudah py sendiri punya struktur variant-map lokal) — beda skala.
- Label yang membungkus checkbox dengan tint merah (`apache/Main.tsx`, `database/Main.tsx`) — bukan notice box, itu form control.

### `<NotificationBell>` (`NotificationBell.tsx`)
```tsx
<NotificationBell />
```
Tombol lonceng notifikasi tanpa props — membaca `history`/`unreadCount`/`clearHistory`/`markHistoryRead` langsung dari `useToast()` (`ToastContext.tsx`). Dipasang di footer `Sidebar.tsx`, **SELALU tampil termasuk saat sidebar collapsed** (beda dari tombol Settings yang sengaja hilang saat collapsed) — lihat `docs/known_bugs.md` #45/#47 untuk alasan desainnya. Penempatan persis (direvisi dari desain awal "baris terpisah di atas", lihat #47):
- **Mode expanded**: bersampingan dengan tombol Settings, satu grup "status & aksi ambient" di ujung kanan baris footer (sejajar dengan baris system-load).
- **Mode collapsed**: satu kolom vertikal, bell DI ATAS ikon system-load (tombol Settings sendiri tetap disembunyikan saat collapsed seperti sebelumnya — popover-nya butuh ruang horizontal yang tidak ada di rail 80px).

- Badge count di-cap `"9+"` di atas 9 unread.
- Panel riwayat dirender lewat portal ke `document.body`, posisi dihitung manual dari `getBoundingClientRect()` trigger, DIBUKA KE ATAS (anchor `bottom`, bukan `top`) karena trigger-nya ada di footer dekat dasar viewport — pola yang sama dengan `<Select>` (lihat di atas), dipilih alih-alih `absolute bottom-full` sederhana (pola popover Settings) karena histori bisa lebih tinggi kontennya.
- `unreadCount` reset ke 0 saat panel DIBUKA (bukan saat masing-masing toast auto-dismiss) — entri histori tetap ada, cuma badge-nya yang hilang.
- Entri histori direkam saat `showToast()` DIPANGGIL (bukan saat toast auto-dismiss), cap `MAX_TOAST_HISTORY = 100`, session-only (tidak persisten lintas restart aplikasi — `useState` polos cukup, app ini SPA desktop long-lived).

## 3. Status Migrasi & Fase 2/3/4

**Fase 1** migrasi ke komponen bersama di atas untuk: `Modal`/`AlertContext`/`LogFileViewerModal`, tombol primary per-halaman (Apache/PHP/Database/Git/QR Generator), 2 tombol Tunnels yang full-hardcoded, 6 lokasi `ToggleSwitch`, dan 3 combobox custom (Database/Tunnels×2).

**Fase 2 — sudah dikerjakan:**
- **`<ProgressBar>`** — diekstrak dan dipakai ulang di `BackgroundProgressWidget` + 8 lokasi inline duplikat (Apache `InstallWizard`/`NewProject`, PHP `NewInstance`, Database `NewInstance`, Runtimes, Git `Main.tsx` [termasuk `FloatingWidget`], Tunnels, Settings update modal).
- **`<OsCompatibilityCard>`** — diekstrak dari 3 duplikat verbatim (Apache/PHP/Database install wizard).
- **`<Tabs>`** — diekstrak dari 4 implementasi underline-tab terpisah (Database, Runtimes `EngineTabButton`, URL Encode/Decode, Base64 Encode/Decode). Segmented-pill (Tunnels) dan chip toggle (Base64 Text/File) **tetap terpisah** — lihat catatan "BUKAN domain `<Tabs>`" di atas.
- **Semua `<select>` native tersisa** (18 titik di 12 file: Dashboard, Database `Settings`/`NewInstance`, PHP `NewInstance`, Runtimes `RuntimeVersionSelect`, Apache `Settings`/`ProjectSettings`/`InstallWizard`/`NewProject` ×3, Settings theme picker, Git `Main`, QR Generator ×5) sudah dimigrasikan ke `<Select searchable={false}>`. `Select.tsx` mendapat 2 kapabilitas baru sebagai hasil migrasi ini:
  - **`id` eksplisit** — untuk caller yang sudah punya `<label htmlFor>` sendiri (mis. heading section seperti theme picker) alih-alih prop `label` bawaan.
  - **`options[].disabled`** — opsi terlihat tapi tidak bisa dipilih (mis. "Node.js — segera hadir" di Apache New Project), menyamai perilaku `<option disabled>` native.
  - **Catatan untuk migrasi `<select>` berikutnya (kalau ada yang baru ditemukan):** prop `label` Select mengganti *accessible name* trigger jadi teks label (lewat asosiasi `htmlFor`/`id`), BUKAN teks opsi terpilih — kalau test lama query dengan `getByRole('button', {name: <teks opsi>})`, pakai `id` eksternal + `<label>` manual alih-alih prop `label`, atau sesuaikan query test-nya.

**Fase 3 — sudah dikerjakan:**
- **`<FieldLabel>`** — diekstrak dari 9 varian className (Grup 1-6 hasil audit: beda size `sm`/`xs` dan shade warna `slate-700/300`, `slate-600/400`, `slate-500`, `primary`) yang disalin manual di ~20 file. ~58 titik label dimigrasikan (termasuk label internal `Select.tsx` sendiri). Heading section (ikon+teks besar), heading `text-lg` yang kebetulan punya `htmlFor`, dan label pembungkus checkbox/radio/toggle card **tetap terpisah** — lihat catatan "BUKAN domain `<FieldLabel>`" di atas.

**Fase 4 (Oktober 2026) — sudah dikerjakan:**
- **`<InfoBox>`** — diekstrak dari 11 kotak info/warning/danger terduplikasi di 11 file (lihat catatan "BUKAN domain `<InfoBox>`" di atas untuk 3 pola yang sengaja tetap terpisah).
- **81 kemunculan `bg-blue-*`/`text-blue-*`/`border-blue-*`/`focus:ring-blue-*` hardcoded** di 21 file dikonversi ke token `primary` (progress %, chip terpilih, badge, toast, link, focus ring, file-input accent, suggestion engine dashboard, dsb).
- **Badge emerald/amber yang cuma SEBAGIAN theme-aware** (`Card.tsx`, `OsCompatibilityCard.tsx`, update-checker `SettingsModals.tsx`, dan ~10 lokasi lain ditemukan via grep susulan saat implementasi) dikonversi dari shade stok (`emerald-100/800/900`, `amber-300/700/800`, dst.) ke pola opacity-of-covered-shade (`emerald-500/10`, `amber-500/50`, dst.) — lihat §1 untuk penjelasan lengkap kenapa ini perlu.
- 1 straggler `text-purple-400` (log source tag `LogsPanel.tsx`) dikonversi ke `text-slate-400` netral.
- Gradient SVG dashboard (`dashboard/Main.tsx`) — leg amber/emerald dikonversi ke `var(--theme-amber-500, ...)`/`var(--theme-emerald-500, ...)`; leg merah tetap hex statis (sengaja).
- Lihat `docs/known_bugs.md` #42 untuk rincian lengkap root cause & daftar lokasi.

**Follow-up pasca-Fase 4 (dari smoke test manual user) — sudah dikerjakan:**
- **Tombol status install Git diseragamkan** dengan pola Tunnels/Runtimes (`GitInstallButton`, lihat §2 di atas) — lihat `docs/known_bugs.md` #43.
- **`ToggleSwitch` diperluas** dengan prop `size`/`interactive`, dipakai untuk memigrasikan toggle ekstensi `php/Settings.tsx` yang sebelumnya menulis ulang markup manual — lihat `docs/known_bugs.md` #44. **1 pengecualian tersisa** (`SettingsModals.tsx` toggle pre-release, pakai `role="switch"` native, dicatat di §2 di atas).
- **`php/Settings.tsx`'s mismatch ukuran form** (identik dengan temuan `database/Settings.tsx` di #41) ikut diperbaiki sekalian — lihat `docs/known_bugs.md` #44.

Kalau mengerjakan salah satu area ini di masa depan, perbarui dokumen ini (termasuk §1 kalau ternyata ada token warna statis baru yang seharusnya theme-aware, atau sebaliknya).
