import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AiSuggestionChips from '../../../../../src/menu/tools/ai-assistant/components/AiSuggestionChips';

describe('AiSuggestionChips', () => {
    it('returns null when suggestions array is empty', () => {
        const { container } = render(
            <AiSuggestionChips suggestions={[]} onSelectSuggestion={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders list of suggestions with accessible region', () => {
        const onSelect = vi.fn();
        const suggestions = ['Pertanyaan 1', 'Pertanyaan 2'];

        render(
            <AiSuggestionChips
                suggestions={suggestions}
                onSelectSuggestion={onSelect}
            />
        );

        expect(screen.getByRole('region')).toBeInTheDocument();
        expect(screen.getByText('Pertanyaan 1')).toBeInTheDocument();
        expect(screen.getByText('Pertanyaan 2')).toBeInTheDocument();
    });

    it('calls onSelectSuggestion when clicking a suggestion pill', () => {
        const onSelect = vi.fn();
        const suggestions = ['Bagaimana restart Apache?'];

        render(
            <AiSuggestionChips
                suggestions={suggestions}
                onSelectSuggestion={onSelect}
            />
        );

        const btn = screen.getByRole('button', { name: /bagaimana restart apache/i });
        fireEvent.click(btn);
        expect(onSelect).toHaveBeenCalledWith('Bagaimana restart Apache?');
    });

    it('disables suggestion buttons when disabled is true', () => {
        const onSelect = vi.fn();
        render(
            <AiSuggestionChips
                suggestions={['Saran']}
                onSelectSuggestion={onSelect}
                disabled={true}
            />
        );

        const btn = screen.getByRole('button', { name: /saran/i });
        expect(btn).toBeDisabled();
    });
});
