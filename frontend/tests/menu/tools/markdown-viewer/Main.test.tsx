import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import MarkdownViewerMain from '../../../../src/menu/tools/markdown-viewer/Main';

// Mock pywebview api
const mockApi = {
    md_select_directory: vi.fn(),
    md_get_tree: vi.fn(),
    md_read_file: vi.fn(),
    md_get_media: vi.fn(),
};

beforeEach(() => {
    vi.resetAllMocks();
    (window as any).pywebview = { api: mockApi };
});

describe('MarkdownViewerMain', () => {
    it('renders initial empty state', () => {
        renderWithToast(<MarkdownViewerMain />);
        expect(screen.getAllByText('tools.docs_reader.title')[0]).toBeInTheDocument();
        expect(screen.getByText('tools.docs_reader.no_folder_desc')).toBeInTheDocument();
        expect(screen.getByText('tools.docs_reader.btn_select')).toBeInTheDocument();
    });

    it('selects folder and loads tree structure without auto-opening a file', async () => {
        const user = userEvent.setup();
        
        mockApi.md_select_directory.mockResolvedValue({ status: 'success', data: '/path/to/docs' });
        mockApi.md_get_tree.mockResolvedValue({ 
            status: 'success', 
            data: [
                { name: 'doc1.md', path: '/path/to/docs/doc1.md', type: 'file' },
                { name: 'folder1', path: '/path/to/docs/folder1', type: 'dir', children: [] }
            ] 
        });

        renderWithToast(<MarkdownViewerMain />);
        
        const selectButtons = screen.getAllByText('tools.docs_reader.btn_select');
        await user.click(selectButtons[0]);

        await waitFor(() => {
            expect(mockApi.md_select_directory).toHaveBeenCalled();
            expect(mockApi.md_get_tree).toHaveBeenCalledWith('/path/to/docs');
        });

        expect(screen.getByText('doc1.md')).toBeInTheDocument();
        expect(screen.getByText('folder1')).toBeInTheDocument();
        // Since no index.md or readme.md, it should not read any file automatically
        expect(mockApi.md_read_file).not.toHaveBeenCalled();
    });

    it('auto-opens index.md if present in the tree', async () => {
        const user = userEvent.setup();
        
        mockApi.md_select_directory.mockResolvedValue({ status: 'success', data: '/path/to/docs' });
        mockApi.md_get_tree.mockResolvedValue({ 
            status: 'success', 
            data: [
                { name: 'index.md', path: '/path/to/docs/index.md', type: 'file' }
            ] 
        });
        mockApi.md_read_file.mockResolvedValue({ status: 'success', data: '# Hello Markdown' });

        renderWithToast(<MarkdownViewerMain />);
        
        const selectButtons = screen.getAllByText('tools.docs_reader.btn_select');
        await user.click(selectButtons[0]);

        await waitFor(() => {
            expect(mockApi.md_read_file).toHaveBeenCalledWith('/path/to/docs/index.md');
        });

        expect(screen.getByText('Hello Markdown')).toBeInTheDocument();
    });

    it('loads file content on click', async () => {
        const user = userEvent.setup();
        
        mockApi.md_select_directory.mockResolvedValue({ status: 'success', data: '/path/to/docs' });
        mockApi.md_get_tree.mockResolvedValue({ 
            status: 'success', 
            data: [
                { name: 'setup.md', path: '/path/to/docs/setup.md', type: 'file' }
            ] 
        });
        mockApi.md_read_file.mockResolvedValue({ status: 'success', data: '## Setup Instructions' });

        renderWithToast(<MarkdownViewerMain />);
        
        const selectButtons = screen.getAllByText('tools.docs_reader.btn_select');
        await user.click(selectButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('setup.md')).toBeInTheDocument();
        });

        await user.click(screen.getByText('setup.md'));

        await waitFor(() => {
            expect(mockApi.md_read_file).toHaveBeenCalledWith('/path/to/docs/setup.md');
            expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
        });
    });

    it('handles file load error', async () => {
        const user = userEvent.setup();
        
        mockApi.md_select_directory.mockResolvedValue({ status: 'success', data: '/path/to/docs' });
        mockApi.md_get_tree.mockResolvedValue({ 
            status: 'success', 
            data: [
                { name: 'error.md', path: '/path/to/docs/error.md', type: 'file' }
            ] 
        });
        mockApi.md_read_file.mockResolvedValue({ status: 'error', message: 'File not readable' });

        renderWithToast(<MarkdownViewerMain />);
        
        const selectButtons = screen.getAllByText('tools.docs_reader.btn_select');
        await user.click(selectButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('error.md')).toBeInTheDocument();
        });

        await user.click(screen.getByText('error.md'));

        await waitFor(() => {
            expect(screen.getByText('tools.docs_reader.file_load_error')).toBeInTheDocument();
            expect(screen.getByText('File not readable')).toBeInTheDocument();
        });
    });

    it('can close the folder', async () => {
        const user = userEvent.setup();
        
        mockApi.md_select_directory.mockResolvedValue({ status: 'success', data: '/path/to/docs' });
        mockApi.md_get_tree.mockResolvedValue({ 
            status: 'success', 
            data: [
                { name: 'file.md', path: '/path/to/docs/file.md', type: 'file' }
            ] 
        });

        renderWithToast(<MarkdownViewerMain />);
        
        const selectButtons = screen.getAllByText('tools.docs_reader.btn_select');
        await user.click(selectButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('file.md')).toBeInTheDocument();
        });

        const closeBtn = screen.getByText('tools.docs_reader.btn_select');
        await user.click(closeBtn);

        await waitFor(() => {
            expect(screen.getByText('tools.docs_reader.no_folder_desc')).toBeInTheDocument();
        });
    });
});
