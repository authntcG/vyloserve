import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import FieldLabel from '../../components/FieldLabel';
import EmptyState from '../../components/EmptyState';
import Select, { type SelectOption } from '../../components/Select';
import { useToast } from '../../context/ToastContext';

export interface ProjectAppLogsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly project: { id: string; name: string; domain?: string; path?: string } | null;
}

interface ProjectLogFileItem {
  path: string;
  name: string;
  size_bytes: number;
  mtime: number;
}

type SeverityFilter = 'ALL' | 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';

const MAX_LOG_LINES = 500;

export default function ProjectAppLogsModal({ isOpen, onClose, project }: ProjectAppLogsModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [logFiles, setLogFiles] = useState<ProjectLogFileItem[]>([]);
  const [selectedLogPath, setSelectedLogPath] = useState<string>('');

  // Log Stream State
  const [lines, setLines] = useState<string[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Filters State
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Clear log confirmation state
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch available log files
  const loadLogFiles = useCallback(async () => {
    if (!project?.id) return;
    setIsLoadingFiles(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.list_project_log_files) {
        const res = await api.list_project_log_files(project.id);
        if (res.status === 'success') {
          const files: ProjectLogFileItem[] = res.log_files || [];
          setLogFiles(files);
          if (files.length > 0 && !selectedLogPath) {
            setSelectedLogPath(files[0].path);
          }
        } else {
          showToast(t(res.message || 'backend.error.unexpected', res.args || {}) as string, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to list project log files', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen && project?.id) {
      loadLogFiles();
      setLines([]);
      setOffset(0);
      setIsPaused(false);
      setSearchFilter('');
      setSeverityFilter('ALL');
      setIsConfirmingClear(false);
    }
  }, [isOpen, project?.id, loadLogFiles]);

  // Read initial tail when selected log changes
  useEffect(() => {
    if (!isOpen || !project?.id || !selectedLogPath) return;

    let isMounted = true;
    const fetchInitialTail = async () => {
      try {
        const api = (window as any).pywebview?.api;
        if (api?.get_project_app_logs) {
          const res = await api.get_project_app_logs(project.id, selectedLogPath, null, 150);
          if (isMounted && res.status === 'success') {
            setLines(res.lines || []);
            setOffset(res.offset || 0);
          }
        }
      } catch {
        // Handled silently for background stream
      }
    };

    setLines([]);
    setOffset(0);
    fetchInitialTail();

    return () => {
      isMounted = false;
    };
  }, [isOpen, project?.id, selectedLogPath]);

  // Polling stream for incremental new lines
  useEffect(() => {
    if (!isOpen || !project?.id || !selectedLogPath || isPaused) return;

    const interval = setInterval(async () => {
      try {
        const api = (window as any).pywebview?.api;
        if (api?.get_project_app_logs) {
          const res = await api.get_project_app_logs(project.id, selectedLogPath, offset, 100);
          if (res.status === 'success') {
            const newLines: string[] = res.lines || [];
            if (newLines.length > 0) {
              setLines((prev) => {
                const combined = [...prev, ...newLines];
                return combined.length > MAX_LOG_LINES
                  ? combined.slice(combined.length - MAX_LOG_LINES)
                  : combined;
              });
            }
            setOffset(res.offset || 0);
          }
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, project?.id, selectedLogPath, isPaused, offset]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Truncate / Clear log file
  const handleClearLog = async () => {
    if (!project?.id || !selectedLogPath) return;
    setIsClearing(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.clear_project_app_log) {
        const res = await api.clear_project_app_log(project.id, selectedLogPath);
        if (res.status === 'success') {
          setLines([]);
          setOffset(0);
          setIsConfirmingClear(false);
          showToast(t('projects.app_logs.clear_success', 'Log file cleared successfully.'), 'success');
        } else {
          showToast(t(res.message || 'backend.project.log_clear_error', res.args || {}) as string, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to clear log', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyLogs = () => {
    if (filteredLines.length === 0) return;
    navigator.clipboard.writeText(filteredLines.join('\n'));
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  // Filtered Lines based on severity and search query
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (severityFilter !== 'ALL') {
        const upper = line.toUpperCase();
        if (severityFilter === 'ERROR' && !upper.includes('ERROR') && !upper.includes('FATAL') && !upper.includes('CRITICAL')) {
          return false;
        }
        if (severityFilter === 'WARNING' && !upper.includes('WARN')) {
          return false;
        }
        if (severityFilter === 'INFO' && !upper.includes('INFO')) {
          return false;
        }
        if (severityFilter === 'DEBUG' && !upper.includes('DEBUG')) {
          return false;
        }
      }

      if (searchFilter.trim()) {
        return line.toLowerCase().includes(searchFilter.toLowerCase());
      }

      return true;
    });
  }, [lines, severityFilter, searchFilter]);

  const fileOptions: ReadonlyArray<SelectOption<string>> = useMemo(() => {
    return logFiles.map((file) => ({
      value: file.path,
      label: `${file.path} (${(file.size_bytes / 1024).toFixed(1)} KB)`,
    }));
  }, [logFiles]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t(
        'projects.app_logs.title',
        'Application Logs — {{name}}',
        { name: project?.name || 'Project' }
      )}
      icon="receipt_long"
      maxWidthClass="max-w-5xl"
    >
      <div className="flex flex-col gap-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* File Selector */}
          <div className="w-full sm:w-80">
            <FieldLabel htmlFor="project-log-select">
              {t('projects.app_logs.select_file', 'Select Log File')}
            </FieldLabel>
            {logFiles.length > 0 ? (
              <Select
                id="project-log-select"
                options={fileOptions}
                value={selectedLogPath}
                onChange={setSelectedLogPath}
                size="sm"
              />
            ) : (
              <span className="text-xs text-slate-500 italic">
                {isLoadingFiles ? 'Scanning log files...' : 'No log files found'}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4 sm:pt-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPaused((prev) => !prev)}
              disabled={!selectedLogPath}
            >
              <span className="material-symbols-outlined text-[16px] mr-1">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
              {isPaused
                ? t('projects.app_logs.btn_resume', 'Resume')
                : t('projects.app_logs.btn_pause', 'Pause')}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLogs}
              disabled={filteredLines.length === 0}
            >
              <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
              {t('common.copy', 'Copy')}
            </Button>

            {!isConfirmingClear ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsConfirmingClear(true)}
                disabled={!selectedLogPath || isClearing}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">delete_sweep</span>
                {t('projects.app_logs.btn_clear', 'Clear Log')}
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 animate-fadeIn">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleClearLog}
                  disabled={isClearing}
                >
                  {isClearing ? 'Clearing...' : 'Confirm Clear'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        {logFiles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            {/* Severity Chips */}
            <div className="flex items-center gap-1.5">
              {(['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'] as SeverityFilter[]).map((sev) => {
                const isActive = severityFilter === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t(`projects.app_logs.filter_${sev.toLowerCase()}`, sev)}
                  </button>
                );
              })}
            </div>

            {/* Search Input & Auto-scroll */}
            <div className="flex items-center gap-4">
              <div className="w-48 sm:w-60">
                <FieldLabel htmlFor="log-search-input" visuallyHidden>
                  {t('projects.app_logs.search_placeholder', 'Search log output...')}
                </FieldLabel>
                <input
                  id="log-search-input"
                  type="text"
                  placeholder={t('projects.app_logs.search_placeholder', 'Search log output...')}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              <label htmlFor="log-autoscroll-toggle" className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  id="log-autoscroll-toggle"
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>{t('projects.app_logs.auto_scroll', 'Auto-scroll')}</span>
              </label>
            </div>
          </div>
        )}

        {/* Log Viewer Content */}
        {logFiles.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon="receipt_long"
              title={t('projects.app_logs.no_logs_found', 'No .log files found in this project.')}
              description={t(
                'projects.app_logs.no_logs_desc',
                'Ensure your application writes logs to storage/logs, logs, or root.'
              )}
            />
          </div>
        ) : (
          <section
            ref={logContainerRef}
            aria-label="Application log terminal"
            className="w-full h-[450px] overflow-y-auto overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-200 select-text outline-none focus:ring-1 focus:ring-primary"
          >
            {filteredLines.length === 0 ? (
              <span className="text-slate-500 italic">
                {t('projects.app_logs.log_empty', 'Log file is empty or no lines match current filters.')}
              </span>
            ) : (
              filteredLines.map((line, idx) => {
                const upper = line.toUpperCase();
                let colorClass = 'text-slate-300';
                if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('CRITICAL')) {
                  colorClass = 'text-rose-400 font-semibold';
                } else if (upper.includes('WARN')) {
                  colorClass = 'text-amber-300';
                } else if (upper.includes('INFO')) {
                  colorClass = 'text-sky-300';
                } else if (upper.includes('DEBUG')) {
                  colorClass = 'text-slate-400';
                }

                return (
                  <div key={`log-${idx}-${line.slice(0, 20)}`} className={`whitespace-pre-wrap break-all hover:bg-slate-900/60 ${colorClass}`}>
                    {line}
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
