import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AiActionCard from '../../../../../src/menu/tools/ai-assistant/components/AiActionCard';

describe('AiActionCard', () => {
    beforeEach(() => {
        (window as any).pywebview = {
            api: {
                start_apache_server: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.apache.started_success' }),
                stop_apache_server: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.apache.stopped_success' }),
                restart_apache_server: vi.fn().mockResolvedValue({ status: 'success', message: 'backend.apache.restarted_success' }),
                set_apache_active_version: vi.fn().mockResolvedValue({ status: 'success' }),
                start_php: vi.fn().mockResolvedValue({ status: 'success' }),
                stop_php: vi.fn().mockResolvedValue({ status: 'success' }),
                start_database: vi.fn().mockResolvedValue({ status: 'success' }),
                stop_database: vi.fn().mockResolvedValue({ status: 'success' }),
                start_service: vi.fn().mockResolvedValue({ status: 'success' }),
                stop_service: vi.fn().mockResolvedValue({ status: 'success' }),
            },
        };
    });

    it('renders apache start action card with target version', () => {
        render(
            <AiActionCard
                action={{
                    service: 'apache',
                    action: 'start',
                    target: '2.4.58',
                    label: 'Start Apache 2.4.58',
                }}
            />
        );

        expect(screen.getByText('Start Apache 2.4.58')).toBeInTheDocument();
        expect(screen.getByText('2.4.58')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm & execute/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('executes apache start when clicking confirm button and dispatches service change', async () => {
        const onExecuted = vi.fn();
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        render(
            <AiActionCard
                action={{
                    service: 'apache',
                    action: 'start',
                    target: '2.4.58',
                }}
                onExecuted={onExecuted}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.start_apache_server).toHaveBeenCalledTimes(1);
            expect(onExecuted).toHaveBeenCalledTimes(1);
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'vylo_service_change' }));
        });
    });

    it('executes apache restart when action is restart', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'apache',
                    action: 'restart',
                    target: '2.4.58',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.restart_apache_server).toHaveBeenCalledTimes(1);
        });
    });

    it('executes php start for specific version', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'php',
                    action: 'start',
                    target: '8.2.12',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.start_php).toHaveBeenCalledWith('8.2.12');
        });
    });

    it('executes database start for specific instance id', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'database',
                    action: 'start',
                    target: 'mysql_8_0_35',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.start_database).toHaveBeenCalledWith('mysql_8_0_35');
        });
    });

    it('handles api failure gracefully with error feedback and retry', async () => {
        (window as any).pywebview.api.start_apache_server.mockResolvedValueOnce({
            status: 'error',
            message: 'Port 80 is occupied',
        });

        render(
            <AiActionCard
                action={{
                    service: 'apache',
                    action: 'start',
                    target: '2.4.58',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect(screen.getByText(/port 80 is occupied/i)).toBeInTheDocument();
        });

        // Retry button exists
        const retryBtn = screen.getByRole('button', { name: /coba lagi|refresh/i });
        expect(retryBtn).toBeInTheDocument();
    });

    it('cancels the proposed action without executing when clicking cancel', () => {
        render(
            <AiActionCard
                action={{
                    service: 'apache',
                    action: 'start',
                    target: '2.4.58',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.getByText(/action cancelled/i)).toBeInTheDocument();
        expect((window as any).pywebview.api.start_apache_server).not.toHaveBeenCalled();
    });

    it('executes php start using api.start_service when target is omitted', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'php',
                    action: 'start',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.start_service).toHaveBeenCalledWith('php');
        });
    });

    it('dispatches service_status_changed event on successful execution', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        render(
            <AiActionCard
                action={{
                    service: 'database',
                    action: 'start',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'service_status_changed',
                    detail: { service: 'database', running: true },
                })
            );
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'service_status_changed',
                    detail: { service: 'all' },
                })
            );
        });
    });

    it('executes php stop using api.stop_service when action is stop and target is all', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'php',
                    action: 'stop',
                    target: 'all',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.stop_service).toHaveBeenCalledWith('php');
            expect((window as any).pywebview.api.start_service).not.toHaveBeenCalled();
            expect((window as any).pywebview.api.start_php).not.toHaveBeenCalled();
        });
    });

    it('executes database stop using api.stop_service when action is stop and target is all', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'database',
                    action: 'stop',
                    target: 'all',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.stop_service).toHaveBeenCalledWith('database');
            expect((window as any).pywebview.api.start_service).not.toHaveBeenCalled();
            expect((window as any).pywebview.api.start_database).not.toHaveBeenCalled();
        });
    });

    it('executes php stop for specific version when target is specified', async () => {
        render(
            <AiActionCard
                action={{
                    service: 'php',
                    action: 'stop',
                    target: '8.2.12',
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirm & execute/i }));

        await waitFor(() => {
            expect((window as any).pywebview.api.stop_php).toHaveBeenCalledWith('8.2.12');
            expect((window as any).pywebview.api.start_php).not.toHaveBeenCalled();
        });
    });
});
