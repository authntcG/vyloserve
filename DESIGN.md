---
name: "VyloServe Design System"
version: "1.0.0"
framework: "HTML5 + Tailwind CSS v4"
platform: "Desktop Application (pywebview / Windows 11 Fluent & Mica aesthetic)"
color_scheme:
  default: "dark (vyloserve-dark)"
  supported: "15 theme presets (vyloserve-dark, vyloserve-light, darcula-dark, solarized-dark, solarized-light, high-contrast-dark, high-contrast-light, monokai, dracula, nord, windows-xp-luna, windows-xp-zune, catppuccin-mocha, tokyo-night, gruvbox-dark)"
tokens:
  colors:
    background_dark: "#020617" # slate-950
    background_light: "#f8fafc" # slate-50
    surface_dark: "#0f172a" # slate-900
    surface_light: "#ffffff" # white
    surface_secondary_dark: "#1e293b" # slate-800
    surface_secondary_light: "#f1f5f9" # slate-100
    border_dark: "#1e293b" # slate-800
    border_light: "#e2e8f0" # slate-200
    border_subtle_dark: "#334155" # slate-700
    border_subtle_light: "#cbd5e1" # slate-300
    text_primary_dark: "#ffffff" # white
    text_primary_light: "#0f172a" # slate-900
    text_muted_dark: "#94a3b8" # slate-400
    text_muted_light: "#64748b" # slate-500
    text_subtle_dark: "#64748b" # slate-500
    text_subtle_light: "#94a3b8" # slate-400
    primary: "#3b82f6" # Brand accent (theme-aware)
    emerald_500: "#10b981" # Running / Success / Installed (theme-aware)
    emerald_600: "#059669" # Running hover
    amber_500: "#f59e0b" # Stopping / Warning / Attention (theme-aware)
    amber_600: "#d97706" # Stopping hover
    red_600: "#dc2626" # Danger / Offline / Error (intentionally static)
    red_700: "#b91c1c" # Danger hover
  typography:
    font_sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font_mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    weights:
      normal: "400"
      medium: "500"
      semibold: "600"
      bold: "700"
  rounded:
    sm: "4px"
    md: "6px"
    lg: "8px"
    xl: "12px"
    2xl: "16px"
    full: "9999px"
  shadows:
    card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
    card_hover: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
    modal: "0 25px 50px -12px rgb(0 0 0 / 0.25)"
    dropdown: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  icons:
    family: "Material Symbols Outlined"
    default_style: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
    cdn_url: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
---

# VyloServe Design System (`DESIGN.md`)
> **Source of Truth for Google Stitch (`https://stitch.withgoogle.com/`)**  
> Standar desain, token visual, layout blueprint, dan pustaka komponen generik untuk menghasilkan mockup presisi tinggi yang 100% konsisten dengan aplikasi desktop VyloServe.

---

## 1. Filosofi & Karakter Visual

**VyloServe** adalah aplikasi desktop modern Windows 11 pengelola server lokal (Apache, PHP, Database, Multi-Runtime Node/Python/Java/Go, Developer Terminal, Tunnels, dan AI Assistant). 

### Prinsip Utama Desain:
1. **Developer-First & Information Density**: UI didesain padat informasi (dense yet breathable) tanpa ornamen yang mengganggu. Font sans-serif bersih (`Inter`) dikombinasikan dengan monospace (`font-mono`) untuk port, versi, path, dan status kode.
2. **Windows 11 Mica & Subsurface Aesthetic**: Menggunakan border tipis berdefinisi tinggi (`border-slate-800` di dark mode, `border-slate-200` di light mode), bayangan halus (`shadow-sm` ke `shadow-md`), dan backdrop semi-transparan (`backdrop-blur-sm`).
3. **Golden Standard Architecture**: Setiap modul utama wajib mengikuti siklus tata letak standar:
   $$\text{PageHeader} \longrightarrow \text{Skeleton Loading} \longrightarrow \text{Empty State} \longrightarrow \text{Card / Table Grid} \longrightarrow \text{Modal / Actions}$$
4. **Semantik Aksi Jelas**:
   - **Start / Aktif / Terinstal**: Hijau Emerald (`#10b981`)
   - **Stop / Peringatan / Update**: Amber (`#f59e0b`)
   - **Destruktif / Error / Bahaya**: Merah (`#dc2626`)
   - **Netral / Terisolasi / Nonaktif**: Slate (`#64748b`)
   - **Aksen Utama / Link / Brand**: Primary Blue (`#3b82f6`)

---

## 2. Aturan Warna & Theme Awareness

### 2.1 Token yang Mengikuti Tema (Theme-Aware)
Warna-warna ini terikat ke variabel CSS tema aplikasi. Saat membuat komponen atau mockup di Stitch:
- **`primary`**: Selalu gunakan `bg-primary`, `text-primary`, `border-primary`. Untuk hover, gunakan varian opacity: `hover:bg-primary/90`.
- **`slate` (50 s/d 950)**: Skala warna netral utama untuk latar, border, teks, dan kartu.
  - Background Window: `bg-slate-950` (dark) / `bg-slate-50` (light)
  - Background Card/Surface: `bg-slate-900` (dark) / `bg-white` (light)
  - Surface Sekunder: `bg-slate-800` (dark) / `bg-slate-100` (light)
  - Border Standar: `border-slate-800` (dark) / `border-slate-200` (light)
- **`emerald` (400, 500, 600)**: State tombol Start, service aktif, dan badge terpasang (`bg-emerald-500`, `hover:bg-emerald-600`).
- **`amber` (500, 600)**: State tombol Stop dan indikator update versi (`bg-amber-500`, `hover:bg-amber-600`).

### 2.2 Token yang Sengaja Statis
- **`red` (600, 700)**: Semua aksi destruktif (Uninstall, Delete Database, Force Kill). Dibuat statis lintas tema agar pengguna selalu mengenali sinyal bahaya secara instan.

### 2.3 Aturan Background Tint & Highlight (PENTING!)
Dilarang menggunakan warna keluarga yang tidak ter-cover (misal `bg-emerald-100` atau `bg-blue-50`). **Gunakan pola opacity di atas token yang sah**:
- Tint Hijau: `bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20`
- Tint Amber: `bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border-amber-500/20`
- Tint Primary: `bg-primary/10 text-primary dark:bg-primary/20 border-primary/20`
- Tint Merah: `bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50`

---

## 3. Struktur Layout Aplikasi (App Shell)

Layout desktop VyloServe terbagi atas 4 zona utama:
1. **Sidebar Navigasi Kiri**:
   - Lebar Expanded: `w-[260px]`
   - Lebar Collapsed: `w-[80px]`
   - Terdiri dari: Logo Header, Navigasi Grup (Main, Services dengan live Toggle Switch, Tools, Utilities), dan Footer (Lonceng Notifikasi, System Load RAM/CPU, Tombol Settings).
2. **Area Konten Utama (Main Content)**:
   - Margin dinamis: `md:ml-[260px]` (expanded) atau `md:ml-[80px]` (collapsed).
   - Padding area kerja: `px-4 py-6 md:px-8 md:py-8`.
   - Scrollable vertikal `overflow-y-auto`.
3. **Panel Log Bawah (Logs Panel)**:
   - Bar bawah yang dapat di-toggle (`h-10` saat collapse, `h-56` saat expanded).
   - Background konsol hitam (`bg-slate-950`) dengan live streaming teks log berwarna semantik.
4. **Widget AI Mengambang (Floating AI Copilot)**:
   - Terletak di pojok kanan-bawah: `fixed bottom-6 right-6 z-50`.
   - Tombol bulat bergradien dengan ikon robot/sparkle dan counter unread badge.

---

## 4. Pustaka Kode Template Generik (Copy-Paste Ready)

Gunakan potongan kode HTML + Tailwind CSS berikut sebagai blok bangunan dasar saat mendesain atau menyusun layout di **Google Stitch**:

### 4.1 Tombol (Button System)

```html
<!-- Primary CTA Button -->
<button type="button" class="bg-primary hover:bg-primary/90 text-white font-medium text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
  <span class="material-symbols-outlined text-[18px]">add</span>
  <span>Create Project</span>
</button>

<!-- Secondary Neutral Button -->
<button type="button" class="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95">
  <span class="material-symbols-outlined text-[18px]">close</span>
  <span>Cancel</span>
</button>

<!-- Ghost Button (Toolbar / Link Style) -->
<button type="button" class="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
  <span class="material-symbols-outlined text-[18px]">refresh</span>
  <span>Refresh</span>
</button>

<!-- Danger Destructive Button -->
<button type="button" class="bg-red-600 hover:bg-red-700 text-white font-medium text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95">
  <span class="material-symbols-outlined text-[18px]">delete</span>
  <span>Delete Instance</span>
</button>

<!-- Icon Only Button -->
<button type="button" aria-label="Settings" class="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center">
  <span class="material-symbols-outlined text-[20px]">more_vert</span>
</button>
```

### 4.2 Service Toggle Button (Live Start / Stop)

```html
<!-- State: Service is STOPPED (Click to Start) -->
<button type="button" class="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
  <span class="material-symbols-outlined text-[18px]">play_arrow</span>
  <span>Start Server</span>
</button>

<!-- State: Service is RUNNING (Click to Stop) -->
<button type="button" class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
  <span class="material-symbols-outlined text-[18px]">stop</span>
  <span>Stop Server</span>
</button>

<!-- State: Service is TOGGLING (Transitioning...) -->
<button type="button" disabled class="bg-emerald-500 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm opacity-70 cursor-not-allowed">
  <span class="material-symbols-outlined text-[18px] animate-spin">sync</span>
  <span>Starting...</span>
</button>
```

### 4.3 Installed Badge (Header Status Indicator)

```html
<!-- Standard Header Installed Badge -->
<button type="button" disabled class="bg-emerald-500 disabled:opacity-100 disabled:cursor-default border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap cursor-default select-none">
  <span class="material-symbols-outlined text-[18px]">check_circle</span>
  <span>Installed</span>
</button>
```

### 4.4 Status Badges (Semantic Pills)

```html
<!-- Running / Active / Installed -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30">
  <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500"></span>
  Running
</span>

<!-- Stopped / Isolated / Neutral -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
  <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400"></span>
  Stopped
</span>

<!-- Error / Offline / Conflict -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50">
  <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-red-500"></span>
  Port Conflict
</span>

<!-- System / Native OS Runtime -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-primary/10 text-primary dark:bg-primary/20 border-primary/20 dark:border-primary/30">
  <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-primary"></span>
  Native OS
</span>

<!-- Update Available Tag -->
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 border-amber-500/20 dark:border-amber-500/30">
  <span class="material-symbols-outlined text-[12px]">upgrade</span>
  Update 2.4.63
</span>
```

### 4.5 Header Halaman (PageHeader)

```html
<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-3">
      <span class="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[32px]">
        dns
      </span>
      <h2 class="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
        Apache Web Server
      </h2>
    </div>
    <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
      <span>Manage HTTP/HTTPS daemons, ports, and configuration files</span>
    </div>
  </div>

  <!-- Action CTA Group -->
  <div class="flex items-center gap-3 pb-1">
    <button type="button" class="bg-emerald-500 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm">
      <span class="material-symbols-outlined text-[18px]">play_arrow</span>
      <span>Start Server</span>
    </button>
    <button type="button" aria-label="Global Config" class="p-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
      <span class="material-symbols-outlined text-[20px]">tune</span>
    </button>
  </div>
</div>
```

### 4.6 Kartu Modul Utama (Standard Golden Card)

```html
<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all duration-200 group">
  <!-- Card Header -->
  <div class="flex justify-between items-start gap-4">
    <div class="flex flex-wrap items-center gap-2 md:gap-3">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
        Node.js (VyloServe)
      </h3>
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
        <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400"></span>
        Isolated
      </span>
    </div>

    <!-- Burger Menu -->
    <div class="relative">
      <button type="button" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </div>
  </div>

  <!-- Dynamic Grid Body -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="flex flex-col gap-1 min-w-0">
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Version</span>
      <span class="font-mono text-sm text-slate-900 dark:text-slate-200 truncate">v20.11.0 (LTS)</span>
    </div>
    <div class="flex flex-col gap-1 min-w-0">
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Sub-tool</span>
      <span class="font-mono text-xs font-semibold text-primary truncate">npm v10.8.2</span>
    </div>
    <div class="flex flex-col gap-1 min-w-0 col-span-1 md:col-span-2">
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Binary Path</span>
      <span class="font-mono text-xs text-slate-500 dark:text-slate-400 truncate bg-slate-50 dark:bg-slate-950 p-2 rounded-md border border-slate-200 dark:border-slate-800">
        bin/node/v20.11.0/node.exe
      </span>
    </div>
  </div>

  <!-- Card Action Footer -->
  <div class="flex gap-3 mt-2 pt-6 border-t border-slate-100 dark:border-slate-800">
    <button type="button" class="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs">
      <span class="material-symbols-outlined text-[16px]">folder_open</span>
      <span>Open Folder</span>
    </button>
    <button type="button" class="flex-1 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs">
      <span class="material-symbols-outlined text-[16px]">terminal</span>
      <span>Open in Terminal</span>
    </button>
  </div>
</div>
```

### 4.7 Form Input & Label (A11y Compliant)

```html
<div class="flex flex-col gap-2">
  <!-- Wajib selalu berpasangan: htmlFor="custom_id" dan id="custom_id" -->
  <label for="server-port-input" class="text-sm font-medium text-slate-700 dark:text-slate-300">
    Server Port
  </label>
  <div class="relative">
    <input 
      type="number" 
      id="server-port-input" 
      value="8080" 
      class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
      placeholder="e.g. 80, 8080"
    />
  </div>
  <span class="text-xs text-slate-500 dark:text-slate-400">
    Port default untuk akses HTTP proyek lokal.
  </span>
</div>
```

### 4.8 Toggle Switch (Slider Toggle)

```html
<!-- Checked State (Active) -->
<button type="button" role="switch" aria-checked="true" aria-label="Toggle Auto-start" class="w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative bg-primary flex items-center">
  <span class="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out translate-x-4"></span>
</button>

<!-- Unchecked State (Inactive) -->
<button type="button" role="switch" aria-checked="false" aria-label="Toggle Auto-start" class="w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative bg-slate-300 dark:bg-slate-700 flex items-center">
  <span class="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out translate-x-0"></span>
</button>
```

### 4.9 InfoBox / Notice Banner

```html
<!-- Warning Tone -->
<div class="flex items-start gap-3 p-4 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500">
  <span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5">warning</span>
  <div class="text-xs flex flex-col gap-1 leading-relaxed text-slate-700 dark:text-slate-300">
    <span class="font-semibold text-amber-600 dark:text-amber-500">Port Conflict Detected</span>
    <span>Port 80 sedang digunakan oleh aplikasi lain (PID: 4120). Harap hentikan proses tersebut atau ubah port aktif.</span>
  </div>
</div>

<!-- Info Tone -->
<div class="flex items-start gap-3 p-4 rounded-xl border bg-primary/10 border-primary/20 text-primary">
  <span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5">info</span>
  <div class="text-xs flex flex-col gap-1 leading-relaxed text-slate-700 dark:text-slate-300">
    <span class="font-semibold text-primary">Pretty URL Active</span>
    <span>Proyek dapat langsung diakses melalui reverse proxy di <code class="font-mono text-primary font-bold">http://myproject.local</code>.</span>
  </div>
</div>
```

### 4.10 Projects Hub: Dual-View Switcher & Table Row

```html
<!-- View Mode Toggle Buttons (Toolbar) -->
<div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
  <!-- Active Table Button -->
  <button type="button" aria-label="Table View" class="p-1.5 rounded-md text-xs font-medium transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs">
    <span class="material-symbols-outlined text-[18px]">table_rows</span>
  </button>
  <!-- Inactive Card Button -->
  <button type="button" aria-label="Card View" class="p-1.5 rounded-md text-xs font-medium transition-colors text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
    <span class="material-symbols-outlined text-[18px]">grid_view</span>
  </button>
</div>

<!-- Projects Data Table -->
<div class="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
  <table class="w-full text-left text-sm border-collapse">
    <thead class="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
      <tr>
        <th class="py-3.5 px-4">Project</th>
        <th class="py-3.5 px-4">Runtime & Engine</th>
        <th class="py-3.5 px-4">Domain / URL</th>
        <th class="py-3.5 px-4">Dev Server</th>
        <th class="py-3.5 px-4 text-right">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">folder</span>
            <span>ecommerce-api</span>
          </div>
        </td>
        <td class="py-3.5 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            Node.js (Express)
          </span>
        </td>
        <td class="py-3.5 px-4 font-mono text-xs">
          <a href="http://ecommerce.local" class="text-primary hover:underline flex items-center gap-1">
            <span>ecommerce.local</span>
            <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </td>
        <td class="py-3.5 px-4">
          <!-- Start/Stop mini button -->
          <button type="button" class="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-xs font-medium py-1 px-2.5 rounded-md transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">play_arrow</span>
            <span>Start (3000)</span>
          </button>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" title="Open in Terminal" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined text-[18px]">terminal</span>
            </button>
            <button type="button" title="Project Settings" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              <span class="material-symbols-outlined text-[18px]">settings</span>
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 4.11 Modal Dialog (Standard Window Container)

```html
<!-- Modal Backdrop & Window Container -->
<div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
  <div class="relative w-full sm:w-[520px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
    
    <!-- Modal Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[24px]">tune</span>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Global Server Configuration</h3>
      </div>
      <button type="button" aria-label="Close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md">
        <span class="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>

    <!-- Modal Scrollable Body -->
    <div class="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
      <div class="flex flex-col gap-2">
        <label for="modal-input" class="text-sm font-medium text-slate-700 dark:text-slate-300">Active Apache Version</label>
        <input id="modal-input" type="text" value="Apache 2.4.62 Win64" readonly class="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-800 dark:text-slate-200" />
      </div>
    </div>

    <!-- Modal Footer -->
    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
      <button type="button" class="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium py-2 px-4 rounded-lg">
        Cancel
      </button>
      <button type="button" class="bg-primary hover:bg-primary/90 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm">
        Save Changes
      </button>
    </div>

  </div>
</div>
```

---

## 5. Blueprint Layar Penuh untuk Prompt Stitch

Gunakan prompt berikut pada **Stitch with Google** (`https://stitch.withgoogle.com/`) untuk merekonstruksi setiap halaman spesifik:

### 5.1 Screen 1: Dashboard (`menu/dashboard/`)
* **Prompt Konsep di Stitch**:
  > *"Create a desktop control panel dashboard for VyloServe using dark slate background (#020617) and white surfaces (#0f172a). Include top PageHeader with space_dashboard icon. Render 3 summary service cards in a grid: Apache (Running, Port 80), PHP (3 versions active), and Database (MySQL active on 3306). Include a global Start/Stop All button, an SVG sparkline monitoring CPU and RAM load, and a Recent Projects table with status badges and quick-launch links."*

### 5.2 Screen 2: Projects Hub (`menu/projects/`)
* **Prompt Konsep di Stitch**:
  > *"Generate a Projects Hub screen for local web projects. Show a PageHeader with folder_open icon, subtitle counting projects, and a primary blue 'New Project' button. Include a search bar, runtime filter pills (All, PHP, Node.js, Python, Java, Go), and a segmented control view switcher (Card vs Table). Render project items with their local pretty domain (.local), dev server port, runtime badge, and action buttons for Terminal, Explorer, and Settings."*

### 5.3 Screen 3: Apache Web Server (`menu/apache/`)
* **Prompt Konsep di Stitch**:
  > *"Create the Apache Web Server management screen. PageHeader has dns icon, an Installed checkmark badge, and Start/Stop toggle button. Top section features two port indicator badges: Port 80 (HTTP) Listening in green, and Port 443 (HTTPS) Ready in blue. Below it, render ApacheQuickLinks: a grid of shortcut buttons for localhost browser, Document Root (htdocs), Config Directory (conf), Logs Directory (logs), and edit buttons for httpd.conf and vhosts.conf."*

### 5.4 Screen 4: Multi-Runtime Engines (`menu/runtimes/`)
* **Prompt Konsep di Stitch**:
  > *"Generate a Multi-Runtime Management interface. Render underline tabs for Node.js, Python, Java JDK, and Go Compiler. For the active tab, render an elevated Card with status badge 'Isolated', engine version 'v20.11.0 (LTS)', sub-tool info 'npm v10.8.2' highlighted in blue, and a PATH registration toggle switch. Add card footer action buttons: 'Open Folder' and 'Open in Terminal'."*

### 5.5 Screen 5: Developer Terminal (`menu/tools/terminal/`)
* **Prompt Konsep di Stitch**:
  > *"Design an embedded developer terminal workspace. Tab bar at top with PowerShell, Git Bash, and CMD sessions, plus a '+' button and split pane controls. Main console viewport has black canvas (#000000), monospace font, green success prompt symbol, and terminal output. Bottom bar shows active environment path switcher: 'VyloServe Isolated PATH' vs 'System OS PATH'."*

---

## 6. Checklist Verifikasi Mockup di Stitch (Definition of Done)

Sebelum menyelesaikan desain mockup di Google Stitch, pastikan:
- [ ] **Skema Gelap Konsisten**: Background utama menggunakan `#020617`, kartu menggunakan `#0f172a`, border menggunakan `#1e293b`.
- [ ] **Ikonografi Seragam**: Menggunakan Google Material Symbols Outlined dengan format `span class="material-symbols-outlined"`.
- [ ] **Aksesibilitas Label**: Setiap input form memiliki label berpasangan (`htmlFor` dan `id` bernilai identik).
- [ ] **Tidak Ada Warna Acak**: Warna tombol dan status hanya menggunakan skala `primary`, `emerald-500`, `amber-500`, dan `red-600`.
- [ ] **Border Radius Tepat**: `rounded-xl` (12px) untuk semua Card, `rounded-lg` (8px) untuk semua Button dan Input, `rounded-2xl` (16px) untuk Modal.
- [ ] **Tipografi Teratur**: Semua port, versi, URL, dan path berkas diformat dengan class `font-mono`.
