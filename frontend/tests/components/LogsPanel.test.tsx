import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen, waitFor } from '../test-utils';
import { mockPywebviewApi, resetPywebviewApi } from '../test-utils';
import LogsPanel from '../../src/components/LogsPanel';

function dispatchLog(message: string, level?: string, args?: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent('vylo_log', { detail: { message, level, args } }));
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetPywebviewApi();
});

describe('LogsPanel', () => {
    it('shows the backend-initialized log entry on mount', () => {
        render(<LogsPanel />);
        expect(screen.getByText('components.logs.backend_initialized')).toBeInTheDocument();
    });

    it('appends a translated log entry with the given level when a vylo_log event fires', () => {
        render(<LogsPanel />);

        act(() => dispatchLog('components.logs.custom_message', 'error'));

        expect(screen.getByText('components.logs.custom_message')).toBeInTheDocument();
    });

    it('defaults the log level to "info" when none is provided', () => {
        render(<LogsPanel />);

        act(() => dispatchLog('no level here'));

        expect(screen.getByText('no level here')).toHaveClass('text-slate-300');
    });

    it('clears all logs, and shows the empty-state message, when the clear button is clicked', async () => {
        const user = userEvent.setup();
        render(<LogsPanel />);
        expect(screen.getByText('components.logs.backend_initialized')).toBeInTheDocument();

        await user.click(screen.getByText('components.logs.clear'));

        expect(screen.queryByText('components.logs.backend_initialized')).not.toBeInTheDocument();
        expect(screen.getByText('components.logs.empty')).toBeInTheDocument();
    });

    it('toggles the auto-scroll label/icon when the auto-scroll button is clicked', async () => {
        const user = userEvent.setup();
        render(<LogsPanel />);
        expect(screen.getByText('components.logs.auto')).toBeInTheDocument();

        await user.click(screen.getByText('components.logs.auto'));

        expect(screen.getByText('components.logs.paused')).toBeInTheDocument();
    });

    it('pauses and resumes auto-scroll when log area is scrolled away from and back to bottom', () => {
        render(<LogsPanel />);
        expect(screen.getByText('components.logs.auto')).toBeInTheDocument();

        const logContainer = screen.getByText('components.logs.backend_initialized').closest('div')!.parentElement!;
        
        // Mock the layout sizes to simulate scrolling away from bottom (gap > 10)
        Object.defineProperty(logContainer, 'scrollHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(logContainer, 'clientHeight', { configurable: true, get: () => 100 });
        
        let mockScrollTop = 100;
        Object.defineProperty(logContainer, 'scrollTop', { 
            configurable: true, 
            get: () => mockScrollTop, 
            set: (val) => { mockScrollTop = val; } 
        });
        
        fireEvent.scroll(logContainer);
        expect(screen.getByText('components.logs.paused')).toBeInTheDocument();
        
        // Mock scrolling back to bottom (gap < 10)
        mockScrollTop = 400; // 500 - 400 - 100 = 0 (gap is 0)
        
        fireEvent.scroll(logContainer);
        expect(screen.getByText('components.logs.auto')).toBeInTheDocument();
    });

    it('collapses and re-expands the log area when the expand/collapse button is clicked', async () => {
        const user = userEvent.setup();
        render(<LogsPanel />);
        expect(screen.getByText('components.logs.backend_initialized')).toBeInTheDocument();
        expect(screen.getByText('expand_more')).toBeInTheDocument();

        await user.click(screen.getByText('expand_more'));

        expect(screen.queryByText('components.logs.backend_initialized')).not.toBeInTheDocument();
        expect(screen.getByText('expand_less')).toBeInTheDocument();

        await user.click(screen.getByText('expand_less'));

        expect(screen.getByText('components.logs.backend_initialized')).toBeInTheDocument();
    });

    it('resizes the panel with the ArrowUp/ArrowDown keys on the drag handle', () => {
        render(<LogsPanel />);
        const handle = screen.getByLabelText('Drag or use arrow keys to resize panel');
        const logArea = screen.getByText('components.logs.backend_initialized').closest('div')!.parentElement!;
        expect(logArea).toHaveStyle({ height: '128px' });

        fireEvent.keyDown(handle, { key: 'ArrowUp' });
        expect(logArea).toHaveStyle({ height: '148px' });

        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        expect(logArea).toHaveStyle({ height: '108px' });
    });

    it('resizes the panel by dragging the handle with the mouse', () => {
        render(<LogsPanel />);
        const handle = screen.getByLabelText('Drag or use arrow keys to resize panel');
        const logArea = screen.getByText('components.logs.backend_initialized').closest('div')!.parentElement!;

        fireEvent.mouseDown(handle, { clientY: 500 });
        expect(document.body.style.cursor).toBe('ns-resize');

        fireEvent.mouseMove(window, { clientY: 450 });
        expect(logArea).toHaveStyle({ height: '178px' });

        fireEvent.mouseUp(window);
        expect(document.body.style.cursor).toBe('default');

        fireEvent.mouseMove(window, { clientY: 200 });
        expect(logArea).toHaveStyle({ height: '178px' });
    });

    it('copies logs via navigator.clipboard in a secure context, then reverts the "copied" label after 2s', () => {
        vi.useFakeTimers();
        const writeText = vi.fn();
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        render(<LogsPanel />);

        fireEvent.click(screen.getByText('components.logs.copy'));

        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('components.logs.backend_initialized'));
        expect(screen.getByText('components.logs.copied')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(screen.getByText('components.logs.copy')).toBeInTheDocument();
    });

    it('falls back to document.execCommand("copy") outside a secure context', () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        const execCommand = vi.fn();
        document.execCommand = execCommand;
        render(<LogsPanel />);

        fireEvent.click(screen.getByText('components.logs.copy'));

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(screen.getByText('components.logs.copied')).toBeInTheDocument();
    });

    it('filters out logs whose level is not in the persisted System Logs settings', async () => {
        mockPywebviewApi({ get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { system_log_levels: ['error'], system_log_sources: [] } }) });
        render(<LogsPanel />);

        act(() => dispatchLog('components.logs.info_message', 'info'));
        act(() => dispatchLog('components.logs.error_message', 'error'));

        await waitFor(() => expect(screen.queryByText('components.logs.info_message')).not.toBeInTheDocument());
        expect(screen.getByText('components.logs.error_message')).toBeInTheDocument();
    });

    it('filters out logs whose source is not in the persisted System Logs settings, but keeps sourceless entries', async () => {
        mockPywebviewApi({ get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { system_log_levels: null, system_log_sources: ['ApacheManager'] } }) });
        render(<LogsPanel />);

        act(() => window.dispatchEvent(new CustomEvent('vylo_log', { detail: { message: 'from apache', level: 'info', source: 'ApacheManager' } })));
        act(() => window.dispatchEvent(new CustomEvent('vylo_log', { detail: { message: 'from php', level: 'info', source: 'PhpManager' } })));

        await waitFor(() => expect(screen.queryByText('from php')).not.toBeInTheDocument());
        expect(screen.getByText('from apache')).toBeInTheDocument();
        // Entri tanpa 'source' (mis. seed log awal) tetap tampil walau filter source aktif
        expect(screen.getByText('components.logs.backend_initialized')).toBeInTheDocument();
    });

    it('shows every level/source when settings have never been customized (null = show all)', async () => {
        mockPywebviewApi({ get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { system_log_levels: null, system_log_sources: null } }) });
        render(<LogsPanel />);

        act(() => dispatchLog('components.logs.info_message', 'info'));
        act(() => dispatchLog('components.logs.error_message', 'error'));

        await waitFor(() => expect(screen.getByText('components.logs.error_message')).toBeInTheDocument());
        expect(screen.getByText('components.logs.info_message')).toBeInTheDocument();
    });

    it('hides every log when the persisted filter is an explicit empty array (regression: [] must mean "hide all", not "show all")', async () => {
        mockPywebviewApi({ get_app_settings: vi.fn().mockResolvedValue({ status: 'success', data: { system_log_levels: [], system_log_sources: null } }) });
        render(<LogsPanel />);

        act(() => dispatchLog('components.logs.info_message', 'info'));

        await waitFor(() => expect(screen.queryByText('components.logs.info_message')).not.toBeInTheDocument());
        // Seed log awal (level 'info') juga ikut disembunyikan karena filter level eksplisit kosong
        expect(screen.queryByText('components.logs.backend_initialized')).not.toBeInTheDocument();
    });

    it('re-fetches and re-applies the filter settings when a vylo_log_settings_changed event fires', async () => {
        const getSettings = vi.fn()
            .mockResolvedValueOnce({ status: 'success', data: { system_log_levels: null, system_log_sources: null } })
            .mockResolvedValueOnce({ status: 'success', data: { system_log_levels: ['error'], system_log_sources: null } });
        mockPywebviewApi({ get_app_settings: getSettings });
        render(<LogsPanel />);
        act(() => dispatchLog('components.logs.info_message', 'info'));
        expect(screen.getByText('components.logs.info_message')).toBeInTheDocument();

        act(() => window.dispatchEvent(new CustomEvent('vylo_log_settings_changed')));

        await waitFor(() => expect(screen.queryByText('components.logs.info_message')).not.toBeInTheDocument());
        expect(getSettings).toHaveBeenCalledTimes(2);
    });

    it('caps stored log entries at 500 so the in-memory buffer does not grow unbounded', () => {
        render(<LogsPanel />);

        act(() => {
            for (let i = 0; i < 510; i++) {
                window.dispatchEvent(new CustomEvent('vylo_log', { detail: { message: `msg-${i}`, level: 'info' } }));
            }
        });

        expect(screen.queryByText('components.logs.backend_initialized')).not.toBeInTheDocument();
        expect(screen.queryByText('msg-9')).not.toBeInTheDocument();
        expect(screen.getByText('msg-10')).toBeInTheDocument();
        expect(screen.getByText('msg-509')).toBeInTheDocument();
    });
});
