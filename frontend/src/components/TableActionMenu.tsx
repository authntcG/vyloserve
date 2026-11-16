import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export const tableActionItemClass =
    'w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

export const tableActionItemDangerClass =
    'w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

export const tableActionDividerClass = 'border-t border-slate-100 dark:border-slate-700 my-1';

export interface TableActionMenuProps {
    readonly children: ReactNode | ((helpers: { close: () => void }) => ReactNode);
    readonly title?: string;
    readonly ariaLabel?: string;
    readonly menuWidth?: number;
    readonly estimatedHeight?: number;
    readonly triggerIcon?: string;
    readonly triggerClassName?: string;
    readonly menuClassName?: string;
}

export default function TableActionMenu({
    children,
    title,
    ariaLabel,
    menuWidth = 200,
    estimatedHeight = 260,
    triggerIcon = 'more_vert',
    triggerClassName = '',
    menuClassName = '',
}: TableActionMenuProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; openUpwards: boolean } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const defaultLabel = t('common.actions', 'Actions');
    const resolvedTitle = title || defaultLabel;
    const resolvedAriaLabel = ariaLabel || defaultLabel;

    const closeMenu = () => setIsOpen(false);

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const actualHeight = menuRef.current?.offsetHeight || estimatedHeight;
        const width = menuWidth;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpwards = spaceBelow < actualHeight + 10 && rect.top > actualHeight;

        const top = openUpwards
            ? Math.max(10, rect.top - actualHeight - 4)
            : Math.min(window.innerHeight - actualHeight - 10, rect.bottom + 4);

        const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));

        setMenuPosition({ top, left, openUpwards });
    };

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) {
            closeMenu();
        } else {
            updatePosition();
            setIsOpen(true);
        }
    };

    useLayoutEffect(() => {
        if (!isOpen) return;
        updatePosition();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            closeMenu();
        };

        const handleScroll = (e: Event) => {
            if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
            closeMenu();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };

        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleMenuClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');
        if (button && !button.disabled && !('keepOpen' in button.dataset)) {
            closeMenu();
        }
    };

    return (
        <div className="relative inline-block text-left">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleOpen}
                title={resolvedTitle}
                aria-label={resolvedAriaLabel}
                aria-haspopup="true"
                aria-expanded={isOpen}
                className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer outline-none ${
                    isOpen
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${triggerClassName}`}
            >
                <span className="material-symbols-outlined text-[18px]">{triggerIcon}</span>
            </button>

            {isOpen && menuPosition && createPortal(
                <div // NOSONAR typescript:S6852 typescript:S1082
                    ref={menuRef}
                    onClick={handleMenuClick}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            closeMenu();
                        }
                    }}
                    tabIndex={-1}
                    style={{
                        position: 'fixed',
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuWidth}px`,
                        zIndex: 110,
                    }}
                    role="menu"
                    aria-label={resolvedAriaLabel}
                    className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md ${menuClassName}`}
                >
                    {typeof children === 'function' ? children({ close: closeMenu }) : children}
                </div>,
                document.body
            )}
        </div>
    );
}
