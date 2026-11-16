import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import FolderTreeView, { type TreeNode } from '../../../../src/menu/tools/markdown-viewer/FolderTreeView';

describe('FolderTreeView', () => {
    it('renders empty folder message when data is empty', () => {
        render(<FolderTreeView data={[]} onSelectFile={vi.fn()} />);
        expect(screen.getByText('tools.docs_reader.empty_folder')).toBeInTheDocument();
    });

    it('renders directory and file tree nodes correctly', () => {
        const treeData: TreeNode[] = [
            {
                name: 'docs',
                path: '/root/docs',
                type: 'dir',
                children: [
                    { name: 'intro.md', path: '/root/docs/intro.md', type: 'file' },
                    { name: 'advanced.md', path: '/root/docs/advanced.md', type: 'file' },
                ],
            },
            {
                name: 'README.md',
                path: '/root/README.md',
                type: 'file',
            },
        ];

        const onSelect = vi.fn();
        render(<FolderTreeView data={treeData} onSelectFile={onSelect} activePath="/root/docs/intro.md" />);

        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.getByText('intro.md')).toBeInTheDocument();
        expect(screen.getByText('README.md')).toBeInTheDocument();

        // Clicking a file calls onSelectFile
        fireEvent.click(screen.getByText('README.md'));
        expect(onSelect).toHaveBeenCalledWith('/root/README.md');

        // Clicking directory toggles its open state (collapses children)
        const dirBtn = screen.getByText('docs');
        fireEvent.click(dirBtn);
        expect(screen.queryByText('advanced.md')).not.toBeInTheDocument();

        // Clicking again expands children
        fireEvent.click(dirBtn);
        expect(screen.getByText('advanced.md')).toBeInTheDocument();
    });

    it('renders multiple workspace folders with separate headers and actions', () => {
        const onSelect = vi.fn();
        const onRemove = vi.fn();
        const onRefresh = vi.fn();

        const workspaceFolders = [
            {
                rootPath: '/project/docs',
                name: 'docs',
                children: [{ name: 'guide.md', path: '/project/docs/guide.md', type: 'file' as const }],
            },
            {
                rootPath: '/project/spec',
                name: 'spec',
                children: [{ name: 'api.md', path: '/project/spec/api.md', type: 'file' as const }],
            },
        ];

        render(
            <FolderTreeView
                workspaceFolders={workspaceFolders}
                onSelectFile={onSelect}
                onRemoveFolder={onRemove}
                onRefreshFolder={onRefresh}
            />
        );

        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.getByText('spec')).toBeInTheDocument();
        expect(screen.getByText('guide.md')).toBeInTheDocument();
        expect(screen.getByText('api.md')).toBeInTheDocument();

        // Remove folder button
        const removeButtons = screen.getAllByRole('button', { name: 'tools.docs_reader.remove_folder' });
        expect(removeButtons).toHaveLength(2);
        fireEvent.click(removeButtons[0]);
        expect(onRemove).toHaveBeenCalledWith('/project/docs');

        // Refresh folder button
        const refreshButtons = screen.getAllByRole('button', { name: 'tools.docs_reader.refresh_folder' });
        expect(refreshButtons).toHaveLength(2);
        fireEvent.click(refreshButtons[1]);
        expect(onRefresh).toHaveBeenCalledWith('/project/spec');
    });
});
