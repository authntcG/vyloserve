import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import QrMain from '../../../../src/menu/tools/qr-generator/Main';

const qrInstances: Array<{ append: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; getRawData: ReturnType<typeof vi.fn> }> = [];

vi.mock('qr-code-styling', () => ({
    default: vi.fn().mockImplementation(function MockQRCodeStyling(this: unknown) {
        const instance = {
            append: vi.fn(),
            update: vi.fn(),
            getRawData: vi.fn().mockResolvedValue(new Blob(['dummy'], { type: 'image/png' }))
        };
        qrInstances.push(instance);
        return instance;
    }),
}));

if (typeof (globalThis as any).ClipboardItem === 'undefined') {
    (globalThis as any).ClipboardItem = class ClipboardItem {
        data: Record<string, Blob>;
        constructor(data: Record<string, Blob>) {
            this.data = data;
        }
    };
}

describe('QrMain', () => {
    let readTextMock: ReturnType<typeof vi.fn>;
    let writeTextMock: ReturnType<typeof vi.fn>;
    let writeMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        readTextMock = vi.fn().mockResolvedValue('https://clipboard.vyloserve.com');
        writeTextMock = vi.fn().mockResolvedValue(undefined);
        writeMock = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(navigator, 'clipboard', {
            value: {
                readText: readTextMock,
                writeText: writeTextMock,
                write: writeMock,
            },
            writable: true,
            configurable: true,
        });
    });

    it('defaults to URL content type with the default vyloserve.com URL as raw data', () => {
        renderWithToast(<QrMain />);
        expect(screen.getAllByText('https://vyloserve.com').length).toBeGreaterThanOrEqual(1);
    });

    it('appends the QR instance to the preview container on mount', () => {
        renderWithToast(<QrMain />);
        expect(qrInstances.at(-1)!.append).toHaveBeenCalledTimes(1);
    });

    it('updates the raw data as the URL input changes and shows URL badge', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.clear(screen.getByLabelText('tools.qr.type_text_url'));
        await user.type(screen.getByLabelText('tools.qr.type_text_url'), 'https://example.com');

        expect(screen.getAllByText('https://example.com').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('tools.qr.url_detected')).toBeInTheDocument();
    });

    it('reflects typed plain text in the raw data and hides URL badge', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.clear(screen.getByLabelText('tools.qr.type_text_url'));
        await user.type(screen.getByLabelText('tools.qr.type_text_url'), 'hello world');

        expect(screen.getAllByText('hello world').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('tools.qr.url_detected')).not.toBeInTheDocument();
    });

    it('shows the "kosong" placeholder as raw data when the text content type is empty', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.clear(screen.getByLabelText('tools.qr.type_text_url'));

        expect(screen.getByText('kosong')).toBeInTheDocument();
    });

    it('builds a mailto raw data string from the email fields under contact tab', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.click(screen.getByRole('button', { name: 'tools.qr.type_contact' }));
        await user.click(screen.getByRole('button', { name: 'tools.qr.contact_email' }));

        await user.type(screen.getByLabelText('tools.qr.email_to'), 'a@b.com');
        await user.type(screen.getByLabelText('tools.qr.email_subject'), 'Hi');

        expect(screen.getByText('mailto:a@b.com?subject=Hi&body=')).toBeInTheDocument();
    });

    it('builds a WIFI raw data string from the wifi fields', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.click(screen.getByRole('button', { name: 'tools.qr.type_wifi' }));

        await user.type(screen.getByLabelText('tools.qr.wifi_ssid'), 'MyNet');
        await user.type(screen.getByLabelText('tools.qr.password'), 'secret');

        expect(screen.getByText('WIFI:T:WPA;S:MyNet;P:secret;H:false;;')).toBeInTheDocument();
    });

    it('builds a vCard raw data string from the vCard fields under contact tab', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.click(screen.getByRole('button', { name: 'tools.qr.type_contact' }));

        await user.type(screen.getByLabelText('tools.qr.vcard_name'), 'Alice Smith');
        await user.type(screen.getByLabelText('tools.qr.vcard_phone'), '123456');

        expect(screen.getByText(/BEGIN:VCARD/)).toBeInTheDocument();
        expect(screen.getByText(/FN:Alice Smith/)).toBeInTheDocument();
        expect(screen.getByText(/TEL:123456/)).toBeInTheDocument();
    });

    it('builds an SMS raw data string from the SMS fields under contact tab', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        await user.click(screen.getByRole('button', { name: 'tools.qr.type_contact' }));
        await user.click(screen.getByRole('button', { name: 'tools.qr.contact_sms' }));

        await user.type(screen.getByLabelText('tools.qr.sms_phone'), '+628123456');
        await user.type(screen.getByLabelText('tools.qr.sms_message'), 'Hello from VyloServe');

        expect(screen.getByText('SMSTO:+628123456:Hello from VyloServe')).toBeInTheDocument();
    });

    it('supports sample loading, paste, and clear buttons', async () => {
        renderWithToast(<QrMain />);

        // Clear URL
        fireEvent.click(screen.getByRole('button', { name: /tools\.qr\.clear/ }));
        expect(screen.getByLabelText('tools.qr.type_text_url')).toHaveValue('');

        // Sample URL
        fireEvent.click(screen.getByRole('button', { name: /tools\.qr\.sample/ }));
        expect(screen.getByLabelText('tools.qr.type_text_url')).toHaveValue('https://vyloserve.com');

        // Paste URL
        fireEvent.click(screen.getByRole('button', { name: /tools\.qr\.paste/ }));
        await waitFor(() => {
            expect(screen.getByLabelText('tools.qr.type_text_url')).toHaveValue('https://clipboard.vyloserve.com');
        });
    });

    it('updates error correction level (ECC) option', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const instance = qrInstances.at(-1)!;

        await user.click(screen.getByRole('button', { name: 'tools.qr.ecc_m' }));
        await user.click(screen.getByRole('option', { name: 'tools.qr.ecc_h' }));

        expect(instance.update).toHaveBeenCalledWith(
            expect.objectContaining({
                qrOptions: { errorCorrectionLevel: 'H' }
            })
        );
    });

    it('copies QR image to clipboard', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);

        await user.click(screen.getByRole('button', { name: /tools\.qr\.copy_image/ }));
        expect(await screen.findByText(/tools\.qr\.copy_image_success/)).toBeInTheDocument();
    });

    it('copies raw text to clipboard', async () => {
        renderWithToast(<QrMain />);

        fireEvent.click(screen.getByRole('button', { name: /tools\.qr\.copy_raw/ }));
        await waitFor(() => {
            expect(writeTextMock).toHaveBeenCalledWith('https://vyloserve.com');
        });
    });

    it('updates the QR instance (not re-creates it) when a visual option changes', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const instance = qrInstances.at(-1)!;

        await user.click(screen.getByRole('button', { name: 'tools.qr.rounded' }));
        await user.click(screen.getByRole('option', { name: 'tools.qr.square' }));

        expect(instance.update).toHaveBeenCalled();
        expect(instance.append).toHaveBeenCalledTimes(1);
    });

    it('downloads the QR code with the selected extension and shows a success toast', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const instance = qrInstances.at(-1)!;

        if (!window.pywebview) window.pywebview = { api: {} } as any;
        if (!window.pywebview.api) window.pywebview.api = {};
        window.pywebview.api.save_base64_file = vi.fn().mockResolvedValue({ 
            status: 'success', 
            message: 'backend.common.file_saved',
            args: { path: 'C:\\test\\qr.svg' }
        });

        await user.click(screen.getByRole('button', { name: 'PNG' }));
        await user.click(screen.getByRole('option', { name: 'SVG' }));
        await user.click(screen.getByRole('button', { name: 'tools.qr.download' }));

        expect(instance.getRawData).toHaveBeenCalledWith('svg');
        expect(await screen.findByText(/backend.common.file_saved/)).toBeInTheDocument();
        expect(window.pywebview.api.save_base64_file).toHaveBeenCalled();
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

    it('updates the dot color, corner pattern, corner color, resolution, and margin controls', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const [dotsColor, cornerColor] = screen.getAllByDisplayValue('#0f172a');

        fireEvent.change(dotsColor, { target: { value: '#ff0000' } });
        await user.click(screen.getByRole('button', { name: 'tools.qr.extra_rounded' }));
        await user.click(screen.getByRole('option', { name: 'tools.qr.square' }));
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

    it('allows clearing an uploaded logo via the delete button', async () => {
        const user = userEvent.setup();
        renderWithToast(<QrMain />);
        const file = new File(['logo'], 'my-brand.png', { type: 'image/png' });
        const fileInput = document.querySelector('input[type="file"][accept]') as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => expect(screen.getByText('my-brand.png')).toBeInTheDocument());

        const deleteBtn = screen.getByRole('button', { name: /common\.delete/i });
        await user.click(deleteBtn);

        await waitFor(() => expect(screen.getByLabelText(/tools\.qr\.logo_scale/)).toBeDisabled());
    });
});
