// src/App.tsx
import { useState, useEffect } from 'react';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';
import PhpMain from './menu/php/Main';
import LogsPanel from './components/LogsPanel';
import { ToastProvider, useToast } from './components/ToastContext';

declare global {
  interface Window {
    pywebview: any;
  }
}

function AppContent() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('php');

  // ---> STATE BARU: Global Gatekeeper <---
  const [isApiReady, setIsApiReady] = useState(false);

  const { showToast } = useToast();

  // Pengecekan API Terpusat (Hanya berjalan sekali saat aplikasi dibuka)
  useEffect(() => {
    const checkApi = () => {
      // Pastikan objek ada dan salah satu fungsi API kita sudah ter-bind
      if (window.pywebview && window.pywebview.api && window.pywebview.api.test_connection) {
        setIsApiReady(true);
        return true;
      }
      return false;
    };

    if (!checkApi()) {
      const handleReady = () => checkApi();
      window.addEventListener('pywebviewready', handleReady);

      const interval = setInterval(() => {
        if (checkApi()) {
          clearInterval(interval);
          window.removeEventListener('pywebviewready', handleReady);
        }
      }, 100);

      return () => {
        clearInterval(interval);
        window.removeEventListener('pywebviewready', handleReady);
      };
    }
  }, []);

  // Jika API belum siap, tampilkan layar loading (Mencegah komponen anak di-render)
  if (!isApiReady) {
    return (
      <div className="h-screen w-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          Connecting to VyloServe Engine...
        </p>
      </div>
    );
  }

  // --- KODE RENDER APLIKASI UTAMA (Hanya dieksekusi setelah API Ready) ---
  const mainContentMargin = isDesktopCollapsed ? 'md:ml-20' : 'md:ml-sidebar-width';

  const handleTestBridge = async () => {
    try {
      const response = await window.pywebview.api.test_connection("Halo dari React!");
      showToast(`Sukses: ${response.message}`, 'success');
    } catch (error) {
      showToast("Terjadi error saat memanggil API Python.", 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-background dark:bg-slate-900">
      <HeaderMobile onMenuClick={() => setIsMobileOpen(true)} />

      <div className="flex flex-1 relative w-full h-[calc(100vh-64px)] md:h-screen">
        <Sidebar
          isMobileOpen={isMobileOpen}
          isDesktopCollapsed={isDesktopCollapsed}
          onCloseMobile={() => setIsMobileOpen(false)}
          onToggleDesktop={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
          activeMenu={activeMenu}
          onSelectMenu={setActiveMenu}
        />

        <div className={`flex flex-col flex-1 w-full transition-all duration-300 ${mainContentMargin}`}>
          <div className="px-4 md:px-8 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-end">
            <button onClick={handleTestBridge} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg shadow-sm transition-colors">
              Test Bridge
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            {activeMenu === 'apache' && <ApacheMain />}
            {activeMenu === 'php' && <PhpMain />}
          </div>

          <div className="flex-none z-10 relative">
            <LogsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}