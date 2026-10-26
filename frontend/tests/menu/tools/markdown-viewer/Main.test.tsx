import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import MarkdownViewer from '../../../../src/menu/tools/markdown-viewer/Main';

vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn().mockImplementation((id: string, code: string) => {
            return Promise.resolve({ svg: `<svg data-testid="mock-mermaid">${code}</svg>` });
        }),
    },
}));

describe('MarkdownViewer Main', () => {
    beforeEach(() => {
        localStorage.clear();
        if (!window.pywebview) window.pywebview = { api: {} } as any;
        if (!window.pywebview.api) window.pywebview.api = {};
    });

    it('renders empty state when no folder is selected', () => {
        renderWithToast(<MarkdownViewer />);
        expect(screen.getByText('tools.docs_reader.no_folder')).toBeInTheDocument();
        expect(screen.getByText('tools.docs_reader.no_folder_desc')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' })).toBeInTheDocument();
    });

    it('selects a folder and auto-loads README.md if present', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\projects\\my-app\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'README.md', path: 'C:\\projects\\my-app\\docs\\README.md', type: 'file' },
                { name: 'guide.md', path: 'C:\\projects\\my-app\\docs\\guide.md', type: 'file' },
            ],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# My Application Docs\n\nWelcome to documentation.\n\n## Section 1\nContent of section 1.',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('My Application Docs')).toBeInTheDocument();
        expect(screen.getAllByText('README.md')).toHaveLength(2);
        expect(screen.getByText(/tools\.docs_reader\.words_count/)).toBeInTheDocument();
    });

    it('displays and toggles table of contents (TOC)', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'index.md', path: 'C:\\docs\\index.md', type: 'file' }],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Main Header\n\nSome text\n\n## Sub Section\n\nMore text',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const tocBtn = await screen.findByRole('button', { name: /tools\.docs_reader\.table_of_contents/ });
        expect(tocBtn).toBeInTheDocument();

        // Toggle TOC
        await user.click(tocBtn);
        expect(screen.getAllByText('Main Header').length).toBeGreaterThan(1);
        expect(screen.getAllByText('Sub Section').length).toBeGreaterThan(1);
    });

    it('handles large outline with 60+ headings with shrink-0 and supports outline filtering', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'README.md', path: 'C:\\docs\\README.md', type: 'file' }],
        });

        // 65 distinct headings
        const headingLines: string[] = [];
        for (let i = 1; i <= 65; i++) {
            headingLines.push(`## Section Heading ${i}\n\nContent for section ${i}.`);
        }
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: `# Document Title\n\n${headingLines.join('\n\n')}`,
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const tocBtn = await screen.findByRole('button', { name: /tools\.docs_reader\.table_of_contents/ });
        expect(tocBtn).toBeInTheDocument();
        await user.click(tocBtn);

        // Verify all heading buttons have shrink-0 to prevent flex-shrink overlap
        const headingButtons = screen.getAllByRole('button', { name: /Section Heading \d+/ });
        expect(headingButtons.length).toBe(65);
        for (const btn of headingButtons.slice(0, 5)) {
            expect(btn).toHaveClass('shrink-0');
        }

        // Verify filter outline search bar appears when headings > 8
        const filterInput = screen.getByPlaceholderText('tools.docs_reader.filter_outline');
        expect(filterInput).toBeInTheDocument();

        // Type filter query
        await user.type(filterInput, 'Section Heading 42');
        expect(screen.getAllByText('Section Heading 42').length).toBeGreaterThan(1);
        expect(screen.queryByRole('button', { name: /Section Heading 1$/ })).not.toBeInTheDocument();

        // Clear filter
        await user.click(screen.getByRole('button', { name: 'Clear filter' }));
        expect(screen.getAllByRole('button', { name: /Section Heading \d+/ }).length).toBe(65);
    });

    it('ignores code block comments from being parsed as headings', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'README.md', path: 'C:\\docs\\README.md', type: 'file' }],
        });

        const mdWithCode = [
            '# Legitimate Title',
            '```python',
            '# Fake heading inside python code',
            '## Another fake heading',
            'def hello(): pass',
            '```',
            '## Legitimate Section',
            '```bash',
            '# Fake bash comment',
            'echo "hi"',
            '```',
        ].join('\n');

        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: mdWithCode,
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const tocBtn = await screen.findByRole('button', { name: /tools\.docs_reader\.table_of_contents/ });
        expect(tocBtn).toHaveTextContent('(2)'); // Only Legitimate Title & Legitimate Section

        await user.click(tocBtn);
        expect(screen.queryByText('Fake heading inside python code')).not.toBeInTheDocument();
        expect(screen.queryByText('Fake bash comment')).not.toBeInTheDocument();
    });

    it('persists and opens folder from recent list', async () => {
        const user = userEvent.setup();
        localStorage.setItem('vylo_recent_docs_folders', JSON.stringify(['C:\\projects\\past-docs']));

        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'README.md', path: 'C:\\projects\\past-docs\\README.md', type: 'file' }],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Past Docs Content',
        });

        renderWithToast(<MarkdownViewer />);
        expect(screen.getByText('C:\\projects\\past-docs')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.open_folder' }));

        expect(await screen.findByText('Past Docs Content')).toBeInTheDocument();
    });

    it('clears recent folders when clicking clear recent button', async () => {
        const user = userEvent.setup();
        localStorage.setItem('vylo_recent_docs_folders', JSON.stringify(['C:\\projects\\past-docs']));

        renderWithToast(<MarkdownViewer />);
        expect(screen.getByText('C:\\projects\\past-docs')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.clear_recent' }));
        expect(screen.queryByText('C:\\projects\\past-docs')).not.toBeInTheDocument();
        expect(localStorage.getItem('vylo_recent_docs_folders')).toBeNull();
    });

    it('supports searching/filtering files in the tree view', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'architecture.md', path: 'C:\\docs\\architecture.md', type: 'file' },
                { name: 'deployment.md', path: 'C:\\docs\\deployment.md', type: 'file' },
                {
                    name: 'guides',
                    path: 'C:\\docs\\guides',
                    type: 'dir',
                    children: [
                        { name: 'setup.md', path: 'C:\\docs\\guides\\setup.md', type: 'file' },
                    ],
                },
            ],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Architecture',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('architecture.md')).toBeInTheDocument();
        expect(screen.getByText('deployment.md')).toBeInTheDocument();

        // Search for 'setup'
        const searchInput = screen.getByPlaceholderText('tools.docs_reader.search_docs');
        await user.type(searchInput, 'setup');

        expect(screen.getByText('setup.md')).toBeInTheDocument();
        expect(screen.queryByText('architecture.md')).not.toBeInTheDocument();
        expect(screen.queryByText('deployment.md')).not.toBeInTheDocument();

        // Search for something nonexistent
        await user.clear(searchInput);
        await user.type(searchInput, 'nonexistentxyz');
        expect(screen.getByText('tools.docs_reader.no_files_found')).toBeInTheDocument();
    });

    it('supports refreshing the folder tree', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'file1.md', path: 'C:\\docs\\file1.md', type: 'file' }],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# File 1',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('file1.md')).toBeInTheDocument();

        // Refresh tree with new file added
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'file1.md', path: 'C:\\docs\\file1.md', type: 'file' },
                { name: 'file2.md', path: 'C:\\docs\\file2.md', type: 'file' },
            ],
        });

        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.refresh_tree' }));
        expect(await screen.findByText('file2.md')).toBeInTheDocument();
    });

    it('copies markdown content to clipboard and shows success toast', async () => {
        const user = userEvent.setup();
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'README.md', path: 'C:\\docs\\README.md', type: 'file' }],
        });
        const docContent = '# Sample Title\n\nContent to copy.';
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: docContent,
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Sample Title')).toBeInTheDocument();

        const copyBtn = screen.getByRole('button', { name: 'tools.docs_reader.copy_markdown' });
        expect(copyBtn).toBeInTheDocument();

        await user.click(copyBtn);
        expect(writeTextMock).toHaveBeenCalledWith(docContent);
        expect(screen.getByText('tools.docs_reader.copy_success')).toBeInTheDocument();
        expect(screen.getByText('tools.docs_reader.copied')).toBeInTheDocument();
    });

    it('renders responsive document top bar layout with breakpoint for < 1233px', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [{ name: 'README.md', path: 'C:\\docs\\README.md', type: 'file' }],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Responsive Test Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const copyBtn = await screen.findByRole('button', { name: 'tools.docs_reader.copy_markdown' });
        const topBar = copyBtn.closest('.border-b');
        expect(topBar).toHaveClass('flex-col');
        expect(topBar).toHaveClass('min-[1233px]:flex-row');
        expect(topBar).toHaveClass('min-[1233px]:items-center');

        const actionButtonsRow = copyBtn.closest('div');
        expect(actionButtonsRow).toHaveClass('-ml-2.5');
        expect(actionButtonsRow).toHaveClass('min-[1233px]:ml-0');

        const contentContainer = topBar?.parentElement;
        expect(contentContainer).toHaveClass('select-text');
    });
});
