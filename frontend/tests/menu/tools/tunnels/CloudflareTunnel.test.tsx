import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, fireEvent } from '../../../test-utils';
import { mockPywebviewApi, renderWithToast, resetPywebviewApi } from '../../../test-utils';
import TunnelsMain from '../../../../src/menu/tools/tunnels/Main';

const PROJECTS = [
    { id: 'p1', name: 'Blog', domain: 'blog.test' },
    { id: 'p2', name: 'Shop', domain: 'shop.test' },
];

describe('CloudflareTunnel in TunnelsMain', () => {
    afterEach(() => resetPywebviewApi());

    it('shows empty state when Cloudflare is not installed and opens install modal', async () => {
        const user = userEvent.setup();
        mockPywebviewApi({
            get_zrok_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_cloudflare_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
            get_available_cloudflare_versions: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ id: 'v1', label: '2024.8.2', value: '2024.8.2' }],
            }),
        });

        renderWithToast(<TunnelsMain initialTab="cloudflare" />);

        expect(await screen.findByText('tools.cloudflare.not_installed_title')).toBeInTheDocument();
        const installBtn = screen.getAllByRole('button', { name: 'tools.cloudflare.install_cloudflare' })[0];
        await user.click(installBtn);

        await waitFor(() => {
            expect(screen.getByText('tools.cloudflare.install_info_1')).toBeInTheDocument();
        });
    });

    it('shows engine card and active shares when Cloudflare is installed', async () => {
        mockPywebviewApi({
            get_zrok_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_cloudflare_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '2024.8.2',
                active_shares: [
                    { id: 'cf_1', project_id: 'p1', url: 'https://foo.trycloudflare.com' },
                ],
            }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
        });

        renderWithToast(<TunnelsMain initialTab="cloudflare" />);

        expect(await screen.findByText('tools.cloudflare.engine_card_title')).toBeInTheDocument();
        expect(screen.getByText('2024.8.2')).toBeInTheDocument();
        expect(screen.getByText('https://foo.trycloudflare.com')).toBeInTheDocument();
    });

    it('starts a Cloudflare share when project is selected and share button clicked', async () => {
        const user = userEvent.setup();
        const startShare = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.cloudflare.share_started',
        });

        mockPywebviewApi({
            get_zrok_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_cloudflare_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '2024.8.2',
                active_shares: [],
            }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
            start_cloudflare_share: startShare,
        });

        renderWithToast(<TunnelsMain initialTab="cloudflare" />);

        expect(await screen.findByText('tools.cloudflare.engine_card_title')).toBeInTheDocument();

        // Open project dropdown button
        const dropdownMatches = screen.getAllByText('tools.zrok.select_project');
        const dropdownBtn = dropdownMatches.find((el) => el.closest('button'))?.closest('button');
        expect(dropdownBtn).toBeInTheDocument();
        if (dropdownBtn) {
            await user.click(dropdownBtn);
            const blogOption = await screen.findByText(/blog\.test/i);
            await user.click(blogOption);

            const shareBtn = screen.getByRole('button', { name: 'tools.zrok.start_share' });
            await user.click(shareBtn);

            await waitFor(() => {
                expect(startShare).toHaveBeenCalledWith('p1');
            });
        }
    });

    it('stops a Cloudflare share when stop button is clicked', async () => {
        const user = userEvent.setup();
        const stopShare = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.cloudflare.share_stopped',
        });

        mockPywebviewApi({
            get_zrok_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_cloudflare_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '2024.8.2',
                active_shares: [
                    { id: 'cf_1', project_id: 'p1', url: 'https://foo.trycloudflare.com' },
                ],
            }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
            stop_cloudflare_share: stopShare,
        });

        renderWithToast(<TunnelsMain initialTab="cloudflare" />);

        expect(await screen.findByText('https://foo.trycloudflare.com')).toBeInTheDocument();

        const stopBtn = screen.getByRole('button', { name: 'tools.zrok.stop_share' });
        await user.click(stopBtn);

        await waitFor(() => {
            expect(stopShare).toHaveBeenCalledWith('cf_1');
        });
    });

    it('uninstalls Cloudflare via confirmation modal', async () => {
        const user = userEvent.setup();
        const uninstallCf = vi.fn().mockResolvedValue({
            status: 'success',
            message: 'backend.cloudflare.uninstall_success',
        });

        mockPywebviewApi({
            get_zrok_status: vi.fn().mockResolvedValue({ installed: false, active_shares: [] }),
            get_cloudflare_status: vi.fn().mockResolvedValue({
                installed: true,
                version: '2024.8.2',
                active_shares: [],
            }),
            get_projects: vi.fn().mockResolvedValue({ status: 'success', data: PROJECTS }),
            uninstall_cloudflare: uninstallCf,
        });

        renderWithToast(<TunnelsMain initialTab="cloudflare" />);

        expect(await screen.findByText('tools.cloudflare.engine_card_title')).toBeInTheDocument();

        const uninstallBtn = screen.getByRole('button', { name: /tools\.cloudflare\.uninstall/i });
        await user.click(uninstallBtn);

        await waitFor(() => {
            expect(screen.getByText('tools.cloudflare.uninstall_confirm_title')).toBeInTheDocument();
        });

        const confirmBtn = screen.getByRole('button', { name: 'common.uninstall' });
        await user.click(confirmBtn);

        await waitFor(() => {
            expect(uninstallCf).toHaveBeenCalled();
        });
    });
});
