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

    it('toggles scope from component to full URL and encodes preserving protocol and slash', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'https://example.com/a b');
        expect(screen.getByDisplayValue('https%3A%2F%2Fexample.com%2Fa%20b')).toBeInTheDocument();

        await user.click(screen.getByText('tools.url.scope_full'));
        expect(screen.getByDisplayValue('https://example.com/a%20b')).toBeInTheDocument();
    });

    it('toggles space encoding to plus sign in encode mode', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'hello world');
        expect(screen.getByDisplayValue('hello%20world')).toBeInTheDocument();

        await user.click(screen.getByText('tools.url.space_plus'));
        expect(screen.getByDisplayValue('hello+world')).toBeInTheDocument();
    });

    it('loads sample URL when clicking sample button and clears when clicking clear', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        const sampleButtons = screen.getAllByRole('button', { name: /tools\.url\.sample/i });
        await user.click(sampleButtons[0]);

        expect(screen.getAllByDisplayValue(/vyloserve\.com/).length).toBeGreaterThan(0);

        const clearBtn = screen.getByRole('button', { name: /tools\.url\.clear/i });
        await user.click(clearBtn);

        expect(screen.getByPlaceholderText('tools.url.placeholder_encode')).toHaveValue('');
    });

    it('allows editing and deleting query parameters interactively', async () => {
        const user = userEvent.setup();
        renderWithToast(<UrlMain />);

        await user.type(screen.getByPlaceholderText('tools.url.placeholder_encode'), 'https://example.com?foo=bar');

        const addBtn = screen.getByRole('button', { name: /tools\.url\.add_param/i });
        await user.click(addBtn);

        expect(screen.getByDisplayValue(/foo=bar&key=value/)).toBeInTheDocument();

        const deleteButtons = screen.getAllByRole('button', { name: /tools\.url\.delete_param/i });
        await user.click(deleteButtons[0]);

        expect(screen.getByDisplayValue(/key=value/)).toBeInTheDocument();
        expect(screen.queryByDisplayValue(/foo=bar/)).not.toBeInTheDocument();
    });
});
