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

        const handleClick = () => setMenuState(prev => ({ ...prev, visible: false }));

        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;
            const isCtrlOrMeta = e.ctrlKey || e.metaKey;

            // Evaluasi cepat secara langsung (O(1)) tanpa overhead array .some()
            const isF12 = key === 'F12';
            const isF5 = key === 'F5';
            const isCtrlR = isCtrlOrMeta && key.toLowerCase() === 'r';
            const isCtrlP = isCtrlOrMeta && key.toLowerCase() === 'p';
            const isCtrlS = isCtrlOrMeta && key.toLowerCase() === 's';
            const isCtrlU = isCtrlOrMeta && key.toLowerCase() === 'u';
            const isCtrlF = isCtrlOrMeta && key.toLowerCase() === 'f';
            const isCtrlG = isCtrlOrMeta && key.toLowerCase() === 'g';
            const isDevToolsCombo = isCtrlOrMeta && e.shiftKey && ['i', 'c', 'j'].includes(key.toLowerCase());
            const isNavHistory = e.altKey && ['ArrowLeft', 'ArrowRight'].includes(key);

            if (isF12 || isF5 || isCtrlR || isCtrlP || isCtrlS || isCtrlU || isCtrlF || isCtrlG || isDevToolsCombo || isNavHistory) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
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