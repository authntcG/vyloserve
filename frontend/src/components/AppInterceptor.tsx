import { useEffect, useState } from 'react';
import { useToast } from './ToastContext';

export default function GlobalAppInterceptor() {
    const { showToast } = useToast();
    const [menuState, setMenuState] = useState({
        visible: false,
        x: 0,
        y: 0,
        textToCopy: ''
    });

    useEffect(() => {
        // =========================================================
        // 1. BLOKIR KLIK KANAN (CONTEXT MENU INTERCEPTOR)
        // =========================================================
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault(); 
            const target = e.target as HTMLElement;
            const logArea = target.closest('.vylo-log-area'); 

            if (logArea) {
                const selectedText = window.getSelection()?.toString();
                const textToCopy = selectedText || target.innerText || target.textContent;
                
                setMenuState({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    textToCopy: textToCopy?.trim() || ''
                });
            } else {
                setMenuState({ visible: false, x: 0, y: 0, textToCopy: '' });
            }
        };

        const handleClick = () => {
            setMenuState(prev => ({ ...prev, visible: false }));
        };

        // =========================================================
        // 2. BLOKIR KEYBOARD SHORTCUTS (KEYBOARD INTERCEPTOR)
        // =========================================================
        const handleKeyDown = (e: KeyboardEvent) => {
            // Daftar aturan pemblokiran shortcut bawaan browser
            const isForbidden = [
                e.key === 'F12',                                           // DevTools
                e.key === 'F5',                                            // Refresh (F5)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r',   // Refresh (Ctrl+R / Cmd+R)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p',   // Print (Ctrl+P / Cmd+P)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's',   // Save Page (Ctrl+S / Cmd+S)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u',   // View Source (Ctrl+U / Cmd+U)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f',   // Find (Ctrl+F / Cmd+F)
                (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g',   // Find Next (Ctrl+G / Cmd+G)
                (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i', // Inspect Element (Ctrl+Shift+I)
                (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c', // Inspect Element (Ctrl+Shift+C)
                (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j', // Console (Ctrl+Shift+J)
                e.altKey && e.key === 'ArrowLeft',                         // Back Navigation
                e.altKey && e.key === 'ArrowRight',                        // Forward Navigation
            ].some(condition => condition === true); // Cek apakah ada satupun yang TRUE

            if (isForbidden) {
                e.preventDefault(); // Matikan aksi bawaan OS/Browser secara mutlak
                e.stopPropagation(); // Hentikan event agar tidak diteruskan ke komponen lain
                
                // (Opsional) Tampilkan pesan debug jika Anda sedang memantau, 
                // Namun untuk Production, biarkan tetap diam (silent kill) seperti aplikasi native.
                // console.log(`[VyloServe] Diblokir: Tombol ${e.key} dilarang.`);
            }
        };

        // Memasang Event Listener ke Window
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown, { capture: true }); // capture: true memastikan event ini dicegat paling pertama

        return () => {
            // Membersihkan Event Listener saat komponen di-unmount
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, []);

    const handleCopy = async () => {
        if (menuState.textToCopy) {
            try {
                await navigator.clipboard.writeText(menuState.textToCopy);
                showToast("Log disalin ke clipboard!", "success");
            } catch (err) {
                showToast("Gagal menyalin teks", "error");
            }
        }
        setMenuState(prev => ({ ...prev, visible: false }));
    };

    if (!menuState.visible) return null;

    const safeX = Math.min(menuState.x, window.innerWidth - 180);
    const safeY = Math.min(menuState.y, window.innerHeight - 80);

    return (
        <div 
            className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: safeY, left: safeX }}
        >
            <button 
                onClick={handleCopy}
                disabled={!menuState.textToCopy}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-[18px] text-slate-500">content_copy</span>
                Copy Log Text
            </button>
        </div>
    );
}