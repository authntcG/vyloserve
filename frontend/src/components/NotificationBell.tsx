// src/components/NotificationBell.tsx
import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useToast, type ToastHistoryEntry } from './ToastContext';

const BADGE_CAP = 9;
const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

function formatRelativeTime(timestamp: number, t: any): string {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return t('components.notifications.time_just_now', 'Just now');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return t('components.notifications.time_minutes_ago', '{{count}}m ago', { count: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('components.notifications.time_hours_ago', '{{count}}h ago', { count: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    return t('components.notifications.time_days_ago', '{{count}}d ago', { count: diffDay });
}

// Warna+ikon per tipe -- SAMA PERSIS skema yang dipakai ToastContext.tsx supaya
// histori konsisten visual dengan toast yang pernah tampil.
function getTypeStyle(type: ToastHistoryEntry['type']) {
    switch (type) {
        case 'success': return { icon: 'check_circle', color: 'text-emerald-500 dark:text-emerald-400' };
        case 'error': return { icon: 'error', color: 'text-red-500 dark:text-red-400' };
        case 'warning': return { icon: 'warning', color: 'text-amber-500' };
        default: return { icon: 'info', color: 'text-primary' };
    }
}

interface NotificationEntryRowProps {
    readonly entry: ToastHistoryEntry;
    readonly t: any;
}

function NotificationEntryRow({ entry, t }: NotificationEntryRowProps) {
    const { icon, color } = getTypeStyle(entry.type);
    return (
        <li className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
            <span className={`material-symbols-outlined shrink-0 text-[18px] ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {icon}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">{entry.message}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatRelativeTime(entry.timestamp, t)}</p>
            </div>
        </li>
    );
}

/**
 * Tombol lonceng notifikasi di footer Sidebar -- membuka panel riwayat toast
 * yang pernah tampil dalam sesi berjalan (lihat ToastContext.tsx). Panel di-
 * render lewat portal ke document.body dan posisinya dihitung manual dari
 * getBoundingClientRect() trigger -- pola yang sama dipakai Select.tsx, dipilih
 * alih-alih `absolute bottom-full` sederhana (pola popover Settings) karena
 * trigger ini ada di footer dekat dasar viewport dan kontennya (list histori)
 * berpotensi lebih tinggi -- lihat docs/known_bugs.md #41 soal clipping.
 */
export default function NotificationBell() {
    const { t } = useTranslation();
    const { history, unreadCount, clearHistory, markHistoryRead } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<{ bottom: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const closePanel = () => setIsOpen(false);

    const handleToggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        // unreadCount di-reset saat popup DIBUKA, bukan saat masing-masing toast
        // di-dismiss -- entri histori tetap ada, cuma badge-nya yang hilang.
        if (next) markHistoryRead();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            closePanel();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const left = Math.min(
                Math.max(rect.left, VIEWPORT_MARGIN),
                window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN
            );
            // Anchor lewat `bottom` (bukan `top`) karena trigger ada dekat dasar
            // viewport -- panel tumbuh ke atas dan tidak perlu tahu tinggi
            // kontennya lebih dulu (beda dari Select.tsx yang anchor via `top`).
            setPanelPosition({ bottom: window.innerHeight - rect.top + 8, left });
        };
        updatePosition();
        const handleScroll = (event: Event) => {
            if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            closePanel();
        };
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const badgeLabel = unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : String(unreadCount);
    const ariaLabel = t('components.notifications.bell_label', 'Notifications ({{count}} unread)', { count: unreadCount });

    return (
        <div className="relative">
            <button
                type="button"
                ref={triggerRef}
                onClick={handleToggle}
                aria-label={ariaLabel}
                title={ariaLabel}
                aria-haspopup="true"
                aria-expanded={isOpen}
                className={`relative p-1.5 rounded-md flex items-center justify-center transition-colors ${isOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0" }}>
                    {unreadCount > 0 ? 'notifications_active' : 'notifications'}
                </span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center">
                        {badgeLabel}
                    </span>
                )}
            </button>

            {isOpen && panelPosition && createPortal(
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', bottom: panelPosition.bottom, left: panelPosition.left, width: PANEL_WIDTH, zIndex: 1000 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('components.notifications.title', 'Notifications')}</h3>
                        {history.length > 0 && (
                            <button
                                type="button"
                                onClick={clearHistory}
                                className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                {t('components.notifications.clear', 'Clear')}
                            </button>
                        )}
                    </div>
                    <ul aria-label={t('components.notifications.title', 'Notifications')} className="max-h-[320px] overflow-y-auto custom-scrollbar">
                        {history.length > 0 ? (
                            [...history].reverse().map((entry) => (
                                <NotificationEntryRow key={entry.id} entry={entry} t={t} />
                            ))
                        ) : (
                            <li className="px-4 py-8 text-center text-sm text-slate-500 list-none">
                                {t('components.notifications.empty', 'No notifications yet.')}
                            </li>
                        )}
                    </ul>
                </div>,
                document.body
            )}
        </div>
    );
}
