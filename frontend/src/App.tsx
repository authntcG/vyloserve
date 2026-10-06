import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';
import PhpMain from './menu/php/Main';
import LogsPanel from './components/LogsPanel';
import { ToastProvider } from './components/ToastContext';
import { AlertProvider, useAlert, type AlertOptions } from './components/AlertContext';
import DatabaseMain from './menu/database/Main';
import DashboardMain from './menu/dashboard/Main';
import GlobalAppInterceptor from './components/AppInterceptor';
import RuntimesMain from './menu/runtimes/Main';
import GitMain from './menu/tools/git/Main';
import UrlEncodeDecodeMain from './menu/tools/url-encode-decode/Main';
import Base64Main from './menu/tools/base64-encode-decode/Main';
import QrMain from './menu/tools/qr-generator/Main';
import TunnelsMain from './menu/tools/tunnels/Main';
import { applyTheme } from './utils/theme';

declare global {
  interface Window {
    pywebview: any;
  }
}

/**
 * Tampilkan alert "Update Available" dengan changelog dari rilis GitHub (lihat
 * `core/services/updater.py:check_for_updates()` untuk bentuk `upd`). Kalau user
 * menekan tombol Update, buka tab Settings > Updates DAN langsung trigger download
 * di latar belakang -- tab Updates sendiri sudah sinkron ke status download lewat
 * `get_update_status()` saat dibuka (lihat `UpdatesTabContent` di SettingsModals.tsx),
 * jadi progress-nya otomatis ikut ter-tampilkan begitu modal terbuka.
 */
async function handleUpdateAvailable(
  upd: { version: string; changelog: string; asset_url: string; asset_name: string },
  confirmFn: (options: AlertOptions) => Promise<boolean>,
  tFn: any
) {
  const wantsUpdate = await confirmFn({
    title: tFn('ui.update.alert_title', 'Update Available: {{version}}', { version: upd.version }),
    message: (
      <div className="text-sm text-slate-700 dark:text-slate-300 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs bg-white dark:bg-black/20 p-3 rounded border border-emerald-500/20 dark:border-emerald-500/30">
        {upd.changelog || tFn('ui.update.no_changelog', 'No changelog provided.')}
      </div>
    ),
    type: 'info',
    confirmText: tFn('ui.update.alert_update_button', 'Update'),
    cancelText: tFn('common.close', 'Close'),
  });

  if (!wantsUpdate) return;

  window.dispatchEvent(new CustomEvent('vylo_open_settings_modal', { detail: { modal: 'updates' } }));
  window.pywebview.api.start_download_update?.(upd.asset_url, upd.asset_name);
}

function AppContent() {
  const { t } = useTranslation();
  const { confirm } = useAlert();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const [isApiReady, setIsApiReady] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    const checkApi = () => {
      if (window.pywebview?.api?.test_connection) {
        // --- LOAD GLOBAL SETTINGS ---
        if (window.pywebview.api.get_app_settings) {
            window.pywebview.api.get_app_settings().then((res: any) => {
                if (res?.status === 'success') {
                    if (res.data?.language) {
                        import('./i18n').then(({ default: i18n }) => {
                            i18n.changeLanguage(res.data.language);
                        });
                    }
                    const theme = res.data?.theme || 'vyloserve-dark';
                    applyTheme(theme);

                    // Broadcast ke ToastProvider (ToastContext.tsx) -- provider itu SENGAJA
                    // tidak memanggil get_app_settings() sendiri (hindari fetch duplikat),
                    // jadi mengandalkan event ini untuk nilai awal enable_desktop_notifications.
                    window.dispatchEvent(new CustomEvent('vylo_desktop_notifications_changed', {
                        detail: { enabled: res.data?.enable_desktop_notifications ?? true }
                    }));

                    // Cek update otomatis di latar belakang
                    if (window.pywebview.api.check_for_updates) {
                        window.pywebview.api.check_for_updates().then((upd: any) => {
                            if (upd?.status === 'success' && upd?.is_update_available) {
                                handleUpdateAvailable(upd, confirm, t);
                            }
                        }).catch((e: any) => console.error("Gagal mengecek pembaruan:", e));
                    }
                }
                setIsSettingsLoaded(true);
                setIsApiReady(true);
            }).catch((err: any) => {
                console.error("Gagal memuat setting:", err);
                setIsSettingsLoaded(true);
                setIsApiReady(true);
            });
        } else {
            setIsSettingsLoaded(true);
            setIsApiReady(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isApiReady || !isSettingsLoaded) {
    return (
      <div className="h-screen w-screen bg-transparent flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          {t('common.connecting_engine')}
        </p>
      </div>
    );
  }

  const mainContentMargin = isDesktopCollapsed ? 'md:ml-20' : 'md:ml-sidebar-width';

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-900">
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
            <div className={activeMenu === 'tunnels' ? 'block' : 'hidden'}><TunnelsMain /></div>
            <div className={activeMenu === 'runtimes' ? 'block' : 'hidden'}><RuntimesMain /></div>
            <div className={activeMenu === 'git' ? 'block' : 'hidden'}><GitMain /></div>
            <div className={activeMenu === 'qr' ? 'block' : 'hidden'}><QrMain /></div>
            <div className={activeMenu === 'base64' ? 'block' : 'hidden'}><Base64Main /></div>
            <div className={activeMenu === 'url-encode-decode' ? 'block' : 'hidden'}><UrlEncodeDecodeMain /></div>
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
      <AlertProvider>
        <GlobalAppInterceptor />
        <AppContent />
      </AlertProvider>
    </ToastProvider>
  );
}
