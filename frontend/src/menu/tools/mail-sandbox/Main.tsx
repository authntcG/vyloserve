import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import { useToast } from '../../../context/ToastContext';
import {
  type EmailSummary,
  type EmailDetail,
  type MailSandboxStatus,
} from './types';
import MailServerCard from './components/MailServerCard';
import MailInboxList from './components/MailInboxList';
import MailDetailView from './components/MailDetailView';
import MailSnippetsModal from './components/MailSnippetsModal';

// Re-export types for backward compatibility with existing tests and modules
export type { EmailSummary, EmailAttachment, EmailDetail, MailSandboxStatus } from './types';
export { formatBytes, formatDate } from './types';

export default function MailSandboxMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [status, setStatus] = useState<MailSandboxStatus>({
    running: false,
    host: '127.0.0.1',
    port: 1025,
    total_messages: 0,
    unread_count: 0,
  });

  const [portInput, setPortInput] = useState<number>(1025);
  const [messages, setMessages] = useState<EmailSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'headers' | 'raw'>('html');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [showSnippetsModal, setShowSnippetsModal] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  // Fetch initial status and emails
  const loadStatus = useCallback(async () => {
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_mail_sandbox_status) return;
      const res = await api.get_mail_sandbox_status();
      if (res?.status === 'success') {
        setStatus(res);
        setPortInput(res.port || 1025);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_mail_sandbox_messages) return;
      const res = await api.get_mail_sandbox_messages();
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadMessages();

    const handleMailReceived = () => {
      loadStatus();
      loadMessages();
    };

    window.addEventListener('vylo_mail_received', handleMailReceived);
    return () => {
      window.removeEventListener('vylo_mail_received', handleMailReceived);
    };
  }, [loadStatus, loadMessages]);

  // Load message detail when selecting
  const handleSelectMessage = async (id: string) => {
    setSelectedId(id);
    setIsLoadingDetail(true);
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_mail_sandbox_message_detail) return;
      const res = await api.get_mail_sandbox_message_detail(id);
      if (res?.status === 'success' && res.data) {
        setSelectedEmail(res.data);
        // Mark locally as read
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
        );
      } else {
        showToastRef.current(
          t(res?.message || 'backend.mail_sandbox.not_found', res?.args || {}) as string,
          'error'
        );
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleToggleServer = async () => {
    setIsStarting(true);
    try {
      const api = (window as any).pywebview?.api;
      if (status.running) {
        const res = await api?.stop_mail_sandbox?.();
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'info');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
            'error'
          );
        }
      } else {
        const res = await api?.start_mail_sandbox?.(portInput);
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.mail_sandbox.port_in_use', res?.args || {}) as string,
            'error'
          );
        }
      }
      await loadStatus();
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.send_test_mail?.();
      if (res?.status === 'success') {
        showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        await loadMessages();
        await loadStatus();
      } else {
        showToastRef.current(
          t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
          'error'
        );
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.delete_mail_sandbox_message?.(id);
      if (res?.status === 'success') {
        showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setSelectedEmail(null);
        }
        await loadStatus();
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.clear_mail_sandbox_messages?.();
      if (res?.status === 'success') {
        showToastRef.current(t(res.message, res.args || {}) as string, 'info');
        setMessages([]);
        setSelectedId(null);
        setSelectedEmail(null);
        setShowClearConfirmModal(false);
        await loadStatus();
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    }
  };

  const handleExportEml = () => {
    if (!selectedEmail) return;
    const blob = new Blob([selectedEmail.raw_source], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEmail.subject.replace(/[^a-zA-Z0-9_-]/g, '_') || 'email'}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    showToastRef.current(t('tools.mail_sandbox.download_eml') as string, 'success');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToastRef.current(t('tools.mail_sandbox.copied') as string, 'success');
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterMode === 'unread' && m.is_read) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.sender.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
      );
    });
  }, [messages, filterMode, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="mail"
        title={t('tools.mail_sandbox.title', 'Mail Sandbox')}
        subtitle={t(
          'tools.mail_sandbox.subtitle',
          'Catch all outgoing local SMTP emails without sending to real inboxes.'
        )}
        actions={
          <Button
            variant="secondary"
            icon="settings"
            onClick={() => setShowSnippetsModal(true)}
          >
            {t('tools.mail_sandbox.config_snippets', 'Setup / .env')}
          </Button>
        }
      />

      {/* Server Status & Port Controls Card */}
      <MailServerCard
        status={status}
        portInput={portInput}
        onPortChange={setPortInput}
        isStarting={isStarting}
        onToggleServer={handleToggleServer}
        isSendingTest={isSendingTest}
        onSendTest={handleSendTest}
        onCopy={handleCopy}
      />

      {/* Inbox & Detail Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Inbox List */}
        <div className="lg:col-span-4">
          <MailInboxList
            messages={messages}
            filteredMessages={filteredMessages}
            selectedId={selectedId}
            onSelect={handleSelectMessage}
            onDelete={handleDeleteMessage}
            onClearAllClick={() => setShowClearConfirmModal(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterMode={filterMode}
            onFilterChange={setFilterMode}
            currentPort={status.port || portInput}
          />
        </div>

        {/* Right Column: Email Detail View */}
        <div className="lg:col-span-8">
          <MailDetailView
            selectedEmail={selectedEmail}
            isLoadingDetail={isLoadingDetail}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onExportEml={handleExportEml}
            onDelete={handleDeleteMessage}
            onCopy={handleCopy}
          />
        </div>
      </div>

      {/* Setup / .env Modal */}
      <MailSnippetsModal
        isOpen={showSnippetsModal}
        onClose={() => setShowSnippetsModal(false)}
        currentPort={status.port || portInput}
        onCopy={handleCopy}
      />

      {/* Confirm Clear All Modal */}
      <Modal
        isOpen={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        title={t('tools.mail_sandbox.confirm_clear_title', 'Clear All Emails?')}
        icon="warning"
        isDanger
        onApply={handleClearAll}
        applyText={t('tools.mail_sandbox.clear_all', 'Clear Inbox')}
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t(
            'tools.mail_sandbox.confirm_clear_desc',
            'Are you sure you want to permanently delete all captured emails in this sandbox?'
          )}
        </p>
      </Modal>
    </div>
  );
}
