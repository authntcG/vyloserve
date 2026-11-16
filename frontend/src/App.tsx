import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';
import PhpMain from './menu/php/Main';
import LogsPanel from './components/LogsPanel';
import { ToastProvider } from './context/ToastContext';
import { AlertProvider, useAlert, type AlertOptions } from './context/AlertContext';
import DatabaseMain from './menu/database/Main';
import DashboardMain from './menu/dashboard/Main';
import ProjectsMain from './menu/projects/Main';
import GlobalAppInterceptor from './components/AppInterceptor';
import RuntimesMain from './menu/runtimes/Main';
import GitMain from './menu/tools/git/Main';
import UrlEncodeDecodeMain from './menu/tools/url-encode-decode/Main';
import Base64Main from './menu/tools/base64-encode-decode/Main';
import QrMain from './menu/tools/qr-generator/Main';
import TunnelsMain from './menu/tools/tunnels/Main';
import DocsReaderMain from './menu/tools/markdown-viewer/Main';
import PortManagerMain from './menu/tools/port-manager/Main';
import MailSandboxMain from './menu/tools/mail-sandbox/Main';
import WebhookInspectorMain from './menu/tools/webhook-inspector/Main';
import JsonStudioMain from './menu/utilities/json-studio/Main';
import JwtDebuggerMain from './menu/utilities/jwt-debugger/Main';
import CryptoGeneratorMain from './menu/utilities/crypto-generator/Main';
import RegexEpochMain from './menu/utilities/regex-epoch/Main';
import DataConverterMain from './menu/utilities/data-converter/Main';
import AiAssistantMain from './menu/tools/ai-assistant/Main';
import TerminalMain from './menu/tools/terminal/Main';
import AiFloatingWidget from './menu/tools/ai-assistant/components/AiFloatingWidget';
import AiSettingsModal from './menu/tools/ai-assistant/components/AiSettingsModal';
import { AiProvider, useAiAssistant } from './context/AiContext';
import { NetworkProvider } from './context/NetworkContext';
import { applyTheme, getCachedTheme } from './utils/theme';
import AppSkeletonLayout from './components/skeleton/AppSkeletonLayout';
import i18n from './i18n';

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

function useAppSettingsBootstrap() {
  const [isApiReady, setIsApiReady] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [healthReport, setHealthReport] = useState<any>(null);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);

  useEffect(() => {
    const applyAppSettings = async (res: any) => {
      if (res?.status === 'success') {
        if (res.data?.language) {
          i18n.changeLanguage(res.data.language);
        }
        const theme = res.data?.theme || getCachedTheme();
        applyTheme(theme);

        window.dispatchEvent(new CustomEvent('vylo_desktop_notifications_changed', {
          detail: { enabled: res.data?.enable_desktop_notifications ?? true }
        }));

        window.dispatchEvent(new CustomEvent('vylo_ai_settings_changed', {
          detail: res.data || {}
        }));
      }

      // Ambil Laporan Startup Module Health Check dari fase Native OS Splash Bootstrapper
      if (window.pywebview?.api?.get_startup_health_report) {
        try {
          const report = await window.pywebview.api.get_startup_health_report();
          setHealthReport(report);
        } catch (e) {
          console.error("Gagal mengambil startup health report:", e);
        }
      } else if (window.pywebview?.api?.run_startup_health_check) {
        try {
          const report = await window.pywebview.api.run_startup_health_check();
          setHealthReport(report);
        } catch (e) {
          console.error("Gagal menjalankan startup health check:", e);
        }
      }

      setIsSettingsLoaded(true);
      setIsApiReady(true);

      if (window.pywebview?.api?.check_for_updates) {
        window.pywebview.api.check_for_updates().then((upd: any) => {
          if (upd?.status === 'success' && upd?.is_update_available) {
            setPendingUpdate(upd);
          }
        }).catch((e: any) => console.error("Gagal mengecek pembaruan:", e));
      }
    };

    const checkApi = () => {
      if (!window.pywebview?.api?.test_connection) return false;

      if (window.pywebview.api.get_app_settings) {
        window.pywebview.api.get_app_settings()
          .then(applyAppSettings)
          .catch((err: any) => {
            console.error("Gagal memuat setting:", err);
            setIsSettingsLoaded(true);
            setIsApiReady(true);
          });
      } else {
        setIsSettingsLoaded(true);
        setIsApiReady(true);
      }
      return true;
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

  return {
    isApiReady,
    isSettingsLoaded,
    healthReport,
    pendingUpdate,
    setHealthReport,
    setPendingUpdate,
  };
}

function useGlobalShortcutsAndNavigation(setActiveMenu: React.Dispatch<React.SetStateAction<string>>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setActiveMenu(prev => prev === 'terminal' ? 'dashboard' : 'terminal');
      }
    };
    const handleOpenProjectTerminal = () => {
      setActiveMenu('terminal');
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('vylo_open_terminal_project', handleOpenProjectTerminal);
    const handleNavigateMenu = (e: Event) => {
      const customEvent = e as CustomEvent<{ menu: string }>;
      if (customEvent.detail?.menu) {
        setActiveMenu(customEvent.detail.menu);
      }
    };
    window.addEventListener('vylo_navigate_menu', handleNavigateMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('vylo_open_terminal_project', handleOpenProjectTerminal);
      window.removeEventListener('vylo_navigate_menu', handleNavigateMenu);
    };
  }, [setActiveMenu]);
}

interface PageWrapperProps {
  readonly menuKey: string;
  readonly activeMenu: string;
  readonly visitedMenus: readonly string[];
  readonly activeClassName?: string;
  readonly children: React.ReactNode;
}

function PageWrapper({ menuKey, activeMenu, visitedMenus, activeClassName = 'block', children }: PageWrapperProps) {
  if (!visitedMenus.includes(menuKey)) return null;
  const isActive = activeMenu === menuKey;
  return (
    <div className={isActive ? activeClassName : 'hidden'}>
      {children}
    </div>
  );
}

function AppPagesView({ activeMenu }: { readonly activeMenu: string }) {
  const [visitedMenus, setVisitedMenus] = useState<string[]>(() => [activeMenu]);

  useEffect(() => {
    setVisitedMenus(prev => (prev.includes(activeMenu) ? prev : [...prev, activeMenu]));
  }, [activeMenu]);

  const isFillScreen = activeMenu === 'ai-assistant' || activeMenu === 'terminal' || activeMenu === 'docs-reader';
  return (
    <div className={`flex-1 min-h-0 px-4 py-6 md:px-8 md:py-8 relative ${isFillScreen ? 'flex flex-col h-full overflow-hidden' : 'overflow-y-auto'}`}>
      <PageWrapper menuKey="dashboard" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <DashboardMain />
      </PageWrapper>
      <PageWrapper menuKey="projects" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <ProjectsMain />
      </PageWrapper>
      <PageWrapper menuKey="apache" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <ApacheMain />
      </PageWrapper>
      <PageWrapper menuKey="php" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <PhpMain />
      </PageWrapper>
      <PageWrapper menuKey="database" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <DatabaseMain />
      </PageWrapper>
      <PageWrapper menuKey="ai-assistant" activeMenu={activeMenu} visitedMenus={visitedMenus} activeClassName="flex-1 min-h-0 flex flex-col w-full">
        <AiAssistantMain isActive={activeMenu === 'ai-assistant'} />
      </PageWrapper>
      <PageWrapper menuKey="terminal" activeMenu={activeMenu} visitedMenus={visitedMenus} activeClassName="flex-1 min-h-0 flex flex-col w-full">
        <TerminalMain isActive={activeMenu === 'terminal'} />
      </PageWrapper>
      <PageWrapper menuKey="port-manager" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <PortManagerMain />
      </PageWrapper>
      <PageWrapper menuKey="mail-sandbox" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <MailSandboxMain />
      </PageWrapper>
      <PageWrapper menuKey="webhook-inspector" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <WebhookInspectorMain />
      </PageWrapper>
      <PageWrapper menuKey="tunnels" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <TunnelsMain />
      </PageWrapper>
      <PageWrapper menuKey="runtimes" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <RuntimesMain />
      </PageWrapper>
      <PageWrapper menuKey="git" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <GitMain />
      </PageWrapper>
      <PageWrapper menuKey="docs-reader" activeMenu={activeMenu} visitedMenus={visitedMenus} activeClassName="flex-1 min-h-0 flex flex-col w-full h-full">
        <DocsReaderMain />
      </PageWrapper>
      <PageWrapper menuKey="json-studio" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <JsonStudioMain />
      </PageWrapper>
      <PageWrapper menuKey="jwt-debugger" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <JwtDebuggerMain />
      </PageWrapper>
      <PageWrapper menuKey="crypto-generator" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <CryptoGeneratorMain />
      </PageWrapper>
      <PageWrapper menuKey="regex-epoch" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <RegexEpochMain />
      </PageWrapper>
      <PageWrapper menuKey="data-converter" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <DataConverterMain />
      </PageWrapper>
      <PageWrapper menuKey="qr" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <QrMain />
      </PageWrapper>
      <PageWrapper menuKey="base64" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <Base64Main />
      </PageWrapper>
      <PageWrapper menuKey="url-encode-decode" activeMenu={activeMenu} visitedMenus={visitedMenus}>
        <UrlEncodeDecodeMain />
      </PageWrapper>
    </div>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { confirm } = useAlert();
  const { enableAi } = useAiAssistant();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const {
    isApiReady,
    isSettingsLoaded,
    healthReport,
    pendingUpdate,
    setHealthReport,
    setPendingUpdate,
  } = useAppSettingsBootstrap();
  useGlobalShortcutsAndNavigation(setActiveMenu);

  useEffect(() => {
    if (!enableAi && activeMenu === 'ai-assistant') {
      setActiveMenu('dashboard');
    }
  }, [enableAi, activeMenu]);

  // Setelah jendela utama siap, tampilkan alert/laporan jika ada modul yang di-purge atau deferred
  useEffect(() => {
    if (!isApiReady || !isSettingsLoaded) return;

    if (healthReport?.status === 'success') {
      const recovered = healthReport.recovered || [];
      const purged = healthReport.purged || [];
      const deferred = healthReport.deferred_offline || [];

      if (purged.length > 0 || deferred.length > 0) {
        confirm({
          title: t('ui.bootstrap.alert_title', 'Startup Health Check & Cleansing Report'),
          type: 'warning',
          confirmText: t('common.ok', 'OK'),
          message: (
            <div className="flex flex-col gap-3 text-xs max-h-80 overflow-y-auto">
              {purged.length > 0 && (
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                    <span>{t('ui.bootstrap.alert_purged_title', 'Damaged & Cleaned Modules')}</span>
                  </div>
                  {purged.map((p: any, idx: number) => (
                    <div key={`purged-${p.module || p.reason_key || idx}-${idx}`} className="flex flex-col gap-0.5">
                      <span>• {t(p.reason_key || '', p.args || {}) as string}</span>
                      {p.preserved_data_path && (
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 pl-3">
                          {t('ui.bootstrap.alert_preserved_data', 'Database records were preserved at: {{path}}', { path: p.preserved_data_path }) as string}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {deferred.length > 0 && (
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-amber-600 dark:text-amber-400">
                    <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                    <span>{t('ui.bootstrap.alert_deferred_title', 'Recovery Deferred (Offline)') as string}</span>
                  </div>
                  {deferred.map((d: any, idx: number) => (
                    <span key={`deferred-${d.module || d.reason_key || idx}-${idx}`}>• {t(d.reason_key || '', d.args || {}) as string}</span>
                  ))}
                </div>
              )}
              {recovered.length > 0 && (
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-[18px]">health_and_safety</span>
                    <span>{t('ui.bootstrap.alert_recovered_title', 'Auto-Recovered Modules')}</span>
                  </div>
                  {recovered.map((r: any, idx: number) => (
                    <span key={`recovered-${r.module || r.reason_key || idx}-${idx}`}>• {t(r.reason_key || '', r.args || {}) as string}</span>
                  ))}
                </div>
              )}
            </div>
          )
        });
        setHealthReport(null);
      }
    } else if (pendingUpdate) {
      handleUpdateAvailable(pendingUpdate, confirm, t);
      setPendingUpdate(null);
    }
  }, [isApiReady, isSettingsLoaded, healthReport, pendingUpdate, confirm, t, setHealthReport, setPendingUpdate]);

  if (!isApiReady || !isSettingsLoaded) {
    return <AppSkeletonLayout />;
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
          enableAi={enableAi}
        />

        <div className={`flex flex-col flex-1 min-w-0 h-full min-h-0 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${mainContentMargin}`}>
          <AppPagesView activeMenu={activeMenu} />

          <div className="flex-none min-h-0 relative">
            <LogsPanel />
          </div>
        </div>
      </div>

      <AiFloatingWidget
        activeScreen={activeMenu}
        onOpenFullPage={() => setActiveMenu('ai-assistant')} />
      <AiSettingsModal />
    </div>
  );
}

export default function App() {
  return (
    <NetworkProvider>
      <ToastProvider>
        <AlertProvider>
          <AiProvider>
            <GlobalAppInterceptor />
            <AppContent />
          </AiProvider>
        </AlertProvider>
      </ToastProvider>
    </NetworkProvider>
  );
}
