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
});
