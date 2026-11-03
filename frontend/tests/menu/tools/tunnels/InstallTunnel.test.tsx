import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import InstallTunnel, { type InstallTunnelRef } from '../../../../src/menu/tools/tunnels/InstallTunnel';
import { ToastProvider } from '../../../../src/context/ToastContext';

const TRANSLATIONS = {
    fetchFailed: 'tools.zrok.fetch_versions_failed',
    installSuccess: 'tools.zrok.install_success',
    installFailed: 'tools.zrok.install_failed',
    info1: 'tools.zrok.install_info_1',
    info2: 'tools.zrok.install_info_2',
    versionLabel: 'tools.zrok.version',
};

function renderInstallTunnel(props: Partial<React.ComponentProps<typeof InstallTunnel>> = {}, ref?: React.Ref<InstallTunnelRef>) {
    const defaultProps = {
        fetchVersionsApi: vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { id: 'v1', label: 'v1.0.0 (Latest)', value: 'v1.0.0' },
                { id: 'v2', label: 'v0.9.0', value: 'v0.9.0' },
            ],
        }),
        installApi: vi.fn().mockResolvedValue({
            status: 'success',
            message: 'tools.zrok.install_success',
        }),
        translations: TRANSLATIONS,
        ref,
        ...props,
    };

    return render(
        <ToastProvider>
            <InstallTunnel {...defaultProps} />
        </ToastProvider>
    );
}

describe('InstallTunnel', () => {
    it('fetches versions on mount and populates options', async () => {
        renderInstallTunnel();

        await waitFor(() => {
            expect(screen.getByText('tools.zrok.install_info_1')).toBeInTheDocument();
            expect(screen.getByText('v1.0.0 (Latest)')).toBeInTheDocument();
        });
    });

    it('handles version fetch failure and displays error toast', async () => {
        renderInstallTunnel({
            fetchVersionsApi: vi.fn().mockRejectedValue(new Error('Network error')),
        });

        await waitFor(() => {
            expect(screen.getAllByText('tools.zrok.fetch_versions_failed').length).toBeGreaterThan(0);
        });
    });

    it('handles empty versions list response', async () => {
        renderInstallTunnel({
            fetchVersionsApi: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        });

        await waitFor(() => {
            expect(screen.getByText('tools.zrok.fetch_versions_failed')).toBeInTheDocument();
        });
    });

    it('submits selected version successfully via ref', async () => {
        const ref = createRef<InstallTunnelRef>();
        const installApi = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.cloudflare.install_success',
        });

        renderInstallTunnel({ installApi }, ref);

        await waitFor(() => {
            expect(screen.getByText('v1.0.0 (Latest)')).toBeInTheDocument();
        });

        const success = await ref.current?.submit();
        expect(success).toBe(true);
        expect(installApi).toHaveBeenCalledWith('v1.0.0');
    });

    it('handles install API failure and returns false from submit', async () => {
        const ref = createRef<InstallTunnelRef>();
        const installApi = vi.fn().mockResolvedValue({
            status: 'error',
            message: 'tools.zrok.install_failed',
        });

        renderInstallTunnel({ installApi }, ref);

        await waitFor(() => {
            expect(screen.getByText('v1.0.0 (Latest)')).toBeInTheDocument();
        });

        const success = await ref.current?.submit();
        expect(success).toBe(false);
        expect(installApi).toHaveBeenCalledWith('v1.0.0');
        await waitFor(() => {
            expect(screen.getByText('tools.zrok.install_failed')).toBeInTheDocument();
        });
    });

    it('handles install API unexpected exception', async () => {
        const ref = createRef<InstallTunnelRef>();
        const installApi = vi.fn().mockRejectedValue(new Error('crash'));

        renderInstallTunnel({ installApi }, ref);

        await waitFor(() => {
            expect(screen.getByText('v1.0.0 (Latest)')).toBeInTheDocument();
        });

        const success = await ref.current?.submit();
        expect(success).toBe(false);
        await waitFor(() => {
            expect(screen.getByText('backend.error.unexpected')).toBeInTheDocument();
        });
    });

    it('returns false from submit when version is empty', async () => {
        const ref = createRef<InstallTunnelRef>();
        renderInstallTunnel({
            fetchVersionsApi: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        }, ref);

        await waitFor(() => {
            expect(screen.getByText('tools.zrok.fetch_versions_failed')).toBeInTheDocument();
        });

        const success = await ref.current?.submit();
        expect(success).toBe(false);
    });
});
