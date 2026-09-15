# Frontend & Antarmuka (React UI)

Antarmuka VyloServe dibangun dengan arsitektur **Single Page Application (SPA)** yang modern menggunakan **React 18, TypeScript, dan Vite**. Gaya visual dikendalikan oleh **Tailwind CSS**.

## Struktur `frontend/src/`

```text
src/
├── components/           # Komponen-komponen UI yang Reusable (Standar DRY)
│   ├── ui/               # Badge, Button, Input, Modal, Table
│   ├── PageHeader.tsx    # Header seragam untuk setiap halaman modul
│   └── BackgroundProgressWidget.tsx # Overlay log instalasi OS Global
├── contexts/             # React Context (ThemeContext, TranslationContext)
├── locales/              # File konfigurasi multi-bahasa
│   ├── en.json           # Teks antarmuka Bahasa Inggris
│   └── id.json           # Teks antarmuka Bahasa Indonesia
├── menu/                 # Halaman-halaman fitur spesifik (Pages)
│   ├── apache/           # Modul Apache (Golden Standard)
│   ├── php/              # Modul PHP (Multi-Version & Ekstensi)
│   ├── database/         # Modul MySQL & PostgreSQL
│   ├── project/          # Modul Project Manager & Composer
│   └── runtimes/         # Modul Node, Python, Java, Go
├── App.tsx               # Routing utama & Base Layout Sidebar
└── main.tsx              # Entrypoint (Inisialisasi i18n & rendering DOM)
```

## 1. Komponen *Reusable* (Prinsip DRY)
VyloServe UI dirancang agar efisien. Setiap halaman sangat disarankan menggunakan komponen yang telah disediakan di folder `components/`.
- `<PageHeader />`: Jangan membuat elemen `<header>` atau judul manual berulang-ulang, selalu gunakan `<PageHeader title="..." icon="..." />`.
- `<Modal />`: Pop-up layar untuk konfirmasi instalasi/penghapusan. Jangan membuat komponen dengan z-index absolut baru.
- `<Badge />`: Menampilkan label warna status (misal status *Running*, *Stopped*).

## 2. Panggilan Python API (PyWebView)
Frontend menggunakan pola *Awaitable Promise* untuk memanggil Python. Objek API harus diambil dari global window.

**Best Practice Panggilan Backend:**
```typescript
import { useState } from 'react';

// Ambil objek PyWebView global secara aman (Casting any)
const api = (window as any).pywebview?.api;

const panggilBackend = async () => {
    try {
        const response = await api.start_apache_server();
        // Cek response sesuai Standar JSON (status, message, args)
        if (response.status === 'success') {
            console.log(response.message);
        }
    } catch (e) {
        console.error("Gagal terhubung ke jembatan Python", e);
    }
}
```

## 3. Menangani Notifikasi Toast (Golden Standard)
Gunakan *custom hook* (jika ada) atau panggil fungsi toast lokal untuk menampilkan pesan. 
**Ingat:** Halaman **Apache** dan **PHP** di dalam `src/menu/` adalah rujukan desain UI terbaik (Golden Standard) proyek ini. Jika Anda bingung dalam mendesain halaman baru, silakan copy-paste struktur dari halaman Apache.

## 4. Sistem Terjemahan (i18next)
Selalu gunakan *hook* `useTranslation` untuk teks yang ditampilkan ke pengguna.

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
    const { t } = useTranslation();
    
    // Penerjemahan sederhana:
    return <button>{t("ui.common.start")}</button>;
}
```

Jika menerima balasan (response) dinamis dari Backend Python:
```typescript
// Backend akan mengembalikan Translation Key (misal: "backend.project.install_success") 
// beserta args (misal: {"framework": "Laravel"})
const response = await api.create_project();
toast(t(response.message, response.args), response.status);
```
