import { useState } from 'react';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';
import PhpMain from './menu/php/Main';
import LogsPanel from './components/LogsPanel'; // Import LogsPanel di sini

function App() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState('apache');

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

        {/* Kontainer Kanan (Membentang di sebelah Sidebar) */}
        <div className={`flex flex-col flex-1 w-full transition-all duration-300 ${mainContentMargin}`}>

          {/* Bagian yang BISA di-scroll */}
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            {activeMenu === 'apache' && <ApacheMain isDesktopCollapsed={isDesktopCollapsed} />}
            {activeMenu === 'php' && <PhpMain isDesktopCollapsed={isDesktopCollapsed} />}
          </div>

          {/* Bagian LogsPanel yang PERMANEN di bawah */}
          <div className="flex-none z-10 relative">
            <LogsPanel />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;