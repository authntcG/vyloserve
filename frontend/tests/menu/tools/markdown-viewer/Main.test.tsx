import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, fireEvent } from '../../../test-utils';
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
        expect(headingButtons).toHaveLength(65);
        for (const btn of headingButtons.slice(0, 5)) {
            expect(btn).toHaveClass('shrink-0');
        }

        // Verify filter outline search bar appears when headings > 8
        const filterInput = screen.getByPlaceholderText('tools.docs_reader.filter_outline');
        expect(filterInput).toBeInTheDocument();

        // Type filter query
        fireEvent.change(filterInput, { target: { value: 'Section Heading 42' } });
        expect(screen.getAllByText('Section Heading 42').length).toBeGreaterThan(1);
        expect(screen.queryByRole('button', { name: /Section Heading 1$/ })).not.toBeInTheDocument();

        // Clear filter
        await user.click(screen.getByRole('button', { name: 'Clear filter' }));
        expect(screen.getAllByRole('button', { name: /Section Heading \d+/ })).toHaveLength(65);
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

    it('toggles fullscreen reader mode on button click and exits on Escape key', async () => {
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
            data: '# Fullscreen Test',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const fullscreenBtn = await screen.findByRole('button', { name: 'tools.docs_reader.fullscreen' });
        expect(fullscreenBtn).toBeInTheDocument();

        // Enter fullscreen
        await user.click(fullscreenBtn);
        expect(screen.getByRole('button', { name: 'tools.docs_reader.exit_fullscreen' })).toBeInTheDocument();

        // Press Escape to exit fullscreen
        await user.keyboard('{Escape}');
        expect(screen.getByRole('button', { name: 'tools.docs_reader.fullscreen' })).toBeInTheDocument();
    });

    it('simplifies PageHeader to only open folder and close workspace when active', async () => {
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
            data: '# Header Test',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByRole('button', { name: 'tools.docs_reader.open_folder' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.docs_reader.close_workspace' })).toBeInTheDocument();
        // PageHeader does not contain add_folder anymore (only sidebar does)
        const addFolderButtons = screen.getAllByRole('button', { name: 'tools.docs_reader.add_folder' });
        expect(addFolderButtons).toHaveLength(1);
    });

    it('prompts privacy consent modal when opening AI Copilot in a new unconsented folder and toggles drawer directly once consented', async () => {
        const user = userEvent.setup();
        localStorage.clear();

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
            data: '# Consent Test Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        // AI Copilot button starts disabled/locked
        const aiToggleBtn = await screen.findByRole('button', { name: 'tools.docs_reader.privacy_status_off' });
        expect(aiToggleBtn).toBeInTheDocument();

        // Clicking it prompts PrivacyConsentModal
        await user.click(aiToggleBtn);
        expect(await screen.findByText('tools.docs_reader.privacy_title')).toBeInTheDocument();

        // Confirm consent
        const confirmBtn = screen.getByRole('button', { name: 'tools.docs_reader.privacy_btn_enable' });
        await user.click(confirmBtn);

        // Now drawer is open and button state reflects AI enabled
        expect(await screen.findByRole('button', { name: 'tools.docs_reader.ai_copilot' })).toBeInTheDocument();

        // Clicking again toggles drawer closed without prompting modal again
        const openAiBtn = screen.getByRole('button', { name: 'tools.docs_reader.ai_copilot' });
        await user.click(openAiBtn);
        await waitFor(() => {
            expect(screen.queryByText('tools.docs_reader.privacy_title')).not.toBeInTheDocument();
        });
    });

    it('supports collapsing and restoring the sidebar with adaptive grid col-span', async () => {
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
            data: '# Collapse Test Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Collapse Test Doc')).toBeInTheDocument();

        // Collapse sidebar button
        const hideSidebarBtn = screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' });
        expect(hideSidebarBtn).toBeInTheDocument();
        await user.click(hideSidebarBtn);

        // Sidebar tree should be hidden
        expect(screen.queryByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).not.toBeInTheDocument();
        expect(screen.queryByText('tools.docs_reader.tree_title')).not.toBeInTheDocument();

        // Edge Arrow Peek Handle appears on the left
        const peekHandle = screen.getByRole('button', { name: 'tools.docs_reader.peek_handle' });
        expect(peekHandle).toBeInTheDocument();

        // Restore sidebar by clicking handle
        await user.click(peekHandle);
        expect(await screen.findByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();
        expect(screen.getByText('tools.docs_reader.tree_title')).toBeInTheDocument();
    });

    it('auto-collapses sidebar when opening AI Copilot to give document lg:col-span-8 and AI drawer lg:col-span-4', async () => {
        const user = userEvent.setup();
        localStorage.setItem('vylo_docs_ai_consented_paths', JSON.stringify(['C:\\docs']));

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
            data: '# Auto Collapse AI Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Auto Collapse AI Doc')).toBeInTheDocument();
        // Initially sidebar is visible
        expect(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();

        // Open AI Copilot drawer
        const aiToggleBtn = screen.getByRole('button', { name: 'tools.docs_reader.ai_copilot' });
        await user.click(aiToggleBtn);

        // Sidebar should now be auto-collapsed and edge peek handle is present
        expect(screen.queryByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.docs_reader.peek_handle' })).toBeInTheDocument();

        // AI drawer is open
        expect(screen.getByLabelText('AI Document Copilot Drawer')).toBeInTheDocument();
    });

    it('applies high-contrast theme-aware styling to header buttons in light and dark reader modes', async () => {
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
            data: '# Contrast Test Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const copyBtn = await screen.findByRole('button', { name: 'tools.docs_reader.copy_markdown' });
        expect(copyBtn).toBeInTheDocument();

        // In light reader mode, copy button has crisp dark slate text on white background with visible border
        expect(copyBtn).toHaveClass('text-slate-700');
        expect(copyBtn).toHaveClass('bg-white');
        expect(copyBtn).toHaveClass('border-slate-300');

        // Switch to dark reader mode
        const themeBtn = screen.getByRole('button', { name: 'tools.docs_reader.switch_dark' });
        await user.click(themeBtn);

        // In dark reader mode, copy button has light slate text on dark background
        expect(copyBtn).toHaveClass('text-slate-300');
        expect(copyBtn).toHaveClass('bg-slate-900');
        expect(copyBtn).toHaveClass('border-slate-800');
    });

    it('supports hover-peeking and auto-closing sidebar when selecting a file', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'README.md', path: 'C:\\docs\\README.md', type: 'file' },
                { name: 'guide.md', path: 'C:\\docs\\guide.md', type: 'file' },
            ],
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Peek Test Doc',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        // Collapse sidebar
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' }));

        const peekHandle = screen.getByRole('button', { name: 'tools.docs_reader.peek_handle' });
        expect(peekHandle).toBeInTheDocument();

        // Simulate hover onto handle container
        fireEvent.mouseEnter(peekHandle.parentElement!);

        // Fast-forward for hover intent timer
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'tools.docs_reader.pin_sidebar' })).toBeInTheDocument();
        });

        // Pin sidebar from peek overlay
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.pin_sidebar' }));
        expect(screen.queryByRole('button', { name: 'tools.docs_reader.pin_sidebar' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();
    });

    it('renders edge peek handle and top bar restore button when file is open with collapsed sidebar', async () => {
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
            data: '# Opened File Reader',
        });

        // Set sidebar collapsed initially via localStorage
        localStorage.setItem('vylo_docs_sidebar_collapsed', 'true');

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Opened File Reader')).toBeInTheDocument();

        // Edge handle should be visible
        const peekHandle = screen.getByRole('button', { name: 'tools.docs_reader.peek_handle' });
        expect(peekHandle).toBeInTheDocument();

        // Top bar restore button should also be visible next to document title
        const topBarRestoreBtn = screen.getByRole('button', { name: 'tools.docs_reader.pin_sidebar' });
        expect(topBarRestoreBtn).toBeInTheDocument();

        // Clicking top bar restore button restores pinned sidebar
        await user.click(topBarRestoreBtn);
        expect(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'tools.docs_reader.peek_handle' })).not.toBeInTheDocument();
    });

    it('positions edge arrow vertically centered at 50% and restores pinned sidebar when clicking edge arrow during popup state', async () => {
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
            data: '# Centered Edge Arrow Test',
        });

        // Set sidebar collapsed initially via localStorage
        localStorage.setItem('vylo_docs_sidebar_collapsed', 'true');

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Centered Edge Arrow Test')).toBeInTheDocument();

        // Edge handle is rendered with fixed vertical center dynamic formula
        const peekHandle = screen.getByRole('button', { name: 'tools.docs_reader.peek_handle' });
        expect(peekHandle).toBeInTheDocument();
        const handleContainer = peekHandle.parentElement!;
        expect(handleContainer.style.position).toBe('fixed');
        expect(handleContainer.style.top).toContain('--system-logs-height');
        expect(handleContainer.style.transform).toBe('translateY(-50%)');
        expect(handleContainer.style.zIndex).toBe('45');

        // Hover onto handle to open peek drawer
        fireEvent.mouseEnter(handleContainer);

        // Wait for 120ms peekEnterTimer to trigger and render the peek drawer with close button
        const closeBtn = await screen.findByRole('button', { name: 'common.close' });
        expect(closeBtn).toBeInTheDocument();

        // Peek drawer also uses dynamic bottom coordinating with system logs height
        const peekDrawer = closeBtn.closest('.shadow-2xl') as HTMLElement;
        expect(peekDrawer).toBeInTheDocument();
        expect(peekDrawer.style.bottom).toContain('--system-logs-height');

        // Click edge arrow directly while in popup state to restore docked sidebar
        await user.click(peekHandle);

        expect(screen.queryByRole('button', { name: 'tools.docs_reader.pin_sidebar' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'tools.docs_reader.peek_handle' })).not.toBeInTheDocument();
    });

    it('applies dynamic height coordinating with system logs on treeview card', async () => {
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
            data: '# Dynamic Height Test',
        });

        localStorage.removeItem('vylo_docs_sidebar_collapsed');

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        expect(await screen.findByText('Dynamic Height Test')).toBeInTheDocument();

        // Check Treeview card container classes
        const hideBtn = screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' });
        const treeCard = hideBtn.closest('.lg\\:col-span-3') as HTMLElement;
        expect(treeCard).toBeInTheDocument();
        expect(treeCard).toHaveClass('h-full', 'min-h-0');
    });

    it('fetches AI provider info on mount and stores provider info state', async () => {
        window.pywebview.api.ai_get_doc_provider_info = vi.fn().mockResolvedValue({
            status: 'success',
            data: { provider: 'ollama', model: 'llama3:latest', status: 'ready' },
        });

        renderWithToast(<MarkdownViewer />);
        await waitFor(() => {
            expect(window.pywebview.api.ai_get_doc_provider_info).toHaveBeenCalledTimes(1);
        });
    });

    it('automatically closes AI drawer when document switches to an unconsented folder', async () => {
        const user = userEvent.setup();
        localStorage.setItem('vylo_docs_ai_consented_paths', JSON.stringify(['C:\\docs1']));

        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs1',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockImplementation((path: string) => {
            if (path === 'C:\\docs1') {
                return Promise.resolve({
                    status: 'success',
                    data: [{ name: 'README.md', path: 'C:\\docs1\\README.md', type: 'file' }],
                });
            }
            return Promise.resolve({
                status: 'success',
                data: [{ name: 'doc2.md', path: 'C:\\docs2\\doc2.md', type: 'file' }],
            });
        });
        window.pywebview.api.md_read_file = vi.fn().mockResolvedValue({
            status: 'success',
            data: '# Consent Switch Test',
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        // 1. Add unconsented folder C:\docs2 to workspace first while sidebar is open
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs2',
        });
        const addFolderBtn = await screen.findByRole('button', { name: 'tools.docs_reader.add_folder' });
        await user.click(addFolderBtn);
        expect(await screen.findByText('doc2.md')).toBeInTheDocument();

        // 2. Open AI Copilot drawer for consented folder C:\docs1
        const aiToggleBtn = await screen.findByRole('button', { name: 'tools.docs_reader.ai_copilot' });
        await user.click(aiToggleBtn);
        expect(screen.getByLabelText('AI Document Copilot Drawer')).toBeInTheDocument();

        // 3. Restore sidebar from top bar pin button so we can browse files
        const pinBtn = screen.getByRole('button', { name: 'tools.docs_reader.pin_sidebar' });
        await user.click(pinBtn);

        // 4. Click file in C:\docs2 (unconsented)
        const doc2File = await screen.findByText('doc2.md');
        await user.click(doc2File);

        // 5. The AI drawer should automatically close due to useEffect watching isCurrentFolderAiEnabled
        await waitFor(() => {
            expect(screen.queryByLabelText('AI Document Copilot Drawer')).not.toBeInTheDocument();
        });
    });

    it('manages peek enter and leave timers cancelling early when hover changes rapidly', async () => {
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
            data: '# Timers Test Doc',
        });

        localStorage.setItem('vylo_docs_sidebar_collapsed', 'true');
        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        const peekHandle = await screen.findByRole('button', { name: 'tools.docs_reader.peek_handle' });
        const handleContainer = peekHandle.parentElement!;

        fireEvent.mouseEnter(handleContainer);
        fireEvent.mouseLeave(handleContainer);

        fireEvent.mouseEnter(handleContainer);
        const closeBtn = await screen.findByRole('button', { name: 'common.close' });
        expect(closeBtn).toBeInTheDocument();

        fireEvent.mouseLeave(handleContainer);
        fireEvent.mouseEnter(handleContainer);

        expect(screen.getByRole('button', { name: 'common.close' })).toBeInTheDocument();

        const pinButtons = screen.getAllByRole('button', { name: 'tools.docs_reader.pin_sidebar' });
        await user.click(pinButtons[0]);
        expect(screen.getByRole('button', { name: 'tools.docs_reader.hide_sidebar' })).toBeInTheDocument();
    });

    it('handles file read errors gracefully when API returns error status or throws exception', async () => {
        const user = userEvent.setup();
        window.pywebview.api.md_select_directory = vi.fn().mockResolvedValue({
            status: 'success',
            data: 'C:\\docs',
        });
        window.pywebview.api.md_get_tree = vi.fn().mockResolvedValue({
            status: 'success',
            data: [
                { name: 'good.md', path: 'C:\\docs\\good.md', type: 'file' },
                { name: 'err.md', path: 'C:\\docs\\err.md', type: 'file' },
                { name: 'fail.md', path: 'C:\\docs\\fail.md', type: 'file' },
            ],
        });
        window.pywebview.api.md_read_file = vi.fn().mockImplementation((path: string) => {
            if (path.endsWith('err.md')) {
                return Promise.resolve({ status: 'error', message: 'Permission denied' });
            }
            if (path.endsWith('fail.md')) {
                return Promise.reject(new Error('Disk read failure'));
            }
            return Promise.resolve({ status: 'success', data: '# Initial Content' });
        });

        renderWithToast(<MarkdownViewer />);
        await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

        await user.click(await screen.findByText('err.md'));
        expect(await screen.findByText(/Permission denied/)).toBeInTheDocument();

        await user.click(screen.getByText('fail.md'));
        expect(await screen.findByText(/tools\.docs_reader\.file_load_error/)).toBeInTheDocument();
    });

    it('calculates sidebar edge position dynamically when nav element exists in DOM', async () => {
        const user = userEvent.setup();
        const fakeNav = document.createElement('nav');
        fakeNav.getBoundingClientRect = vi.fn().mockReturnValue({
            right: 320,
            width: 320,
            left: 0,
            top: 0,
            bottom: 900,
            height: 900,
        });
        document.body.appendChild(fakeNav);

        try {
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
                data: '# Nav Edge Test',
            });

            localStorage.setItem('vylo_docs_sidebar_collapsed', 'true');
            renderWithToast(<MarkdownViewer />);
            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.btn_select' }));

            const peekHandle = await screen.findByRole('button', { name: 'tools.docs_reader.peek_handle' });
            expect(peekHandle.parentElement!.style.left).toBe('320px');
        } finally {
            document.body.removeChild(fakeNav);
        }
    });
});
