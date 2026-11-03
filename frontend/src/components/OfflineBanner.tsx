import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import InfoBox from './InfoBox';
import Button from './Button';
import { useNetworkStatus } from '../context/NetworkContext';

export interface OfflineBannerProps {
    readonly title?: string;
    readonly description?: string;
    readonly onRetry?: () => void | Promise<void>;
    readonly actionButton?: ReactNode;
    readonly className?: string;
    readonly forceShow?: boolean;
}

export default function OfflineBanner({
    title,
    description,
    onRetry,
    actionButton,
    className = '',
    forceShow = false,
}: OfflineBannerProps) {
    const { t } = useTranslation();
    const { isOnline, isChecking, checkConnectivity } = useNetworkStatus();

    if (isOnline && !forceShow) {
        return null;
    }

    const handleRetry = async () => {
        await checkConnectivity();
        if (onRetry) {
            await onRetry();
        }
    };

    return (
        <div data-testid="offline-banner" className={className}>
            <InfoBox
                tone="warning"
                icon="wifi_off"
                title={title || t('common.offline_title')}
                className="w-full"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
                    <span className="leading-relaxed">
                        {description || t('common.offline_desc')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        {actionButton}
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="refresh"
                            loading={isChecking}
                            disabled={isChecking}
                            onClick={handleRetry}
                            className="shrink-0"
                        >
                            {isChecking ? t('common.checking_connection') : t('common.retry_connection')}
                        </Button>
                    </div>
                </div>
            </InfoBox>
        </div>
    );
}
