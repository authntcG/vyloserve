import { useTranslation } from 'react-i18next';

export interface InstalledBadgeProps {
    readonly label?: string;
    readonly className?: string;
}

/**
 * Standard badge for indicating installed module status in PageHeader across
 * Apache, Runtimes, Git, and Tunnels. Fully theme-aware with emerald-500.
 */
export default function InstalledBadge({ label, className = '' }: InstalledBadgeProps) {
    const { t } = useTranslation();
    const text = label || t('common.installed') || 'Installed';

    return (
        <button
            type="button"
            disabled
            aria-label={text}
            className={`bg-emerald-500 disabled:opacity-100 disabled:cursor-default border border-transparent text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap cursor-default select-none ${className}`}
        >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{text}</span>
        </button>
    );
}
