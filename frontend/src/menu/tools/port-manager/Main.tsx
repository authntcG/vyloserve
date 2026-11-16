import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import DataTable, { type ColumnDef } from '../../../components/DataTable';
import FilterChips, { type FilterChipItem } from '../../../components/FilterChips';
import Button from '../../../components/Button';
import StatusBadge from '../../../components/StatusBadge';
import Modal from '../../../components/Modal';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../context/ToastContext';

export interface ListeningPortItem {
  readonly id?: string;
  readonly port: number;
  readonly protocol: 'TCP' | 'UDP';
  readonly local_address: string;
  readonly pid: number | null;
  readonly process_name: string;
  readonly exe_path: string;
  readonly cmdline: string;
  readonly memory_mb: number;
  readonly is_protected: boolean;
  readonly is_vylo_managed: boolean;
}

const COMMON_DEV_PORTS = new Set([80, 443, 3000, 3306, 5173, 5432, 6379, 8000, 8080, 8443, 9000, 27017]);

export default function PortManagerMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [ports, setPorts] = useState<ListeningPortItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [killTarget, setKillTarget] = useState<ListeningPortItem | null>(null);
  const [isForceKill, setIsForceKill] = useState<boolean>(false);
  const [isKilling, setIsKilling] = useState<boolean>(false);

  const fetchPorts = async () => {
    setIsLoading(true);
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.get_listening_ports) {
        setIsLoading(false);
        return;
      }
      const res = await api.get_listening_ports();
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setPorts(res.data);
      } else if (res?.message) {
        showToast(t(res.message, res.args || {}) as string, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch ports', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  const handleKillProcess = async () => {
    if (!killTarget?.pid) return;
    setIsKilling(true);
    try {
      const api = (window as any).pywebview?.api;
      if (!api?.kill_process_by_pid) return;

      const res = await api.kill_process_by_pid(killTarget.pid, isForceKill);
      if (res?.status === 'success') {
        showToast(
          (t(res.message, res.args || {}) as string) ||
            `Process ${killTarget.process_name} (PID: ${killTarget.pid}) killed`,
          'success'
        );
        setKillTarget(null);
        setIsForceKill(false);
        fetchPorts();
      } else {
        showToast(
          (t(res?.message || 'backend.error.unexpected', res?.args || {}) as string),
          'error'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to kill process', 'error');
    } finally {
      setIsKilling(false);
    }
  };

  const filterChips: FilterChipItem[] = [
    { id: 'all', label: t('tools.port_manager.filter_all', 'All Ports'), count: ports.length },
    {
      id: 'dev',
      label: t('tools.port_manager.filter_dev', 'Dev Ports'),
      count: ports.filter((p) => COMMON_DEV_PORTS.has(p.port)).length,
      icon: 'developer_board',
    },
    {
      id: 'vylo',
      label: t('tools.port_manager.filter_vylo', 'VyloServe Managed'),
      count: ports.filter((p) => p.is_vylo_managed).length,
      icon: 'apps',
    },
    {
      id: 'tcp',
      label: 'TCP',
      count: ports.filter((p) => p.protocol === 'TCP').length,
    },
    {
      id: 'udp',
      label: 'UDP',
      count: ports.filter((p) => p.protocol === 'UDP').length,
    },
  ];

  const filteredPorts = useMemo(() => {
    return ports.filter((item) => {
      // Filter category
      if (selectedFilter === 'dev' && !COMMON_DEV_PORTS.has(item.port)) return false;
      if (selectedFilter === 'vylo' && !item.is_vylo_managed) return false;
      if (selectedFilter === 'tcp' && item.protocol !== 'TCP') return false;
      if (selectedFilter === 'udp' && item.protocol !== 'UDP') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const portStr = item.port.toString();
        const pidStr = item.pid ? item.pid.toString() : '';
        const nameStr = item.process_name.toLowerCase();
        const exeStr = item.exe_path.toLowerCase();
        return (
          portStr.includes(query) ||
          pidStr.includes(query) ||
          nameStr.includes(query) ||
          exeStr.includes(query)
        );
      }

      return true;
    });
  }, [ports, selectedFilter, searchQuery]);

  const columns: ColumnDef<ListeningPortItem>[] = [
    {
      id: 'port',
      header: t('tools.port_manager.col_port', 'Port'),
      width: '120px',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">
            :{item.port}
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              item.protocol === 'TCP'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
            }`}
          >
            {item.protocol}
          </span>
        </div>
      ),
    },
    {
      id: 'process',
      header: t('tools.port_manager.col_process', 'Process'),
      render: (item) => (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {item.process_name}
            </span>
            {item.pid && (
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                PID {item.pid}
              </span>
            )}
          </div>
          {item.exe_path && (
            <span
              className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-md font-mono"
              title={item.exe_path}
            >
              {item.exe_path}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('tools.port_manager.col_status', 'Status / Type'),
      width: '160px',
      render: (item) => {
        if (item.is_vylo_managed) {
          return <StatusBadge status="running" />;
        }
        if (item.is_protected) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              <span className="material-symbols-outlined text-[13px]">shield</span>
              {t('tools.port_manager.badge_system', 'System')}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
            {t('tools.port_manager.badge_user_process', 'User Process')}
          </span>
        );
      },
    },
    {
      id: 'address',
      header: t('tools.port_manager.col_address', 'Bind Address'),
      width: '130px',
      render: (item) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {item.local_address}
        </span>
      ),
    },
    {
      id: 'memory',
      header: t('tools.port_manager.col_memory', 'Memory'),
      width: '100px',
      render: (item) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {item.memory_mb > 0 ? `${item.memory_mb} MB` : '-'}
        </span>
      ),
    },
    {
      id: 'action',
      header: t('tools.port_manager.col_action', 'Action'),
      width: '100px',
      align: 'right',
      render: (item) => {
        if (item.is_protected) {
          return (
            <span
              className="text-xs text-slate-400 dark:text-slate-600 italic cursor-not-allowed"
              title={t('tools.port_manager.protected_tooltip', 'Protected process')}
            >
              {t('tools.port_manager.btn_protected', 'Protected')}
            </span>
          );
        }

        return (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setKillTarget(item)}
            className="flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">cancel</span>
            {t('tools.port_manager.btn_kill', 'Kill')}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('tools.port_manager.title', 'Port & Process Manager')}
        subtitle={t(
          'tools.port_manager.subtitle',
          'Inspect active TCP/UDP ports, identify processes, and resolve port conflicts.'
        )}
        icon="radar"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPorts}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isLoading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            {t('tools.port_manager.btn_refresh', 'Refresh')}
          </Button>
        }
      />

      <Card title={t('tools.port_manager.title', 'Port & Process Manager')} gridCols="grid-cols-1">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <FilterChips
              items={filterChips}
              selectedId={selectedFilter}
              onChange={setSelectedFilter}
            />
          </div>

          <DataTable
            data={filteredPorts}
            columns={columns}
            keyExtractor={(item, index) =>
              item.id || `${item.protocol}-${item.local_address}-${item.port}-${item.pid ?? 'none'}-${index}`
            }
            isLoading={isLoading}
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: t(
                'tools.port_manager.search_placeholder',
                'Search port, PID, or process name...'
              ),
            }}
            emptyState={
              <EmptyState
                icon="radar"
                title={t('tools.port_manager.empty_title', 'No Listening Ports Found')}
                description={t(
                  'tools.port_manager.empty_desc',
                  'No network ports match your search query or filter.'
                )}
              />
            }
          />
        </div>
      </Card>

      {/* Modal Konfirmasi Kill Process */}
      {killTarget && (
        <Modal
          isOpen={Boolean(killTarget)}
          onClose={() => !isKilling && setKillTarget(null)}
          title={t('tools.port_manager.modal_kill_title', 'Terminate Process')}
          maxWidthClass="max-w-md"
        >
          <div className="flex flex-col gap-4">
            <InfoBox tone="warning" icon="warning">
              {t(
                'tools.port_manager.kill_warning',
                'Terminating a process abruptly may cause unsaved data to be lost. Ensure this process is safe to terminate.'
              )}
            </InfoBox>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tools.port_manager.col_process', 'Process')}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {killTarget.process_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PID:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {killTarget.pid}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tools.port_manager.col_port', 'Port')}:</span>
                <span className="font-mono font-bold text-primary">
                  {killTarget.protocol} :{killTarget.port}
                </span>
              </div>
              {killTarget.exe_path && (
                <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Path:</span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                    {killTarget.exe_path}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="force-kill-checkbox"
                type="checkbox"
                checked={isForceKill}
                onChange={(e) => setIsForceKill(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <FieldLabel
                htmlFor="force-kill-checkbox"
                className="mb-0 cursor-pointer text-xs"
              >
                {t('tools.port_manager.label_force_kill', 'Force kill immediately (SIGKILL)')}
              </FieldLabel>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setKillTarget(null)}
                disabled={isKilling}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleKillProcess}
                disabled={isKilling}
                className="flex items-center gap-1.5"
              >
                {isKilling && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                )}
                {t('tools.port_manager.btn_confirm_kill', 'Kill Process')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
