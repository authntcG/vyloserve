import { useTranslation } from 'react-i18next';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import StatusBadge from '../../../../components/StatusBadge';
import ServiceToggleButton from '../../../../components/ServiceToggleButton';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';
import type { WebhookInspectorStatus } from '../types';

export interface WebhookListenerCardProps {
  readonly status: WebhookInspectorStatus;
  readonly portInput: number;
  readonly onPortChange: (port: number) => void;
  readonly isTogglingListener: boolean;
  readonly onToggleListener: () => void;
  readonly isTogglingTunnel: boolean;
  readonly onToggleTunnel: () => void;
  readonly isSendingSample: boolean;
  readonly onSendSample: () => void;
  readonly onOpenConfigModal: () => void;
  readonly onCopy: (text: string) => void;
}

export default function WebhookListenerCard({
  status,
  portInput,
  onPortChange,
  isTogglingListener,
  onToggleListener,
  isTogglingTunnel,
  onToggleTunnel,
  isSendingSample,
  onSendSample,
  onOpenConfigModal,
  onCopy,
}: WebhookListenerCardProps) {
  const { t } = useTranslation();
  const currentPort = status.port || portInput || 8787;
  const localUrl = `http://127.0.0.1:${currentPort}/webhook`;

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <span>{t('tools.webhook_inspector.listener_card_title', 'Webhook Listener')}</span>
          <StatusBadge
            status={
              status.running
                ? t('tools.webhook_inspector.listener_status_running', 'Listening')
                : t('tools.webhook_inspector.listener_status_stopped', 'Stopped')
            }
          />
        </div>
      }
      gridCols="grid-cols-1"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="tune"
            onClick={onOpenConfigModal}
          >
            {t('tools.webhook_inspector.config_response', 'Response Setup')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="bolt"
            loading={isSendingSample}
            disabled={!status.running}
            onClick={onSendSample}
          >
            {t('tools.webhook_inspector.send_sample', 'Send Sample Webhook')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Port Input */}
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="wh-port-input" className="text-xs text-slate-500 whitespace-nowrap">
                {t('tools.webhook_inspector.port', 'Port')}:
              </FieldLabel>
              <Input
                id="wh-port-input"
                type="number"
                size="sm"
                mono
                fullWidth={false}
                className="w-24"
                disabled={status.running}
                value={portInput}
                onChange={(e) => onPortChange(Number(e.target.value))}
                min={1}
                max={65535}
              />
            </div>

            {/* Service Toggle */}
            <ServiceToggleButton
              isRunning={status.running}
              isToggling={isTogglingListener}
              onClick={onToggleListener}
              labels={{
                start: t('tools.webhook_inspector.start_listener', 'Start Listener'),
                stop: t('tools.webhook_inspector.stop_listener', 'Stop Listener'),
                starting: t('tools.webhook_inspector.starting_listener', 'Starting...'),
                stopping: t('tools.webhook_inspector.stopping_listener', 'Stopping...'),
              }}
            />

            {/* Cloudflare Tunnel Toggle */}
            <Button
              variant={status.tunnel_active ? 'danger-ghost' : 'secondary'}
              size="sm"
              icon="router"
              disabled={!status.running}
              loading={isTogglingTunnel}
              onClick={onToggleTunnel}
            >
              {status.tunnel_active
                ? t('tools.webhook_inspector.stop_tunnel', 'Close Tunnel')
                : t('tools.webhook_inspector.start_tunnel', 'Expose Publicly')}
            </Button>

            {/* Local URL Endpoint Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">link</span>
              <span className="text-slate-500 select-none">
                {t('tools.webhook_inspector.local_url_label', 'Local Webhook URL')}:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">
                {localUrl}
              </span>
              <button
                type="button"
                aria-label={t('tools.webhook_inspector.copy_local_url', 'Copy Webhook URL')}
                title={t('tools.webhook_inspector.copy_local_url', 'Copy Webhook URL')}
                onClick={() => onCopy(localUrl)}
                className="text-slate-400 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">content_copy</span>
              </button>
            </div>
          </div>

          {/* Right Stats */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{t('tools.webhook_inspector.captured_webhooks_count', { count: status.total_captured })}</span>
          </div>
        </div>

        {/* Public Tunnel Banner (if active) */}
        {status.tunnel_active && status.tunnel_url && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0">public</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-slate-500 font-medium">
                  {t('tools.webhook_inspector.public_url_label', 'Public Cloudflare Tunnel URL')}
                </span>
                <span className="text-sm font-mono text-primary font-semibold truncate select-all">
                  {status.tunnel_url}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="content_copy"
              onClick={() => onCopy(status.tunnel_url)}
            >
              {t('tools.webhook_inspector.copy_url', 'Copy Webhook URL')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
