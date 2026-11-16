import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../../components/Modal';
import Tabs, { type TabItem } from '../../../../components/Tabs';
import Button from '../../../../components/Button';

export interface MailSnippetsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentPort: number;
  readonly onCopy: (text: string) => void;
}

export default function MailSnippetsModal({
  isOpen,
  onClose,
  currentPort,
  onCopy,
}: MailSnippetsModalProps) {
  const { t } = useTranslation();
  const [snippetTab, setSnippetTab] = useState<'laravel' | 'nodejs' | 'python' | 'php'>('laravel');

  const snippetTabs: ReadonlyArray<TabItem<'laravel' | 'nodejs' | 'python' | 'php'>> = [
    { value: 'laravel', label: t('tools.mail_sandbox.snippet_laravel', 'Laravel (.env)') },
    { value: 'nodejs', label: t('tools.mail_sandbox.snippet_nodejs', 'Node.js (Nodemailer)') },
    { value: 'python', label: t('tools.mail_sandbox.snippet_python', 'Python (smtplib)') },
    { value: 'php', label: t('tools.mail_sandbox.snippet_php', 'PHP (PHPMailer)') },
  ];

  const getActiveSnippet = () => {
    switch (snippetTab) {
      case 'laravel':
        return `MAIL_MAILER=smtp\nMAIL_HOST=127.0.0.1\nMAIL_PORT=${currentPort}\nMAIL_USERNAME=null\nMAIL_PASSWORD=null\nMAIL_ENCRYPTION=null\nMAIL_FROM_ADDRESS="hello@example.com"\nMAIL_FROM_NAME="\${APP_NAME}"`;
      case 'nodejs':
        return `const nodemailer = require("nodemailer");\n\nconst transporter = nodemailer.createTransport({\n  host: "127.0.0.1",\n  port: ${currentPort},\n  secure: false,\n  ignoreTLS: true\n});`;
      case 'python':
        return `import smtplib\nfrom email.message import EmailMessage\n\nmsg = EmailMessage()\nmsg['Subject'] = 'Test Subject'\nmsg['From'] = 'sender@example.com'\nmsg['To'] = 'receiver@example.com'\nmsg.set_content('Hello world!')\n\nwith smtplib.SMTP('127.0.0.1', ${currentPort}) as server:\n    server.send_message(msg)`;
      case 'php':
        return `$mail = new PHPMailer\\PHPMailer\\PHPMailer();\n$mail->isSMTP();\n$mail->Host = '127.0.0.1';\n$mail->Port = ${currentPort};\n$mail->SMTPAuth = false;\n$mail->SMTPSecure = false;`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tools.mail_sandbox.modal_snippets_title', 'Email Sandbox Connection Settings')}
      icon="terminal"
      maxWidthClass="sm:w-[600px]"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t(
            'tools.mail_sandbox.modal_snippets_desc',
            "Paste these configuration values into your application's environment file or mail settings:"
          )}
        </p>

        <Tabs
          tabs={snippetTabs}
          value={snippetTab}
          onChange={setSnippetTab}
          className="mb-1"
        />

        <div className="relative">
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
            {getActiveSnippet()}
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="primary"
            icon="content_copy"
            onClick={() => onCopy(getActiveSnippet())}
          >
            {t('tools.mail_sandbox.copy_content', 'Copy Content')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
