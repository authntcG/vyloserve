import { useTranslation } from 'react-i18next';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import StatusBadge from '../../../../components/StatusBadge';
import ServiceToggleButton from '../../../../components/ServiceToggleButton';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';
import type { MailSandboxStatus } from '../types';

export interface MailServerCardProps {
  readonly status: MailSandboxStatus;
  readonly portInput: number;
  readonly onPortChange: (port: number) => void;
  readonly isStarting: boolean;
  readonly onToggleServer: () => void;
  readonly isSendingTest: boolean;
  readonly onSendTest: () => void;
  readonly onCopy: (text: string) => void;
}

export default function MailServerCard({
  status,
  portInput,
  onPortChange,
  isStarting,
  onToggleServer,
  isSendingTest,
  onSendTest,
  onCopy,
}: MailServerCardProps) {
  const { t } = useTranslation();
  const currentPort = status.port || portInput || 1025;
  const endpointString = `127.0.0.1:${currentPort}`;

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <span>{t('tools.mail_sandbox.smtp_server', 'SMTP Server')}</span>
          <StatusBadge
            status={
              status.running
                ? t('tools.mail_sandbox.status_running', 'Listening')
                : t('tools.mail_sandbox.status_stopped', 'Stopped')
            }
          />
        </div>
      }
      gridCols="grid-cols-1"
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          icon="send"
          loading={isSendingTest}
          disabled={!status.running}
          onClick={onSendTest}
        >
          {t('tools.mail_sandbox.send_test', 'Send Test Email')}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Port Input & Toggle Button & Quick Endpoint Pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor="mail-port-input" className="text-xs text-slate-500 whitespace-nowrap">
              {t('tools.mail_sandbox.port', 'Port')}:
            </FieldLabel>
            <Input
              id="mail-port-input"
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

          <ServiceToggleButton
            isRunning={status.running}
            isToggling={isStarting}
            onClick={onToggleServer}
            labels={{
              start: t('tools.mail_sandbox.start', 'Start Server'),
              stop: t('tools.mail_sandbox.stop', 'Stop Server'),
              starting: t('tools.mail_sandbox.starting', 'Starting...'),
              stopping: t('tools.mail_sandbox.stopping', 'Stopping...'),
            }}
          />

          {/* Quick Endpoint Copy Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono">
            <span className="material-symbols-outlined text-slate-400 text-[16px]">dns</span>
            <span className="text-slate-500 select-none">
              {t('tools.mail_sandbox.endpoint_label', 'SMTP Endpoint')}:
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">
              {endpointString}
            </span>
            <button
              type="button"
              aria-label={t('tools.mail_sandbox.copy_endpoint', 'Copy Endpoint')}
              title={t('tools.mail_sandbox.copy_endpoint', 'Copy Endpoint')}
              onClick={() => onCopy(endpointString)}
              className="text-slate-400 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Right: Message Counts */}
        <div className="flex items-center gap-3 text-xs">
          <div className="text-slate-600 dark:text-slate-400">
            <span className="font-bold text-slate-800 dark:text-slate-200">{status.total_messages}</span>{' '}
            {t('tools.mail_sandbox.filter_all', 'All').toLowerCase()}
          </div>
          <div className="text-slate-300 dark:text-slate-700">•</div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {status.unread_count > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
            <span>
              {status.unread_count} {t('tools.mail_sandbox.filter_unread', 'Unread').toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
