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

### `<Card>` (`Card.tsx`) & Geometri Desktop Card-Table Harmonization
```tsx
import Card from '../../components/Card';

<Card
    title={serverName}
    status={statusText}
    updateVersion={updateVer}
    gridCols="grid-cols-2 md:grid-cols-3"
    dropdownActions={<>...</>}
    footerActions={<>...</>}
>
    <div>...konten metadata...</div>
</Card>
```
Komponen kartu utama untuk inventaris modul (Apache, PHP, Database, Runtimes, Projects):
- **Geometri Standar Desktop Terkalibrasi (Harmonisasi dengan Table View):**
  - **Outer Padding:** `p-5` (dikalibrasi dari sebelumnya `p-6` yang terlalu renggang). Menghilangkan fatik visual saat berpindah dari Card View ke Table View.
  - **Flex Gap:** `gap-4` vertikal antar header, body, dan footer.
  - **Body Grid Gap:** `gap-3.5 sm:gap-4` (sebelumnya `gap-6`).
  - **Footer:** `pt-3.5 sm:pt-4 border-t border-slate-100 dark:border-slate-800/50 flex gap-2.5` (sebelumnya `pt-6 mt-2`).
  - **Options Burger Button Hit Target (Fitts's Law):** `h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800` dengan `aria-label={t('common.options', 'Options')}` (dikalibrasi dari sebelumnya `p-1` ~24px yang terlalu kecil untuk kursor desktop).
- **Zero Cumulative Layout Shift (CLS):** Geometri `p-5 gap-4 pt-4` identik 1:1 dengan `<SkeletonCard variant="service" />`, mencegah layout berkedip/bergeser saat data selesai dimuat dari backend.
- **Konsolidasi Aksi Cepat (Eliminasi Redundansi):**
  - Pada modul server seperti Apache, seluruh shortcut konfigurasi/direktori (open htdocs, open httpd.conf, open vhosts.conf, open conf dir, open logs dir, open root dir) diintegrasikan langsung ke dalam `dropdownActions` kartu alih-alih meletakkan grid alat bantu terpisah (`ApacheQuickLinks` telah dihapus).
  - Ketika server sedang berjalan (`isRunning`), aksi utama cepat seperti "Open Browser" disematkan langsung di `footerActions` berdampingan dengan `<ServiceToggleButton>`.

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

**Mode `iconOnly`:** Mendukung prop `iconOnly?: boolean` (default `false`). Dalam mode `iconOnly=true` (dipakai untuk tabel baris di `PhpTable` dan `DatabaseTable`), tombol hanya merender ikon dengan ukuran ringkas `p-2 rounded-lg` serta otomatis memasang `title` dan `aria-label` dengan teks label aktif untuk aksesibilitas hover tooltip tanpa memakan lebar kolom aksi.

### `<InstalledBadge>` (`InstalledBadge.tsx`)
```tsx
import InstalledBadge from '../../components/InstalledBadge';

actions={
    isInstalled ? (
        <InstalledBadge />
    ) : (
        <Button variant="primary" icon="download" onClick={handleInstall}>
            {t('common.install')}
        </Button>
    )
}
```
Komponen standar terpadu untuk pola "lencana status terinstal" di PageHeader (dipakai konsisten di Apache, Runtimes, Git, dan Tunnels). Menggunakan `bg-emerald-500` yang sepenuhnya theme-aware, ikon `check_circle`, disabled state terstandarisasi, dan teks bawaan dari `t('common.installed')` (atau label kustom via prop `label`). Menggantikan implementasi manual berulang di 4 modul tersebut.

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

### Pola "Badge Update Available + Aksi Dropdown" (BUKAN komponen bersama — konvensi berulang, lihat `docs/known_bugs.md` #51/#52)
Dipakai identik di `php/Main.tsx` (sumber pola asli) dan `database/Main.tsx` (meniru persis): badge amber kecil di sebelah nama instance pada judul `<Card>`, plus tombol aksi "Update to {versi}" di `dropdownActions` (menu "..."):
```tsx
{updateVer && (
    <span className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title={t('xxx.update_to', { version: updateVer.version })}>
        <span className="material-symbols-outlined text-[12px]">upgrade</span> {t('xxx.update')}
    </span>
)}
```
- Warna badge **WAJIB** pola opacity-of-covered-shade (`bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500`, sama seperti tone warning `<InfoBox>`) — BUKAN shade stok (`bg-amber-100`, `dark:bg-amber-900/30`, dst). Kedua modul sempat salah pakai shade stok (ditemukan & diperbaiki bersamaan, lihat `docs/known_bugs.md` #51) karena pola ini ditambahkan SETELAH audit Fase 4 (§1) selesai — jadi tidak ikut tersapu audit itu.
- Deteksi "ada update" **WAJIB** pakai `compareVersions()` (`frontend/src/utils/version.ts`, perbandingan numerik per-segmen) — BUKAN `!==` string mentah, yang keliru menandai "ada update" kalau versi terpasang justru LEBIH BARU dari hasil cek API.
- Database punya langkah konfirmasi tambahan (pilihan backup sebelum update) yang PHP tidak punya — perbedaan ini genuinely fungsional (backend `update_database()` punya parameter `backup_data`, `update_php()` tidak), bukan sekadar variasi gaya.
- Kalau modul ketiga butuh pola yang sama, pertimbangkan ekstraksi ke komponen bersama (mis. `<UpdateBadge>`) alih-alih menyalin lagi untuk ketiga kalinya — ambang yang sama seperti disebutkan untuk pola "tombol status install" di atas.

### Sistem Skeleton Loading (`components/skeleton/`)
Seluruh tampilan loading placeholder di aplikasi distandarisasi melalui keluarga komponen di `frontend/src/components/skeleton/` (dengan `components/SkeletonCard.tsx` dipertahankan sebagai *re-export* kompatibilitas mundur):
```tsx
import { Skeleton, SkeletonCard, SkeletonForm, SkeletonDocument, SkeletonChatMessage, AppSkeletonLayout } from '../../components/skeleton';
```
| Komponen | Kegunaan Utama |
|---|---|
| `<Skeleton variant="text\|circular\|rectangular\|rounded" />` | Primitif dasar blok shimmer theme-aware (`role="status"`, `aria-busy="true"`). |
| `<SkeletonCard variant="service\|project\|metric\|list-item" />` | Placeholder kartu modul (`service` untuk Apache/PHP/DB/Runtimes/Git/Tunnels, `project` untuk Virtual Host, `metric` untuk Dashboard resource card, `list-item` untuk daftar share). |
| `<SkeletonForm fields={...} />` | Placeholder untuk formulir di dalam Modal saat sedang mengambil konfigurasi/versi dari backend. |
| `<SkeletonDocument />` | Placeholder untuk area baca dokumen (seperti Markdown Documentation Viewer). |
| `<SkeletonChatMessage />` | Placeholder balon percakapan saat AI sedang memproses atau memuat riwayat. |
| `<AppSkeletonLayout />` | Kerangka layar penuh (Sidebar + Header + Content Grid) saat aplikasi pertama kali melakukan bootstrap koneksi ke PyWebView. |

**Aturan:** Jangan membuat `<div className="animate-pulse bg-slate-200 ...">` manual di halaman modul — gunakan salah satu komponen di atas agar warna shimmer selalu mengikuti tema aktif secara seragam.

### `<ViewModeToggle>` (`ViewModeToggle.tsx`)
```tsx
<ViewModeToggle
    mode={viewMode}
    onChange={setViewMode}
    cardsLabel={t('common.view_cards')}
    tableLabel={t('common.view_table')}
    ariaLabel={t('common.view_mode')}
/>
```
Segmented toggle switch accessible (`role="group"` dengan 2 button `aria-pressed`) untuk beralih antara tampilan visual `card` dan tampilan tabular `table`.
- **Ikon:** `grid_view` (cards) dan `table_rows` (table) dengan styling seragam desktop (`text-[18px]`).
- **Accessibility:** Menyediakan `aria-pressed="true|false"` pada masing-masing tombol, keyboard navigation, dan title tooltip bawaan.
- **Dipakai di:** Projects Hub (`menu/projects/Main.tsx`), PHP (`menu/php/Main.tsx`), Database (`menu/database/Main.tsx`), Runtimes (`menu/runtimes/Main.tsx`).

### `<DataTable>` (`DataTable.tsx`)
```tsx
<DataTable<MyItem>
    columns={[
        { id: 'name', header: t('mod.name'), render: (item) => item.name },
        { id: 'status', header: t('mod.status'), render: (item) => <StatusBadge ... /> },
        { id: 'actions', header: t('mod.actions'), align: 'right', render: (item) => <ActionButtons ... /> },
    ]}
    data={items}
    keyExtractor={(item) => item.id}
    density="normal" // 'compact' | 'normal' | 'relaxed'
    filters={<FilterChips ... />}
    search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: t('common.search'),
    }}
    headerActions={<button ... />}
    emptyState={<EmptyState ... />}
    isLoading={isLoading}
/>
```
Komponen tabel data desktop modern yang dirancang untuk efisiensi inventaris dan kepadatan informasi:
- **Integrated Controls Toolbar:** Menyediakan slot opsional `filters` (di sisi kiri berdampingan dengan title/subtitle) dan `search` (di sisi kanan berdampingan dengan density controls dan headerActions). Mengintegrasikan kontrol penyaringan dan pencarian langsung ke dalam kontainer tabel sehingga antarmuka lebih bersih tanpa floating bar eksternal terpisah.
- **Search Input Responsif:** Prop `search` mendukung input real-time dengan ikon search otomatis, tombol clear ("close"), focus ring aksen `primary`, dan ARIA label untuk aksesibilitas keyboard/screen reader.
- **No Vertical Overflow on Table:** Tabel sengaja **TIDAK** menerapkan `overflow-y-auto` internal agar tidak terjadi double vertical scrollbar di desktop layout (mengikuti scroll layout induk). Kontainer tabel hanya memiliki `overflow-x-auto overflow-y-hidden` untuk responsivitas horizontal murni.
- **Density Setting & Persistence:** Mendukung 3 tingkat kerapatan padding baris:
  - `compact`: `py-1.5 px-3 text-xs` (optimal untuk data teknis padat seperti port, path, versi).
  - `normal`: `py-3 px-4 text-sm` (default, seimbang untuk dashboard & inventaris server).
  - `relaxed`: `py-4 px-5 text-sm` (nyaman untuk entri berjarak longgar).
  Dilengkapi kontrol interaktif di toolbar kanan (`showDensityControl`, default `true`) yang tersimpan persisten di `localStorage` (`vyloserve_table_density`) sehingga preferensi developer berlaku konsisten di semua modul (Projects, PHP, Database, Runtimes).
- **Dynamic Header:** Kolom header dinamis via `ColumnDef<T>` dengan dukungan perataan teks (`align: 'left' | 'center' | 'right'`), class kustom per-kolom (`className`, `headerClassName`), dan render prop kustom.
- **Empty & Loading States:** Mendukung slot kustom `emptyState` (yang tetap mempertahankan toolbar pencarian/filter tetap terpasang saat hasil pencarian 0 baris) serta skeleton loading terintegrasi saat `isLoading=true`.

### `<FilterChips>` (`FilterChips.tsx`)
```tsx
<FilterChips
    items={[
        { id: 'all', label: t('common.all'), count: totalCount },
        { id: 'mysql', label: 'MySQL', count: mysqlCount, icon: 'database' },
        { id: 'postgres', label: 'PostgreSQL', count: pgCount },
    ]}
    selectedId={selectedFilter}
    onChange={setSelectedFilter}
    ariaLabel="Filter database engine"
/>
```
Komponen kapsul filter interaktif serbaguna (`role="group"` dengan masing-masing tombol `aria-pressed="true|false"`):
- **Badge Hitungan Numerik:** Menampilkan jumlah entri data per kategori secara real-time pada tiap pil filter.
- **Aksesibilitas & Theming:** Menggunakan warna `bg-primary text-white shadow-xs` untuk state aktif dan warna netral border-subtle untuk state non-aktif, serta responsif horizontal scroll (`no-scrollbar`).
- **Dipakai di:** Projects Hub (`menu/projects/Main.tsx`) untuk filter runtime, dan Database (`menu/database/Main.tsx`) untuk filter engine (MySQL vs PostgreSQL).

### `<CompactFileDropzone>` (`CompactFileDropzone.tsx`)
```tsx
<CompactFileDropzone
    id="base64_file_input"
    accept="*/*"
    currentFileName={fileMeta?.name}
    currentFileSize={fileMeta?.size}
    currentFileType={fileMeta?.type}
    onFileSelected={(file, dataUrl) => handleFile(file, dataUrl)}
    onClearFile={handleClear}
    promptText={t('tools.base64.universal_prompt')}
/>
```
Komponen zona seret-lepas berkas (*drag-and-drop*) universal dan ringkas:
- **Dua Mode Presentasi:** Mode standar (vertikal dengan padding lega untuk dual-input Base64) dan mode kompak (`compact={true}` dengan layout horizontal satu baris untuk penyisipan Logo QR).
- **Attached File State:** Secara otomatis berubah menjadi badge file terlampir saat berkas terpilih, menampilkan ikon jenis berkas (gambar vs dokumen), nama file, ukuran, tipe MIME, dan tombol hapus silang (X).
- **Asosiasi Form Aksesibel:** Mendukung prop `id` yang terhubung langsung dengan `<FieldLabel htmlFor="...">` (memenuhi Aturan 6).
- **Dipakai di:** Base64 Encode/Decode (`menu/tools/base64-encode-decode/Main.tsx`) dan Custom QR Generator (`menu/tools/qr-generator/Main.tsx`).

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

**Harmonisasi Densitas Card-Table & Audit UI/UX Menyeluruh (Oktober 2026) — sudah dikerjakan:**
- **Standardisasi Card Geometry:** Mengalibrasi padding kartu `Card.tsx` menjadi `p-5`, inner gap `gap-4`, body grid `gap-3.5 sm:gap-4`, footer `pt-3.5 sm:pt-4`, dan hit target burger options menu menjadi `h-8 w-8`. Menghilangkan ketimpangan kerapatan visual (gap fatik) antara Card View dan Table View, serta mengeliminasi CLS terhadap `SkeletonCard`.
- **Eliminasi Redundansi Modul Apache:** Menghapus `ApacheQuickLinks` (grid 6-tombol redundan di bawah status card yang memakan ~130px ruang visual). Mengintegrasikan seluruh 7 shortcut direktori/file konfigurasi langsung ke `dropdownActions` kartu, dan menambahkan tombol akses cepat "Open Browser" di footer kartu saat Apache aktif.
- **Harmonisasi Grid Gap Lintas Modul:** Menyeragamkan seluruh kontainer grid kartu di Apache, PHP, Database, Runtimes, dan Projects menjadi `gap-4 sm:gap-4.5 pb-8` (sebelumnya `gap-6`), dan margin kontainer filter/search bar menjadi `mb-4` (sebelumnya `mb-6`).
- **Standardisasi Toolbar Tinggi Kontrol:** Mengunci tinggi kontrol filter chips, density switch, dan search bar pada `h-8` seragam dengan align center.

**Penyelarasan Orkestrasi Level 1 & Level 2 Runtimes & Git (Oktober 2026) — sudah dikerjakan:**
- **Centralized `RuntimePathHub` (`runtimes/RuntimePathHub.tsx`):** Mengonsolidasi kontrol pendaftaran Windows System PATH (`ToggleSwitch`) dan pemilihan versi aktif (`Select`) ke dalam satu kartu kendali terpusat di bagian atas modul Runtimes. Menghilangkan asimetri tombol dan toggle antar kartu versi lokal.
- **100% Symmetric Binary Inventory Cards:** Setiap kartu versi terinstal pada modul Runtimes kini memiliki tata letak 100% seragam dengan dua tombol primer standar (*Open Folder* dan *Open in Terminal*) serta aksi mutasi terisolasi di menu burger tiga titik.
- **In-Card Contextual Alert Box (Anti-Warning Fatigue):** Menghapus banner peringatan eksternal terpisah (`ExternalWarningBanner`) yang menumpuk di atas konten. Peringatan deteksi instalasi native OS kini diintegrasikan langsung di dalam kartu kendali terkait (`data-testid="path-hub-external-alert"` pada Runtimes dan `data-testid="git-external-alert"` pada Git Core System), menampilkan nomor versi native, direktori biner, serta penjelasan penguncian toggle secara ringkas dan elegan.
- **Penyelarasan Status Badge & Kunci Toggle Git:** Kartu Git Core System menyelaraskan status badge (`Native OS` ber-nuansa amber, `PATH Active` ber-nuansa emerald, dan `Isolated` ber-nuansa primary) dan menonaktifkan toggle pendaftaran PATH secara visual dan fungsional saat Git native sistem terdeteksi.
- **Harmonisasi Modul Tunnels & Developer Terminal:** Menerapkan `<ViewModeToggle>` (Card & Table View) dengan dropdown proyek yang dapat dicari (*searchable project selector*) pada Tunnels, serta menyelaraskan toolbar, tabs geometry, cursor style, dan preset environment scoping modal pada Developer Terminal.

**Standarisasi Unified Utility Workspace (Oktober 2026) — sudah dikerjakan:**
- **Standardisasi Layout Utilitas (12-Column Responsive Grid):** Seluruh utilitas pengembang (`qr-generator`, `base64-encode-decode`, `url-encode-decode`, `markdown-viewer`) kini mengadopsi standar tata letak seragam:
  - Header halaman konsisten dengan `<PageHeader>`.
  - Mode navigasi atas menggunakan `<Tabs>` dengan underline track standar aplikasi (URL, Teks, Wi-Fi, Email, vCard, SMS di QR; Encode & Decode di Base64 dan URL).
  - Grid 12 kolom responsif: split `xl:col-span-7` untuk kartu konfigurasi/input di sebelah kiri dan `xl:col-span-5` untuk kartu output/live-preview di sebelah kanan (atau sticky pane 3:9 di Markdown Viewer).
- **Toolbar Input Terpadu (Action Parity):** Kartu input di setiap modul utilitas dilengkapi toolbar aksi terstandarisasi di bagian atas:
  - *Sample* (`auto_fix_high`): Memuat contoh data siap pakai yang realistis.
  - *Paste* (`content_paste`): Mengambil teks instan dari clipboard sistem.
  - *Clear* (`clear`): Membersihkan form input dengan sekali klik.
- **Kartu Output & Pratinjau Interaktif:**
  - Menampilkan penghitung karakter/byte dinamis secara konsisten.
  - Tombol aksi output standar (*Copy*, *Copy Image*, *Download*).
  - Integrasi editor interaktif dua arah (Interactive Query Table pada URL Encode/Decode, Image Preview dan Binary Download pada Base64, Live Canvas pada QR, dan Markdown Outline / TOC pada Markdown Viewer).
- **Aksesibilitas & Kepatuhan Kontrak Form (Aturan 6):** Seluruh input, textarea, slider, dan dropdown di keempat utilitas dipasangkan 100% menggunakan `<FieldLabel htmlFor="id_unik">` dan `id="id_unik"`, menjamin keterbacaan sempurna oleh screen reader dan test automation.

**Simplifikasi Modul Utilitas (QR Code & Base64) (Oktober 2026) — sudah dikerjakan:**
- **Konsolidasi Kategori QR Code (Hick's Law):** Menyederhanakan 6 tab terfragmentasi (URL, Teks, Wi-Fi, Email, vCard, SMS) menjadi 3 kategori tingkat atas yang intuitif:
  1. `Teks / URL` (`text_url`): Menggabungkan input teks bebas dan link web dalam satu textarea pintar dengan deteksi otomatis format URL (`tools.qr.url_detected`).
  2. `Wi-Fi` (`wifi`): Form koneksi jaringan nirkabel (SSID, Password, Security).
  3. `Kontak & Pesan` (`contact`): Form terpadu dengan pemilih sub-pill (*vCard*, *Email*, *SMS*).
- **Penyatuan Kartu Desain & Logo QR Code:** Menggabungkan Card 2 (*Visual Design*) dan Card 3 (*Insert Logo*) menjadi satu kartu seimbang 2 kolom (*Appearance & Logo*). Kolom kiri menangani level koreksi error (ECC), dot pattern, dan sudut; kolom kanan menangani slider resolusi, slider margin, `CompactFileDropzone` untuk logo kustom, dan slider skala logo. Mengurangi ~40% ruang gulir vertikal dan menghilangkan fatik visual.
- **Universal Dual-Input Area pada Base64:** Menghilangkan toggle buatan antara mode `Text Input` dan `File Input`. Mengintegrasikan input teks langsung dengan `CompactFileDropzone` di kedua mode (Encode & Decode). Opsi URL-safe dan pemotongan baris (line wrap) dipindahkan langsung ke toolbar kartu input.

Kalau mengerjakan salah satu area ini di masa depan, perbarui dokumen ini (termasuk §1 kalau ternyata ada token warna statis baru yang seharusnya theme-aware, atau sebaliknya).
