import { useTranslation } from 'react-i18next';
import Modal from '../../../../components/Modal';
import FieldLabel from '../../../../components/FieldLabel';
import Input from '../../../../components/Input';

export interface WebhookResponseConfigModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly statusCode: number;
  readonly onStatusCodeChange: (code: number) => void;
  readonly contentType: string;
  readonly onContentTypeChange: (type: string) => void;
  readonly responseBody: string;
  readonly onResponseBodyChange: (body: string) => void;
  readonly onSave: () => void;
}

export default function WebhookResponseConfigModal({
  isOpen,
  onClose,
  statusCode,
  onStatusCodeChange,
  contentType,
  onContentTypeChange,
  responseBody,
  onResponseBodyChange,
  onSave,
}: WebhookResponseConfigModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tools.webhook_inspector.modal_response_title', 'Configure Webhook Auto-Response')}
      icon="tune"
      maxWidthClass="sm:w-[540px]"
      onApply={onSave}
      applyText={t('tools.webhook_inspector.save_response_config', 'Save Response Config')}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t(
            'tools.webhook_inspector.modal_response_desc',
            'Specify the HTTP status code and body returned to callers when a webhook is received.'
          )}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="resp-status-input" size="xs">
              {t('tools.webhook_inspector.status_code', 'Status Code')}
            </FieldLabel>
            <Input
              id="resp-status-input"
              type="number"
              mono
              value={statusCode}
              onChange={(e) => onStatusCodeChange(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="resp-content-type-input" size="xs">
              {t('tools.webhook_inspector.content_type', 'Content-Type')}
            </FieldLabel>
            <Input
              id="resp-content-type-input"
              type="text"
              mono
              value={contentType}
              onChange={(e) => onContentTypeChange(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="resp-body-input" size="xs">
            {t('tools.webhook_inspector.response_body', 'Response Body')}
          </FieldLabel>
          <textarea
            id="resp-body-input"
            rows={4}
            value={responseBody}
            onChange={(e) => onResponseBodyChange(e.target.value)}
            className="p-3 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-900 text-slate-100"
          />
        </div>
      </div>
    </Modal>
  );
}
