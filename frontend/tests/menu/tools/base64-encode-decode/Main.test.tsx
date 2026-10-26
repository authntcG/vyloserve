import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import Base64Main from '../../../../src/menu/tools/base64-encode-decode/Main';

describe('Base64Main', () => {
    it('encodes typed text to base64 in encode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hello');

        expect(screen.getByDisplayValue('aGVsbG8=')).toBeInTheDocument();
    });

    it('decodes base64 text back to plain text in decode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.click(screen.getByText('tools.base64.tab_decode'));
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'aGVsbG8=');

        expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });

    it('shows a decode-error message for invalid base64 input', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.click(screen.getByText('tools.base64.tab_decode'));
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'invalid!!!');

        expect(screen.getByDisplayValue('tools.base64.decode_error')).toBeInTheDocument();
    });

    it('shows an image preview when decoding an image data URI', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        const sampleDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        await user.click(screen.getByText('tools.base64.tab_decode'));
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), sampleDataUri);

        const img = screen.getByAltText('tools.base64.preview_alt');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', sampleDataUri);
    });

    it('does not show a preview when decoding a non-image data URI', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.click(screen.getByText('tools.base64.tab_decode'));
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'data:text/plain;base64,aGVsbG8=');

        expect(screen.queryByAltText('tools.base64.preview_alt')).not.toBeInTheDocument();
    });

    it('copies the output and shows a success toast when the copy button is clicked', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'test');
        await user.click(screen.getByRole('button', { name: /tools\.base64\.copy/i }));

        expect(await screen.findByText(/tools\.base64\.copied_to_clipboard/)).toBeInTheDocument();
    });

    it('encodes an uploaded file in universal input mode as a data URL', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        const file = new File(['hello file'], 'note.txt', { type: 'text/plain' });
        const fileInput = document.getElementById('base64_file_input') as HTMLInputElement;
        await user.upload(fileInput, file);

        expect(await screen.findByText('text/plain')).toBeInTheDocument();
        expect(screen.getAllByText('note.txt').length).toBeGreaterThanOrEqual(1);
    });

    it('clears state when switching between encode and decode tabs', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hello');
        expect(screen.getByDisplayValue('aGVsbG8=')).toBeInTheDocument();

        await user.click(screen.getByText('tools.base64.tab_decode'));

        expect(screen.queryByDisplayValue('hello')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('tools.base64.paste_base64_here')).toHaveValue('');

        await user.click(screen.getByText('tools.base64.tab_encode'));
        expect(screen.getByPlaceholderText('tools.base64.type_text_here')).toHaveValue('');
    });

    it('allows removing an attached file via the clear button', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
        const fileInput = document.getElementById('base64_file_input') as HTMLInputElement;
        await user.upload(fileInput, file);

        await waitFor(() => expect(screen.getAllByText('doc.pdf').length).toBeGreaterThanOrEqual(1));

        // Click remove file button
        const removeBtn = screen.getByRole('button', { name: /common\.delete/i });
        await user.click(removeBtn);

        expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
    });

    it('shows the encode-error message when the browser btoa implementation throws', async () => {
        const user = userEvent.setup();
        const btoaSpy = vi.spyOn(window, 'btoa').mockImplementation(() => {
            throw new Error('InvalidCharacterError');
        });
        renderWithToast(<Base64Main />);

        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hi');

        expect(screen.getByDisplayValue('tools.base64.encode_error')).toBeInTheDocument();
        btoaSpy.mockRestore();
    });

    it('supports URL-Safe Base64 mode replacing + and / and stripping padding', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        // "?>?" standard Base64: "Pz4/"
        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), '?>?');
        expect(screen.getByDisplayValue('Pz4/')).toBeInTheDocument();

        const urlSafeCheckbox = screen.getByLabelText(/tools\.base64\.url_safe/i);
        await user.click(urlSafeCheckbox);

        // In URL-safe Base64, / becomes _
        expect(screen.getByDisplayValue('Pz4_')).toBeInTheDocument();
    });

    it('supports line wrapping output to 64 chars', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        const longText = 'The quick brown fox jumps over the lazy dog. A longer text to exceed 64 chars.';
        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), longText);

        const wrap64Btn = screen.getByRole('button', { name: /tools\.base64\.wrap_64/i });
        await user.click(wrap64Btn);

        const textareas = screen.getAllByRole('textbox');
        const outputVal = (textareas[1] as HTMLTextAreaElement).value;
        expect(outputVal).toContain('\n');
    });

    it('loads sample text and clears all input on clear button click', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        const sampleBtn = screen.getByRole('button', { name: /tools\.base64\.sample/i });
        await user.click(sampleBtn);

        expect(screen.getByDisplayValue(/VyloServe/)).toBeInTheDocument();

        const clearBtn = screen.getByRole('button', { name: /tools\.base64\.clear/i });
        await user.click(clearBtn);

        expect(screen.getByPlaceholderText('tools.base64.type_text_here')).toHaveValue('');
    });

    it('supports downloading decoded binary file in decode mode', async () => {
        const user = userEvent.setup();
        const saveMock = vi.fn().mockResolvedValue({ status: 'success' });
        window.pywebview = { api: { save_base64_file: saveMock } } as any;

        renderWithToast(<Base64Main />);
        await user.click(screen.getByText('tools.base64.tab_decode'));

        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'aGVsbG8=');

        const downloadBtn = screen.getByRole('button', { name: /tools\.base64\.download_file/i });
        await user.click(downloadBtn);

        expect(saveMock).toHaveBeenCalled();
    });
});
