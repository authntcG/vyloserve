import { describe, it, expect } from 'vitest';
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
});
