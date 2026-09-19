import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import QrMain from '../../../../src/menu/tools/qr-generator/Main';

const qrInstances: Array<{ append: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> }> = [];

vi.mock('qr-code-styling', () => ({
    default: vi.fn().mockImplementation(function MockQRCodeStyling(this: unknown) {
        const instance = { append: vi.fn(), update: vi.fn(), download: vi.fn() };
        qrInstances.push(instance);
        return instance;
    }),
}));

describe('QrMain', () => {
    it('defaults to URL content type with the default vyloserve.com URL as raw data', () => {
        renderWithToast(<QrMain />);
        expect(screen.getByText('https://vyloserve.com')).toBeInTheDocument();
    });

    it('appends the QR instance to the preview container on mount', () => {
        renderWithToast(<QrMain />);
        expect(qrInstances.at(-1)!.append).toHaveBeenCalledTimes(1);
    });

    it('updates the raw data as the URL input changes', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.clear(screen.getByLabelText('tools.qr.enter_url'));
        await user.type(screen.getByLabelText('tools.qr.enter_url'), 'https://example.com');

        expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });

    it('switches to text content type and reflects typed text in the raw data', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.selectOptions(screen.getByDisplayValue('tools.qr.type_url'), 'text');
        await user.type(screen.getByRole('textbox'), 'hello world');

        expect(screen.getAllByText('hello world')).toHaveLength(2);
    });

    it('shows the "kosong" placeholder as raw data when the text content type is empty', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.selectOptions(screen.getByDisplayValue('tools.qr.type_url'), 'text');

        expect(screen.getByText('kosong')).toBeInTheDocument();
    });

    it('builds a mailto raw data string from the email fields', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.selectOptions(screen.getByDisplayValue('tools.qr.type_url'), 'email');

        await user.type(screen.getByLabelText('tools.qr.email_to'), 'a@b.com');
        await user.type(screen.getByLabelText('tools.qr.email_subject'), 'Hi');

        expect(screen.getByText('mailto:a@b.com?subject=Hi&body=')).toBeInTheDocument();
    });

    it('builds a WIFI raw data string from the wifi fields', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.selectOptions(screen.getByDisplayValue('tools.qr.type_url'), 'wifi');

        await user.type(screen.getByLabelText('tools.qr.wifi_ssid'), 'MyNet');
        await user.type(screen.getByLabelText('tools.qr.password'), 'secret');

        expect(screen.getByText('WIFI:T:WPA;S:MyNet;P:secret;H:false;;')).toBeInTheDocument();
    });

    it('updates the QR instance (not re-creates it) when a visual option changes', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const instance = qrInstances.at(-1)!;

        await user.selectOptions(screen.getByDisplayValue('tools.qr.rounded'), 'square');

        expect(instance.update).toHaveBeenCalled();
        expect(instance.append).toHaveBeenCalledTimes(1);
    });

    it('downloads the QR code with the selected extension and shows a success toast', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const instance = qrInstances.at(-1)!;

        await user.selectOptions(screen.getByDisplayValue('PNG'), 'svg');
        await user.click(screen.getByText('tools.qr.download'));

        expect(instance.download).toHaveBeenCalledWith(expect.objectContaining({ extension: 'svg' }));
        expect(await screen.findByText(/SVG!/)).toBeInTheDocument();
    });

    it('disables the logo-scale slider until a logo is uploaded', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        expect(screen.getByLabelText(/tools\.qr\.logo_scale/)).toBeDisabled();

        const file = new File(['logo'], 'logo.png', { type: 'image/png' });
        const fileInput = document.querySelector('input[type="file"][accept]') as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => expect(screen.getByLabelText(/tools\.qr\.logo_scale/)).not.toBeDisabled());
    });

    it('does not set a logo when the file input change carries no file', () => {
        renderWithToast(<QrMain />);
        const fileInput = document.querySelector('input[type="file"][accept]') as HTMLInputElement;

        fireEvent.change(fileInput, { target: { files: [] } });

        expect(screen.getByLabelText(/tools\.qr\.logo_scale/)).toBeDisabled();
    });

    it('updates the dot color, corner pattern, corner color, resolution, and margin controls', () => {
        renderWithToast(<QrMain />);
        const [dotsColor, cornerColor] = screen.getAllByDisplayValue('#0f172a');

        fireEvent.change(dotsColor, { target: { value: '#ff0000' } });
        fireEvent.change(screen.getByDisplayValue('tools.qr.extra_rounded'), { target: { value: 'square' } });
        fireEvent.change(cornerColor, { target: { value: '#00ff00' } });
        fireEvent.change(screen.getByDisplayValue('240'), { target: { value: '400' } });
        fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '20' } });

        expect(screen.getByText('400px')).toBeInTheDocument();
        expect(screen.getByText('20px')).toBeInTheDocument();
    });

    it('updates the logo scale once a logo has been uploaded', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const file = new File(['logo'], 'logo.png', { type: 'image/png' });
        const fileInput = document.querySelector('input[type="file"][accept]') as HTMLInputElement;
        await user.upload(fileInput, file);
        const logoScale = await screen.findByLabelText(/tools\.qr\.logo_scale/);
        await waitFor(() => expect(logoScale).not.toBeDisabled());

        fireEvent.change(logoScale, { target: { value: '0.2' } });

        expect(screen.getByText('0.2')).toBeInTheDocument();
    });
});
