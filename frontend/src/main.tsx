import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// --- TAMBAHKAN IMPORT ASET OFFLINE DI SINI ---
// 1. Import Ikon Material Symbols
import 'material-symbols/outlined.css';

// 2. Import Font Inter (Opsional, jika Anda menggunakan font Inter)
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/500.css'; // Medium
import '@fontsource/inter/600.css'; // Semi-bold
import '@fontsource/inter/700.css'; // Bold
// ---------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
