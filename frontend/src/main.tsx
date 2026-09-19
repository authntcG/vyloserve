import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './i18n'

// --- TAMBAHKAN IMPORT ASET OFFLINE DI SINI ---
// 1. Import Ikon Material Symbols
// CSS-nya diimport lewat @import "material-symbols/outlined.css" layer(base) di
// src/index.css (BUKAN di sini) -- lihat komentar di index.css untuk alasannya
// (Cascade Layers: CSS tanpa layer selalu menindih @layer utilities Tailwind,
// jadi text-[Npx] pada ikon tidak akan pernah berfungsi kalau diimport polos di sini).

// 2. Import Font Inter (Opsional, jika Anda menggunakan font Inter)
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/500.css'; // Medium
import '@fontsource/inter/600.css'; // Semi-bold
import '@fontsource/inter/700.css'; // Bold
// ---------------------------------------------

import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
