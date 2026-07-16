// src/App.tsx
import { useState } from 'react';
import HeaderMobile from './components/HeaderMobile';
import Sidebar from './components/Sidebar';
import ApacheMain from './menu/apache/Main';

function App() {
  // State khusus layout utama (Shell)
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  return (
    <div className="flex flex-col min-h-screen relative">
      <HeaderMobile onMenuClick={() => setIsMobileOpen(true)} />
      
      <div className="flex flex-1 relative w-full">
        <Sidebar 
          isMobileOpen={isMobileOpen} 
          isDesktopCollapsed={isDesktopCollapsed}
          onCloseMobile={() => setIsMobileOpen(false)}
          onToggleDesktop={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
        />
        
        {/* Render Konten Halaman Aktif di sini */}
        {/* Nanti jika menggunakan React Router, di sinilah letak <Routes> Anda */}
        <ApacheMain isDesktopCollapsed={isDesktopCollapsed} />
        
      </div>
    </div>
  );
}

export default App;