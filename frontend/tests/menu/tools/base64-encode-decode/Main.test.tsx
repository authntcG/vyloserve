import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import Base64Main from '../../../../src/menu/tools/base64-encode-decode/Main';

describe('Base64Main', () => {
    it('encodes typed text to base64 in encode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hello');

        expect(screen.getByDisplayValue('aGVsbG8=')).toBeInTheDocument();
        expect(screen.getByText('5 Bytes')).toBeInTheDocument();
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
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'not-valid-base64!!!');

        expect(screen.getByDisplayValue('tools.base64.decode_error')).toBeInTheDocument();
    });

    it('shows an image preview when decoding an image data URI', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.click(screen.getByText('tools.base64.tab_decode'));

        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'data:image/png;base64,aGVsbG8=');

        expect(screen.getByAltText('tools.base64.preview_alt')).toBeInTheDocument();
    });

    it('does not show a preview when decoding a non-image data URI', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.click(screen.getByText('tools.base64.tab_decode'));

        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'data:text/plain;base64,aGVsbG8=');

        expect(screen.queryByAltText('tools.base64.preview_alt')).not.toBeInTheDocument();
    });

    it('shows the placeholder info message when there is no input and no preview', () => {
        renderWithToast(<Base64Main />);
        expect(screen.getByText('tools.base64.info_placeholder')).toBeInTheDocument();
    });

    it('copies the output and shows a success toast when the copy button is clicked', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderWithToast(<Base64Main />);

        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hi');
        await user.click(screen.getByRole('button', { name: /tools\.base64\.copy/ }));

        expect(writeText).toHaveBeenCalledWith('aGk=');
        expect(await screen.findByText('tools.base64.copied_to_clipboard')).toBeInTheDocument();
    });

    it('disables the copy button when there is no output', () => {
        renderWithToast(<Base64Main />);
        expect(screen.getByRole('button', { name: /tools\.base64\.copy/ })).toBeDisabled();
    });

    it('switches to file-input mode in encode mode and encodes an uploaded file as a data URL', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);

        await user.click(screen.getByText('tools.base64.file_input'));
        const file = new File(['hello file'], 'note.txt', { type: 'text/plain' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        await user.upload(fileInput, file);

        expect(await screen.findByText('text/plain')).toBeInTheDocument();
        expect(screen.getAllByText('note.txt')).toHaveLength(2);
    });

    it('hides the file-input toggle in decode mode and clears state when switching tabs', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.type(screen.getByPlaceholderText('tools.base64.type_text_here'), 'hello');
        expect(screen.getByDisplayValue('aGVsbG8=')).toBeInTheDocument();

        await user.click(screen.getByText('tools.base64.tab_decode'));

        expect(screen.queryByText('tools.base64.file_input')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('hello')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('tools.base64.paste_base64_here')).toHaveValue('');
    });

    it('switches back to encode mode from decode mode, clearing state', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.click(screen.getByText('tools.base64.tab_decode'));
        await user.type(screen.getByPlaceholderText('tools.base64.paste_base64_here'), 'aGVsbG8=');

        await user.click(screen.getByText('tools.base64.tab_encode'));

        expect(screen.getByPlaceholderText('tools.base64.type_text_here')).toHaveValue('');
    });

    it('switches back to text input mode from file input mode, clearing state', async () => {
        const user = userEvent.setup();
        renderWithToast(<Base64Main />);
        await user.click(screen.getByText('tools.base64.file_input'));

        await user.click(screen.getByText('tools.base64.text_input'));

        expect(screen.getByPlaceholderText('tools.base64.type_text_here')).toHaveValue('');
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
});
