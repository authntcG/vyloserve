import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompactFileDropzone from '../../src/components/CompactFileDropzone';

describe('CompactFileDropzone', () => {
    it('renders empty dropzone with default prompt and hidden input', () => {
        render(
            <CompactFileDropzone
                id="test_dropzone"
                promptText="Drag & drop a file here or browse"
                onFileSelected={vi.fn()}
            />
        );

        expect(screen.getByText(/Drag & drop a file here or browse/i)).toBeInTheDocument();
        const input = document.getElementById('test_dropzone') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input).toHaveClass('hidden');
    });

    it('triggers onFileSelected with file and dataUrl when file is uploaded via input', async () => {
        const handleSelected = vi.fn();
        const user = userEvent.setup();

        render(
            <CompactFileDropzone
                id="test_dropzone"
                onFileSelected={handleSelected}
            />
        );

        const file = new File(['sample content'], 'test.txt', { type: 'text/plain' });
        const input = document.getElementById('test_dropzone') as HTMLInputElement;

        await user.upload(input, file);

        await waitFor(() => {
            expect(handleSelected).toHaveBeenCalledWith(file, expect.stringContaining('data:text/plain;base64,'));
        });
    });

    it('renders attached file badge when currentFileName is provided and triggers onClearFile', async () => {
        const handleClear = vi.fn();
        const user = userEvent.setup();

        render(
            <CompactFileDropzone
                currentFileName="document.pdf"
                currentFileSize={2048}
                currentFileType="application/pdf"
                onFileSelected={vi.fn()}
                onClearFile={handleClear}
            />
        );

        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.getByText(/2 KB • application\/pdf/i)).toBeInTheDocument();

        const removeBtn = screen.getByRole('button', { name: /common\.delete/i });
        await user.click(removeBtn);

        expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it('handles drag-and-drop file upload', async () => {
        const handleSelected = vi.fn();
        const { container } = render(
            <CompactFileDropzone
                id="test_dropzone"
                onFileSelected={handleSelected}
            />
        );

        const dropzone = container.firstChild as HTMLDivElement;
        const file = new File(['image bytes'], 'image.png', { type: 'image/png' });

        fireEvent.dragOver(dropzone);
        expect(dropzone).toHaveClass('border-primary');

        fireEvent.dragLeave(dropzone);
        expect(dropzone).not.toHaveClass('border-primary');

        fireEvent.drop(dropzone, {
            dataTransfer: {
                files: [file],
            },
        });

        await waitFor(() => {
            expect(handleSelected).toHaveBeenCalledWith(file, expect.stringContaining('data:image/png;base64,'));
        });
    });

    it('does not trigger onFileSelected when disabled', async () => {
        const handleSelected = vi.fn();
        const { container } = render(
            <CompactFileDropzone
                id="test_dropzone"
                disabled={true}
                onFileSelected={handleSelected}
            />
        );

        const dropzone = container.firstChild as HTMLDivElement;
        const file = new File(['content'], 'test.txt', { type: 'text/plain' });

        fireEvent.drop(dropzone, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(handleSelected).not.toHaveBeenCalled();
    });
});
