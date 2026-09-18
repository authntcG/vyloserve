import { useState, useEffect } from 'react';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';
import PhpMain from './menu/php/Main';
import LogsPanel from './components/LogsPanel';
import { ToastProvider } from './components/ToastContext';
import DatabaseMain from './menu/database/Main';
import DashboardMain from './menu/dashboard/Main';
import GlobalAppInterceptor from './components/AppInterceptor';
import RuntimesMain from './menu/runtimes/Main';
import GitMain from './menu/tools/git/Main';
import UrlEncodeDecodeMain from './menu/tools/url-encode-decode/Main';
import Base64Main from './menu/tools/base64-encode-decode/Main';
import QrMain from './menu/tools/qr-generator/Main';

declare global {
  interface Window {
    pywebview: any;
  }
}

function AppContent() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    const checkApi = () => {
      if (window.pywebview?.api?.test_connection) {
        setIsApiReady(true);
        
        // --- LOAD GLOBAL SETTINGS ---
        if (window.pywebview.api.get_app_settings) {
            window.pywebview.api.get_app_settings().then((res: any) => {
                if (res?.status === 'success' && res.data?.language) {
                    import('./i18n').then(({ default: i18n }) => {
                        i18n.changeLanguage(res.data.language);
                    });
                }
            }).catch((err: any) => console.error("Gagal memuat setting:", err));
        }

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

  const mainContentMargin = isDesktopCollapsed ? 'md:ml-20' : 'md:ml-sidebar-width';

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

          {/* ---> FIX: Ganti Kondisional Render dengan CSS Hiding <--- */}
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 relative">
            <div className={activeMenu === 'dashboard' ? 'block' : 'hidden'}><DashboardMain /></div>
            <div className={activeMenu === 'apache' ? 'block' : 'hidden'}><ApacheMain /></div>
            <div className={activeMenu === 'php' ? 'block' : 'hidden'}><PhpMain /></div>
            <div className={activeMenu === 'database' ? 'block' : 'hidden'}><DatabaseMain /></div>
            <div className={activeMenu === 'runtimes' ? 'block' : 'hidden'}><RuntimesMain /></div>
            <div className={activeMenu === 'git' ? 'block' : 'hidden'}><GitMain /></div>
            <div className={activeMenu === 'url-encode-decode' ? 'block' : 'hidden'}><UrlEncodeDecodeMain /></div>
            <div className={activeMenu === 'base64' ? 'block' : 'hidden'}><Base64Main /></div>
            <div className={activeMenu === 'qr' ? 'block' : 'hidden'}><QrMain /></div>
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
      <GlobalAppInterceptor />
      <AppContent />
    </ToastProvider>
  );
}