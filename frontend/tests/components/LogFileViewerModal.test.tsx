import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../test-utils';
import LogFileViewerModal from '../../src/components/LogFileViewerModal';

describe('LogFileViewerModal', () => {
    it('renders nothing and does not fetch when isOpen is false', () => {
        const fetchContent = vi.fn();
        render(<LogFileViewerModal isOpen={false} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(screen.queryByText('Error Log')).not.toBeInTheDocument();
        expect(fetchContent).not.toHaveBeenCalled();
    });

    it('fetches and shows the log content once opened', async () => {
        const fetchContent = vi.fn().mockResolvedValue({ status: 'success', data: '[error] something happened' });
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('[error] something happened')).toBeInTheDocument();
        expect(fetchContent).toHaveBeenCalledTimes(1);
    });

    it('shows the empty-state message when the log file has no content', async () => {
        const fetchContent = vi.fn().mockResolvedValue({ status: 'success', data: '' });
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('settings.log_file_empty')).toBeInTheDocument();
    });

    it('shows the translated API error message when the fetch reports failure', async () => {
        const fetchContent = vi.fn().mockResolvedValue({ status: 'error', message: 'backend.apache.not_installed', args: {} });
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('backend.apache.not_installed')).toBeInTheDocument();
    });

    it('shows the generic fetch-error fallback when the failure response has no message', async () => {
        const fetchContent = vi.fn().mockResolvedValue({ status: 'error' });
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('settings.log_file_fetch_error')).toBeInTheDocument();
    });

    it('shows the generic fetch-error fallback when fetchContent throws', async () => {
        const fetchContent = vi.fn().mockRejectedValue(new Error('boom'));
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('settings.log_file_fetch_error')).toBeInTheDocument();
    });

    it('re-fetches the content when the refresh button is clicked', async () => {
        const user = userEvent.setup();
        const fetchContent = vi.fn().mockResolvedValue({ status: 'success', data: 'first content' });
        render(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Error Log" fetchContent={fetchContent} />);
        await screen.findByText('first content');

        await user.click(screen.getByText('settings.refresh'));

        expect(fetchContent).toHaveBeenCalledTimes(2);
    });

    it('calls onClose when the footer close button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const fetchContent = vi.fn().mockResolvedValue({ status: 'success', data: 'content' });
        render(<LogFileViewerModal isOpen={true} onClose={onClose} title="Error Log" fetchContent={fetchContent} />);
        await screen.findByText('content');

        await user.click(screen.getByText('Close'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('re-fetches automatically when re-opened with a new title after being closed', async () => {
        const fetchContent = vi.fn().mockResolvedValue({ status: 'success', data: 'access log content' });
        const { rerender } = render(<LogFileViewerModal isOpen={false} onClose={vi.fn()} title="Access Log" fetchContent={fetchContent} />);
        expect(fetchContent).not.toHaveBeenCalled();

        rerender(<LogFileViewerModal isOpen={true} onClose={vi.fn()} title="Access Log" fetchContent={fetchContent} />);

        expect(await screen.findByText('access log content')).toBeInTheDocument();
    });
});
