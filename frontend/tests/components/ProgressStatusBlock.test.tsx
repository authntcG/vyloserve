import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressStatusBlock from '../../src/components/ProgressStatusBlock';

describe('ProgressStatusBlock', () => {
    it('renders title, progress text and percentage', () => {
        render(
            <ProgressStatusBlock
                title="Installation Progress"
                progressText="Downloading package..."
                progress={45}
            />
        );

        expect(screen.getByText('Installation Progress')).toBeInTheDocument();
        expect(screen.getByText('Downloading package...')).toBeInTheDocument();
        expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('renders without optional title', () => {
        render(
            <ProgressStatusBlock
                progressText="Extracting files..."
                progress={80}
            />
        );

        expect(screen.queryByText('Installation Progress')).not.toBeInTheDocument();
        expect(screen.getByText('Extracting files...')).toBeInTheDocument();
        expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('renders cancel button when onCancel is provided and handles click', () => {
        const onCancel = vi.fn();
        render(
            <ProgressStatusBlock
                progressText="Downloading..."
                progress={50}
                onCancel={onCancel}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /cancel_install/i });
        expect(cancelBtn).toBeInTheDocument();
        cancelBtn.click();
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables cancel button and shows cancelling text when isCancelling is true', () => {
        render(
            <ProgressStatusBlock
                progressText="Downloading..."
                progress={50}
                onCancel={vi.fn()}
                isCancelling={true}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /cancelling/i });
        expect(cancelBtn).toBeDisabled();
        expect(screen.getByText('common.cancelling')).toBeInTheDocument();
    });
});

