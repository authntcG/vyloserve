import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/Modal';
import Tabs, { type TabItem } from '../../../components/Tabs';
import { useToast } from '../../../context/ToastContext';
import {
  type WebhookSummary,
  type WebhookDetail,
  type WebhookInspectorStatus,
  type HttpResponseData,
  type HeaderRow,
} from './types';
import WebhookListenerCard from './components/WebhookListenerCard';
import WebhookHistoryList from './components/WebhookHistoryList';
import WebhookDetailView from './components/WebhookDetailView';
import ApiClientWorkspace from './components/ApiClientWorkspace';
import WebhookResponseConfigModal from './components/WebhookResponseConfigModal';

// Re-export types for backward compatibility
export type {
  WebhookSummary,
  WebhookDetail,
  WebhookInspectorStatus,
  HttpResponseData,
  HeaderRow,
} from './types';
export { formatBytes, formatDate, getMethodBadgeClass } from './types';

export default function WebhookInspectorMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // Main Page Tabs: Catcher vs Client
  const [mainTab, setMainTab] = useState<'catcher' | 'client'>('catcher');

  // Status & Controls
  const [status, setStatus] = useState<WebhookInspectorStatus>({
    running: false,
    host: '127.0.0.1',
    port: 8787,
    total_captured: 0,
    tunnel_active: false,
    tunnel_url: '',
    response_config: { status_code: 200, content_type: 'application/json', body: '{"status": "ok"}' },
  });
  const [portInput, setPortInput] = useState<number>(8787);
  const [history, setHistory] = useState<WebhookSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookDetail | null>(null);
  const [catcherDetailTab, setCatcherDetailTab] = useState<'body' | 'headers' | 'query'>('body');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Action loaders
  const [isTogglingListener, setIsTogglingListener] = useState<boolean>(false);
  const [isTogglingTunnel, setIsTogglingTunnel] = useState<boolean>(false);
  const [isSendingSample, setIsSendingSample] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  // Response Config modal form
  const [respCodeInput, setRespCodeInput] = useState<number>(200);
  const [respContentTypeInput, setRespContentTypeInput] = useState<string>('application/json');
  const [respBodyInput, setRespBodyInput] = useState<string>('{"status": "ok"}');

  // API Client Tab states
  const [httpMethod, setHttpMethod] = useState<string>('GET');
  const [httpUrl, setHttpUrl] = useState<string>('https://jsonplaceholder.typicode.com/posts/1');
  const [httpHeaders, setHttpHeaders] = useState<HeaderRow[]>([
    { id: '1', key: 'Accept', value: 'application/json' },
  ]);
  const [httpBody, setHttpBody] = useState<string>('');
  const [isSendingHttp, setIsSendingHttp] = useState<boolean>(false);
  const [httpResponse, setHttpResponse] = useState<HttpResponseData | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_webhook_inspector_status) return;
      const res = await api.get_webhook_inspector_status();
      if (res?.status === 'success') {
        setStatus(res);
        setPortInput(res.port || 8787);
        if (res.response_config) {
          setRespCodeInput(res.response_config.status_code || 200);
          setRespContentTypeInput(res.response_config.content_type || 'application/json');
          setRespBodyInput(res.response_config.body || '{"status": "ok"}');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_webhook_history) return;
      const res = await api.get_webhook_history();
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadHistory();

    const handleWebhookReceived = () => {
      loadStatus();
      loadHistory();
    };

    window.addEventListener('vylo_webhook_received', handleWebhookReceived);
    return () => {
      window.removeEventListener('vylo_webhook_received', handleWebhookReceived);
    };
  }, [loadStatus, loadHistory]);

  const handleSelectWebhook = async (id: string) => {
    setSelectedId(id);
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_webhook_detail) return;
      const res = await api.get_webhook_detail(id);
      if (res?.status === 'success' && res.data) {
        setSelectedWebhook(res.data);
      } else {
        showToastRef.current(
          t(res?.message || 'backend.webhook.not_found', res?.args || {}) as string,
          'error'
        );
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    }
  };

  const handleToggleListener = async () => {
    setIsTogglingListener(true);
    try {
      const api = (window as any).pywebview?.api;
      if (status.running) {
        const res = await api?.stop_webhook_listener?.();
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'info');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
            'error'
          );
        }
      } else {
        const res = await api?.start_webhook_listener?.(portInput);
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.webhook.port_in_use', res?.args || {}) as string,
            'error'
          );
        }
      }
      await loadStatus();
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsTogglingListener(false);
    }
  };

  const handleToggleTunnel = async () => {
    setIsTogglingTunnel(true);
    try {
      const api = (window as any).pywebview?.api;
      if (status.tunnel_active) {
        const res = await api?.stop_webhook_public_tunnel?.();
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'info');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
            'error'
          );
        }
      } else {
        const res = await api?.start_webhook_public_tunnel?.();
        if (res?.status === 'success') {
          showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        } else {
          showToastRef.current(
            t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
            'error'
          );
        }
      }
      await loadStatus();
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsTogglingTunnel(false);
    }
  };

  const handleSendSample = async () => {
    setIsSendingSample(true);
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.send_sample_webhook?.();
      if (res?.status === 'success') {
        showToastRef.current(
          t('backend.webhook.request_captured', {
            method: 'POST',
            path: '/api/webhook/sample-order',
          }) as string,
          'success'
        );
        await loadHistory();
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
      setIsSendingSample(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.clear_webhook_history?.();
      if (res?.status === 'success') {
        showToastRef.current(t(res.message, res.args || {}) as string, 'info');
        setHistory([]);
        setSelectedId(null);
        setSelectedWebhook(null);
        setShowClearConfirmModal(false);
        await loadStatus();
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    }
  };

  const handleSaveResponseConfig = async () => {
    try {
      const api = (window as any).pywebview?.api;
      const res = await api?.set_webhook_response_config?.(
        respCodeInput,
        respContentTypeInput,
        respBodyInput
      );
      if (res?.status === 'success') {
        showToastRef.current(t(res.message, res.args || {}) as string, 'success');
        setShowConfigModal(false);
        await loadStatus();
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    }
  };

  const handleReplayInClient = (webhook: WebhookDetail) => {
    setMainTab('client');
    setHttpMethod(webhook.method || 'GET');
    const port = status.port || portInput || 8787;
    setHttpUrl(`http://127.0.0.1:${port}${webhook.path}`);
    const rows: HeaderRow[] = Object.entries(webhook.headers || {})
      .filter(([k]) => !['host', 'content-length'].includes(k.toLowerCase()))
      .map(([k, v], idx) => ({ id: String(idx + 1), key: k, value: String(v) }));
    setHttpHeaders(rows.length > 0 ? rows : [{ id: '1', key: 'Accept', value: 'application/json' }]);
    setHttpBody(webhook.body || '');
    showToastRef.current(t('tools.webhook_inspector.replay_in_client') as string, 'info');
  };

  // API Client Actions
  const handleAddHeader = () => {
    setHttpHeaders((prev) => [...prev, { id: String(Date.now()), key: '', value: '' }]);
  };

  const handleRemoveHeader = (id: string) => {
    setHttpHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const handleHeaderChange = (id: string, field: 'key' | 'value', val: string) => {
    setHttpHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: val } : h))
    );
  };

  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(httpBody);
      setHttpBody(JSON.stringify(parsed, null, 2));
      showToastRef.current(t('tools.webhook_inspector.format_json') as string, 'success');
    } catch {
      showToastRef.current(
        t('tools.webhook_inspector.request_body_label') as string,
        'error'
      );
    }
  };

  const handleSendHttpRequest = async () => {
    if (!httpUrl.trim()) {
      showToastRef.current(t('backend.webhook.url_required') as string, 'error');
      return;
    }

    setIsSendingHttp(true);
    try {
      const api = (window as any).pywebview?.api;
      const headersMap: Record<string, string> = {};
      httpHeaders.forEach((h) => {
        if (h.key.trim()) headersMap[h.key.trim()] = h.value;
      });

      const res = await api?.send_http_request?.(httpMethod, httpUrl, headersMap, httpBody);
      if (res?.status === 'success' && res.data) {
        setHttpResponse(res.data);
      } else {
        showToastRef.current(
          t(res?.message || 'backend.error.unexpected', res?.args || {}) as string,
          'error'
        );
      }
    } catch (err: any) {
      showToastRef.current(err.message || 'Error', 'error');
    } finally {
      setIsSendingHttp(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToastRef.current(t('tools.webhook_inspector.copied') as string, 'success');
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Method filter
      if (methodFilter !== 'ALL') {
        const itemMethod = item.method.toUpperCase();
        const matchesMethod = methodFilter === 'PUT'
          ? (itemMethod === 'PUT' || itemMethod === 'PATCH')
          : itemMethod === methodFilter;
        if (!matchesMethod) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.path.toLowerCase().includes(q) ||
        item.client_ip.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q)
      );
    });
  }, [history, methodFilter, searchQuery]);

  const mainTabs: ReadonlyArray<TabItem<'catcher' | 'client'>> = [
    { value: 'catcher', label: t('tools.webhook_inspector.tab_catcher', 'Webhook Catcher') },
    { value: 'client', label: t('tools.webhook_inspector.tab_client', 'API Client') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="webhook"
        title={t('tools.webhook_inspector.title', 'Webhook Inspector & API Client')}
        subtitle={t(
          'tools.webhook_inspector.subtitle',
          'Capture incoming HTTP webhooks, expose via public tunnel, and test APIs without CORS.'
        )}
      />

      {/* Main Tabs Navigation */}
      <Tabs
        tabs={mainTabs}
        value={mainTab}
        onChange={setMainTab}
        className="mb-2"
      />

      {/* TAB 1: WEBHOOK CATCHER */}
      {mainTab === 'catcher' && (
        <div className="flex flex-col gap-6">
          {/* Controls Card */}
          <WebhookListenerCard
            status={status}
            portInput={portInput}
            onPortChange={setPortInput}
            isTogglingListener={isTogglingListener}
            onToggleListener={handleToggleListener}
            isTogglingTunnel={isTogglingTunnel}
            onToggleTunnel={handleToggleTunnel}
            isSendingSample={isSendingSample}
            onSendSample={handleSendSample}
            onOpenConfigModal={() => setShowConfigModal(true)}
            onCopy={handleCopy}
          />

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: History list */}
            <div className="lg:col-span-4">
              <WebhookHistoryList
                history={history}
                filteredHistory={filteredHistory}
                selectedId={selectedId}
                onSelect={handleSelectWebhook}
                onClearClick={() => setShowClearConfirmModal(true)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                methodFilter={methodFilter}
                onMethodFilterChange={setMethodFilter}
                currentPort={status.port || portInput}
              />
            </div>

            {/* Right Column: Webhook Detail */}
            <div className="lg:col-span-8">
              <WebhookDetailView
                selectedWebhook={selectedWebhook}
                catcherDetailTab={catcherDetailTab}
                onTabChange={setCatcherDetailTab}
                onReplayInClient={handleReplayInClient}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIGHTWEIGHT API CLIENT */}
      {mainTab === 'client' && (
        <ApiClientWorkspace
          httpMethod={httpMethod}
          onMethodChange={setHttpMethod}
          httpUrl={httpUrl}
          onUrlChange={setHttpUrl}
          httpHeaders={httpHeaders}
          onAddHeader={handleAddHeader}
          onRemoveHeader={handleRemoveHeader}
          onHeaderChange={handleHeaderChange}
          httpBody={httpBody}
          onBodyChange={setHttpBody}
          onPrettifyJson={handlePrettifyJson}
          isSendingHttp={isSendingHttp}
          onSendRequest={handleSendHttpRequest}
          httpResponse={httpResponse}
          onCopy={handleCopy}
        />
      )}

      {/* Response Config Modal */}
      <WebhookResponseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        statusCode={respCodeInput}
        onStatusCodeChange={setRespCodeInput}
        contentType={respContentTypeInput}
        onContentTypeChange={setRespContentTypeInput}
        responseBody={respBodyInput}
        onResponseBodyChange={setRespBodyInput}
        onSave={handleSaveResponseConfig}
      />

      {/* Confirm Clear History Modal */}
      <Modal
        isOpen={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        title={t('tools.webhook_inspector.confirm_clear_title', 'Clear Webhook History?')}
        icon="warning"
        isDanger
        onApply={handleClearHistory}
        applyText={t('tools.webhook_inspector.clear_history', 'Clear History')}
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t(
            'tools.webhook_inspector.confirm_clear_desc',
            'Are you sure you want to clear all captured webhook requests?'
          )}
        </p>
      </Modal>
    </div>
  );
}
