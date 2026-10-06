import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OsCompatibilityCard from '../../src/components/OsCompatibilityCard';

describe('OsCompatibilityCard', () => {
    it('renders the detected OS name, architecture, and compatibility badge', () => {
        render(
            <OsCompatibilityCard
                icon="window"
                detectedLabel="Detected System"
                osName="Windows"
                arch="Win64"
                compatibleLabel="Compatible"
            />
        );

        expect(screen.getByText('Detected System')).toBeInTheDocument();
        expect(screen.getByText('Windows')).toBeInTheDocument();
        expect(screen.getByText('Win64')).toBeInTheDocument();
        expect(screen.getByText('Compatible')).toBeInTheDocument();
    });

    it('renders the given icon name', () => {
        const { container } = render(
            <OsCompatibilityCard icon="laptop_mac" detectedLabel="Detected System" osName="macOS" arch="Universal" compatibleLabel="Compatible" />
        );
        expect(container.querySelector('.material-symbols-outlined')).toHaveTextContent('laptop_mac');
    });
});
