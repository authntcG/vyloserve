import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import MarkdownRenderer from '../../../../src/menu/tools/markdown-viewer/MarkdownRenderer';
import { mockPywebviewApi, resetPywebviewApi } from '../../../test-utils';

vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn().mockImplementation((id: string, code: string) => {
            return Promise.resolve({ svg: `<svg data-testid="mock-mermaid">${code}</svg>` });
        }),
    },
}));

describe('MarkdownRenderer', () => {
    beforeEach(() => {
        resetPywebviewApi();
    });

    it('renders basic markdown content including headers, lists and text', () => {
        const content = `
# Title Heading
This is a test paragraph with **bold** text.
- Item 1
- Item 2
`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        expect(screen.getByText('Title Heading')).toBeInTheDocument();
        expect(screen.getByText(/This is a test paragraph/)).toBeInTheDocument();
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders mermaid code block using MermaidBlock', async () => {
        const content = `
\`\`\`mermaid
graph TD
A --> B
\`\`\`
`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="dark"
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('mock-mermaid')).toBeInTheDocument();
        });
    });

    it('renders regular code block with copy button', () => {
        const content = `
\`\`\`javascript
const x = 10;
\`\`\`
`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        expect(screen.getByText(/const x = 10;/)).toBeInTheDocument();
    });

    it('resolves and renders local media images via desktop API bridge', async () => {
        mockPywebviewApi({
            md_get_media: vi.fn().mockResolvedValue({ status: 'success', data: 'data:image/png;base64,mockImg' }),
        });

        const content = `![Local Logo](./images/logo.png)`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        await waitFor(() => {
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'data:image/png;base64,mockImg');
        });
    });

    it('handles image loading failure gracefully with error placeholder', async () => {
        mockPywebviewApi({
            md_get_media: vi.fn().mockResolvedValue({ status: 'error', message: 'Not found' }),
        });

        const content = `![Broken](./images/missing.png)`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/broken_image/i)).toBeInTheDocument();
        });
    });

    it('delegates internal link clicks to onLinkClick handler', () => {
        const onLinkClick = vi.fn();
        const content = `[Local Guide](./guide.md) and [External](https://google.com)`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
                onLinkClick={onLinkClick}
            />
        );

        const localLink = screen.getByText('Local Guide');
        fireEvent.click(localLink);
        expect(onLinkClick).toHaveBeenCalledWith('./guide.md');

        const externalLink = screen.getByText('External');
        fireEvent.click(externalLink);
        // External link should open in default browser and not trigger onLinkClick
        expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    it('renders gfm tables with header and body cells in dark and light themes', () => {
        const tableContent = `
| Feature | Supported |
| :--- | :--- |
| Markdown | Yes |
`;
        const { unmount } = render(
            <MarkdownRenderer
                content={tableContent}
                rootPath="/test/root"
                readerTheme="dark"
            />
        );

        expect(screen.getByText('Feature')).toBeInTheDocument();
        expect(screen.getByText('Markdown')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
        unmount();

        render(
            <MarkdownRenderer
                content={tableContent}
                rootPath="/test/root"
                readerTheme="light"
            />
        );
        expect(screen.getByText('Feature')).toBeInTheDocument();
    });

    it('handles absolute media path and remote http image without local bridge fetch', () => {
        const fetchMock = vi.fn();
        mockPywebviewApi({ md_get_media: fetchMock });

        const content = `![Http Img](https://example.com/logo.png) ![Data Img](data:image/png;base64,123)`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('renders MkDocs admonitions (!!! tip, !!! note, !!! warning) as styled callouts in light and dark themes', () => {
        const content = `
!!! tip "Tips Cepat"
    Gunakan **FastCGI** untuk performa optimal.

    Baris kedua di dalam tip.

!!! note
    Catatan tanpa judul kustom.

!!! warning 'Peringatan Penting'
\tJangan hapus folder konfigurasi.
`;
        const { unmount } = render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        const callouts = screen.getAllByRole('note');
        expect(callouts).toHaveLength(3);
        expect(screen.getByText('Tips Cepat')).toBeInTheDocument();
        expect(screen.getByText('FastCGI')).toBeInTheDocument();
        expect(screen.getByText('Baris kedua di dalam tip.')).toBeInTheDocument();
        expect(screen.getByText('Note')).toBeInTheDocument();
        expect(screen.getByText('Catatan tanpa judul kustom.')).toBeInTheDocument();
        expect(screen.getByText('Peringatan Penting')).toBeInTheDocument();
        expect(screen.getByText('Jangan hapus folder konfigurasi.')).toBeInTheDocument();
        unmount();

        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="dark"
            />
        );
        expect(screen.getAllByRole('note')).toHaveLength(3);
    });

    it('renders GitHub Alerts (> [!NOTE], > [!WARNING]) and preserves normal blockquotes and fenced code blocks', () => {
        const content = `
> [!IMPORTANT]
> Backup data sebelum upgrade.

> Kutipan blockquote standar biasa.

\`\`\`markdown
!!! tip "Ini di dalam blok kode"
    Harus tetap menjadi kode mentah
\`\`\`
`;
        render(
            <MarkdownRenderer
                content={content}
                rootPath="/test/root"
                readerTheme="light"
            />
        );

        const callouts = screen.getAllByRole('note');
        expect(callouts).toHaveLength(1);
        expect(screen.getByText('Important')).toBeInTheDocument();
        expect(screen.getByText('Backup data sebelum upgrade.')).toBeInTheDocument();
        expect(screen.getByText('Kutipan blockquote standar biasa.')).toBeInTheDocument();
        expect(screen.getByText(/Ini di dalam blok kode/)).toBeInTheDocument();
    });
});
