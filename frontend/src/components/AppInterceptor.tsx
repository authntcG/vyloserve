import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';

export default function GlobalAppInterceptor() {
    const { showToast } = useToast();
    const { t } = useTranslation();
    const savedSelectionRef = useRef<string>('');
    const menuRef = useRef<HTMLDivElement>(null);

    const [menuState, setMenuState] = useState({
        visible: false,
        x: 0,
        y: 0,
        textToCopy: '',
        isLogArea: false
    });

    useEffect(() => {
        const handleSelectionChange = () => {
            const current = window.getSelection()?.toString().trim();
            if (current) {
                savedSelectionRef.current = current;
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const logArea = target.closest('.vylo-log-area');

            let selectedText = window.getSelection()?.toString().trim() || '';
            if (!selectedText && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
                const start = target.selectionStart ?? 0;
                const end = target.selectionEnd ?? 0;
                if (end > start) {
                    selectedText = target.value.substring(start, end).trim();
                }
            }

            // Fallback ke savedSelectionRef jika event mousedown browser sempat meng-collapse seleksi
            if (!selectedText && savedSelectionRef.current) {
                selectedText = savedSelectionRef.current;
            }

            if (selectedText) {
                e.preventDefault();
                setMenuState({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    textToCopy: selectedText,
                    isLogArea: Boolean(logArea)
                });
            } else if (logArea) {
                e.preventDefault();
                const textToCopy = (target.innerText || target.textContent || '').trim();
                setMenuState({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    textToCopy,
                    isLogArea: true
                });
            } else {
                setMenuState({ visible: false, x: 0, y: 0, textToCopy: '', isLogArea: false });
            }
        };

        const handleClick = (e: MouseEvent) => {
            // Abaikan klik kanan / tengah
            if (e.button !== 0) return;
            // Abaikan jika klik terjadi di dalam elemen menu konteks
            if (menuRef.current && menuRef.current.contains(e.target as Node)) return;

            setMenuState(prev => (prev.visible ? { ...prev, visible: false } : prev));
            // Kosongkan savedSelection jika seleksi DOM memang sudah tidak ada
            if (!window.getSelection()?.toString().trim()) {
                savedSelectionRef.current = '';
            }
        };

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

        document.addEventListener('selectionchange', handleSelectionChange);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, []);

    const handleCopy = async (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (menuState.textToCopy) {
            try {
                await navigator.clipboard.writeText(menuState.textToCopy);
                const successMsg = menuState.isLogArea
                    ? t('components.interceptor.copy_success')
                    : t('components.interceptor.copy_selection_success');
                showToast(successMsg, "success");
            } catch {
                try {
                    if (typeof document.execCommand !== 'function') {
                        throw new Error('execCommand not available');
                    }
                    const textarea = document.createElement('textarea');
                    textarea.value = menuState.textToCopy;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (!successful) throw new Error('execCommand failed');
                    const successMsg = menuState.isLogArea
                        ? t('components.interceptor.copy_success')
                        : t('components.interceptor.copy_selection_success');
                    showToast(successMsg, "success");
                } catch (err) {
                    console.error(err);
                    showToast(t('components.interceptor.copy_error'), "error");
                }
            }
        }
        setMenuState(prev => ({ ...prev, visible: false }));
    };

    if (!menuState.visible) return null;

    const safeX = Math.min(menuState.x, window.innerWidth - 180);
    const safeY = Math.min(menuState.y, window.innerHeight - 80);

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: safeY, left: safeX }}
        >
            <button
                type="button"
                onClick={handleCopy}
                disabled={!menuState.textToCopy}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                <span className="material-symbols-outlined text-[18px] text-slate-500">content_copy</span>
                {menuState.isLogArea ? t('components.interceptor.copy_btn') : t('components.interceptor.copy_selection_btn')}
            </button>
        </div>
    );
}