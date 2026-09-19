import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import UrlMain from '../../../../src/menu/tools/url-encode-decode/Main';

describe('UrlMain', () => {
    it('encodes special characters as the user types in encode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'a b');

        expect(screen.getByDisplayValue('a%20b')).toBeInTheDocument();
    });

    it('decodes percent-encoded input in decode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.click(screen.getByText('tools.url.decode_url'));
        await user.type(screen.getByPlaceholderText('tools.url.placeholder_decode'), 'a%20b');

        expect(screen.getByDisplayValue('a b')).toBeInTheDocument();
    });

    it('shows a malformed-input error for an invalid percent-encoded sequence in decode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.click(screen.getByText('tools.url.decode_url'));
        await user.type(screen.getByPlaceholderText('tools.url.placeholder_decode'), '%E0%A4%A');

        expect(screen.getByDisplayValue('tools.url.error_malformed')).toBeInTheDocument();
    });

    it('shows the placeholder hierarchy view when the input is not a full valid URL', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'not-a-url');

        expect(screen.getByText('tools.url.placeholder')).toBeInTheDocument();
    });

    it('parses a full URL into protocol/host, path segments, and query parameters', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(
            screen.getByPlaceholderText('tools.url.placeholder_encode'),
            'https://example.com/api/users?search=hello'
        );

        expect(screen.getByText('https')).toBeInTheDocument();
        expect(screen.getByText('example.com')).toBeInTheDocument();
        expect(screen.getByText('api')).toBeInTheDocument();
        expect(screen.getByText('users')).toBeInTheDocument();
        expect(screen.getByText('search')).toBeInTheDocument();
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('shows the root-path label for a URL with no path segments', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'https://example.com');

        expect(screen.getByText('tools.url.root')).toBeInTheDocument();
    });

    it('copies the output and shows a success toast when the copy button is clicked', async () => {
        // userEvent.setup() installs its own working Clipboard stub on navigator.clipboard
        // (overriding anything defined beforehand), so we verify through it via readText()
        // rather than re-mocking navigator.clipboard on top of it.
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'hi');
        await user.click(screen.getByRole('button', { name: /tools\.url\.copy/ }));

        expect(await navigator.clipboard.readText()).toBe('hi');
        expect(await screen.findByText('tools.url.copy_success')).toBeInTheDocument();
    });

    it('disables the copy button (so nothing can be copied) when the output is empty', async () => {
        renderWithToast(<UrlMain />);

        expect(screen.getByRole('button', { name: /tools\.url\.copy/ })).toBeDisabled();
    });

    it('switches back to encode mode and clears the input', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);
        await user.click(screen.getByText('tools.url.decode_url'));
        await user.type(screen.getByPlaceholderText('tools.url.placeholder_decode'), 'a%20b');

        await user.click(screen.getByText('tools.url.encode_url'));

        expect(screen.getByPlaceholderText('tools.url.placeholder_encode')).toHaveValue('');
    });
});
